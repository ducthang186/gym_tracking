import { Flame, Scale, Target, TrendingDown } from "lucide-react";
import { LineChart as RLineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import StatCard from "../components/StatCard";
import { profile, weightHistory, calorieToday, mealPlanToday } from "../data/mock";

function MacroBar({ label, current, goal, color }) {
  const pct = Math.min(100, Math.round((current / goal) * 100));
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-500">{current}g / {goal}g</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const remaining = calorieToday.goal - calorieToday.consumed + calorieToday.burned;
  const loss = (profile.startWeight - profile.currentWeight).toFixed(1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Chào, {profile.name} 👋</h1>
        <p className="text-slate-500 mt-1">Đây là tổng quan hành trình tập luyện của bạn hôm nay.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Calo còn lại hôm nay" value={remaining} unit="kcal" icon={Flame} accent="orange" />
        <StatCard label="Cân nặng hiện tại" value={profile.currentWeight} unit="kg" icon={Scale} accent="blue" />
        <StatCard label="Đã giảm" value={loss} unit="kg" icon={TrendingDown} accent="brand" />
        <StatCard label="Mục tiêu" value={profile.targetWeight} unit="kg" icon={Target} accent="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Biểu đồ cân nặng theo tuần</h2>
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

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Macro hôm nay</h2>
          <MacroBar label="Protein" current={calorieToday.protein.current} goal={calorieToday.protein.goal} color="bg-brand-500" />
          <MacroBar label="Carbs" current={calorieToday.carbs.current} goal={calorieToday.carbs.goal} color="bg-blue-500" />
          <MacroBar label="Chất béo" current={calorieToday.fat.current} goal={calorieToday.fat.goal} color="bg-orange-500" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Lịch ăn hôm nay</h2>
        <div className="divide-y divide-slate-100">
          {mealPlanToday.map((meal) => {
            const total = meal.items.reduce((sum, i) => sum + i.calories, 0);
            const foodSummary = meal.items.map((i) => `${i.food} (${i.grams}g)`).join(", ");
            return (
              <div key={meal.time} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono text-slate-400 w-14">{meal.time}</span>
                  <div>
                    <p className="font-medium text-slate-800">{meal.name}</p>
                    <p className="text-sm text-slate-500">{foodSummary}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full">
                  {total} kcal
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
