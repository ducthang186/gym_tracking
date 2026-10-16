import { useMemo, useState } from "react";
import { Plus, Trash2, Calculator } from "lucide-react";
import { customFood } from "../data/foods";
import { useDailyLog } from "../context/DailyLogContext";
import { useAppData } from "../context/AppDataContext";
import { describeError } from "../lib/describeError";
import { formatDate } from "../lib/dates";

export const SLOTS = [
  { value: "breakfast", label: "Bữa sáng" },
  { value: "lunch", label: "Bữa trưa" },
  { value: "dinner", label: "Bữa tối" },
  { value: "snack", label: "Ăn nhẹ" },
];
const SLOT_LABEL = Object.fromEntries(SLOTS.map((s) => [s.value, s.label]));

const fieldClass =
  "w-full rounded-lg border border-line bg-page px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-cyan/50";

export default function FoodCalculator() {
  const { today, date, setDate, isToday, entries, status, reload, addEntry, removeEntry, totals, goal, remaining } = useDailyLog();
  const { foods } = useAppData();
  const [pickedId, setFoodId] = useState(null);
  const [slot, setSlot] = useState("lunch");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Món đang chọn; chưa chọn (hoặc món đã bị xoá) thì lấy món đầu danh sách tải từ server.
  const foodId =
    pickedId === "custom" || foods.some((f) => f.id === pickedId) ? pickedId : foods[0]?.id ?? "custom";
  const [grams, setGrams] = useState(100);
  const [customKcal, setCustomKcal] = useState(100);

  const isCustom = foodId === "custom";
  const selected = foods.find((f) => f.id === foodId) ?? customFood;

  const perGram = isCustom ? { kcal: Number(customKcal) || 0, protein: 0, carbs: 0, fat: 0 } : selected;

  const result = useMemo(() => {
    const ratio = (Number(grams) || 0) / 100;
    return {
      kcal: perGram.kcal * ratio,
      protein: perGram.protein * ratio,
      carbs: perGram.carbs * ratio,
      fat: perGram.fat * ratio,
    };
  }, [perGram, grams]);

  async function handleAdd() {
    if (!grams || Number(grams) <= 0 || busy) return;
    setBusy(true);
    setError("");
    try {
      await addEntry({
        grams: Number(grams),
        slot,
        ...(isCustom
          ? { custom: { name: "Món tự nhập", kcalPer100g: Number(customKcal) || 0 } }
          : { foodId: selected.id }),
      });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id) {
    setError("");
    try {
      await removeEntry(id);
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <div className="bg-panel rounded-xl border border-line p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan/10 text-cyan flex items-center justify-center shrink-0">
            <Calculator size={16} />
          </div>
          <h2 className="font-display font-semibold text-ink">Tính calo món ăn</h2>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted">
          Ngày
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="rounded-lg border border-line bg-page px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-cyan/50"
          />
        </label>
      </div>

      <div className="grid sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
        <div>
          <label className="block text-xs text-muted mb-1.5">Món ăn</label>
          <select value={foodId} onChange={(e) => setFoodId(e.target.value)} className={fieldClass}>
            {foods.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
            <option value="custom">{customFood.name}</option>
          </select>
        </div>

        {isCustom && (
          <div>
            <label className="block text-xs text-muted mb-1.5">Kcal / 100g</label>
            <input type="number" inputMode="numeric" min={0} value={customKcal} onChange={(e) => setCustomKcal(e.target.value)} className={`${fieldClass} sm:w-28`} />
          </div>
        )}

        <div>
          <label className="block text-xs text-muted mb-1.5">Khối lượng (g)</label>
          <input type="number" inputMode="numeric" min={0} value={grams} onChange={(e) => setGrams(e.target.value)} className={`${fieldClass} sm:w-28`} />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">Bữa</label>
          <select value={slot} onChange={(e) => setSlot(e.target.value)} className={fieldClass}>
            {SLOTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 p-3.5 rounded-lg bg-page border border-line">
        <div className="text-sm text-muted">
          <span className="text-ink font-display font-bold text-lg">{Math.round(result.kcal)}</span> kcal
          <span className="block sm:inline text-muted text-xs sm:ml-2 mt-0.5 sm:mt-0">
            P {result.protein.toFixed(1)}g · C {result.carbs.toFixed(1)}g · F {result.fat.toFixed(1)}g
          </span>
        </div>
        <button
          onClick={handleAdd}
          disabled={busy}
          className="flex items-center justify-center gap-1.5 bg-cyan hover:bg-cyan/90 text-cyan-deep text-sm font-bold px-4 py-2.5 sm:py-2 rounded-lg transition-colors shrink-0 disabled:opacity-60"
        >
          <Plus size={15} />
          Thêm vào nhật ký
        </button>
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-line text-sm gap-3">
        <span className="text-muted">
          Đã ghi nhận {isToday ? "hôm nay" : formatDate(date)}: <b className="text-ink">{Math.round(totals.kcal)}</b>
          {goal !== null && <> / {goal}</>} kcal
        </span>
        {remaining === null ? (
          <span className="text-xs text-muted">Chưa có mục tiêu calo (đặt trong Hồ sơ)</span>
        ) : (
          <span className={`font-semibold shrink-0 ${remaining < 0 ? "text-red-400" : "text-cyan"}`}>
            {remaining < 0 ? `Vượt ${-remaining}` : `Còn lại: ${remaining}`} kcal
          </span>
        )}
      </div>

      {status === "error" && (
        <p className="mt-4 text-sm text-red-400">
          Không tải được nhật ký.{" "}
          <button onClick={reload} className="underline">Thử lại</button>
        </p>
      )}

      {entries.length > 0 && (
        <div className="mt-4 divide-y divide-line">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-ink truncate">{e.food}</p>
                <p className="text-xs text-muted">
                  {SLOT_LABEL[e.slot]} · {e.grams}g · {Math.round(e.kcal)} kcal
                </p>
              </div>
              <button onClick={() => handleRemove(e.id)} className="text-muted hover:text-red-400 transition-colors shrink-0 p-1" aria-label="Xóa">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
