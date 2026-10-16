// Ngày dạng "YYYY-MM-DD" theo GIỜ ĐỊA PHƯƠNG (toISOString trả ngày UTC nên lệch ngày vào buổi sáng ở Việt Nam).

const pad = (n) => String(n).padStart(2, "0");

export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const parse = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export function addDays(key, n) {
  const d = parse(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/** "2026-10-05" → "05/10/2026" */
export function formatDate(key) {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

/** "2026-10-05" → "05/10" */
export function formatShort(key) {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

/** Thứ trong tuần, 0 = Thứ 2 ... 6 = Chủ nhật. */
export function weekdayIndex(key = dateKey()) {
  return (parse(key).getDay() + 6) % 7;
}

export const WEEKDAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];
