import { useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
import { mealPlanToday } from "../data/mock";

const days = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

function mealTotal(meal) {
  return meal.items.reduce((sum, item) => sum + item.calories, 0);
}

function MealCard({ meal }) {
  const [open, setOpen] = useState(true);
  const total = mealTotal(meal);
  const totalGrams = meal.items.reduce((sum, item) => sum + item.grams, 0);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-4">
          <span className="text-sm font-mono text-slate-400 w-14 text-left">{meal.time}</span>
          <div className="text-left">
            <p className="font-medium text-slate-800">{meal.name}</p>
            <p className="text-xs text-slate-500">{meal.items.length} món · {totalGrams} g</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full">
            {total} kcal
          </span>
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="divide-y divide-slate-100">
          {meal.items.map((item) => (
            <div key={item.food} className="flex items-center justify-between px-4 py-3 pl-[4.7rem]">
              <span className="text-sm text-slate-700">{item.food}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {item.grams} g
                </span>
                <span className="text-xs text-slate-400 w-16 text-right">{item.calories} kcal</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MealPlan() {
  const [activeDay, setActiveDay] = useState(0);
  const total = mealPlanToday.reduce((sum, m) => sum + mealTotal(m), 0);
  const totalGrams = mealPlanToday.reduce(
    (sum, m) => sum + m.items.reduce((s, i) => s + i.grams, 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lịch ăn</h1>
          <p className="text-slate-500 mt-1">
            Thực đơn tuần này · tổng {total} kcal · {totalGrams} g hôm nay
          </p>
        </div>
        <button className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors">
          <Sparkles size={16} />
          Tạo meal plan tự động
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map((d, i) => (
          <button
            key={d}
            onClick={() => setActiveDay(i)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeDay === i ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        {mealPlanToday.map((meal) => (
          <MealCard key={meal.time} meal={meal} />
        ))}
      </div>
    </div>
  );
}
