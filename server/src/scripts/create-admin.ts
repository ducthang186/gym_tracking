import { parseArgs } from "node:util";
import { loadConfig, loadEnvFileIfPresent } from "../config/env.js";
import { createDb } from "../db/index.js";
import { findConflicts, insertUserWithProfile } from "../modules/auth/auth.repo.js";
import { createPasswordHasher } from "../modules/auth/password.js";
import { registerSchema } from "../modules/auth/schemas.js";

/** Đọc mật khẩu mà không hiện lên màn hình. Nếu stdin là pipe thì đọc thẳng từ pipe. */
function promptHidden(question: string): Promise<string> {
  process.stdout.write(question);
  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.setEncoding("utf8");

    if (!stdin.isTTY) {
      let data = "";
      stdin.on("data", (chunk) => (data += chunk));
      stdin.on("end", () => resolve(data.split("\n")[0]?.trim() ?? ""));
      return;
    }

    stdin.setRawMode(true);
    stdin.resume();
    let buf = "";
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\n" || ch === "\r" || ch === "\u0004") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(buf);
        }
        if (ch === "\u0003") process.exit(130); // Ctrl+C
        if (ch === "\u007f" || ch === "\b") buf = buf.slice(0, -1);
        else buf += ch;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      phone: { type: "string" },
      name: { type: "string" },
    },
  });

  if (!values.email || !values.phone || !values.name) {
    console.error('Dùng: npm run admin:create -- --email you@example.com --phone 0912345678 --name "Tên của bạn"');
    process.exit(1);
  }

  const password = await promptHidden("Mật khẩu (>= 8 ký tự): ");
  if (process.stdin.isTTY) {
    const again = await promptHidden("Nhập lại mật khẩu: ");
    if (again !== password) {
      console.error("Hai mật khẩu không khớp.");
      process.exit(1);
    }
  }

  // Dùng chung schema với đăng ký thường để quy tắc email/SĐT/mật khẩu luôn giống nhau.
  const parsed = registerSchema.safeParse({
    email: values.email,
    phone: values.phone,
    fullName: values.name,
    password,
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) console.error(`- ${issue.path.join(".")}: ${issue.message}`);
    process.exit(1);
  }
  const input = parsed.data;

  loadEnvFileIfPresent();
  const config = loadConfig();
  const db = createDb(config.DATABASE_URL);

  try {
    if ((await findConflicts(db, input.email, input.phone)).length) {
      console.error("Email hoặc số điện thoại này đã có tài khoản.");
      process.exit(1);
    }

    const passwordHash = await createPasswordHasher(config).hash(input.password);
    const { id } = await db.transaction().execute(async (trx) => {
      const created = await insertUserWithProfile(trx, {
        email: input.email,
        phone: input.phone,
        passwordHash,
        fullName: input.fullName,
        status: "active",
      });
      await trx.updateTable("users").set({ role: "admin" }).where("id", "=", created.id).execute();
      return created;
    });

    console.log(`Đã tạo admin: ${input.email} (${input.phone}) — id ${id}`);
  } finally {
    await db.destroy();
  }
}

await main();
