import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Flame, Scale, Target, TrendingDown, Plus, Dumbbell } from "lucide-react";
import { LineChart as RLineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import StatCard from "../components/StatCard";
import { useDailyLog } from "../context/DailyLogContext";
import { useAuth } from "../context/AuthContext";
import { useBody } from "../context/BodyContext";
import { useAppData } from "../context/AppDataContext";
import { formatShort, weekdayIndex } from "../lib/dates";

function MacroBar({ label, current, goal, opacity }) {
  const pct = goal ? Math.min(100, Math.round((current / goal) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted">{label}</span>
        <span className="text-muted">{Math.round(current)}g{goal ? ` / ${goal}g` : ""}</span>
      </div>
      <div className="h-2 rounded-full bg-line overflow-hidden">
        <div className="h-full rounded-full bg-cyan" style={{ width: `${pct}%`, opacity }} />
      </div>
    </div>
  );
}

const formatPlanItem = (it) => (it.sets && it.reps ? `${it.name} ${it.sets}x${it.reps}` : it.name);

export default function Dashboard() {
  const { user } = useAuth();
  const { today, date, setDate, totals, goal, remaining, macroGoals, entries } = useDailyLog();
  const { profile, metrics, latestWeight, startWeight } = useBody();
  const { workoutPlan } = useAppData();

  // Tổng quan luôn là của hôm nay, kể cả khi trước đó đang xem ngày khác ở trang Dinh dưỡng.
  useEffect(() => {
    if (date !== today) setDate(today);
  }, [date, today, setDate]);

  const chartData = useMemo(() => metrics.slice(-30).map((m) => ({ label: formatShort(m.date), weight: m.weightKg })), [metrics]);
  const change = latestWeight !== null && startWeight !== null ? Math.round((startWeight - latestWeight) * 10) / 10 : null;
  const todayWorkout = workoutPlan.find((d) => d.weekday === weekdayIndex() + 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-ink">Chào, {user.fullName} 👋</h1>
        <p className="text-sm sm:text-base text-muted mt-1">Đây là tổng quan hành trình tập luyện của bạn hôm nay.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Calo còn lại hôm nay" value={remaining ?? "—"} unit={remaining === null ? "" : "kcal"} icon={Flame} />
        <StatCard label="Cân nặng hiện tại" value={latestWeight ?? "—"} unit={latestWeight === null ? "" : "kg"} icon={Scale} />
        <StatCard
          label={change !== null && change < 0 ? "Đã tăng" : "Đã giảm"}
          value={change === null ? "—" : Math.abs(change)}
          unit={change === null ? "" : "kg"}
          icon={TrendingDown}
        />
        <StatCard label="Mục tiêu" value={profile?.targetWeightKg ?? "—"} unit={profile?.targetWeightKg ? "kg" : ""} icon={Target} />
      </div>

      {(goal === null || latestWeight === null) && (
        <div className="bg-panel rounded-xl border border-line p-4 text-sm text-muted">
          {latestWeight === null && <>Bạn chưa nhập cân nặng — vào <Link to="/app/progress" className="text-cyan font-semibold">Tiến độ</Link> để ghi nhận. </>}
          {goal === null && <>Chưa có mục tiêu calo — điền thông tin cơ thể và đặt mục tiêu trong <Link to="/app/profile" className="text-cyan font-semibold">Hồ sơ</Link>.</>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 bg-panel rounded-xl border border-line p-4 sm:p-6">
          <h2 className="font-display font-semibold text-ink mb-4">Biểu đồ cân nặng (30 lần ghi gần nhất)</h2>
          {chartData.length < 2 ? (
            <p className="text-sm text-muted py-12 text-center">Cần ít nhất 2 lần ghi cân nặng để vẽ biểu đồ.</p>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <RLineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1b292e" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#8d9a9e" }} />
                <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={{ fontSize: 12, fill: "#8d9a9e" }} />
                <Tooltip contentStyle={{ background: "#0e1518", border: "1px solid #1b292e", borderRadius: 8, color: "#f4f8f9" }} />
                <Line type="monotone" dataKey="weight" name="Cân nặng (kg)" stroke="#08d9ff" strokeWidth={3} dot={{ r: 4, fill: "#08d9ff" }} />
              </RLineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-panel rounded-xl border border-line p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-ink">Macro hôm nay</h2>
            <span className="text-xs text-muted">{Math.round(totals.kcal)}{goal !== null ? ` / ${goal}` : ""} kcal</span>
          </div>
          <MacroBar label="Protein" current={totals.protein} goal={macroGoals?.protein} opacity={1} />
          <MacroBar label="Carbs" current={totals.carbs} goal={macroGoals?.carbs} opacity={0.7} />
          <MacroBar label="Chất béo" current={totals.fat} goal={macroGoals?.fat} opacity={0.45} />
          <Link to="/app/meal-plan" className="flex items-center justify-center gap-1.5 text-xs font-semibold text-cyan hover:text-cyan/80 pt-1">
            <Plus size={14} />
            Ghi nhận món vừa ăn
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-panel rounded-xl border border-line p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-ink">Nhật ký hôm nay</h2>
            <Link to="/app/meal-plan" className="text-xs font-semibold text-cyan hover:text-cyan/80">Xem / thêm món →</Link>
          </div>
          {entries.length === 0 ? (
            <p className="text-sm text-muted">Bạn chưa ghi nhận món ăn nào hôm nay. Vào trang Dinh dưỡng để tính calo cho món bạn vừa ăn.</p>
          ) : (
            <div className="divide-y divide-line">
              {entries.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-sm text-ink truncate">{e.food} <span className="text-muted">· {e.grams}g</span></span>
                  <span className="text-xs sm:text-sm font-semibold text-cyan bg-cyan/10 px-2 sm:px-2.5 py-1 rounded-full shrink-0">
                    {Math.round(e.kcal)} kcal
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-panel rounded-xl border border-line p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-ink flex items-center gap-2">
              <Dumbbell size={16} className="text-cyan" />
              Lịch tập hôm nay
            </h2>
            <Link to="/app/workout" className="text-xs font-semibold text-cyan hover:text-cyan/80">Ghi buổi tập →</Link>
          </div>
          {!todayWorkout ? (
            <p className="text-sm text-muted">Đang tải lịch tập...</p>
          ) : (
            <>
              <p className="font-medium text-ink mb-2">{todayWorkout.name}</p>
              {todayWorkout.items.length ? (
                <ul className="space-y-1.5 text-sm text-muted">
                  {todayWorkout.items.map((it) => (
                    <li key={it.name} className="flex items-start gap-2">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-cyan shrink-0" />
                      {formatPlanItem(it)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted italic">Ngày nghỉ</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
