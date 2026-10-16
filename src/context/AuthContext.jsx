import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiPublic, logoutRequest, refreshSession, setAccessToken, setSessionLostHandler } from "../lib/api";

const AuthContext = createContext(null);

const ANONYMOUS = { status: "anonymous", user: null };

export function AuthProvider({ children }) {
  // status: "loading" (đang khôi phục phiên) | "authenticated" | "anonymous"
  const [state, setState] = useState({ status: "loading", user: null });

  useEffect(() => {
    setSessionLostHandler(() => setState(ANONYMOUS));

    // Khôi phục phiên khi tải trang: cookie refresh token (httpOnly) tự được gửi kèm.
    // refreshSession() gom các lời gọi đồng thời nên React StrictMode (chạy effect hai lần ở dev) vẫn chỉ refresh một lần.
    let cancelled = false;
    refreshSession()
      .then((data) => !cancelled && setState({ status: "authenticated", user: data.user }))
      .catch(() => !cancelled && setState(ANONYMOUS));
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (identifier, password) => {
    const data = await apiPublic("/auth/login", { method: "POST", body: { identifier, password } });
    setAccessToken(data.accessToken);
    setState({ status: "authenticated", user: data.user });
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await apiPublic("/auth/register", { method: "POST", body: payload });
    // Đang bật duyệt tay: tài khoản được tạo nhưng chưa đăng nhập.
    if (data.pendingApproval) return { pending: true, user: data.user };
    setAccessToken(data.accessToken);
    setState({ status: "authenticated", user: data.user });
    return { pending: false, user: data.user };
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setState(ANONYMOUS);
  }, []);

  const value = useMemo(
    () => ({ status: state.status, user: state.user, login, register, logout }),
    [state, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải được dùng trong AuthProvider");
  return ctx;
}
