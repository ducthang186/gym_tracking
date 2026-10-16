import type { ActivityLevel } from "../../db/types.js";

// Công thức thuần (không đụng database) để dễ kiểm tra bằng test đơn vị.

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2, // ít vận động
  light: 1.375, // 1–3 buổi/tuần
  moderate: 1.55, // 3–5 buổi/tuần
  active: 1.725, // 6–7 buổi/tuần
  very_active: 1.9, // lao động nặng + tập luyện
};

export type Gender = "male" | "female" | "other";

export const bmi = (weightKg: number, heightCm: number) => Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;

/** Mifflin–St Jeor. Giới tính "other" lấy trung bình hằng số của nam (+5) và nữ (−161). */
export function bmr(gender: Gender, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return base + (gender === "male" ? 5 : gender === "female" ? -161 : -78);
}

export interface SuggestInput {
  gender: Gender | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  targetWeightKg: number | null;
  activityLevel: ActivityLevel | null;
}

export interface TargetValues {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export type Suggestion =
  | { ok: true; goal: "lose" | "gain" | "maintain"; bmr: number; tdee: number; target: TargetValues }
  | { ok: false; missing: string[] };

const round = (n: number, step = 1) => Math.round(n / step) * step;

/** Gợi ý mục tiêu hằng ngày: giảm 500 kcal khi muốn giảm cân, +300 khi muốn tăng, giữ nguyên nếu gần mục tiêu. */
export function suggestTargets(i: SuggestInput): Suggestion {
  const missing: string[] = [];
  if (!i.gender) missing.push("gender");
  if (i.age === null) missing.push("birthDate");
  if (i.heightCm === null) missing.push("heightCm");
  if (i.weightKg === null) missing.push("weight");
  if (!i.activityLevel) missing.push("activityLevel");
  if (missing.length) return { ok: false, missing };

  const base = bmr(i.gender!, i.weightKg!, i.heightCm!, i.age!);
  const tdee = base * ACTIVITY_FACTORS[i.activityLevel!];

  const diff = i.targetWeightKg === null ? 0 : i.targetWeightKg - i.weightKg!;
  const goal = diff < -1 ? "lose" : diff > 1 ? "gain" : "maintain";
  const raw = goal === "lose" ? tdee - 500 : goal === "gain" ? tdee + 300 : tdee;

  const kcal = Math.min(6000, Math.max(1200, round(raw, 10)));
  const proteinG = Math.min(500, round(i.weightKg! * (goal === "lose" ? 2.0 : 1.8)));
  const fatG = round((kcal * 0.25) / 9);
  const carbsG = Math.max(0, round((kcal - proteinG * 4 - fatG * 9) / 4));

  return { ok: true, goal, bmr: round(base), tdee: round(tdee), target: { kcal, proteinG, carbsG, fatG } };
}
