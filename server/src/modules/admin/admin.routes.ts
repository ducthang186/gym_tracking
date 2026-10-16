import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Config } from "../../config/env.js";
import { z } from "zod";
import { forbidden } from "../../lib/errors.js";
import type { AdminService } from "./admin.service.js";
import {
  createUserSchema,
  listUsersQuerySchema,
  roleBodySchema,
  statusBodySchema,
  updateClientSchema,
  userIdParamSchema,
} from "./admin.schemas.js";

export function registerAdminRoutes(app: FastifyInstance, deps: { config: Config; service: AdminService }) {
  const { config, service } = deps;
  const limit = (max: number, timeWindow: string) => ({
    rateLimit: { max: Math.max(1, Math.round(max * config.RATE_LIMIT_SCALE)), timeWindow },
  });

  const requireStaff = async (req: FastifyRequest) => {
    await app.requireAuth(req);
    if (req.user!.role === "client") throw forbidden("forbidden");
  };
  const requireAdmin = async (req: FastifyRequest) => {
    await app.requireAuth(req);
    if (req.user!.role !== "admin") throw forbidden("forbidden");
  };

  // ---- staff (coach thấy phạm vi của mình, admin thấy tất cả) ----
  app.get("/api/v1/admin/users", { preHandler: requireStaff }, async (req) => {
    const q = listUsersQuerySchema.parse(req.query);
    return service.listUsers(req.user!, q);
  });

  app.get("/api/v1/admin/stats", { preHandler: requireStaff }, async (req) => service.stats(req.user!));

  app.get("/api/v1/admin/coaches", { preHandler: requireStaff }, async () => ({ coaches: await service.listCoaches() }));

  app.post("/api/v1/admin/users/:id/reset-link", { preHandler: requireStaff, config: limit(30, "1 hour") }, async (req, reply) => {
    const { id } = userIdParamSchema.parse(req.params);
    return reply.code(201).send({ resetLink: await service.issueResetLink(req.user!, id, req.ip) });
  });

  // ---- chỉ admin ----
  app.post("/api/v1/admin/users", { preHandler: requireAdmin, config: limit(60, "1 hour") }, async (req, reply) => {
    const body = createUserSchema.parse(req.body);
    return reply.code(201).send(await service.createUser(req.user!.id, body, req.ip));
  });

  app.patch("/api/v1/admin/users/:id/status", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = userIdParamSchema.parse(req.params);
    const { status } = statusBodySchema.parse(req.body);
    await service.setStatus(req.user!.id, id, status, req.ip);
    return reply.code(204).send();
  });

  app.patch("/api/v1/admin/users/:id/role", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = userIdParamSchema.parse(req.params);
    const { role } = roleBodySchema.parse(req.body);
    await service.setRole(req.user!.id, id, role, req.ip);
    return reply.code(204).send();
  });

  app.patch("/api/v1/admin/users/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = userIdParamSchema.parse(req.params);
    const patch = updateClientSchema.parse(req.body);
    await service.updateClient(req.user!.id, id, patch, req.ip);
    return reply.code(204).send();
  });

  // Xoá tài khoản: chỉ admin, cần nhập lại mật khẩu của chính admin.
  const deleteBody = z.strictObject({ password: z.string("required").min(1, "required").max(128, "too_long") });
  app.delete("/api/v1/admin/users/:id", { preHandler: requireAdmin, config: limit(20, "1 hour") }, async (req, reply) => {
    const { id } = userIdParamSchema.parse(req.params);
    const { password } = deleteBody.parse(req.body);
    await service.deleteUser(req.user!.id, id, password, req.ip);
    return reply.code(204).send();
  });

  app.get("/api/v1/admin/system/status", { preHandler: requireAdmin }, async () => service.systemStatus());
}
