import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { Config } from "../../config/env.js";

export const JWT_ISSUER = "latis";
export const JWT_AUDIENCE = "latis-api";

export function createTokenService(cfg: Pick<Config, "JWT_SECRET" | "ACCESS_TOKEN_TTL_SECONDS">) {
  const key = new TextEncoder().encode(cfg.JWT_SECRET);

  return {
    /** Access token chỉ chứa `sub`. Vai trò/trạng thái luôn được tra lại từ DB ở mỗi request. */
    signAccess(userId: string): Promise<string> {
      return new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(userId)
        .setIssuer(JWT_ISSUER)
        .setAudience(JWT_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(`${cfg.ACCESS_TOKEN_TTL_SECONDS}s`)
        .sign(key);
    },

    /** Ném lỗi nếu token sai chữ ký / hết hạn / sai issuer, audience, thuật toán. */
    async verifyAccess(token: string): Promise<string> {
      const { payload } = await jwtVerify(token, key, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        algorithms: ["HS256"], // ghim thuật toán, chặn kiểu tấn công đổi alg
      });
      if (!payload.sub) throw new Error("token thiếu sub");
      return payload.sub;
    },
  };
}

export type TokenService = ReturnType<typeof createTokenService>;

/** Refresh token: 32 byte ngẫu nhiên (256 bit). Chỉ lưu SHA-256 của nó trong DB. */
export const newRefreshToken = (): string => randomBytes(32).toString("base64url");

/** Token có entropy cao nên SHA-256 nhanh là đủ (không cần hash chậm như mật khẩu). */
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");
