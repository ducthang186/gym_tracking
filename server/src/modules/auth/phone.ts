/**
 * Chuẩn hoá số điện thoại di động Việt Nam về dạng E.164 (`+84912345678`).
 * Đây là NGUỒN DUY NHẤT của quy tắc này — dùng cho cả đăng ký lẫn đăng nhập bằng SĐT.
 *
 * Chấp nhận: 0912345678 · 0912 345 678 · 091.234.5678 · +84912345678 · +84 912 345 678
 *            · 84912345678 · +84 0912345678 (hay gõ thừa số 0)
 * Từ chối:   số cố định, số quốc tế khác, thiếu/thừa chữ số, chứa chữ cái.
 */
export function normalizePhone(input: string): string | null {
  let s = input.trim().replace(/[\s.\-()]/g, "");

  if (s.startsWith("+")) {
    if (!s.startsWith("+84")) return null;
    let rest = s.slice(3);
    if (rest.startsWith("0")) rest = rest.slice(1); // "+84 0912…" → bỏ số 0 thừa
    s = "0" + rest;
  } else if (s.startsWith("84") && s.length === 11) {
    s = "0" + s.slice(2);
  }

  // Số di động: 0 + đầu số [3,5,7,8,9] + 8 chữ số (tổng 10 chữ số).
  // Cố ý KHÔNG liệt kê từng đầu số nhà mạng để không từ chối nhầm số được cấp mới.
  if (!/^0[35789][0-9]{8}$/.test(s)) return null;
  return "+84" + s.slice(1);
}
