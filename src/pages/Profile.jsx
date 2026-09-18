import { profile } from "../data/mock";

function bmi(weight, heightCm) {
  const h = heightCm / 100;
  return (weight / (h * h)).toFixed(1);
}

function bmiCategory(value) {
  if (value < 18.5) return { label: "Thiếu cân", color: "text-blue-600 bg-blue-50" };
  if (value < 25) return { label: "Bình thường", color: "text-brand-700 bg-brand-50" };
  if (value < 30) return { label: "Thừa cân", color: "text-orange-600 bg-orange-50" };
  return { label: "Béo phì", color: "text-red-600 bg-red-50" };
}

export default function Profile() {
  const currentBmi = parseFloat(bmi(profile.currentWeight, profile.height));
  const category = bmiCategory(currentBmi);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Hồ sơ</h1>
        <p className="text-sm sm:text-base text-slate-500 mt-1">Dữ liệu ban đầu và chỉ số cơ thể, cập nhật hàng tuần.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 lg:order-1 order-2 bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Thông tin cá nhân</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              ["Họ tên", profile.name],
              ["Tuổi", `${profile.age}`],
              ["Giới tính", profile.gender],
              ["Chiều cao", `${profile.height} cm`],
              ["Cân nặng ban đầu", `${profile.startWeight} kg`],
              ["Cân nặng hiện tại", `${profile.currentWeight} kg`],
              ["Mục tiêu", `${profile.targetWeight} kg`],
            ].map(([label, value]) => (
              <div key={label} className="space-y-1">
                <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
                <p className="font-medium text-slate-800">{value}</p>
              </div>
            ))}
          </div>
          <button className="mt-6 text-sm font-medium text-brand-700 hover:text-brand-800">
            Cập nhật số liệu tuần này →
          </button>
        </div>

        <div className="lg:order-2 order-1 bg-white rounded-xl border border-slate-200 p-6 flex flex-col items-center justify-center text-center">
          <p className="text-sm text-slate-500 mb-2">Chỉ số BMI</p>
          <p className="text-4xl font-bold text-slate-900">{currentBmi}</p>
          <span className={`mt-3 text-sm font-medium px-3 py-1 rounded-full ${category.color}`}>
            {category.label}
          </span>
        </div>
      </div>
    </div>
  );
}
