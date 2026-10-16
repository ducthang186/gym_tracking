import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Config } from "../../config/env.js";
import { badRequest, forbidden, notFound } from "../../lib/errors.js";
import type { ContentService } from "./content.service.js";
import { aboutSchema } from "./schemas.js";

export function registerContentRoutes(app: FastifyInstance, deps: { config: Config; service: ContentService }) {
  const { config, service } = deps;
  const limit = (max: number, timeWindow: string) => ({
    rateLimit: { max: Math.max(1, Math.round(max * config.RATE_LIMIT_SCALE)), timeWindow },
  });

  // Nội dung trang giới thiệu do chủ hệ thống (admin) quản lý.
  const requireAdmin = async (req: FastifyRequest) => {
    await app.requireAuth(req);
    if (req.user!.role !== "admin") throw forbidden("forbidden");
  };

  // ---- công khai (trang chủ cho khách chưa đăng nhập) ----
  app.get("/api/v1/public/about", async (_req, reply) => {
    reply.header("Cache-Control", "public, max-age=60");
    return { about: await service.getAbout() };
  });

  app.get("/api/v1/public/coach-photo", async (_req, reply) => {
    const photo = await service.getPhoto();
    if (!photo) throw notFound("no_photo");
    // URL có ?v=<phiên bản> nên cache được lâu; đổi ảnh thì phiên bản đổi.
    reply.header("Cache-Control", "public, max-age=86400");
    reply.header("X-Content-Type-Options", "nosniff");
    return reply.type(photo.contentType).send(photo.data);
  });

  // ---- admin ----
  app.put("/api/v1/admin/about", { preHandler: requireAdmin, config: limit(60, "1 hour") }, async (req) => {
    await service.setAbout(req.user!.id, aboutSchema.parse(req.body), req.ip);
    return { about: await service.getAbout() };
  });

  app.post("/api/v1/admin/about/photo", { preHandler: requireAdmin, config: limit(20, "1 hour") }, async (req, reply) => {
    if (!req.isMultipart()) throw badRequest("invalid_image");
    const file = await req.file({ limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 } });
    if (!file) throw badRequest("invalid_image");
    const buffer = await file.toBuffer(); // ném RequestFileTooLargeError (413) nếu quá 5MB
    if (file.file.truncated) return reply.code(413).send({ error: "file_too_large" });
    await service.setPhoto(req.user!.id, buffer, req.ip);
    return { about: await service.getAbout() };
  });

  app.delete("/api/v1/admin/about/photo", { preHandler: requireAdmin }, async (req, reply) => {
    await service.deletePhoto(req.user!.id, req.ip);
    return reply.code(204).send();
  });
}
