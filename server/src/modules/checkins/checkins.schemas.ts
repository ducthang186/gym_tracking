import { z } from "zod";
import { dateStr } from "../body/schemas.js";

const note = z
  .string()
  .max(1000, "too_long")
  .transform((v) => v.trim())
  .nullable()
  .optional();

export const weekParamSchema = z.strictObject({ weekStart: dateStr });
export const checkinSchema = z.strictObject({
  trained: z.boolean("required"),
  note,
});
export const coachNoteSchema = z.strictObject({ note: z.string("required").max(1000, "too_long").transform((v) => v.trim()) });
