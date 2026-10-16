import type { Db } from "../../db/index.js";
import type { AccountStatus } from "../../db/types.js";

// Chỉ tầng repo được đụng vào database. Mọi hàm nhận `db` có thể là Kysely hoặc Transaction.

const userColumns = [
  "users.id",
  "users.email",
  "users.phone",
  "users.passwordHash",
  "users.role",
  "users.status",
  "users.failedLogins",
  "users.lockedUntil",
  "users.createdAt",
  "profiles.fullName",
] as const;

const userQuery = (db: Db) =>
  db.selectFrom("users").innerJoin("profiles", "profiles.id", "users.id").select(userColumns);

export const findUserByEmail = (db: Db, email: string) =>
  userQuery(db).where("users.email", "=", email).executeTakeFirst();

export const findUserByPhone = (db: Db, phone: string) =>
  userQuery(db).where("users.phone", "=", phone).executeTakeFirst();

export const findUserById = (db: Db, id: string) =>
  userQuery(db).where("users.id", "=", id).executeTakeFirst();

export type UserRecord = NonNullable<Awaited<ReturnType<typeof findUserById>>>;

/** Trả về các email/SĐT đã có người dùng (để báo đủ cả hai trường bị trùng). */
export const findConflicts = (db: Db, email: string, phone: string) =>
  db
    .selectFrom("users")
    .select(["email", "phone"])
    .where((eb) => eb.or([eb("email", "=", email), eb("phone", "=", phone)]))
    .execute();

export async function insertUserWithProfile(
  db: Db,
  input: { email: string; phone: string; passwordHash: string; fullName: string; status: AccountStatus },
): Promise<{ id: string }> {
  const user = await db
    .insertInto("users")
    .values({
      email: input.email,
      phone: input.phone,
      passwordHash: input.passwordHash,
      status: input.status,
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  await db.insertInto("profiles").values({ id: user.id, fullName: input.fullName }).execute();
  return user;
}

/** Tăng bộ đếm đăng nhập sai (nguyên tử). Vượt ngưỡng thì khoá và đặt lại bộ đếm. */
export async function recordFailedLogin(
  db: Db,
  userId: string,
  opts: { maxFailures: number; lockoutMs: number },
): Promise<{ locked: boolean }> {
  const row = await db
    .updateTable("users")
    .set((eb) => ({ failedLogins: eb("failedLogins", "+", 1) }))
    .where("id", "=", userId)
    .returning("failedLogins")
    .executeTakeFirstOrThrow();

  if (row.failedLogins < opts.maxFailures) return { locked: false };

  await db
    .updateTable("users")
    .set({ failedLogins: 0, lockedUntil: new Date(Date.now() + opts.lockoutMs) })
    .where("id", "=", userId)
    .execute();
  return { locked: true };
}

export const recordSuccessfulLogin = (db: Db, userId: string) =>
  db
    .updateTable("users")
    .set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where("id", "=", userId)
    .execute();

// ---- refresh token ----

export const insertRefreshToken = (
  db: Db,
  row: { userId: string; familyId: string; tokenHash: string; expiresAt: Date; userAgent: string | null; ip: string | null },
) => db.insertInto("refreshTokens").values(row).execute();

/** Khoá dòng (FOR UPDATE) để hai request refresh đồng thời không cùng xoay vòng một token. */
export const findRefreshTokenForUpdate = (db: Db, tokenHash: string) =>
  db.selectFrom("refreshTokens").selectAll().where("tokenHash", "=", tokenHash).forUpdate().executeTakeFirst();

export const findRefreshTokenByHash = (db: Db, tokenHash: string) =>
  db.selectFrom("refreshTokens").selectAll().where("tokenHash", "=", tokenHash).executeTakeFirst();

export const markRefreshTokenUsed = (db: Db, id: string, at: Date) =>
  db.updateTable("refreshTokens").set({ usedAt: at }).where("id", "=", id).execute();

export const revokeFamily = (db: Db, familyId: string, at: Date) =>
  db
    .updateTable("refreshTokens")
    .set({ revokedAt: at })
    .where("familyId", "=", familyId)
    .where("revokedAt", "is", null)
    .execute();

// ---- đổi / đặt lại mật khẩu ----

export const setPasswordHash = (db: Db, userId: string, passwordHash: string) =>
  db.updateTable("users").set({ passwordHash, failedLogins: 0, lockedUntil: null }).where("id", "=", userId).execute();

/** Đăng xuất mọi thiết bị: thu hồi mọi refresh token chưa bị thu hồi của người dùng. */
export const revokeAllForUser = (db: Db, userId: string, at: Date) =>
  db.updateTable("refreshTokens").set({ revokedAt: at }).where("userId", "=", userId).where("revokedAt", "is", null).execute();

export const insertResetToken = (db: Db, row: { userId: string; tokenHash: string; expiresAt: Date; createdBy: string }) =>
  db.insertInto("authTokens").values({ ...row, type: "reset_password" }).execute();

/** Mỗi người chỉ có tối đa một link đặt lại còn hiệu lực: cấp link mới thì link cũ chưa dùng bị vô hiệu. */
export const expireOpenResetTokens = (db: Db, userId: string, at: Date) =>
  db
    .updateTable("authTokens")
    .set({ expiresAt: at })
    .where("userId", "=", userId)
    .where("type", "=", "reset_password")
    .where("usedAt", "is", null)
    .where("expiresAt", ">", at)
    .execute();

export const findResetTokenForUpdate = (db: Db, tokenHash: string) =>
  db
    .selectFrom("authTokens")
    .selectAll()
    .where("tokenHash", "=", tokenHash)
    .where("type", "=", "reset_password")
    .forUpdate()
    .executeTakeFirst();

export const markResetTokenUsed = (db: Db, id: string, at: Date) =>
  db.updateTable("authTokens").set({ usedAt: at }).where("id", "=", id).execute();
