import type { FastifyInstance } from "fastify";
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

async function makeUser(email: string, phone: string) {
  const { user, accessToken } = (await register(app, validBody({ email, phone }))).json();
  return { id: user.id as string, token: accessToken as string };
}
const call = (token: string | undefined, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, payload?: object) =>
  app.inject({ method, url, payload, headers: token ? { authorization: `Bearer ${token}` } : {} });

describe("hồ sơ thể chất", () => {
  it("mặc định trống; cập nhật từng phần; null để xoá", async () => {
    const a = await makeUser("a@example.com", "0911111111");
    expect((await call(a.token, "GET", "/api/v1/me/profile")).json().profile).toEqual({
      gender: null, birthDate: null, heightCm: null, targetWeightKg: null, activityLevel: null,
    });
    const res = await call(a.token, "PATCH", "/api/v1/me/profile", { gender: "male", heightCm: 175.5, birthDate: "1999-05-20" });
    expect(res.json().profile).toMatchObject({ gender: "male", heightCm: 175.5, birthDate: "1999-05-20" });
    const res2 = await call(a.token, "PATCH", "/api/v1/me/profile", { heightCm: null });
    expect(res2.json().profile).toMatchObject({ gender: "male", heightCm: null });
  });

  it("từ chối giá trị vô lý và khoá lạ (không đổi được vai trò qua hồ sơ)", async () => {
    const a = await makeUser("a@example.com", "0911111111");
    for (const bad of [{ heightCm: 10 }, { heightCm: 400 }, { gender: "x" }, { birthDate: "3000-01-01" }, { birthDate: "abc" }, { role: "admin" }, { targetWeightKg: 5 }]) {
      expect((await call(a.token, "PATCH", "/api/v1/me/profile", bad)).statusCode).toBe(400);
    }
    expect((await call(a.token, "GET", "/api/v1/me")).json().user.role).toBe("client");
  });

  it("yêu cầu đăng nhập", async () => {
    expect((await call(undefined, "GET", "/api/v1/me/profile")).statusCode).toBe(401);
    expect((await call(undefined, "PATCH", "/api/v1/me/profile", {})).statusCode).toBe(401);
  });
});

describe("cân nặng", () => {
  it("ghi, ghi đè cùng ngày, liệt kê theo thứ tự ngày, xoá", async () => {
    const a = await makeUser("a@example.com", "0911111111");
    await call(a.token, "PUT", `/api/v1/body-metrics/${addDays(TODAY, -2)}`, { weightKg: 80 });
    await call(a.token, "PUT", `/api/v1/body-metrics/${TODAY}`, { weightKg: 78.4, waistCm: 90, bodyFatPct: 20, note: "  sau tập " });
    await call(a.token, "PUT", `/api/v1/body-metrics/${TODAY}`, { weightKg: 78.2 }); // ghi đè
    const list = (await call(a.token, "GET", "/api/v1/body-metrics")).json().metrics;
    expect(list.map((m: { date: string }) => m.date)).toEqual([addDays(TODAY, -2), TODAY]);
    expect(list[1]).toMatchObject({ weightKg: 78.2, waistCm: null, bodyFatPct: null, note: null });
    expect((await call(a.token, "DELETE", `/api/v1/body-metrics/${TODAY}`)).statusCode).toBe(204);
    expect((await call(a.token, "DELETE", `/api/v1/body-metrics/${TODAY}`)).statusCode).toBe(404);
  });

  it("kiểm tra đầu vào: cân nặng, ngày tương lai, ngày sai", async () => {
    const a = await makeUser("a@example.com", "0911111111");
    for (const bad of [{ weightKg: 5 }, { weightKg: 500 }, { weightKg: "80" }, {}, { weightKg: 80, bodyFatPct: 90 }, { weightKg: 80, userId: "x" }]) {
      expect((await call(a.token, "PUT", `/api/v1/body-metrics/${TODAY}`, bad)).statusCode).toBe(400);
    }
    expect((await call(a.token, "PUT", `/api/v1/body-metrics/${addDays(TODAY, 5)}`, { weightKg: 80 })).statusCode).toBe(400);
    expect((await call(a.token, "PUT", "/api/v1/body-metrics/2026-02-31", { weightKg: 80 })).statusCode).toBe(400);
  });

  it("A không thấy / không xoá được số liệu của B", async () => {
    const a = await makeUser("a@example.com", "0911111111");
    const b = await makeUser("b@example.com", "0922222222");
    await call(b.token, "PUT", `/api/v1/body-metrics/${TODAY}`, { weightKg: 90 });
    expect((await call(a.token, "GET", "/api/v1/body-metrics")).json().metrics).toEqual([]);
    expect((await call(a.token, "DELETE", `/api/v1/body-metrics/${TODAY}`)).statusCode).toBe(404);
    expect((await call(b.token, "GET", "/api/v1/body-metrics")).json().metrics).toHaveLength(1);
  });
});

describe("mục tiêu dinh dưỡng", () => {
  it("chưa đủ hồ sơ → không gợi ý, báo thiếu trường; đủ hồ sơ → có gợi ý và BMI", async () => {
    const a = await makeUser("a@example.com", "0911111111");
    const empty = (await call(a.token, "GET", `/api/v1/nutrition-targets/current?date=${TODAY}`)).json();
    expect(empty).toMatchObject({ target: null, suggestion: null, bmi: null });
    expect(empty.missing).toContain("gender");

    await call(a.token, "PATCH", "/api/v1/me/profile", { gender: "male", birthDate: "1996-01-01", heightCm: 175, activityLevel: "moderate", targetWeightKg: 70 });
    await call(a.token, "PUT", `/api/v1/body-metrics/${TODAY}`, { weightKg: 80 });
    const full = (await call(a.token, "GET", `/api/v1/nutrition-targets/current?date=${TODAY}`)).json();
    expect(full.missing).toEqual([]);
    expect(full.suggestion).toMatchObject({ goal: "lose" });
    expect(full.bmi).toBe(26.1);
  });

  it("đặt mục tiêu riêng, đặt lại trong cùng ngày thì ghi đè, validate", async () => {
    const a = await makeUser("a@example.com", "0911111111");
    const put = (body: object) => call(a.token, "PUT", "/api/v1/nutrition-targets", { effectiveFrom: TODAY, ...body });
    const ok = await put({ kcal: 2200, proteinG: 160, carbsG: 220, fatG: 70 });
    expect(ok.json().target).toMatchObject({ kcal: 2200, proteinG: 160 });
    expect((await put({ kcal: 2000, proteinG: 150, carbsG: 200, fatG: 60 })).json().target.kcal).toBe(2000);
    for (const bad of [{ kcal: 100 }, { kcal: 9000 }, { proteinG: -1 }, { kcal: 2000.5 }, { role: "admin" }]) {
      expect((await put({ kcal: 2200, proteinG: 160, carbsG: 220, fatG: 70, ...bad })).statusCode).toBe(400);
    }
  });

  it("mục tiêu của người này không ảnh hưởng người kia", async () => {
    const a = await makeUser("a@example.com", "0911111111");
    const b = await makeUser("b@example.com", "0922222222");
    await call(a.token, "PUT", "/api/v1/nutrition-targets", { effectiveFrom: TODAY, kcal: 2200, proteinG: 160, carbsG: 220, fatG: 70 });
    expect((await call(b.token, "GET", `/api/v1/nutrition-targets/current?date=${TODAY}`)).json().target).toBeNull();
  });
});
