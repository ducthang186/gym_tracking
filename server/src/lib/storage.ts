import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Lưu tệp trên đĩa cục bộ. Khoá tệp do SERVER sinh (không bao giờ lấy từ người dùng) nhưng vẫn kiểm tra
 * đường dẫn nằm trong thư mục gốc để một lỗi sau này không thể biến thành đọc/ghi tệp tuỳ ý.
 */
export function createStorage(rootDir: string) {
  const root = resolve(rootDir);

  function pathFor(key: string): string {
    const full = resolve(root, key);
    if (!full.startsWith(root + sep)) throw new Error("storage: khoá tệp nằm ngoài thư mục gốc");
    return full;
  }

  async function dirSize(dir: string): Promise<number> {
    let total = 0;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return 0;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      total += e.isDirectory() ? await dirSize(p) : (await stat(p)).size;
    }
    return total;
  }

  return {
    /** Ghi nguyên tử: ghi ra tệp tạm rồi đổi tên, tránh để lại tệp dở dang khi sập giữa chừng. */
    async put(key: string, data: Buffer): Promise<void> {
      const target = pathFor(key);
      await mkdir(dirname(target), { recursive: true });
      const tmp = `${target}.${randomUUID()}.tmp`;
      await writeFile(tmp, data, { mode: 0o600 });
      await rename(tmp, target);
    },

    read: (key: string): Promise<Buffer> => readFile(pathFor(key)),

    /** Không báo lỗi nếu tệp đã không còn. */
    remove: (key: string): Promise<void> => rm(pathFor(key), { force: true }),

    removeDir: (prefix: string): Promise<void> => rm(pathFor(prefix), { recursive: true, force: true }),

    usedBytes: () => dirSize(root),
  };
}

export type Storage = ReturnType<typeof createStorage>;
