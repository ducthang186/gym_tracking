import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Utensils, Dumbbell, LineChart, User, Flame } from "lucide-react";

const navItems = [
  { to: "/", label: "Tổng quan", icon: LayoutDashboard, end: true },
  { to: "/meal-plan", label: "Lịch ăn", icon: Utensils },
  { to: "/workout", label: "Lịch tập", icon: Dumbbell },
  { to: "/progress", label: "Tiến độ", icon: LineChart },
  { to: "/profile", label: "Hồ sơ", icon: User },
];

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 bg-slate-900 text-slate-200 flex flex-col">
        <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-800">
          <Flame className="text-brand-500" size={26} />
          <span className="text-xl font-bold text-white">GymTrack</span>
        </div>
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
        <div className="px-6 py-4 border-t border-slate-800 text-xs text-slate-500">
          © 2026 GymTrack
        </div>
      </aside>
      <main className="flex-1 bg-slate-50 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
