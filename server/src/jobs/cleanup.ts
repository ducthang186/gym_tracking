import type { Db } from "../db/index.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Xoá token đã hết hạn hoặc đã bị thu hồi hơn 1 ngày.
 * Mỗi lần refresh sinh thêm một dòng refresh_tokens, nên nếu không dọn bảng sẽ phình ra liên tục.
 * Giữ lại 1 ngày để vẫn tra cứu được khi điều tra sự cố. Token đã xoay vòng nhưng chưa hết hạn được giữ
 * tới khi hết hạn — chính các dòng này giúp phát hiện token bị đánh cắp rồi dùng lại.
 */
export async function purgeExpiredTokens(db: Db, now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - DAY_MS);

  const refresh = await db
    .deleteFrom("refreshTokens")
    .where((eb) => eb.or([eb("expiresAt", "<", cutoff), eb("revokedAt", "<", cutoff)]))
    .executeTakeFirst();

  const reset = await db.deleteFrom("authTokens").where("expiresAt", "<", cutoff).executeTakeFirst();

  return {
    refreshTokens: Number(refresh.numDeletedRows),
    authTokens: Number(reset.numDeletedRows),
  };
}
