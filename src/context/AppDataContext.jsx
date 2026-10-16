import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";

const AppDataContext = createContext(null);

// Món ăn lưu trên server (chung cho mọi người dùng); server dùng kcalPer100g..., giao diện dùng kcal/protein/carbs/fat.
const fromServer = (f) => ({ id: f.id, name: f.name, kcal: f.kcalPer100g, protein: f.proteinPer100g, carbs: f.carbsPer100g, fat: f.fatPer100g });

export function AppDataProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [foods, setFoods] = useState([]);
  const [foodsStatus, setFoodsStatus] = useState("idle"); // idle | loading | ready | error
  const [workoutPlan, setWorkoutPlan] = useState([]); // [{ weekday: 1..7, name, items: [{ name, sets, reps }] }]

  const loadFoods = useCallback(async () => {
    setFoodsStatus("loading");
    try {
      const data = await api("/foods");
      setFoods(data.foods.map(fromServer));
      setFoodsStatus("ready");
    } catch {
      setFoodsStatus("error");
    }
  }, []);

  const loadPlan = useCallback(async () => {
    try {
      setWorkoutPlan((await api("/workout-plan")).days);
    } catch {
      // giữ giáo án hiện có; trang tự thử lại khi tải lại
    }
  }, []);

  useEffect(() => {
    if (userId) {
      loadFoods();
      loadPlan();
    } else {
      setFoods([]);
      setFoodsStatus("idle");
      setWorkoutPlan([]);
    }
  }, [userId, loadFoods, loadPlan]);

  /** Chỉ admin/coach. Ném ApiError khi thất bại (vd food_exists) để trang hiển thị lỗi. */
  async function addFood(food) {
    const data = await api("/foods", {
      method: "POST",
      body: {
        name: food.name,
        kcalPer100g: food.kcal,
        proteinPer100g: food.protein,
        carbsPer100g: food.carbs,
        fatPer100g: food.fat,
      },
    });
    setFoods((prev) => [...prev, fromServer(data.food)].sort((a, b) => a.name.localeCompare(b.name, "vi")));
  }

  async function removeFood(id) {
    await api(`/foods/${id}`, { method: "DELETE" });
    setFoods((prev) => prev.filter((f) => f.id !== id));
  }

  /** Chỉ admin/coach. `data` = { name, items: [{ name, sets, reps }] }. Ném ApiError khi thất bại. */
  async function updateWorkoutDay(weekday, data) {
    const res = await api(`/workout-plan/${weekday}`, { method: "PUT", body: data });
    setWorkoutPlan((prev) => prev.map((d) => (d.weekday === weekday ? res.day : d)));
  }

  const value = {
    foods, foodsStatus, reloadFoods: loadFoods, addFood, removeFood,
    workoutPlan, updateWorkoutDay,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData phải được dùng trong AppDataProvider");
  return ctx;
}
