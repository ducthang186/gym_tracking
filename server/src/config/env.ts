import { z } from "zod";

const flag = (def: "true" | "false") =>
  z
    .enum(["true", "false"])
    .default(def)
    .transform((v) => v === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  /** Origin duy nhất của frontend. Dùng để chặn CSRF trên các endpoint dùng cookie. */
  APP_ORIGIN: z.string().url(),
  /** Chỉ bật khi API nằm sau reverse proxy đáng tin (Caddy) và không ai truy cập API trực tiếp. */
  TRUST_PROXY: flag("false"),
  REQUIRE_APPROVAL: flag("false"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET phải dài ít nhất 32 ký tự"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(30),
  ARGON2_MEMORY_KIB: z.coerce.number().int().min(8192).default(19456),
  ARGON2_TIME_COST: z.coerce.number().int().min(1).default(2),
  MAX_FAILED_LOGINS: z.coerce.number().int().min(3).default(10),
  LOCKOUT_MINUTES: z.coerce.number().int().min(1).default(15),
  /** Thư mục lưu ảnh tiến độ trên đĩa máy chủ (nên là một volume được backup). */
  STORAGE_DIR: z.string().min(1).default("./storage"),
  /** Thư mục chứa các bản backup, chỉ để trang trạng thái hệ thống báo tuổi bản backup mới nhất. */
  BACKUP_DIR: z.string().optional(),
  /** Nhân hệ số cho mọi giới hạn tốc độ (test đặt lớn để không bị chặn). */
  RATE_LIMIT_SCALE: z.coerce.number().positive().default(1),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(source: Record<string, string | undefined> = process.env): Config {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Cấu hình không hợp lệ:\n${lines.join("\n")}`);
  }
  return parsed.data;
}

/** Nạp file .env nếu có (không lỗi khi thiếu — production dùng biến môi trường thật). */
export function loadEnvFileIfPresent(path = ".env"): void {
  try {
    process.loadEnvFile(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
