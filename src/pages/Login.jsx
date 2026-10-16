import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { AuthShell, Field, FormError, PasswordInput, SubmitButton, inputClass } from "../components/AuthForm";
import { useAuth } from "../context/AuthContext";
import { describeError } from "../lib/authMessages";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ identifier: "", password: "" });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    const errors = {};
    if (!form.identifier.trim()) errors.identifier = "Vui lòng nhập email hoặc số điện thoại.";
    if (!form.password) errors.password = "Vui lòng nhập mật khẩu.";
    setFieldErrors(errors);
    setError("");
    if (Object.keys(errors).length) return;

    setLoading(true);
    try {
      await login(form.identifier.trim(), form.password);
      navigate(location.state?.from ?? "/app", { replace: true });
    } catch (err) {
      const described = describeError(err);
      setError(described.message);
      setFieldErrors(described.fields);
      setForm((f) => ({ ...f, password: "" }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Đăng nhập"
      subtitle="Truy cập hệ thống coaching và dữ liệu của bạn."
      footer={
        <>
          Chưa có tài khoản?{" "}
          <Link to="/register" className="text-cyan font-medium hover:text-cyan/80">
            Đăng ký ngay
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <FormError message={error} />

        <Field id="identifier" label="Email hoặc số điện thoại" error={fieldErrors.identifier}>
          <input
            id="identifier"
            type="text"
            inputMode="email"
            autoComplete="username"
            autoFocus
            value={form.identifier}
            onChange={set("identifier")}
            placeholder="you@example.com hoặc 0912 345 678"
            aria-invalid={!!fieldErrors.identifier || undefined}
            aria-describedby={fieldErrors.identifier ? "identifier-error" : undefined}
            className={inputClass(!!fieldErrors.identifier)}
          />
        </Field>

        <Field
          id="password"
          label="Mật khẩu"
          error={fieldErrors.password}
          hint="Quên mật khẩu? Hãy liên hệ huấn luyện viên để được cấp link đặt lại mật khẩu."
        >
          <PasswordInput
            id="password"
            value={form.password}
            onChange={set("password")}
            autoComplete="current-password"
            placeholder="••••••••"
            hasError={!!fieldErrors.password}
            describedBy={fieldErrors.password ? "password-error" : "password-hint"}
          />
        </Field>

        <SubmitButton loading={loading} loadingText="Đang đăng nhập...">
          Đăng nhập
          <ArrowRight size={16} />
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
