/** Lỗi nghiệp vụ có mã HTTP và mã lỗi ổn định để frontend ánh xạ sang thông báo. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(code);
    this.name = "AppError";
  }
}

export const badRequest = (code = "bad_request", details?: unknown) => new AppError(400, code, details);
export const unauthorized = (code = "unauthorized") => new AppError(401, code);
export const forbidden = (code = "forbidden") => new AppError(403, code);
export const notFound = (code = "not_found") => new AppError(404, code);
export const conflict = (code: string, details?: unknown) => new AppError(409, code, details);
export const tooMany = (code = "too_many_attempts", details?: unknown) => new AppError(429, code, details);
