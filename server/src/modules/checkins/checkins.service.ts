import type { Selectable } from "kysely";
import type { Db } from "../../db/index.js";
import type { WeeklyCheckinsTable } from "../../db/types.js";
import { addDays, assertNotFuture, toDateStr } from "../../lib/dates.js";
import { badRequest, notFound } from "../../lib/errors.js";

export interface Checkin {
  weekStart: string;
  /** Tuần này có tập hay không. */
  trained: boolean;
  note: string | null;
  coachNote: string | null;
}

const toCheckin = (r: Selectable<WeeklyCheckinsTable>): Checkin => ({
  weekStart: r.weekStart,
  trained: r.trained,
  note: r.note,
  coachNote: r.coachNote,
});

/** Thứ Hai của tuần chứa `date` (chuỗi YYYY-MM-DD). */
export function mondayOf(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Chủ nhật
  return addDays(date, -((dow + 6) % 7));
}

const assertMonday = (weekStart: string) => {
  if (mondayOf(weekStart) !== weekStart) throw badRequest("validation_error", { fields: [{ field: "weekStart", code: "not_monday" }] });
};

export function createCheckinsService(db: Db) {
  return {
    async list(userId: string, from?: string, to?: string): Promise<Checkin[]> {
      const end = to ?? addDays(toDateStr(new Date()), 1);
      const start = from ?? addDays(end, -26 * 7);
      const rows = await db
        .selectFrom("weeklyCheckins")
        .selectAll()
        .where("userId", "=", userId)
        .where("weekStart", ">=", start)
        .where("weekStart", "<=", end)
        .orderBy("weekStart", "desc")
        .limit(100)
        .execute();
      return rows.map(toCheckin);
    },

    async upsert(
      userId: string,
      weekStart: string,
      v: { trained: boolean; note?: string | null },
    ): Promise<Checkin> {
      assertMonday(weekStart);
      assertNotFuture(weekStart);
      const values = { ...v, note: v.note ? v.note : null };
      const row = await db
        .insertInto("weeklyCheckins")
        .values({ userId, weekStart, ...values })
        .onConflict((oc) => oc.columns(["userId", "weekStart"]).doUpdateSet({ ...values, updatedAt: new Date() }))
        .returningAll()
        .executeTakeFirstOrThrow();
      return toCheckin(row);
    },

    /** Coach phản hồi check-in của học viên (người gọi đã được policy cho phép). */
    async setCoachNote(coachId: string, userId: string, weekStart: string, note: string): Promise<Checkin> {
      assertMonday(weekStart);
      const row = await db
        .updateTable("weeklyCheckins")
        .set({ coachNote: note ? note : null, coachNoteBy: coachId, updatedAt: new Date() })
        .where("userId", "=", userId)
        .where("weekStart", "=", weekStart)
        .returningAll()
        .executeTakeFirst();
      if (!row) throw notFound("checkin_not_found");
      return toCheckin(row);
    },
  };
}

export type CheckinsService = ReturnType<typeof createCheckinsService>;
