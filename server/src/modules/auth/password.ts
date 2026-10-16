import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import type { Config } from "../../config/env.js";

export function createPasswordHasher(cfg: Pick<Config, "ARGON2_MEMORY_KIB" | "ARGON2_TIME_COST">) {
  const options = {
    type: argon2.argon2id,
    memoryCost: cfg.ARGON2_MEMORY_KIB,
    timeCost: cfg.ARGON2_TIME_COST,
    parallelism: 1,
  } as const;

  let dummyHash: Promise<string> | undefined;

  return {
    hash: (password: string) => argon2.hash(password, options),

    /** Tham số nằm sẵn trong chuỗi hash nên đổi cấu hình không làm hỏng mật khẩu cũ. */
    async verify(hash: string, password: string): Promise<boolean> {
      try {
        return await argon2.verify(hash, password);
      } catch {
        return false;
      }
    },

    /**
     * Chạy một lần verify giả khi không tìm thấy người dùng, để thời gian phản hồi
     * xấp xỉ khi tìm thấy — chặn dò xem tài khoản có tồn tại qua độ trễ.
     */
    async verifyDummy(password: string): Promise<void> {
      dummyHash ??= argon2.hash(randomBytes(16).toString("hex"), options);
      await argon2.verify(await dummyHash, password).catch(() => false);
    },
  };
}

export type PasswordHasher = ReturnType<typeof createPasswordHasher>;
