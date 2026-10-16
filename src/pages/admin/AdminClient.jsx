import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, KeyRound } from "lucide-react";
import { BarChart, Bar, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AuthImage from "../../components/AuthImage";
import PhotoGallery from "../../components/PhotoGallery";
import ResetLinkBox from "../../components/ResetLinkBox";
import { useAuth } from "../../context/AuthContext";
import { bmiOf } from "../../context/BodyContext";
import { api } from "../../lib/api";
import { addDays, dateKey, formatDate, formatShort } from "../../lib/dates";
import { describeError } from "../../lib/describeError";
import { formatPhone } from "../../lib/phone";

const tooltipStyle = { background: "#0e1518", border: "1px solid #1b292e", borderRadius: 8, color: "#f4f8f9" };
const tick = { fontSize: 12, fill: "#8d9a9e" };
const fieldClass =
  "w-full rounded-lg border border-line bg-page px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-cyan/50";
const card = "bg-panel rounded-xl border border-line p-4 sm:p-6";

function AssignmentForm({ client, onSaved }) {
  const [coaches, setCoaches] = useState([]);
  const [form, setForm] = useState({ coachId: client.coachId ?? "", package: client.package ?? "", clientStatus: client.clientStatus });
  const [state, setState] = useState({ busy: false, error: "", saved: false });

  useEffect(() => {
    api("/admin/coaches").then((d) => setCoaches(d.coaches)).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setState({ busy: true, error: "", saved: false });
    try {
      await api(`/admin/users/${client.id}`, {
        method: "PATCH",
        body: { coachId: form.coachId || null, package: form.package.trim() || null, clientStatus: form.clientStatus },
      });
      setState({ busy: false, error: "", saved: true });
      onSaved();
    } catch (err) {
      setState({ busy: false, error: describeError(err), saved: false });
    }
  }

  return (
    <form onSubmit={handleSubmit} className={card}>
      <h2 className="font-display font-semibold text-ink mb-4">Phân công</h2>
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-muted mb-1.5">Huấn luyện viên phụ trách</label>
          <select value={form.coachId} onChange={(e) => setForm({ ...form, coachId: e.target.value })} className={fieldClass}>
            <option value="">Chưa gán</option>
            {coaches.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">Gói</label>
          <input maxLength={60} value={form.package} onChange={(e) => setForm({ ...form, package: e.target.value })} placeholder="VD: 1:1 Personal Coaching" className={fieldClass} />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">Tình trạng học viên</label>
          <select value={form.clientStatus} onChange={(e) => setForm({ ...form, clientStatus: e.target.value })} className={fieldClass}>
            <option value="active">Đang tập</option>
            <option value="paused">Tạm dừng</option>
            <option value="ended">Đã kết thúc</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-4">
        <button disabled={state.busy} className="bg-cyan hover:bg-cyan/90 disabled:opacity-60 text-cyan-deep text-sm font-bold px-4 py-2.5 rounded-lg">Lưu</button>
        {state.saved && <span className="text-sm text-cyan">Đã lưu.</span>}
        {state.error && <span role="alert" className="text-sm text-red-400">{state.error}</span>}
      </div>
    </form>
  );
}

function TargetForm({ clientId, info, onSaved }) {
  const src = info.target ?? info.suggestion;
  const [form, setForm] = useState({ kcal: src?.kcal ?? "", proteinG: src?.proteinG ?? "", carbsG: src?.carbsG ?? "", fatG: src?.fatG ?? "" });
  const [state, setState] = useState({ busy: false, error: "", saved: false });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setState({ busy: true, error: "", saved: false });
    try {
      await api(`/clients/${clientId}/nutrition-targets`, {
        method: "POST",
        body: { effectiveFrom: dateKey(), kcal: Number(form.kcal), proteinG: Number(form.proteinG), carbsG: Number(form.carbsG), fatG: Number(form.fatG) },
      });
      setState({ busy: false, error: "", saved: true });
      onSaved();
    } catch (err) {
      setState({ busy: false, error: describeError(err), saved: false });
    }
  }

  return (
    <form onSubmit={handleSubmit} className={card}>
      <h2 className="font-display font-semibold text-ink mb-1">Mục tiêu dinh dưỡng</h2>
      <p className="text-sm text-muted mb-4">
        {info.target ? `Đang áp dụng từ ${formatDate(info.target.effectiveFrom)}.` : "Học viên chưa có mục tiêu riêng."}
        {info.suggestion && <> Gợi ý theo công thức: {info.suggestion.kcal} kcal.</>}
        {!info.suggestion && info.missing.length > 0 && <> Chưa đủ hồ sơ để gợi ý tự động.</>}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[["kcal", "Calo (kcal)", 800, 6000], ["proteinG", "Protein (g)", 0, 500], ["carbsG", "Carbs (g)", 0, 1000], ["fatG", "Chất béo (g)", 0, 400]].map(([k, label, min, max]) => (
          <div key={k}>
            <label className="block text-xs text-muted mb-1.5">{label}</label>
            <input required type="number" inputMode="numeric" min={min} max={max} value={form[k]} onChange={set(k)} className={fieldClass} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-4">
        <button disabled={state.busy} className="bg-cyan hover:bg-cyan/90 disabled:opacity-60 text-cyan-deep text-sm font-bold px-4 py-2.5 rounded-lg">Đặt mục tiêu</button>
        {state.saved && <span className="text-sm text-cyan">Đã lưu — học viên thấy ngay.</span>}
        {state.error && <span role="alert" className="text-sm text-red-400">{state.error}</span>}
      </div>
    </form>
  );
}

function CheckinItem({ clientId, checkin, photos, onSaved }) {
  const [note, setNote] = useState(checkin.coachNote ?? "");
  const [state, setState] = useState({ busy: false, error: "", saved: false });

  async function handleSave() {
    setState({ busy: true, error: "", saved: false });
    try {
      await api(`/clients/${clientId}/checkins/${checkin.weekStart}/coach-note`, { method: "PUT", body: { note } });
      setState({ busy: false, error: "", saved: true });
      onSaved();
    } catch (err) {
      setState({ busy: false, error: describeError(err), saved: false });
    }
  }

  return (
    <div className="rounded-lg border border-line bg-page p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">Tuần {formatDate(checkin.weekStart)}</p>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${checkin.trained ? "text-cyan bg-cyan/10" : "text-red-300 bg-red-400/10"}`}>
          {checkin.trained ? "Có tập" : "Không tập"}
        </span>
      </div>
      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((p) => (
            <AuthImage key={p.id} path={`/clients/${clientId}/photos/${p.id}/file?size=thumb`} alt={`Ảnh ${formatDate(p.takenOn)}`} className="w-16 aspect-3/4 rounded-md object-cover border border-line shrink-0" />
          ))}
        </div>
      )}
      {checkin.note && <p className="text-sm text-muted whitespace-pre-line">"{checkin.note}"</p>}
      <textarea rows={2} maxLength={1000} value={note} onChange={(e) => { setNote(e.target.value); setState((s) => ({ ...s, saved: false })); }} placeholder="Phản hồi của huấn luyện viên..." className={fieldClass} aria-label={`Phản hồi tuần ${checkin.weekStart}`} />
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={state.busy} className="text-sm font-semibold text-cyan disabled:opacity-60">Gửi phản hồi</button>
        {state.saved && <span className="text-xs text-cyan">Đã gửi.</span>}
        {state.error && <span role="alert" className="text-xs text-red-400">{state.error}</span>}
      </div>
    </div>
  );
}

export default function AdminClient() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const [data, setData] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState("");
  const [link, setLink] = useState(null);

  const load = useCallback(async () => {
    try {
      const [overview, photoList] = await Promise.all([
        api(`/clients/${id}/overview?date=${dateKey()}`),
        api(`/clients/${id}/photos`),
      ]);
      setData(overview);
      setPhotos(photoList.photos);
      setError("");
    } catch (err) {
      setError(describeError(err));
    }
  }, [id]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const weightSeries = useMemo(() => (data ? data.metrics.map((m) => ({ label: formatShort(m.date), weight: m.weightKg })) : []), [data]);
  const kcalSeries = useMemo(() => {
    if (!data) return [];
    const byDate = new Map(data.summary.days.map((d) => [d.date, d]));
    return Array.from({ length: 14 }, (_, i) => {
      const date = addDays(data.summary.to, -(13 - i));
      return { label: formatShort(date), kcal: Math.round(byDate.get(date)?.kcal ?? 0) };
    });
  }, [data]);

  async function issueLink() {
    try {
      const res = await api(`/admin/users/${id}/reset-link`, { method: "POST" });
      setLink(res.resetLink);
    } catch (err) {
      setError(describeError(err));
    }
  }

  const back = (
    <Link to="/admin/users" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-cyan">
      <ArrowLeft size={13} />Danh sách người dùng
    </Link>
  );

  if (error && !data) {
    return <div className="space-y-4">{back}<p role="alert" className="text-sm text-red-400">{error}</p></div>;
  }
  if (!data) return <div className="space-y-4">{back}<p className="text-sm text-muted">Đang tải...</p></div>;

  const { client, profile, target } = data;
  const latest = data.metrics.length ? data.metrics[data.metrics.length - 1].weightKg : null;
  const bmi = bmiOf(latest, profile.heightCm);
  const goal = target.target?.kcal ?? target.suggestion?.kcal ?? null;

  return (
    <div className="space-y-6">
      {back}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-ink">{client.fullName}</h1>
          <p className="text-sm text-muted mt-1">{client.email} · {formatPhone(client.phone)}{client.package ? ` · ${client.package}` : ""}</p>
        </div>
        <button onClick={issueLink} className="flex items-center gap-1.5 text-sm text-muted hover:text-cyan shrink-0">
          <KeyRound size={15} />Cấp liên kết đặt mật khẩu
        </button>
      </div>

      {link && <ResetLinkBox link={link} name={client.fullName} onClose={() => setLink(null)} />}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          ["Cân nặng hiện tại", latest !== null ? `${latest} kg` : "—"],
          ["Cân nặng mục tiêu", profile.targetWeightKg ? `${profile.targetWeightKg} kg` : "—"],
          ["BMI", bmi ?? "—"],
          ["Mục tiêu calo", goal ? `${goal} kcal` : "Chưa có"],
        ].map(([label, value]) => (
          <div key={label} className="bg-panel border border-line rounded-xl p-4">
            <p className="text-xs text-muted">{label}</p>
            <p className="text-lg font-display font-bold text-ink mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className={card}>
          <h2 className="font-display font-semibold text-ink mb-4">Cân nặng</h2>
          {weightSeries.length < 2 ? (
            <p className="text-sm text-muted py-10 text-center">Chưa đủ dữ liệu để vẽ biểu đồ.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weightSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1b292e" />
                <XAxis dataKey="label" tick={tick} />
                <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={tick} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="weight" name="Cân nặng (kg)" stroke="#08d9ff" strokeWidth={2} dot={{ r: 3, fill: "#08d9ff" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className={card}>
          <h2 className="font-display font-semibold text-ink mb-4">Calo 14 ngày gần nhất</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={kcalSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1b292e" />
              <XAxis dataKey="label" tick={tick} interval={1} />
              <YAxis tick={tick} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(8,217,255,.06)" }} />
              <Bar dataKey="kcal" name="Calo (kcal)" fill="#08d9ff" radius={[3, 3, 0, 0]} />
              {goal && <ReferenceLine y={goal} stroke="#8d9a9e" strokeDasharray="5 4" />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <TargetForm key={JSON.stringify(target.target)} clientId={id} info={target} onSaved={load} />
      {me.role === "admin" && <AssignmentForm key={`${client.coachId}-${client.package}-${client.clientStatus}`} client={client} onSaved={load} />}

      <div className={card}>
        <h2 className="font-display font-semibold text-ink mb-4">Check-in gần đây</h2>
        {data.checkins.length === 0 ? (
          <p className="text-sm text-muted">Học viên chưa nộp check-in nào.</p>
        ) : (
          <div className="space-y-3">
            {data.checkins.map((c) => <CheckinItem key={c.weekStart} clientId={id} checkin={c} photos={photos.filter((p) => p.takenOn >= c.weekStart && p.takenOn <= addDays(c.weekStart, 6))} onSaved={load} />)}
          </div>
        )}
      </div>

      <div className={card}>
        <h2 className="font-display font-semibold text-ink mb-4">Ảnh tiến độ</h2>
        <PhotoGallery photos={photos} base={`/clients/${id}/photos`} />
      </div>
    </div>
  );
}
