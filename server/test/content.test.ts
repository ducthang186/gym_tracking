import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { cleanDb, makeApp, register, validBody } from "./helpers.js";

let app: FastifyInstance;
beforeAll(async () => {
  ({ app } = await makeApp());
});
afterAll(() => app.close());
beforeEach(async () => {
  await cleanDb(app);
  await app.db.deleteFrom("siteAssets").execute();
});

async function makeUser(email: string, phone: string, role?: "admin" | "coach") {
  const { user, accessToken } = (await register(app, validBody({ email, phone }))).json();
  if (role) await app.db.updateTable("users").set({ role }).where("id", "=", user.id).execute();
  return { id: user.id as string, token: accessToken as string };
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

function multipart(filename: string, type: string, data: Buffer) {
  const boundary = "----latis-test";
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { payload: Buffer.concat([head, data, tail]), contentType: `multipart/form-data; boundary=${boundary}` };
}

const upload = (token: string, filename: string, type: string, data: Buffer) => {
  const { payload, contentType } = multipart(filename, type, data);
  return app.inject({ method: "POST", url: "/api/v1/admin/about/photo", payload, headers: { ...auth(token), "content-type": contentType } });
};

const about = {
  name: "Trung Phạm",
  title: "Head Coach",
  bio: "Giới thiệu.",
  quote: "",
  badge: { title: "", subtitle: "" },
  stats: [{ value: "200+", label: "Học viên" }],
  achievements: [{ title: "Chứng chỉ", desc: "" }],
};

describe("nội dung trang giới thiệu", () => {
  it("công khai, không cần đăng nhập, có nội dung mặc định", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/public/about" });
    expect(res.statusCode).toBe(200);
    expect(res.json().about).toMatchObject({ name: "Trung Phạm", photoVersion: null });
    expect(res.headers["cache-control"]).toMatch(/public/);
  });

  it("chỉ admin được sửa (coach và học viên đều bị 403)", async () => {
    const client = await makeUser("c@example.com", "0911111111");
    const coach = await makeUser("co@example.com", "0922222222", "coach");
    const admin = await makeUser("ad@example.com", "0933333333", "admin");
    const put = (token?: string) => app.inject({ method: "PUT", url: "/api/v1/admin/about", payload: about, headers: token ? auth(token) : {} });
    expect((await put()).statusCode).toBe(401);
    expect((await put(client.token)).statusCode).toBe(403);
    expect((await put(coach.token)).statusCode).toBe(403);
    expect((await put(admin.token)).statusCode).toBe(200);
    const pub = (await app.inject({ method: "GET", url: "/api/v1/public/about" })).json().about;
    expect(pub.title).toBe("Head Coach");
    expect(pub.stats).toHaveLength(1);
  });

  it("validate nội dung: quá dài, quá nhiều mục, khoá lạ", async () => {
    const admin = await makeUser("ad@example.com", "0933333333", "admin");
    const put = (payload: object) => app.inject({ method: "PUT", url: "/api/v1/admin/about", payload, headers: auth(admin.token) });
    expect((await put({ ...about, bio: "x".repeat(1501) })).statusCode).toBe(400);
    expect((await put({ ...about, name: "" })).statusCode).toBe(400);
    expect((await put({ ...about, stats: Array.from({ length: 5 }, () => ({ value: "1", label: "a" })) })).statusCode).toBe(400);
    expect((await put({ ...about, achievements: Array.from({ length: 9 }, () => ({ title: "a", desc: "" })) })).statusCode).toBe(400);
    expect((await put({ ...about, html: "<script>" })).statusCode).toBe(400);
  });
});

describe("ảnh huấn luyện viên", () => {
  const png = () => sharp({ create: { width: 600, height: 400, channels: 3, background: "#08d9ff" } }).png().toBuffer();

  it("admin tải ảnh: được xử lý về WebP 3:4, công khai xem được, gỡ được", async () => {
    const admin = await makeUser("ad@example.com", "0933333333", "admin");
    expect((await app.inject({ method: "GET", url: "/api/v1/public/coach-photo" })).statusCode).toBe(404);

    const res = await upload(admin.token, "me.png", "image/png", await png());
    expect(res.statusCode).toBe(200);
    expect(res.json().about.photoVersion).toBeGreaterThan(0);

    const photo = await app.inject({ method: "GET", url: "/api/v1/public/coach-photo" });
    expect(photo.statusCode).toBe(200);
    expect(photo.headers["content-type"]).toBe("image/webp");
    expect(photo.headers["cache-control"]).toMatch(/max-age/);
    const meta = await sharp(photo.rawPayload).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 900, height: 1200 });

    expect((await app.inject({ method: "DELETE", url: "/api/v1/admin/about/photo", headers: auth(admin.token) })).statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: "/api/v1/public/coach-photo" })).statusCode).toBe(404);
  });

  it("từ chối tệp không phải ảnh (kể cả khi khai báo image/png), tệp quá lớn, và người không phải admin", async () => {
    const admin = await makeUser("ad@example.com", "0933333333", "admin");
    const client = await makeUser("c@example.com", "0911111111");
    const fake = await upload(admin.token, "x.png", "image/png", Buffer.from("<html><script>alert(1)</script></html>"));
    expect(fake.statusCode).toBe(400);
    expect(fake.json().error).toBe("invalid_image");
    const big = await upload(admin.token, "big.png", "image/png", Buffer.alloc(6 * 1024 * 1024, 1));
    expect(big.statusCode).toBe(413);
    expect((await upload(client.token, "me.png", "image/png", await png())).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/api/v1/admin/about/photo", headers: auth(admin.token) })).statusCode).toBe(400); // không phải multipart
  });
});
