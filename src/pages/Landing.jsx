import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Flame, Menu, X, ArrowRight, Check, Utensils, Dumbbell,
  LineChart, Camera, Calculator, Sparkles, ClipboardList, TrendingUp,
  Award, Users, Medal, User,
} from "lucide-react";

const trainerStats = [
  { icon: Users, value: "200+", label: "Học viên đã huấn luyện" },
  { icon: TrendingUp, value: "7 năm", label: "Kinh nghiệm huấn luyện" },
  { icon: Medal, value: "5+", label: "Chứng chỉ chuyên môn" },
];

const trainerCerts = [
  "Chứng chỉ PT Quốc tế (ACE)",
  "Chuyên gia dinh dưỡng thể hình",
  "Huấn luyện Powerlifting",
];

const features = [
  { icon: Calculator, title: "Tính calo & BMI", desc: "Tự động tính calo nạp vào, tiêu hao và chỉ số BMI theo số đo cơ thể." },
  { icon: Utensils, title: "Lịch ăn chi tiết", desc: "Thực đơn từng ngày, hiển thị rõ trọng lượng (gram) và calo của mỗi món." },
  { icon: Sparkles, title: "Meal plan tự động", desc: "Sinh thực đơn từ kho dữ liệu món ăn theo đúng mục tiêu calo và macro." },
  { icon: Dumbbell, title: "Lịch tập theo nhóm cơ", desc: "Lên kế hoạch buổi tập cả tuần, chia theo nhóm cơ và số set/rep." },
  { icon: LineChart, title: "Tracking cân nặng", desc: "Ghi nhận cân nặng định kỳ và xem biểu đồ thay đổi theo tuần, tháng." },
  { icon: Camera, title: "Ảnh before / after", desc: "Lưu ảnh tiến độ theo từng mốc thời gian để so sánh trực quan." },
];

const steps = [
  { icon: ClipboardList, title: "Nhập dữ liệu ban đầu", desc: "Chiều cao, cân nặng, số đo cơ thể và mục tiêu bạn muốn đạt được." },
  { icon: Sparkles, title: "Nhận kế hoạch", desc: "Hệ thống sinh lịch ăn và lịch tập phù hợp với mục tiêu của bạn." },
  { icon: TrendingUp, title: "Theo dõi tiến độ", desc: "Cập nhật cân nặng và ảnh mỗi tuần, xem hành trình thay đổi qua biểu đồ." },
];

const plans = [
  {
    name: "Miễn phí",
    price: "0đ",
    period: "/tháng",
    desc: "Dành cho người tự tập",
    features: ["Tính calo & BMI", "Lịch ăn cơ bản", "Tracking cân nặng", "1 mục tiêu"],
    cta: "Bắt đầu ngay",
    highlight: false,
  },
  {
    name: "PT cá nhân",
    price: "199k",
    period: "/tháng",
    desc: "Dành cho huấn luyện viên",
    features: ["Toàn bộ gói Miễn phí", "Quản lý tới 30 khách", "Meal plan tự động", "Ảnh before/after không giới hạn", "Báo cáo tiến độ hàng tuần"],
    cta: "Dùng thử 7 ngày",
    highlight: true,
  },
  {
    name: "Phòng gym",
    price: "Liên hệ",
    period: "",
    desc: "Dành cho doanh nghiệp",
    features: ["Toàn bộ gói PT cá nhân", "Không giới hạn khách & PT", "Tùy chỉnh thương hiệu", "Hỗ trợ riêng 24/7"],
    cta: "Liên hệ tư vấn",
    highlight: false,
  },
];

function Nav() {
  const [open, setOpen] = useState(false);
  const links = [
    { href: "#about", label: "Giới thiệu" },
    { href: "#features", label: "Tính năng" },
    { href: "#how", label: "Cách hoạt động" },
    { href: "#pricing", label: "Bảng giá" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <Flame className="text-brand-600" size={26} />
            <span className="text-lg sm:text-xl font-bold text-slate-900">Trung Phạm Fitness</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/app"
              className="hidden sm:inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Vào app
              <ArrowRight size={15} />
            </Link>
            <button
              onClick={() => setOpen((o) => !o)}
              className="md:hidden p-2 -mr-2 text-slate-600"
              aria-label="Mở menu"
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/app"
            className="flex items-center justify-center gap-1.5 bg-brand-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg mt-2"
          >
            Vào app
            <ArrowRight size={15} />
          </Link>
        </div>
      )}
    </header>
  );
}

function AppPreview() {
  return (
    <div className="rounded-xl sm:rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-900/5 overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
      </div>
      <div className="flex">
        <div className="hidden sm:flex w-32 shrink-0 bg-slate-900 flex-col gap-2 p-3">
          <div className="h-2.5 w-16 rounded-full bg-brand-500/80 mb-2" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={`h-6 rounded-md ${i === 1 ? "bg-brand-600" : "bg-slate-800"}`} />
          ))}
        </div>
        <div className="flex-1 p-3 sm:p-4 space-y-3 bg-slate-50">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {["#fed7aa", "#bfdbfe", "#bbf7d0", "#e9d5ff"].map((c) => (
              <div key={c} className="rounded-lg bg-white border border-slate-200 p-2.5">
                <div className="h-1.5 w-8 rounded-full bg-slate-200 mb-2" />
                <div className="h-3 w-12 rounded-full" style={{ backgroundColor: c }} />
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-white border border-slate-200 p-3">
            <div className="h-1.5 w-20 rounded-full bg-slate-200 mb-3" />
            <svg viewBox="0 0 300 70" className="w-full h-16" preserveAspectRatio="none">
              <polyline
                points="0,10 50,22 100,30 150,42 200,48 250,56 300,62"
                fill="none" stroke="#2563eb" strokeWidth="3"
                strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <Nav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-50 via-white to-white" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 sm:pt-20 sm:pb-24">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold px-3 py-1.5">
                <Sparkles size={13} />
                Theo dõi calo & tiến độ tập luyện
              </span>
              <h1 className="mt-5 text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight tracking-tight">
                Theo dõi hành trình{" "}
                <span className="text-brand-600">thể hình</span> của bạn
              </h1>
              <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-xl mx-auto lg:mx-0">
                Tính calo, lên lịch ăn và lịch tập, ghi nhận cân nặng cùng ảnh
                before/after — tất cả trong một nơi, cập nhật theo ngày, tuần và tháng.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Link
                  to="/app"
                  className="inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
                >
                  Bắt đầu ngay
                  <ArrowRight size={17} />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center justify-center bg-white hover:bg-slate-50 text-slate-700 font-medium px-6 py-3 rounded-lg border border-slate-200 transition-colors"
                >
                  Xem tính năng
                </a>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 justify-center lg:justify-start text-sm text-slate-500">
                {["Miễn phí để bắt đầu", "Không cần thẻ tín dụng", "Dùng trên mọi thiết bị"].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5">
                    <Check size={15} className="text-brand-600" />
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="lg:pl-4">
              <AppPreview />
            </div>
          </div>
        </div>
      </section>

      {/* About the trainer */}
      <section id="about" className="py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="order-2 lg:order-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold px-3 py-1.5">
                <Award size={13} />
                Giới thiệu huấn luyện viên
              </span>
              <h2 className="mt-5 text-2xl sm:text-3xl font-bold text-slate-900">
                PT Trung Phạm
              </h2>
              <p className="mt-1 text-brand-700 font-medium">Huấn luyện viên cá nhân · Chuyên gia Fitness</p>
              <p className="mt-4 text-slate-600 leading-relaxed">
                Với hơn 7 năm kinh nghiệm huấn luyện, Trung Phạm đã đồng hành cùng
                hàng trăm học viên trên hành trình thay đổi vóc dáng và sức khỏe.
                Phương pháp huấn luyện tập trung vào kế hoạch tập luyện và dinh
                dưỡng cá nhân hóa, theo dõi sát sao tiến độ từng tuần để đảm bảo
                hiệu quả bền vững, an toàn cho từng học viên.
              </p>

              <div className="mt-7 grid grid-cols-3 gap-4">
                {trainerStats.map(({ icon: Icon, value, label }) => (
                  <div key={label}>
                    <Icon size={18} className="text-brand-600" />
                    <p className="mt-2 text-xl sm:text-2xl font-bold text-slate-900">{value}</p>
                    <p className="text-xs text-slate-500 leading-snug">{label}</p>
                  </div>
                ))}
              </div>

              <ul className="mt-7 space-y-2">
                {trainerCerts.map((cert) => (
                  <li key={cert} className="flex items-center gap-2 text-sm text-slate-600">
                    <Check size={15} className="text-brand-600 shrink-0" />
                    {cert}
                  </li>
                ))}
              </ul>

              <a
                href="#pricing"
                className="mt-8 inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium px-6 py-3 rounded-lg transition-colors"
              >
                Đăng ký huấn luyện cùng PT Trung Phạm
                <ArrowRight size={17} />
              </a>
            </div>

            <div className="order-1 lg:order-2 flex justify-center">
              <div className="relative w-full max-w-sm">
                <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-brand-100 to-transparent -z-10" />
                <div className="aspect-3/4 rounded-2xl bg-slate-900 border border-slate-200 shadow-xl flex items-center justify-center overflow-hidden">
                  <User size={96} className="text-slate-700" strokeWidth={1} />
                </div>
                <div className="absolute -bottom-5 -right-5 bg-white rounded-xl border border-slate-200 shadow-lg px-4 py-3 flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                    <Medal size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 leading-none">7+ năm</p>
                    <p className="text-xs text-slate-500 mt-1">Kinh nghiệm</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 sm:py-24 bg-slate-50 border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Mọi thứ bạn cần cho hành trình tập luyện
            </h2>
            <p className="mt-3 text-slate-600">
              Từ dinh dưỡng đến lịch tập và tiến độ cơ thể — theo dõi đầy đủ trong một ứng dụng.
            </p>
          </div>
          <div className="mt-10 sm:mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 hover:border-brand-300 hover:shadow-sm transition-all">
                <div className="w-11 h-11 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Icon size={21} />
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Cách hoạt động</h2>
            <p className="mt-3 text-slate-600">Chỉ 3 bước để bắt đầu theo dõi hành trình của bạn.</p>
          </div>
          <div className="mt-10 sm:mt-14 grid sm:grid-cols-3 gap-6 sm:gap-8">
            {steps.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="relative text-center sm:text-left">
                <div className="inline-flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                    <Icon size={21} />
                  </div>
                  <span className="text-3xl font-bold text-slate-200">0{i + 1}</span>
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 sm:py-24 bg-slate-50 border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Bảng giá</h2>
            <p className="mt-3 text-slate-600">Bắt đầu miễn phí, nâng cấp khi bạn cần quản lý nhiều khách hơn.</p>
          </div>
          <div className="mt-10 sm:mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 items-start">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl p-6 border ${
                  plan.highlight
                    ? "bg-slate-900 border-slate-900 text-white sm:scale-105 shadow-xl"
                    : "bg-white border-slate-200"
                }`}
              >
                {plan.highlight && (
                  <span className="inline-block text-xs font-semibold bg-brand-500 text-white px-2.5 py-1 rounded-full mb-3">
                    Phổ biến nhất
                  </span>
                )}
                <h3 className={`font-semibold ${plan.highlight ? "text-white" : "text-slate-900"}`}>{plan.name}</h3>
                <p className={`text-sm mt-1 ${plan.highlight ? "text-slate-400" : "text-slate-500"}`}>{plan.desc}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className={`text-3xl font-bold ${plan.highlight ? "text-white" : "text-slate-900"}`}>{plan.price}</span>
                  <span className={plan.highlight ? "text-slate-400 text-sm" : "text-slate-500 text-sm"}>{plan.period}</span>
                </div>
                <ul className="mt-5 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check size={16} className={`mt-0.5 shrink-0 ${plan.highlight ? "text-brand-400" : "text-brand-600"}`} />
                      <span className={plan.highlight ? "text-slate-300" : "text-slate-600"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/app"
                  className={`mt-6 flex items-center justify-center w-full font-medium text-sm px-4 py-2.5 rounded-lg transition-colors ${
                    plan.highlight
                      ? "bg-brand-600 hover:bg-brand-500 text-white"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-slate-900 px-6 py-10 sm:px-12 sm:py-14 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Sẵn sàng thay đổi?</h2>
            <p className="mt-3 text-slate-400 max-w-lg mx-auto">
              Bắt đầu theo dõi calo, lịch tập và tiến độ cơ thể của bạn ngay hôm nay.
            </p>
            <Link
              to="/app"
              className="mt-7 inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-medium px-6 py-3 rounded-lg transition-colors"
            >
              Vào app ngay
              <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Flame className="text-brand-600" size={20} />
            <span className="font-semibold text-slate-900">Trung Phạm Fitness</span>
          </div>
          <p className="text-sm text-slate-500">© 2026 Trung Phạm Fitness. Made with ❤️</p>
        </div>
      </footer>
    </div>
  );
}
