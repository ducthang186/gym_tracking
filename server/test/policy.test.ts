import type { FastifyInstance } from "fastify";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addDays, toDateStr } from "../src/lib/dates.js";
import { mondayOf } from "../src/modules/checkins/checkins.service.js";
import { call, cleanDb, createUser, makeApp } from "./helpers.js";

let app: FastifyInstance;
beforeAll(async () => {
  ({ app } = await makeApp());
});
afterAll(() => app.close());
beforeEach(() => cleanDb(app));

const TODAY = toDateStr(new Date());
const WEEK = mondayOf(TODAY);

function multipart(fields: Record<string, string>, data: Buffer) {
  const b = "----latis-policy";
  const parts = Object.entries(fields).map(([k, v]) => Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  const head = Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="photo"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`);
  return { payload: Buffer.concat([...parts, head, data, Buffer.from(`\r\n--${b}--\r\n`)]), contentType: `multipart/form-data; boundary=${b}` };
}
const png = () => sharp({ create: { width: 300, height: 400, channels: 3, background: "#123456" } }).png().toBuffer();
const upload = async (token: string, fields: Record<string, string>, data: Buffer) => {
  const { payload, contentType } = multipart(fields, data);
  return app.inject({ method: "POST", url: "/api/v1/photos", payload, headers: { authorization: `Bearer ${token}`, "content-type": contentType } });
};

/** Hai coach, mỗi coach một học viên; học viên có đủ loại dữ liệu. */
async function setup() {
  const admin = await createUser(app, "ad@example.com", "0900000001", "admin");
  const coachA = await createUser(app, "ca@example.com", "0900000002", "coach");
  const coachB = await createUser(app, "cb@example.com", "0900000003", "coach");
  const clientA = await createUser(app, "a@example.com", "0900000004");
  const clientB = await createUser(app, "b@example.com", "0900000005");
  await app.db.updateTable("profiles").set({ coachId: coachA.id }).where("id", "=", clientA.id).execute();
  await app.db.updateTable("profiles").set({ coachId: coachB.id }).where("id", "=", clientB.id).execute();

  await call(app, clientA.token, "PUT", `/api/v1/body-metrics/${TODAY}`, { weightKg: 80 });
  const foodId = (await call(app, clientA.token, "GET", "/api/v1/foods")).json().foods[0].id;
  await call(app, clientA.token, "POST", "/api/v1/food-log", { loggedOn: TODAY, foodId, grams: 100 });
  await call(app, clientA.token, "POST", "/api/v1/workout-log", { performedOn: TODAY, exerciseName: "Squat", reps: 5, weightKg: 100 });
  await call(app, clientA.token, "PUT", `/api/v1/checkins/${WEEK}`, { trained: true, note: "ổn" });
  const photo = (await upload(clientA.token, { takenOn: TODAY, angle: "front" }, await png())).json().photo;
  return { admin, coachA, coachB, clientA, clientB, photoId: photo.id as string };
}

describe("ma trận phân quyền xem dữ liệu học viên", () => {
  // [mô tả, ai gọi, kỳ vọng với học viên A]
  const routes = (id: string, photoId: string): Array<[string, "GET" | "PUT" | "POST", string, object?]> => [
    ["overview", "GET", `/api/v1/clients/${id}/overview?date=${TODAY}`],
    ["food-log", "GET", `/api/v1/clients/${id}/food-log?date=${TODAY}`],
    ["workout-log", "GET", `/api/v1/clients/${id}/workout-log?date=${TODAY}`],
    ["body-metrics", "GET", `/api/v1/clients/${id}/body-metrics`],
    ["photos", "GET", `/api/v1/clients/${id}/photos`],
    ["photo file", "GET", `/api/v1/clients/${id}/photos/${photoId}/file?size=thumb`],
    ["checkins", "GET", `/api/v1/clients/${id}/checkins`],
    ["coach note", "PUT", `/api/v1/clients/${id}/checkins/${WEEK}/coach-note`, { note: "Tốt lắm" }],
    ["set target", "POST", `/api/v1/clients/${id}/nutrition-targets`, { effectiveFrom: TODAY, kcal: 2000, proteinG: 150, carbsG: 200, fatG: 60 }],
  ];

  it("coach của học viên và admin: đọc/ghi được mọi mục", async () => {
    const { admin, coachA, clientA, photoId } = await setup();
    for (const who of [coachA, admin]) {
      for (const [name, method, url, body] of routes(clientA.id, photoId)) {
        const res = await call(app, who.token, method, url, body);
        expect(res.statusCode, `${name} (${who.email})`).toBe(200);
      }
    }
  });

  it("coach khác, học viên khác, và người chưa đăng nhập: bị chặn ở MỌI mục (404/403/401, không lộ dữ liệu)", async () => {
    const { coachB, clientB, clientA, photoId } = await setup();
    for (const [name, method, url, body] of routes(clientA.id, photoId)) {
      const asOtherCoach = await call(app, coachB.token, method, url, body);
      expect(asOtherCoach.statusCode, `${name} (coach khác)`).toBe(404);
      const asOtherClient = await call(app, clientB.token, method, url, body);
      expect(asOtherClient.statusCode, `${name} (học viên khác)`).toBe(403);
      const anon = await call(app, undefined, method, url, body);
      expect(anon.statusCode, `${name} (ẩn danh)`).toBe(401);
    }
  });

  it("chính học viên không dùng được đường dẫn /clients của mình (đó là cổng dành cho nhân viên)", async () => {
    const { clientA, photoId } = await setup();
    const res = await call(app, clientA.token, "GET", routes(clientA.id, photoId)[0]![2]);
    expect(res.statusCode).toBe(403);
  });

  it("coach không xem được dữ liệu của admin/coach khác dù biết id (chỉ học viên)", async () => {
    const { coachA, coachB, admin } = await setup();
    for (const target of [coachB, admin, coachA]) {
      expect((await call(app, coachA.token, "GET", `/api/v1/clients/${target.id}/overview?date=${TODAY}`)).statusCode).toBe(404);
    }
  });

  it("không dùng id ảnh của người này để đọc qua học viên khác của cùng coach", async () => {
    const { admin, clientA, clientB, photoId } = await setup();
    const res = await call(app, admin.token, "GET", `/api/v1/clients/${clientB.id}/photos/${photoId}/file`);
    expect(res.statusCode).toBe(404); // ảnh thuộc A, không thuộc B
    void clientA;
  });

  it("mọi lần xem đều được ghi audit_log (ai xem dữ liệu của ai)", async () => {
    const { coachA, clientA, photoId } = await setup();
    await app.db.deleteFrom("auditLog").execute();
    for (const [, method, url, body] of routes(clientA.id, photoId)) await call(app, coachA.token, method, url, body);
    const rows = await app.db.selectFrom("auditLog").select(["actorId", "targetUserId", "action"]).execute();
    expect(rows).toHaveLength(9);
    expect(rows.every((r) => r.actorId === coachA.id && r.targetUserId === clientA.id)).toBe(true);
    expect(rows.map((r) => r.action)).toContain("read:client_photos");
  });

  it("tổng quan trả đúng dữ liệu của học viên và đặt mục tiêu thì học viên thấy", async () => {
    const { coachA, clientA } = await setup();
    const ov = (await call(app, coachA.token, "GET", `/api/v1/clients/${clientA.id}/overview?date=${TODAY}`)).json();
    expect(ov.client).toMatchObject({ id: clientA.id, email: "a@example.com" });
    expect(ov.metrics).toHaveLength(1);
    expect(ov.summary.days[0].kcal).toBeGreaterThan(0);
    expect(ov.checkins[0].note).toBe("ổn");
    expect(JSON.stringify(ov)).not.toMatch(/passwordHash/);

    await call(app, coachA.token, "POST", `/api/v1/clients/${clientA.id}/nutrition-targets`, { effectiveFrom: TODAY, kcal: 2100, proteinG: 150, carbsG: 220, fatG: 60 });
    const t = (await call(app, clientA.token, "GET", `/api/v1/nutrition-targets/current?date=${TODAY}`)).json();
    expect(t.target.kcal).toBe(2100);
    const note = (await call(app, clientA.token, "GET", "/api/v1/checkins")).json().checkins[0];
    expect(note.coachNote).toBeNull();
    await call(app, coachA.token, "PUT", `/api/v1/clients/${clientA.id}/checkins/${WEEK}/coach-note`, { note: "Giữ vững nhé" });
    expect((await call(app, clientA.token, "GET", "/api/v1/checkins")).json().checkins[0].coachNote).toBe("Giữ vững nhé");
  });
});

describe("check-in tuần", () => {
  const body = { trained: true };

  it("ghi / ghi đè / liệt kê; chỉ nhận thứ Hai; trained phải là true/false; không ghi cho tuần tương lai", async () => {
    const a = await createUser(app, "a@example.com", "0911111111");
    expect((await call(app, a.token, "PUT", `/api/v1/checkins/${WEEK}`, body)).statusCode).toBe(200);
    await call(app, a.token, "PUT", `/api/v1/checkins/${WEEK}`, { trained: false, note: "  tốt " });
    const list = (await call(app, a.token, "GET", "/api/v1/checkins")).json().checkins;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ trained: false, note: "tốt" });

    expect((await call(app, a.token, "PUT", `/api/v1/checkins/${addDays(WEEK, 1)}`, body)).statusCode).toBe(400); // không phải thứ Hai
    expect((await call(app, a.token, "PUT", `/api/v1/checkins/${addDays(WEEK, 14)}`, body)).statusCode).toBe(400); // tương lai
    for (const bad of [{ trained: "yes" }, { trained: 1 }, { trained: undefined }, { userId: "x" }, { energy: 3 }]) {
      expect((await call(app, a.token, "PUT", `/api/v1/checkins/${WEEK}`, { ...body, ...bad })).statusCode).toBe(400);
    }
  });

  it("A không thấy check-in của B", async () => {
    const a = await createUser(app, "a@example.com", "0911111111");
    const b = await createUser(app, "b@example.com", "0922222222");
    await call(app, b.token, "PUT", `/api/v1/checkins/${WEEK}`, body);
    expect((await call(app, a.token, "GET", "/api/v1/checkins")).json().checkins).toEqual([]);
  });
});

describe("ảnh tiến độ", () => {
  it("tải lên → thumbnail và ảnh đầy đủ (WebP, không EXIF) → xoá", async () => {
    const a = await createUser(app, "a@example.com", "0911111111");
    const res = await upload(a.token, { takenOn: TODAY, angle: "side" }, await png());
    expect(res.statusCode).toBe(201);
    const { id } = res.json().photo;
    const thumb = await call(app, a.token, "GET", `/api/v1/photos/${id}/file?size=thumb`);
    const full = await call(app, a.token, "GET", `/api/v1/photos/${id}/file?size=full`);
    expect((await sharp(thumb.rawPayload).metadata())).toMatchObject({ format: "webp", width: 400, height: 533 });
    expect((await sharp(full.rawPayload).metadata())).toMatchObject({ format: "webp", width: 300, height: 400 });
    expect(thumb.headers["cache-control"]).toMatch(/private/);
    expect((await call(app, a.token, "GET", "/api/v1/photos")).json().photos).toHaveLength(1);
    expect((await call(app, a.token, "DELETE", `/api/v1/photos/${id}`)).statusCode).toBe(204);
    expect((await call(app, a.token, "GET", `/api/v1/photos/${id}/file`)).statusCode).toBe(404);
  });

  it("A không xem / xoá được ảnh của B; ảnh cần đăng nhập", async () => {
    const a = await createUser(app, "a@example.com", "0911111111");
    const b = await createUser(app, "b@example.com", "0922222222");
    const { id } = (await upload(b.token, { takenOn: TODAY, angle: "front" }, await png())).json().photo;
    expect((await call(app, a.token, "GET", `/api/v1/photos/${id}/file`)).statusCode).toBe(404);
    expect((await call(app, a.token, "DELETE", `/api/v1/photos/${id}`)).statusCode).toBe(404);
    expect((await call(app, a.token, "GET", "/api/v1/photos")).json().photos).toEqual([]);
    expect((await call(app, undefined, "GET", `/api/v1/photos/${id}/file`)).statusCode).toBe(401);
    expect((await call(app, b.token, "GET", `/api/v1/photos/${id}/file`)).statusCode).toBe(200);
  });

  it("từ chối tệp giả dạng ảnh, thiếu/ sai trường, ngày tương lai, quá lớn", async () => {
    const a = await createUser(app, "a@example.com", "0911111111");
    const fake = await upload(a.token, { takenOn: TODAY, angle: "front" }, Buffer.from("<script>alert(1)</script>"));
    expect(fake.json().error).toBe("invalid_image");
    expect((await upload(a.token, { angle: "front" }, await png())).statusCode).toBe(400);
    expect((await upload(a.token, { takenOn: TODAY, angle: "top" }, await png())).statusCode).toBe(400);
    expect((await upload(a.token, { takenOn: addDays(TODAY, 9), angle: "front" }, await png())).statusCode).toBe(400);
    expect((await upload(a.token, { takenOn: TODAY, angle: "front" }, Buffer.alloc(9 * 1024 * 1024, 1))).statusCode).toBe(413);
    expect((await call(app, a.token, "GET", "/api/v1/photos")).json().photos).toEqual([]);
  });

  it("admin xoá tài khoản thì xoá luôn tệp ảnh trên đĩa", async () => {
    const a = await createUser(app, "a@example.com", "0911111111");
    await upload(a.token, { takenOn: TODAY, angle: "front" }, await png());
    const { readdir } = await import("node:fs/promises");
    const dir = `${process.env.STORAGE_DIR}/photos/${a.id}`;
    expect((await readdir(dir)).length).toBe(2);
    const admin = await createUser(app, "ad@example.com", "0900000009", "admin");
    await call(app, admin.token, "DELETE", `/api/v1/admin/users/${a.id}`, { password: "matkhau-manh-1" });
    await expect(readdir(dir)).rejects.toThrow();
  });
});
