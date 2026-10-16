import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Menu, X, ArrowRight, Zap, Grid3x3, Diamond, Square,
  Trophy, Award, Users, BookOpen, Quote, User,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { photoUrl, useAbout } from "../lib/useAbout";

const features = [
  { icon: Zap, title: "Tính Calories & BMI", desc: "Tự động tính nhu cầu năng lượng, BMI, mục tiêu calories và macro dựa trên thông tin từng học viên." },
  { icon: Grid3x3, title: "Lịch tập chi tiết", desc: "Workout theo ngày, bài tập, set/rep, RIR, mức tạ, thời gian nghỉ và lịch sử tiến bộ." },
  { icon: Zap, title: "Meal Plan & Macro", desc: "Meal plan cá nhân hóa theo calories, protein, carb, fat; có thể thay đổi món và gram thực phẩm." },
  { icon: Diamond, title: "Lịch tập theo nhóm cơ", desc: "Phân bổ Upper, Lower, Full Body hoặc split riêng theo mục tiêu và khả năng hồi phục." },
  { icon: Zap, title: "Tracking cân nặng", desc: "Nhập cân nặng mỗi ngày, xem 7-day average, xu hướng theo tuần/tháng và lịch sử thay đổi." },
  { icon: Square, title: "Before / After", desc: "Lưu ảnh Front / Side / Back theo từng mốc để so sánh trực quan quá trình thay đổi." },
];

const steps = [
  { num: "01 / INPUT", title: "Nhập dữ liệu ban đầu", desc: "Chiều cao, cân nặng, tuổi, mục tiêu, mức vận động, lịch tập và thói quen dinh dưỡng." },
  { num: "02 / PLAN", title: "Nhận kế hoạch", desc: "Coach thiết lập calories, macro, meal plan và lịch tập phù hợp với mục tiêu của bạn." },
  { num: "03 / TRACK", title: "Theo dõi & điều chỉnh", desc: "Cập nhật cân nặng, check-in, ảnh và hiệu suất. Coach phân tích dữ liệu và điều chỉnh khi cần." },
];

const sideLinks = ["Hôm nay", "Lịch tập", "Dinh dưỡng", "Tiến độ", "Check-in", "Tin nhắn"];

const metrics = [
  { label: "Xu hướng cân nặng", value: "− 4.8 kg", pct: 76 },
  { label: "Tuân thủ dinh dưỡng", value: "91%", pct: 91 },
  { label: "Tuân thủ tập luyện", value: "94%", pct: 94 },
  { label: "Check-in", value: "12 / 12", pct: 100 },
];

// Biểu tượng cho các thành tựu (xoay vòng theo thứ tự); nội dung do admin chỉnh ở /admin/content.
const achievementIcons = [Award, BookOpen, Trophy, Users];

const plans = [
  {
    label: "TỰ THEO DÕI",
    name: "Starter",
    price: "0đ",
    period: "/ tháng",
    features: ["Tính Calories & BMI", "Macro cơ bản", "Tracking cân nặng", "1 mục tiêu"],
    cta: "Bắt đầu",
    to: "/register",
    hot: false,
  },
  {
    label: "PHỔ BIẾN NHẤT",
    name: "1:1 Personal Coaching",
    price: "3.200.000đ",
    period: "/ tháng",
    features: ["Coaching 1:1", "Meal plan + Macro cá nhân", "Lịch tập cá nhân hóa", "Daily weight tracking", "Weekly check-in", "Progress photo & measurements", "Coach điều chỉnh kế hoạch"],
    cta: "Đăng ký Coaching →",
    to: "/register",
    hot: true,
  },
  {
    label: "DOANH NGHIỆP / PHÒNG GYM",
    name: "Custom",
    price: "Liên hệ",
    period: "",
    features: ["Hệ thống quản lý nhiều học viên", "Branding riêng", "Dashboard Coach", "Quản lý dữ liệu", "Hỗ trợ triển khai"],
    cta: "Liên hệ tư vấn",
    to: "/app",
    hot: false,
  },
];

function Nav() {
  const [open, setOpen] = useState(false);
  const { status } = useAuth();
  const signedIn = status === "authenticated";
  const links = [
    { href: "#home", label: "Trang chủ" },
    { href: "#features", label: "Tính năng" },
    { href: "#system", label: "Hệ thống" },
    { href: "#results", label: "Kết quả" },
    { href: "#pricing", label: "Bảng giá" },
    { href: "#about", label: "Về tôi" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-page/90 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[72px]">
          <a href="#home" className="font-display font-extrabold text-xl tracking-tight text-ink">
            LATIS
            <span className="block text-[9px] font-extrabold text-cyan tracking-[0.22em] -mt-0.5">
              — COACHING
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-6">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="text-xs text-[#b8c3c6] hover:text-cyan transition-colors">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {!signedIn && (
              <Link to="/login" className="hidden sm:inline text-xs font-semibold text-[#b8c3c6] hover:text-cyan transition-colors">
                Đăng nhập
              </Link>
            )}
            <Link
              to={signedIn ? "/app" : "/register"}
              className="hidden sm:inline-flex items-center gap-2 bg-cyan text-cyan-deep border border-cyan rounded-lg px-4 py-2.5 text-xs font-extrabold shadow-[0_0_28px_rgba(8,217,255,0.12)]"
            >
              {signedIn ? "Vào app" : "Bắt đầu"}
              <ArrowRight size={14} />
            </Link>
            <button
              onClick={() => setOpen((o) => !o)}
              className="md:hidden p-2 -mr-2 text-[#b8c3c6]"
              aria-label="Mở menu"
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-line bg-page px-4 py-3 space-y-1">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-sm font-medium text-[#b8c3c6] hover:bg-panel"
            >
              {l.label}
            </a>
          ))}
          {!signedIn && (
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-sm font-medium text-[#b8c3c6] hover:bg-panel"
            >
              Đăng nhập
            </Link>
          )}
          <Link
            to={signedIn ? "/app" : "/register"}
            className="flex items-center justify-center gap-1.5 bg-cyan text-cyan-deep text-sm font-extrabold px-4 py-2.5 rounded-lg mt-2"
          >
            {signedIn ? "Vào app" : "Bắt đầu"}
            <ArrowRight size={15} />
          </Link>
        </div>
      )}
    </header>
  );
}

function PortalPreview() {
  return (
    <div
      className="rounded-2xl border border-line p-4 sm:p-6"
      style={{ background: "radial-gradient(circle at 78% 15%, rgba(0,216,255,.08), transparent 35%), #080c0e" }}
    >
      <div className="grid lg:grid-cols-[220px_1fr] gap-4">
        <aside className="hidden lg:block border border-line bg-[#070a0c] rounded-xl p-3">
          <p className="font-display font-bold text-sm text-ink px-2 pb-2">
            LATIS
            <br />
            <span className="text-cyan text-[10px]">CLIENT PORTAL</span>
          </p>
          {sideLinks.map((l, i) => (
            <div
              key={l}
              className={`px-2.5 py-2.5 rounded-lg text-[11px] mt-0.5 ${
                i === 0 ? "bg-[#10282e] text-cyan" : "text-[#829095]"
              }`}
            >
              {l}
            </div>
          ))}
        </aside>

        <div className="border border-line bg-[#070a0c] rounded-xl p-4 sm:p-5">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-cyan text-[10px] font-extrabold tracking-[0.13em]">CHÀO BUỔI SÁNG</p>
              <h3 className="font-display font-bold text-xl sm:text-2xl text-ink mt-1">Hôm nay bạn cần làm gì?</h3>
            </div>
            <span className="hidden sm:inline-block text-cyan border border-[#24505a] px-2.5 py-1.5 rounded-full text-[9px]">
              TUẦN 06 / 12
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            <div className="col-span-2 sm:col-span-1 border border-line bg-[#0c1214] rounded-lg p-3">
              <p className="text-[9px] text-[#758388]">MỤC TIÊU HÀNG NGÀY</p>
              <p className="font-display font-bold text-lg text-ink mt-1.5">
                2,350 <span className="text-cyan text-[9px] font-normal">CALORIES</span>
              </p>
            </div>
            {[["PROTEIN", "160g"], ["CARB", "280g"], ["FAT", "65g"]].map(([label, val]) => (
              <div key={label} className="border border-line bg-[#0c1214] rounded-lg p-3">
                <p className="text-[9px] text-[#758388]">{label}</p>
                <p className="font-display font-bold text-lg text-ink mt-1.5">{val}</p>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-2.5 mt-2.5">
            <div className="border border-line bg-panel rounded-lg p-3.5">
              <p className="text-cyan text-[9px] font-extrabold tracking-[0.13em]">XU HƯỚNG CÂN NẶNG</p>
              <p className="font-display font-bold text-lg text-ink mt-1.5">
                69.8 kg <span className="text-cyan text-[11px]">↓ 0.6 kg</span>
              </p>
              <div className="flex items-end gap-1.5 h-[70px] mt-3">
                {[43, 52, 49, 63, 60, 75, 84].map((h, i) => (
                  <i key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: "linear-gradient(180deg, #08d9ff, #075563)" }} />
                ))}
              </div>
            </div>
            <div className="border border-line bg-panel rounded-lg p-3.5">
              <p className="text-cyan text-[9px] font-extrabold tracking-[0.13em]">LỊCH TẬP HÔM NAY</p>
              <p className="font-display font-bold text-lg text-ink mt-1.5">UPPER A</p>
              {[["Incline DB Press", "3 × 8–10"], ["Lat Pulldown", "3 × 8–12"], ["Machine Chest Press", "2 × 10–12"]].map(([ex, set]) => (
                <div key={ex} className="flex justify-between py-2 border-b border-[#172125] last:border-0 text-[10px] text-[#a9b2b5]">
                  <span>{ex}</span>
                  <b className="text-[#e8edef]">{set}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const [about] = useAbout();
  const photo = photoUrl(about);
  return (
    <div className="min-h-screen bg-page text-ink overflow-x-clip">
      <Nav />

      {/* Hero */}
      <section className="relative overflow-hidden" id="home">
        <div
          className="absolute w-[720px] h-[520px] -left-[280px] -top-[180px] pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(0,216,255,.13), transparent 65%)" }}
        />
        <div className="relative max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-14 sm:pb-16">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
            <div>
              <p className="text-cyan text-[10px] font-black tracking-[0.16em]">ONLINE COACHING / DATA-DRIVEN FITNESS</p>
              <h1 className="font-display font-extrabold text-[44px] sm:text-[64px] lg:text-[76px] leading-[0.95] tracking-tight mt-4">
                THE <span className="text-cyan">STRONGEST</span>
                <br />
                VERSION
                <br />
                OF YOU.
              </h1>
              <p className="text-[#a9b4b8] leading-[1.75] max-w-[570px] text-sm mt-5">
                Một hệ thống coaching cá nhân hóa kết hợp tập luyện, dinh dưỡng và dữ liệu tiến độ.
                Bạn biết hôm nay cần làm gì — tôi biết khi nào cần điều chỉnh.
              </p>
              <div className="flex flex-wrap gap-2.5 mt-6">
                <a href="#pricing" className="inline-flex items-center gap-2 bg-cyan text-cyan-deep rounded-lg px-5 py-3 text-xs font-extrabold shadow-[0_0_28px_rgba(8,217,255,0.12)]">
                  Đăng ký Coaching
                  <ArrowRight size={14} />
                </a>
                <Link to="/app" className="inline-flex items-center gap-2 bg-transparent border border-line text-ink rounded-lg px-5 py-3 text-xs font-extrabold hover:border-cyan/50 transition-colors">
                  Xem hệ thống học viên
                </Link>
              </div>
              <div className="flex gap-7 border-t border-line pt-5 mt-7">
                {[["1:1", "Coaching cá nhân"], ["DATA", "Ra quyết định dựa trên dữ liệu"], ["24/7", "Truy cập hệ thống"]].map(([big, small]) => (
                  <div key={big}>
                    <b className="font-display font-bold text-xl block">{big}</b>
                    <span className="text-muted text-[10px] mt-1 block">{small}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative h-[380px] sm:h-[460px] lg:h-[540px] border border-line rounded-2xl overflow-hidden bg-[#090d0f]">
              <img
                src="https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=1200&q=85"
                alt="Fitness coaching"
                className="w-full h-full object-cover [filter:saturate(.7)_contrast(1.08)]"
              />
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(90deg, rgba(4,6,7,.76), transparent 60%), linear-gradient(0deg, rgba(4,6,7,.65), transparent 45%)" }}
              />
              <div className="absolute z-10 right-4 top-4 w-[158px] p-4 rounded-xl bg-[#070b0d]/90 border border-[#26363c]">
                <strong className="font-display text-2xl text-cyan block">01</strong>
                <span className="text-[10px] text-[#9aa7aa]">Kế hoạch cá nhân hóa</span>
                <hr className="border-line my-3" />
                <strong className="font-display text-2xl text-cyan block">∞</strong>
                <span className="text-[10px] text-[#9aa7aa]">Điều chỉnh theo tiến độ</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-24" id="features">
        <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-5 mb-7">
            <div>
              <p className="text-cyan text-[10px] font-black tracking-[0.16em]">MỌI THỨ TRONG MỘT HỆ THỐNG</p>
              <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-2">Không chỉ là giáo án.</h2>
            </div>
            <p className="text-muted max-w-[500px] text-sm leading-[1.7]">
              Kết hợp tính toán, lịch tập, meal plan, tracking và coaching trong cùng một trải nghiệm.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="p-5 sm:p-6 rounded-2xl border border-line"
                style={{ background: "linear-gradient(145deg, #0e1518, #090d0f)" }}
              >
                <div className="w-9 h-9 rounded-lg bg-[#102a30] text-cyan flex items-center justify-center mb-4">
                  <Icon size={17} />
                </div>
                <h3 className="font-display font-bold text-lg mb-1.5">{title}</h3>
                <p className="text-muted text-xs leading-[1.65]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 sm:py-24" id="system">
        <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-5 mb-7">
            <div>
              <p className="text-cyan text-[10px] font-black tracking-[0.16em]">CÁCH HOẠT ĐỘNG</p>
              <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-2">3 bước để bắt đầu.</h2>
            </div>
            <p className="text-muted max-w-[500px] text-sm leading-[1.7]">
              Từ dữ liệu ban đầu đến một kế hoạch rõ ràng và quá trình được theo dõi liên tục.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 border-t border-b border-line">
            {steps.map((s, i) => (
              <div key={s.num} className={`p-6 sm:p-7 ${i < steps.length - 1 ? "sm:border-r border-b sm:border-b-0 border-line" : ""}`}>
                <p className="font-display font-bold text-cyan text-xs">{s.num}</p>
                <h3 className="font-display font-bold text-lg mt-3 mb-1.5">{s.title}</h3>
                <p className="text-muted text-xs leading-[1.65]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Client portal preview */}
      <section className="py-16 sm:py-24" id="portal">
        <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-5 mb-7">
            <div>
              <p className="text-cyan text-[10px] font-black tracking-[0.16em]">CLIENT PORTAL</p>
              <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-2">
                Học viên đăng nhập — mọi thứ đã sẵn sàng.
              </h2>
            </div>
            <p className="text-muted max-w-[500px] text-sm leading-[1.7]">
              Mỗi học viên có một tài khoản riêng. Data cá nhân, meal plan, lịch tập và tiến độ được tách biệt hoàn toàn.
            </p>
          </div>
          <PortalPreview />
          <div className="text-center mt-6">
            <Link to="/app" className="inline-flex items-center gap-2 text-cyan text-sm font-semibold hover:text-cyan/80">
              Vào xem hệ thống đầy đủ
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* Coach tools */}
      <section className="py-16 sm:py-24">
        <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-5 mb-7">
            <div>
              <p className="text-cyan text-[10px] font-black tracking-[0.16em]">COACH TOOLS</p>
              <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-2">Coach cũng có hệ thống riêng.</h2>
            </div>
            <p className="text-muted max-w-[500px] text-sm leading-[1.7]">
              Không cần quản lý từng học viên bằng nhiều file Excel, Zalo và ảnh chụp màn hình.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3.5">
            <div className="rounded-2xl border border-line bg-[#0a0f11] p-5 sm:p-6">
              <p className="text-cyan text-[10px] font-black tracking-[0.16em]">MEAL PLAN BUILDER</p>
              <h3 className="font-display font-bold text-xl mt-3 mb-4">Tạo meal plan theo macro.</h3>
              {[["Ức gà · 150g", "35P / 3F"], ["Cơm chín · 250g", "70C"], ["Rau xanh · 200g", "10C"], ["Yến mạch · 60g", "38C / 8P"]].map(([food, macro]) => (
                <div key={food} className="flex justify-between items-center border border-[#18262b] bg-[#0d1416] rounded-lg p-2.5 mt-2">
                  <span className="text-[11px] text-[#a9b2b5]">{food}</span>
                  <b className="text-[11px]">{macro}</b>
                </div>
              ))}
              <p className="text-cyan text-[10px] font-extrabold mt-3.5">+ THAY MÓN / ĐIỀU CHỈNH GRAM / LƯU TEMPLATE</p>
            </div>
            <div className="rounded-2xl border border-line bg-[#0a0f11] p-5 sm:p-6">
              <p className="text-cyan text-[10px] font-black tracking-[0.16em]">WORKOUT BUILDER</p>
              <h3 className="font-display font-bold text-xl mt-3 mb-4">Thiết kế giáo án & lưu lịch sử.</h3>
              {[["Incline DB Press", "3 × 8–10 · RIR 1–2"], ["Lat Pulldown", "3 × 8–12"], ["Machine Chest Press", "2 × 10–12"], ["Lateral Raise", "3 × 12–15"]].map(([ex, set]) => (
                <div key={ex} className="flex justify-between items-center border border-[#18262b] bg-[#0d1416] rounded-lg p-2.5 mt-2">
                  <span className="text-[11px] text-[#a9b2b5]">{ex}</span>
                  <b className="text-[11px]">{set}</b>
                </div>
              ))}
              <p className="text-cyan text-[10px] font-extrabold mt-3.5">+ VIDEO / REST TIME / WEIGHT HISTORY / NOTES</p>
            </div>
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="py-16 sm:py-24" id="results">
        <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-5 mb-7">
            <div>
              <p className="text-cyan text-[10px] font-black tracking-[0.16em]">PROGRESS</p>
              <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-2">Dữ liệu phía sau mỗi thay đổi.</h2>
            </div>
            <p className="text-muted max-w-[500px] text-sm leading-[1.7]">
              Không chỉ khoe Before/After — hãy cho khách hàng thấy cả quá trình đã được quản lý như thế nào.
            </p>
          </div>
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-3.5">
            <div className="relative h-[280px] sm:h-[390px] rounded-2xl overflow-hidden border border-line">
              <img
                src="https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=1200&q=85"
                alt="Transformation"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(0,0,0,.55), transparent 65%)" }} />
              <span className="absolute z-10 top-4 left-4 px-2.5 py-1.5 rounded-md bg-[#080b0c] border border-[#29383d] text-[9px] font-black">BẮT ĐẦU</span>
              <span className="absolute z-10 top-4 right-4 px-2.5 py-1.5 rounded-md bg-cyan text-cyan-deep text-[9px] font-black">KẾT QUẢ</span>
            </div>
            <div className="rounded-2xl border border-line bg-[#090d0f] p-5 sm:p-6">
              <p className="text-cyan text-[10px] font-black tracking-[0.16em]">CLIENT JOURNEY / 12 TUẦN</p>
              <h3 className="font-display font-bold text-2xl mt-2 mb-2">Từ kế hoạch → tiến bộ.</h3>
              {metrics.map((m) => (
                <div key={m.label} className="py-4 border-b border-line last:border-0">
                  <div className="flex justify-between text-[11px] text-muted">
                    <span>{m.label}</span>
                    <b className="text-[#eef2f3]">{m.value}</b>
                  </div>
                  <div className="h-1.5 bg-[#182226] rounded-full mt-2.5">
                    <div className="h-full bg-cyan rounded-full" style={{ width: `${m.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 sm:py-24" id="pricing">
        <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-5 mb-7">
            <div>
              <p className="text-cyan text-[10px] font-black tracking-[0.16em]">BẢNG GIÁ</p>
              <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-2">Chọn hình thức phù hợp.</h2>
            </div>
            <p className="text-muted max-w-[500px] text-sm leading-[1.7]">
              Phần giá có thể thay đổi theo package thực tế của bạn.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5 items-start">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 border ${plan.hot ? "border-[#31505a] sm:scale-105 shadow-[0_0_35px_rgba(8,217,255,0.07)]" : "border-line bg-[#0a0f11]"}`}
                style={plan.hot ? { background: "linear-gradient(145deg, #101926, #080d10)" } : undefined}
              >
                <p className="text-[9px] text-cyan font-black tracking-[0.1em]">{plan.label}</p>
                <h3 className="font-display font-bold text-xl mt-2.5 mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="font-display font-extrabold text-3xl">{plan.price}</span>
                  <span className="text-muted text-[11px]">{plan.period}</span>
                </div>
                <ul className="my-4.5 space-y-0">
                  {plan.features.map((f) => (
                    <li key={f} className="py-1.5 text-[11px] text-[#a8b2b5]">
                      <span className="text-cyan mr-2">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={plan.to}
                  className={`flex items-center justify-center w-full font-extrabold text-xs px-4 py-3 rounded-lg transition-colors ${
                    plan.hot ? "bg-cyan text-cyan-deep hover:bg-cyan/90" : "bg-transparent border border-ink/20 text-ink hover:border-cyan/50"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About the coach */}
      <section className="py-16 sm:py-24 border-t border-line" id="about">
        <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <div className="order-2 lg:order-1">
              <p className="text-cyan text-[10px] font-black tracking-[0.16em]">VỀ TÔI</p>
              <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-2">
                Người đứng sau <span className="text-cyan">LATIS</span>.
              </h2>
              <p className="text-ink font-display font-semibold text-lg mt-4">
                {about.name}{about.title && <> — {about.title}</>}
              </p>
              <p className="text-muted text-sm leading-[1.75] mt-3 max-w-[540px] whitespace-pre-line">{about.bio}</p>

              {about.stats.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-7">
                  {about.stats.map((s) => (
                    <div key={s.label}>
                      <p className="font-display font-bold text-xl sm:text-2xl text-ink">{s.value}</p>
                      <p className="text-muted text-[11px] leading-snug mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {about.quote && (
                <div className="border-l-2 border-cyan/40 pl-4 mt-8">
                  <Quote size={16} className="text-cyan mb-1.5" />
                  <p className="text-[#c9d2d4] text-sm italic leading-relaxed">"{about.quote}"</p>
                </div>
              )}
            </div>

            <div className="order-1 lg:order-2 flex justify-center">
              <div className="relative w-full max-w-sm">
                <div
                  className="absolute -inset-3 sm:-inset-6 rounded-3xl -z-10"
                  style={{ background: "radial-gradient(circle, rgba(8,217,255,.14), transparent 70%)" }}
                />
                <div className="aspect-3/4 rounded-2xl bg-panel border border-line overflow-hidden flex items-center justify-center">
                  {photo ? (
                    <img src={photo} alt={`Huấn luyện viên ${about.name}`} className="w-full h-full object-cover" />
                  ) : (
                    <User size={96} className="text-line" strokeWidth={1} />
                  )}
                </div>
                {about.badge.title && (
                  <div className="absolute -bottom-5 right-2 sm:-right-5 bg-panel rounded-xl border border-line shadow-lg px-4 py-3 flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-cyan/10 text-cyan flex items-center justify-center shrink-0">
                      <Trophy size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-display font-semibold text-ink leading-none">{about.badge.title}</p>
                      {about.badge.subtitle && <p className="text-xs text-muted mt-1">{about.badge.subtitle}</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {about.achievements.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-14">
              {about.achievements.map(({ title, desc }, i) => {
                const Icon = achievementIcons[i % achievementIcons.length];
                return (
                  <div
                    key={`${title}-${i}`}
                    className="p-5 rounded-2xl border border-line"
                    style={{ background: "linear-gradient(145deg, #0e1518, #090d0f)" }}
                  >
                    <div className="w-9 h-9 rounded-lg bg-cyan/10 text-cyan flex items-center justify-center mb-4">
                      <Icon size={17} />
                    </div>
                    <h3 className="font-display font-bold text-sm leading-snug mb-1.5">{title}</h3>
                    {desc && <p className="text-muted text-xs leading-[1.6]">{desc}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20">
        <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="rounded-2xl border border-[#1f3940] p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-7"
            style={{ background: "radial-gradient(circle at 80% 50%, rgba(8,217,255,.13), transparent 33%), #090e10" }}
          >
            <div>
              <p className="text-cyan text-[10px] font-black tracking-[0.16em]">LATIS — COACHING</p>
              <h2 className="font-display font-bold text-3xl sm:text-[45px] leading-tight mt-2">
                Không đoán.
                <br />
                <span className="text-cyan">Dùng dữ liệu.</span>
              </h2>
              <p className="text-muted max-w-[570px] leading-[1.7] text-[13px] mt-3">
                Hệ thống được xây dựng để bạn có một nơi duy nhất quản lý training, nutrition, progress
                và communication — còn học viên biết chính xác họ cần làm gì mỗi ngày.
              </p>
            </div>
            <Link to="/register" className="inline-flex items-center gap-2 bg-cyan text-cyan-deep rounded-lg px-5 py-3 text-xs font-extrabold shrink-0">
              Bắt đầu hành trình
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line py-9">
        <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <b className="font-display font-bold text-[15px] text-[#edf2f3]">LATIS — COACHING</b>
            <p className="text-[#748084] text-[11px] mt-2.5">Tập luyện · Theo dõi · Điều chỉnh · Tiến bộ</p>
          </div>
          <p className="text-[#748084] text-[11px]">© 2026 LaTis Coaching · TP. Hồ Chí Minh</p>
        </div>
      </footer>
    </div>
  );
}
