import { z } from "zod";
import { dateStr } from "../body/schemas.js";

// Thông báo lỗi là mã ổn định (snake_case) để frontend ánh xạ sang tiếng Việt.

const text = (max: number) =>
  z
    .string("required")
    .transform((v) => v.normalize("NFC").trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1, "required").max(max, "too_long"));

export const weekdayParamSchema = z.strictObject({
  weekday: z.coerce.number("invalid").int("invalid").min(1, "out_of_range").max(7, "out_of_range"),
});

export const planDaySchema = z.strictObject({
  name: text(80),
  items: z
    .array(
      z.strictObject({
        name: text(120),
        sets: z.number().int("invalid").min(1, "out_of_range").max(20, "out_of_range").nullable().optional(),
        reps: z
          .string()
          .max(20, "too_long")
          .transform((v) => v.trim())
          .nullable()
          .optional(),
      }),
      "invalid",
    )
    .max(30, "too_many"),
});

export const dateQuerySchema = z.strictObject({ date: dateStr });

export const addSetSchema = z.strictObject({
  performedOn: dateStr,
  exerciseName: text(120),
  reps: z.number("required").int("invalid").min(1, "out_of_range").max(500, "out_of_range"),
  weightKg: z.number("required").min(0, "out_of_range").max(1000, "out_of_range").default(0),
  clientRequestId: z.uuid("invalid_request_id").optional(),
});

export const historyQuerySchema = z.strictObject({ exercise: text(120) });
export const idParamSchema = z.strictObject({ id: z.string().regex(/^\d{1,18}$/, "invalid_id") });
