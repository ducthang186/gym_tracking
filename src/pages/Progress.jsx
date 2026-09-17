import { useState } from "react";
import { Plus, ImagePlus } from "lucide-react";
import { LineChart as RLineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { weightHistory, progressPhotos } from "../data/mock";

export default function Progress() {
  const [newWeight, setNewWeight] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tiến độ</h1>
        <p className="text-slate-500 mt-1">Theo dõi cân nặng và ảnh trước/sau tập.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Cân nặng theo tuần</h2>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Nhập cân nặng (kg)"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
              <Plus size={16} />
              Ghi nhận
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <RLineChart data={weightHistory}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis dataKey="week" tick={{ fontSize: 12, fill: "#64748b" }} />
            <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={{ fontSize: 12, fill: "#64748b" }} />
            <Tooltip />
            <Line type="monotone" dataKey="weight" stroke="#16a34a" strokeWidth={3} dot={{ r: 4 }} />
          </RLineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Ảnh trước / sau tập</h2>
          <button className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800">
            <ImagePlus size={16} />
            Thêm ảnh
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {progressPhotos.map((p) => (
            <div key={p.date} className="space-y-2">
              <div className="aspect-3/4 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs">
                Ảnh {p.label}
              </div>
              <p className="text-xs text-slate-500 text-center">{p.date}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
