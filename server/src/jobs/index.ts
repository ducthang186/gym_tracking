import type { FastifyInstance } from "fastify";
import { purgeExpiredTokens } from "./cleanup.js";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/**
 * Bộ lập lịch đơn giản chạy trong tiến trình API. Chỉ đúng khi chạy ĐÚNG 1 instance (đủ cho quy mô này);
 * khi cần nhiều instance, chuyển sang hàng đợi (pg-boss) để mỗi job chỉ chạy một lần.
 * Mọi job phải idempotent — chạy lại hay chạy chồng lên nhau cũng không sao.
 */
export function startJobs(app: FastifyInstance): void {
  const run = async () => {
    try {
      const removed = await purgeExpiredTokens(app.db);
      app.log.info(removed, "đã dọn token hết hạn");
    } catch (err) {
      app.log.error(err, "job dọn token thất bại");
    }
  };

  void run();
  const timer = setInterval(run, SIX_HOURS_MS);
  app.addHook("onClose", async () => clearInterval(timer));
}
