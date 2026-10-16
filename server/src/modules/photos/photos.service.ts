import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { Selectable } from "kysely";
import type { Db } from "../../db/index.js";
import type { PhotoAngle, ProgressPhotosTable } from "../../db/types.js";
import { assertNotFuture } from "../../lib/dates.js";
import { badRequest, notFound } from "../../lib/errors.js";
import type { Storage } from "../../lib/storage.js";

export const MAX_PHOTOS_PER_USER = 60;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);
const MAX_PIXELS = 40_000_000;

export interface Photo {
  id: string;
  takenOn: string;
  angle: PhotoAngle;
  createdAt: string;
}

const toPhoto = (r: Selectable<ProgressPhotosTable>): Photo => ({
  id: r.id,
  takenOn: r.takenOn,
  angle: r.angle,
  createdAt: r.createdAt.toISOString(),
});

export function createPhotosService(db: Db, storage: Storage) {
  return {
    async list(userId: string): Promise<Photo[]> {
      const rows = await db
        .selectFrom("progressPhotos")
        .selectAll()
        .where("userId", "=", userId)
        .orderBy("takenOn", "desc")
        .orderBy("createdAt", "desc")
        .execute();
      return rows.map(toPhoto);
    },

    /**
     * Ảnh người dùng tải lên không bao giờ được lưu nguyên: giải mã bằng sharp (từ chối nếu không phải ảnh thật),
     * xoay theo EXIF, thu nhỏ và mã hoá lại WebP — việc này loại bỏ metadata (GPS, thiết bị...) và payload nhúng.
     */
    async upload(userId: string, input: { takenOn: string; angle: PhotoAngle; data: Buffer }): Promise<Photo> {
      assertNotFuture(input.takenOn);
      const count = await db
        .selectFrom("progressPhotos")
        .select((eb) => eb.fn.countAll().as("n"))
        .where("userId", "=", userId)
        .executeTakeFirstOrThrow();
      if (Number(count.n) >= MAX_PHOTOS_PER_USER) throw badRequest("too_many_photos");

      let full: Buffer;
      let thumb: Buffer;
      try {
        const meta = await sharp(input.data, { limitInputPixels: MAX_PIXELS }).metadata();
        if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) throw new Error("format");
        const base = () => sharp(input.data, { limitInputPixels: MAX_PIXELS }).rotate();
        full = await base().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
        thumb = await base().resize({ width: 400, height: 533, fit: "cover", position: "attention" }).webp({ quality: 75 }).toBuffer();
      } catch {
        throw badRequest("invalid_image");
      }

      const id = randomUUID();
      const fullKey = `photos/${userId}/${id}.webp`;
      const thumbKey = `photos/${userId}/${id}.thumb.webp`;
      await storage.put(fullKey, full);
      await storage.put(thumbKey, thumb);
      try {
        const row = await db
          .insertInto("progressPhotos")
          .values({ id, userId, takenOn: input.takenOn, angle: input.angle, fullKey, thumbKey, bytes: full.length + thumb.length })
          .returningAll()
          .executeTakeFirstOrThrow();
        return toPhoto(row);
      } catch (err) {
        await Promise.all([storage.remove(fullKey), storage.remove(thumbKey)]); // không để tệp mồ côi
        throw err;
      }
    },

    /** Đọc tệp ảnh của `ownerId`. Người gọi đã được kiểm tra quyền; ở đây vẫn ràng buộc theo chủ sở hữu. */
    async file(ownerId: string, photoId: string, size: "thumb" | "full"): Promise<Buffer> {
      const row = await db
        .selectFrom("progressPhotos")
        .select(["fullKey", "thumbKey"])
        .where("id", "=", photoId)
        .where("userId", "=", ownerId)
        .executeTakeFirst();
      if (!row) throw notFound("photo_not_found");
      try {
        return await storage.read(size === "thumb" ? row.thumbKey : row.fullKey);
      } catch {
        throw notFound("photo_not_found");
      }
    },

    async remove(userId: string, photoId: string): Promise<void> {
      const row = await db
        .deleteFrom("progressPhotos")
        .where("id", "=", photoId)
        .where("userId", "=", userId)
        .returning(["fullKey", "thumbKey"])
        .executeTakeFirst();
      if (!row) throw notFound("photo_not_found");
      await Promise.all([storage.remove(row.fullKey), storage.remove(row.thumbKey)]);
    },

    /** Xoá toàn bộ ảnh của một người (khi xoá tài khoản). */
    removeAllFiles: (userId: string) => storage.removeDir(`photos/${userId}`),
  };
}

export type PhotosService = ReturnType<typeof createPhotosService>;
