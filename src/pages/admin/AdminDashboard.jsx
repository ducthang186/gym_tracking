import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Utensils, Dumbbell, UserCheck, UserRoundCog, AlertTriangle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { describeError } from "../../lib/describeError";

const mb = (bytes) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.max(0.1, bytes / 1e6).toFixed(1)} MB`);

function SystemStatus() {
  const [s, setS] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/admin/system/status").then(setS).catch((err) => setError(describeError(err)));
  }, []);
  if (error) return <p role="alert" className="text-sm text-red-400">{error}</p>;
  if (!s) return null;

  const backupOld = s.backup && (s.backup.ageHours === null || s.backup.ageHours > 36);
  const diskLow = s.diskFreeBytes !== null && s.diskFreeBytes < 2e9;
  return (
    <div className="bg-panel border border-line rounded-xl p-4 sm:p-6">
      <h2 className="font-display font-semibold text-ink mb-4">Trạng thái hệ thống</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
        <div><p className="text-xs text-muted">Cơ sở dữ liệu</p><p className="font-medium text-ink">{mb(s.databaseBytes)}</p></div>
        <div><p className="text-xs text-muted">Ảnh đã lưu</p><p className="font-medium text-ink">{mb(s.storageBytes)}</p></div>
        <div><p className="text-xs text-muted">Đĩa còn trống</p><p className={`font-medium ${diskLow ? "text-red-400" : "text-ink"}`}>{s.diskFreeBytes === null ? "—" : mb(s.diskFreeBytes)}</p></div>
        <div>
          <p className="text-xs text-muted">Bản backup mới nhất</p>
          <p className={`font-medium ${backupOld ? "text-red-400" : "text-ink"}`}>
            {s.backup === null ? "Chưa cấu hình" : s.backup.ageHours === null ? "Không tìm thấy" : `${s.backup.ageHours} giờ trước`}
          </p>
        </div>
      </div>
      {(backupOld || s.backup === null || diskLow) && (
        <p className="flex items-start gap-2 text-xs text-orange-400 mt-4">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          {s.backup === null
            ? "Chưa cấu hình BACKUP_DIR nên hệ thống không biết tình trạng backup. Dữ liệu chưa backup là dữ liệu có thể mất."
            : backupOld ? "Bản backup đã cũ hơn 36 giờ hoặc không tìm thấy — hãy kiểm tra tác vụ backup." : "Đĩa sắp đầy."}
        </p>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/admin/stats").then(setStats).catch((err) => setError(describeError(err)));
  }, []);

  const cards = stats
    ? [
        { label: user.role === "admin" ? "Tổng tài khoản" : "Học viên của tôi", value: stats.users.total, icon: Users },
        { label: "Đang hoạt động", value: stats.users.active, icon: UserCheck },
        { label: "Chờ duyệt", value: stats.users.pending, icon: UserRoundCog },
        { label: "Món trong thực đơn", value: stats.foods, icon: Utensils },
        { label: "Buổi tập đã lên", value: `${stats.workoutDays}/7`, icon: Dumbbell },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-ink">Tổng quan quản trị</h1>
        <p className="text-sm sm:text-base text-muted mt-1">Quản lý học viên, thực đơn và lịch tập của hệ thống LATIS.</p>
      </div>

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-panel border border-line rounded-xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center shrink-0 bg-cyan/10 text-cyan">
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted leading-tight">{label}</p>
              <p className="text-lg sm:text-xl font-display font-bold text-ink">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {stats && stats.users.pending > 0 && user.role === "admin" && (
        <Link to="/admin/users" className="block bg-orange-400/10 border border-orange-400/30 rounded-xl p-4 text-sm text-orange-300 hover:border-orange-400/60">
          Có {stats.users.pending} tài khoản đang chờ duyệt →
        </Link>
      )}

      {user.role === "admin" && <SystemStatus />}

      <div className="grid sm:grid-cols-3 gap-3.5">
        <Link to="/admin/users" className="bg-panel border border-line rounded-xl p-5 hover:border-cyan/40 transition-colors">
          <Users size={20} className="text-cyan mb-3" />
          <h3 className="font-display font-semibold text-ink mb-1">Quản lý người dùng</h3>
          <p className="text-xs text-muted">Duyệt tài khoản, gán huấn luyện viên, xem tiến độ và cấp liên kết đặt lại mật khẩu.</p>
        </Link>
        <Link to="/admin/menu" className="bg-panel border border-line rounded-xl p-5 hover:border-cyan/40 transition-colors">
          <Utensils size={20} className="text-cyan mb-3" />
          <h3 className="font-display font-semibold text-ink mb-1">Quản lý thực đơn</h3>
          <p className="text-xs text-muted">Thêm món ăn mới vào bộ tính calo mà học viên đang dùng.</p>
        </Link>
        <Link to="/admin/workouts" className="bg-panel border border-line rounded-xl p-5 hover:border-cyan/40 transition-colors">
          <Dumbbell size={20} className="text-cyan mb-3" />
          <h3 className="font-display font-semibold text-ink mb-1">Quản lý lịch tập</h3>
          <p className="text-xs text-muted">Cập nhật bài tập theo từng ngày trong tuần cho học viên.</p>
        </Link>
      </div>
    </div>
  );
}
