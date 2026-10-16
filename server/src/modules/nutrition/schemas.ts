import { z } from "zod";

// Thông báo lỗi là mã ổn định (snake_case) để frontend ánh xạ sang tiếng Việt.

const dateStr = z
  .string("required")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
  }, "invalid_date");

const per100 = (max: number) => z.number("required").min(0, "out_of_range").max(max, "out_of_range");

const foodName = z
  .string("required")
  .transform((v) => v.normalize("NFC").trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1, "required").max(120, "too_long"));

export const dateQuerySchema = z.strictObject({ date: dateStr });

export const foodQuerySchema = z.strictObject({ q: z.string().max(80).optional() });

export const createFoodSchema = z.strictObject({
  name: foodName,
  kcalPer100g: per100(1000),
  proteinPer100g: per100(100).default(0),
  carbsPer100g: per100(100).default(0),
  fatPer100g: per100(100).default(0),
});

const grams = z.number("required").gt(0, "out_of_range").max(5000, "out_of_range");
const slot = z.enum(["breakfast", "lunch", "dinner", "snack"], "invalid_slot");

/** Ghi một món: hoặc chọn món có sẵn (`foodId`), hoặc tự nhập (`custom`). Server tự tính calo. */
export const createEntrySchema = z
  .strictObject({
    loggedOn: dateStr,
    slot: slot.default("snack"),
    grams,
    foodId: z.uuid("invalid_food").optional(),
    custom: z.strictObject({ name: foodName.default("Món tự nhập"), kcalPer100g: per100(1000) }).optional(),
    clientRequestId: z.uuid("invalid_request_id").optional(),
  })
  .refine((v) => (v.foodId === undefined) !== (v.custom === undefined), { message: "food_or_custom", path: ["foodId"] });

export const idParamSchema = z.strictObject({ id: z.string().regex(/^\d{1,18}$/, "invalid_id") });
export const uuidParamSchema = z.strictObject({ id: z.uuid("invalid_id") });

export const mealPlanQuerySchema = z.strictObject({
  kcal: z.coerce.number("required").int("invalid").min(800, "out_of_range").max(6000, "out_of_range"),
  day: z.coerce.number().int("invalid").min(0, "out_of_range").max(6, "out_of_range").default(0),
  variant: z.coerce.number().int("invalid").min(0, "out_of_range").max(99, "out_of_range").default(0),
});

export const summaryQuerySchema = z.strictObject({ from: dateStr, to: dateStr });
