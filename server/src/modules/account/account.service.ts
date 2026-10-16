import type { Db } from "../../db/index.js";

/** Việc người dùng tự làm với dữ liệu của mình. Xoá tài khoản KHÔNG nằm ở đây: chỉ admin được xoá (admin.service). */
export function createAccountService(deps: { db: Db }) {
  const { db } = deps;

  return {
    /** Toàn bộ dữ liệu của chính người dùng, dạng JSON (quyền truy cập dữ liệu cá nhân). */
    async exportData(userId: string) {
      const [account, profile, metrics, targets, foodLog, workoutSets, checkins, photoList] = await Promise.all([
        db.selectFrom("users").select(["email", "phone", "role", "status", "createdAt", "lastLoginAt"]).where("id", "=", userId).executeTakeFirstOrThrow(),
        db.selectFrom("profiles").selectAll().where("id", "=", userId).executeTakeFirstOrThrow(),
        db.selectFrom("bodyMetrics").select(["measuredOn", "weightKg", "bodyFatPct", "waistCm", "note"]).where("userId", "=", userId).orderBy("measuredOn").execute(),
        db.selectFrom("nutritionTargets").select(["effectiveFrom", "kcal", "proteinG", "carbsG", "fatG"]).where("userId", "=", userId).orderBy("effectiveFrom").execute(),
        db.selectFrom("foodLogEntries").select(["loggedOn", "slot", "foodName", "grams", "kcal", "proteinG", "carbsG", "fatG"]).where("userId", "=", userId).orderBy("loggedOn").orderBy("id").execute(),
        db.selectFrom("workoutSets").select(["performedOn", "exerciseName", "reps", "weightKg"]).where("userId", "=", userId).orderBy("performedOn").orderBy("id").execute(),
        db.selectFrom("weeklyCheckins").select(["weekStart", "trained", "note", "coachNote"]).where("userId", "=", userId).orderBy("weekStart").execute(),
        db.selectFrom("progressPhotos").select(["takenOn", "angle", "createdAt"]).where("userId", "=", userId).orderBy("takenOn").execute(),
      ]);
      const { id: _id, avatarKey: _a, coachId: _c, ...profileData } = profile;
      return {
        exportedAt: new Date().toISOString(),
        account,
        profile: profileData,
        bodyMetrics: metrics,
        nutritionTargets: targets,
        foodLog,
        workoutSets,
        weeklyCheckins: checkins,
        photos: photoList, // chỉ siêu dữ liệu; tệp ảnh tải riêng từ trang Tiến độ
      };
    },
  };
}

export type AccountService = ReturnType<typeof createAccountService>;
