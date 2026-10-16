import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell, Field, FormError, PasswordInput, SubmitButton } from "../components/AuthForm";
import { apiPublic } from "../lib/api";
import { describeError } from "../lib/describeError";

// Token nằm ở PHẦN FRAGMENT (#token=...) của link: trình duyệt không gửi fragment lên server,
// nên nó không xuất hiện trong log truy cập, và không bị rò qua header Referer.
const readToken = () => new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [token] = useState(readToken);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState({ busy: false, error: "", done: false });

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) return setState({ busy: false, error: "Mật khẩu phải có ít nhất 8 ký tự.", done: false });
    if (password !== confirm) return setState({ busy: false, error: "Hai mật khẩu không khớp.", done: false });
    setState({ busy: true, error: "", done: false });
    try {
      await apiPublic("/auth/reset-password", { method: "POST", body: { token, newPassword: password } });
      window.history.replaceState(null, "", window.location.pathname); // xoá token khỏi thanh địa chỉ
      setState({ busy: false, error: "", done: true });
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    } catch (err) {
      setState({ busy: false, error: describeError(err), done: false });
    }
  }

  if (!token) {
    return (
      <AuthShell title="Đặt lại mật khẩu" subtitle="Liên kết không hợp lệ.">
        <p className="text-sm text-muted">Hãy mở đúng liên kết do huấn luyện viên gửi cho bạn, hoặc nhờ họ cấp liên kết mới.</p>
        <Link to="/login" className="inline-block mt-4 text-sm font-semibold text-cyan">Về trang đăng nhập</Link>
      </AuthShell>
    );
  }

  if (state.done) {
    return (
      <AuthShell title="Đã đặt mật khẩu mới" subtitle="Bạn có thể đăng nhập ngay bây giờ.">
        <Link to="/login" className="inline-block mt-2 text-sm font-semibold text-cyan">Đến trang đăng nhập →</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Đặt lại mật khẩu" subtitle="Nhập mật khẩu mới cho tài khoản của bạn.">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field id="password" label="Mật khẩu mới" hint="Ít nhất 8 ký tự.">
          <PasswordInput id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field id="confirm" label="Nhập lại mật khẩu">
          <PasswordInput id="confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <FormError message={state.error} />
        <SubmitButton loading={state.busy}>Đặt mật khẩu</SubmitButton>
      </form>
    </AuthShell>
  );
}
