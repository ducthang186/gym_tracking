import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Config } from "../../config/env.js";
import { forbidden } from "../../lib/errors.js";
import type { NutritionService } from "./nutrition.service.js";
import {
  createEntrySchema,
  createFoodSchema,
  dateQuerySchema,
  foodQuerySchema,
  idParamSchema,
  mealPlanQuerySchema,
  summaryQuerySchema,
  uuidParamSchema,
} from "./schemas.js";

export function registerNutritionRoutes(app: FastifyInstance, deps: { config: Config; service: NutritionService }) {
  const { config, service } = deps;
  const auth = { preHandler: app.requireAuth };
  const limit = (max: number, timeWindow: string) => ({
    rateLimit: { max: Math.max(1, Math.round(max * config.RATE_LIMIT_SCALE)), timeWindow },
  });

  /** Quản lý danh mục món: admin và coach. Học viên chỉ được đọc. */
  const requireStaff = async (req: FastifyRequest) => {
    await app.requireAuth(req);
    if (req.user!.role !== "admin" && req.user!.role !== "coach") throw forbidden("forbidden");
  };

  // ---- danh mục món ăn ----
  app.get("/api/v1/foods", auth, async (req) => {
    const { q } = foodQuerySchema.parse(req.query);
    return { foods: await service.listFoods(q) };
  });

  app.post("/api/v1/foods", { preHandler: requireStaff, config: limit(60, "1 hour") }, async (req, reply) => {
    const body = createFoodSchema.parse(req.body);
    return reply.code(201).send({ food: await service.createFood(req.user!.id, body, req.ip) });
  });

  app.delete("/api/v1/foods/:id", { preHandler: requireStaff }, async (req, reply) => {
    const { id } = uuidParamSchema.parse(req.params);
    await service.archiveFood(req.user!.id, id, req.ip);
    return reply.code(204).send();
  });

  // ---- nhật ký ăn: userId luôn lấy từ token, không bao giờ từ body/URL ----
  app.get("/api/v1/food-log", auth, async (req) => {
    const { date } = dateQuerySchema.parse(req.query);
    return service.listEntries(req.user!.id, date);
  });

  app.post("/api/v1/food-log", { ...auth, config: limit(300, "1 hour") }, async (req, reply) => {
    const body = createEntrySchema.parse(req.body);
    const { entry, created } = await service.createEntry(req.user!.id, body);
    return reply.code(created ? 201 : 200).send({ entry });
  });

  app.get("/api/v1/food-log/summary", auth, async (req) => {
    const { from, to } = summaryQuerySchema.parse(req.query);
    return service.summary(req.user!.id, from, to);
  });

  app.get("/api/v1/meal-plan/suggest", auth, async (req) => {
    const { kcal, day, variant } = mealPlanQuerySchema.parse(req.query);
    return { day, variant, plan: await service.suggestDayPlan(kcal, day, variant) };
  });

  app.delete("/api/v1/food-log/:id", auth, async (req, reply) => {
    const { id } = idParamSchema.parse(req.params);
    await service.deleteEntry(req.user!.id, id);
    return reply.code(204).send();
  });
}
