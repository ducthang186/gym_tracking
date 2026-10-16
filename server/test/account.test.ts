import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { call, cleanDb, createUser, login, makeApp, me, refresh, refreshCookie, validBody } from "./helpers.js";

let app: FastifyInstance;
beforeAll(async () => {
  ({ app } = await makeApp());
});
afterAll(() => app.close());
beforeEach(() => cleanDb(app));

const PW = validBody().password;

describe("đổi mật khẩu", () => {
  it("đổi thành công: mật khẩu cũ hết hiệu lực, thiết bị khác bị đăng xuất, thiết bị này nhận phiên mới", async () => {
    const u = await createUser(app, "a@example.com", "0911111111");
    const other = await login(app, u.email, PW); // thiết bị khác
    const otherCookie = refreshCookie(other)!;

    const res = await call(app, u.token, "POST", "/api/v1/auth/change-password", { currentPassword: PW, newPassword: "mat-khau-moi-123" });
    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toBeTruthy();
    expect(refreshCookie(res)).toBeTruthy();

    expect((await login(app, u.email, PW)).statusCode).toBe(401);
    expect((await login(app, u.email, "mat-khau-moi-123")).statusCode).toBe(200);
    expect((await refresh(app, otherCookie)).statusCode).toBe(401);
    expect((await me(app, res.json().accessToken)).statusCode).toBe(200);
  });

  it("sai mật khẩu hiện tại → 400 (không phải 401) và tính vào bộ đếm khoá tài khoản", async () => {
    const u = await createUser(app, "a@example.com", "0911111111");
    const res = await call(app, u.token, "POST", "/api/v1/auth/change-password", { currentPassword: "sai-mat-khau", newPassword: "mat-khau-moi-123" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_current_password");
    await app.db.updateTable("users").set({ failedLogins: 9 }).where("id", "=", u.id).execute();
    await call(app, u.token, "POST", "/api/v1/auth/change-password", { currentPassword: "sai-nua", newPassword: "mat-khau-moi-123" });
    const locked = await call(app, u.token, "POST", "/api/v1/auth/change-password", { currentPassword: PW, newPassword: "mat-khau-moi-123" });
    expect(locked.statusCode).toBe(429);
  });

  it("validate: mật khẩu mới quá ngắn / trùng mật khẩu cũ / thiếu đăng nhập", async () => {
    const u = await createUser(app, "a@example.com", "0911111111");
    expect((await call(app, u.token, "POST", "/api/v1/auth/change-password", { currentPassword: PW, newPassword: "ngan" })).statusCode).toBe(400);
    const same = await call(app, u.token, "POST", "/api/v1/auth/change-password", { currentPassword: PW, newPassword: PW });
    expect(same.json().error).toBe("same_password");
    expect((await call(app, undefined, "POST", "/api/v1/auth/change-password", { currentPassword: PW, newPassword: "mat-khau-moi-123" })).statusCode).toBe(401);
  });
});

describe("link đặt lại mật khẩu", () => {
  it("admin cấp link → người dùng đặt mật khẩu mới → link chỉ dùng được một lần, mọi phiên cũ bị thu hồi, tài khoản được mở khoá", async () => {
    const admin = await createUser(app, "ad@example.com", "0922222222", "admin");
    const u = await createUser(app, "a@example.com", "0911111111");
    const oldSession = refreshCookie(await login(app, u.email, PW))!;
    await app.db.updateTable("users").set({ failedLogins: 5, lockedUntil: new Date(Date.now() + 600_000) }).where("id", "=", u.id).execute();

    const issued = await call(app, admin.token, "POST", `/api/v1/admin/users/${u.id}/reset-link`);
    expect(issued.statusCode).toBe(201);
    const { token } = issued.json().resetLink;
    // DB chỉ lưu băm, không lưu token
    const stored = await app.db.selectFrom("authTokens").select("tokenHash").where("userId", "=", u.id).execute();
    expect(stored.map((r) => r.tokenHash)).not.toContain(token);

    const reset = (pw: string, t = token) => app.inject({ method: "POST", url: "/api/v1/auth/reset-password", payload: { token: t, newPassword: pw } });
    expect((await reset("mat-khau-moi-123")).statusCode).toBe(204);
    expect((await login(app, u.email, "mat-khau-moi-123")).statusCode).toBe(200);
    expect((await refresh(app, oldSession)).statusCode).toBe(401);

    const again = await reset("mat-khau-khac-456");
    expect(again.statusCode).toBe(400);
    expect(again.json().error).toBe("invalid_or_expired_token");
  });

  it("link hết hạn, link giả, và link cũ bị thay bằng link mới đều bị từ chối bằng cùng một mã lỗi", async () => {
    const admin = await createUser(app, "ad@example.com", "0922222222", "admin");
    const u = await createUser(app, "a@example.com", "0911111111");
    const first = (await call(app, admin.token, "POST", `/api/v1/admin/users/${u.id}/reset-link`)).json().resetLink.token;
    const second = (await call(app, admin.token, "POST", `/api/v1/admin/users/${u.id}/reset-link`)).json().resetLink.token;
    const reset = (token: string) => app.inject({ method: "POST", url: "/api/v1/auth/reset-password", payload: { token, newPassword: "mat-khau-moi-123" } });

    expect((await reset(first)).json().error).toBe("invalid_or_expired_token"); // đã bị thay
    expect((await reset("x".repeat(43))).json().error).toBe("invalid_or_expired_token"); // giả
    await app.db.updateTable("authTokens").set({ expiresAt: new Date(Date.now() - 1000) }).where("userId", "=", u.id).execute();
    expect((await reset(second)).json().error).toBe("invalid_or_expired_token"); // hết hạn
    expect((await reset("ngan")).statusCode).toBe(400);
  });

  it("học viên và coach lạ không cấp được link; coach cấp được cho học viên của mình", async () => {
    const client = await createUser(app, "c@example.com", "0911111111");
    const victim = await createUser(app, "v@example.com", "0933333333");
    const coach = await createUser(app, "co@example.com", "0922222222", "coach");
    const url = `/api/v1/admin/users/${victim.id}/reset-link`;
    expect((await call(app, client.token, "POST", url)).statusCode).toBe(403);
    expect((await call(app, undefined, "POST", url)).statusCode).toBe(401);
    expect((await call(app, coach.token, "POST", url)).statusCode).toBe(404); // chưa phải học viên của coach
    await app.db.updateTable("profiles").set({ coachId: coach.id }).where("id", "=", victim.id).execute();
    expect((await call(app, coach.token, "POST", url)).statusCode).toBe(201);
    // coach không cấp được link cho admin hay coach khác
    const admin = await createUser(app, "ad@example.com", "0944444444", "admin");
    expect((await call(app, coach.token, "POST", `/api/v1/admin/users/${admin.id}/reset-link`)).statusCode).toBe(404);
  });
});

describe("xoá tài khoản & xuất dữ liệu", () => {
  it("xuất dữ liệu chỉ gồm dữ liệu của chính mình và không lộ mật khẩu", async () => {
    const a = await createUser(app, "a@example.com", "0911111111");
    const b = await createUser(app, "b@example.com", "0922222222");
    const today = new Date().toISOString().slice(0, 10);
    await call(app, a.token, "PUT", `/api/v1/body-metrics/${today}`, { weightKg: 80 });
    await call(app, b.token, "PUT", `/api/v1/body-metrics/${today}`, { weightKg: 99 });
    const res = await call(app, a.token, "GET", "/api/v1/me/export");
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-disposition"]).toMatch(/attachment/);
    const data = res.json();
    expect(data.bodyMetrics).toHaveLength(1);
    expect(data.bodyMetrics[0].weightKg).toBe("80.0");
    expect(data.account.email).toBe("a@example.com");
    expect(res.body).not.toMatch(/passwordHash|argon2|b@example/);
  });

  it("học viên, coach KHÔNG tự xoá được tài khoản (không còn DELETE /me); xoá chỉ là việc của admin", async () => {
    const client = await createUser(app, "a@example.com", "0911111111");
    const coach = await createUser(app, "co@example.com", "0922222222", "coach");
    for (const who of [client, coach]) {
      const res = await call(app, who.token, "DELETE", "/api/v1/me", { password: PW });
      expect(res.statusCode).toBe(404);
      expect((await call(app, who.token, "DELETE", `/api/v1/admin/users/${client.id}`, { password: PW })).statusCode).toBe(403);
    }
    expect((await call(app, undefined, "DELETE", `/api/v1/admin/users/${client.id}`, { password: PW })).statusCode).toBe(401);
    expect((await login(app, client.email, PW)).statusCode).toBe(200); // vẫn còn nguyên
  });

  it("admin xoá: cần đúng mật khẩu của CHÍNH admin; dữ liệu và đăng nhập của người bị xoá biến mất; người khác không ảnh hưởng", async () => {
    const admin = await createUser(app, "ad@example.com", "0900000001", "admin");
    const a = await createUser(app, "a@example.com", "0911111111");
    const b = await createUser(app, "b@example.com", "0922222222");
    const today = new Date().toISOString().slice(0, 10);
    await call(app, a.token, "PUT", `/api/v1/body-metrics/${today}`, { weightKg: 80 });
    await call(app, b.token, "PUT", `/api/v1/body-metrics/${today}`, { weightKg: 90 });
    const del = (body: object) => call(app, admin.token, "DELETE", `/api/v1/admin/users/${a.id}`, body);

    expect((await del({ password: "sai-mat-khau" })).json().error).toBe("invalid_current_password");
    expect((await del({})).statusCode).toBe(400);
    expect((await del({ password: PW, extra: 1 })).statusCode).toBe(400);
    expect((await call(app, admin.token, "DELETE", "/api/v1/admin/users/not-a-uuid", { password: PW })).statusCode).toBe(400);
    expect((await del({ password: PW })).statusCode).toBe(204);

    expect((await login(app, a.email, PW)).statusCode).toBe(401);
    expect((await call(app, a.token, "GET", "/api/v1/me")).statusCode).toBe(401);
    expect((await del({ password: PW })).statusCode).toBe(404); // đã xoá rồi
    const left = await app.db.selectFrom("bodyMetrics").select("userId").execute();
    expect(left.map((r) => r.userId)).toEqual([b.id]);

    const log = await app.db.selectFrom("auditLog").select(["actorId", "meta"]).where("action", "=", "user_deleted").executeTakeFirstOrThrow();
    expect(log.actorId).toBe(admin.id);
    expect(log.meta).toMatchObject({ userId: a.id, email: "a@example.com" });
  });

  it("admin không tự xoá mình (luôn còn ít nhất một admin), kể cả khi có admin khác", async () => {
    const admin = await createUser(app, "ad@example.com", "0911111111", "admin");
    const res = await call(app, admin.token, "DELETE", `/api/v1/admin/users/${admin.id}`, { password: PW });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("cannot_change_self");
    const admin2 = await createUser(app, "ad2@example.com", "0922222222", "admin");
    expect((await call(app, admin2.token, "DELETE", `/api/v1/admin/users/${admin.id}`, { password: PW })).statusCode).toBe(204);
  });
});
