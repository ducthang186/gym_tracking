import type { Db } from "../../db/index.js";
import { uniqueViolation } from "../../db/index.js";
import type { FoodLogEntriesTable, FoodsTable, MealSlot } from "../../db/types.js";
import { buildDayPlan } from "./mealplan.js";
import { audit } from "../../lib/audit.js";
import { assertNotFuture, daysBetween } from "../../lib/dates.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { sql, type Selectable } from "kysely";

export interface Food {
  id: string;
  name: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
}

export interface FoodLogEntry {
  id: string;
  loggedOn: string;
  slot: MealSlot;
  foodId: string | null;
  foodName: string;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface Totals {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

const toFood = (r: Selectable<FoodsTable>): Food => ({
  id: r.id,
  name: r.name,
  kcalPer100g: Number(r.kcalPer100g),
  proteinPer100g: Number(r.proteinPer100g),
  carbsPer100g: Number(r.carbsPer100g),
  fatPer100g: Number(r.fatPer100g),
});

const toEntry = (r: Selectable<FoodLogEntriesTable>): FoodLogEntry => ({
  id: r.id,
  loggedOn: r.loggedOn,
  slot: r.slot,
  foodId: r.foodId,
  foodName: r.foodName,
  grams: Number(r.grams),
  kcal: Number(r.kcal),
  proteinG: Number(r.proteinG),
  carbsG: Number(r.carbsG),
  fatG: Number(r.fatG),
});

export const sumTotals = (entries: FoodLogEntry[]): Totals => ({
  kcal: round1(entries.reduce((a, e) => a + e.kcal, 0)),
  proteinG: round1(entries.reduce((a, e) => a + e.proteinG, 0)),
  carbsG: round1(entries.reduce((a, e) => a + e.carbsG, 0)),
  fatG: round1(entries.reduce((a, e) => a + e.fatG, 0)),
});

export type CreateEntryInput = {
  loggedOn: string;
  slot: MealSlot;
  grams: number;
  foodId?: string;
  custom?: { name: string; kcalPer100g: number };
  clientRequestId?: string;
};

export function createNutritionService(db: Db) {
  return {
    // ---- món ăn ----
    async listFoods(q?: string): Promise<Food[]> {
      let query = db.selectFrom("foods").selectAll().where("isArchived", "=", false).orderBy("name");
      if (q) {
        // escape ký tự đặc biệt của LIKE để "%" hay "_" người dùng gõ vào không thành ký tự đại diện
        const safe = q.replace(/[\\%_]/g, (c) => `\\${c}`);
        query = query.where("name", "ilike", `%${safe}%`);
      }
      return (await query.execute()).map(toFood);
    },

    async createFood(
      actorId: string,
      input: { name: string; kcalPer100g: number; proteinPer100g: number; carbsPer100g: number; fatPer100g: number },
      ip?: string,
    ): Promise<Food> {
      try {
        const row = await db
          .insertInto("foods")
          .values({
            name: input.name,
            kcalPer100g: String(input.kcalPer100g),
            proteinPer100g: String(input.proteinPer100g),
            carbsPer100g: String(input.carbsPer100g),
            fatPer100g: String(input.fatPer100g),
            createdBy: actorId,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        await audit(db, { actorId, action: "food_created", meta: { foodId: row.id }, ip });
        return toFood(row);
      } catch (err) {
        if (uniqueViolation(err)) throw conflict("food_exists");
        throw err;
      }
    },

    /** Xoá mềm: món biến khỏi danh sách chọn, nhật ký cũ không đổi. */
    async archiveFood(actorId: string, id: string, ip?: string): Promise<void> {
      const res = await db
        .updateTable("foods")
        .set({ isArchived: true })
        .where("id", "=", id)
        .where("isArchived", "=", false)
        .executeTakeFirst();
      if (res.numUpdatedRows === 0n) throw notFound("food_not_found");
      await audit(db, { actorId, action: "food_archived", meta: { foodId: id }, ip });
    },

    // ---- nhật ký ăn (luôn lọc theo userId lấy từ token) ----
    async listEntries(userId: string, date: string) {
      const rows = await db
        .selectFrom("foodLogEntries")
        .selectAll()
        .where("userId", "=", userId)
        .where("loggedOn", "=", date)
        .orderBy("id")
        .execute();
      const entries = rows.map(toEntry);
      return { date, entries, totals: sumTotals(entries) };
    },

    /** Kế hoạch ăn gợi ý một ngày, sinh từ danh mục món hiện có. */
    async suggestDayPlan(kcal: number, day: number, variant: number) {
      return buildDayPlan(await this.listFoods(), kcal, day, variant);
    },

    /** Server tự tra bảng foods và tự tính calo: client không thể ghi số liệu sai. Trả `created=false` nếu là lần gửi lại. */
    async createEntry(userId: string, input: CreateEntryInput): Promise<{ entry: FoodLogEntry; created: boolean }> {
      assertNotFuture(input.loggedOn);
      let name: string;
      let per100: { kcal: number; p: number; c: number; f: number };
      let foodId: string | null = null;

      if (input.foodId) {
        const food = await db
          .selectFrom("foods")
          .selectAll()
          .where("id", "=", input.foodId)
          .where("isArchived", "=", false)
          .executeTakeFirst();
        if (!food) throw notFound("food_not_found");
        name = food.name;
        foodId = food.id;
        per100 = {
          kcal: Number(food.kcalPer100g),
          p: Number(food.proteinPer100g),
          c: Number(food.carbsPer100g),
          f: Number(food.fatPer100g),
        };
      } else {
        name = input.custom!.name;
        per100 = { kcal: input.custom!.kcalPer100g, p: 0, c: 0, f: 0 };
      }

      const r = input.grams / 100;
      const values = {
        userId,
        loggedOn: input.loggedOn,
        slot: input.slot,
        foodId,
        foodName: name,
        grams: String(input.grams),
        kcal: String(round1(per100.kcal * r)),
        proteinG: String(round1(per100.p * r)),
        carbsG: String(round1(per100.c * r)),
        fatG: String(round1(per100.f * r)),
        clientRequestId: input.clientRequestId ?? null,
      };

      const inserted = await db
        .insertInto("foodLogEntries")
        .values(values)
        .onConflict((oc) => oc.columns(["userId", "clientRequestId"]).doNothing())
        .returningAll()
        .executeTakeFirst();
      if (inserted) return { entry: toEntry(inserted), created: true };

      // Trùng clientRequestId: trả lại bản ghi đã có thay vì ghi đôi.
      const existing = await db
        .selectFrom("foodLogEntries")
        .selectAll()
        .where("userId", "=", userId)
        .where("clientRequestId", "=", input.clientRequestId!)
        .executeTakeFirstOrThrow();
      return { entry: toEntry(existing), created: false };
    },

    /** Tổng calo/macro và số hiệp tập theo từng ngày có dữ liệu trong khoảng [from, to] (tối đa 92 ngày). */
    async summary(userId: string, from: string, to: string) {
      const span = daysBetween(from, to);
      if (span < 0 || span > 92) throw badRequest("invalid_range");

      const [food, workout] = await Promise.all([
        db
          .selectFrom("foodLogEntries")
          .select([
            "loggedOn as date",
            sql<string>`sum(kcal)`.as("kcal"),
            sql<string>`sum(protein_g)`.as("proteinG"),
            sql<string>`sum(carbs_g)`.as("carbsG"),
            sql<string>`sum(fat_g)`.as("fatG"),
          ])
          .where("userId", "=", userId)
          .where("loggedOn", ">=", from)
          .where("loggedOn", "<=", to)
          .groupBy("loggedOn")
          .execute(),
        db
          .selectFrom("workoutSets")
          .select(["performedOn as date", sql<string>`count(*)`.as("n")])
          .where("userId", "=", userId)
          .where("performedOn", ">=", from)
          .where("performedOn", "<=", to)
          .groupBy("performedOn")
          .execute(),
      ]);

      const days = new Map<string, { date: string; kcal: number; proteinG: number; carbsG: number; fatG: number; workoutSets: number }>();
      const get = (date: string) => {
        let d = days.get(date);
        if (!d) days.set(date, (d = { date, kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, workoutSets: 0 }));
        return d;
      };
      for (const r of food) Object.assign(get(r.date), { kcal: round1(Number(r.kcal)), proteinG: round1(Number(r.proteinG)), carbsG: round1(Number(r.carbsG)), fatG: round1(Number(r.fatG)) });
      for (const r of workout) get(r.date).workoutSets = Number(r.n);
      return { from, to, days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)) };
    },

    /** Xoá bản ghi của chính mình. Bản ghi của người khác trả 404 (không lộ là có tồn tại). */
    async deleteEntry(userId: string, id: string): Promise<void> {
      const res = await db
        .deleteFrom("foodLogEntries")
        .where("id", "=", id)
        .where("userId", "=", userId)
        .executeTakeFirst();
      if (res.numDeletedRows === 0n) throw notFound("entry_not_found");
    },
  };
}

export type NutritionService = ReturnType<typeof createNutritionService>;
