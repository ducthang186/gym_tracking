import { useEffect, useState } from "react";
import { defaultAbout } from "../data/about";
import { apiPublic } from "./api";

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

export const photoUrl = (about) => (about.photoVersion ? `/api/v1/public/coach-photo?v=${about.photoVersion}` : null);
