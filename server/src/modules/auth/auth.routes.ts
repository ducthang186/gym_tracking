import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import "@fastify/cookie";
import type { Config } from "../../config/env.js";
import type { Db } from "../../db/index.js";
import { AppError, forbidden, unauthorized } from "../../lib/errors.js";
import type { AuthService, AuthUser, RequestMeta, Session } from "./auth.service.js";
import { changePasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "./schemas.js";

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
    /** preHandler: bắt buộc có access token hợp lệ, gắn người dùng vào `req.user`. */
    requireAuth: (req: FastifyRequest) => Promise<void>;
  }
  interface FastifyRequest {
    user: AuthUser | null;
  }
}

export const REFRESH_COOKIE = "latis_rt";
const COOKIE_PATH = "/api/v1/auth";

export function registerAuthRoutes(app: FastifyInstance, deps: { config: Config; service: AuthService }) {
  const { config, service } = deps;

  /** Giới hạn tốc độ riêng cho từng route (nhân với RATE_LIMIT_SCALE; test đặt lớn để không bị chặn). */
  const limit = (max: number, timeWindow: string) => ({
    rateLimit: { max: Math.max(1, Math.round(max * config.RATE_LIMIT_SCALE)), timeWindow },
  });

  const metaOf = (req: FastifyRequest): RequestMeta => ({
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });

  function setRefreshCookie(reply: FastifyReply, token: string) {
    reply.setCookie(REFRESH_COOKIE, token, {
      httpOnly: true, // JavaScript không đọc được → XSS không đánh cắp được refresh token
      secure: config.NODE_ENV === "production",
      sameSite: "lax",
      path: COOKIE_PATH, // chỉ gửi kèm các request tới /auth/*
      maxAge: config.REFRESH_TOKEN_TTL_DAYS * 86_400,
    });
  }

  const clearRefreshCookie = (reply: FastifyReply) => reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });

  /** Chống CSRF cho endpoint dùng cookie: trình duyệt luôn gửi Origin trên POST; phải khớp frontend. */
  function assertSameOrigin(req: FastifyRequest) {
    if (req.headers.origin !== config.APP_ORIGIN) throw forbidden("bad_origin");
  }

  const sessionBody = (session: Session) => ({ accessToken: session.accessToken, expiresIn: session.expiresIn });

  // ---- decorator xác thực dùng cho mọi route cần đăng nhập ----
  app.decorateRequest("user", null);
  app.decorate("requireAuth", async (req: FastifyRequest) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw unauthorized("missing_token");
    req.user = await service.authenticate(header.slice(7));
  });

  // ---- đăng ký ----
  app.post("/api/v1/auth/register", { config: limit(5, "1 hour") }, async (req, reply) => {
    const body = registerSchema.parse(req.body);

    // Trường bẫy: bot điền vào ô ẩn. Trả thành công giả để bot không biết đã bị chặn.
    if (body.website) {
      req.log.warn({ ip: req.ip }, "honeypot: bỏ qua đăng ký nghi là bot");
      return reply.code(201).send({
        user: { id: randomUUID(), email: body.email, phone: body.phone, fullName: body.fullName, role: "client", status: "active" },
        accessToken: "",
        expiresIn: 0,
      });
    }

    const { user, session } = await service.register(body, metaOf(req));
    if (!session) return reply.code(201).send({ user, pendingApproval: true }); // chờ duyệt: chưa đăng nhập

    setRefreshCookie(reply, session.refreshToken);
    return reply.code(201).send({ user, ...sessionBody(session) });
  });

  // ---- đăng nhập ----
  app.post("/api/v1/auth/login", { config: limit(10, "15 minutes") }, async (req, reply) => {
    const { identifier, password } = loginSchema.parse(req.body);
    const { user, session } = await service.login(identifier, password, metaOf(req));
    setRefreshCookie(reply, session.refreshToken);
    return { user, ...sessionBody(session) };
  });

  // ---- làm mới access token ----
  // 300/15 phút/IP: mỗi lần mở app là một lần refresh, và nhiều học viên có thể dùng chung IP (wifi phòng tập).
  app.post("/api/v1/auth/refresh", { config: limit(300, "15 minutes") }, async (req, reply) => {
    assertSameOrigin(req);
    const raw = req.cookies[REFRESH_COOKIE];
    if (!raw) throw unauthorized("no_refresh_cookie");

    try {
      const { session, userId } = await service.refresh(raw, metaOf(req));
      setRefreshCookie(reply, session.refreshToken);
      return { user: await service.getMe(userId), ...sessionBody(session) };
    } catch (err) {
      // `refresh_conflict` = tab khác vừa xoay vòng; GIỮ cookie để client thử lại. Các lỗi khác: xoá cookie chết.
      if (!(err instanceof AppError && err.code === "refresh_conflict")) clearRefreshCookie(reply);
      throw err;
    }
  });

  // ---- đăng xuất ----
  app.post("/api/v1/auth/logout", { config: limit(60, "15 minutes") }, async (req, reply) => {
    assertSameOrigin(req);
    await service.logout(req.cookies[REFRESH_COOKIE]);
    clearRefreshCookie(reply);
    return reply.code(204).send();
  });

  // ---- đổi mật khẩu (đang đăng nhập) ----
  app.post("/api/v1/auth/change-password", { preHandler: app.requireAuth, config: limit(10, "15 minutes") }, async (req, reply) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const session = await service.changePassword(req.user!.id, currentPassword, newPassword, metaOf(req));
    setRefreshCookie(reply, session.refreshToken); // thiết bị này giữ đăng nhập bằng phiên mới
    return sessionBody(session);
  });

  // ---- đặt lại mật khẩu bằng link do admin/coach cấp (công khai, bản thân token là bằng chứng) ----
  app.post("/api/v1/auth/reset-password", { config: limit(10, "15 minutes") }, async (req, reply) => {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    await service.resetPassword(token, newPassword, metaOf(req));
    clearRefreshCookie(reply);
    return reply.code(204).send();
  });

  // ---- thông tin người đang đăng nhập ----
  app.get("/api/v1/me", { preHandler: app.requireAuth }, async (req) => {
    const user = await service.getMe(req.user!.id);
    if (!user) throw unauthorized("account_inactive");
    return { user };
  });
}
