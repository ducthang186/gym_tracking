import type { FastifyInstance } from "fastify";
import type { Config } from "../../config/env.js";
import type { AccountService } from "./account.service.js";

export function registerAccountRoutes(app: FastifyInstance, deps: { config: Config; service: AccountService }) {
  const { config, service } = deps;
  const auth = { preHandler: app.requireAuth };
  const limit = (max: number, timeWindow: string) => ({
    rateLimit: { max: Math.max(1, Math.round(max * config.RATE_LIMIT_SCALE)), timeWindow },
  });

  app.get("/api/v1/me/export", { ...auth, config: limit(10, "1 hour") }, async (req, reply) => {
    reply.header("Content-Disposition", 'attachment; filename="latis-du-lieu-cua-toi.json"');
    return service.exportData(req.user!.id);
  });

}
