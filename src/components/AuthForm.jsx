import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";

export const inputClass = (hasError) =>
  `w-full rounded-lg border bg-page px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 ${
    hasError ? "border-red-400/60 focus:ring-red-400/40" : "border-line focus:ring-cyan/50"
  }`;

/** Khung trang đăng nhập/đăng ký: logo, liên kết về trang chủ, thẻ chứa form. */
export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen bg-page text-ink flex flex-col">
      <div className="px-4 sm:px-6 lg:px-8 pt-6">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-cyan transition-colors">
          <ArrowLeft size={13} />
          Về trang chủ
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <Link to="/" className="font-display font-extrabold text-2xl tracking-tight text-ink">
              LATIS
              <span className="block text-[9px] font-extrabold text-cyan tracking-[0.22em] mt-1">— COACHING</span>
            </Link>
          </div>

          <div className="bg-panel border border-line rounded-2xl p-6 sm:p-8">
            <h1 className="font-display font-bold text-xl text-ink">{title}</h1>
            {subtitle && <p className="text-muted text-sm mt-1.5">{subtitle}</p>}
            {children}
          </div>

          {footer && <p className="text-center text-sm text-muted mt-6">{footer}</p>}
        </div>
      </div>
    </div>
  );
}

/** Nhãn + ô nhập + thông báo lỗi/gợi ý, có gắn aria để trình đọc màn hình hiểu. */
export function Field({ id, label, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-muted mb-1.5">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[11px] leading-relaxed text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordInput({ id, value, onChange, hasError, describedBy, autoComplete, placeholder }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy}
        className={`${inputClass(hasError)} pr-11`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 px-3 text-muted hover:text-ink transition-colors"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export function FormError({ message }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 px-3.5 py-2.5 text-sm text-red-300">
      {message}
    </div>
  );
}

export function SubmitButton({ loading, children, loadingText = "Đang xử lý..." }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 bg-cyan hover:bg-cyan/90 disabled:opacity-60 disabled:cursor-not-allowed text-cyan-deep font-extrabold text-sm px-4 py-3 rounded-lg transition-colors mt-2"
    >
      {loading ? loadingText : children}
    </button>
  );
}
