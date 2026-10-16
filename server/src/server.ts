import { buildApp } from "./app.js";
import { loadConfig, loadEnvFileIfPresent } from "./config/env.js";
import { startJobs } from "./jobs/index.js";

loadEnvFileIfPresent();
const config = loadConfig();

const app = await buildApp({ config });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    app.log.info(`nhận ${signal}, đang tắt...`);
    app.close().then(() => process.exit(0));
  });
}

// Phải đăng ký hook (trong startJobs) TRƯỚC khi listen — Fastify không cho thêm hook khi đã chạy.
startJobs(app);
await app.listen({ host: config.HOST, port: config.PORT });
