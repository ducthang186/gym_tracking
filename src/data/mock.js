export const profile = {
  name: "Nguyễn Văn A",
  height: 175, // cm
  startWeight: 82,
  currentWeight: 76.4,
  targetWeight: 70,
  age: 27,
  gender: "Nam",
};

export const weightHistory = [
  { week: "Tuần 1", weight: 82 },
  { week: "Tuần 2", weight: 80.8 },
  { week: "Tuần 3", weight: 79.9 },
  { week: "Tuần 4", weight: 78.7 },
  { week: "Tuần 5", weight: 77.9 },
  { week: "Tuần 6", weight: 77.1 },
  { week: "Tuần 7", weight: 76.4 },
];

export const calorieToday = {
  goal: 2200,
  consumed: 1540,
  burned: 480,
  protein: { goal: 160, current: 98 },
  carbs: { goal: 220, current: 150 },
  fat: { goal: 70, current: 40 },
};

export const mealPlanToday = [
  {
    time: "07:00",
    name: "Bữa sáng",
    items: [
      { food: "Yến mạch", grams: 60, calories: 230 },
      { food: "Chuối", grams: 100, calories: 90 },
      { food: "Trứng luộc", grams: 100, calories: 100 },
    ],
  },
  {
    time: "10:30",
    name: "Ăn nhẹ",
    items: [
      { food: "Sữa chua Hy Lạp", grams: 150, calories: 130 },
      { food: "Hạt óc chó", grams: 15, calories: 80 },
    ],
  },
  {
    time: "13:00",
    name: "Bữa trưa",
    items: [
      { food: "Ức gà", grams: 150, calories: 250 },
      { food: "Cơm gạo lứt", grams: 150, calories: 195 },
      { food: "Rau xanh", grams: 100, calories: 35 },
      { food: "Dầu ô liu", grams: 10, calories: 90 },
    ],
  },
  {
    time: "16:00",
    name: "Ăn nhẹ",
    items: [
      { food: "Whey protein", grams: 30, calories: 120 },
      { food: "Táo", grams: 150, calories: 80 },
    ],
  },
  {
    time: "19:30",
    name: "Bữa tối",
    items: [
      { food: "Cá hồi", grams: 150, calories: 310 },
      { food: "Khoai lang", grams: 150, calories: 130 },
      { food: "Salad", grams: 100, calories: 40 },
      { food: "Dầu ô liu", grams: 6, calories: 60 },
    ],
  },
];

export const workoutPlan = {
  Monday: { name: "Ngực + Tay sau", exercises: ["Bench Press 4x8", "Incline Dumbbell Press 3x10", "Tricep Pushdown 3x12"] },
  Tuesday: { name: "Lưng + Tay trước", exercises: ["Deadlift 4x6", "Lat Pulldown 3x10", "Barbell Curl 3x12"] },
  Wednesday: { name: "Nghỉ / Cardio nhẹ", exercises: ["Đi bộ nhanh 30 phút"] },
  Thursday: { name: "Vai", exercises: ["Overhead Press 4x8", "Lateral Raise 3x15", "Face Pull 3x15"] },
  Friday: { name: "Chân", exercises: ["Squat 4x8", "Leg Press 3x10", "Leg Curl 3x12"] },
  Saturday: { name: "Full body nhẹ", exercises: ["Circuit training 20 phút"] },
  Sunday: { name: "Nghỉ ngơi", exercises: [] },
};

export const progressPhotos = [
  { date: "01/08/2026", label: "Tuần 1", before: true },
  { date: "15/08/2026", label: "Tuần 3", before: false },
  { date: "29/08/2026", label: "Tuần 5", before: false },
  { date: "12/09/2026", label: "Tuần 7", before: false },
];
