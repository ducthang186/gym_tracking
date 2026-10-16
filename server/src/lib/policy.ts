import type { Db } from "../db/index.js";
import type { UserRole } from "../db/types.js";

// Phân quyền theo "ai được xem dữ liệu của ai". Mọi route đọc dữ liệu của NGƯỜI KHÁC đều phải đi qua đây;
// dữ liệu của chính mình luôn lọc theo userId lấy từ token, không cần qua policy.

export interface Actor {
  id: string;
  role: UserRole;
}

export const isStaff = (a: Actor) => a.role === "admin" || a.role === "coach";

/**
 * Trả về học viên nếu `actor` được phép xem/ghi dữ liệu của họ, ngược lại `undefined`:
 *  - admin: mọi học viên
 *  - coach: chỉ học viên được gán cho mình (profiles.coach_id)
 *  - client: không bao giờ
 * Route trả 404 (không phải 403) khi `undefined`, để không lộ việc học viên đó có tồn tại hay không.
 */
export async function findAccessibleClient(db: Db, actor: Actor, clientId: string) {
  if (!isStaff(actor)) return undefined;
  let query = db
    .selectFrom("users")
    .innerJoin("profiles", "profiles.id", "users.id")
    .select(["users.id", "users.role", "users.status", "profiles.coachId", "profiles.fullName"])
    .where("users.id", "=", clientId)
    .where("users.role", "=", "client");
  if (actor.role === "coach") query = query.where("profiles.coachId", "=", actor.id);
  return query.executeTakeFirst();
}
