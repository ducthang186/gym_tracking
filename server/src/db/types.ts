import type { ColumnType, Generated } from "kysely";

// Kiểu bảng viết tay cho phần đã có migration. Khi schema lớn dần, sinh tự động bằng
// `kysely-codegen --camel-case` thay vì viết tay. Khoá dùng camelCase vì có CamelCasePlugin.

export type UserRole = "client" | "coach" | "admin";
export type AccountStatus = "pending" | "active" | "suspended";
export type ClientStatus = "active" | "paused" | "ended";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

/** Cột cho phép NULL và có thể bỏ qua khi insert. */
type Nullable<T> = ColumnType<T | null, T | null | undefined, T | null>;

export interface UsersTable {
  id: Generated<string>;
  email: string;
  phone: string;
  passwordHash: string;
  role: Generated<UserRole>;
  status: Generated<AccountStatus>;
  failedLogins: Generated<number>;
  lockedUntil: Nullable<Date>;
  lastLoginAt: Nullable<Date>;
  createdAt: Generated<Date>;
}

export interface ProfilesTable {
  id: string;
  fullName: string;
  avatarKey: Nullable<string>;
  gender: Nullable<"male" | "female" | "other">;
  birthDate: Nullable<string>; // date → 'YYYY-MM-DD'
  heightCm: Nullable<string>; // numeric → string
  targetWeightKg: Nullable<string>;
  activityLevel: Nullable<ActivityLevel>;
  timezone: Generated<string>;
  coachId: Nullable<string>;
  status: Generated<ClientStatus>;
  package: Nullable<string>;
  createdAt: Generated<Date>;
}

export interface RefreshTokensTable {
  id: Generated<string>;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Nullable<Date>;
  revokedAt: Nullable<Date>;
  userAgent: Nullable<string>;
  ip: Nullable<string>;
  createdAt: Generated<Date>;
}

export interface AuthTokensTable {
  id: Generated<string>;
  userId: string;
  type: "reset_password";
  tokenHash: string;
  expiresAt: Date;
  usedAt: Nullable<Date>;
  createdBy: Nullable<string>;
  createdAt: Generated<Date>;
}

export interface AuditLogTable {
  id: Generated<string>; // bigint → string
  actorId: Nullable<string>;
  targetUserId: Nullable<string>;
  action: string;
  meta: ColumnType<unknown, string | null | undefined, string | null>;
  ip: Nullable<string>;
  createdAt: Generated<Date>;
}

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

// numeric → string (pg trả chuỗi để không mất độ chính xác); repo đổi sang number khi trả ra ngoài.
export interface FoodsTable {
  id: Generated<string>;
  name: string;
  kcalPer100g: string;
  proteinPer100g: Generated<string>;
  carbsPer100g: Generated<string>;
  fatPer100g: Generated<string>;
  isArchived: Generated<boolean>;
  createdBy: Nullable<string>;
  createdAt: Generated<Date>;
}

export interface FoodLogEntriesTable {
  id: Generated<string>; // bigint → string
  userId: string;
  loggedOn: ColumnType<string, string, string>; // date: pg.types đặt để trả 'YYYY-MM-DD'
  slot: Generated<MealSlot>;
  foodId: Nullable<string>;
  foodName: string;
  grams: string;
  kcal: string;
  proteinG: Generated<string>;
  carbsG: Generated<string>;
  fatG: Generated<string>;
  clientRequestId: Nullable<string>;
  createdAt: Generated<Date>;
}

export interface BodyMetricsTable {
  id: Generated<string>;
  userId: string;
  measuredOn: string;
  weightKg: string;
  bodyFatPct: Nullable<string>;
  waistCm: Nullable<string>;
  note: Nullable<string>;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface NutritionTargetsTable {
  id: Generated<string>;
  userId: string;
  effectiveFrom: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  setBy: Nullable<string>;
  createdAt: Generated<Date>;
}

export interface WorkoutPlanDaysTable {
  weekday: number;
  name: string;
  updatedBy: Nullable<string>;
  updatedAt: Generated<Date>;
}

export interface WorkoutPlanItemsTable {
  id: Generated<string>;
  weekday: number;
  position: number;
  name: string;
  sets: Nullable<number>;
  reps: Nullable<string>;
}

export interface WorkoutSetsTable {
  id: Generated<string>;
  userId: string;
  performedOn: string;
  exerciseName: string;
  reps: number;
  weightKg: Generated<string>;
  clientRequestId: Nullable<string>;
  createdAt: Generated<Date>;
}

export interface SiteContentTable {
  key: "about";
  data: ColumnType<unknown, string, string>;
  updatedBy: Nullable<string>;
  updatedAt: Generated<Date>;
}

export interface SiteAssetsTable {
  key: "coach_photo";
  contentType: string;
  data: Buffer;
  updatedAt: Generated<Date>;
}

export type PhotoAngle = "front" | "side" | "back";

export interface ProgressPhotosTable {
  id: Generated<string>;
  userId: string;
  takenOn: string;
  angle: PhotoAngle;
  fullKey: string;
  thumbKey: string;
  bytes: number;
  createdAt: Generated<Date>;
}

export interface WeeklyCheckinsTable {
  id: Generated<string>;
  userId: string;
  weekStart: string;
  trained: boolean;
  note: Nullable<string>;
  coachNote: Nullable<string>;
  coachNoteBy: Nullable<string>;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface DB {
  users: UsersTable;
  profiles: ProfilesTable;
  refreshTokens: RefreshTokensTable;
  authTokens: AuthTokensTable;
  auditLog: AuditLogTable;
  foods: FoodsTable;
  foodLogEntries: FoodLogEntriesTable;
  bodyMetrics: BodyMetricsTable;
  nutritionTargets: NutritionTargetsTable;
  workoutPlanDays: WorkoutPlanDaysTable;
  workoutPlanItems: WorkoutPlanItemsTable;
  workoutSets: WorkoutSetsTable;
  siteContent: SiteContentTable;
  siteAssets: SiteAssetsTable;
  progressPhotos: ProgressPhotosTable;
  weeklyCheckins: WeeklyCheckinsTable;
}
