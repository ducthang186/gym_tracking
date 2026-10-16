import type { FastifyInstance } from "fastify";
import { SignJWT } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hashToken, JWT_AUDIENCE, JWT_ISSUER } from "../src/modules/auth/tokens.js";
import { cleanDb, login, logout, makeApp, me, ORIGIN, refresh, refreshCookie, register, validBody } from "./helpers.js";

let app: FastifyInstance;

beforeAll(async () => {
  ({ app } = await makeApp());
});
afterAll(() => app.close());
beforeEach(() => cleanDb(app));

const userCount = async () => Number((await app.db.selectFrom("users").select((eb) => eb.fn.countAll().as("n")).executeTakeFirstOrThrow()).n);

describe("đăng ký", () => {
  it("tạo tài khoản + hồ sơ, chuẩn hoá email/SĐT, đăng nhập luôn", async () => {
    const res = await register(app, validBody({ email: "  An@Example.COM ", phone: "091 234 5678", fullName: "  Nguyễn   Văn   An " }));
    expect(res.statusCode).toBe(201);

    const body = res.json();
    expect(body.user).toMatchObject({
      email: "an@example.com",
      phone: "+84912345678",
      fullName: "Nguyễn Văn An",
      role: "client",
      status: "active",
    });
    expect(body.accessToken).toBeTruthy();
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|password_hash|argon2/);

    const row = await app.db.selectFrom("users").innerJoin("profiles", "profiles.id", "users.id").selectAll("users").select("profiles.fullName").executeTakeFirstOrThrow();
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row.fullName).toBe("Nguyễn Văn An");
  });

  it("đặt refresh token vào cookie httpOnly, SameSite=Lax, chỉ gửi tới /api/v1/auth", async () => {
    const res = await register(app, validBody());
    const cookie = res.cookies.find((c) => c.name === "latis_rt")!;
    expect(cookie).toBeDefined();
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/api/v1/auth" });
    expect(cookie.maxAge).toBeGreaterThan(0);
  });

  it("chỉ lưu SHA-256 của refresh token, không lưu token gốc", async () => {
    const res = await register(app, validBody());
    const raw = refreshCookie(res)!;
    const stored = await app.db.selectFrom("refreshTokens").select("tokenHash").execute();
    expect(stored.map((r) => r.tokenHash)).toEqual([hashToken(raw)]);
    expect(stored[0]!.tokenHash).not.toBe(raw);
  });

  it("từ chối email trùng, không phân biệt hoa/thường", async () => {
    await register(app, validBody());
    const res = await register(app, validBody({ email: "AN@example.com", phone: "0987654321" }));
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: "email_taken", details: { fields: ["email"] } });
  });

  it("từ chối SĐT trùng dù viết theo cách khác", async () => {
    await register(app, validBody());
    const res = await register(app, validBody({ email: "khac@example.com", phone: "+84 912 345 678" }));
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: "phone_taken", details: { fields: ["phone"] } });
  });

  it("báo đủ cả hai trường khi cả email lẫn SĐT đều trùng", async () => {
    await register(app, validBody());
    const res = await register(app, validBody());
    expect(res.statusCode).toBe(409);
    expect(res.json().details.fields).toEqual(["email", "phone"]);
  });

  it("hai request đăng ký đồng thời cùng email: đúng một cái thành công", async () => {
    const [a, b] = await Promise.all([
      register(app, validBody({ phone: "0912345678" })),
      register(app, validBody({ phone: "0987654321" })),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409]);
    expect(await userCount()).toBe(1);
  });

  it.each([
    ["email sai định dạng", { email: "khong-phai-email" }, "email", "invalid_email"],
    ["SĐT sai", { phone: "0212345678" }, "phone", "invalid_phone"],
    ["SĐT có chữ", { phone: "09123abc78" }, "phone", "invalid_phone"],
    ["mật khẩu quá ngắn", { password: "ngan" }, "password", "too_short"],
    ["mật khẩu quá dài", { password: "a".repeat(129) }, "password", "too_long"],
    ["họ tên quá ngắn", { fullName: "A" }, "fullName", "too_short"],
    ["họ tên chứa số", { fullName: "An123" }, "fullName", "invalid_name"],
    ["họ tên chứa ký tự lạ", { fullName: "An <script>" }, "fullName", "invalid_name"],
  ])("từ chối %s", async (_label, over, field, code) => {
    const res = await register(app, validBody(over));
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "validation_error" });
    expect(res.json().details.fields).toContainEqual({ field, code });
    expect(await userCount()).toBe(0);
  });

  it("báo thiếu từng trường bắt buộc", async () => {
    const res = await register(app, {});
    expect(res.statusCode).toBe(400);
    const fields = res.json().details.fields.map((f: { field: string }) => f.field);
    expect(fields).toEqual(expect.arrayContaining(["email", "fullName", "phone", "password"]));
  });

  it("chấp nhận họ tên tiếng Việt có dấu và dấu nháy/gạch nối", async () => {
    const res = await register(app, validBody({ fullName: "Trần Thị Bích-Ngọc O'Neil" }));
    expect(res.statusCode).toBe(201);
  });

  it("KHÔNG cho tự đặt vai trò: khoá lạ như `role` bị từ chối", async () => {
    const res = await register(app, validBody({ role: "admin" }));
    expect(res.statusCode).toBe(400);
    expect(res.json().details.fields).toContainEqual({ field: "role", code: "invalid" });
    expect(await userCount()).toBe(0);
  });

  it("trường bẫy: bot điền `website` nhận thành công giả nhưng không tạo gì", async () => {
    const res = await register(app, validBody({ website: "http://spam.example" }));
    expect(res.statusCode).toBe(201);
    expect(await userCount()).toBe(0);
    expect(refreshCookie(res)).toBeUndefined();
  });

  it("từ chối body không phải JSON", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: "email=a", headers: { "content-type": "text/plain" } });
    expect(res.statusCode).toBe(415);
    expect(res.json()).toEqual({ error: "bad_request" });
  });
});

describe("đăng nhập", () => {
  beforeEach(async () => {
    await register(app, validBody());
  });

  it("đăng nhập bằng email (không phân biệt hoa/thường)", async () => {
    const res = await login(app, "AN@Example.com", "matkhau-manh-1");
    expect(res.statusCode).toBe(200);
    expect(res.json().user.email).toBe("an@example.com");
    expect(res.json().accessToken).toBeTruthy();
    expect(refreshCookie(res)).toBeTruthy();
  });

  it.each(["0912345678", "091 234 5678", "+84912345678", "84912345678"])("đăng nhập bằng SĐT dạng %j", async (phone) => {
    const res = await login(app, phone, "matkhau-manh-1");
    expect(res.statusCode).toBe(200);
  });

  it("sai mật khẩu → 401 chung chung", async () => {
    const res = await login(app, "an@example.com", "sai-mat-khau");
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "invalid_credentials" });
    expect(refreshCookie(res)).toBeUndefined();
  });

  it("tài khoản không tồn tại cho phản hồi GIỐNG HỆT sai mật khẩu (không lộ ai đã đăng ký)", async () => {
    const wrongPw = await login(app, "an@example.com", "sai-mat-khau");
    const noUser = await login(app, "khong-ton-tai@example.com", "sai-mat-khau");
    const badPhone = await login(app, "abc", "sai-mat-khau");
    expect(noUser.statusCode).toBe(wrongPw.statusCode);
    expect(noUser.json()).toEqual(wrongPw.json());
    expect(badPhone.json()).toEqual(wrongPw.json());
  });

  it("ghi audit khi đăng nhập sai với tài khoản có thật, nhưng không ghi với tài khoản không tồn tại", async () => {
    await login(app, "an@example.com", "sai");
    await login(app, "ma@example.com", "sai");
    const rows = await app.db.selectFrom("auditLog").select("action").execute();
    expect(rows.map((r) => r.action)).toEqual(["login_failed"]);
  });

  it("từ chối khoá lạ trong body", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { identifier: "an@example.com", password: "x", role: "admin" } });
    expect(res.statusCode).toBe(400);
  });

  it("đăng nhập đúng đặt lại bộ đếm sai và ghi last_login_at", async () => {
    await login(app, "an@example.com", "sai");
    await login(app, "an@example.com", "sai");
    await login(app, "an@example.com", "matkhau-manh-1");
    const u = await app.db.selectFrom("users").select(["failedLogins", "lastLoginAt"]).executeTakeFirstOrThrow();
    expect(u.failedLogins).toBe(0);
    expect(u.lastLoginAt).toBeInstanceOf(Date);
  });
});

describe("khoá tài khoản khi đăng nhập sai nhiều lần", () => {
  it("khoá sau N lần sai, kể cả khi sau đó nhập đúng mật khẩu", async () => {
    const { app: strict } = await makeApp({ MAX_FAILED_LOGINS: "3" });
    try {
      await register(strict, validBody());
      for (let i = 0; i < 3; i++) expect((await login(strict, "an@example.com", "sai")).statusCode).toBe(401);

      const locked = await login(strict, "an@example.com", "matkhau-manh-1"); // mật khẩu ĐÚNG nhưng đang bị khoá
      expect(locked.statusCode).toBe(429);
      expect(locked.json().error).toBe("too_many_attempts");
      expect(locked.json().details.retryAfterSeconds).toBeGreaterThan(0);

      const actions = (await strict.db.selectFrom("auditLog").select("action").orderBy("id").execute()).map((r) => r.action);
      expect(actions).toEqual(["login_failed", "login_failed", "account_locked"]);

      // Hết thời gian khoá → đăng nhập lại được và có đủ lượt thử mới.
      await strict.db.updateTable("users").set({ lockedUntil: new Date(Date.now() - 1000) }).execute();
      expect((await login(strict, "an@example.com", "matkhau-manh-1")).statusCode).toBe(200);
    } finally {
      await strict.close();
    }
  });
});

describe("duyệt tay tài khoản mới (REQUIRE_APPROVAL=true)", () => {
  it("đăng ký xong chưa đăng nhập được cho tới khi được duyệt", async () => {
    const { app: gated } = await makeApp({ REQUIRE_APPROVAL: "true" });
    try {
      const reg = await register(gated, validBody());
      expect(reg.statusCode).toBe(201);
      expect(reg.json()).toMatchObject({ pendingApproval: true, user: { status: "pending" } });
      expect(reg.json().accessToken).toBeUndefined();
      expect(refreshCookie(reg)).toBeUndefined();

      const ok = await login(gated, "an@example.com", "matkhau-manh-1");
      expect(ok.statusCode).toBe(403);
      expect(ok.json()).toEqual({ error: "account_pending" });

      // Mật khẩu SAI vẫn nhận lỗi chung — trạng thái chỉ lộ cho người biết mật khẩu.
      const wrong = await login(gated, "an@example.com", "sai");
      expect(wrong.statusCode).toBe(401);
      expect(wrong.json()).toEqual({ error: "invalid_credentials" });

      await gated.db.updateTable("users").set({ status: "active" }).execute();
      expect((await login(gated, "an@example.com", "matkhau-manh-1")).statusCode).toBe(200);
    } finally {
      await gated.close();
    }
  });
});

describe("access token và GET /me", () => {
  it("cần token", async () => {
    expect((await me(app)).statusCode).toBe(401);
    expect((await me(app, "rac")).statusCode).toBe(401);
  });

  it("trả đúng người dùng", async () => {
    const { accessToken } = (await register(app, validBody())).json();
    const res = await me(app, accessToken);
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toMatchObject({ email: "an@example.com", fullName: "Nguyễn Văn An", role: "client" });
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("từ chối token bị sửa chữ ký", async () => {
    const { accessToken } = (await register(app, validBody())).json();
    const tampered = accessToken.slice(0, -3) + (accessToken.endsWith("AAA") ? "BBB" : "AAA");
    expect((await me(app, tampered)).statusCode).toBe(401);
  });

  async function signWith(secret: string, userId: string, opts: { expSecondsFromNow: number; iss?: string; aud?: string }) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuer(opts.iss ?? JWT_ISSUER)
      .setAudience(opts.aud ?? JWT_AUDIENCE)
      .setIssuedAt(now - 3600)
      .setExpirationTime(now + opts.expSecondsFromNow)
      .sign(new TextEncoder().encode(secret));
  }

  it("từ chối token đã hết hạn / ký bằng khoá khác / sai issuer / sai audience", async () => {
    const reg = (await register(app, validBody())).json();
    const secret = process.env.JWT_SECRET!;
    expect((await me(app, await signWith(secret, reg.user.id, { expSecondsFromNow: -10 }))).statusCode).toBe(401);
    expect((await me(app, await signWith("khoa-khac-".repeat(5), reg.user.id, { expSecondsFromNow: 600 }))).statusCode).toBe(401);
    expect((await me(app, await signWith(secret, reg.user.id, { expSecondsFromNow: 600, iss: "ke-gia-mao" }))).statusCode).toBe(401);
    expect((await me(app, await signWith(secret, reg.user.id, { expSecondsFromNow: 600, aud: "noi-khac" }))).statusCode).toBe(401);
    // Đối chứng: cùng cách ký nhưng hợp lệ thì vào được → các lỗi trên là do đúng lý do.
    expect((await me(app, await signWith(secret, reg.user.id, { expSecondsFromNow: 600 }))).statusCode).toBe(200);
  });

  it("khoá tài khoản có hiệu lực NGAY, không cần đợi token hết hạn", async () => {
    const { accessToken } = (await register(app, validBody())).json();
    expect((await me(app, accessToken)).statusCode).toBe(200);
    await app.db.updateTable("users").set({ status: "suspended" }).execute();
    expect((await me(app, accessToken)).statusCode).toBe(401);
  });

  it("tài khoản bị khoá không đăng nhập được, nhưng chỉ lộ lý do khi mật khẩu đúng", async () => {
    await register(app, validBody());
    await app.db.updateTable("users").set({ status: "suspended" }).execute();
    const ok = await login(app, "an@example.com", "matkhau-manh-1");
    expect(ok.statusCode).toBe(403);
    expect(ok.json()).toEqual({ error: "account_suspended" });
    expect((await login(app, "an@example.com", "sai")).json()).toEqual({ error: "invalid_credentials" });
  });
});

describe("refresh token", () => {
  it("xoay vòng: cấp token mới, token cũ bị đánh dấu đã dùng", async () => {
    const reg = await register(app, validBody());
    const old = refreshCookie(reg)!;

    const res = await refresh(app, old);
    expect(res.statusCode).toBe(200);
    const fresh = refreshCookie(res)!;
    expect(fresh).toBeTruthy();
    expect(fresh).not.toBe(old);
    expect(res.json().user.email).toBe("an@example.com");
    expect((await me(app, res.json().accessToken)).statusCode).toBe(200);

    const rows = await app.db.selectFrom("refreshTokens").select(["tokenHash", "usedAt", "familyId"]).execute();
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.familyId)).size).toBe(1); // cùng một họ token
    expect(rows.find((r) => r.tokenHash === hashToken(old))!.usedAt).toBeInstanceOf(Date);
  });

  it("dùng lại token cũ NGAY SAU KHI xoay vòng (hai tab) → refresh_conflict, KHÔNG thu hồi cả họ", async () => {
    const old = refreshCookie(await register(app, validBody()))!;
    const first = await refresh(app, old);
    const fresh = refreshCookie(first)!;

    const dup = await refresh(app, old);
    expect(dup.statusCode).toBe(401);
    expect(dup.json()).toEqual({ error: "refresh_conflict" });
    expect(dup.cookies.find((c) => c.name === "latis_rt")).toBeUndefined(); // giữ cookie, không xoá

    expect((await refresh(app, fresh)).statusCode).toBe(200); // token mới vẫn dùng được
  });

  it("dùng lại token cũ SAU ngưỡng ân hạn = bị đánh cắp → thu hồi cả họ token", async () => {
    const old = refreshCookie(await register(app, validBody()))!;
    const fresh = refreshCookie(await refresh(app, old))!;

    // Giả lập: token cũ đã được dùng từ 1 phút trước.
    await app.db.updateTable("refreshTokens").set({ usedAt: new Date(Date.now() - 60_000) }).where("tokenHash", "=", hashToken(old)).execute();

    const replay = await refresh(app, old);
    expect(replay.statusCode).toBe(401);
    expect(replay.json()).toEqual({ error: "token_reuse" });

    // Cả token mới (của người dùng thật) cũng bị thu hồi → buộc đăng nhập lại.
    const afterwards = await refresh(app, fresh);
    expect(afterwards.statusCode).toBe(401);
    expect(afterwards.json()).toEqual({ error: "invalid_refresh_token" });

    const audits = await app.db.selectFrom("auditLog").select("action").execute();
    expect(audits.map((a) => a.action)).toContain("refresh_token_reuse");
  });

  it("không có cookie → 401", async () => {
    const res = await refresh(app, undefined);
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "no_refresh_cookie" });
  });

  it("token không tồn tại → 401 và xoá cookie chết", async () => {
    const res = await refresh(app, "token-khong-ton-tai");
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "invalid_refresh_token" });
    const cleared = res.cookies.find((c) => c.name === "latis_rt");
    expect(cleared?.value).toBe("");
  });

  it("token hết hạn → 401", async () => {
    const old = refreshCookie(await register(app, validBody()))!;
    await app.db.updateTable("refreshTokens").set({ expiresAt: new Date(Date.now() - 1000) }).execute();
    expect((await refresh(app, old)).statusCode).toBe(401);
  });

  it("chống CSRF: thiếu hoặc sai Origin đều bị từ chối, kể cả khi cookie đúng", async () => {
    const old = refreshCookie(await register(app, validBody()))!;
    for (const origin of [null, "https://ke-tan-cong.example", "http://localhost:5173.evil.com"]) {
      const res = await refresh(app, old, origin);
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: "bad_origin" });
    }
    expect((await refresh(app, old)).statusCode).toBe(200); // token không bị tiêu hao bởi các lần bị chặn
  });

  it("tài khoản bị khoá thì không refresh được nữa", async () => {
    const old = refreshCookie(await register(app, validBody()))!;
    await app.db.updateTable("users").set({ status: "suspended" }).execute();
    expect((await refresh(app, old)).statusCode).toBe(401);
  });

  it("hai request refresh ĐỒNG THỜI cùng một token: không bao giờ cấp hai token song song", async () => {
    const old = refreshCookie(await register(app, validBody()))!;
    const [a, b] = await Promise.all([refresh(app, old), refresh(app, old)]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 401]);
    expect([a, b].find((r) => r.statusCode === 401)!.json()).toEqual({ error: "refresh_conflict" });
  });
});

describe("đăng xuất", () => {
  it("thu hồi cả họ token và xoá cookie", async () => {
    const old = refreshCookie(await register(app, validBody()))!;
    const fresh = refreshCookie(await refresh(app, old))!;

    const res = await logout(app, fresh);
    expect(res.statusCode).toBe(204);
    expect(res.cookies.find((c) => c.name === "latis_rt")?.value).toBe("");

    expect((await refresh(app, fresh)).statusCode).toBe(401);
  });

  it("đăng xuất khi không có cookie vẫn thành công (idempotent)", async () => {
    expect((await logout(app, undefined)).statusCode).toBe(204);
  });

  it("chống CSRF: đăng xuất phải đúng Origin", async () => {
    const old = refreshCookie(await register(app, validBody()))!;
    const res = await app.inject({ method: "POST", url: "/api/v1/auth/logout", headers: { origin: "https://ke-tan-cong.example" }, cookies: { latis_rt: old } });
    expect(res.statusCode).toBe(403);
    expect((await refresh(app, old)).statusCode).toBe(200); // vẫn còn đăng nhập
  });
});

describe("giới hạn tốc độ", () => {
  it("đăng ký: vượt 5 lần/giờ/IP bị chặn 429", async () => {
    const { app: limited } = await makeApp({ RATE_LIMIT_SCALE: "1" });
    try {
      const codes: number[] = [];
      for (let i = 0; i < 7; i++) codes.push((await register(limited, {})).statusCode);
      expect(codes.slice(0, 5)).toEqual([400, 400, 400, 400, 400]);
      expect(codes.slice(5)).toEqual([429, 429]);
      const blocked = await register(limited, {});
      expect(blocked.json().error).toBe("rate_limited");
      expect(blocked.headers["retry-after"]).toBeTruthy();
    } finally {
      await limited.close();
    }
  });

  it("đăng nhập: vượt 10 lần/15 phút/IP bị chặn 429", async () => {
    const { app: limited } = await makeApp({ RATE_LIMIT_SCALE: "1", MAX_FAILED_LOGINS: "100" });
    try {
      let last = 0;
      for (let i = 0; i < 11; i++) last = (await login(limited, "khong-co@example.com", "x")).statusCode;
      expect(last).toBe(429);
    } finally {
      await limited.close();
    }
  });
});

describe("khác", () => {
  it("health check", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("route không tồn tại trả JSON 404", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/khong-co" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "not_found" });
  });

  it("có header bảo mật cơ bản", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

// Dùng chung hằng để tránh cảnh báo "unused" khi chỉnh sửa test.
void ORIGIN;
