import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Dumbbell, MessageSquare, Trash2, X } from "lucide-react";
import AuthImage from "../components/AuthImage";
import PhotoGallery, { ANGLES } from "../components/PhotoGallery";
import PhotoUploader from "../components/PhotoUploader";
import { api } from "../lib/api";
import { addDays, dateKey, formatDate } from "../lib/dates";
import { describeError } from "../lib/describeError";

/** Thứ Hai của tuần chứa `key`. */
export function mondayOf(key) {
  const [y, m, d] = key.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0 = Chủ nhật
  return addDays(key, -((dow + 6) % 7));
}

const ANGLE_LABEL = Object.fromEntries(ANGLES.map((a) => [a.value, a.label]));
const sortPhotos = (list) => [...list].sort((a, b) => b.takenOn.localeCompare(a.takenOn) || b.createdAt.localeCompare(a.createdAt));

export default function CheckIn() {
  const today = dateKey();
  const thisWeek = mondayOf(today);
  const [week, setWeek] = useState(thisWeek);
  const [checkins, setCheckins] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [form, setForm] = useState({ trained: null, note: "" });
  const [state, setState] = useState({ busy: false, error: "", saved: false });
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([api(`/checkins?from=${addDays(thisWeek, -7 * 25)}&to=${thisWeek}`), api("/photos")]);
      setCheckins(c.checkins);
      setPhotos(sortPhotos(p.photos));
      setLoadError("");
    } catch (err) {
      setLoadError(describeError(err));
    }
  }, [thisWeek]);

  useEffect(() => {
    load();
  }, [load]);

  // Chọn tuần khác: nạp câu trả lời đã nộp (nếu có).
  useEffect(() => {
    const existing = checkins.find((c) => c.weekStart === week);
    setForm(existing ? { trained: existing.trained, note: existing.note ?? "" } : { trained: null, note: "" });
    setState((s) => ({ ...s, saved: false, error: "" }));
  }, [week, checkins]);

  const current = checkins.find((c) => c.weekStart === week);
  const weekEnd = addDays(week, 6);
  const weekPhotos = useMemo(() => photos.filter((p) => p.takenOn >= week && p.takenOn <= weekEnd), [photos, week, weekEnd]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.trained === null) return setState((s) => ({ ...s, error: "Hãy chọn Có hoặc Không." }));
    setState((s) => ({ ...s, busy: true, error: "", saved: false }));
    try {
      const { checkin } = await api(`/checkins/${week}`, { method: "PUT", body: { trained: form.trained, note: form.note.trim() || null } });
      setCheckins((prev) => [checkin, ...prev.filter((c) => c.weekStart !== week)].sort((a, b) => b.weekStart.localeCompare(a.weekStart)));
      setState((s) => ({ ...s, busy: false, saved: true }));
    } catch (err) {
      setState((s) => ({ ...s, busy: false, error: describeError(err) }));
    }
  }

  async function handleDeletePhoto(photo) {
    if (!window.confirm("Xoá ảnh này? Không khôi phục được.")) return;
    try {
      await api(`/photos/${photo.id}`, { method: "DELETE" });
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } catch (err) {
      setState((s) => ({ ...s, error: describeError(err) }));
    }
  }

  const weeks = Array.from({ length: 6 }, (_, i) => addDays(thisWeek, -7 * i));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-ink">Check-in hàng tuần</h1>
        <p className="text-sm sm:text-base text-muted mt-1">Cho huấn luyện viên biết bạn có tập không và gửi ảnh để theo dõi thay đổi cơ thể.</p>
      </div>

      {loadError && <p role="alert" className="text-sm text-red-400">{loadError} <button onClick={load} className="underline">Thử lại</button></p>}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {weeks.map((w) => {
          const c = checkins.find((x) => x.weekStart === w);
          return (
            <button
              key={w}
              onClick={() => setWeek(w)}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                week === w ? "bg-ink text-page" : "bg-panel text-muted border border-line hover:border-cyan/40"
              }`}
            >
              {c && (c.trained ? <Check size={13} className={week === w ? "" : "text-cyan"} /> : <X size={13} className={week === w ? "" : "text-red-400"} />)}
              {w === thisWeek ? "Tuần này" : `Tuần ${formatDate(w).slice(0, 5)}`}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="bg-panel rounded-xl border border-line p-4 sm:p-6 space-y-5">
        <p className="text-sm text-muted">Từ thứ Hai {formatDate(week)} đến Chủ nhật {formatDate(weekEnd)} · {current ? "đã nộp, bạn có thể sửa" : "chưa nộp"}</p>

        <div>
          <p className="text-sm font-medium text-ink mb-3">{week === thisWeek ? "Tuần này" : "Tuần đó"} bạn có tập không?</p>
          <div role="radiogroup" aria-label="Có tập hay không" className="grid grid-cols-2 gap-3 max-w-md">
            {[[true, "Có tập", Dumbbell], [false, "Không tập", X]].map(([value, label, Icon]) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={form.trained === value}
                onClick={() => setForm((f) => ({ ...f, trained: value }))}
                className={`flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold border transition-colors ${
                  form.trained === value
                    ? value ? "bg-cyan text-cyan-deep border-cyan" : "bg-red-400/15 text-red-300 border-red-400/60"
                    : "bg-page text-muted border-line hover:border-cyan/40"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="note" className="block text-sm font-medium text-ink mb-2">Ghi chú thêm (không bắt buộc)</label>
          <textarea
            id="note"
            rows={3}
            maxLength={1000}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="VD: bị đau vai nên nghỉ 2 buổi..."
            className="w-full rounded-lg border border-line bg-page px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-cyan/50"
          />
        </div>

        <div className="flex items-center gap-3">
          <button disabled={state.busy} className="bg-cyan hover:bg-cyan/90 disabled:opacity-60 text-cyan-deep text-sm font-bold px-5 py-2.5 rounded-lg transition-colors">
            {state.busy ? "Đang gửi..." : current ? "Cập nhật check-in" : "Gửi check-in"}
          </button>
          {state.saved && <span className="text-sm text-cyan">Đã lưu.</span>}
          {state.error && <span role="alert" className="text-sm text-red-400">{state.error}</span>}
        </div>
      </form>

      <div className="bg-panel rounded-xl border border-line p-4 sm:p-6 space-y-4">
        <div>
          <h2 className="font-display font-semibold text-ink">Ảnh của tuần này</h2>
          <p className="text-xs text-muted mt-1">Chụp cùng góc, cùng ánh sáng mỗi tuần để so sánh dễ thấy sự thay đổi. Ảnh chỉ bạn và huấn luyện viên xem được.</p>
        </div>
        <PhotoUploader
          key={week}
          defaultDate={week === thisWeek ? today : week}
          min={week}
          max={week === thisWeek ? today : weekEnd}
          onUploaded={(photo) => setPhotos((prev) => sortPhotos([photo, ...prev]))}
        />
        {weekPhotos.length === 0 ? (
          <p className="text-sm text-muted">Chưa có ảnh nào trong tuần này.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 sm:gap-3">
            {weekPhotos.map((p) => (
              <div key={p.id} className="relative">
                <AuthImage path={`/photos/${p.id}/file?size=thumb`} alt={`${ANGLE_LABEL[p.angle]} — ${formatDate(p.takenOn)}`} className="w-full aspect-3/4 rounded-lg object-cover border border-line" />
                <p className="text-[11px] text-muted mt-1">{formatDate(p.takenOn).slice(0, 5)} · {ANGLE_LABEL[p.angle]}</p>
                <button onClick={() => handleDeletePhoto(p)} className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-page/80 text-muted hover:text-red-400" aria-label="Xoá ảnh">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-panel rounded-xl border border-line p-4 sm:p-6">
        <h2 className="font-display font-semibold text-ink mb-4">Thay đổi qua ảnh</h2>
        <PhotoGallery photos={photos} base="/photos" compareOnly />
      </div>

      {current?.coachNote && (
        <div className="bg-panel rounded-xl border border-cyan/30 p-4 sm:p-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-cyan mb-2"><MessageSquare size={15} />Phản hồi của huấn luyện viên</p>
          <p className="text-sm text-ink whitespace-pre-line">{current.coachNote}</p>
        </div>
      )}
    </div>
  );
}
