import { describe, expect, it } from "vitest";
import { normalizePhone } from "../src/modules/auth/phone.js";

describe("normalizePhone", () => {
  it.each([
    ["0912345678", "+84912345678"],
    ["0912 345 678", "+84912345678"],
    ["091.234.5678", "+84912345678"],
    ["091-234-5678", "+84912345678"],
    ["  0912345678  ", "+84912345678"],
    ["+84912345678", "+84912345678"],
    ["+84 912 345 678", "+84912345678"],
    ["84912345678", "+84912345678"],
    ["+84 0912345678", "+84912345678"], // hay gõ thừa số 0
    ["(+84) 912345678", "+84912345678"],
    ["0372345678", "+84372345678"], // đầu số 03
    ["0562345678", "+84562345678"], // đầu số 05
    ["0702345678", "+84702345678"], // đầu số 07
    ["0852345678", "+84852345678"], // đầu số 08
  ])("chuẩn hoá %j → %j", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    "",
    "abc",
    "0912345",            // thiếu chữ số
    "091234567890",       // thừa chữ số
    "0212345678",         // đầu số 02 = máy bàn, không phải di động
    "0112345678",
    "+1 415 555 2671",    // số Mỹ
    "+85212345678",       // Hồng Kông
    "09123abc78",         // lẫn chữ
    "+840912",            // quá ngắn sau mã vùng
    "٠٩١٢٣٤٥٦٧٨",         // chữ số Ả Rập — không được lọt qua \d
  ])("từ chối %j", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it("các cách viết khác nhau của cùng một số cho cùng kết quả", () => {
    const variants = ["0912345678", "+84912345678", "84 912 345 678", "091.234.5678"];
    expect(new Set(variants.map(normalizePhone)).size).toBe(1);
  });
});
