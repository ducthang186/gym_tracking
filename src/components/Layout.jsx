import { NavLink, Outlet, Link } from "react-router-dom";
import { LayoutDashboard, Utensils, Dumbbell, LineChart, User, Flame, ArrowLeft } from "lucide-react";

const navItems = [
  { to: "/app", label: "Tổng quan", icon: LayoutDashboard, end: true },
  { to: "/app/meal-plan", label: "Lịch ăn", icon: Utensils },
  { to: "/app/workout", label: "Lịch tập", icon: Dumbbell },
  { to: "/app/progress", label: "Tiến độ", icon: LineChart },
  { to: "/app/profile", label: "Hồ sơ", icon: User },
];

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-slate-900 text-slate-200 flex-col sticky top-0 h-screen">
        <Link to="/" className="flex items-center gap-2 px-6 py-5 border-b border-slate-800">
          <Flame className="text-brand-500" size={26} />
          <span className="text-xl font-bold text-white">Trung Phạm Fitness</span>
        </Link>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-slate-800">
          <Link to="/" className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            <ArrowLeft size={13} />
            Về trang giới thiệu
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar — mobile */}
        <header className="lg:hidden sticky top-0 z-40 bg-slate-900 text-white">
          <div className="flex items-center justify-between px-4 h-14">
            <Link to="/" className="flex items-center gap-2">
              <Flame className="text-brand-500" size={22} />
              <span className="font-bold">Trung Phạm Fitness</span>
            </Link>
            <Link to="/" className="text-xs text-slate-400 hover:text-white transition-colors">
              Trang chủ
            </Link>
          </div>
        </header>

        <main className="flex-1 bg-slate-50 pb-20 lg:pb-0">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Bottom tab bar — mobile */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                  isActive ? "text-brand-600" : "text-slate-400"
                }`
              }
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
