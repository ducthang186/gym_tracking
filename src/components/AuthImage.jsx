import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { api } from "../lib/api";

/**
 * Ảnh riêng tư: thẻ <img> không gửi được header Authorization, nên tải ảnh bằng `api()` (có token, tự refresh)
 * rồi hiển thị qua object URL. URL được thu hồi khi component bị gỡ để không rò bộ nhớ.
 */
export default function AuthImage({ path, alt, className = "" }) {
  const [state, setState] = useState({ url: null, failed: false });

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    setState({ url: null, failed: false });
    api(path, { responseType: "blob" })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ url: objectUrl, failed: false });
      })
      .catch(() => !cancelled && setState({ url: null, failed: true }));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (state.url) return <img src={state.url} alt={alt} className={className} />;
  return (
    <div className={`flex items-center justify-center bg-page text-muted ${className}`} role={state.failed ? "img" : "status"} aria-label={state.failed ? "Không tải được ảnh" : "Đang tải ảnh"}>
      {state.failed && <ImageOff size={20} />}
    </div>
  );
}
