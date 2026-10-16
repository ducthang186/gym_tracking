import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Config } from "../../config/env.js";
import { badRequest } from "../../lib/errors.js";
import type { PhotosService } from "./photos.service.js";
import { fileQuerySchema, photoParamSchema, uploadFieldsSchema } from "./photos.schemas.js";

/** Gửi tệp ảnh riêng tư: chỉ cache ở trình duyệt của chính người xem, không qua proxy/CDN. */
export function sendPhoto(reply: FastifyReply, data: Buffer) {
  reply.header("Cache-Control", "private, max-age=3600");
  reply.header("X-Content-Type-Options", "nosniff");
  return reply.type("image/webp").send(data);
}

export function registerPhotoRoutes(app: FastifyInstance, deps: { config: Config; service: PhotosService }) {
  const { config, service } = deps;
  const auth = { preHandler: app.requireAuth };

  async function readUpload(req: FastifyRequest) {
    if (!req.isMultipart()) throw badRequest("invalid_image");
    // Các trường (takenOn, angle) phải được gửi TRƯỚC tệp trong form thì mới có mặt khi tệp bắt đầu được đọc.
    const file = await req.file({ limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 4 } });
    if (!file) throw badRequest("invalid_image");
    const fields = Object.fromEntries(
      Object.entries(file.fields)
        .filter(([, v]) => v && !Array.isArray(v) && (v as { type: string }).type === "field")
        .map(([k, v]) => [k, (v as { value: unknown }).value]),
    );
    const parsed = uploadFieldsSchema.parse(fields);
    return { ...parsed, data: await file.toBuffer() }; // ném 413 nếu quá 8 MB
  }

  app.get("/api/v1/photos", auth, async (req) => ({ photos: await service.list(req.user!.id) }));

  app.post(
    "/api/v1/photos",
    { ...auth, config: { rateLimit: { max: Math.max(1, Math.round(30 * config.RATE_LIMIT_SCALE)), timeWindow: "1 hour" } } },
    async (req, reply) => {
      const { takenOn, angle, data } = await readUpload(req);
      return reply.code(201).send({ photo: await service.upload(req.user!.id, { takenOn, angle, data }) });
    },
  );

  app.get("/api/v1/photos/:photoId/file", auth, async (req, reply) => {
    const { photoId } = photoParamSchema.parse(req.params);
    const { size } = fileQuerySchema.parse(req.query);
    return sendPhoto(reply, await service.file(req.user!.id, photoId, size));
  });

  app.delete("/api/v1/photos/:photoId", auth, async (req, reply) => {
    const { photoId } = photoParamSchema.parse(req.params);
    await service.remove(req.user!.id, photoId);
    return reply.code(204).send();
  });
}
