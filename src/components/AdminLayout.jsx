import { NavLink, Outlet, Link } from "react-router-dom";
import { LayoutDashboard, Users, Utensils, Dumbbell, UserRound, ArrowLeft, ShieldCheck, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const allNavItems = [
  { to: "/admin", label: "Tổng quan", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "Người dùng", icon: Users },
  { to: "/admin/menu", label: "Thực đơn", icon: Utensils },
  { to: "/admin/workouts", label: "Lịch tập", icon: Dumbbell },
  { to: "/admin/content", label: "Trang giới thiệu", icon: UserRound, roles: ["admin"] },
];

function Logo() {
  return (
    <span className="font-display font-extrabold text-lg leading-none tracking-tight text-ink">
      LATIS
      <span className="block text-[9px] font-extrabold text-cyan tracking-[0.22em] mt-0.5">
        — ADMIN
      </span>
    </span>
  );
}

const ROLE_LABEL = { admin: "Quản trị viên", coach: "Huấn luyện viên" };

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navItems = allNavItems.filter((i) => !i.roles || i.roles.includes(user?.role));

  return (
    <div className="flex min-h-screen bg-page">
      <aside className="hidden lg:flex w-64 shrink-0 bg-page text-muted flex-col sticky top-0 h-screen border-r border-line">
        <Link to="/admin" className="flex items-center gap-2 px-6 py-5 border-b border-line">
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
                  isActive ? "bg-cyan/10 text-cyan" : "text-muted hover:bg-panel hover:text-ink"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-line space-y-2">
          <Link to="/app" className="flex items-center gap-2 text-xs text-muted hover:text-cyan transition-colors">
            <ArrowLeft size={13} />
            Về app học viên
          </Link>
          <Link to="/" className="flex items-center gap-2 text-xs text-muted hover:text-cyan transition-colors">
            <ArrowLeft size={13} />
            Về trang giới thiệu
          </Link>
          <button onClick={logout} className="flex items-center gap-2 text-xs text-muted hover:text-red-400 transition-colors">
            <LogOut size={13} />
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden sticky top-0 z-40 bg-page border-b border-line">
          <div className="flex items-center justify-between px-4 h-14">
            <Link to="/admin">
              <Logo />
            </Link>
            <div className="flex items-center gap-4">
              <Link to="/app" className="text-xs text-muted hover:text-cyan transition-colors">
                App học viên
              </Link>
              <button onClick={logout} className="flex items-center gap-1.5 text-xs text-muted hover:text-red-400 transition-colors">
                <LogOut size={13} />
                Đăng xuất
              </button>
            </div>
          </div>
          <div className="flex overflow-x-auto px-2 pb-2 gap-1">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 ${
                    isActive ? "bg-cyan/10 text-cyan" : "text-muted"
                  }`
                }
              >
                <Icon size={14} />
                {label}
              </NavLink>
            ))}
          </div>
        </header>

        <div className="hidden lg:flex items-center justify-end gap-2 px-6 py-3 border-b border-line text-xs text-muted">
          <ShieldCheck size={14} className="text-cyan" />
          {user?.fullName} · {ROLE_LABEL[user?.role] ?? user?.role}
        </div>

        <main className="flex-1 bg-page">
          <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
