import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { useAppData } from "../../context/AppDataContext";
import { describeError } from "../../lib/describeError";
import { WEEKDAY_LABELS } from "../../lib/dates";

// Mỗi dòng một bài. "Bench Press 4x8" → { name: "Bench Press", sets: 4, reps: "8" }; không có dạng NxM thì chỉ có tên.
const LINE_RE = /^(.*?)\s+(\d{1,2})\s*[x×]\s*(\d{1,3}(?:-\d{1,3})?)$/i;

export function parseLines(text) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(LINE_RE);
      return m ? { name: m[1].trim(), sets: Number(m[2]), reps: m[3] } : { name: line, sets: null, reps: null };
    });
}

export const formatLines = (items) =>
  items.map((it) => (it.sets && it.reps ? `${it.name} ${it.sets}x${it.reps}` : it.name)).join("\n");

function DayCard({ day, onSave }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(day.name);
  const [text, setText] = useState(formatLines(day.items));
  const [state, setState] = useState({ busy: false, error: "" });

  async function handleSave() {
    setState({ busy: true, error: "" });
    try {
      await onSave(day.weekday, { name, items: parseLines(text) });
      setEditing(false);
      setState({ busy: false, error: "" });
    } catch (err) {
      setState({ busy: false, error: describeError(err) });
    }
  }

  function handleCancel() {
    setName(day.name);
    setText(formatLines(day.items));
    setState({ busy: false, error: "" });
    setEditing(false);
  }

  return (
    <div className="bg-panel border border-line rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{WEEKDAY_LABELS[day.weekday - 1]}</span>
        {editing ? (
          <div className="flex items-center gap-1.5">
            <button onClick={handleSave} disabled={state.busy} className="text-cyan hover:text-cyan/80 p-1 disabled:opacity-50" aria-label="Lưu">
              <Check size={16} />
            </button>
            <button onClick={handleCancel} className="text-muted hover:text-red-400 p-1" aria-label="Hủy">
              <X size={16} />
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="text-muted hover:text-cyan p-1" aria-label="Sửa">
            <Pencil size={14} />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="Tên buổi tập"
            className="w-full rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-cyan/50"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Mỗi bài tập một dòng, VD: Bench Press 4x8"
            rows={5}
            className="w-full rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-cyan/50"
          />
          <p className="text-[11px] text-muted">Ghi "Tên bài 4x8" để học viên thấy 4 hiệp × 8 lần và ghi mức tạ từng hiệp.</p>
          {state.error && <p role="alert" className="text-xs text-red-400">{state.error}</p>}
        </div>
      ) : (
        <>
          <h3 className="font-display font-semibold text-ink mb-3">{day.name}</h3>
          {day.items.length ? (
            <ul className="space-y-1.5 text-sm text-muted">
              {day.items.map((ex) => (
                <li key={ex.name} className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-cyan shrink-0" />
                  {formatLines([ex])}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted italic">Ngày nghỉ</p>
          )}
        </>
      )}
    </div>
  );
}

export default function AdminWorkouts() {
  const { workoutPlan, updateWorkoutDay } = useAppData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-ink">Lịch tập</h1>
        <p className="text-sm sm:text-base text-muted mt-1">
          Chỉnh sửa bài tập theo từng ngày — thay đổi áp dụng ngay cho mọi học viên.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {workoutPlan.map((day) => (
          <DayCard key={`${day.weekday}-${day.name}-${day.items.length}`} day={day} onSave={updateWorkoutDay} />
        ))}
      </div>
    </div>
  );
}
