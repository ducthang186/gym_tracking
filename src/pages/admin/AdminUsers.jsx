import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, Plus, Search, Trash2 } from "lucide-react";
import ResetLinkBox from "../../components/ResetLinkBox";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { describeError } from "../../lib/describeError";
import { formatDate } from "../../lib/dates";
import { formatPhone } from "../../lib/phone";

const PAGE = 25;
const fieldClass =
  "rounded-lg border border-line bg-page px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-cyan/50";

const STATUS = {
  pending: { label: "Chờ duyệt", cls: "text-orange-400 bg-orange-400/10" },
  active: { label: "Hoạt động", cls: "text-cyan bg-cyan/10" },
  suspended: { label: "Đã khoá", cls: "text-red-400 bg-red-400/10" },
};
const ROLES = { client: "Học viên", coach: "Huấn luyện viên", admin: "Quản trị viên" };
const emptyForm = { fullName: "", email: "", phone: "", role: "client" };

export default function AdminUsers() {
  const { user: me } = useAuth();
  const isAdmin = me.role === "admin";
  const [filter, setFilter] = useState({ q: "", status: "" });
  const [query, setQuery] = useState(filter);
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ users: [], total: 0 });
  const [state, setState] = useState({ loading: true, error: "" });
  const [link, setLink] = useState(null); // { name, link }
  const [deleting, setDeleting] = useState(null); // { user, password, busy, error }
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState({ open: false, busy: false, error: "" });

  // Gõ tìm kiếm: đợi 300 ms rồi mới gọi để không gọi API ở mỗi phím.
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(filter);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [filter]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: String(PAGE), offset: String(page * PAGE) });
    if (query.q.trim()) params.set("q", query.q.trim());
    if (query.status) params.set("status", query.status);
    try {
      setData(await api(`/admin/users?${params}`));
      setState({ loading: false, error: "" });
    } catch (err) {
      setState({ loading: false, error: describeError(err) });
    }
  }, [query, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(fn) {
    setState((s) => ({ ...s, error: "" }));
    try {
      await fn();
      await load();
    } catch (err) {
      setState((s) => ({ ...s, error: describeError(err) }));
    }
  }

  const setStatus = (u, status) => run(() => api(`/admin/users/${u.id}/status`, { method: "PATCH", body: { status } }));
  const setRole = (u, role) => run(() => api(`/admin/users/${u.id}/role`, { method: "PATCH", body: { role } }));
  const issueLink = (u) =>
    run(async () => {
      const res = await api(`/admin/users/${u.id}/reset-link`, { method: "POST" });
      setLink({ name: u.fullName, link: res.resetLink });
    });

  async function handleDelete(e) {
    e.preventDefault();
    setDeleting((d) => ({ ...d, busy: true, error: "" }));
    try {
      await api(`/admin/users/${deleting.user.id}`, { method: "DELETE", body: { password: deleting.password } });
      setDeleting(null);
      await load();
    } catch (err) {
      setDeleting((d) => ({ ...d, busy: false, error: describeError(err) }));
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating((c) => ({ ...c, busy: true, error: "" }));
    try {
      const res = await api("/admin/users", { method: "POST", body: form });
      setLink({ name: form.fullName, link: res.resetLink });
      setForm(emptyForm);
      setCreating({ open: false, busy: false, error: "" });
      await load();
    } catch (err) {
      setCreating((c) => ({ ...c, busy: false, error: describeError(err) }));
    }
  }

  const pages = Math.max(1, Math.ceil(data.total / PAGE));

  const actions = (u) => {
    const self = u.id === me.id;
    return (
      <>
        {isAdmin && !self && u.status === "pending" && <button onClick={() => setStatus(u, "active")} className="text-xs font-semibold text-cyan py-1">Duyệt</button>}
        {isAdmin && !self && u.status === "active" && <button onClick={() => setStatus(u, "suspended")} className="text-xs font-semibold text-red-400 py-1">Khoá</button>}
        {isAdmin && !self && u.status === "suspended" && <button onClick={() => setStatus(u, "active")} className="text-xs font-semibold text-cyan py-1">Mở khoá</button>}
        <button onClick={() => issueLink(u)} className="flex items-center gap-1 text-xs text-muted hover:text-cyan py-1" title="Cấp liên kết đặt lại mật khẩu">
          <KeyRound size={13} />
          Mật khẩu
        </button>
        {isAdmin && !self && (
          <button onClick={() => setDeleting({ user: u, password: "", busy: false, error: "" })} className="flex items-center gap-1 text-xs text-muted hover:text-red-400 py-1" title="Xoá tài khoản">
            <Trash2 size={13} />
            Xoá
          </button>
        )}
      </>
    );
  };

  const roleCell = (u) =>
    isAdmin && u.id !== me.id ? (
      <select value={u.role} onChange={(e) => setRole(u, e.target.value)} className="rounded-md border border-line bg-page px-2 py-1 text-xs text-ink" aria-label={`Vai trò của ${u.fullName}`}>
        {Object.entries(ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    ) : ROLES[u.role];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-ink">Người dùng</h1>
          <p className="text-sm sm:text-base text-muted mt-1">
            {isAdmin ? "Mọi tài khoản trong hệ thống." : "Học viên được gán cho bạn."} Tổng {data.total}.
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setCreating((c) => ({ ...c, open: !c.open }))} className="flex items-center justify-center gap-1.5 bg-cyan hover:bg-cyan/90 text-cyan-deep text-sm font-bold px-4 py-2.5 rounded-lg transition-colors">
            <Plus size={16} />
            Tạo tài khoản
          </button>
        )}
      </div>

      {creating.open && (
        <form onSubmit={handleCreate} className="bg-panel border border-line rounded-xl p-4 sm:p-6">
          <h2 className="font-display font-semibold text-ink mb-1">Tạo tài khoản hộ</h2>
          <p className="text-sm text-muted mb-4">Hệ thống sẽ cấp một liên kết để người đó tự đặt mật khẩu.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input required placeholder="Họ tên" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={fieldClass} />
            <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={fieldClass} />
            <input required type="tel" placeholder="Số điện thoại" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={fieldClass} />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={fieldClass}>
              {Object.entries(ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {creating.error && <p role="alert" className="text-sm text-red-400 mt-3">{creating.error}</p>}
          <button disabled={creating.busy} className="mt-4 bg-cyan hover:bg-cyan/90 disabled:opacity-60 text-cyan-deep text-sm font-bold px-4 py-2.5 rounded-lg">
            {creating.busy ? "Đang tạo..." : "Tạo tài khoản"}
          </button>
        </form>
      )}

      {deleting && (
        <form onSubmit={handleDelete} className="rounded-xl border border-red-400/30 bg-red-400/5 p-4 sm:p-5 space-y-3">
          <p className="text-sm text-red-300">
            Xoá vĩnh viễn <b>{deleting.user.fullName}</b> ({deleting.user.email}) cùng toàn bộ nhật ký ăn, cân nặng, lịch sử tập và ảnh của họ.
            Không thể khôi phục. Nhập <b>mật khẩu của bạn</b> để xác nhận.
          </p>
          <input required autoFocus type="password" autoComplete="current-password" value={deleting.password} onChange={(e) => setDeleting({ ...deleting, password: e.target.value })} placeholder="Mật khẩu của bạn" className={`${fieldClass} w-full sm:max-w-xs`} />
          {deleting.error && <p role="alert" className="text-sm text-red-400">{deleting.error}</p>}
          <div className="flex items-center gap-3">
            <button disabled={deleting.busy} className="bg-red-500 hover:bg-red-500/90 disabled:opacity-60 text-white text-sm font-bold px-4 py-2.5 rounded-lg">
              {deleting.busy ? "Đang xoá..." : "Xoá vĩnh viễn"}
            </button>
            <button type="button" onClick={() => setDeleting(null)} className="text-sm text-muted hover:text-ink">Huỷ</button>
          </div>
        </form>
      )}

      {link && <ResetLinkBox link={link.link} name={link.name} onClose={() => setLink(null)} />}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder="Tìm theo tên, email hoặc số điện thoại"
            value={filter.q}
            onChange={(e) => setFilter({ ...filter, q: e.target.value })}
            className={`${fieldClass} w-full pl-9`}
            aria-label="Tìm người dùng"
          />
        </div>
        <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} className={fieldClass} aria-label="Lọc theo trạng thái">
          <option value="">Mọi trạng thái</option>
          {Object.entries(STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
        </select>
      </div>

      {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}

      {/* Điện thoại: mỗi người một thẻ (bảng 6 cột phải cuộn ngang, rất khó dùng) */}
      <div className="md:hidden space-y-3">
        {data.users.map((u) => (
          <div key={u.id} className="bg-panel border border-line rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {u.role === "client" ? (
                  <Link to={`/admin/users/${u.id}`} className="font-medium text-ink hover:text-cyan break-words">{u.fullName}</Link>
                ) : (
                  <span className="font-medium text-ink break-words">{u.fullName}</span>
                )}
                <p className="text-xs text-muted break-all">{u.email}</p>
                <p className="text-xs text-muted">{formatPhone(u.phone)}</p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${STATUS[u.status].cls}`}>{STATUS[u.status].label}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs text-muted">
              <span>{roleCell(u)}</span>
              <span>{u.latestWeightKg !== null ? `${u.latestWeightKg} kg` : "Chưa có cân nặng"}{u.coachName ? ` · HLV ${u.coachName}` : ""}</span>
            </div>
            <div className="flex items-center gap-4 pt-2 border-t border-line">{actions(u)}</div>
          </div>
        ))}
        {!state.loading && data.users.length === 0 && <p className="text-center text-sm text-muted py-8">Không có người dùng nào phù hợp.</p>}
      </div>

      <div className="hidden md:block bg-panel border border-line rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted text-xs uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">Người dùng</th>
                <th className="px-4 py-3 font-medium">Liên hệ</th>
                <th className="px-4 py-3 font-medium">Vai trò</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">Cân nặng</th>
                <th className="px-4 py-3 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.users.map((u) => {
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-3">
                      {u.role === "client" ? (
                        <Link to={`/admin/users/${u.id}`} className="font-medium text-ink hover:text-cyan">{u.fullName}</Link>
                      ) : (
                        <span className="font-medium text-ink">{u.fullName}</span>
                      )}
                      <p className="text-xs text-muted">Tham gia {formatDate(u.createdAt.slice(0, 10))}{u.coachName ? ` · HLV ${u.coachName}` : ""}</p>
                    </td>
                    <td className="px-4 py-3 text-muted"><p>{u.email}</p><p className="text-xs">{formatPhone(u.phone)}</p></td>
                    <td className="px-4 py-3 text-muted">{roleCell(u)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS[u.status].cls}`}>{STATUS[u.status].label}</span>
                    </td>
                    <td className="px-4 py-3 text-muted">{u.latestWeightKg !== null ? `${u.latestWeightKg} kg` : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                        {actions(u)}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!state.loading && data.users.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">Không có người dùng nào phù hợp.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm text-muted">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-40 hover:text-ink">← Trước</button>
          <span>Trang {page + 1}/{pages}</span>
          <button disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-40 hover:text-ink">Sau →</button>
        </div>
      )}
    </div>
  );
}
