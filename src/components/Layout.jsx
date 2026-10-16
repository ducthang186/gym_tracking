import { NavLink, Outlet, Link } from "react-router-dom";
import { LayoutDashboard, Utensils, Dumbbell, LineChart, ClipboardCheck, User, ArrowLeft, ShieldCheck, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/app", label: "Hôm nay", icon: LayoutDashboard, end: true },
  { to: "/app/meal-plan", label: "Dinh dưỡng", icon: Utensils },
  { to: "/app/workout", label: "Lịch tập", icon: Dumbbell },
  { to: "/app/progress", label: "Tiến độ", icon: LineChart },
  { to: "/app/check-in", label: "Check-in", icon: ClipboardCheck },
  { to: "/app/profile", label: "Hồ sơ", icon: User },
];

function Logo() {
  return (
    <span className="font-display font-extrabold text-lg leading-none tracking-tight text-ink">
      LATIS
      <span className="block text-[9px] font-extrabold text-cyan tracking-[0.22em] mt-0.5">
        — COACHING
      </span>
    </span>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const canAdmin = user?.role === "admin" || user?.role === "coach";

  return (
    <div className="flex min-h-screen bg-page">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-page text-muted flex-col sticky top-0 h-screen border-r border-line">
        <Link to="/" className="flex items-center gap-2 px-6 py-5 border-b border-line">
          <Logo />
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
                    ? "bg-cyan/10 text-cyan"
                    : "text-muted hover:bg-panel hover:text-ink"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-line space-y-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink truncate">{user?.fullName}</p>
            <p className="text-xs text-muted truncate">{user?.email}</p>
          </div>
          <div className="space-y-2">
            {canAdmin && (
              <Link to="/admin" className="flex items-center gap-2 text-xs text-muted hover:text-cyan transition-colors">
                <ShieldCheck size={13} />
                Khu vực quản trị
              </Link>
            )}
            <Link to="/" className="flex items-center gap-2 text-xs text-muted hover:text-cyan transition-colors">
              <ArrowLeft size={13} />
              Về trang giới thiệu
            </Link>
            <button onClick={logout} className="flex items-center gap-2 text-xs text-muted hover:text-red-400 transition-colors">
              <LogOut size={13} />
              Đăng xuất
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar — mobile */}
        <header className="lg:hidden sticky top-0 z-40 bg-page border-b border-line">
          <div className="flex items-center justify-between px-4 h-14">
            <Link to="/">
              <Logo />
            </Link>
            <div className="flex items-center gap-4">
              {canAdmin && (
                <Link to="/admin" className="text-xs text-muted hover:text-cyan transition-colors">
                  Quản trị
                </Link>
              )}
              <button onClick={logout} className="flex items-center gap-1.5 text-xs text-muted hover:text-red-400 transition-colors">
                <LogOut size={13} />
                Đăng xuất
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 bg-page pb-20 lg:pb-0">
          <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Bottom tab bar — mobile */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-panel border-t border-line pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-6">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium min-w-0 transition-colors ${
                  isActive ? "text-cyan" : "text-muted"
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
