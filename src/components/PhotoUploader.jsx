import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { ANGLES } from "./PhotoGallery";
import { api } from "../lib/api";
import { dateKey } from "../lib/dates";
import { describeError } from "../lib/describeError";

const fieldClass =
  "rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-cyan/50";

/**
 * Chọn ngày + góc chụp rồi tải một ảnh lên `/photos`. `min`/`max` giới hạn ngày chọn được (check-in dùng để ép ảnh
 * nằm trong tuần đang xem). `onUploaded(photo)` nhận ảnh server vừa lưu.
 */
export default function PhotoUploader({ defaultDate = dateKey(), min, max = dateKey(), onUploaded }) {
  const [form, setForm] = useState({ takenOn: defaultDate, angle: "front" });
  const [state, setState] = useState({ busy: false, error: "" });

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setState({ busy: true, error: "" });
    try {
      // Server đọc các trường TRƯỚC tệp, nên phải append takenOn/angle trước.
      const body = new FormData();
      body.append("takenOn", form.takenOn);
      body.append("angle", form.angle);
      body.append("photo", file);
      const data = await api("/photos", { method: "POST", body });
      onUploaded(data.photo);
      setState({ busy: false, error: "" });
    } catch (err) {
      setState({ busy: false, error: describeError(err) });
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-[auto_auto_1fr] gap-2 items-center">
        <input type="date" value={form.takenOn} min={min} max={max} onChange={(e) => e.target.value && setForm({ ...form, takenOn: e.target.value })} className={fieldClass} aria-label="Ngày chụp" />
        <select value={form.angle} onChange={(e) => setForm({ ...form, angle: e.target.value })} className={fieldClass} aria-label="Góc chụp">
          {ANGLES.map((a) => <option key={a.value} value={a.value}>Góc {a.label.toLowerCase()}</option>)}
        </select>
        <label className={`col-span-2 sm:col-span-1 inline-flex items-center justify-center sm:justify-start gap-1.5 text-sm font-semibold text-cyan hover:text-cyan/80 cursor-pointer py-2 ${state.busy ? "opacity-60 pointer-events-none" : ""}`}>
          <ImagePlus size={16} />
          {state.busy ? "Đang tải lên..." : "Chọn ảnh để thêm"}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} className="sr-only" />
        </label>
      </div>
      {state.error && <p role="alert" className="text-sm text-red-400 mt-2">{state.error}</p>}
    </div>
  );
}
