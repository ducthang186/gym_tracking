import { describe, expect, it } from "vitest";
import { addDays, ageOn, assertNotFuture, daysBetween } from "../src/lib/dates.js";
import { bmi, bmr, suggestTargets } from "../src/modules/body/calc.js";
import { buildDayPlan } from "../src/modules/nutrition/mealplan.js";
import type { Food } from "../src/modules/nutrition/nutrition.service.js";

describe("công thức cơ thể", () => {
  it("BMI", () => {
    expect(bmi(76.4, 175)).toBe(24.9);
    expect(bmi(70, 170)).toBe(24.2);
  });

  it("BMR Mifflin–St Jeor", () => {
    expect(bmr("male", 80, 180, 30)).toBeCloseTo(1780, 0); // 800 + 1125 - 150 + 5
    expect(bmr("female", 60, 165, 25)).toBeCloseTo(1345.25, 1); // 600 + 1031.25 - 125 - 161
  });

  it("gợi ý theo mục tiêu giảm / tăng / giữ cân", () => {
    const base = { gender: "male" as const, age: 30, heightCm: 180, weightKg: 80, activityLevel: "moderate" as const };
    const lose = suggestTargets({ ...base, targetWeightKg: 72 });
    const keep = suggestTargets({ ...base, targetWeightKg: 80.5 });
    const gain = suggestTargets({ ...base, targetWeightKg: 85 });
    if (!lose.ok || !keep.ok || !gain.ok) throw new Error("phải tính được");
    expect(lose.goal).toBe("lose");
    expect(keep.goal).toBe("maintain");
    expect(gain.goal).toBe("gain");
    expect(keep.target.kcal - lose.target.kcal).toBeGreaterThan(450);
    expect(gain.target.kcal - keep.target.kcal).toBeGreaterThan(250);
    expect(lose.target.proteinG).toBe(160); // 2 g/kg khi giảm cân
    // macro cộng lại xấp xỉ calo mục tiêu
    const sum = lose.target.proteinG * 4 + lose.target.carbsG * 4 + lose.target.fatG * 9;
    expect(Math.abs(sum - lose.target.kcal)).toBeLessThan(40);
  });

  it("báo thiếu trường nào khi chưa đủ dữ liệu", () => {
    const r = suggestTargets({ gender: null, age: null, heightCm: 170, weightKg: null, targetWeightKg: null, activityLevel: null });
    expect(r).toEqual({ ok: false, missing: ["gender", "birthDate", "weight", "activityLevel"] });
  });

  it("không bao giờ gợi ý dưới 1200 kcal", () => {
    const r = suggestTargets({ gender: "female", age: 60, heightCm: 150, weightKg: 45, targetWeightKg: 40, activityLevel: "sedentary" });
    if (!r.ok) throw new Error("phải tính được");
    expect(r.target.kcal).toBeGreaterThanOrEqual(1200);
  });
});

describe("ngày tháng", () => {
  it("cộng trừ ngày, đếm ngày, tính tuổi", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-10-01", "2026-10-08")).toBe(7);
    expect(ageOn("1999-10-05", "2026-10-04")).toBe(26);
    expect(ageOn("1999-10-05", "2026-10-05")).toBe(27);
  });

  it("từ chối ngày tương lai xa nhưng cho phép lệch múi giờ 1 ngày", () => {
    const now = new Date("2026-10-04T10:00:00Z");
    expect(() => assertNotFuture("2026-10-05", now)).not.toThrow();
    expect(() => assertNotFuture("2026-10-06", now)).toThrow();
  });
});

const food = (name: string, kcal: number, p = 0, c = 0, f = 0): Food => ({
  id: name,
  name,
  kcalPer100g: kcal,
  proteinPer100g: p,
  carbsPer100g: c,
  fatPer100g: f,
});
const FOODS = [
  food("Cơm trắng", 130, 2.7, 28, 0.3), food("Cơm gạo lứt", 123, 2.7, 26, 1), food("Ức gà (luộc, không da)", 165, 31, 0, 3.6),
  food("Thịt bò nạc", 250, 26, 0, 15), food("Thịt heo nạc", 242, 27, 0, 14), food("Cá hồi", 208, 20, 0, 13),
  food("Trứng gà (luộc)", 155, 13, 1.1, 11), food("Sữa chua Hy Lạp (không đường)", 59, 10, 3.6, 0.4), food("Yến mạch (khô)", 389, 17, 66, 7),
  food("Khoai lang (luộc)", 86, 1.6, 20, 0.1), food("Khoai tây (luộc)", 87, 1.9, 20, 0.1), food("Chuối", 89, 1.1, 23, 0.3), food("Táo", 52, 0.3, 14, 0.2),
  food("Rau xanh (bông cải, cải bó xôi...)", 25, 2.5, 4, 0.3), food("Bánh mì trắng", 265, 9, 49, 3.2), food("Whey protein (bột)", 380, 80, 8, 5),
  food("Hạt óc chó", 654, 15, 14, 65), food("Dầu ô liu", 884, 0, 0, 100),
];

describe("sinh kế hoạch ăn", () => {
  it("tổng calo gần mục tiêu, có đủ 5 bữa", () => {
    for (const target of [1600, 2000, 2600]) {
      const plan = buildDayPlan(FOODS, target, 0, 0);
      expect(plan.meals).toHaveLength(5);
      expect(Math.abs(plan.kcal - target) / target).toBeLessThan(0.1);
    }
  });

  it("xác định theo (day, variant) và đổi món khi đổi variant", () => {
    expect(buildDayPlan(FOODS, 2000, 2, 1)).toEqual(buildDayPlan(FOODS, 2000, 2, 1));
    const names = (v: number) => buildDayPlan(FOODS, 2000, 0, v).meals.flatMap((m) => m.items.map((i) => i.food)).join("|");
    expect(names(0)).not.toBe(names(1));
  });

  it("món bị xoá khỏi danh mục thì chuyển sang lựa chọn khác, không ném lỗi", () => {
    const without = FOODS.filter((f) => !f.name.startsWith("Ức gà"));
    const plan = buildDayPlan(without, 2000, 0, 0);
    expect(plan.meals.flatMap((m) => m.items.map((i) => i.food))).not.toContain("Ức gà (luộc, không da)");
    expect(buildDayPlan([], 2000, 0, 0).meals).toEqual([]);
  });
});
