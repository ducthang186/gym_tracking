import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ChevronDown, Plus } from "lucide-react";
import FoodCalculator from "../components/FoodCalculator";
import { useBody } from "../context/BodyContext";
import { useDailyLog } from "../context/DailyLogContext";
import { api } from "../lib/api";
import { describeError } from "../lib/describeError";
import { WEEKDAY_LABELS, weekdayIndex } from "../lib/dates";

function MealCard({ meal, onLog }) {
  const [open, setOpen] = useState(true);
  const [state, setState] = useState("idle"); // idle | busy | done
  const [error, setError] = useState("");
  const totalGrams = meal.items.reduce((sum, item) => sum + item.grams, 0);

  async function handleLog() {
    setState("busy");
    setError("");
    try {
      await onLog(meal);
      setState("done");
    } catch (err) {
      setError(describeError(err));
      setState("idle");
    }
  }

  return (
    <div className="border border-line rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 sm:px-4 py-3.5 bg-panel-2 hover:bg-panel transition-colors"
      >
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <span className="text-xs sm:text-sm font-mono text-muted w-11 sm:w-14 text-left shrink-0">{meal.time}</span>
          <div className="text-left min-w-0">
            <p className="font-medium text-ink text-sm sm:text-base">{meal.name}</p>
            <p className="text-xs text-muted">{meal.items.length} món · {totalGrams} g</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <span className="text-xs sm:text-sm font-semibold text-cyan bg-cyan/10 px-2 sm:px-2.5 py-1 rounded-full whitespace-nowrap">
            {Math.round(meal.kcal)} kcal
          </span>
          <ChevronDown size={16} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="divide-y divide-line">
          {meal.items.map((item) => (
            <div key={item.foodId} className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 pl-[3.5rem] sm:pl-[4.7rem] bg-panel">
              <span className="text-sm text-muted min-w-0 break-words">{item.food}</span>
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <span className="text-xs font-medium text-muted bg-page px-2 py-0.5 rounded-full whitespace-nowrap border border-line">
                  {item.grams} g
                </span>
                <span className="text-xs text-muted w-14 sm:w-16 text-right whitespace-nowrap">{Math.round(item.kcal)} kcal</span>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 bg-panel">
            <span className="text-xs text-red-400">{error}</span>
            <button
              onClick={handleLog}
              disabled={state !== "idle"}
              className="flex items-center gap-1.5 text-xs font-semibold text-cyan hover:text-cyan/80 disabled:text-muted shrink-0"
            >
              <Plus size={14} />
              {state === "done" ? "Đã ghi vào nhật ký" : state === "busy" ? "Đang ghi..." : "Ghi cả bữa vào nhật ký"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MealPlan() {
  const { activeTarget } = useBody();
  const { addEntry, date } = useDailyLog();
  const [activeDay, setActiveDay] = useState(() => weekdayIndex());
  const [variant, setVariant] = useState(0);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");
  const kcal = activeTarget?.kcal ?? null;

  useEffect(() => {
    if (kcal === null) return undefined;
    let cancelled = false;
    setError("");
    api(`/meal-plan/suggest?kcal=${kcal}&day=${activeDay}&variant=${variant}`)
      .then((data) => !cancelled && setPlan(data.plan))
      .catch((err) => !cancelled && setError(describeError(err)));
    return () => {
      cancelled = true;
    };
  }, [kcal, activeDay, variant]);

  async function logMeal(meal) {
    // Tuần tự để thứ tự trong nhật ký đúng thứ tự món.
    for (const item of meal.items) {
      await addEntry({ foodId: item.foodId, grams: item.grams, slot: meal.slot });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-ink">Dinh dưỡng</h1>
          <p className="text-sm sm:text-base text-muted mt-1">
            Ghi lại món bạn ăn và tham khảo kế hoạch ăn gợi ý theo mục tiêu calo của bạn.
          </p>
        </div>
        <button
          onClick={() => setVariant((v) => (v + 1) % 100)}
          disabled={kcal === null}
          className="flex items-center justify-center gap-2 bg-cyan hover:bg-cyan/90 disabled:opacity-50 text-cyan-deep text-sm font-bold px-4 py-2.5 rounded-lg transition-colors shrink-0"
        >
          <Sparkles size={16} />
          Tạo meal plan tự động
        </button>
      </div>

      <FoodCalculator />

      <h2 className="font-display font-semibold text-ink pt-2">Kế hoạch ăn gợi ý</h2>

      {kcal === null ? (
        <div className="bg-panel rounded-xl border border-line p-5 text-sm text-muted">
          Chưa có mục tiêu calo để tạo kế hoạch. Hãy điền thông tin cơ thể, cân nặng và đặt mục tiêu trong{" "}
          <Link to="/app/profile" className="text-cyan font-semibold">Hồ sơ</Link>.
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {WEEKDAY_LABELS.map((d, i) => (
              <button
                key={d}
                onClick={() => setActiveDay(i)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeDay === i ? "bg-ink text-page" : "bg-panel text-muted border border-line hover:border-cyan/40"
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

          {plan && (
            <div className="bg-panel rounded-xl border border-line p-3 sm:p-4 space-y-3">
              <p className="text-xs text-muted px-1">
                Tổng {Math.round(plan.kcal)} kcal · P {Math.round(plan.proteinG)}g · C {Math.round(plan.carbsG)}g · F {Math.round(plan.fatG)}g
                {" — "}ghi vào nhật ký sẽ tính cho ngày bạn đang chọn ở bộ tính ({date.split("-").reverse().join("/")}).
              </p>
              {plan.meals.map((meal) => (
                <MealCard key={`${plan.kcal}-${meal.time}-${variant}-${activeDay}`} meal={meal} onLog={logMeal} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
