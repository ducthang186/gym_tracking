import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { addDays, dateKey } from "../lib/dates";
import { useAuth } from "./AuthContext";

const BodyContext = createContext(null);

const EMPTY_TARGET = { target: null, suggestion: null, missing: [], bmi: null };

export function bmiOf(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  return Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;
}

/** Hồ sơ thể chất, lịch sử cân nặng và mục tiêu dinh dưỡng của người đang đăng nhập (dữ liệu thật từ server). */
export function BodyProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [profile, setProfile] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [targetInfo, setTargetInfo] = useState(EMPTY_TARGET);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error

  const reloadTarget = useCallback(async () => {
    setTargetInfo(await api(`/nutrition-targets/current?date=${dateKey()}`));
  }, []);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const today = dateKey();
      const [p, m, t] = await Promise.all([
        api("/me/profile"),
        api(`/body-metrics?from=${addDays(today, -365)}&to=${today}`),
        api(`/nutrition-targets/current?date=${today}`),
      ]);
      setProfile(p.profile);
      setMetrics(m.metrics);
      setTargetInfo(t);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  // Đổi tài khoản: xoá ngay dữ liệu của người trước, rồi tải của người mới.
  useEffect(() => {
    setProfile(null);
    setMetrics([]);
    setTargetInfo(EMPTY_TARGET);
    if (userId) load();
    else setStatus("idle");
  }, [userId, load]);

  const saveProfile = useCallback(
    async (patch) => {
      const data = await api("/me/profile", { method: "PATCH", body: patch });
      setProfile(data.profile);
      await reloadTarget();
    },
    [reloadTarget],
  );

  const saveMetric = useCallback(
    async (date, values) => {
      const data = await api(`/body-metrics/${date}`, { method: "PUT", body: values });
      setMetrics((prev) => [...prev.filter((m) => m.date !== date), data.metric].sort((a, b) => a.date.localeCompare(b.date)));
      await reloadTarget();
    },
    [reloadTarget],
  );

  const removeMetric = useCallback(
    async (date) => {
      await api(`/body-metrics/${date}`, { method: "DELETE" });
      setMetrics((prev) => prev.filter((m) => m.date !== date));
      await reloadTarget();
    },
    [reloadTarget],
  );

  const saveTarget = useCallback(async (values) => {
    setTargetInfo(await api("/nutrition-targets", { method: "PUT", body: { effectiveFrom: dateKey(), ...values } }));
  }, []);

  const value = useMemo(() => {
    const latest = metrics.length ? metrics[metrics.length - 1] : null;
    const first = metrics.length ? metrics[0] : null;
    const heightCm = profile?.heightCm ?? null;
    return {
      status,
      reload: load,
      profile,
      metrics,
      latestWeight: latest?.weightKg ?? null,
      startWeight: first?.weightKg ?? null,
      bmi: bmiOf(latest?.weightKg, heightCm),
      targetInfo,
      // Mục tiêu đang áp dụng: do người dùng đặt, nếu chưa có thì dùng gợi ý tính từ hồ sơ.
      activeTarget: targetInfo.target ?? targetInfo.suggestion ?? null,
      saveProfile,
      saveMetric,
      removeMetric,
      saveTarget,
    };
  }, [status, load, profile, metrics, targetInfo, saveProfile, saveMetric, removeMetric, saveTarget]);

  return <BodyContext.Provider value={value}>{children}</BodyContext.Provider>;
}

export function useBody() {
  const ctx = useContext(BodyContext);
  if (!ctx) throw new Error("useBody phải được dùng trong BodyProvider");
  return ctx;
}
