import { z } from "zod";
import { email, fullName, phone } from "../auth/schemas.js";

export const listUsersQuerySchema = z.strictObject({
  q: z.string().max(80).optional(),
  status: z.enum(["pending", "active", "suspended"], "invalid").optional(),
  role: z.enum(["client", "coach", "admin"], "invalid").optional(),
  limit: z.coerce.number().int("invalid").min(1, "out_of_range").max(100, "out_of_range").default(50),
  offset: z.coerce.number().int("invalid").min(0, "out_of_range").max(100_000, "out_of_range").default(0),
});

export const createUserSchema = z.strictObject({
  email,
  fullName,
  phone,
  role: z.enum(["client", "coach", "admin"], "invalid").default("client"),
});

export const userIdParamSchema = z.strictObject({ id: z.uuid("invalid_id") });
export const statusBodySchema = z.strictObject({ status: z.enum(["pending", "active", "suspended"], "invalid") });
export const roleBodySchema = z.strictObject({ role: z.enum(["client", "coach", "admin"], "invalid") });

export const updateClientSchema = z.strictObject({
  coachId: z.uuid("invalid_id").nullable().optional(),
  package: z
    .string()
    .max(60, "too_long")
    .transform((v) => v.trim())
    .nullable()
    .optional(),
  clientStatus: z.enum(["active", "paused", "ended"], "invalid").optional(),
});
