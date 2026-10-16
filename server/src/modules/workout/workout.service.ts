import type { Db } from "../../db/index.js";
import { assertNotFuture } from "../../lib/dates.js";
import { audit } from "../../lib/audit.js";
import { badRequest, notFound } from "../../lib/errors.js";

export interface PlanItem {
  name: string;
  sets: number | null;
  reps: string | null;
}
export interface PlanDay {
  weekday: number;
  name: string;
  items: PlanItem[];
}
export interface WorkoutSet {
  id: string;
  performedOn: string;
  exerciseName: string;
  reps: number;
  weightKg: number;
}

const MAX_SETS_PER_DAY = 300;

export function createWorkoutService(db: Db) {
  async function getPlan(): Promise<PlanDay[]> {
    const [days, items] = await Promise.all([
      db.selectFrom("workoutPlanDays").selectAll().orderBy("weekday").execute(),
      db.selectFrom("workoutPlanItems").selectAll().orderBy("weekday").orderBy("position").execute(),
    ]);
    return days.map((d) => ({
      weekday: d.weekday,
      name: d.name,
      items: items.filter((i) => i.weekday === d.weekday).map((i) => ({ name: i.name, sets: i.sets, reps: i.reps })),
    }));
  }

  const toSet = (r: { id: string; performedOn: string; exerciseName: string; reps: number; weightKg: string }): WorkoutSet => ({
    id: r.id,
    performedOn: r.performedOn,
    exerciseName: r.exerciseName,
    reps: r.reps,
    weightKg: Number(r.weightKg),
  });

  return {
    getPlan,

    /** Thay toàn bộ buổi tập của một ngày trong một transaction (không bao giờ để ngày ở trạng thái nửa vời). */
    async setPlanDay(actorId: string, weekday: number, input: { name: string; items: Array<{ name: string; sets?: number | null; reps?: string | null }> }, ip?: string) {
      await db.transaction().execute(async (trx) => {
        const res = await trx
          .updateTable("workoutPlanDays")
          .set({ name: input.name, updatedBy: actorId, updatedAt: new Date() })
          .where("weekday", "=", weekday)
          .executeTakeFirst();
        if (res.numUpdatedRows === 0n) throw notFound("day_not_found");
        await trx.deleteFrom("workoutPlanItems").where("weekday", "=", weekday).execute();
        if (input.items.length) {
          await trx
            .insertInto("workoutPlanItems")
            .values(
              input.items.map((it, i) => ({
                weekday,
                position: i + 1,
                name: it.name,
                sets: it.sets ?? null,
                reps: it.reps ? it.reps : null,
              })),
            )
            .execute();
        }
        await audit(trx, { actorId, action: "workout_plan_updated", meta: { weekday }, ip });
      });
      return (await getPlan()).find((d) => d.weekday === weekday)!;
    },

    // ---- nhật ký tập (luôn lọc theo userId lấy từ token) ----
    async listSets(userId: string, date: string): Promise<WorkoutSet[]> {
      const rows = await db
        .selectFrom("workoutSets")
        .selectAll()
        .where("userId", "=", userId)
        .where("performedOn", "=", date)
        .orderBy("id")
        .execute();
      return rows.map(toSet);
    },

    async addSet(
      userId: string,
      input: { performedOn: string; exerciseName: string; reps: number; weightKg: number; clientRequestId?: string },
    ): Promise<{ set: WorkoutSet; created: boolean }> {
      assertNotFuture(input.performedOn);
      const count = await db
        .selectFrom("workoutSets")
        .select((eb) => eb.fn.countAll().as("n"))
        .where("userId", "=", userId)
        .where("performedOn", "=", input.performedOn)
        .executeTakeFirstOrThrow();
      if (Number(count.n) >= MAX_SETS_PER_DAY) throw badRequest("too_many_sets");

      const inserted = await db
        .insertInto("workoutSets")
        .values({
          userId,
          performedOn: input.performedOn,
          exerciseName: input.exerciseName,
          reps: input.reps,
          weightKg: String(input.weightKg),
          clientRequestId: input.clientRequestId ?? null,
        })
        .onConflict((oc) => oc.columns(["userId", "clientRequestId"]).doNothing())
        .returningAll()
        .executeTakeFirst();
      if (inserted) return { set: toSet(inserted), created: true };

      const existing = await db
        .selectFrom("workoutSets")
        .selectAll()
        .where("userId", "=", userId)
        .where("clientRequestId", "=", input.clientRequestId!)
        .executeTakeFirstOrThrow();
      return { set: toSet(existing), created: false };
    },

    async deleteSet(userId: string, id: string): Promise<void> {
      const res = await db.deleteFrom("workoutSets").where("id", "=", id).where("userId", "=", userId).executeTakeFirst();
      if (res.numDeletedRows === 0n) throw notFound("set_not_found");
    },

    /** Các hiệp gần nhất của một bài (để gợi ý mức tạ lần trước). */
    async history(userId: string, exerciseName: string): Promise<WorkoutSet[]> {
      const rows = await db
        .selectFrom("workoutSets")
        .selectAll()
        .where("userId", "=", userId)
        .where("exerciseName", "=", exerciseName)
        .orderBy("performedOn", "desc")
        .orderBy("id", "desc")
        .limit(30)
        .execute();
      return rows.map(toSet);
    },
  };
}

export type WorkoutService = ReturnType<typeof createWorkoutService>;
