// Bản sao phía client của server/src/modules/auth/phone.ts — chỉ để báo lỗi sớm cho người dùng.
// Server mới là bên quyết định; nếu sửa quy tắc, sửa CẢ HAI nơi.

/** Trả về dạng E.164 (+84912345678) hoặc null nếu không phải số di động Việt Nam hợp lệ. */
export function normalizePhone(input) {
  let s = String(input ?? "").trim().replace(/[\s.\-()]/g, "");

  if (s.startsWith("+")) {
    if (!s.startsWith("+84")) return null;
    let rest = s.slice(3);
    if (rest.startsWith("0")) rest = rest.slice(1);
    s = "0" + rest;
  } else if (s.startsWith("84") && s.length === 11) {
    s = "0" + s.slice(2);
  }

  if (!/^0[35789][0-9]{8}$/.test(s)) return null;
  return "+84" + s.slice(1);
}

/** +84912345678 → "0912 345 678" để hiển thị. */
export function formatPhone(e164) {
  const m = /^\+84(\d{3})(\d{3})(\d{3})$/.exec(e164 ?? "");
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : (e164 ?? "");
}
