import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { sql } from "kysely";
import { ZodError } from "zod";
import type { Config } from "./config/env.js";
import { createDb, type Db } from "./db/index.js";
import { AppError } from "./lib/errors.js";
import { createAuthService } from "./modules/auth/auth.service.js";
import { registerAuthRoutes } from "./modules/auth/auth.routes.js";
import { createPasswordHasher } from "./modules/auth/password.js";
import { createTokenService } from "./modules/auth/tokens.js";
import { registerAccountRoutes } from "./modules/account/account.routes.js";
import { createAccountService } from "./modules/account/account.service.js";
import { registerAdminRoutes } from "./modules/admin/admin.routes.js";
import { createAdminService } from "./modules/admin/admin.service.js";
import { registerCheckinRoutes } from "./modules/checkins/checkins.routes.js";
import { createCheckinsService } from "./modules/checkins/checkins.service.js";
import { registerClientRoutes } from "./modules/clients/clients.routes.js";
import { registerPhotoRoutes } from "./modules/photos/photos.routes.js";
import { createPhotosService } from "./modules/photos/photos.service.js";
import { createStorage } from "./lib/storage.js";
import { registerBodyRoutes } from "./modules/body/body.routes.js";
import { createBodyService } from "./modules/body/body.service.js";
import { registerContentRoutes } from "./modules/content/content.routes.js";
import { createContentService } from "./modules/content/content.service.js";
import { registerWorkoutRoutes } from "./modules/workout/workout.routes.js";
import { createWorkoutService } from "./modules/workout/workout.service.js";
import { registerNutritionRoutes } from "./modules/nutrition/nutrition.routes.js";
import { createNutritionService } from "./modules/nutrition/nutrition.service.js";

const isCode = (s: string) => /^[a-z][a-z_]*$/.test(s);

export async function buildApp(opts: { config: Config; db?: Db; logger?: boolean }) {
  const { config } = opts;
  const ownsDb = !opts.db;
  const db = opts.db ?? createDb(config.DATABASE_URL);

  const app = Fastify({
    logger:
      opts.logger === false
        ? false
        : {
            level: "info",
            // Không bao giờ ghi token / cookie / mật khẩu vào log.
            redact: {
              paths: ["req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]'],
              censor: "[đã ẩn]",
            },
          },
    trustProxy: config.TRUST_PROXY,
    bodyLimit: 1_048_576,
  });

  // Chỉ nhận JSON. Fastify mặc định còn parse `text/plain`, là loại request "đơn giản" mà trang web
  // của kẻ tấn công gửi chéo site được mà không cần preflight → gỡ đi để bịt đường CSRF đó.
  app.removeContentTypeParser("text/plain");

  app.decorate("db", db);
  if (ownsDb) app.addHook("onClose", async () => db.destroy());

  await app.register(helmet);
  await app.register(cookie);
  await app.register(multipart); // chỉ dùng cho upload ảnh admin; giới hạn kích thước đặt theo từng route
  await app.register(rateLimit, {
    global: true,
    max: Math.max(1, Math.round(120 * config.RATE_LIMIT_SCALE)),
    timeWindow: "1 minute",
    errorResponseBuilder: (_req, ctx) => ({
      statusCode: 429,
      error: "rate_limited",
      details: { retryAfterSeconds: Math.ceil(ctx.ttl / 1000) },
    }),
  });

  // Phản hồi API (token, dữ liệu cá nhân) không bao giờ được lưu cache.
  app.addHook("onSend", async (req, reply) => {
    // Mặc định không cache; route công khai (nội dung giới thiệu, ảnh) tự đặt Cache-Control riêng thì giữ nguyên.
    if (req.url.startsWith("/api/") && !reply.hasHeader("cache-control")) reply.header("Cache-Control", "no-store");
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({ error: err.code, ...(err.details ? { details: err.details } : {}) });
    }
    if (err instanceof ZodError) {
      const fields = err.issues.map((i) => ({
        field: i.path.join(".") || (i.code === "unrecognized_keys" ? i.keys.join(",") : ""),
        code: isCode(i.message) ? i.message : "invalid",
      }));
      return reply.code(400).send({ error: "validation_error", details: { fields } });
    }
    const e = err as { statusCode?: number; error?: string; details?: unknown };
    if (e.statusCode === 429) {
      return reply.code(429).send({ error: "rate_limited", ...(e.details ? { details: e.details } : {}) });
    }
    if (e.statusCode === 413) return reply.code(413).send({ error: "file_too_large" });
    if (typeof e.statusCode === "number" && e.statusCode >= 400 && e.statusCode < 500) {
      return reply.code(e.statusCode).send({ error: "bad_request" });
    }
    req.log.error(err);
    return reply.code(500).send({ error: "internal_error" }); // không lộ stack trace
  });

  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: "not_found" }));

  app.get("/api/v1/health", async (_req, reply) => {
    try {
      await sql`select 1`.execute(db);
      return { status: "ok" };
    } catch {
      return reply.code(503).send({ status: "degraded" });
    }
  });

  const hasher = createPasswordHasher(config);
  const authService = createAuthService({ db, config, hasher, tokens: createTokenService(config) });
  const storage = createStorage(config.STORAGE_DIR);
  const body = createBodyService(db);
  const nutrition = createNutritionService(db);
  const workout = createWorkoutService(db);
  const checkins = createCheckinsService(db);
  const photos = createPhotosService(db, storage);

  registerAuthRoutes(app, { config, service: authService });
  registerNutritionRoutes(app, { config, service: nutrition });
  registerBodyRoutes(app, { config, service: body });
  registerWorkoutRoutes(app, { config, service: workout });
  registerContentRoutes(app, { config, service: createContentService(db) });
  registerCheckinRoutes(app, { config, service: checkins });
  registerPhotoRoutes(app, { config, service: photos });
  registerAccountRoutes(app, { config, service: createAccountService({ db }) });
  registerAdminRoutes(app, { config, service: createAdminService({ db, config, auth: authService, hasher, storage }) });
  registerClientRoutes(app, { config, db, body, nutrition, workout, checkins, photos });

  return app;
}
