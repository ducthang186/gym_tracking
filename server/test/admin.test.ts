import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { call, cleanDb, createUser, login, makeApp, refresh, refreshCookie, validBody } from "./helpers.js";

let app: FastifyInstance;
beforeAll(async () => {
  ({ app } = await makeApp());
});
afterAll(() => app.close());
beforeEach(() => cleanDb(app));

const PW = validBody().password;

async function setup() {
  const admin = await createUser(app, "ad@example.com", "0900000001", "admin");
  const coach = await createUser(app, "co@example.com", "0900000002", "coach");
  const mine = await createUser(app, "mine@example.com", "0900000003");
  const other = await createUser(app, "other@example.com", "0900000004");
  await app.db.updateTable("profiles").set({ coachId: coach.id }).where("id", "=", mine.id).execute();
  return { admin, coach, mine, other };
}

describe("danh sách người dùng", () => {
  it("admin thấy tất cả; coach chỉ thấy học viên của mình; học viên bị chặn", async () => {
    const { admin, coach, mine, other } = await setup();
    const all = (await call(app, admin.token, "GET", "/api/v1/admin/users")).json();
    expect(all.total).toBe(4);
    const own = (await call(app, coach.token, "GET", "/api/v1/admin/users")).json();
    expect(own.users.map((u: { id: string }) => u.id)).toEqual([mine.id]);
    expect((await call(app, mine.token, "GET", "/api/v1/admin/users")).statusCode).toBe(403);
    expect((await call(app, undefined, "GET", "/api/v1/admin/users")).statusCode).toBe(401);
    expect(JSON.stringify(all)).not.toMatch(/passwordHash|argon2/);
    expect(all.users.find((u: { id: string }) => u.id === other.id).coachId).toBeNull();
  });

  it("tìm kiếm, lọc, phân trang; ký tự đại diện của LIKE bị vô hiệu", async () => {
    const { admin, mine } = await setup();
    const find = async (q: string) => (await call(app, admin.token, "GET", `/api/v1/admin/users?${q}`)).json();
    expect((await find("q=mine")).users.map((u: { id: string }) => u.id)).toEqual([mine.id]);
    expect((await find("q=0900000004")).total).toBe(1);
    expect((await find("q=%25")).total).toBe(0);
    expect((await find("role=coach")).total).toBe(1);
    expect((await find("limit=2&offset=0")).users).toHaveLength(2);
    expect((await call(app, admin.token, "GET", "/api/v1/admin/users?limit=500")).statusCode).toBe(400);
  });

  it("kèm cân nặng mới nhất và tên coach", async () => {
    const { admin, coach, mine } = await setup();
    await call(app, mine.token, "PUT", `/api/v1/body-metrics/${new Date().toISOString().slice(0, 10)}`, { weightKg: 77.5 });
    const row = (await call(app, admin.token, "GET", "/api/v1/admin/users?q=mine")).json().users[0];
    expect(row).toMatchObject({ latestWeightKg: 77.5, coachId: coach.id });
    expect(row.coachName).toBeTruthy();
  });
});

describe("quản lý tài khoản (chỉ admin)", () => {
  it("duyệt / khoá: khoá thì phiên hiện tại và refresh token đều mất hiệu lực ngay", async () => {
    const { admin, mine } = await setup();
    const cookie = refreshCookie(await login(app, mine.email, PW))!;
    expect((await call(app, admin.token, "PATCH", `/api/v1/admin/users/${mine.id}/status`, { status: "suspended" })).statusCode).toBe(204);
    expect((await call(app, mine.token, "GET", "/api/v1/me")).statusCode).toBe(401);
    expect((await refresh(app, cookie)).statusCode).toBe(401);
    expect((await login(app, mine.email, PW)).json().error).toBe("account_suspended");
    await call(app, admin.token, "PATCH", `/api/v1/admin/users/${mine.id}/status`, { status: "active" });
    expect((await login(app, mine.email, PW)).statusCode).toBe(200);
  });

  it("coach và học viên không đổi được trạng thái/vai trò của ai; admin không tự đổi mình", async () => {
    const { admin, coach, mine, other } = await setup();
    for (const who of [coach, mine]) {
      expect((await call(app, who.token, "PATCH", `/api/v1/admin/users/${other.id}/status`, { status: "suspended" })).statusCode).toBe(403);
      expect((await call(app, who.token, "PATCH", `/api/v1/admin/users/${other.id}/role`, { role: "admin" })).statusCode).toBe(403);
      expect((await call(app, who.token, "PATCH", `/api/v1/admin/users/${who.id}/role`, { role: "admin" })).statusCode).toBe(403); // không tự nâng quyền
    }
    expect((await call(app, admin.token, "PATCH", `/api/v1/admin/users/${admin.id}/status`, { status: "suspended" })).statusCode).toBe(403);
    expect((await call(app, admin.token, "PATCH", `/api/v1/admin/users/${admin.id}/role`, { role: "client" })).statusCode).toBe(403);
    expect((await call(app, admin.token, "PATCH", `/api/v1/admin/users/${other.id}/role`, { role: "coach" })).statusCode).toBe(204);
    expect((await call(app, admin.token, "PATCH", `/api/v1/admin/users/${other.id}/status`, { status: "bad" })).statusCode).toBe(400);
  });

  it("gán coach / gói / trạng thái học viên; coach phải là coach hoặc admin đang hoạt động", async () => {
    const { admin, coach, other } = await setup();
    const patch = (body: object) => call(app, admin.token, "PATCH", `/api/v1/admin/users/${other.id}`, body);
    expect((await patch({ coachId: coach.id, package: "1:1", clientStatus: "paused" })).statusCode).toBe(204);
    const row = await app.db.selectFrom("profiles").select(["coachId", "package", "status"]).where("id", "=", other.id).executeTakeFirstOrThrow();
    expect(row).toEqual({ coachId: coach.id, package: "1:1", status: "paused" });
    expect((await patch({ coachId: other.id })).json().error).toBe("invalid_coach"); // học viên không làm coach được
    expect((await patch({ coachId: null })).statusCode).toBe(204);
    expect((await patch({ role: "admin" })).statusCode).toBe(400); // khoá lạ
  });

  it("tạo tài khoản hộ: trả link đặt mật khẩu, không có mật khẩu đoán được, trùng email/SĐT bị từ chối", async () => {
    const { admin } = await setup();
    const body = { email: "new@example.com", fullName: "Người Mới", phone: "0911999888", role: "coach" };
    const res = await call(app, admin.token, "POST", "/api/v1/admin/users", body);
    expect(res.statusCode).toBe(201);
    const row = await app.db.selectFrom("users").select(["role", "status"]).where("id", "=", res.json().id).executeTakeFirstOrThrow();
    expect(row).toEqual({ role: "coach", status: "active" });
    // vào được bằng link
    const set = await app.inject({ method: "POST", url: "/api/v1/auth/reset-password", payload: { token: res.json().resetLink.token, newPassword: "mat-khau-cua-toi-1" } });
    expect(set.statusCode).toBe(204);
    expect((await login(app, "new@example.com", "mat-khau-cua-toi-1")).statusCode).toBe(200);
    expect((await call(app, admin.token, "POST", "/api/v1/admin/users", body)).statusCode).toBe(409);
    expect((await call(app, admin.token, "POST", "/api/v1/admin/users", { ...body, email: "x@example.com", password: "x" })).statusCode).toBe(400);
  });
});

describe("thống kê & trạng thái hệ thống", () => {
  it("thống kê theo phạm vi; trạng thái hệ thống chỉ admin", async () => {
    const { admin, coach, mine } = await setup();
    const a = (await call(app, admin.token, "GET", "/api/v1/admin/stats")).json();
    expect(a.users.total).toBe(4);
    expect(a.foods).toBeGreaterThanOrEqual(18);
    const c = (await call(app, coach.token, "GET", "/api/v1/admin/stats")).json();
    expect(c.users.total).toBe(1);
    expect((await call(app, mine.token, "GET", "/api/v1/admin/stats")).statusCode).toBe(403);

    const status = await call(app, admin.token, "GET", "/api/v1/admin/system/status");
    expect(status.statusCode).toBe(200);
    expect(status.json().databaseBytes).toBeGreaterThan(0);
    expect((await call(app, coach.token, "GET", "/api/v1/admin/system/status")).statusCode).toBe(403);
  });
});
