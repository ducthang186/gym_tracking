import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addDays, toDateStr } from "../src/lib/dates.js";
import { cleanDb, makeApp, register, validBody } from "./helpers.js";

let app: FastifyInstance;
beforeAll(async () => {
  ({ app } = await makeApp());
});
afterAll(() => app.close());
beforeEach(() => cleanDb(app));

const TODAY = toDateStr(new Date());

async function makeUser(email: string, phone: string, role?: "admin" | "coach") {
  const { user, accessToken } = (await register(app, validBody({ email, phone }))).json();
  if (role) await app.db.updateTable("users").set({ role }).where("id", "=", user.id).execute();
  return { id: user.id as string, token: accessToken as string };
}
const call = (token: string | undefined, method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: object) =>
  app.inject({ method, url, payload, headers: token ? { authorization: `Bearer ${token}` } : {} });

describe("giáo án tuần", () => {
  it("có sẵn 7 ngày; học viên đọc được nhưng không sửa được", async () => {
    const client = await makeUser("c@example.com", "0911111111");
    const days = (await call(client.token, "GET", "/api/v1/workout-plan")).json().days;
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ weekday: 1, name: "Ngực + Tay sau" });
    expect(days[0].items[0]).toEqual({ name: "Bench Press", sets: 4, reps: "8" });
    expect((await call(client.token, "PUT", "/api/v1/workout-plan/1", { name: "Hack", items: [] })).statusCode).toBe(403);
    expect((await call(undefined, "GET", "/api/v1/workout-plan")).statusCode).toBe(401);
  });

  it("admin/coach thay toàn bộ một ngày; thứ tự giữ nguyên; ngày khác không đổi", async () => {
    const admin = await makeUser("ad@example.com", "0922222222", "admin");
    const before = (await call(admin.token, "GET", "/api/v1/workout-plan")).json().days;
    const res = await call(admin.token, "PUT", "/api/v1/workout-plan/3", {
      name: "Chạy bộ",
      items: [{ name: "Khởi động", sets: null, reps: null }, { name: "Chạy 5km" }, { name: "Plank", sets: 3, reps: "60" }],
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().day.items.map((i: { name: string }) => i.name)).toEqual(["Khởi động", "Chạy 5km", "Plank"]);
    const after = (await call(admin.token, "GET", "/api/v1/workout-plan")).json().days;
    expect(after[2].name).toBe("Chạy bộ");
    expect(after.filter((_: unknown, i: number) => i !== 2)).toEqual(before.filter((_: unknown, i: number) => i !== 2));
    // khôi phục dữ liệu gốc cho các test khác
    await call(admin.token, "PUT", "/api/v1/workout-plan/3", { name: "Nghỉ / Cardio nhẹ", items: [{ name: "Đi bộ nhanh 30 phút" }] });
  });

  it("validate: ngày ngoài 1–7, tên rỗng, quá nhiều bài, khoá lạ", async () => {
    const admin = await makeUser("ad@example.com", "0922222222", "admin");
    expect((await call(admin.token, "PUT", "/api/v1/workout-plan/8", { name: "x", items: [] })).statusCode).toBe(400);
    expect((await call(admin.token, "PUT", "/api/v1/workout-plan/0", { name: "x", items: [] })).statusCode).toBe(400);
    expect((await call(admin.token, "PUT", "/api/v1/workout-plan/1", { name: "  ", items: [] })).statusCode).toBe(400);
    expect((await call(admin.token, "PUT", "/api/v1/workout-plan/1", { name: "x", items: Array.from({ length: 31 }, (_, i) => ({ name: `b${i}` })) })).statusCode).toBe(400);
    expect((await call(admin.token, "PUT", "/api/v1/workout-plan/1", { name: "x", items: [{ name: "a", sets: 99 }] })).statusCode).toBe(400);
    expect((await call(admin.token, "PUT", "/api/v1/workout-plan/1", { name: "x", items: [], extra: 1 })).statusCode).toBe(400);
  });
});

describe("nhật ký tập", () => {
  const set = (token: string, over: object = {}) =>
    call(token, "POST", "/api/v1/workout-log", { performedOn: TODAY, exerciseName: "Bench Press", reps: 8, weightKg: 60, ...over });

  it("ghi hiệp, liệt kê, xoá; weightKg mặc định 0 (bodyweight)", async () => {
    const a = await makeUser("a@example.com", "0911111111");
    expect((await set(a.token)).statusCode).toBe(201);
    expect((await set(a.token, { reps: 10, weightKg: undefined })).json().set.weightKg).toBe(0);
    const list = (await call(a.token, "GET", `/api/v1/workout-log?date=${TODAY}`)).json().sets;
    expect(list).toHaveLength(2);
    expect((await call(a.token, "DELETE", `/api/v1/workout-log/${list[0].id}`)).statusCode).toBe(204);
    expect((await call(a.token, "GET", `/api/v1/workout-log?date=${TODAY}`)).json().sets).toHaveLength(1);
  });

  it("gửi lại cùng clientRequestId không ghi đôi", async () => {
    const a = await makeUser("a@example.com", "0911111111");
    const clientRequestId = randomUUID();
    const first = await set(a.token, { clientRequestId });
    const second = await set(a.token, { clientRequestId });
    expect([first.statusCode, second.statusCode]).toEqual([201, 200]);
    expect(second.json().set.id).toBe(first.json().set.id);
    expect((await call(a.token, "GET", `/api/v1/workout-log?date=${TODAY}`)).json().sets).toHaveLength(1);
  });

  it("validate: reps, mức tạ, ngày tương lai, khoá lạ", async () => {
    const a = await makeUser("a@example.com", "0911111111");
    for (const bad of [{ reps: 0 }, { reps: 1000 }, { reps: 1.5 }, { weightKg: -1 }, { weightKg: 5000 }, { exerciseName: "" }, { performedOn: addDays(TODAY, 3) }, { userId: "x" }]) {
      expect((await set(a.token, bad)).statusCode).toBe(400);
    }
  });

  it("A không đọc/xoá được hiệp của B", async () => {
    const a = await makeUser("a@example.com", "0911111111");
    const b = await makeUser("b@example.com", "0922222222");
    const setB = (await set(b.token)).json().set;
    expect((await call(a.token, "GET", `/api/v1/workout-log?date=${TODAY}`)).json().sets).toEqual([]);
    expect((await call(a.token, "DELETE", `/api/v1/workout-log/${setB.id}`)).statusCode).toBe(404);
    expect((await call(a.token, "GET", "/api/v1/workout-log/history?exercise=Bench%20Press")).json().sets).toEqual([]);
    expect((await call(b.token, "GET", `/api/v1/workout-log?date=${TODAY}`)).json().sets).toHaveLength(1);
  });

  it("lịch sử một bài: mới nhất trước", async () => {
    const a = await makeUser("a@example.com", "0911111111");
    await set(a.token, { performedOn: addDays(TODAY, -7), weightKg: 50 });
    await set(a.token, { performedOn: addDays(TODAY, -1), weightKg: 55 });
    await set(a.token, { exerciseName: "Squat", weightKg: 100 });
    const h = (await call(a.token, "GET", "/api/v1/workout-log/history?exercise=Bench%20Press")).json().sets;
    expect(h.map((s: { weightKg: number }) => s.weightKg)).toEqual([55, 50]);
  });

  it("tổng hợp theo ngày gồm calo và số hiệp tập", async () => {
    const a = await makeUser("a@example.com", "0911111111");
    await set(a.token);
    await set(a.token);
    const foods = (await call(a.token, "GET", "/api/v1/foods")).json().foods;
    await call(a.token, "POST", "/api/v1/food-log", { loggedOn: TODAY, foodId: foods[0].id, grams: 100 });
    const res = (await call(a.token, "GET", `/api/v1/food-log/summary?from=${addDays(TODAY, -6)}&to=${TODAY}`)).json();
    expect(res.days).toHaveLength(1);
    expect(res.days[0]).toMatchObject({ date: TODAY, workoutSets: 2 });
    expect(res.days[0].kcal).toBeGreaterThan(0);
    expect((await call(a.token, "GET", `/api/v1/food-log/summary?from=2020-01-01&to=${TODAY}`)).statusCode).toBe(400); // quá 92 ngày
  });
});

describe("gợi ý kế hoạch ăn", () => {
  it("trả 5 bữa gần mục tiêu; validate tham số", async () => {
    const a = await makeUser("a@example.com", "0911111111");
    const res = (await call(a.token, "GET", "/api/v1/meal-plan/suggest?kcal=2000&day=1&variant=2")).json();
    expect(res.plan.meals).toHaveLength(5);
    expect(Math.abs(res.plan.kcal - 2000)).toBeLessThan(200);
    for (const q of ["kcal=100", "kcal=2000&day=7", "kcal=abc", "day=1"]) {
      expect((await call(a.token, "GET", `/api/v1/meal-plan/suggest?${q}`)).statusCode).toBe(400);
    }
    expect((await call(undefined, "GET", "/api/v1/meal-plan/suggest?kcal=2000")).statusCode).toBe(401);
  });
});
