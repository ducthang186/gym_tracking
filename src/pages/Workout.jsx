import { Dumbbell } from "lucide-react";
import { workoutPlan } from "../data/mock";

const dayLabels = {
  Monday: "Thứ 2",
  Tuesday: "Thứ 3",
  Wednesday: "Thứ 4",
  Thursday: "Thứ 5",
  Friday: "Thứ 6",
  Saturday: "Thứ 7",
  Sunday: "Chủ nhật",
};

export default function Workout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Lịch tập</h1>
        <p className="text-slate-500 mt-1">Kế hoạch tập luyện trong tuần.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Object.entries(workoutPlan).map(([day, info]) => (
          <div key={day} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{dayLabels[day]}</span>
              <Dumbbell size={16} className="text-brand-500" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-3">{info.name}</h3>
            {info.exercises.length ? (
              <ul className="space-y-1.5 text-sm text-slate-600">
                {info.exercises.map((ex) => (
                  <li key={ex} className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
                    {ex}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400 italic">Ngày nghỉ</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
