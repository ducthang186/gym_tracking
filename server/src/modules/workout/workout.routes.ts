import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Config } from "../../config/env.js";
import { forbidden } from "../../lib/errors.js";
import type { WorkoutService } from "./workout.service.js";
import { addSetSchema, dateQuerySchema, historyQuerySchema, idParamSchema, planDaySchema, weekdayParamSchema } from "./schemas.js";

export function registerWorkoutRoutes(app: FastifyInstance, deps: { config: Config; service: WorkoutService }) {
  const { config, service } = deps;
  const auth = { preHandler: app.requireAuth };
  const limit = (max: number, timeWindow: string) => ({
    rateLimit: { max: Math.max(1, Math.round(max * config.RATE_LIMIT_SCALE)), timeWindow },
  });

  const requireStaff = async (req: FastifyRequest) => {
    await app.requireAuth(req);
    if (req.user!.role !== "admin" && req.user!.role !== "coach") throw forbidden("forbidden");
  };

  // ---- giáo án tuần ----
  app.get("/api/v1/workout-plan", auth, async () => ({ days: await service.getPlan() }));

  app.put("/api/v1/workout-plan/:weekday", { preHandler: requireStaff, config: limit(120, "1 hour") }, async (req) => {
    const { weekday } = weekdayParamSchema.parse(req.params);
    const body = planDaySchema.parse(req.body);
    return { day: await service.setPlanDay(req.user!.id, weekday, body, req.ip) };
  });

  // ---- nhật ký tập ----
  app.get("/api/v1/workout-log", auth, async (req) => {
    const { date } = dateQuerySchema.parse(req.query);
    return { date, sets: await service.listSets(req.user!.id, date) };
  });

  app.post("/api/v1/workout-log", { ...auth, config: limit(600, "1 hour") }, async (req, reply) => {
    const body = addSetSchema.parse(req.body);
    const { set, created } = await service.addSet(req.user!.id, body);
    return reply.code(created ? 201 : 200).send({ set });
  });

  app.delete("/api/v1/workout-log/:id", auth, async (req, reply) => {
    const { id } = idParamSchema.parse(req.params);
    await service.deleteSet(req.user!.id, id);
    return reply.code(204).send();
  });

  app.get("/api/v1/workout-log/history", auth, async (req) => {
    const { exercise } = historyQuerySchema.parse(req.query);
    return { sets: await service.history(req.user!.id, exercise) };
  });
}
