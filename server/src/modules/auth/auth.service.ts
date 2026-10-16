import { randomUUID } from "node:crypto";
import type { Config } from "../../config/env.js";
import { uniqueViolation, type Db } from "../../db/index.js";
import type { AccountStatus, UserRole } from "../../db/types.js";
import { audit } from "../../lib/audit.js";
import { AppError, badRequest, conflict, forbidden, notFound, tooMany, unauthorized } from "../../lib/errors.js";
import * as repo from "./auth.repo.js";
import { normalizePhone } from "./phone.js";
import type { PasswordHasher } from "./password.js";
import type { RegisterInput } from "./schemas.js";
import { hashToken, newRefreshToken, type TokenService } from "./tokens.js";

/** Refresh token vừa bị dùng cách đây < ngưỡng này (vd hai tab refresh đồng thời) KHÔNG bị coi là bị đánh cắp. */
const REUSE_GRACE_MS = 10_000;

/** Link đặt lại mật khẩu do admin/coach cấp có hiệu lực 24 giờ, dùng được một lần. */
const RESET_TOKEN_TTL_MS = 24 * 3_600_000;

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Chỉ những trường an toàn để trả ra ngoài — KHÔNG bao giờ spread cả dòng DB (có passwordHash). */
export interface PublicUser {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  role: UserRole;
  status: AccountStatus;
  createdAt: string;
}

export type AuthUser = Pick<PublicUser, "id" | "email" | "phone" | "fullName" | "role" | "status">;

const toPublicUser = (u: repo.UserRecord): PublicUser => ({
  id: u.id,
  email: u.email,
  phone: u.phone,
  fullName: u.fullName,
  role: u.role,
  status: u.status,
  createdAt: u.createdAt.toISOString(),
});

type RefreshOutcome =
  | { kind: "ok"; session: Session; userId: string }
  | { kind: "fail"; code: string };

export function createAuthService(deps: {
  db: Db;
  config: Config;
  hasher: PasswordHasher;
  tokens: TokenService;
}) {
  const { db, config, hasher, tokens } = deps;
  const refreshTtlMs = config.REFRESH_TOKEN_TTL_DAYS * 86_400_000;
  const lockoutMs = config.LOCKOUT_MINUTES * 60_000;

  async function issueSession(
    exec: Db,
    userId: string,
    meta: RequestMeta,
    familyId: string = randomUUID(),
  ): Promise<Session> {
    const refreshToken = newRefreshToken();
    await repo.insertRefreshToken(exec, {
      userId,
      familyId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + refreshTtlMs),
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
      ip: meta.ip ?? null,
    });
    return {
      accessToken: await tokens.signAccess(userId),
      refreshToken,
      expiresIn: config.ACCESS_TOKEN_TTL_SECONDS,
    };
  }

  function findByIdentifier(identifier: string) {
    if (identifier.includes("@")) return repo.findUserByEmail(db, identifier.toLowerCase());
    const phone = normalizePhone(identifier);
    return phone ? repo.findUserByPhone(db, phone) : Promise.resolve(undefined);
  }

  function taken(fields: string[]): AppError {
    return conflict(`${fields[0]}_taken`, { fields });
  }

  return {
    async register(input: RegisterInput, meta: RequestMeta) {
      // Kiểm tra trùng trước khi hash (rẻ) và để báo đủ cả email lẫn SĐT bị trùng.
      const existing = await repo.findConflicts(db, input.email, input.phone);
      const fields: string[] = [];
      if (existing.some((r) => r.email.toLowerCase() === input.email)) fields.push("email");
      if (existing.some((r) => r.phone === input.phone)) fields.push("phone");
      if (fields.length) throw taken(fields);

      const passwordHash = await hasher.hash(input.password);
      const status: AccountStatus = config.REQUIRE_APPROVAL ? "pending" : "active";

      let userId: string;
      try {
        userId = (
          await db.transaction().execute((trx) =>
            repo.insertUserWithProfile(trx, {
              email: input.email,
              phone: input.phone,
              passwordHash,
              fullName: input.fullName,
              status,
            }),
          )
        ).id;
      } catch (err) {
        // Hai request đăng ký cùng lúc: ràng buộc unique của DB là chốt chặn cuối cùng.
        const violation = uniqueViolation(err);
        if (violation?.constraint === "users_email_key") throw taken(["email"]);
        if (violation?.constraint === "users_phone_key") throw taken(["phone"]);
        throw err;
      }

      const record = (await repo.findUserById(db, userId))!;
      const session = status === "active" ? await issueSession(db, userId, meta) : null;
      return { user: toPublicUser(record), session };
    },

    async login(identifier: string, password: string, meta: RequestMeta) {
      const user = await findByIdentifier(identifier);

      if (!user) {
        await hasher.verifyDummy(password); // cân bằng thời gian phản hồi
        throw unauthorized("invalid_credentials");
      }

      if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        const retryAfterSeconds = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
        throw tooMany("too_many_attempts", { retryAfterSeconds });
      }

      if (!(await hasher.verify(user.passwordHash, password))) {
        const { locked } = await repo.recordFailedLogin(db, user.id, {
          maxFailures: config.MAX_FAILED_LOGINS,
          lockoutMs,
        });
        await audit(db, {
          actorId: user.id,
          targetUserId: user.id,
          action: locked ? "account_locked" : "login_failed",
          ip: meta.ip,
        });
        throw unauthorized("invalid_credentials");
      }

      // Chỉ báo trạng thái riêng SAU KHI mật khẩu đã đúng, để không lộ thông tin cho người dò.
      if (user.status === "pending") throw forbidden("account_pending");
      if (user.status === "suspended") throw forbidden("account_suspended");

      await repo.recordSuccessfulLogin(db, user.id);
      const session = await issueSession(db, user.id, meta);
      return { user: toPublicUser(user), session };
    },

    /**
     * Đổi refresh token cũ lấy token mới (xoay vòng).
     * Token đã dùng mà bị dùng lại = có hai bên giữ bản sao → thu hồi cả họ token.
     * Kết quả được trả ra khỏi transaction rồi mới ném lỗi, để việc thu hồi được COMMIT.
     */
    async refresh(rawToken: string, meta: RequestMeta): Promise<{ session: Session; userId: string }> {
      const outcome = await db.transaction().execute(async (trx): Promise<RefreshOutcome> => {
        const row = await repo.findRefreshTokenForUpdate(trx, hashToken(rawToken));
        const now = new Date();
        if (!row || row.revokedAt || row.expiresAt <= now) return { kind: "fail", code: "invalid_refresh_token" };

        if (row.usedAt) {
          if (now.getTime() - row.usedAt.getTime() < REUSE_GRACE_MS) {
            return { kind: "fail", code: "refresh_conflict" }; // client thử lại với cookie mới nhất
          }
          await repo.revokeFamily(trx, row.familyId, now);
          await audit(trx, { actorId: row.userId, targetUserId: row.userId, action: "refresh_token_reuse", ip: meta.ip });
          return { kind: "fail", code: "token_reuse" };
        }

        const user = await repo.findUserById(trx, row.userId);
        if (!user || user.status !== "active") {
          await repo.revokeFamily(trx, row.familyId, now);
          return { kind: "fail", code: "invalid_refresh_token" };
        }

        await repo.markRefreshTokenUsed(trx, row.id, now);
        const session = await issueSession(trx, row.userId, meta, row.familyId);
        return { kind: "ok", session, userId: row.userId };
      });

      if (outcome.kind === "fail") throw unauthorized(outcome.code);
      return { session: outcome.session, userId: outcome.userId };
    },

    /**
     * Đổi mật khẩu khi đang đăng nhập. Sai mật khẩu hiện tại cũng tính vào bộ đếm khoá tài khoản
     * (kẻ có access token bị đánh cắp không được phép dò mật khẩu qua endpoint này).
     * Thành công: mọi thiết bị khác bị đăng xuất, thiết bị hiện tại nhận phiên mới.
     */
    async changePassword(userId: string, currentPassword: string, newPassword: string, meta: RequestMeta): Promise<Session> {
      const user = await repo.findUserById(db, userId);
      if (!user) throw unauthorized("account_inactive");
      if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        throw tooMany("too_many_attempts", { retryAfterSeconds: Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000) });
      }
      if (!(await hasher.verify(user.passwordHash, currentPassword))) {
        const { locked } = await repo.recordFailedLogin(db, userId, { maxFailures: config.MAX_FAILED_LOGINS, lockoutMs });
        await audit(db, { actorId: userId, targetUserId: userId, action: locked ? "account_locked" : "change_password_failed", ip: meta.ip });
        throw badRequest("invalid_current_password"); // 400 (không phải 401: 401 làm client tưởng hết phiên)
      }
      if (currentPassword === newPassword) throw badRequest("same_password");

      const passwordHash = await hasher.hash(newPassword);
      const session = await db.transaction().execute(async (trx) => {
        await repo.setPasswordHash(trx, userId, passwordHash);
        await repo.revokeAllForUser(trx, userId, new Date());
        await audit(trx, { actorId: userId, targetUserId: userId, action: "password_changed", ip: meta.ip });
        return issueSession(trx, userId, meta);
      });
      return session;
    },

    /** Cấp link đặt lại mật khẩu (người gọi đã được kiểm tra quyền). Token chỉ trả ra một lần, DB chỉ lưu băm. */
    async createResetLink(actorId: string, targetUserId: string, ip?: string) {
      const target = await repo.findUserById(db, targetUserId);
      if (!target) throw notFound("user_not_found");
      const token = newRefreshToken(); // 32 byte ngẫu nhiên, cùng cách sinh với refresh token
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await db.transaction().execute(async (trx) => {
        await repo.expireOpenResetTokens(trx, targetUserId, new Date());
        await repo.insertResetToken(trx, { userId: targetUserId, tokenHash: hashToken(token), expiresAt, createdBy: actorId });
        await audit(trx, { actorId, targetUserId, action: "reset_link_issued", ip });
      });
      return { token, expiresAt: expiresAt.toISOString() };
    },

    /** Dùng link đặt lại: đặt mật khẩu mới, đăng xuất mọi thiết bị, mở khoá tài khoản. Không tự đăng nhập. */
    async resetPassword(token: string, newPassword: string, meta: RequestMeta): Promise<void> {
      const passwordHash = await hasher.hash(newPassword); // hash trước, ngoài transaction (chậm)
      const ok = await db.transaction().execute(async (trx) => {
        const row = await repo.findResetTokenForUpdate(trx, hashToken(token));
        const now = new Date();
        if (!row || row.usedAt || row.expiresAt <= now) return false;
        await repo.markResetTokenUsed(trx, row.id, now);
        await repo.setPasswordHash(trx, row.userId, passwordHash);
        await repo.revokeAllForUser(trx, row.userId, now);
        await audit(trx, { actorId: row.userId, targetUserId: row.userId, action: "password_reset", ip: meta.ip });
        return true;
      });
      if (!ok) throw badRequest("invalid_or_expired_token"); // một mã lỗi chung cho sai/hết hạn/đã dùng
    },

    /** Thu hồi cả họ token của phiên này. Không báo lỗi nếu token không tồn tại. */
    async logout(rawToken: string | undefined): Promise<void> {
      if (!rawToken) return;
      const row = await repo.findRefreshTokenByHash(db, hashToken(rawToken));
      if (row) await repo.revokeFamily(db, row.familyId, new Date());
    },

    async getMe(userId: string): Promise<PublicUser | null> {
      const record = await repo.findUserById(db, userId);
      return record ? toPublicUser(record) : null;
    },

    /** Xác thực access token và tra lại người dùng từ DB: khoá tài khoản có hiệu lực ngay lập tức. */
    async authenticate(accessToken: string): Promise<AuthUser> {
      let userId: string;
      try {
        userId = await tokens.verifyAccess(accessToken);
      } catch {
        throw unauthorized("invalid_token");
      }
      const user = await repo.findUserById(db, userId);
      if (!user || user.status !== "active") throw unauthorized("account_inactive");
      return { id: user.id, email: user.email, phone: user.phone, fullName: user.fullName, role: user.role, status: user.status };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
