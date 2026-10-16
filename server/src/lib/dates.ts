import { badRequest } from "./errors.js";

const DAY_MS = 86_400_000;

export const toDateStr = (d: Date) => d.toISOString().slice(0, 10);

export const addDays = (date: string, n: number) => toDateStr(new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS));

export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

/**
 * Ngày do client gửi theo giờ địa phương của người dùng, nên có thể hơn/kém ngày UTC của server tối đa 1 ngày.
 * Từ chối ngày tương lai xa (ghi số liệu cho "ngày mai tuần sau" luôn là nhập nhầm).
 */
export function assertNotFuture(date: string, now = new Date()) {
  if (date > addDays(toDateStr(now), 1)) throw badRequest("validation_error", { fields: [{ field: "date", code: "future_date" }] });
}

/** Tuổi tròn năm tại ngày `on`. */
export function ageOn(birthDate: string, on: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number) as [number, number, number];
  const [y, m, d] = on.split("-").map(Number) as [number, number, number];
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}
