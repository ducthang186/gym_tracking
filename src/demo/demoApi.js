// MÁY CHỦ GIẢ chạy trong trình duyệt, chỉ dùng cho bản demo (VITE_DEMO=true, ví dụ bản đưa lên Vercel).
// Mô phỏng các endpoint của API thật với dữ liệu mẫu rất ngắn để người xem thao tác thử mọi màn hình.
// Dữ liệu lưu trong localStorage của CHÍNH người xem (không gửi đi đâu), tự làm mới mỗi ngày.
// Công thức calo / gợi ý mục tiêu / kế hoạch ăn dùng lại đúng mã của server nên kết quả giống bản thật.

import { buildDayPlan } from "../../server/src/modules/nutrition/mealplan.ts";
import { suggestTargets } from "../../server/src/modules/body/calc.ts";
import { ApiError } from "../lib/api.js";
import { DEMO_PASSWORD } from "../lib/demo.js";
import { addDays, dateKey } from "../lib/dates.js";
import { normalizePhone } from "../lib/phone.js";
import { defaultAbout } from "../data/about.js";
import { foods as seedFoodList } from "../data/foods.js";

const DB_KEY = "latis_demo_db_v1";
const SESSION_KEY = "latis_demo_session_v1";
const MAX_BYTES = 5 * 1024 * 1024;

const uid = () => crypto.randomUUID();
const round1 = (n) => Math.round(n * 10) / 10;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (status, code, details) => new ApiError(status, code, details);

// ---------------------------------------------------------------------------------------------
// Dữ liệu mẫu (ngắn gọn)
// ---------------------------------------------------------------------------------------------

const FOODS = seedFoodList.map((f) => ({ id: f.id, name: f.name, kcalPer100g: f.kcal, proteinPer100g: f.protein, carbsPer100g: f.carbs, fatPer100g: f.fat }));

const PLAN = [
  [1, "Ngực + Tay sau", [["Bench Press", 4, "8"], ["Incline Dumbbell Press", 3, "10"], ["Tricep Pushdown", 3, "12"]]],
  [2, "Lưng + Tay trước", [["Deadlift", 4, "6"], ["Lat Pulldown", 3, "10"], ["Barbell Curl", 3, "12"]]],
  [3, "Nghỉ / Cardio nhẹ", [["Đi bộ nhanh 30 phút", null, null]]],
  [4, "Vai", [["Overhead Press", 4, "8"], ["Lateral Raise", 3, "15"]]],
  [5, "Chân", [["Squat", 4, "8"], ["Leg Press", 3, "10"]]],
  [6, "Full body nhẹ", [["Circuit training 20 phút", null, null]]],
  [7, "Nghỉ ngơi", []],
].map(([weekday, name, items]) => ({ weekday, name, items: items.map(([n, sets, reps]) => ({ name: n, sets, reps })) }));

const weekdayOf = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return ((new Date(y, m - 1, d).getDay() + 6) % 7) + 1; // 1 = Thứ 2
};
const mondayOf = (key) => addDays(key, -(weekdayOf(key) - 1));

function buildSeed() {
  const today = dateKey();
  const ago = (n) => addDays(today, -n);
  const mk = (id, email, phone, fullName, role, status = "active") => ({ id, email, phone, fullName, role, status, password: DEMO_PASSWORD, createdAt: `${ago(60)}T08:00:00.000Z`, lastLoginAt: null });

  const users = [
    mk("u-admin", "demo-admin@demo.example.com", "+84900000001", "Trung Phạm", "admin"),
    mk("u-coach", "demo-coach@demo.example.com", "+84900000100", "HLV Minh Tuấn", "coach"),
    mk("u-an", "demo-an@demo.example.com", "+84900000101", "Nguyễn Văn An", "client"),
    mk("u-binh", "demo-binh@demo.example.com", "+84900000102", "Trần Thị Bình", "client"),
    mk("u-cuong", "demo-cuong@demo.example.com", "+84900000103", "Lê Minh Cường", "client"),
    mk("u-em", "demo-em@demo.example.com", "+84900000105", "Đỗ Quang Em", "client", "pending"),
  ];

  const prof = (extra) => ({ gender: null, birthDate: null, heightCm: null, targetWeightKg: null, activityLevel: null, coachId: null, package: null, clientStatus: "active", ...extra });
  const profiles = {
    "u-admin": prof({}),
    "u-coach": prof({}),
    "u-an": prof({ gender: "male", birthDate: "1996-03-12", heightCm: 175, targetWeightKg: 74, activityLevel: "moderate", coachId: "u-coach", package: "1:1 Personal Coaching" }),
    "u-binh": prof({ gender: "female", birthDate: "1999-08-25", heightCm: 162, targetWeightKg: 56, activityLevel: "light", coachId: "u-coach", package: "1:1 Personal Coaching" }),
    "u-cuong": prof({ gender: "male", birthDate: "1990-11-02", heightCm: 170, targetWeightKg: 80, activityLevel: "sedentary", coachId: "u-coach", package: "Starter" }),
    "u-em": prof({ package: "Starter" }),
  };

  const series = (start, step, n, waist) => Array.from({ length: n }, (_, i) => ({ date: ago((n - 1 - i) * 7), weightKg: round1(start + step * i), bodyFatPct: null, waistCm: waist ? round1(waist + step * i * 0.8) : null, note: null }));
  const metrics = { "u-an": series(82, -0.8, 6, 90), "u-binh": series(52.5, 0.35, 6, null), "u-cuong": series(92, -0.2, 4, null), "u-coach": [], "u-admin": [], "u-em": [] };

  const targets = {
    "u-an": [{ effectiveFrom: ago(35), kcal: 2200, proteinG: 154, carbsG: 248, fatG: 61 }],
    "u-binh": [{ effectiveFrom: ago(35), kcal: 2000, proteinG: 140, carbsG: 225, fatG: 56 }],
  };

  const foodLog = [];
  const addFood = (userId, day, slot, foodIdx, grams) => {
    const f = FOODS[foodIdx];
    const r = grams / 100;
    foodLog.push({ id: uid(), userId, loggedOn: day, slot, foodId: f.id, foodName: f.name, grams, kcal: round1(f.kcalPer100g * r), proteinG: round1(f.proteinPer100g * r), carbsG: round1(f.carbsPer100g * r), fatG: round1(f.fatPer100g * r) });
  };
  for (const [u, k] of [["u-an", 0], ["u-binh", 1], ["u-cuong", 2]]) {
    for (const d of u === "u-cuong" ? [3, 2] : [0, 1, 2]) {
      addFood(u, ago(d), "breakfast", (k + d) % 10 + 8, 60);
      addFood(u, ago(d), "lunch", (k + d) % 5, 150);
      addFood(u, ago(d), "dinner", (k + d + 2) % 6 + 2, 140);
    }
  }

  const workoutSets = [];
  for (const [u, days, base] of [["u-an", [0, 1, 2, 4, 5], 60], ["u-binh", [0, 2, 3], 30]]) {
    for (const d of days) {
      const day = PLAN.find((p) => p.weekday === weekdayOf(ago(d)));
      const item = day?.items.find((i) => i.sets);
      if (!item) continue;
      for (let s = 0; s < item.sets; s++) workoutSets.push({ id: uid(), userId: u, performedOn: ago(d), exerciseName: item.name, reps: Number(item.reps), weightKg: base + (5 - d) * 1.25 });
    }
  }

  const wk = (n) => mondayOf(ago(n * 7));
  const ck = (userId, weekStart, trained, note = null, coachNote = null) => ({ userId, weekStart, trained, note, coachNote });
  const checkins = [
    ck("u-an", wk(3), true), ck("u-an", wk(2), false, "Đi công tác nên nghỉ tập.", "Không sao, tuần sau quay lại nhịp cũ nhé."), ck("u-an", wk(1), true), ck("u-an", wk(0), true, "Tuần này khoẻ, tạ tăng đều."),
    ck("u-binh", wk(2), true), ck("u-binh", wk(1), true), ck("u-binh", wk(0), true, "Muốn tăng thêm khối lượng bài chân.", "Tuần sau mình thêm 1 buổi chân nhé."),
    ck("u-cuong", wk(2), true), ck("u-cuong", wk(1), false, "Công việc dồn, ăn uống thất thường."), ck("u-cuong", wk(0), false, "Bận dự án, đau lưng nên chưa tập được."),
  ];

  const photos = [
    { id: uid(), userId: "u-an", takenOn: wk(4), angle: "front", tone: 1 }, { id: uid(), userId: "u-an", takenOn: wk(0), angle: "front", tone: 0.15 },
    { id: uid(), userId: "u-an", takenOn: wk(4), angle: "side", tone: 1 }, { id: uid(), userId: "u-an", takenOn: wk(0), angle: "side", tone: 0.15 },
    { id: uid(), userId: "u-binh", takenOn: wk(0), angle: "front", tone: 0.6 },
  ];

  return { seedDate: today, users, profiles, metrics, targets, foods: FOODS.map((f) => ({ ...f })), plan: PLAN, foodLog, workoutSets, checkins, photos, about: { ...defaultAbout } };
}

// ---------------------------------------------------------------------------------------------
// Lưu trữ
// ---------------------------------------------------------------------------------------------

let db = null;
const blobs = new Map(); // ảnh người xem tự tải lên (chỉ trong bộ nhớ)
let coachPhotoUrl = null;

function load() {
  if (db) return db;
  try {
    const raw = JSON.parse(localStorage.getItem(DB_KEY) ?? "null");
    if (raw && raw.seedDate === dateKey()) db = raw; // sang ngày mới thì dựng lại để "hôm nay" luôn có dữ liệu
  } catch {
    // localStorage hỏng / bị chặn: dùng dữ liệu trong bộ nhớ
  }
  db ??= buildSeed();
  return db;
}
function save() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // hết dung lượng / bị chặn: bỏ qua, phiên hiện tại vẫn chạy bằng bộ nhớ
  }
}
export function resetDemo() {
  try {
    localStorage.removeItem(DB_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // bỏ qua
  }
  db = null;
}

const getSession = () => {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
};
const setSession = (id) => {
  try {
    if (id) localStorage.setItem(SESSION_KEY, id);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // bỏ qua
  }
};

// ---------------------------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------------------------

const publicUser = (u) => ({ id: u.id, email: u.email, phone: u.phone, fullName: u.fullName, role: u.role, status: u.status, createdAt: u.createdAt });
const byId = (id) => load().users.find((u) => u.id === id);
const isStaff = (u) => u.role === "admin" || u.role === "coach";
const latestMetric = (id, onOrBefore = "9999") => [...(load().metrics[id] ?? [])].filter((m) => m.date <= onOrBefore).sort((a, b) => b.date.localeCompare(a.date))[0];

function me() {
  const user = byId(getSession());
  if (!user || user.status !== "active") throw fail(401, "missing_token");
  return user;
}
function needStaff() {
  const u = me();
  if (!isStaff(u)) throw fail(403, "forbidden");
  return u;
}
function needAdmin() {
  const u = me();
  if (u.role !== "admin") throw fail(403, "forbidden");
  return u;
}
/** Học viên mà `actor` được phép xem (admin: tất cả; coach: học viên của mình); ngoài phạm vi → 404. */
function accessibleClient(actor, id) {
  const c = byId(id);
  if (!c || c.role !== "client" || !isStaff(actor) || (actor.role === "coach" && load().profiles[id].coachId !== actor.id)) throw fail(404, "client_not_found");
  return c;
}

const ageOn = (birth, on) => {
  const [by, bm, bd] = birth.split("-").map(Number);
  const [y, m, d] = on.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
};

function currentTarget(userId, date) {
  const d = load();
  const row = (d.targets[userId] ?? []).filter((t) => t.effectiveFrom <= date).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  const p = d.profiles[userId];
  const w = latestMetric(userId, date);
  const s = suggestTargets({
    gender: p.gender, age: p.birthDate ? ageOn(p.birthDate, date) : null, heightCm: p.heightCm,
    weightKg: w?.weightKg ?? null, targetWeightKg: p.targetWeightKg, activityLevel: p.activityLevel,
  });
  return {
    target: row ?? null,
    suggestion: s.ok ? { goal: s.goal, bmr: s.bmr, tdee: s.tdee, ...s.target } : null,
    missing: s.ok ? [] : s.missing,
    bmi: w && p.heightCm ? round1(w.weightKg / (p.heightCm / 100) ** 2) : null,
  };
}

const sum = (list, k) => round1(list.reduce((a, e) => a + e[k], 0));
const entryOut = ({ userId, ...e }) => e;
const totalsOf = (list) => ({ kcal: sum(list, "kcal"), proteinG: sum(list, "proteinG"), carbsG: sum(list, "carbsG"), fatG: sum(list, "fatG") });

function summary(userId, from, to) {
  const d = load();
  const days = new Map();
  const get = (date) => days.get(date) ?? days.set(date, { date, kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, workoutSets: 0 }).get(date);
  for (const e of d.foodLog.filter((x) => x.userId === userId && x.loggedOn >= from && x.loggedOn <= to)) {
    const r = get(e.loggedOn);
    r.kcal = round1(r.kcal + e.kcal); r.proteinG = round1(r.proteinG + e.proteinG); r.carbsG = round1(r.carbsG + e.carbsG); r.fatG = round1(r.fatG + e.fatG);
  }
  for (const s of d.workoutSets.filter((x) => x.userId === userId && x.performedOn >= from && x.performedOn <= to)) get(s.performedOn).workoutSets++;
  return { from, to, days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

function userRow(u) {
  const d = load();
  const p = d.profiles[u.id];
  return {
    id: u.id, email: u.email, phone: u.phone, fullName: u.fullName, role: u.role, status: u.status,
    clientStatus: p.clientStatus, package: p.package, coachId: p.coachId, coachName: p.coachId ? byId(p.coachId)?.fullName ?? null : null,
    latestWeightKg: latestMetric(u.id)?.weightKg ?? null, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt,
  };
}

/** Ảnh giả vẽ bằng SVG: hình người đơn giản, "to/nhỏ" theo tone để thấy thay đổi khi so sánh. */
function fakePhotoBlob(photo, size) {
  const shade = Math.round(90 + photo.tone * 90);
  const body = 70 + photo.tone * 40;
  const label = `${photo.takenOn.slice(8)}/${photo.takenOn.slice(5, 7)}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="${size === "thumb" ? 300 : 600}" height="${size === "thumb" ? 400 : 800}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e2a33"/><stop offset="1" stop-color="#050708"/></linearGradient></defs>
    <rect width="600" height="800" fill="url(#g)"/>
    <circle cx="300" cy="190" r="62" fill="rgb(${shade},${shade - 30},${shade - 45})"/>
    <path d="M${300 - body} 270 Q300 250 ${300 + body} 270 L${300 + body * 0.8} 560 L${300 - body * 0.8} 560 Z" fill="rgb(${shade - 10},${shade - 40},${shade - 55})"/>
    <rect x="${300 - body * 0.75}" y="560" width="${body * 0.6}" height="200" rx="14" fill="rgb(${shade - 25},${shade - 50},${shade - 65})"/>
    <rect x="${300 + body * 0.15}" y="560" width="${body * 0.6}" height="200" rx="14" fill="rgb(${shade - 25},${shade - 50},${shade - 65})"/>
    <text x="300" y="60" text-anchor="middle" font-family="Arial" font-size="32" font-weight="700" fill="#08d9ff">${label}</text>
    <text x="300" y="785" text-anchor="middle" font-family="Arial" font-size="20" fill="#8d9a9e">ẢNH MẪU</text></svg>`;
  return new Blob([svg], { type: "image/svg+xml" });
}

const photoOut = ({ userId, tone, ...p }) => ({ ...p, createdAt: `${p.takenOn}T08:00:00.000Z` });

// ---------------------------------------------------------------------------------------------
// Bảng định tuyến
// ---------------------------------------------------------------------------------------------

const routes = [];
const route = (method, pattern, handler) => routes.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)")}$`), handler });

const need = (cond, code = "validation_error") => {
  if (!cond) throw fail(400, code, code === "validation_error" ? { fields: [{ field: "", code: "invalid" }] } : undefined);
};

// ----- xác thực -----
const session = (u) => ({ user: publicUser(u), accessToken: `demo-${u.id}`, expiresIn: 900 });

route("POST", "/auth/login", ({ body }) => {
  const d = load();
  const id = String(body.identifier ?? "").trim();
  const phone = id.includes("@") ? null : normalizePhone(id);
  const u = d.users.find((x) => (phone ? x.phone === phone : x.email === id.toLowerCase()));
  if (!u || u.password !== body.password) throw fail(401, "invalid_credentials");
  if (u.status === "pending") throw fail(403, "account_pending");
  if (u.status === "suspended") throw fail(403, "account_suspended");
  u.lastLoginAt = new Date().toISOString();
  setSession(u.id);
  save();
  return session(u);
});

route("POST", "/auth/register", ({ body }) => {
  const d = load();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = normalizePhone(body.phone);
  if (!phone) throw fail(400, "validation_error", { fields: [{ field: "phone", code: "invalid_phone" }] });
  const fields = [];
  if (d.users.some((u) => u.email === email)) fields.push("email");
  if (d.users.some((u) => u.phone === phone)) fields.push("phone");
  if (fields.length) throw fail(409, `${fields[0]}_taken`, { fields });
  const u = { id: uid(), email, phone, fullName: String(body.fullName ?? "").trim(), role: "client", status: "active", password: body.password, createdAt: new Date().toISOString(), lastLoginAt: null };
  d.users.push(u);
  d.profiles[u.id] = { gender: null, birthDate: null, heightCm: null, targetWeightKg: null, activityLevel: null, coachId: null, package: null, clientStatus: "active" };
  d.metrics[u.id] = [];
  setSession(u.id);
  save();
  return session(u);
});

route("POST", "/auth/refresh", () => {
  const u = byId(getSession());
  if (!u || u.status !== "active") throw fail(401, "no_refresh_cookie");
  return session(u);
});

route("POST", "/auth/logout", () => {
  setSession(null);
  return null;
});

route("POST", "/auth/change-password", ({ body }) => {
  const u = me();
  if (body.currentPassword !== u.password) throw fail(400, "invalid_current_password");
  if (body.currentPassword === body.newPassword) throw fail(400, "same_password");
  need(String(body.newPassword ?? "").length >= 8);
  u.password = body.newPassword;
  save();
  return { accessToken: `demo-${u.id}`, expiresIn: 900 };
});

route("POST", "/auth/reset-password", ({ body }) => {
  const entry = (load().resetTokens ??= {})[body.token];
  if (!entry || entry.expiresAt < Date.now()) throw fail(400, "invalid_or_expired_token");
  need(String(body.newPassword ?? "").length >= 8);
  const u = byId(entry.userId);
  if (u) u.password = body.newPassword;
  delete load().resetTokens[body.token];
  save();
  return null;
});

route("GET", "/me", () => ({ user: publicUser(me()) }));

route("GET", "/me/export", () => {
  const u = me();
  const d = load();
  return {
    exportedAt: new Date().toISOString(), account: publicUser(u), profile: d.profiles[u.id], bodyMetrics: d.metrics[u.id] ?? [], nutritionTargets: d.targets[u.id] ?? [],
    foodLog: d.foodLog.filter((e) => e.userId === u.id).map(entryOut), workoutSets: d.workoutSets.filter((s) => s.userId === u.id), weeklyCheckins: d.checkins.filter((c) => c.userId === u.id), photos: d.photos.filter((p) => p.userId === u.id).map(photoOut),
  };
});

// ----- hồ sơ, cân nặng, mục tiêu -----
route("GET", "/me/profile", () => {
  const { coachId, package: _p, clientStatus, ...profile } = load().profiles[me().id];
  return { profile };
});
route("PATCH", "/me/profile", ({ body }) => {
  const u = me();
  const p = load().profiles[u.id];
  for (const k of ["gender", "birthDate", "heightCm", "targetWeightKg", "activityLevel"]) if (k in body) p[k] = body[k];
  save();
  const { coachId, package: _p, clientStatus, ...profile } = p;
  return { profile };
});

route("GET", "/body-metrics", ({ query }) => {
  const u = me();
  const to = query.get("to") ?? addDays(dateKey(), 1);
  const from = query.get("from") ?? addDays(to, -180);
  return { metrics: [...(load().metrics[u.id] ?? [])].filter((m) => m.date >= from && m.date <= to).sort((a, b) => a.date.localeCompare(b.date)) };
});
route("PUT", "/body-metrics/:date", ({ params, body }) => {
  const u = me();
  need(params.date <= addDays(dateKey(), 1), "validation_error");
  need(typeof body.weightKg === "number" && body.weightKg >= 20 && body.weightKg <= 400);
  const list = (load().metrics[u.id] ??= []);
  const metric = { date: params.date, weightKg: body.weightKg, bodyFatPct: body.bodyFatPct ?? null, waistCm: body.waistCm ?? null, note: body.note || null };
  const i = list.findIndex((m) => m.date === params.date);
  if (i >= 0) list[i] = metric;
  else list.push(metric);
  save();
  return { metric };
});
route("DELETE", "/body-metrics/:date", ({ params }) => {
  const u = me();
  const list = load().metrics[u.id] ?? [];
  const i = list.findIndex((m) => m.date === params.date);
  if (i < 0) throw fail(404, "metric_not_found");
  list.splice(i, 1);
  save();
  return null;
});

route("GET", "/nutrition-targets/current", ({ query }) => currentTarget(me().id, query.get("date")));
route("PUT", "/nutrition-targets", ({ body }) => {
  const u = me();
  const { effectiveFrom, ...v } = body;
  need(v.kcal >= 800 && v.kcal <= 6000);
  const list = (load().targets[u.id] ??= []).filter((t) => t.effectiveFrom !== effectiveFrom);
  list.push({ effectiveFrom, kcal: v.kcal, proteinG: v.proteinG, carbsG: v.carbsG, fatG: v.fatG });
  load().targets[u.id] = list;
  save();
  return currentTarget(u.id, effectiveFrom);
});

// ----- món ăn & nhật ký ăn -----
route("GET", "/foods", ({ query }) => {
  me();
  const q = (query.get("q") ?? "").toLowerCase();
  return { foods: load().foods.filter((f) => f.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name, "vi")) };
});
route("POST", "/foods", ({ body }) => {
  needStaff();
  const d = load();
  const name = String(body.name ?? "").trim();
  need(name && body.kcalPer100g >= 0 && body.kcalPer100g <= 1000);
  if (d.foods.some((f) => f.name.toLowerCase() === name.toLowerCase())) throw fail(409, "food_exists");
  const food = { id: uid(), name, kcalPer100g: body.kcalPer100g, proteinPer100g: body.proteinPer100g ?? 0, carbsPer100g: body.carbsPer100g ?? 0, fatPer100g: body.fatPer100g ?? 0 };
  d.foods.push(food);
  save();
  return { food };
});
route("DELETE", "/foods/:id", ({ params }) => {
  needStaff();
  const d = load();
  const i = d.foods.findIndex((f) => f.id === params.id);
  if (i < 0) throw fail(404, "food_not_found");
  d.foods.splice(i, 1); // xoá mềm trên server thật; nhật ký cũ giữ nguyên vì đã chép tên/giá trị
  save();
  return null;
});

route("GET", "/food-log/summary", ({ query }) => summary(me().id, query.get("from"), query.get("to")));
route("GET", "/food-log", ({ query }) => {
  const u = me();
  const date = query.get("date");
  const entries = load().foodLog.filter((e) => e.userId === u.id && e.loggedOn === date).map(entryOut);
  return { date, entries, totals: totalsOf(entries) };
});
route("POST", "/food-log", ({ body }) => {
  const u = me();
  const d = load();
  need(body.grams > 0 && body.grams <= 5000);
  let name, per, foodId = null;
  if (body.foodId) {
    const f = d.foods.find((x) => x.id === body.foodId);
    if (!f) throw fail(404, "food_not_found");
    name = f.name; foodId = f.id; per = f;
  } else {
    need(body.custom && body.custom.kcalPer100g >= 0);
    name = body.custom.name || "Món tự nhập"; per = { kcalPer100g: body.custom.kcalPer100g, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0 };
  }
  const r = body.grams / 100;
  const entry = { id: uid(), userId: u.id, loggedOn: body.loggedOn, slot: body.slot ?? "snack", foodId, foodName: name, grams: body.grams, kcal: round1(per.kcalPer100g * r), proteinG: round1(per.proteinPer100g * r), carbsG: round1(per.carbsPer100g * r), fatG: round1(per.fatPer100g * r) };
  d.foodLog.push(entry);
  save();
  return { entry: entryOut(entry) };
});
route("DELETE", "/food-log/:id", ({ params }) => {
  const u = me();
  const d = load();
  const i = d.foodLog.findIndex((e) => e.id === params.id && e.userId === u.id);
  if (i < 0) throw fail(404, "entry_not_found");
  d.foodLog.splice(i, 1);
  save();
  return null;
});

route("GET", "/meal-plan/suggest", ({ query }) => {
  me();
  const kcal = Number(query.get("kcal"));
  const day = Number(query.get("day") ?? 0);
  const variant = Number(query.get("variant") ?? 0);
  need(kcal >= 800 && kcal <= 6000);
  return { day, variant, plan: buildDayPlan(load().foods, kcal, day, variant) };
});

// ----- lịch tập -----
route("GET", "/workout-plan", () => {
  me();
  return { days: load().plan };
});
route("PUT", "/workout-plan/:weekday", ({ params, body }) => {
  needStaff();
  const d = load();
  const day = d.plan.find((p) => p.weekday === Number(params.weekday));
  if (!day) throw fail(404, "day_not_found");
  need(String(body.name ?? "").trim() && Array.isArray(body.items) && body.items.length <= 30);
  day.name = body.name.trim();
  day.items = body.items.map((i) => ({ name: i.name, sets: i.sets ?? null, reps: i.reps || null }));
  save();
  return { day };
});

route("GET", "/workout-log/history", ({ query }) => {
  const u = me();
  const name = query.get("exercise");
  const sets = load().workoutSets.filter((s) => s.userId === u.id && s.exerciseName === name).sort((a, b) => b.performedOn.localeCompare(a.performedOn));
  return { sets: sets.slice(0, 30) };
});
route("GET", "/workout-log", ({ query }) => {
  const u = me();
  const date = query.get("date");
  return { date, sets: load().workoutSets.filter((s) => s.userId === u.id && s.performedOn === date) };
});
route("POST", "/workout-log", ({ body }) => {
  const u = me();
  need(body.reps >= 1 && body.reps <= 500 && (body.weightKg ?? 0) >= 0);
  const set = { id: uid(), userId: u.id, performedOn: body.performedOn, exerciseName: body.exerciseName, reps: body.reps, weightKg: body.weightKg ?? 0 };
  load().workoutSets.push(set);
  save();
  return { set };
});
route("DELETE", "/workout-log/:id", ({ params }) => {
  const u = me();
  const d = load();
  const i = d.workoutSets.findIndex((s) => s.id === params.id && s.userId === u.id);
  if (i < 0) throw fail(404, "set_not_found");
  d.workoutSets.splice(i, 1);
  save();
  return null;
});

// ----- check-in & ảnh -----
const checkinOut = ({ userId, ...c }) => c;
route("GET", "/checkins", ({ query }) => {
  const u = me();
  const to = query.get("to") ?? addDays(dateKey(), 1);
  const from = query.get("from") ?? addDays(to, -182);
  return { checkins: load().checkins.filter((c) => c.userId === u.id && c.weekStart >= from && c.weekStart <= to).sort((a, b) => b.weekStart.localeCompare(a.weekStart)).map(checkinOut) };
});
route("PUT", "/checkins/:weekStart", ({ params, body }) => {
  const u = me();
  need(typeof body.trained === "boolean");
  need(mondayOf(params.weekStart) === params.weekStart);
  const list = load().checkins;
  const existing = list.find((c) => c.userId === u.id && c.weekStart === params.weekStart);
  if (existing) Object.assign(existing, { trained: body.trained, note: body.note || null });
  else list.push({ userId: u.id, weekStart: params.weekStart, trained: body.trained, note: body.note || null, coachNote: null });
  save();
  return { checkin: checkinOut(list.find((c) => c.userId === u.id && c.weekStart === params.weekStart)) };
});

route("GET", "/photos", () => ({ photos: load().photos.filter((p) => p.userId === me().id).sort((a, b) => b.takenOn.localeCompare(a.takenOn)).map(photoOut) }));
route("POST", "/photos", ({ body }) => {
  const u = me();
  const file = body instanceof FormData ? body.get("photo") : null;
  if (!file || !String(file.type).startsWith("image/")) throw fail(400, "invalid_image");
  if (file.size > MAX_BYTES) throw fail(413, "file_too_large");
  const angle = body.get("angle");
  need(["front", "side", "back"].includes(angle) && /^\d{4}-\d{2}-\d{2}$/.test(body.get("takenOn")));
  const photo = { id: uid(), userId: u.id, takenOn: body.get("takenOn"), angle, tone: 0.5 };
  blobs.set(photo.id, file);
  load().photos.push(photo);
  save();
  return { photo: photoOut(photo) };
});
const photoFile = (ownerId, photoId, size) => {
  const p = load().photos.find((x) => x.id === photoId && x.userId === ownerId);
  if (!p) throw fail(404, "photo_not_found");
  return blobs.get(p.id) ?? fakePhotoBlob(p, size);
};
route("GET", "/photos/:photoId/file", ({ params, query }) => photoFile(me().id, params.photoId, query.get("size")));
route("DELETE", "/photos/:photoId", ({ params }) => {
  const u = me();
  const d = load();
  const i = d.photos.findIndex((p) => p.id === params.photoId && p.userId === u.id);
  if (i < 0) throw fail(404, "photo_not_found");
  blobs.delete(d.photos[i].id);
  d.photos.splice(i, 1);
  save();
  return null;
});

// ----- trang giới thiệu -----
route("GET", "/public/about", () => ({ about: load().about }));
route("PUT", "/admin/about", ({ body }) => {
  needAdmin();
  need(String(body.name ?? "").trim() && String(body.bio ?? "").trim() && body.bio.length <= 1500);
  const d = load();
  d.about = { ...body, photoVersion: d.about.photoVersion };
  save();
  return { about: d.about };
});
route("POST", "/admin/about/photo", ({ body }) => {
  needAdmin();
  const file = body instanceof FormData ? body.get("photo") : null;
  if (!file || !String(file.type).startsWith("image/")) throw fail(400, "invalid_image");
  if (file.size > MAX_BYTES) throw fail(413, "file_too_large");
  if (coachPhotoUrl) URL.revokeObjectURL(coachPhotoUrl);
  coachPhotoUrl = URL.createObjectURL(file);
  globalThis.__latisDemoCoachPhoto = coachPhotoUrl;
  load().about.photoVersion = Date.now();
  save();
  return { about: load().about };
});
route("DELETE", "/admin/about/photo", () => {
  needAdmin();
  coachPhotoUrl = null;
  globalThis.__latisDemoCoachPhoto = null;
  load().about.photoVersion = null;
  save();
  return null;
});

// ----- quản trị -----
route("GET", "/admin/users", ({ query }) => {
  const actor = needStaff();
  const d = load();
  const q = (query.get("q") ?? "").trim().toLowerCase();
  const digits = q.replace(/\D/g, "").replace(/^(0|84)/, "");
  const status = query.get("status");
  const role = query.get("role");
  let list = d.users.filter((u) => (actor.role === "admin" ? true : u.role === "client" && d.profiles[u.id].coachId === actor.id));
  if (status) list = list.filter((u) => u.status === status);
  if (role) list = list.filter((u) => u.role === role);
  if (q) list = list.filter((u) => u.fullName.toLowerCase().includes(q) || u.email.includes(q) || (digits.length >= 3 && u.phone.includes(digits)));
  list.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.fullName.localeCompare(b.fullName, "vi"));
  const limit = Number(query.get("limit") ?? 50);
  const offset = Number(query.get("offset") ?? 0);
  return { users: list.slice(offset, offset + limit).map(userRow), total: list.length };
});

route("GET", "/admin/stats", () => {
  const actor = needStaff();
  const d = load();
  const list = d.users.filter((u) => (actor.role === "admin" ? true : u.role === "client" && d.profiles[u.id].coachId === actor.id));
  const count = (s) => list.filter((u) => u.status === s).length;
  return { users: { total: list.length, active: count("active"), pending: count("pending"), suspended: count("suspended") }, foods: d.foods.length, workoutDays: d.plan.filter((p) => p.items.length).length };
});

route("GET", "/admin/coaches", () => {
  needStaff();
  return { coaches: load().users.filter((u) => (u.role === "coach" || u.role === "admin") && u.status === "active").map((u) => ({ id: u.id, fullName: u.fullName })) };
});

const resetLink = (userId) => {
  const token = `demo-${uid()}${uid()}`.replace(/-/g, "");
  const expiresAt = Date.now() + 24 * 3_600_000;
  (load().resetTokens ??= {})[token] = { userId, expiresAt };
  save();
  return { token, expiresAt: new Date(expiresAt).toISOString() };
};

route("POST", "/admin/users/:id/reset-link", ({ params }) => {
  const actor = needStaff();
  if (actor.role === "coach") accessibleClient(actor, params.id);
  else if (!byId(params.id)) throw fail(404, "user_not_found");
  return { resetLink: resetLink(params.id) };
});

route("POST", "/admin/users", ({ body }) => {
  needAdmin();
  const d = load();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = normalizePhone(body.phone);
  need(phone && String(body.fullName ?? "").trim().length >= 2);
  if (d.users.some((u) => u.email === email)) throw fail(409, "email_taken", { fields: ["email"] });
  if (d.users.some((u) => u.phone === phone)) throw fail(409, "phone_taken", { fields: ["phone"] });
  const u = { id: uid(), email, phone, fullName: body.fullName.trim(), role: body.role ?? "client", status: "active", password: uid(), createdAt: new Date().toISOString(), lastLoginAt: null };
  d.users.push(u);
  d.profiles[u.id] = { gender: null, birthDate: null, heightCm: null, targetWeightKg: null, activityLevel: null, coachId: null, package: null, clientStatus: "active" };
  d.metrics[u.id] = [];
  return { id: u.id, resetLink: resetLink(u.id) };
});

route("PATCH", "/admin/users/:id/status", ({ params, body }) => {
  const actor = needAdmin();
  if (actor.id === params.id) throw fail(403, "cannot_change_self");
  const u = byId(params.id);
  if (!u) throw fail(404, "user_not_found");
  need(["pending", "active", "suspended"].includes(body.status));
  u.status = body.status;
  save();
  return null;
});
route("PATCH", "/admin/users/:id/role", ({ params, body }) => {
  const actor = needAdmin();
  if (actor.id === params.id) throw fail(403, "cannot_change_self");
  const u = byId(params.id);
  if (!u) throw fail(404, "user_not_found");
  need(["client", "coach", "admin"].includes(body.role));
  u.role = body.role;
  save();
  return null;
});
route("PATCH", "/admin/users/:id", ({ params, body }) => {
  needAdmin();
  const p = load().profiles[params.id];
  if (!p) throw fail(404, "user_not_found");
  if (body.coachId) {
    const c = byId(body.coachId);
    if (!c || !["coach", "admin"].includes(c.role) || c.status !== "active") throw fail(400, "invalid_coach");
  }
  if ("coachId" in body) p.coachId = body.coachId;
  if ("package" in body) p.package = body.package || null;
  if (body.clientStatus) p.clientStatus = body.clientStatus;
  save();
  return null;
});
route("DELETE", "/admin/users/:id", ({ params, body }) => {
  const actor = needAdmin();
  if (body?.password !== actor.password) throw fail(400, "invalid_current_password");
  if (actor.id === params.id) throw fail(403, "cannot_change_self");
  const d = load();
  if (!byId(params.id)) throw fail(404, "user_not_found");
  d.users = d.users.filter((u) => u.id !== params.id);
  for (const k of ["foodLog", "workoutSets", "checkins", "photos"]) d[k] = d[k].filter((x) => x.userId !== params.id);
  delete d.profiles[params.id]; delete d.metrics[params.id]; delete d.targets[params.id];
  save();
  return null;
});

route("GET", "/admin/system/status", () => {
  needAdmin();
  return { databaseBytes: 12_400_000, storageBytes: 3_100_000, diskFreeBytes: 42_000_000_000, userCount: load().users.length, backup: { latestFile: "latis-demo.dump.age", ageHours: 3.5 } };
});

// ----- học viên (dành cho coach/admin) -----
route("GET", "/clients/:id/overview", ({ params, query }) => {
  const actor = needStaff();
  const c = accessibleClient(actor, params.id);
  const d = load();
  const date = query.get("date");
  const { coachId, package: pkg, clientStatus, ...profile } = d.profiles[c.id];
  return {
    client: { id: c.id, fullName: c.fullName, email: c.email, phone: c.phone, status: c.status, clientStatus, package: pkg, coachId },
    profile,
    metrics: (d.metrics[c.id] ?? []).filter((m) => m.date >= addDays(date, -180) && m.date <= date).sort((a, b) => a.date.localeCompare(b.date)),
    target: currentTarget(c.id, date),
    summary: summary(c.id, addDays(date, -13), date),
    checkins: d.checkins.filter((x) => x.userId === c.id).sort((a, b) => b.weekStart.localeCompare(a.weekStart)).slice(0, 8).map(checkinOut),
  };
});
route("GET", "/clients/:id/photos", ({ params }) => {
  const c = accessibleClient(needStaff(), params.id);
  return { photos: load().photos.filter((p) => p.userId === c.id).sort((a, b) => b.takenOn.localeCompare(a.takenOn)).map(photoOut) };
});
route("GET", "/clients/:id/photos/:photoId/file", ({ params, query }) => photoFile(accessibleClient(needStaff(), params.id).id, params.photoId, query.get("size")));
route("PUT", "/clients/:id/checkins/:weekStart/coach-note", ({ params, body }) => {
  const c = accessibleClient(needStaff(), params.id);
  const ck = load().checkins.find((x) => x.userId === c.id && x.weekStart === params.weekStart);
  if (!ck) throw fail(404, "checkin_not_found");
  ck.coachNote = String(body.note ?? "").trim() || null;
  save();
  return { checkin: checkinOut(ck) };
});
route("POST", "/clients/:id/nutrition-targets", ({ params, body }) => {
  const c = accessibleClient(needStaff(), params.id);
  const { effectiveFrom, ...v } = body;
  need(v.kcal >= 800 && v.kcal <= 6000);
  const d = load();
  d.targets[c.id] = (d.targets[c.id] ?? []).filter((t) => t.effectiveFrom !== effectiveFrom).concat({ effectiveFrom, kcal: v.kcal, proteinG: v.proteinG, carbsG: v.carbsG, fatG: v.fatG });
  save();
  return currentTarget(c.id, effectiveFrom);
});

// ---------------------------------------------------------------------------------------------

/** Điểm vào duy nhất: thay cho `fetch` của lớp api.js khi bật chế độ demo. */
export async function demoRequest(path, { method = "GET", body, responseType } = {}) {
  await sleep(60); // độ trễ nhỏ cho giống mạng thật (không nháy giao diện)
  const [pathname, search = ""] = path.split("?");
  const query = new URLSearchParams(search);
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = r.re.exec(pathname);
    if (!m) continue;
    const result = await r.handler({ params: m.groups ?? {}, query, body: body ?? {} });
    if (responseType === "blob") return result;
    return result === undefined ? null : JSON.parse(JSON.stringify(result)); // bản sao: React không giữ tham chiếu tới dữ liệu "máy chủ"
  }
  throw fail(404, "not_found");
}
