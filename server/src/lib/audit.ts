import type { Db } from "../db/index.js";

export interface AuditEntry {
  actorId?: string | null;
  targetUserId?: string | null;
  action: string;
  meta?: Record<string, unknown>;
  ip?: string;
}

/** Ghi nhật ký truy cập. Nhận cả Kysely lẫn Transaction (Transaction kế thừa Kysely). */
export async function audit(db: Db, entry: AuditEntry): Promise<void> {
  await db
    .insertInto("auditLog")
    .values({
      actorId: entry.actorId ?? null,
      targetUserId: entry.targetUserId ?? null,
      action: entry.action,
      meta: entry.meta ? JSON.stringify(entry.meta) : null,
      ip: entry.ip ?? null,
    })
    .execute();
}
