import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanDb, makeApp, register, validBody } from "./helpers.js";

let app: FastifyInstance;

beforeAll(async () => {
  ({ app } = await makeApp());
});
afterAll(() => app.close());
beforeEach(() => cleanDb(app));

const DAY = "2026-10-05";

async function makeUser(email: string, phone: string) {
  const res = await register(app, validBody({ email, phone }));
  const { user, accessToken } = res.json();
  return { id: user.id as string, token: accessToken as string };
}

async function makeStaff(email: string, phone: string, role: "admin" | "coach") {
  const u = await makeUser(email, phone);
  await app.db.updateTable("users").set({ role }).where("id", "=", u.id).execute();
  return u;
}

const call = (token: string | undefined, method: "GET" | "POST" | "DELETE", url: string, payload?: object) =>
  app.inject({ method, url, payload, headers: token ? { authorization: `Bearer ${token}` } : {} });

async function firstFoodId(token: string, name = "Cơm trắng") {
  const foods = (await call(token, "GET", "/api/v1/foods")).json().foods as Array<{ id: string; name: string }>;
  return foods.find((f) => f.name === name)!.id;
}

describe("món ăn", () => {
  it("yêu cầu đăng nhập", async () => {
    expect((await call(undefined, "GET", "/api/v1/foods")).statusCode).toBe(401);
  });

  it("trả danh sách món có sẵn và tìm theo tên", async () => {
    const a = await makeUser("a@example.com", "0911111111");
    const all = (await call(a.token, "GET", "/api/v1/foods")).json().foods;
    expect(all.length).toBeGreaterThanOrEqual(18);
    const found = (await call(a.token, "GET", "/api/v1/foods?q=ức gà")).json().foods;
    expect(found.map((f: { name: string }) => f.name)).toEqual(["Ức gà (luộc, không da)"]);
    // ký tự đại diện của LIKE bị vô hiệu hoá
    expect((await call(a.token, "GET", "/api/v1/foods?q=%25")).json().foods).toEqual([]);
  });

  it("học viên không được thêm/xoá món; admin và coach thì được", async () => {
    const client = await makeUser("c@example.com", "0911111111");
    const admin = await makeStaff("ad@example.com", "0922222222", "admin");
    const coach = await makeStaff("co@example.com", "0933333333", "coach");
    const body = { name: "Món thử", kcalPer100g: 100 };

    expect((await call(client.token, "POST", "/api/v1/foods", body)).statusCode).toBe(403);
    const created = await call(admin.token, "POST", "/api/v1/foods", body);
    expect(created.statusCode).toBe(201);
    const id = created.json().food.id;
    expect((await call(admin.token, "POST", "/api/v1/foods", body)).statusCode).toBe(409); // trùng tên
    expect((await call(client.token, "DELETE", `/api/v1/foods/${id}`)).statusCode).toBe(403);
    expect((await call(coach.token, "DELETE", `/api/v1/foods/${id}`)).statusCode).toBe(204);
    expect((await call(coach.token, "DELETE", `/api/v1/foods/${id}`)).statusCode).toBe(404);
  });

  it("từ chối giá trị vô lý", async () => {
    const admin = await makeStaff("ad@example.com", "0922222222", "admin");
    for (const bad of [{ kcalPer100g: -1 }, { kcalPer100g: 5000 }, { kcalPer100g: 10, proteinPer100g: 101 }, { kcalPer100g: 10, role: "x" }]) {
      expect((await call(admin.token, "POST", "/api/v1/foods", { name: "Xấu", ...bad })).statusCode).toBe(400);
    }
  });
});

describe("nhật ký ăn", () => {
  it("server tự tính calo từ bảng món (không tin client)", async () => {
    const a = await makeUser("a@example.com", "0911111111");
    const foodId = await firstFoodId(a.token, "Ức gà (luộc, không da)");
    const res = await call(a.token, "POST", "/api/v1/food-log", { loggedOn: DAY, foodId, grams: 200 });
    expect(res.statusCode).toBe(201);
    expect(res.json().entry).toMatchObject({ foodName: "Ức gà (luộc, không da)", grams: 200, kcal: 330, proteinG: 62, fatG: 7.2 });

    // client cố gửi số calo riêng → bị từ chối (strictObject)
    const cheat = await call(a.token, "POST", "/api/v1/food-log", { loggedOn: DAY, foodId, grams: 200, kcal: 1 });
    expect(cheat.statusCode).toBe(400);
  });

  it("món tự nhập; phải có đúng một trong foodId / custom", async () => {
    const a = await makeUser("a@example.com", "0911111111");
    const foodId = await firstFoodId(a.token);
    const ok = await call(a.token, "POST", "/api/v1/food-log", { loggedOn: DAY, grams: 50, custom: { kcalPer100g: 400 } });
    expect(ok.json().entry).toMatchObject({ foodName: "Món tự nhập", kcal: 200, foodId: null });
    for (const bad of [{}, { foodId, custom: { kcalPer100g: 1 } }]) {
      expect((await call(a.token, "POST", "/api/v1/food-log", { loggedOn: DAY, grams: 50, ...bad })).statusCode).toBe(400);
    }
  });

  it("kiểm tra đầu vào: gram, ngày, món không tồn tại", async () => {
    const a = await makeUser("a@example.com", "0911111111");
    const foodId = await firstFoodId(a.token);
    for (const bad of [{ grams: 0 }, { grams: -5 }, { grams: 5001 }, { loggedOn: "2026-02-31" }, { loggedOn: "hôm nay" }]) {
      const res = await call(a.token, "POST", "/api/v1/food-log", { loggedOn: DAY, foodId, grams: 100, ...bad });
      expect(res.statusCode).toBe(400);
    }
    expect((await call(a.token, "POST", "/api/v1/food-log", { loggedOn: DAY, foodId: randomUUID(), grams: 100 })).statusCode).toBe(404);
  });

  it("gửi lại cùng clientRequestId không ghi đôi", async () => {
    const a = await makeUser("a@example.com", "0911111111");
    const foodId = await firstFoodId(a.token);
    const body = { loggedOn: DAY, foodId, grams: 100, clientRequestId: randomUUID() };
    const first = await call(a.token, "POST", "/api/v1/food-log", body);
    const second = await call(a.token, "POST", "/api/v1/food-log", body);
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json().entry.id).toBe(first.json().entry.id);
    expect((await call(a.token, "GET", `/api/v1/food-log?date=${DAY}`)).json().entries).toHaveLength(1);
  });

  it("liệt kê theo ngày kèm tổng", async () => {
    const a = await makeUser("a@example.com", "0911111111");
    const rice = await firstFoodId(a.token);
    await call(a.token, "POST", "/api/v1/food-log", { loggedOn: DAY, foodId: rice, grams: 100 });
    await call(a.token, "POST", "/api/v1/food-log", { loggedOn: DAY, foodId: rice, grams: 200 });
    await call(a.token, "POST", "/api/v1/food-log", { loggedOn: "2026-10-06", foodId: rice, grams: 100 });
    const res = (await call(a.token, "GET", `/api/v1/food-log?date=${DAY}`)).json();
    expect(res.entries).toHaveLength(2);
    expect(res.totals.kcal).toBe(390);
    expect((await call(a.token, "GET", "/api/v1/food-log")).statusCode).toBe(400);
  });

  it("A không đọc/xoá được nhật ký của B (xoá trả 404, bản ghi còn nguyên)", async () => {
    const a = await makeUser("a@example.com", "0911111111");
    const b = await makeUser("b@example.com", "0922222222");
    const foodId = await firstFoodId(a.token);
    const entryB = (await call(b.token, "POST", "/api/v1/food-log", { loggedOn: DAY, foodId, grams: 100 })).json().entry;

    expect((await call(a.token, "GET", `/api/v1/food-log?date=${DAY}`)).json().entries).toEqual([]);
    expect((await call(a.token, "DELETE", `/api/v1/food-log/${entryB.id}`)).statusCode).toBe(404);
    expect((await call(b.token, "GET", `/api/v1/food-log?date=${DAY}`)).json().entries).toHaveLength(1);
    expect((await call(b.token, "DELETE", `/api/v1/food-log/${entryB.id}`)).statusCode).toBe(204);
  });

  it("không ghi hộ người khác: userId trong body bị từ chối", async () => {
    const a = await makeUser("a@example.com", "0911111111");
    const b = await makeUser("b@example.com", "0922222222");
    const foodId = await firstFoodId(a.token);
    const res = await call(a.token, "POST", "/api/v1/food-log", { loggedOn: DAY, foodId, grams: 100, userId: b.id });
    expect(res.statusCode).toBe(400);
  });

  it("xoá món khỏi danh mục không làm mất nhật ký cũ", async () => {
    const admin = await makeStaff("ad@example.com", "0922222222", "admin");
    const foodId = (await call(admin.token, "POST", "/api/v1/foods", { name: "Món tạm", kcalPer100g: 100 })).json().food.id;
    await call(admin.token, "POST", "/api/v1/food-log", { loggedOn: DAY, foodId, grams: 100 });
    await call(admin.token, "DELETE", `/api/v1/foods/${foodId}`);
    const entries = (await call(admin.token, "GET", `/api/v1/food-log?date=${DAY}`)).json().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0].foodName).toBe("Món tạm");
    // nhưng không ghi thêm được món đã lưu trữ
    expect((await call(admin.token, "POST", "/api/v1/food-log", { loggedOn: DAY, foodId, grams: 100 })).statusCode).toBe(404);
    await app.db.deleteFrom("foods").where("id", "=", foodId).execute();
  });

  it("yêu cầu đăng nhập", async () => {
    expect((await call(undefined, "GET", `/api/v1/food-log?date=${DAY}`)).statusCode).toBe(401);
    expect((await call(undefined, "POST", "/api/v1/food-log", {})).statusCode).toBe(401);
    expect((await call(undefined, "DELETE", "/api/v1/food-log/1")).statusCode).toBe(401);
  });
});
