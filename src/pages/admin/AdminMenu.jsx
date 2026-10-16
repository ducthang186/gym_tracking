import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAppData } from "../../context/AppDataContext";
import { describeError } from "../../lib/describeError";

const emptyForm = { name: "", kcal: "", protein: "", carbs: "", fat: "" };

export default function AdminMenu() {
  const { foods, addFood, removeFood } = useAppData();
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.kcal || busy) return;
    setBusy(true);
    setError("");
    try {
      await addFood({
        name: form.name,
        kcal: Number(form.kcal) || 0,
        protein: Number(form.protein) || 0,
        carbs: Number(form.carbs) || 0,
        fat: Number(form.fat) || 0,
      });
      setForm(emptyForm);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id) {
    setError("");
    try {
      await removeFood(id);
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-ink">Thực đơn</h1>
        <p className="text-sm sm:text-base text-muted mt-1">
          Danh sách món ăn hiển thị trong bộ tính calo của học viên — thêm món mới sẽ xuất hiện ngay lập tức.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-panel border border-line rounded-xl p-4 sm:p-6">
        <h2 className="font-display font-semibold text-ink mb-4 flex items-center gap-2">
          <Plus size={16} className="text-cyan" />
          Thêm món ăn mới (giá trị trên 100g)
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input required placeholder="Tên món ăn" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="lg:col-span-2 rounded-lg border border-line bg-page px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-cyan/50" />
          <input required type="number" placeholder="Kcal" value={form.kcal} onChange={(e) => setForm({ ...form, kcal: e.target.value })}
            className="rounded-lg border border-line bg-page px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-cyan/50" />
          <input type="number" placeholder="Protein (g)" value={form.protein} onChange={(e) => setForm({ ...form, protein: e.target.value })}
            className="rounded-lg border border-line bg-page px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-cyan/50" />
          <input type="number" placeholder="Carbs (g)" value={form.carbs} onChange={(e) => setForm({ ...form, carbs: e.target.value })}
            className="rounded-lg border border-line bg-page px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-cyan/50" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-3">
          <input type="number" placeholder="Fat (g)" value={form.fat} onChange={(e) => setForm({ ...form, fat: e.target.value })}
            className="rounded-lg border border-line bg-page px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-cyan/50" />
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={busy} className="mt-4 disabled:opacity-60 flex items-center gap-1.5 bg-cyan hover:bg-cyan/90 text-cyan-deep text-sm font-bold px-4 py-2.5 rounded-lg transition-colors">
          <Plus size={16} />
          Thêm vào thực đơn
        </button>
      </form>

      {/* Điện thoại: danh sách gọn thay cho bảng 6 cột */}
      <div className="md:hidden bg-panel border border-line rounded-xl divide-y divide-line">
        {foods.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink break-words">{f.name}</p>
              <p className="text-xs text-muted">{f.kcal} kcal/100g · P {f.protein}g · C {f.carbs}g · F {f.fat}g</p>
            </div>
            <button onClick={() => handleRemove(f.id)} className="text-muted hover:text-red-400 transition-colors p-2 shrink-0" aria-label={`Xóa ${f.name}`}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="hidden md:block bg-panel border border-line rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted text-xs uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">Món ăn</th>
                <th className="px-4 py-3 font-medium">Kcal/100g</th>
                <th className="px-4 py-3 font-medium">Protein</th>
                <th className="px-4 py-3 font-medium">Carbs</th>
                <th className="px-4 py-3 font-medium">Fat</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {foods.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-3 text-ink font-medium">{f.name}</td>
                  <td className="px-4 py-3 text-muted">{f.kcal}</td>
                  <td className="px-4 py-3 text-muted">{f.protein}g</td>
                  <td className="px-4 py-3 text-muted">{f.carbs}g</td>
                  <td className="px-4 py-3 text-muted">{f.fat}g</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleRemove(f.id)} className="text-muted hover:text-red-400 transition-colors p-1" aria-label="Xóa">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
