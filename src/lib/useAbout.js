import { useEffect, useState } from "react";
import { defaultAbout } from "../data/about";
import { apiPublic } from "./api";
import { DEMO } from "./demo";

/** Nội dung trang "Về tôi" từ server; trong lúc chờ hoặc khi lỗi thì dùng nội dung mặc định. */
export function useAbout() {
  const [about, setAbout] = useState(defaultAbout);
  useEffect(() => {
    let cancelled = false;
    apiPublic("/public/about")
      .then((data) => !cancelled && setAbout(data.about))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return [about, setAbout];
}

export const photoUrl = (about) => {
  if (!about.photoVersion) return null;
  // Demo: ảnh do người xem vừa chọn nằm trong bộ nhớ trình duyệt (object URL), không có địa chỉ máy chủ.
  if (DEMO) return globalThis.__latisDemoCoachPhoto ?? null;
  return `/api/v1/public/coach-photo?v=${about.photoVersion}`;
};
