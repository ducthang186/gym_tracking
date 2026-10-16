import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  LineChart as RLineChart, Line, BarChart, Bar, ReferenceLine, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import PhotoGallery from "../components/PhotoGallery";
import PhotoUploader from "../components/PhotoUploader";
import { useBody } from "../context/BodyContext";
import { useDailyLog } from "../context/DailyLogContext";
import { api } from "../lib/api";
import { addDays, dateKey, formatDate, formatShort } from "../lib/dates";
import { describeError } from "../lib/describeError";

const tooltipStyle = { background: "#0e1518", border: "1px solid #1b292e", borderRadius: 8, color: "#f4f8f9" };
const tick = { fontSize: 12, fill: "#8d9a9e" };
const fieldClass =
  "rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-cyan/50";

function RangeTabs({ value, onChange, options }) {
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            value === o.value ? "bg-ink text-page" : "bg-page text-muted border border-line hover:border-cyan/40"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Trung bình 7 ngày gần nhất (tính theo ngày lịch, không theo số lần ghi). */
function withMovingAverage(metrics) {
  return metrics.map((m) => {
    const from = addDays(m.date, -6);
    const win = metrics.filter((x) => x.date >= from && x.date <= m.date);
    return { label: formatShort(m.date), date: m.date, weight: m.weightKg, avg7: Math.round((win.reduce((a, x) => a + x.weightKg, 0) / win.length) * 10) / 10 };
  });
}

function WeightSection() {
  const { metrics, saveMetric, removeMetric } = useBody();
  const [range, setRange] = useState(30);
  const [form, setForm] = useState({ date: dateKey(), weight: "", waist: "", fat: "" });
  const [state, setState] = useState({ busy: false, error: "" });

  const data = useMemo(() => {
    const from = range === 0 ? "0000-00-00" : addDays(dateKey(), -range);
    return withMovingAverage(metrics).filter((m) => m.date >= from);
  }, [metrics, range]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.weight) return;
    setState({ busy: true, error: "" });
    try {
      await saveMetric(form.date, {
        weightKg: Number(form.weight),
        ...(form.waist !== "" ? { waistCm: Number(form.waist) } : {}),
        ...(form.fat !== "" ? { bodyFatPct: Number(form.fat) } : {}),
      });
      setForm((f) => ({ ...f, weight: "", waist: "", fat: "" }));
      setState({ busy: false, error: "" });
    } catch (err) {
      setState({ busy: false, error: describeError(err) });
    }
  }

  async function handleRemove(date) {
    setState((s) => ({ ...s, error: "" }));
    try {
      await removeMetric(date);
    } catch (err) {
      setState((s) => ({ ...s, error: describeError(err) }));
    }
  }

  return (
    <div className="bg-panel rounded-xl border border-line p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="font-display font-semibold text-ink">Cân nặng</h2>
        <RangeTabs
          value={range}
          onChange={setRange}
          options={[{ value: 30, label: "30 ngày" }, { value: 90, label: "90 ngày" }, { value: 0, label: "Tất cả" }]}
        />
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-2 sm:grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 mb-5">
        <input type="date" value={form.date} max={dateKey()} onChange={(e) => e.target.value && setForm({ ...form, date: e.target.value })} className={`${fieldClass} col-span-2 sm:col-span-1`} />
        <input required type="number" inputMode="decimal" step="0.1" min={20} max={400} placeholder="Cân nặng (kg)" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className={fieldClass} />
        <input type="number" inputMode="decimal" step="0.1" min={30} max={250} placeholder="Vòng eo (cm)" value={form.waist} onChange={(e) => setForm({ ...form, waist: e.target.value })} className={fieldClass} />
        <input type="number" inputMode="decimal" step="0.1" min={2} max={70} placeholder="Mỡ (%)" value={form.fat} onChange={(e) => setForm({ ...form, fat: e.target.value })} className={fieldClass} />
        <button disabled={state.busy} className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 bg-cyan hover:bg-cyan/90 disabled:opacity-60 text-cyan-deep text-sm font-bold px-3 py-2 rounded-lg transition-colors">
          <Plus size={16} />
          Ghi nhận
        </button>
      </form>
      {state.error && <p role="alert" className="text-sm text-red-400 mb-3">{state.error}</p>}

      {data.length < 2 ? (
        <p className="text-sm text-muted py-10 text-center">Cần ít nhất 2 lần ghi cân nặng trong khoảng này để vẽ biểu đồ.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <RLineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1b292e" />
            <XAxis dataKey="label" tick={tick} />
            <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={tick} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#8d9a9e" }} />
            <Line type="monotone" dataKey="weight" name="Cân nặng (kg)" stroke="#08d9ff" strokeWidth={2} dot={{ r: 3, fill: "#08d9ff" }} />
            <Line type="monotone" dataKey="avg7" name="Trung bình 7 ngày" stroke="#8d9a9e" strokeDasharray="5 4" strokeWidth={2} dot={false} />
          </RLineChart>
        </ResponsiveContainer>
      )}

      {metrics.length > 0 && (
        <div className="mt-5 divide-y divide-line">
          {[...metrics].reverse().slice(0, 8).map((m) => (
            <div key={m.date} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="text-muted w-24 shrink-0">{formatDate(m.date)}</span>
              <span className="text-ink font-medium flex-1">
                {m.weightKg} kg
                {m.waistCm !== null && <span className="text-muted font-normal"> · eo {m.waistCm} cm</span>}
                {m.bodyFatPct !== null && <span className="text-muted font-normal"> · mỡ {m.bodyFatPct}%</span>}
              </span>
              <button onClick={() => handleRemove(m.date)} className="text-muted hover:text-red-400 p-1 shrink-0" aria-label="Xóa">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NutritionSection() {
  const { goal } = useDailyLog();
  const [range, setRange] = useState(7);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const to = dateKey();
    setError("");
    api(`/food-log/summary?from=${addDays(to, -(range - 1))}&to=${to}`)
      .then((data) => !cancelled && setSummary({ ...data, range }))
      .catch((err) => !cancelled && setError(describeError(err)));
    return () => {
      cancelled = true;
    };
  }, [range]);

  const { series, logged, avgKcal, workoutDays } = useMemo(() => {
    if (!summary) return { series: [], logged: 0, avgKcal: null, workoutDays: 0 };
    const byDate = new Map(summary.days.map((d) => [d.date, d]));
    const days = Array.from({ length: summary.range }, (_, i) => addDays(summary.to, -(summary.range - 1 - i)));
    const series = days.map((date) => ({ label: formatShort(date), kcal: Math.round(byDate.get(date)?.kcal ?? 0) }));
    const loggedDays = summary.days.filter((d) => d.kcal > 0);
    return {
      series,
      logged: loggedDays.length,
      avgKcal: loggedDays.length ? Math.round(loggedDays.reduce((a, d) => a + d.kcal, 0) / loggedDays.length) : null,
      workoutDays: summary.days.filter((d) => d.workoutSets > 0).length,
    };
  }, [summary]);

  return (
    <div className="bg-panel rounded-xl border border-line p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="font-display font-semibold text-ink">Calo nạp vào theo ngày</h2>
        <RangeTabs
          value={range}
          onChange={setRange}
          options={[{ value: 7, label: "Tuần" }, { value: 30, label: "Tháng" }, { value: 90, label: "3 tháng" }]}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-400">{error}</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              ["Ngày có ghi", `${logged}/${range}`],
              ["Trung bình", avgKcal === null ? "—" : `${avgKcal} kcal`],
              ["Ngày có tập", `${workoutDays}/${range}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-page border border-line p-3">
                <p className="text-[11px] text-muted">{label}</p>
                <p className="font-display font-bold text-ink text-sm sm:text-base mt-0.5">{value}</p>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1b292e" />
              <XAxis dataKey="label" tick={tick} interval={range > 14 ? Math.floor(range / 7) : 0} />
              <YAxis tick={tick} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(8,217,255,.06)" }} />
              <Bar dataKey="kcal" name="Calo (kcal)" fill="#08d9ff" radius={[3, 3, 0, 0]} />
              {goal !== null && <ReferenceLine y={goal} stroke="#8d9a9e" strokeDasharray="5 4" label={{ value: "Mục tiêu", fill: "#8d9a9e", fontSize: 11, position: "insideTopRight" }} />}
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}

function PhotoSection() {
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api("/photos")
      .then((data) => !cancelled && setPhotos(data.photos))
      .catch((err) => !cancelled && setError(describeError(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete(photo) {
    if (!window.confirm("Xoá ảnh này? Không khôi phục được.")) return;
    setError("");
    try {
      await api(`/photos/${photo.id}`, { method: "DELETE" });
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } catch (err) {
      setError(describeError(err));
    }
  }

  const add = (photo) => setPhotos((prev) => [photo, ...prev].sort((a, b) => b.takenOn.localeCompare(a.takenOn) || b.createdAt.localeCompare(a.createdAt)));

  return (
    <div className="bg-panel rounded-xl border border-line p-4 sm:p-6">
      <h2 className="font-display font-semibold text-ink mb-1">Ảnh trước / sau tập</h2>
      <p className="text-xs text-muted mb-4">Ảnh chỉ bạn và huấn luyện viên của bạn xem được. Hệ thống tự xoá thông tin vị trí/thiết bị trong ảnh. Nên chụp ảnh ở phần Check-in mỗi tuần.</p>
      <div className="mb-5"><PhotoUploader onUploaded={add} /></div>
      {error && <p role="alert" className="text-sm text-red-400 mb-4">{error}</p>}
      <PhotoGallery photos={photos} base="/photos" onDelete={handleDelete} />
    </div>
  );
}

export default function Progress() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-ink">Tiến độ</h1>
        <p className="text-sm sm:text-base text-muted mt-1">Theo dõi cân nặng, calo nạp vào và ảnh trước/sau tập.</p>
      </div>

      <WeightSection />
      <NutritionSection />
      <PhotoSection />
    </div>
  );
}
