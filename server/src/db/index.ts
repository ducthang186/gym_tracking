import { CamelCasePlugin, Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import type { DB } from "./types.js";

// Cột `date` trả về chuỗi 'YYYY-MM-DD' nguyên văn, không đổi sang Date theo múi giờ của máy chủ.
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

export type Db = Kysely<DB>;

export function createDb(databaseUrl: string): Db {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
  // Lỗi trên kết nối rảnh (vd Postgres khởi động lại) không được làm sập tiến trình.
  pool.on("error", (err) => console.error("[pg] lỗi kết nối rảnh:", err.message));
  return new Kysely<DB>({
    dialect: new PostgresDialect({ pool }),
    plugins: [new CamelCasePlugin()],
  });
}

/** Mã lỗi vi phạm ràng buộc unique của Postgres. */
export function uniqueViolation(err: unknown): { constraint: string } | null {
  const e = err as { code?: string; constraint?: string };
  return e?.code === "23505" ? { constraint: e.constraint ?? "" } : null;
}
