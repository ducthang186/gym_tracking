import sharp from "sharp";
import type { Db } from "../../db/index.js";
import { audit } from "../../lib/audit.js";
import { badRequest } from "../../lib/errors.js";
import { aboutSchema, type About } from "./schemas.js";

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

export function createContentService(db: Db) {
  async function photoVersion(): Promise<number | null> {
    const row = await db.selectFrom("siteAssets").select("updatedAt").where("key", "=", "coach_photo").executeTakeFirst();
    return row ? row.updatedAt.getTime() : null;
  }

  return {
    async getAbout(): Promise<About & { photoVersion: number | null }> {
      const row = await db.selectFrom("siteContent").select("data").where("key", "=", "about").executeTakeFirstOrThrow();
      // Dữ liệu trong DB do chính server ghi nên đã hợp lệ; parse lại để bảo đảm hình dạng nếu có ai sửa tay.
      return { ...aboutSchema.parse(row.data), photoVersion: await photoVersion() };
    },

    async setAbout(actorId: string, about: About, ip?: string): Promise<void> {
      await db
        .insertInto("siteContent")
        .values({ key: "about", data: JSON.stringify(about), updatedBy: actorId })
        .onConflict((oc) => oc.column("key").doUpdateSet({ data: JSON.stringify(about), updatedBy: actorId, updatedAt: new Date() }))
        .execute();
      await audit(db, { actorId, action: "about_updated", ip });
    },

    /**
     * Ảnh người dùng tải lên KHÔNG bao giờ được lưu nguyên: giải mã bằng sharp (từ chối nếu không phải ảnh thật),
     * xoay theo EXIF, cắt tỉ lệ 3:4, xuất lại WebP — việc mã hoá lại loại bỏ metadata (GPS...) và mọi payload nhúng.
     */
    async setPhoto(actorId: string, input: Buffer, ip?: string): Promise<void> {
      let output: Buffer;
      try {
        const meta = await sharp(input, { limitInputPixels: 40_000_000 }).metadata();
        if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) throw new Error("format");
        output = await sharp(input, { limitInputPixels: 40_000_000 })
          .rotate()
          .resize({ width: 900, height: 1200, fit: "cover", position: "attention" })
          .webp({ quality: 82 })
          .toBuffer();
      } catch {
        throw badRequest("invalid_image");
      }
      await db
        .insertInto("siteAssets")
        .values({ key: "coach_photo", contentType: "image/webp", data: output })
        .onConflict((oc) => oc.column("key").doUpdateSet({ contentType: "image/webp", data: output, updatedAt: new Date() }))
        .execute();
      await audit(db, { actorId, action: "coach_photo_updated", ip });
    },

    async deletePhoto(actorId: string, ip?: string): Promise<void> {
      await db.deleteFrom("siteAssets").where("key", "=", "coach_photo").execute();
      await audit(db, { actorId, action: "coach_photo_deleted", ip });
    },

    async getPhoto() {
      return db.selectFrom("siteAssets").select(["contentType", "data"]).where("key", "=", "coach_photo").executeTakeFirst();
    },
  };
}

export type ContentService = ReturnType<typeof createContentService>;
