import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Config } from "../../config/env.js";
import type { Db } from "../../db/index.js";
import { addDays } from "../../lib/dates.js";
import { audit } from "../../lib/audit.js";
import { forbidden, notFound } from "../../lib/errors.js";
import { findAccessibleClient } from "../../lib/policy.js";
import { rangeQuerySchema, setTargetSchema, targetQuerySchema } from "../body/schemas.js";
import type { BodyService } from "../body/body.service.js";
import { coachNoteSchema, weekParamSchema } from "../checkins/checkins.schemas.js";
import type { CheckinsService } from "../checkins/checkins.service.js";
import type { NutritionService } from "../nutrition/nutrition.service.js";
import { dateQuerySchema as nutritionDateQuery } from "../nutrition/schemas.js";
import { fileQuerySchema, photoParamSchema } from "../photos/photos.schemas.js";
import { sendPhoto } from "../photos/photos.routes.js";
import type { PhotosService } from "../photos/photos.service.js";
import { dateQuerySchema as workoutDateQuery } from "../workout/schemas.js";
import type { WorkoutService } from "../workout/workout.service.js";

const clientParam = z.strictObject({ id: z.uuid("invalid_id") });
const clientWeekParam = z.strictObject({ id: z.uuid("invalid_id"), weekStart: weekParamSchema.shape.weekStart });
const clientPhotoParam = z.strictObject({ id: z.uuid("invalid_id"), photoId: photoParamSchema.shape.photoId });

/**
 * Dữ liệu của học viên dành cho coach/admin. MỌI route đều đi qua `findAccessibleClient` (policy) và ghi audit_log
 * "ai đã xem dữ liệu của ai"; học viên ngoài phạm vi của coach trả 404 như thể không tồn tại.
 */
export function registerClientRoutes(
  app: FastifyInstance,
  deps: {
    config: Config;
    db: Db;
    body: BodyService;
    nutrition: NutritionService;
    workout: WorkoutService;
    checkins: CheckinsService;
    photos: PhotosService;
  },
) {
  const { config, db, body, nutrition, workout, checkins, photos } = deps;

  const requireStaff = async (req: FastifyRequest) => {
    await app.requireAuth(req);
    if (req.user!.role === "client") throw forbidden("forbidden");
  };
  const staff = { preHandler: requireStaff };

  async function access(req: FastifyRequest, clientId: string, action: string) {
    const client = await findAccessibleClient(db, req.user!, clientId);
    if (!client) throw notFound("client_not_found");
    await audit(db, { actorId: req.user!.id, targetUserId: clientId, action, ip: req.ip });
    return client;
  }

  app.get("/api/v1/clients/:id/overview", staff, async (req) => {
    const { id } = clientParam.parse(req.params);
    const { date } = targetQuerySchema.parse(req.query); // ngày hôm nay theo giờ địa phương của người xem
    const client = await access(req, id, "read:client_overview");
    const account = await db.selectFrom("users").select(["email", "phone", "status"]).where("id", "=", id).executeTakeFirstOrThrow();
    const profileRow = await db.selectFrom("profiles").select(["status", "package", "coachId"]).where("id", "=", id).executeTakeFirstOrThrow();
    const [profile, metrics, target, summary, recentCheckins] = await Promise.all([
      body.getProfile(id),
      body.listMetrics(id, addDays(date, -180), date),
      body.currentTarget(id, date),
      nutrition.summary(id, addDays(date, -13), date),
      checkins.list(id),
    ]);
    return {
      client: { id, fullName: client.fullName, ...account, clientStatus: profileRow.status, package: profileRow.package, coachId: profileRow.coachId },
      profile,
      metrics,
      target,
      summary,
      checkins: recentCheckins.slice(0, 8),
    };
  });

  app.get("/api/v1/clients/:id/food-log", staff, async (req) => {
    const { id } = clientParam.parse(req.params);
    const { date } = nutritionDateQuery.parse(req.query);
    await access(req, id, "read:client_food_log");
    return nutrition.listEntries(id, date);
  });

  app.get("/api/v1/clients/:id/workout-log", staff, async (req) => {
    const { id } = clientParam.parse(req.params);
    const { date } = workoutDateQuery.parse(req.query);
    await access(req, id, "read:client_workout_log");
    return { date, sets: await workout.listSets(id, date) };
  });

  app.get("/api/v1/clients/:id/body-metrics", staff, async (req) => {
    const { id } = clientParam.parse(req.params);
    const { from, to } = rangeQuerySchema.parse(req.query);
    await access(req, id, "read:client_body_metrics");
    return { metrics: await body.listMetrics(id, from, to) };
  });

  app.get("/api/v1/clients/:id/photos", staff, async (req) => {
    const { id } = clientParam.parse(req.params);
    await access(req, id, "read:client_photos");
    return { photos: await photos.list(id) };
  });

  app.get("/api/v1/clients/:id/photos/:photoId/file", staff, async (req, reply) => {
    const { id, photoId } = clientPhotoParam.parse(req.params);
    const { size } = fileQuerySchema.parse(req.query);
    await access(req, id, "read:client_photo_file");
    return sendPhoto(reply, await photos.file(id, photoId, size));
  });

  app.get("/api/v1/clients/:id/checkins", staff, async (req) => {
    const { id } = clientParam.parse(req.params);
    const { from, to } = rangeQuerySchema.parse(req.query);
    await access(req, id, "read:client_checkins");
    return { checkins: await checkins.list(id, from, to) };
  });

  app.put(
    "/api/v1/clients/:id/checkins/:weekStart/coach-note",
    { ...staff, config: { rateLimit: { max: Math.max(1, Math.round(120 * config.RATE_LIMIT_SCALE)), timeWindow: "1 hour" } } },
    async (req) => {
      const { id, weekStart } = clientWeekParam.parse(req.params);
      const { note } = coachNoteSchema.parse(req.body);
      await access(req, id, "write:client_checkin_note");
      return { checkin: await checkins.setCoachNote(req.user!.id, id, weekStart, note) };
    },
  );

  /** Coach/admin đặt mục tiêu dinh dưỡng cho học viên. */
  app.post("/api/v1/clients/:id/nutrition-targets", staff, async (req) => {
    const { id } = clientParam.parse(req.params);
    const { effectiveFrom, ...values } = setTargetSchema.parse(req.body);
    await access(req, id, "write:client_nutrition_target");
    await body.setTarget(id, req.user!.id, effectiveFrom, values);
    return body.currentTarget(id, effectiveFrom);
  });
}
