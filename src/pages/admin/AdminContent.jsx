import { useEffect, useState } from "react";
import { ImagePlus, Plus, Trash2, User } from "lucide-react";
import { api } from "../../lib/api";
import { photoUrl, useAbout } from "../../lib/useAbout";
import { describeError } from "../../lib/describeError";

const fieldClass =
  "w-full rounded-lg border border-line bg-page px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-cyan/50";

const Field = ({ label, children, hint }) => (
  <div>
    <label className="block text-xs text-muted mb-1.5">{label}</label>
    {children}
    {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
  </div>
);

const toForm = ({ photoVersion, ...rest }) => rest;

export default function AdminContent() {
  const [loaded, setAbout] = useAbout();
  const [form, setForm] = useState(() => toForm(loaded));
  const [photoVersion, setPhotoVersion] = useState(loaded.photoVersion);
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState({ busy: false, error: "", saved: false });
  const [photoState, setPhotoState] = useState({ busy: false, error: "" });

  // useAbout tải nội dung thật bất đồng bộ: nạp vào form chừng nào người dùng chưa gõ gì.
  useEffect(() => {
    if (!dirty) {
      setForm(toForm(loaded));
      setPhotoVersion(loaded.photoVersion);
    }
  }, [loaded, dirty]);

  const update = (patch) => {
    setDirty(true);
    setForm((f) => ({ ...f, ...patch }));
  };
  const updateList = (key, i, patch) => update({ [key]: form[key].map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const removeFrom = (key, i) => update({ [key]: form[key].filter((_, j) => j !== i) });

  async function handleSave(e) {
    e.preventDefault();
    setState({ busy: true, error: "", saved: false });
    try {
      const data = await api("/admin/about", { method: "PUT", body: form });
      setAbout(data.about);
      setDirty(false);
      setState({ busy: false, error: "", saved: true });
    } catch (err) {
      setState({ busy: false, error: describeError(err), saved: false });
    }
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoState({ busy: true, error: "" });
    try {
      const body = new FormData();
      body.append("photo", file);
      const data = await api("/admin/about/photo", { method: "POST", body });
      setPhotoVersion(data.about.photoVersion);
      setAbout((prev) => ({ ...prev, photoVersion: data.about.photoVersion }));
      setPhotoState({ busy: false, error: "" });
    } catch (err) {
      setPhotoState({ busy: false, error: describeError(err) });
    }
  }

  async function handleRemovePhoto() {
    setPhotoState({ busy: true, error: "" });
    try {
      await api("/admin/about/photo", { method: "DELETE" });
      setPhotoVersion(null);
      setAbout((prev) => ({ ...prev, photoVersion: null }));
      setPhotoState({ busy: false, error: "" });
    } catch (err) {
      setPhotoState({ busy: false, error: describeError(err) });
    }
  }

  const photo = photoUrl({ photoVersion });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-ink">Trang giới thiệu</h1>
        <p className="text-sm sm:text-base text-muted mt-1">
          Nội dung mục "Về tôi" trên trang chủ: ảnh, giới thiệu bản thân, con số và thành tựu.
        </p>
      </div>

      <div className="bg-panel border border-line rounded-xl p-4 sm:p-6">
        <h2 className="font-display font-semibold text-ink mb-4">Ảnh đại diện</h2>
        <div className="flex items-center gap-4">
          <div className="w-24 aspect-3/4 rounded-lg bg-page border border-line overflow-hidden flex items-center justify-center shrink-0">
            {photo ? <img src={photo} alt="Ảnh huấn luyện viên" className="w-full h-full object-cover" /> : <User size={32} className="text-line" strokeWidth={1} />}
          </div>
          <div className="space-y-2">
            <label className={`inline-flex items-center gap-1.5 text-sm font-semibold text-cyan hover:text-cyan/80 cursor-pointer ${photoState.busy ? "opacity-60 pointer-events-none" : ""}`}>
              <ImagePlus size={16} />
              {photo ? "Đổi ảnh" : "Tải ảnh lên"}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} className="sr-only" />
            </label>
            {photo && (
              <button onClick={handleRemovePhoto} disabled={photoState.busy} className="block text-xs text-muted hover:text-red-400">
                Gỡ ảnh
              </button>
            )}
            <p className="text-[11px] text-muted">JPG, PNG hoặc WebP, tối đa 5 MB. Ảnh được tự cắt tỉ lệ 3:4.</p>
            {photoState.error && <p role="alert" className="text-xs text-red-400">{photoState.error}</p>}
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-panel border border-line rounded-xl p-4 sm:p-6 space-y-4">
          <h2 className="font-display font-semibold text-ink">Giới thiệu</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Họ tên"><input required maxLength={80} value={form.name} onChange={(e) => update({ name: e.target.value })} className={fieldClass} /></Field>
            <Field label="Chức danh"><input maxLength={120} value={form.title} onChange={(e) => update({ title: e.target.value })} className={fieldClass} /></Field>
          </div>
          <Field label="Giới thiệu bản thân" hint={`${form.bio.length}/1500 ký tự`}>
            <textarea required rows={6} maxLength={1500} value={form.bio} onChange={(e) => update({ bio: e.target.value })} className={fieldClass} />
          </Field>
          <Field label="Câu nói yêu thích (để trống nếu không dùng)">
            <input maxLength={300} value={form.quote} onChange={(e) => update({ quote: e.target.value })} className={fieldClass} />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Huy hiệu trên ảnh — dòng 1"><input maxLength={60} value={form.badge.title} onChange={(e) => update({ badge: { ...form.badge, title: e.target.value } })} className={fieldClass} /></Field>
            <Field label="Huy hiệu trên ảnh — dòng 2"><input maxLength={60} value={form.badge.subtitle} onChange={(e) => update({ badge: { ...form.badge, subtitle: e.target.value } })} className={fieldClass} /></Field>
          </div>
        </div>

        <div className="bg-panel border border-line rounded-xl p-4 sm:p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-ink">Con số nổi bật (tối đa 4)</h2>
            {form.stats.length < 4 && (
              <button type="button" onClick={() => update({ stats: [...form.stats, { value: "", label: "" }] })} className="flex items-center gap-1 text-xs font-semibold text-cyan"><Plus size={14} />Thêm</button>
            )}
          </div>
          {form.stats.map((s, i) => (
            <div key={i} className="grid grid-cols-[7rem_1fr_auto] gap-2 items-center">
              <input required maxLength={20} placeholder="200+" value={s.value} onChange={(e) => updateList("stats", i, { value: e.target.value })} className={fieldClass} />
              <input required maxLength={60} placeholder="Học viên đã huấn luyện" value={s.label} onChange={(e) => updateList("stats", i, { label: e.target.value })} className={fieldClass} />
              <button type="button" onClick={() => removeFrom("stats", i)} className="text-muted hover:text-red-400 p-1" aria-label="Xóa"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>

        <div className="bg-panel border border-line rounded-xl p-4 sm:p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-ink">Thành tựu & chứng chỉ (tối đa 8)</h2>
            {form.achievements.length < 8 && (
              <button type="button" onClick={() => update({ achievements: [...form.achievements, { title: "", desc: "" }] })} className="flex items-center gap-1 text-xs font-semibold text-cyan"><Plus size={14} />Thêm</button>
            )}
          </div>
          {form.achievements.map((a, i) => (
            <div key={i} className="grid sm:grid-cols-[1fr_1.5fr_auto] gap-2 items-start">
              <input required maxLength={80} placeholder="Tên thành tựu" value={a.title} onChange={(e) => updateList("achievements", i, { title: e.target.value })} className={fieldClass} />
              <input maxLength={200} placeholder="Mô tả ngắn" value={a.desc} onChange={(e) => updateList("achievements", i, { desc: e.target.value })} className={fieldClass} />
              <button type="button" onClick={() => removeFrom("achievements", i)} className="text-muted hover:text-red-400 p-1 justify-self-end" aria-label="Xóa"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button disabled={state.busy} className="bg-cyan hover:bg-cyan/90 disabled:opacity-60 text-cyan-deep text-sm font-bold px-5 py-2.5 rounded-lg transition-colors">
            {state.busy ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
          {state.saved && <span className="text-sm text-cyan">Đã lưu — trang chủ đã cập nhật.</span>}
          {state.error && <span role="alert" className="text-sm text-red-400">{state.error}</span>}
        </div>
      </form>
    </div>
  );
}
