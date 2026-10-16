import { z } from "zod";
import { dateStr } from "../body/schemas.js";

export const uploadFieldsSchema = z.strictObject({
  takenOn: dateStr,
  angle: z.enum(["front", "side", "back"], "invalid_angle"),
});
export const photoParamSchema = z.strictObject({ photoId: z.uuid("invalid_id") });
export const fileQuerySchema = z.strictObject({ size: z.enum(["thumb", "full"], "invalid").default("thumb") });
