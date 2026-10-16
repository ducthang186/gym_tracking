import type { FastifyInstance } from "fastify";
import type { Config } from "../../config/env.js";
import { rangeQuerySchema } from "../body/schemas.js";
import type { CheckinsService } from "./checkins.service.js";
import { checkinSchema, weekParamSchema } from "./checkins.schemas.js";

export function registerCheckinRoutes(app: FastifyInstance, deps: { config: Config; service: CheckinsService }) {
  const { config, service } = deps;
  const auth = { preHandler: app.requireAuth };

  app.get("/api/v1/checkins", auth, async (req) => {
    const { from, to } = rangeQuerySchema.parse(req.query);
    return { checkins: await service.list(req.user!.id, from, to) };
  });

  app.put(
    "/api/v1/checkins/:weekStart",
    { ...auth, config: { rateLimit: { max: Math.max(1, Math.round(60 * config.RATE_LIMIT_SCALE)), timeWindow: "1 hour" } } },
    async (req) => {
      const { weekStart } = weekParamSchema.parse(req.params);
      const body = checkinSchema.parse(req.body);
      return { checkin: await service.upsert(req.user!.id, weekStart, body) };
    },
  );
}
