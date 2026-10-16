import { parseArgs } from "node:util";
import sharp from "sharp";
import { loadConfig, loadEnvFileIfPresent } from "../config/env.js";
import { createDb, type Db } from "../db/index.js";
import type { AccountStatus, ActivityLevel, ClientStatus, PhotoAngle } from "../db/types.js";
import { addDays, toDateStr } from "../lib/dates.js";
import { createStorage } from "../lib/storage.js";
import { insertUserWithProfile } from "../modules/auth/auth.repo.js";
import { normalizePhone } from "../modules/auth/phone.js";
import { createPasswordHasher } from "../modules/auth/password.js";
import { createBodyService } from "../modules/body/body.service.js";
import { createCheckinsService, mondayOf } from "../modules/checkins/checkins.service.js";
import { createNutritionService } from "../modules/nutrition/nutrition.service.js";
import { createPhotosService } from "../modules/photos/photos.service.js";
import { createWorkoutService } from "../modules/workout/workout.service.js";

// Dữ liệu MẪU để xem giao diện (học viên, check-in, lịch tập, cân nặng, ảnh, trạng thái tài khoản...).
//   npm run seed:demo            tạo (chạy lại nhiều lần được: xoá dữ liệu mẫu cũ rồi tạo mới)
//   npm run seed:demo -- --clean chỉ xoá dữ liệu mẫu
// Mọi tài khoản mẫu có email @demo.example.com nên không lẫn với tài khoản thật.

const DEMO_DOMAIN = "demo.example.com";
const PASSWORD = "Demo@12345";

const { values: args } = parseArgs({ options: { clean: { type: "boolean", default: false } } });

loadEnvFileIfPresent();
const config = loadConfig();
if (config.NODE_ENV === "production") {
  console.error("Từ chối chạy ở production: script này tạo dữ liệu giả.");
  process.exit(1);
}

const db: Db = createDb(config.DATABASE_URL);
const hasher = createPasswordHasher(config);
const storage = createStorage(config.STORAGE_DIR);
const body = createBodyService(db);
const nutrition = createNutritionService(db);
const workout = createWorkoutService(db);
const checkins = createCheckinsService(db);
const photos = createPhotosService(db, storage);

const TODAY = toDateStr(new Date());
const THIS_MONDAY = mondayOf(TODAY);

/** Số giả ngẫu nhiên xác định (cùng seed → cùng kết quả) để mỗi lần chạy ra cùng một bộ dữ liệu. */
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

// ---------------------------------------------------------------------------------------------

async function clean() {
  const rows = await db.selectFrom("users").select("id").where("email", "like", `%@${DEMO_DOMAIN}`).execute();
  for (const r of rows) await storage.removeDir(`photos/${r.id}`);
  await db.deleteFrom("users").where("email", "like", `%@${DEMO_DOMAIN}`).execute();
  return rows.length;
}

interface Client {
  key: string;
  fullName: string;
  phone: string;
  accountStatus: AccountStatus;
  clientStatus: ClientStatus;
  package: string;
  assignedToCoach: boolean;
  gender: "male" | "female";
  birthDate: string;
  heightCm: number;
  activity: ActivityLevel;
  startWeight: number;
  /** Thay đổi cân nặng mỗi tuần (kg). */
  weeklyDelta: number;
  targetWeight: number;
  /** Số tuần dữ liệu (tính từ hôm nay lùi lại) và tuần cuối còn hoạt động (0 = tuần này). */
  weeks: number;
  lastActiveWeeksAgo: number;
  /** Xác suất đi tập mỗi buổi theo giáo án. */
  trainRate: number;
  /** trained theo từng tuần, từ tuần cũ nhất → tuần này (true/false/null = không nộp). */
  checkins: Array<boolean | null>;
  notes: Record<number, string>; // theo "số tuần trước"
  coachNotes: Record<number, string>;
  photoWeeksAgo: Array<[number, PhotoAngle]>;
  kcalTarget: number | null; // null = để hệ thống gợi ý
  baseLift: number;
}

const CLIENTS: Client[] = [
  {
    key: "an", fullName: "Nguyễn Văn An", phone: "0900000101", accountStatus: "active", clientStatus: "active", package: "1:1 Personal Coaching", assignedToCoach: true,
    gender: "male", birthDate: "1996-03-12", heightCm: 175, activity: "moderate", startWeight: 82, weeklyDelta: -0.7, targetWeight: 74, weeks: 9, lastActiveWeeksAgo: 0, trainRate: 0.9,
    checkins: [true, true, true, true, true, false, true, true, true], notes: { 3: "Đi công tác 1 tuần nên nghỉ tập.", 0: "Tuần này khoẻ, tạ tăng đều." },
    coachNotes: { 3: "Không sao, tuần sau quay lại nhịp cũ nhé.", 1: "Cân nặng giảm đều, giữ vững kế hoạch ăn." },
    photoWeeksAgo: [[8, "front"], [8, "side"], [8, "back"], [4, "front"], [4, "side"], [0, "front"], [0, "side"], [0, "back"]], kcalTarget: 2200, baseLift: 60,
  },
  {
    key: "binh", fullName: "Trần Thị Bình", phone: "0900000102", accountStatus: "active", clientStatus: "active", package: "1:1 Personal Coaching", assignedToCoach: true,
    gender: "female", birthDate: "1999-08-25", heightCm: 162, activity: "light", startWeight: 52, weeklyDelta: 0.35, targetWeight: 56, weeks: 8, lastActiveWeeksAgo: 0, trainRate: 0.95,
    checkins: [true, true, true, true, true, true, true, true], notes: { 0: "Muốn tăng thêm khối lượng bài chân." },
    coachNotes: { 0: "Tuần sau mình thêm 1 buổi chân nhé." }, photoWeeksAgo: [[7, "front"], [3, "front"], [0, "front"]], kcalTarget: 2000, baseLift: 30,
  },
  {
    key: "cuong", fullName: "Lê Minh Cường", phone: "0900000103", accountStatus: "active", clientStatus: "active", package: "Starter", assignedToCoach: true,
    gender: "male", birthDate: "1990-11-02", heightCm: 170, activity: "sedentary", startWeight: 92, weeklyDelta: -0.1, targetWeight: 80, weeks: 8, lastActiveWeeksAgo: 0, trainRate: 0.35,
    checkins: [true, true, true, true, true, false, false, false], notes: { 0: "Bận dự án, đau lưng nên chưa tập được.", 1: "Công việc dồn, ăn uống thất thường." },
    coachNotes: {}, photoWeeksAgo: [[7, "front"], [7, "side"]], kcalTarget: null, baseLift: 40,
  },
  {
    key: "dung", fullName: "Phạm Hồng Dung", phone: "0900000104", accountStatus: "active", clientStatus: "paused", package: "Starter", assignedToCoach: true,
    gender: "female", birthDate: "1994-05-18", heightCm: 158, activity: "light", startWeight: 60, weeklyDelta: -0.15, targetWeight: 55, weeks: 7, lastActiveWeeksAgo: 5, trainRate: 0.7,
    checkins: [true, true, true, true, true, true, true, null, null, null, null, null], notes: { 5: "Em xin tạm dừng 1 tháng vì chuyển nhà." },
    coachNotes: { 5: "Ok em, khi nào ổn định thì báo chị nhé." }, photoWeeksAgo: [[11, "front"], [6, "front"]], kcalTarget: 1700, baseLift: 25,
  },
  {
    key: "em", fullName: "Đỗ Quang Em", phone: "0900000105", accountStatus: "pending", clientStatus: "active", package: "Starter", assignedToCoach: false,
    gender: "male", birthDate: "2001-01-30", heightCm: 178, activity: "moderate", startWeight: 70, weeklyDelta: 0, targetWeight: 70, weeks: 0, lastActiveWeeksAgo: 0, trainRate: 0,
    checkins: [], notes: {}, coachNotes: {}, photoWeeksAgo: [], kcalTarget: null, baseLift: 0,
  },
  {
    key: "phong", fullName: "Vũ Thanh Phong", phone: "0900000106", accountStatus: "suspended", clientStatus: "ended", package: "Starter", assignedToCoach: true,
    gender: "male", birthDate: "1988-09-09", heightCm: 172, activity: "light", startWeight: 88, weeklyDelta: -0.2, targetWeight: 80, weeks: 4, lastActiveWeeksAgo: 8, trainRate: 0.5,
    checkins: [true, true, false, false, null, null, null, null, null, null, null, null], notes: {}, coachNotes: {}, photoWeeksAgo: [], kcalTarget: 2300, baseLift: 45,
  },
];

async function createAccount(email: string, fullName: string, phone: string, role: "client" | "coach", status: AccountStatus) {
  const passwordHash = await hasher.hash(PASSWORD);
  const { id } = await db.transaction().execute((trx) => insertUserWithProfile(trx, { email, phone: normalizePhone(phone)!, passwordHash, fullName, status }));
  if (role !== "client") await db.updateTable("users").set({ role }).where("id", "=", id).execute();
  return id;
}

/** Ảnh giả: nền chuyển màu + hình người đơn giản + nhãn, để nhìn được "thay đổi" giữa các tuần. */
async function fakePhoto(label: string, tone: number): Promise<Buffer> {
  const w = 600, h = 800;
  const shade = Math.round(90 + tone * 90); // tone 0..1 → thân hình "to" dần/nhỏ dần cho dễ phân biệt
  const body = 70 + tone * 40;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e2a33"/><stop offset="1" stop-color="#050708"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <circle cx="300" cy="190" r="62" fill="rgb(${shade},${shade - 30},${shade - 45})"/>
    <path d="M${300 - body} 270 Q300 250 ${300 + body} 270 L${300 + body * 0.8} 560 L${300 - body * 0.8} 560 Z" fill="rgb(${shade - 10},${shade - 40},${shade - 55})"/>
    <rect x="${300 - body * 0.75}" y="560" width="${body * 0.6}" height="200" rx="14" fill="rgb(${shade - 25},${shade - 50},${shade - 65})"/>
    <rect x="${300 + body * 0.15}" y="560" width="${body * 0.6}" height="200" rx="14" fill="rgb(${shade - 25},${shade - 50},${shade - 65})"/>
    <text x="300" y="60" text-anchor="middle" font-family="Helvetica,Arial" font-size="30" font-weight="700" fill="#08d9ff">${label}</text>
    <text x="300" y="785" text-anchor="middle" font-family="Helvetica,Arial" font-size="20" fill="#8d9a9e">ẢNH MẪU</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

const ANGLE_LABEL: Record<PhotoAngle, string> = { front: "Góc trước", side: "Góc bên", back: "Góc sau" };

async function seedClient(c: Client, coachId: string, foodIds: string[], plan: Awaited<ReturnType<typeof workout.getPlan>>) {
  const id = await createAccount(`demo-${c.key}@${DEMO_DOMAIN}`, c.fullName, c.phone, "client", c.accountStatus);
  await db.updateTable("profiles").set({ package: c.package, status: c.clientStatus, coachId: c.assignedToCoach ? coachId : null }).where("id", "=", id).execute();
  if (c.weeks === 0) return { id, summary: "không có dữ liệu" };

  await body.updateProfile(id, { gender: c.gender, birthDate: c.birthDate, heightCm: c.heightCm, targetWeightKg: c.targetWeight, activityLevel: c.activity });
  const rand = rng(c.key.split("").reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7));
  const lastDay = addDays(TODAY, -c.lastActiveWeeksAgo * 7);
  const firstDay = addDays(lastDay, -(c.weeks - 1) * 7 - 2);

  // Cân nặng: ghi khoảng 3 lần/tuần, xu hướng tuyến tính + nhiễu nhỏ.
  let metrics = 0;
  for (let d = firstDay; d <= lastDay; d = addDays(d, 1)) {
    const daysIn = (Date.parse(d) - Date.parse(firstDay)) / 86_400_000;
    if (rand() > 0.45) continue;
    const kg = c.startWeight + (c.weeklyDelta * daysIn) / 7 + (rand() - 0.5) * 0.8;
    await body.upsertMetric(id, d, { weightKg: Math.round(kg * 10) / 10, ...(rand() > 0.6 ? { waistCm: Math.round((c.startWeight - 2 + (c.weeklyDelta * daysIn) / 14 + rand()) * 10) / 10 } : {}) });
    metrics++;
  }

  // Mục tiêu dinh dưỡng: coach đặt cho học viên có kcalTarget, còn lại để hệ thống gợi ý.
  if (c.kcalTarget) {
    const kcal = c.kcalTarget;
    await body.setTarget(id, coachId, addDays(firstDay, 0), { kcal, proteinG: Math.round((kcal * 0.28) / 4), carbsG: Math.round((kcal * 0.45) / 4), fatG: Math.round((kcal * 0.27) / 9) });
  }

  // Nhật ký ăn: 14 ngày cuối còn hoạt động, mỗi ngày 3–5 món.
  let foodEntries = 0;
  const slots = ["breakfast", "lunch", "dinner", "snack"] as const;
  for (let k = 0; k < 14; k++) {
    const day = addDays(lastDay, -k);
    if (day < firstDay || rand() < 0.12) continue;
    const n = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      await nutrition.createEntry(id, { loggedOn: day, slot: slots[Math.min(i, 3)]!, foodId: foodIds[Math.floor(rand() * foodIds.length)]!, grams: 60 + Math.floor(rand() * 20) * 10 });
      foodEntries++;
    }
  }

  // Lịch tập: theo giáo án từng ngày trong tuần, mỗi buổi đi với xác suất trainRate; tạ tăng dần theo tuần.
  let setsAdded = 0;
  for (let d = firstDay; d <= lastDay; d = addDays(d, 1)) {
    const weekday = ((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
    const day = plan.find((p) => p.weekday === weekday);
    if (!day || day.items.length === 0 || rand() > c.trainRate) continue;
    const weekIdx = Math.floor((Date.parse(d) - Date.parse(firstDay)) / (7 * 86_400_000));
    for (const item of day.items) {
      const nSets = item.sets ?? 1;
      const isCardio = item.sets === null;
      const base = c.baseLift * (0.6 + (item.name.length % 5) * 0.15) + weekIdx * 1.25;
      for (let s = 0; s < nSets; s++) {
        await workout.addSet(id, {
          performedOn: d,
          exerciseName: item.name,
          reps: isCardio ? 1 : Math.max(4, Number((item.reps ?? "8").split("-")[0]) - (s === nSets - 1 && rand() > 0.5 ? 1 : 0)),
          weightKg: isCardio ? 0 : Math.round((base / 2.5)) * 2.5,
        });
        setsAdded++;
      }
    }
  }

  // Check-in: một dòng mỗi tuần (trừ tuần "null"); phản hồi của coach ở vài tuần.
  let checkinCount = 0;
  for (const [i, trained] of c.checkins.entries()) {
    if (trained === null) continue;
    const ago = c.checkins.length - 1 - i; // phần tử cuối của mảng = tuần này
    const weekStart = addDays(THIS_MONDAY, -7 * ago);
    await checkins.upsert(id, weekStart, { trained, note: c.notes[ago] ?? null });
    if (c.coachNotes[ago]) await checkins.setCoachNote(coachId, id, weekStart, c.coachNotes[ago]!);
    checkinCount++;
  }

  // Ảnh tiến độ (tạo qua đúng luồng xử lý ảnh của hệ thống: WebP + thumbnail).
  for (const [ago, angle] of c.photoWeeksAgo) {
    const takenOn = addDays(THIS_MONDAY, -7 * ago);
    const progress = Math.min(1, Math.max(0, c.weeks > 1 ? 1 - (ago - c.lastActiveWeeksAgo) / (c.weeks - 1) : 1));
    const tone = c.weeklyDelta < 0 ? 1 - progress : progress; // giảm cân → "gầy" dần; tăng cân → "to" dần
    await photos.upload(id, { takenOn, angle, data: await fakePhoto(`${ago === 0 ? "Tuần này" : `${ago} tuần trước`} · ${ANGLE_LABEL[angle]}`, tone) });
  }

  return { id, summary: `${metrics} lần cân, ${foodEntries} món ăn, ${setsAdded} hiệp tập, ${checkinCount} check-in, ${c.photoWeeksAgo.length} ảnh` };
}

try {
  const removed = await clean();
  if (removed) console.log(`Đã xoá ${removed} tài khoản mẫu cũ.`);
  if (args.clean) process.exit(0);

  const coachId = await createAccount(`demo-coach@${DEMO_DOMAIN}`, "HLV Minh Tuấn", "0900000100", "coach", "active");
  const foodIds = (await db.selectFrom("foods").select("id").where("isArchived", "=", false).execute()).map((f) => f.id);
  if (foodIds.length === 0) throw new Error("Chưa có món ăn nào trong database — chạy migration trước.");
  const plan = await workout.getPlan();

  console.log("Đang tạo dữ liệu mẫu...");
  const rows: Array<[string, string, string, string]> = [["demo-coach", "HLV Minh Tuấn", "Huấn luyện viên", "—"]];
  for (const c of CLIENTS) {
    const r = await seedClient(c, coachId, foodIds, plan);
    rows.push([`demo-${c.key}`, c.fullName, `${{ active: "Hoạt động", pending: "Chờ duyệt", suspended: "Đã khoá" }[c.accountStatus]} / ${{ active: "đang tập", paused: "tạm dừng", ended: "kết thúc" }[c.clientStatus]}`, r.summary]);
  }

  console.log(`\nTài khoản mẫu (mật khẩu chung: ${PASSWORD})`);
  for (const [user, name, status, data] of rows) console.log(`  ${user}@${DEMO_DOMAIN}`.padEnd(34) + `${name.padEnd(18)} ${status.padEnd(26)} ${data}`);
  console.log("\nXoá dữ liệu mẫu:  npm run seed:demo -- --clean");
} finally {
  await db.destroy();
}
