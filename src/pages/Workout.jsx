import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, Dumbbell, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useAppData } from "../context/AppDataContext";
import { api } from "../lib/api";
import { dateKey, formatDate, WEEKDAY_LABELS, weekdayIndex } from "../lib/dates";
import { describeError } from "../lib/describeError";

const fieldClass =
  "w-full rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-cyan/50";

const planText = (it) => (it.sets && it.reps ? `${it.sets} × ${it.reps}` : it.sets ? `${it.sets} hiệp` : "");
const firstNumber = (s) => (s && /\d+/.test(s) ? s.match(/\d+/)[0] : "");

function ExerciseLogger({ item, sets, today, onAdd, onRemove }) {
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState(null); // các hiệp của buổi gần nhất trước hôm nay
  const [form, setForm] = useState({ weight: "", reps: firstNumber(item.reps) });
  const [state, setState] = useState({ busy: false, error: "" });
  const isCardio = item.sets === null;
  const isExtra = item.sets === 0; // bài ngoài kế hoạch (đã ghi nhưng không có trong giáo án hôm nay)
  const done = isCardio ? sets.length > 0 : !isExtra && sets.length >= item.sets;

  // Mở bài lần đầu: tải lịch sử để gợi ý mức tạ lần trước.
  useEffect(() => {
    if (!open || isCardio || last !== null) return;
    let cancelled = false;
    api(`/workout-log/history?exercise=${encodeURIComponent(item.name)}`)
      .then(({ sets: history }) => {
        if (cancelled) return;
        const before = history.filter((s) => s.performedOn < today);
        const lastDate = before[0]?.performedOn;
        const lastSets = before.filter((s) => s.performedOn === lastDate).reverse();
        setLast(lastSets);
        if (lastSets.length) {
          setForm((f) => (f.weight === "" ? { ...f, weight: String(lastSets[lastSets.length - 1].weightKg) } : f));
        }
      })
      .catch(() => !cancelled && setLast([]));
    return () => {
      cancelled = true;
    };
  }, [open, isCardio, last, item.name, today]);

  async function submit(payload) {
    setState({ busy: true, error: "" });
    try {
      await onAdd(item.name, payload);
      setState({ busy: false, error: "" });
    } catch (err) {
      setState({ busy: false, error: describeError(err) });
    }
  }

  function handleAddSet(e) {
    e.preventDefault();
    if (!form.reps) return;
    submit({ reps: Number(form.reps), weightKg: form.weight === "" ? 0 : Number(form.weight) });
  }

  return (
    <div className="border border-line rounded-lg overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-3 px-3 sm:px-4 py-3 bg-panel-2 hover:bg-panel transition-colors text-left">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${done ? "bg-cyan border-cyan text-cyan-deep" : "border-line text-transparent"}`}>
            <Check size={12} strokeWidth={3} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink truncate">{item.name}</p>
            <p className="text-xs text-muted">{isCardio ? (done ? "Đã hoàn thành" : "Chưa hoàn thành") : isExtra ? `Ngoài kế hoạch · ${sets.length} hiệp` : `${planText(item)} · đã ghi ${sets.length}/${item.sets}`}</p>
          </div>
        </div>
        <ChevronDown size={16} className={`text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="bg-panel px-3 sm:px-4 py-3 space-y-3">
          {sets.length > 0 && (
            <ul className="divide-y divide-line">
              {sets.map((s, i) => (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-muted">{isCardio ? "Hoàn thành" : <>Hiệp {i + 1}: <b className="text-ink">{s.weightKg} kg × {s.reps}</b></>}</span>
                  <button onClick={() => onRemove(s.id)} className="text-muted hover:text-red-400 p-1" aria-label="Xóa hiệp">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {isCardio ? (
            !done && (
              <button disabled={state.busy} onClick={() => submit({ reps: 1, weightKg: 0 })} className="bg-cyan hover:bg-cyan/90 disabled:opacity-60 text-cyan-deep text-sm font-bold px-4 py-2 rounded-lg">
                Đánh dấu đã hoàn thành
              </button>
            )
          ) : (
            <>
              {last && last.length > 0 && (
                <p className="text-xs text-muted">Lần trước: {last.map((s) => `${s.weightKg}kg × ${s.reps}`).join(", ")}</p>
              )}
              <form onSubmit={handleAddSet} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <div>
                  <label className="block text-[11px] text-muted mb-1">Mức tạ (kg)</label>
                  <input type="number" inputMode="decimal" min={0} max={1000} step="0.5" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className={fieldClass} />
                </div>
                <div>
                  <label className="block text-[11px] text-muted mb-1">Số lần</label>
                  <input required type="number" inputMode="numeric" min={1} max={500} value={form.reps} onChange={(e) => setForm({ ...form, reps: e.target.value })} className={fieldClass} />
                </div>
                <button disabled={state.busy} className="bg-cyan hover:bg-cyan/90 disabled:opacity-60 text-cyan-deep text-sm font-bold px-4 py-2 rounded-lg">
                  Ghi hiệp
                </button>
              </form>
            </>
          )}
          {state.error && <p role="alert" className="text-xs text-red-400">{state.error}</p>}
        </div>
      )}
    </div>
  );
}

function DayList({ day }) {
  return (
    <div className="bg-panel rounded-xl border border-line p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{WEEKDAY_LABELS[day.weekday - 1]}</span>
        <Dumbbell size={16} className="text-cyan" />
      </div>
      <h3 className="font-display font-semibold text-ink mb-3">{day.name}</h3>
      {day.items.length ? (
        <ul className="space-y-1.5 text-sm text-muted">
          {day.items.map((ex) => (
            <li key={ex.name} className="flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-cyan shrink-0" />
              {ex.name}{planText(ex) && <span className="text-muted/70"> · {planText(ex)}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted italic">Ngày nghỉ</p>
      )}
    </div>
  );
}

export default function Workout() {
  const { user } = useAuth();
  const userId = user?.id;
  const { workoutPlan } = useAppData();
  const [today] = useState(dateKey);
  const [sets, setSets] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const todayDay = workoutPlan.find((d) => d.weekday === weekdayIndex(today) + 1);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setSets((await api(`/workout-log?date=${today}`)).sets);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [today]);

  useEffect(() => {
    setSets([]);
    if (userId) load();
  }, [userId, load]);

  async function addSet(exerciseName, { reps, weightKg }) {
    const data = await api("/workout-log", {
      method: "POST",
      body: { performedOn: today, exerciseName, reps, weightKg, clientRequestId: crypto.randomUUID() },
    });
    setSets((prev) => [...prev, data.set]);
  }

  async function removeSet(id) {
    setError("");
    try {
      await api(`/workout-log/${id}`, { method: "DELETE" });
      setSets((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(describeError(err));
    }
  }

  const planNames = new Set(todayDay?.items.map((i) => i.name) ?? []);
  const extraNames = [...new Set(sets.filter((s) => !planNames.has(s.exerciseName)).map((s) => s.exerciseName))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-ink">Lịch tập</h1>
        <p className="text-sm sm:text-base text-muted mt-1">Kế hoạch tập luyện trong tuần và nhật ký buổi tập hôm nay.</p>
      </div>

      <div className="bg-panel rounded-xl border border-cyan/30 p-4 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan">Hôm nay · {WEEKDAY_LABELS[weekdayIndex(today)]} {formatDate(today)}</p>
        {!todayDay ? (
          <p className="text-sm text-muted mt-3">Đang tải lịch tập...</p>
        ) : (
          <>
            <h2 className="font-display font-semibold text-ink text-lg mt-1 mb-4">{todayDay.name}</h2>
            {status === "error" && (
              <p className="text-sm text-red-400 mb-3">Không tải được nhật ký tập. <button onClick={load} className="underline">Thử lại</button></p>
            )}
            {error && <p role="alert" className="text-sm text-red-400 mb-3">{error}</p>}
            {todayDay.items.length === 0 && extraNames.length === 0 ? (
              <p className="text-sm text-muted italic">Hôm nay là ngày nghỉ. Hãy ngủ đủ và ăn đủ chất.</p>
            ) : (
              <div className="space-y-2.5">
                {todayDay.items.map((item) => (
                  <ExerciseLogger key={`${userId}-${item.name}`} item={item} today={today} sets={sets.filter((s) => s.exerciseName === item.name)} onAdd={addSet} onRemove={removeSet} />
                ))}
                {extraNames.map((name) => (
                  <ExerciseLogger key={`${userId}-extra-${name}`} item={{ name, sets: 0, reps: null }} today={today} sets={sets.filter((s) => s.exerciseName === name)} onAdd={addSet} onRemove={removeSet} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <h2 className="font-display font-semibold text-ink pt-2">Cả tuần</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {workoutPlan.map((day) => <DayList key={day.weekday} day={day} />)}
      </div>
    </div>
  );
}
