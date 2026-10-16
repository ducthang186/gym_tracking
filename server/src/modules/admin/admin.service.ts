import { randomBytes } from "node:crypto";
import { statfs } from "node:fs/promises";
import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sql } from "kysely";
import type { Config } from "../../config/env.js";
import { uniqueViolation, type Db } from "../../db/index.js";
import type { AccountStatus, ClientStatus, UserRole } from "../../db/types.js";
import { audit } from "../../lib/audit.js";
import { badRequest, conflict, forbidden, notFound } from "../../lib/errors.js";
import { findAccessibleClient, isStaff, type Actor } from "../../lib/policy.js";
import type { Storage } from "../../lib/storage.js";
import * as authRepo from "../auth/auth.repo.js";
import type { PasswordHasher } from "../auth/password.js";
import type { AuthService } from "../auth/auth.service.js";

export interface UserRow {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  role: UserRole;
  status: AccountStatus;
  clientStatus: ClientStatus;
  package: string | null;
  coachId: string | null;
  coachName: string | null;
  latestWeightKg: number | null;
  lastLoginAt: string | null;
  createdAt: string;
}

const likeEscape = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);

export function createAdminService(deps: {
  db: Db;
  config: Config;
  auth: AuthService;
  hasher: PasswordHasher;
  storage: Storage;
}) {
  const { db, config, auth, hasher, storage } = deps;

  return {
    /** admin: mọi tài khoản. coach: chỉ học viên được gán cho mình. */
    async listUsers(actor: Actor, f: { q?: string; status?: AccountStatus; role?: UserRole; limit: number; offset: number }) {
      let query = db
        .selectFrom("users")
        .innerJoin("profiles", "profiles.id", "users.id")
        .leftJoin("profiles as coach", "coach.id", "profiles.coachId");

      if (actor.role === "coach") query = query.where("users.role", "=", "client").where("profiles.coachId", "=", actor.id);
      if (f.status) query = query.where("users.status", "=", f.status);
      if (f.role) query = query.where("users.role", "=", f.role);
      if (f.q) {
        const like = `%${likeEscape(f.q.trim())}%`;
        // SĐT lưu dạng +84…: tìm theo chữ số, bỏ số 0 đầu / mã 84 để gõ "0912…" hay "+84 912…" đều ra.
        const digits = f.q.replace(/\D/g, "").replace(/^(0|84)/, "");
        query = query.where((eb) =>
          eb.or([
            eb("profiles.fullName", "ilike", like),
            eb("users.email", "ilike", like),
            ...(digits.length >= 3 ? [eb("users.phone", "like", `%${digits}%`)] : []),
          ]),
        );
      }

      const [rows, total] = await Promise.all([
        query
          .select([
            "users.id", "users.email", "users.phone", "users.role", "users.status", "users.lastLoginAt", "users.createdAt",
            "profiles.fullName", "profiles.status as clientStatus", "profiles.package", "profiles.coachId", "coach.fullName as coachName",
          ])
          .orderBy("users.createdAt", "desc")
          .limit(f.limit)
          .offset(f.offset)
          .execute(),
        query.select((eb) => eb.fn.countAll().as("n")).executeTakeFirstOrThrow(),
      ]);

      // Cân nặng mới nhất của các người dùng trong trang này (một truy vấn, không N+1).
      const ids = rows.map((r) => r.id);
      const weights = new Map<string, number>();
      if (ids.length) {
        const res = await sql<{ userId: string; weightKg: string }>`
          select distinct on (user_id) user_id as "userId", weight_kg as "weightKg"
          from body_metrics where user_id = any(${ids}::uuid[])
          order by user_id, measured_on desc`.execute(db);
        for (const w of res.rows) weights.set(w.userId, Number(w.weightKg));
      }

      const users: UserRow[] = rows.map((r) => ({
        id: r.id,
        email: r.email,
        phone: r.phone,
        fullName: r.fullName,
        role: r.role,
        status: r.status,
        clientStatus: r.clientStatus,
        package: r.package,
        coachId: r.coachId,
        coachName: r.coachName,
        latestWeightKg: weights.get(r.id) ?? null,
        lastLoginAt: r.lastLoginAt ? r.lastLoginAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      }));
      return { users, total: Number(total.n) };
    },

    async stats(actor: Actor) {
      let users = db.selectFrom("users").innerJoin("profiles", "profiles.id", "users.id");
      if (actor.role === "coach") users = users.where("users.role", "=", "client").where("profiles.coachId", "=", actor.id);
      const [byStatus, foods, workoutDays] = await Promise.all([
        users.select(["users.status", sql<string>`count(*)`.as("n")]).groupBy("users.status").execute(),
        db.selectFrom("foods").select((eb) => eb.fn.countAll().as("n")).where("isArchived", "=", false).executeTakeFirstOrThrow(),
        db.selectFrom("workoutPlanDays").select((eb) => eb.fn.countAll().as("n")).where((eb) => eb.exists(
          eb.selectFrom("workoutPlanItems").select(sql`1`.as("x")).whereRef("workoutPlanItems.weekday", "=", "workoutPlanDays.weekday"),
        )).executeTakeFirstOrThrow(),
      ]);
      const count = (s: AccountStatus) => Number(byStatus.find((r) => r.status === s)?.n ?? 0);
      return {
        users: { total: count("active") + count("pending") + count("suspended"), active: count("active"), pending: count("pending"), suspended: count("suspended") },
        foods: Number(foods.n),
        workoutDays: Number(workoutDays.n),
      };
    },

    /**
     * Admin tạo tài khoản hộ (vd học viên không tự đăng ký được). Tài khoản có mật khẩu ngẫu nhiên không ai biết;
     * người được tạo vào bằng link đặt mật khẩu trả kèm trong kết quả.
     */
    async createUser(actorId: string, input: { email: string; fullName: string; phone: string; role: UserRole }, ip?: string) {
      const passwordHash = await hasher.hash(randomBytes(24).toString("base64url"));
      let id: string;
      try {
        id = (
          await db.transaction().execute((trx) =>
            authRepo.insertUserWithProfile(trx, { email: input.email, phone: input.phone, passwordHash, fullName: input.fullName, status: "active" }),
          )
        ).id;
      } catch (err) {
        const v = uniqueViolation(err);
        if (v?.constraint === "users_email_key") throw conflict("email_taken", { fields: ["email"] });
        if (v?.constraint === "users_phone_key") throw conflict("phone_taken", { fields: ["phone"] });
        throw err;
      }
      if (input.role !== "client") await db.updateTable("users").set({ role: input.role }).where("id", "=", id).execute();
      await audit(db, { actorId, targetUserId: id, action: "user_created", meta: { role: input.role }, ip });
      return { id, resetLink: await auth.createResetLink(actorId, id, ip) };
    },

    /** Duyệt / khoá / mở khoá tài khoản. Khoá thì đăng xuất mọi thiết bị ngay. Không tự đổi trạng thái của mình. */
    async setStatus(actorId: string, targetId: string, status: AccountStatus, ip?: string) {
      if (actorId === targetId) throw forbidden("cannot_change_self");
      const res = await db.updateTable("users").set({ status }).where("id", "=", targetId).executeTakeFirst();
      if (res.numUpdatedRows === 0n) throw notFound("user_not_found");
      if (status !== "active") await authRepo.revokeAllForUser(db, targetId, new Date());
      await audit(db, { actorId, targetUserId: targetId, action: "user_status_changed", meta: { status }, ip });
    },

    /** Không tự đổi vai trò của mình (tránh vô tình mất quyền quản trị cuối cùng). */
    async setRole(actorId: string, targetId: string, role: UserRole, ip?: string) {
      if (actorId === targetId) throw forbidden("cannot_change_self");
      const res = await db.updateTable("users").set({ role }).where("id", "=", targetId).executeTakeFirst();
      if (res.numUpdatedRows === 0n) throw notFound("user_not_found");
      await audit(db, { actorId, targetUserId: targetId, action: "user_role_changed", meta: { role }, ip });
    },

    /** Gán coach / gói / trạng thái học viên. */
    async updateClient(
      actorId: string,
      targetId: string,
      patch: { coachId?: string | null; package?: string | null; clientStatus?: ClientStatus },
      ip?: string,
    ) {
      if (patch.coachId) {
        const coach = await db.selectFrom("users").select("id").where("id", "=", patch.coachId).where("role", "in", ["coach", "admin"]).where("status", "=", "active").executeTakeFirst();
        if (!coach) throw badRequest("invalid_coach");
      }
      const set: { coachId?: string | null; package?: string | null; status?: ClientStatus } = {};
      if (patch.coachId !== undefined) set.coachId = patch.coachId;
      if (patch.package !== undefined) set.package = patch.package ? patch.package : null;
      if (patch.clientStatus !== undefined) set.status = patch.clientStatus;
      if (Object.keys(set).length) {
        const res = await db.updateTable("profiles").set(set).where("id", "=", targetId).executeTakeFirst();
        if (res.numUpdatedRows === 0n) throw notFound("user_not_found");
      }
      await audit(db, { actorId, targetUserId: targetId, action: "client_updated", meta: patch, ip });
    },

    /** Cấp link đặt lại mật khẩu: admin cho bất kỳ ai; coach chỉ cho học viên của mình. */
    async issueResetLink(actor: Actor, targetId: string, ip?: string) {
      if (actor.role !== "admin") {
        if (!isStaff(actor) || !(await findAccessibleClient(db, actor, targetId))) throw notFound("user_not_found");
      }
      return auth.createResetLink(actor.id, targetId, ip);
    },

    /**
     * Xoá vĩnh viễn một tài khoản và toàn bộ dữ liệu của họ (ảnh trên đĩa + mọi dòng liên quan nhờ ON DELETE CASCADE).
     * Chỉ admin được gọi (route kiểm tra), phải nhập lại MẬT KHẨU CỦA CHÍNH ADMIN, và không được tự xoá mình
     * (nên luôn còn ít nhất một admin). Xoá file trước, xoá dòng sau.
     */
    async deleteUser(actorId: string, targetId: string, password: string, ip?: string) {
      const actor = await db.selectFrom("users").select("passwordHash").where("id", "=", actorId).executeTakeFirst();
      if (!actor || !(await hasher.verify(actor.passwordHash, password))) throw badRequest("invalid_current_password");
      if (actorId === targetId) throw forbidden("cannot_change_self");
      const target = await db.selectFrom("users").select(["email", "role"]).where("id", "=", targetId).executeTakeFirst();
      if (!target) throw notFound("user_not_found");

      await storage.removeDir(`photos/${targetId}`);
      await db.deleteFrom("users").where("id", "=", targetId).execute();
      // target_user_id để trống (dòng người dùng đã bị xoá); id và email nằm trong meta để còn truy vết.
      await audit(db, { actorId, action: "user_deleted", meta: { userId: targetId, email: target.email, role: target.role }, ip });
    },

    /** Danh sách ứng viên làm coach (cho ô chọn coach). */
    async listCoaches() {
      const rows = await db
        .selectFrom("users")
        .innerJoin("profiles", "profiles.id", "users.id")
        .select(["users.id", "profiles.fullName"])
        .where("users.role", "in", ["coach", "admin"])
        .where("users.status", "=", "active")
        .orderBy("profiles.fullName")
        .execute();
      return rows;
    },

    async systemStatus() {
      const [dbSize, counts, storageBytes] = await Promise.all([
        sql<{ size: string }>`select pg_database_size(current_database())::text as size`.execute(db),
        db.selectFrom("users").select((eb) => eb.fn.countAll().as("n")).executeTakeFirstOrThrow(),
        storage.usedBytes(),
      ]);

      let diskFreeBytes: number | null = null;
      for (const dir of [resolve(config.STORAGE_DIR), process.cwd()]) {
        try {
          const s = await statfs(dir);
          diskFreeBytes = Number(s.bavail) * Number(s.bsize);
          break;
        } catch {
          // thư mục lưu ảnh có thể chưa tồn tại (chưa có ảnh nào): thử thư mục làm việc
        }
      }

      // Tuổi bản backup mới nhất: đọc mtime các tệp trong BACKUP_DIR (nếu cấu hình).
      let backup: { latestFile: string | null; ageHours: number | null } | null = null;
      if (config.BACKUP_DIR) {
        backup = { latestFile: null, ageHours: null };
        try {
          let newest = 0;
          for (const name of await readdir(config.BACKUP_DIR)) {
            if (!/\.(age|sql|gz|dump)$/.test(name)) continue;
            const m = (await stat(join(config.BACKUP_DIR, name))).mtimeMs;
            if (m > newest) {
              newest = m;
              backup.latestFile = name;
            }
          }
          if (newest) backup.ageHours = Math.round(((Date.now() - newest) / 3_600_000) * 10) / 10;
        } catch {
          // thư mục backup không đọc được: để null — giao diện sẽ cảnh báo
        }
      }

      return {
        databaseBytes: Number(dbSize.rows[0]!.size),
        storageBytes,
        diskFreeBytes,
        userCount: Number(counts.n),
        backup,
      };
    },
  };
}

export type AdminService = ReturnType<typeof createAdminService>;
