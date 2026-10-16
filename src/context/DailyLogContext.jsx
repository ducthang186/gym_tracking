import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { dateKey } from "../lib/dates";
import { useAuth } from "./AuthContext";
import { useBody } from "./BodyContext";

const DailyLogContext = createContext(null);

// Server trả foodName/proteinG...; giao diện dùng food/protein...
const fromServer = (e) => ({
  id: e.id,
  slot: e.slot,
  food: e.foodName,
  grams: e.grams,
  kcal: e.kcal,
  protein: e.proteinG,
  carbs: e.carbsG,
  fat: e.fatG,
});

export function DailyLogProvider({ children }) {
  const { user } = useAuth();
  const { activeTarget } = useBody();
  const userId = user?.id ?? null;

  const [today, setToday] = useState(dateKey);
  const [date, setDate] = useState(today); // ngày đang xem/ghi
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const latestRequest = useRef(0);

  const load = useCallback(async (day) => {
    const requestId = ++latestRequest.current;
    setStatus("loading");
    try {
      const data = await api(`/food-log?date=${day}`);
      if (requestId !== latestRequest.current) return; // đã chuyển sang ngày/tài khoản khác: bỏ kết quả cũ
      setEntries(data.entries.map(fromServer));
      setStatus("ready");
    } catch {
      if (requestId === latestRequest.current) setStatus("error");
    }
  }, []);

  // Đổi tài khoản hoặc ngày: bỏ ngay nhật ký đang hiển thị (không để lộ nhật ký người trước), rồi tải lại.
  useEffect(() => {
    setEntries([]);
    if (userId) load(date);
    else {
      latestRequest.current++;
      setStatus("idle");
    }
  }, [userId, date, load]);

  // Mở lại tab sau khi qua nửa đêm: sang ngày mới.
  useEffect(() => {
    if (!userId) return undefined;
    const onVisible = () => {
      const now = dateKey();
      if (document.visibilityState !== "visible" || now === today) return;
      setDate((d) => (d === today ? now : d));
      setToday(now);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [userId, today]);

  /**
   * Ghi một món vào ngày đang xem. `{ foodId | custom: { name, kcalPer100g }, grams, slot }`.
   * Server tự tra bảng món ăn và tính calo. Ném ApiError khi thất bại.
   */
  async function addEntry({ foodId, custom, grams, slot }) {
    const data = await api("/food-log", {
      method: "POST",
      body: {
        loggedOn: date,
        grams,
        ...(slot ? { slot } : {}),
        ...(foodId ? { foodId } : { custom }),
        clientRequestId: crypto.randomUUID(),
      },
    });
    setEntries((prev) => [...prev, fromServer(data.entry)]);
  }

  async function removeEntry(id) {
    await api(`/food-log/${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const totals = useMemo(
    () =>
      entries.reduce(
        (acc, e) => ({
          kcal: acc.kcal + e.kcal,
          protein: acc.protein + e.protein,
          carbs: acc.carbs + e.carbs,
          fat: acc.fat + e.fat,
        }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      ),
    [entries],
  );

  // Chưa đặt mục tiêu và chưa đủ hồ sơ để gợi ý → goal = null (giao diện nhắc người dùng thiết lập).
  const goal = activeTarget?.kcal ?? null;
  const remaining = goal === null ? null : Math.round(goal - totals.kcal);

  const value = {
    today,
    date,
    setDate,
    isToday: date === today,
    entries,
    status,
    reload: () => load(date),
    addEntry,
    removeEntry,
    totals,
    goal,
    remaining,
    macroGoals: activeTarget
      ? { protein: activeTarget.proteinG, carbs: activeTarget.carbsG, fat: activeTarget.fatG }
      : null,
  };

  return <DailyLogContext.Provider value={value}>{children}</DailyLogContext.Provider>;
}

export function useDailyLog() {
  const ctx = useContext(DailyLogContext);
  if (!ctx) throw new Error("useDailyLog phải được dùng trong DailyLogProvider");
  return ctx;
}
