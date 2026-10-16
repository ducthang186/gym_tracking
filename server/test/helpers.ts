import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { REFRESH_COOKIE } from "../src/modules/auth/auth.routes.js";

export const ORIGIN = "http://localhost:5173";

export async function makeApp(overrides: Record<string, string> = {}) {
  const config = loadConfig({ ...process.env, ...overrides });
  const app = await buildApp({ config, logger: false });
  await app.ready();
  return { app, config };
}

export async function cleanDb(app: FastifyInstance) {
  await app.db.deleteFrom("auditLog").execute();
  await app.db.deleteFrom("users").execute(); // cascade: profiles, refresh_tokens, auth_tokens
}

export const validBody = (over: Record<string, unknown> = {}) => ({
  email: "an@example.com",
  fullName: "Nguyễn Văn An",
  phone: "0912345678",
  password: "matkhau-manh-1",
  ...over,
});

export const register = (app: FastifyInstance, body: unknown, headers: Record<string, string> = {}) =>
  app.inject({ method: "POST", url: "/api/v1/auth/register", payload: body as object, headers });

export const login = (app: FastifyInstance, identifier: string, password: string) =>
  app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { identifier, password } });

/** `origin = null` nghĩa là KHÔNG gửi header Origin (khác `undefined` sẽ rơi về giá trị mặc định). */
export const refresh = (app: FastifyInstance, token: string | undefined, origin: string | null = ORIGIN) =>
  app.inject({
    method: "POST",
    url: "/api/v1/auth/refresh",
    headers: origin ? { origin } : {},
    cookies: token ? { [REFRESH_COOKIE]: token } : {},
  });

export const logout = (app: FastifyInstance, token: string | undefined) =>
  app.inject({
    method: "POST",
    url: "/api/v1/auth/logout",
    headers: { origin: ORIGIN },
    cookies: token ? { [REFRESH_COOKIE]: token } : {},
  });

export const me = (app: FastifyInstance, accessToken?: string) =>
  app.inject({
    method: "GET",
    url: "/api/v1/me",
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  });

/** Lấy giá trị cookie refresh từ response. */
export function refreshCookie(res: { cookies: Array<{ name: string; value: string }> }): string | undefined {
  return res.cookies.find((c) => c.name === REFRESH_COOKIE)?.value;
}

export type TestUser = { id: string; token: string; email: string; phone: string };

/** Đăng ký rồi (tuỳ chọn) nâng vai trò trực tiếp trong DB. */
export async function createUser(app: FastifyInstance, email: string, phone: string, role?: "admin" | "coach"): Promise<TestUser> {
  const res = await register(app, validBody({ email, phone }));
  const { user, accessToken } = res.json();
  if (role) await app.db.updateTable("users").set({ role }).where("id", "=", user.id).execute();
  return { id: user.id, token: accessToken, email, phone };
}

export const call = (
  app: FastifyInstance,
  token: string | undefined,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  payload?: object,
) => app.inject({ method, url, payload, headers: token ? { authorization: `Bearer ${token}` } : {} });
