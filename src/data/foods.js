// Giá trị dinh dưỡng trung bình trên 100g (ước tính theo số liệu dinh dưỡng phổ biến).
export const foods = [
  { id: "com-trang", name: "Cơm trắng", kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { id: "com-gao-lut", name: "Cơm gạo lứt", kcal: 123, protein: 2.7, carbs: 26, fat: 1 },
  { id: "uc-ga", name: "Ức gà (luộc, không da)", kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  { id: "thit-bo", name: "Thịt bò nạc", kcal: 250, protein: 26, carbs: 0, fat: 15 },
  { id: "thit-heo", name: "Thịt heo nạc", kcal: 242, protein: 27, carbs: 0, fat: 14 },
  { id: "ca-hoi", name: "Cá hồi", kcal: 208, protein: 20, carbs: 0, fat: 13 },
  { id: "trung-ga", name: "Trứng gà (luộc)", kcal: 155, protein: 13, carbs: 1.1, fat: 11 },
  { id: "sua-chua", name: "Sữa chua Hy Lạp (không đường)", kcal: 59, protein: 10, carbs: 3.6, fat: 0.4 },
  { id: "yen-mach", name: "Yến mạch (khô)", kcal: 389, protein: 17, carbs: 66, fat: 7 },
  { id: "khoai-lang", name: "Khoai lang (luộc)", kcal: 86, protein: 1.6, carbs: 20, fat: 0.1 },
  { id: "khoai-tay", name: "Khoai tây (luộc)", kcal: 87, protein: 1.9, carbs: 20, fat: 0.1 },
  { id: "chuoi", name: "Chuối", kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  { id: "tao", name: "Táo", kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  { id: "rau-xanh", name: "Rau xanh (bông cải, cải bó xôi...)", kcal: 25, protein: 2.5, carbs: 4, fat: 0.3 },
  { id: "banh-mi", name: "Bánh mì trắng", kcal: 265, protein: 9, carbs: 49, fat: 3.2 },
  { id: "whey", name: "Whey protein (bột)", kcal: 380, protein: 80, carbs: 8, fat: 5 },
  { id: "hat-oc-cho", name: "Hạt óc chó", kcal: 654, protein: 15, carbs: 14, fat: 65 },
  { id: "dau-o-liu", name: "Dầu ô liu", kcal: 884, protein: 0, carbs: 0, fat: 100 },
];

export const customFood = { id: "custom", name: "Món khác (tự nhập calo/100g)", kcal: 0, protein: 0, carbs: 0, fat: 0 };
