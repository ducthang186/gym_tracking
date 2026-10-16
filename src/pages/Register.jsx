import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { AuthShell, Field, FormError, PasswordInput, SubmitButton, inputClass } from "../components/AuthForm";
import { useAuth } from "../context/AuthContext";
import { describeError, validateRegister } from "../lib/authMessages";

const EMPTY = { fullName: "", email: "", phone: "", password: "", passwordConfirm: "", website: "" };

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const inputProps = (id) => ({
    id,
    value: form[id],
    onChange: set(id),
    "aria-invalid": !!fieldErrors[id] || undefined,
    "aria-describedby": fieldErrors[id] ? `${id}-error` : undefined,
    className: inputClass(!!fieldErrors[id]),
  });

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setError("");

    const errors = validateRegister(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setLoading(true);
    try {
      // Không gửi passwordConfirm: chỉ để kiểm tra gõ nhầm ở client.
      const { pending: needsApproval } = await register({
        email: form.email.trim(),
        fullName: form.fullName,
        phone: form.phone,
        password: form.password,
        website: form.website,
      });
      if (needsApproval) setPending(true);
      else navigate("/app", { replace: true });
    } catch (err) {
      const described = describeError(err);
      setError(described.message);
      setFieldErrors(described.fields);
    } finally {
      setLoading(false);
    }
  }

  if (pending) {
    return (
      <AuthShell title="Đăng ký thành công">
        <div className="mt-6 text-center">
          <CheckCircle2 className="mx-auto text-cyan mb-4" size={40} />
          <p className="text-sm text-ink">Tài khoản của bạn đã được tạo và đang chờ huấn luyện viên duyệt.</p>
          <p className="text-sm text-muted mt-2">Bạn sẽ đăng nhập được ngay khi tài khoản được duyệt.</p>
          <Link to="/" className="inline-block mt-6 text-sm font-semibold text-cyan hover:text-cyan/80">
            Về trang chủ
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Tạo tài khoản"
      subtitle="Bắt đầu hành trình coaching dựa trên dữ liệu."
      footer={
        <>
          Đã có tài khoản?{" "}
          <Link to="/login" className="text-cyan font-medium hover:text-cyan/80">
            Đăng nhập
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <FormError message={error} />

        <Field id="fullName" label="Họ và tên" error={fieldErrors.fullName}>
          <input {...inputProps("fullName")} type="text" autoComplete="name" autoFocus placeholder="Nguyễn Văn A" />
        </Field>

        <Field id="email" label="Email" error={fieldErrors.email}>
          <input {...inputProps("email")} type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" />
        </Field>

        <Field
          id="phone"
          label="Số điện thoại"
          error={fieldErrors.phone}
          hint="Số di động Việt Nam. Huấn luyện viên dùng số này để liên hệ và hỗ trợ bạn."
        >
          <input {...inputProps("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder="0912 345 678" />
        </Field>

        <Field
          id="password"
          label="Mật khẩu"
          error={fieldErrors.password}
          hint="Ít nhất 8 ký tự. Hãy nhớ kỹ mật khẩu: hệ thống không gửi email đặt lại — nếu quên, huấn luyện viên sẽ cấp link đặt lại cho bạn."
        >
          <PasswordInput
            id="password"
            value={form.password}
            onChange={set("password")}
            autoComplete="new-password"
            placeholder="Tối thiểu 8 ký tự"
            hasError={!!fieldErrors.password}
            describedBy={fieldErrors.password ? "password-error" : "password-hint"}
          />
        </Field>

        <Field id="passwordConfirm" label="Nhập lại mật khẩu" error={fieldErrors.passwordConfirm}>
          <PasswordInput
            id="passwordConfirm"
            value={form.passwordConfirm}
            onChange={set("passwordConfirm")}
            autoComplete="new-password"
            placeholder="Nhập lại mật khẩu"
            hasError={!!fieldErrors.passwordConfirm}
            describedBy={fieldErrors.passwordConfirm ? "passwordConfirm-error" : undefined}
          />
        </Field>

        {/* Trường bẫy chống bot: ẩn khỏi người thật, bot điền vào là bị chặn. Không đặt display:none vì bot tinh vi bỏ qua. */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
          <label htmlFor="website">Website (để trống)</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
        </div>

        <SubmitButton loading={loading} loadingText="Đang tạo tài khoản...">
          Tạo tài khoản
          <ArrowRight size={16} />
        </SubmitButton>

        <p className="text-muted text-[11px] leading-relaxed">
          Bằng việc đăng ký, bạn đồng ý với các điều khoản sử dụng và chính sách bảo mật của LATIS.
        </p>
      </form>
    </AuthShell>
  );
}
