import { Link, Navigate, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext";

// Các guard này chỉ phục vụ TRẢI NGHIỆM (chuyển hướng đúng chỗ). Ranh giới bảo mật thật là server:
// mọi endpoint đều tự kiểm tra token và quyền, bất kể frontend hiển thị gì.

function FullScreenLoader() {
  return (
    <div className="min-h-screen bg-page flex items-center justify-center text-muted text-sm" role="status">
      Đang tải...
    </div>
  );
}

/** Chỉ cho người đã đăng nhập; chưa đăng nhập thì chuyển về /login và nhớ trang định vào. */
export function RequireAuth({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <FullScreenLoader />;
  if (status !== "authenticated") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

/** Chỉ cho các vai trò được liệt kê, ví dụ roles={["admin", "coach"]}. */
export function RequireRole({ roles, children }) {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === "loading") return <FullScreenLoader />;
  if (status !== "authenticated") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!roles.includes(user.role)) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <ShieldAlert className="mx-auto text-cyan mb-4" size={36} />
          <h1 className="font-display font-bold text-xl text-ink">Bạn không có quyền truy cập</h1>
          <p className="text-sm text-muted mt-2">Khu vực này chỉ dành cho huấn luyện viên và quản trị viên.</p>
          <Link to="/app" className="inline-block mt-5 text-sm font-semibold text-cyan hover:text-cyan/80">
            Về trang của tôi
          </Link>
        </div>
      </div>
    );
  }
  return children;
}

/** Trang chỉ dành cho khách (đăng nhập/đăng ký): người đã đăng nhập thì chuyển thẳng vào app. */
export function GuestOnly({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <FullScreenLoader />;
  if (status === "authenticated") return <Navigate to={location.state?.from ?? "/app"} replace />;
  return children;
}
