import type { FastifyInstance } from "fastify";
import type { Config } from "../../config/env.js";
import type { BodyService } from "./body.service.js";
import {
  dateParamSchema,
  rangeQuerySchema,
  setTargetSchema,
  targetQuerySchema,
  updateProfileSchema,
  upsertMetricSchema,
} from "./schemas.js";

export function registerBodyRoutes(app: FastifyInstance, deps: { config: Config; service: BodyService }) {
  const { config, service } = deps;
  const auth = { preHandler: app.requireAuth };
  const limit = (max: number, timeWindow: string) => ({
    rateLimit: { max: Math.max(1, Math.round(max * config.RATE_LIMIT_SCALE)), timeWindow },
  });

  // ---- hồ sơ thể chất của chính mình ----
  app.get("/api/v1/me/profile", auth, async (req) => ({ profile: await service.getProfile(req.user!.id) }));

  app.patch("/api/v1/me/profile", { ...auth, config: limit(60, "1 hour") }, async (req) => {
    const patch = updateProfileSchema.parse(req.body);
    return { profile: await service.updateProfile(req.user!.id, patch) };
  });

  // ---- cân nặng / số đo ----
  app.get("/api/v1/body-metrics", auth, async (req) => {
    const { from, to } = rangeQuerySchema.parse(req.query);
    return { metrics: await service.listMetrics(req.user!.id, from, to) };
  });

  app.put("/api/v1/body-metrics/:date", { ...auth, config: limit(120, "1 hour") }, async (req) => {
    const { date } = dateParamSchema.parse(req.params);
    const body = upsertMetricSchema.parse(req.body);
    return { metric: await service.upsertMetric(req.user!.id, date, body) };
  });

  app.delete("/api/v1/body-metrics/:date", auth, async (req, reply) => {
    const { date } = dateParamSchema.parse(req.params);
    await service.deleteMetric(req.user!.id, date);
    return reply.code(204).send();
  });

  // ---- mục tiêu dinh dưỡng ----
  app.get("/api/v1/nutrition-targets/current", auth, async (req) => {
    const { date } = targetQuerySchema.parse(req.query);
    return service.currentTarget(req.user!.id, date);
  });

  app.put("/api/v1/nutrition-targets", { ...auth, config: limit(60, "1 hour") }, async (req) => {
    const { effectiveFrom, ...values } = setTargetSchema.parse(req.body);
    await service.setTarget(req.user!.id, req.user!.id, effectiveFrom, values);
    return service.currentTarget(req.user!.id, effectiveFrom);
  });
}
