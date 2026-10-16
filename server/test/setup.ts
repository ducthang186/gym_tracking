import { loadEnvFileIfPresent } from "../src/config/env.js";

// Test chạy trên database RIÊNG (latis_test), không bao giờ đụng dữ liệu dev.
loadEnvFileIfPresent(".env");

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  throw new Error("Thiếu TEST_DATABASE_URL. Chạy `npm run db:start` để tạo database và file .env.");
}

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = testUrl;
// Tham số argon2 nhỏ để test nhanh (production dùng giá trị mặc định mạnh hơn).
process.env.ARGON2_MEMORY_KIB = "8192";
process.env.ARGON2_TIME_COST = "1";
// Không để giới hạn tốc độ làm hỏng test thường; test riêng cho rate limit sẽ đặt lại.
process.env.RATE_LIMIT_SCALE = "1000";

// Ảnh của test đi vào thư mục tạm riêng, không đụng ./storage của dev.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.STORAGE_DIR = mkdtempSync(join(tmpdir(), "latis-test-storage-"));
