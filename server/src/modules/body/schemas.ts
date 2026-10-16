import { z } from "zod";

// Thông báo lỗi là mã ổn định (snake_case) để frontend ánh xạ sang tiếng Việt.

export const dateStr = z
  .string("required")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
  }, "invalid_date");

const num = (min: number, max: number) => z.number("required").min(min, "out_of_range").max(max, "out_of_range");

export const updateProfileSchema = z.strictObject({
  gender: z.enum(["male", "female", "other"], "invalid_gender").nullable().optional(),
  birthDate: dateStr
    .refine((v) => v >= "1900-01-01" && v <= new Date().toISOString().slice(0, 10), "out_of_range")
    .nullable()
    .optional(),
  heightCm: num(80, 250).nullable().optional(),
  targetWeightKg: num(20, 400).nullable().optional(),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"], "invalid_activity").nullable().optional(),
});

export const rangeQuerySchema = z.strictObject({ from: dateStr.optional(), to: dateStr.optional() });

export const dateParamSchema = z.strictObject({ date: dateStr });

export const upsertMetricSchema = z.strictObject({
  weightKg: num(20, 400),
  bodyFatPct: num(2, 70).nullable().optional(),
  waistCm: num(30, 250).nullable().optional(),
  note: z
    .string()
    .max(500, "too_long")
    .transform((v) => v.trim())
    .nullable()
    .optional(),
});

export const targetQuerySchema = z.strictObject({ date: dateStr });

export const setTargetSchema = z.strictObject({
  effectiveFrom: dateStr,
  kcal: z.number("required").int("invalid").min(800, "out_of_range").max(6000, "out_of_range"),
  proteinG: z.number("required").int("invalid").min(0, "out_of_range").max(500, "out_of_range"),
  carbsG: z.number("required").int("invalid").min(0, "out_of_range").max(1000, "out_of_range"),
  fatG: z.number("required").int("invalid").min(0, "out_of_range").max(400, "out_of_range"),
});
