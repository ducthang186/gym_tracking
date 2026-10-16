import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Địa chỉ đầy đủ của trang đặt lại mật khẩu; token ở fragment (#) nên không lọt vào log máy chủ. */
export const resetUrl = (token) => `${window.location.origin}${import.meta.env.BASE_URL}reset-password#token=${token}`;

export default function ResetLinkBox({ link, name, onClose }) {
  const [copied, setCopied] = useState(false);
  const url = resetUrl(link.token);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // trình duyệt chặn clipboard: người dùng vẫn chọn và sao chép tay từ ô bên dưới
    }
  }

  return (
    <div className="rounded-lg border border-cyan/30 bg-cyan/5 p-4 space-y-2">
      <p className="text-sm text-ink">
        Liên kết đặt mật khẩu cho <b>{name}</b> (dùng một lần, hết hạn {new Date(link.expiresAt).toLocaleString("vi-VN")}):
      </p>
      <div className="flex gap-2">
        <input readOnly value={url} onFocus={(e) => e.target.select()} className="flex-1 min-w-0 rounded-lg border border-line bg-page px-3 py-2 text-xs text-ink font-mono" aria-label="Liên kết đặt lại mật khẩu" />
        <button onClick={copy} className="flex items-center gap-1.5 bg-cyan text-cyan-deep text-xs font-bold px-3 py-2 rounded-lg shrink-0">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Đã chép" : "Sao chép"}
        </button>
      </div>
      <p className="text-[11px] text-muted">Hãy gửi riêng cho đúng người này (Zalo/tin nhắn). Liên kết cũ chưa dùng sẽ mất hiệu lực. Liên kết chỉ hiện một lần ở đây.</p>
      {onClose && <button onClick={onClose} className="text-xs text-muted hover:text-ink">Đóng</button>}
    </div>
  );
}
