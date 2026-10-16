import { useMemo, useState } from "react";
import { Trash2, X } from "lucide-react";
import AuthImage from "./AuthImage";
import { formatDate } from "../lib/dates";

export const ANGLES = [
  { value: "front", label: "Trước" },
  { value: "side", label: "Bên" },
  { value: "back", label: "Sau" },
];
const ANGLE_LABEL = Object.fromEntries(ANGLES.map((a) => [a.value, a.label]));

/**
 * Lưới ảnh + so sánh "ảnh đầu tiên ↔ ảnh mới nhất" cùng góc chụp. `base` là đường dẫn API chứa ảnh
 * (`/photos` cho chính chủ, `/clients/:id/photos` cho huấn luyện viên). `onDelete` bỏ trống = chỉ xem.
 */
export default function PhotoGallery({ photos, base, onDelete, compareOnly = false }) {
  const [angle, setAngle] = useState("front");
  const [open, setOpen] = useState(null);

  const compare = useMemo(() => {
    const same = photos.filter((p) => p.angle === angle).sort((a, b) => a.takenOn.localeCompare(b.takenOn) || a.createdAt.localeCompare(b.createdAt));
    return same.length >= 2 ? { first: same[0], last: same[same.length - 1] } : null;
  }, [photos, angle]);

  const file = (p, size) => `${base}/${p.id}/file?size=${size}`;

  if (photos.length === 0) {
    return <p className="text-sm text-muted">Chưa có ảnh nào.</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-sm font-medium text-ink">So sánh đầu – hiện tại</p>
          <div className="flex gap-1">
            {ANGLES.map((a) => (
              <button
                key={a.value}
                onClick={() => setAngle(a.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${angle === a.value ? "bg-ink text-page" : "bg-page text-muted border border-line"}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
        {compare ? (
          <div className="grid grid-cols-2 gap-3 max-w-md">
            {[["Ban đầu", compare.first], ["Mới nhất", compare.last]].map(([label, p]) => (
              <button key={p.id} onClick={() => setOpen(p)} className="text-left space-y-1.5">
                <AuthImage path={file(p, "thumb")} alt={`${label} — ${formatDate(p.takenOn)}`} className="w-full aspect-3/4 rounded-lg object-cover border border-line" />
                <p className="text-xs text-muted">{label} · {formatDate(p.takenOn)}</p>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Cần ít nhất 2 ảnh cùng góc "{ANGLE_LABEL[angle]}" để so sánh.</p>
        )}
      </div>

      {!compareOnly && <div>
        <p className="text-sm font-medium text-ink mb-3">Tất cả ảnh</p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 sm:gap-3">
          {photos.map((p) => (
            <div key={p.id} className="relative group">
              <button onClick={() => setOpen(p)} className="block w-full text-left space-y-1">
                <AuthImage path={file(p, "thumb")} alt={`${ANGLE_LABEL[p.angle]} — ${formatDate(p.takenOn)}`} className="w-full aspect-3/4 rounded-lg object-cover border border-line" />
                <p className="text-[11px] text-muted">{formatDate(p.takenOn)} · {ANGLE_LABEL[p.angle]}</p>
              </button>
              {onDelete && (
                <button
                  onClick={() => onDelete(p)}
                  className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-page/80 text-muted hover:text-red-400"
                  aria-label="Xoá ảnh"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>}

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Xem ảnh" className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={() => setOpen(null)}>
          <button className="absolute top-4 right-4 text-ink p-2" aria-label="Đóng" onClick={() => setOpen(null)}>
            <X size={22} />
          </button>
          <div onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full">
            <AuthImage path={file(open, "full")} alt={`${ANGLE_LABEL[open.angle]} — ${formatDate(open.takenOn)}`} className="max-h-[85vh] max-w-full rounded-lg object-contain min-w-[200px] min-h-[200px]" />
            <p className="text-center text-sm text-muted mt-2">{formatDate(open.takenOn)} · {ANGLE_LABEL[open.angle]}</p>
          </div>
        </div>
      )}
    </div>
  );
}
