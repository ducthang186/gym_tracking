import type { Selectable } from "kysely";
import type { Db } from "../../db/index.js";
import type { ActivityLevel, BodyMetricsTable } from "../../db/types.js";
import { addDays, ageOn, assertNotFuture, toDateStr } from "../../lib/dates.js";
import { notFound } from "../../lib/errors.js";
import { bmi, suggestTargets, type Gender, type TargetValues } from "./calc.js";

export interface ProfileData {
  gender: Gender | null;
  birthDate: string | null;
  heightCm: number | null;
  targetWeightKg: number | null;
  activityLevel: ActivityLevel | null;
}

export interface Metric {
  date: string;
  weightKg: number;
  bodyFatPct: number | null;
  waistCm: number | null;
  note: string | null;
}

const num = (v: string | null) => (v === null ? null : Number(v));
const str = (v: number | null | undefined) => (v === null || v === undefined ? v : String(v));

const toMetric = (r: Selectable<BodyMetricsTable>): Metric => ({
  date: r.measuredOn,
  weightKg: Number(r.weightKg),
  bodyFatPct: num(r.bodyFatPct),
  waistCm: num(r.waistCm),
  note: r.note,
});

export type ProfilePatch = {
  gender?: Gender | null;
  birthDate?: string | null;
  heightCm?: number | null;
  targetWeightKg?: number | null;
  activityLevel?: ActivityLevel | null;
};

export function createBodyService(db: Db) {
  async function getProfile(userId: string): Promise<ProfileData> {
    const p = await db.selectFrom("profiles").selectAll().where("id", "=", userId).executeTakeFirstOrThrow();
    return {
      gender: p.gender,
      birthDate: p.birthDate,
      heightCm: num(p.heightCm),
      targetWeightKg: num(p.targetWeightKg),
      activityLevel: p.activityLevel,
    };
  }

  async function latestWeight(userId: string, onOrBefore: string): Promise<number | null> {
    const row = await db
      .selectFrom("bodyMetrics")
      .select("weightKg")
      .where("userId", "=", userId)
      .where("measuredOn", "<=", onOrBefore)
      .orderBy("measuredOn", "desc")
      .limit(1)
      .executeTakeFirst();
    return row ? Number(row.weightKg) : null;
  }

  return {
    getProfile,

    /** Chỉ cập nhật các khoá có mặt trong `patch` (null = xoá giá trị). */
    async updateProfile(userId: string, patch: ProfilePatch): Promise<ProfileData> {
      const set: Record<string, unknown> = {};
      if (patch.gender !== undefined) set.gender = patch.gender;
      if (patch.birthDate !== undefined) set.birthDate = patch.birthDate;
      if (patch.heightCm !== undefined) set.heightCm = str(patch.heightCm);
      if (patch.targetWeightKg !== undefined) set.targetWeightKg = str(patch.targetWeightKg);
      if (patch.activityLevel !== undefined) set.activityLevel = patch.activityLevel;
      if (Object.keys(set).length) await db.updateTable("profiles").set(set).where("id", "=", userId).execute();
      return getProfile(userId);
    },

    // ---- chỉ số cơ thể ----
    async listMetrics(userId: string, from?: string, to?: string): Promise<Metric[]> {
      const end = to ?? addDays(toDateStr(new Date()), 1);
      const start = from ?? addDays(end, -180);
      const rows = await db
        .selectFrom("bodyMetrics")
        .selectAll()
        .where("userId", "=", userId)
        .where("measuredOn", ">=", start)
        .where("measuredOn", "<=", end)
        .orderBy("measuredOn")
        .limit(1000)
        .execute();
      return rows.map(toMetric);
    },

    async upsertMetric(
      userId: string,
      date: string,
      v: { weightKg: number; bodyFatPct?: number | null; waistCm?: number | null; note?: string | null },
    ): Promise<Metric> {
      assertNotFuture(date);
      const values = {
        weightKg: String(v.weightKg),
        bodyFatPct: str(v.bodyFatPct ?? null) as string | null,
        waistCm: str(v.waistCm ?? null) as string | null,
        note: v.note ? v.note : null,
      };
      const row = await db
        .insertInto("bodyMetrics")
        .values({ userId, measuredOn: date, ...values })
        .onConflict((oc) => oc.columns(["userId", "measuredOn"]).doUpdateSet({ ...values, updatedAt: new Date() }))
        .returningAll()
        .executeTakeFirstOrThrow();
      return toMetric(row);
    },

    async deleteMetric(userId: string, date: string): Promise<void> {
      const res = await db.deleteFrom("bodyMetrics").where("userId", "=", userId).where("measuredOn", "=", date).executeTakeFirst();
      if (res.numDeletedRows === 0n) throw notFound("metric_not_found");
    },

    // ---- mục tiêu dinh dưỡng ----
    async currentTarget(userId: string, date: string) {
      const [row, profile, weight] = await Promise.all([
        db
          .selectFrom("nutritionTargets")
          .selectAll()
          .where("userId", "=", userId)
          .where("effectiveFrom", "<=", date)
          .orderBy("effectiveFrom", "desc")
          .limit(1)
          .executeTakeFirst(),
        getProfile(userId),
        latestWeight(userId, date),
      ]);

      const suggestion = suggestTargets({
        gender: profile.gender,
        age: profile.birthDate ? ageOn(profile.birthDate, date) : null,
        heightCm: profile.heightCm,
        weightKg: weight,
        targetWeightKg: profile.targetWeightKg,
        activityLevel: profile.activityLevel,
      });

      return {
        target: row
          ? { effectiveFrom: row.effectiveFrom, kcal: row.kcal, proteinG: row.proteinG, carbsG: row.carbsG, fatG: row.fatG }
          : null,
        suggestion: suggestion.ok
          ? { goal: suggestion.goal, bmr: suggestion.bmr, tdee: suggestion.tdee, ...suggestion.target }
          : null,
        missing: suggestion.ok ? [] : suggestion.missing,
        bmi: weight !== null && profile.heightCm !== null ? bmi(weight, profile.heightCm) : null,
      };
    },

    async setTarget(userId: string, setBy: string, effectiveFrom: string, t: TargetValues) {
      assertNotFuture(effectiveFrom);
      const values = { kcal: t.kcal, proteinG: t.proteinG, carbsG: t.carbsG, fatG: t.fatG, setBy };
      await db
        .insertInto("nutritionTargets")
        .values({ userId, effectiveFrom, ...values })
        .onConflict((oc) => oc.columns(["userId", "effectiveFrom"]).doUpdateSet(values))
        .execute();
    },
  };
}

export type BodyService = ReturnType<typeof createBodyService>;
