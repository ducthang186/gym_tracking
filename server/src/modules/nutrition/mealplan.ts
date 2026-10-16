import type { MealSlot } from "../../db/types.js";
import type { Food } from "./nutrition.service.js";

// Sinh kế hoạch ăn một ngày từ danh mục món có sẵn. Hàm thuần, kết quả xác định theo (day, variant)
// nên kiểm tra được bằng test đơn vị và "Tạo lại" chỉ cần đổi variant.

interface Part {
  /** Các lựa chọn theo tên (khớp phần đầu tên món, không phân biệt hoa thường); xoay vòng theo ngày. */
  options: string[];
  /** Tỷ lệ calo của bữa dành cho phần này (phần còn lại sau món cố định). */
  share: number;
  /** Món ăn kèm cố định theo gram (rau xanh). */
  fixedGrams?: number;
}

interface MealTemplate {
  slot: MealSlot;
  time: string;
  name: string;
  share: number; // tỷ lệ calo cả ngày
  parts: Part[];
}

const TEMPLATES: MealTemplate[] = [
  {
    slot: "breakfast", time: "07:00", name: "Bữa sáng", share: 0.27,
    parts: [
      { options: ["Yến mạch", "Bánh mì trắng"], share: 0.5 },
      { options: ["Trứng gà", "Sữa chua Hy Lạp"], share: 0.3 },
      { options: ["Chuối", "Táo"], share: 0.2 },
    ],
  },
  {
    slot: "snack", time: "10:30", name: "Ăn nhẹ", share: 0.1,
    parts: [
      { options: ["Sữa chua Hy Lạp"], share: 0.6 },
      { options: ["Hạt óc chó"], share: 0.4 },
    ],
  },
  {
    slot: "lunch", time: "13:00", name: "Bữa trưa", share: 0.3,
    parts: [
      { options: ["Ức gà", "Thịt bò nạc", "Thịt heo nạc"], share: 0.35 },
      { options: ["Cơm gạo lứt", "Cơm trắng", "Khoai lang"], share: 0.5 },
      { options: ["Rau xanh"], share: 0, fixedGrams: 120 },
      { options: ["Dầu ô liu"], share: 0.15 },
    ],
  },
  {
    slot: "snack", time: "16:00", name: "Ăn nhẹ", share: 0.1,
    parts: [
      { options: ["Whey protein"], share: 0.55 },
      { options: ["Táo", "Chuối"], share: 0.45 },
    ],
  },
  {
    slot: "dinner", time: "19:30", name: "Bữa tối", share: 0.23,
    parts: [
      { options: ["Cá hồi", "Ức gà", "Thịt heo nạc"], share: 0.5 },
      { options: ["Khoai lang", "Cơm trắng", "Khoai tây"], share: 0.5 },
      { options: ["Rau xanh"], share: 0, fixedGrams: 150 },
    ],
  },
];

export interface PlanItem {
  foodId: string;
  food: string;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}
export interface PlanMeal {
  slot: MealSlot;
  time: string;
  name: string;
  items: PlanItem[];
  kcal: number;
}
export interface DayPlan {
  meals: PlanMeal[];
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const norm = (s: string) => s.toLocaleLowerCase("vi").normalize("NFC");

function findFood(foods: Food[], options: string[], pick: number): Food | undefined {
  // Thử lần lượt từ lựa chọn được chọn; món nào admin đã xoá thì chuyển sang lựa chọn kế.
  for (let k = 0; k < options.length; k++) {
    const want = norm(options[(pick + k) % options.length]!);
    const hit = foods.find((f) => norm(f.name).startsWith(want));
    if (hit) return hit;
  }
  return undefined;
}

const toItem = (f: Food, grams: number): PlanItem => {
  const r = grams / 100;
  return {
    foodId: f.id,
    food: f.name,
    grams,
    kcal: round1(f.kcalPer100g * r),
    proteinG: round1(f.proteinPer100g * r),
    carbsG: round1(f.carbsPer100g * r),
    fatG: round1(f.fatPer100g * r),
  };
};

export function buildDayPlan(foods: Food[], dayKcal: number, day: number, variant: number): DayPlan {
  const pick = day + variant;
  const meals: PlanMeal[] = [];

  for (const tpl of TEMPLATES) {
    const budget = dayKcal * tpl.share;
    const items: PlanItem[] = [];

    // Món cố định (rau) trước, phần calo còn lại chia cho các phần khác.
    let remaining = budget;
    for (const part of tpl.parts.filter((p) => p.fixedGrams)) {
      const food = findFood(foods, part.options, 0);
      if (!food) continue;
      const item = toItem(food, part.fixedGrams!);
      items.push(item);
      remaining -= item.kcal;
    }
    remaining = Math.max(remaining, budget * 0.5);

    const flexible = tpl.parts.filter((p) => !p.fixedGrams);
    const totalShare = flexible.reduce((a, p) => a + p.share, 0);
    for (const part of flexible) {
      const food = findFood(foods, part.options, pick);
      if (!food || food.kcalPer100g <= 0) continue;
      const kcal = (remaining * part.share) / totalShare;
      const grams = Math.min(600, Math.max(5, Math.round(((kcal / food.kcalPer100g) * 100) / 5) * 5));
      items.push(toItem(food, grams));
    }

    if (items.length) {
      meals.push({ slot: tpl.slot, time: tpl.time, name: tpl.name, items, kcal: round1(items.reduce((a, i) => a + i.kcal, 0)) });
    }
  }

  const all = meals.flatMap((m) => m.items);
  return {
    meals,
    kcal: round1(all.reduce((a, i) => a + i.kcal, 0)),
    proteinG: round1(all.reduce((a, i) => a + i.proteinG, 0)),
    carbsG: round1(all.reduce((a, i) => a + i.carbsG, 0)),
    fatG: round1(all.reduce((a, i) => a + i.fatG, 0)),
  };
}
