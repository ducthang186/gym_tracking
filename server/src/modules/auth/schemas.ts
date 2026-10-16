import { z } from "zod";
import { normalizePhone } from "./phone.js";

// Thông báo lỗi là MÃ ổn định (snake_case) để frontend ánh xạ sang tiếng Việt.

const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}' .’-]*$/u;

export const email = z
  .string("required")
  .trim()
  .toLowerCase()
  .min(1, "required")
  .max(254, "too_long")
  .email("invalid_email");

export const fullName = z
  .string("required")
  // NFC: gõ tiếng Việt bằng các bộ gõ khác nhau vẫn cho cùng một chuỗi
  .transform((v) => v.normalize("NFC").trim().replace(/\s+/g, " "))
  .pipe(z.string().min(2, "too_short").max(80, "too_long").regex(NAME_RE, "invalid_name"));

export const phone = z
  .string("required")
  .max(32, "too_long")
  .refine((v) => normalizePhone(v) !== null, "invalid_phone")
  .transform((v) => normalizePhone(v) as string);

export const password = z.string("required").min(8, "too_short").max(128, "too_long");

/** strictObject: khoá lạ (vd `role: "admin"`) bị từ chối thay vì lặng lẽ bỏ qua. */
export const registerSchema = z.strictObject({
  email,
  fullName,
  phone,
  password,
  /** Trường bẫy: người thật không thấy nên để trống. */
  website: z.string().max(200).optional(),
});

export const loginSchema = z.strictObject({
  /** Email hoặc số điện thoại. */
  identifier: z.string("required").trim().min(1, "required").max(254, "too_long"),
  password: z.string("required").min(1, "required").max(128, "too_long"),
});

export const changePasswordSchema = z.strictObject({
  currentPassword: z.string("required").min(1, "required").max(128, "too_long"),
  newPassword: password,
});

export const resetPasswordSchema = z.strictObject({
  token: z.string("required").min(20, "invalid_token").max(200, "invalid_token"),
  newPassword: password,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
