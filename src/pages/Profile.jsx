import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useBody } from "../context/BodyContext";
import { api, setAccessToken } from "../lib/api";
import { formatPhone } from "../lib/phone";
import { describeError } from "../lib/describeError";

function bmiCategory(value) {
  if (value < 18.5) return { label: "Thiếu cân", color: "text-blue-400 bg-blue-400/10" };
  if (value < 25) return { label: "Bình thường", color: "text-cyan bg-cyan/10" };
  if (value < 30) return { label: "Thừa cân", color: "text-orange-400 bg-orange-400/10" };
  return { label: "Béo phì", color: "text-red-400 bg-red-400/10" };
}

const GENDERS = [
  { value: "male", label: "Nam" },
  { value: "female", label: "Nữ" },
  { value: "other", label: "Khác" },
];
const ACTIVITIES = [
  { value: "sedentary", label: "Ít vận động (làm việc văn phòng)" },
  { value: "light", label: "Nhẹ (tập 1–3 buổi/tuần)" },
  { value: "moderate", label: "Vừa (tập 3–5 buổi/tuần)" },
  { value: "active", label: "Nhiều (tập 6–7 buổi/tuần)" },
  { value: "very_active", label: "Rất nhiều (lao động nặng + tập luyện)" },
];
const GOAL_LABEL = { lose: "giảm cân", gain: "tăng cân", maintain: "giữ cân" };

const fieldClass =
  "w-full rounded-lg border border-line bg-page px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-cyan/50";

const Label = ({ children }) => <label className="block text-xs text-muted mb-1.5">{children}</label>;
const Button = ({ children, ...props }) => (
  <button
    {...props}
    className="bg-cyan hover:bg-cyan/90 disabled:opacity-60 text-cyan-deep text-sm font-bold px-4 py-2.5 rounded-lg transition-colors"
  >
    {children}
  </button>
);

function BodyForm() {
  const { profile, saveProfile } = useBody();
  const [form, setForm] = useState({ gender: "", birthDate: "", heightCm: "", targetWeightKg: "", activityLevel: "" });
  const [state, setState] = useState({ busy: false, error: "", saved: false });

  useEffect(() => {
    if (!profile) return;
    setForm({
      gender: profile.gender ?? "",
      birthDate: profile.birthDate ?? "",
      heightCm: profile.heightCm ?? "",
      targetWeightKg: profile.targetWeightKg ?? "",
      activityLevel: profile.activityLevel ?? "",
    });
  }, [profile]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setState({ busy: true, error: "", saved: false });
    try {
      await saveProfile({
        gender: form.gender || null,
        birthDate: form.birthDate || null,
        heightCm: form.heightCm === "" ? null : Number(form.heightCm),
        targetWeightKg: form.targetWeightKg === "" ? null : Number(form.targetWeightKg),
        activityLevel: form.activityLevel || null,
      });
      setState({ busy: false, error: "", saved: true });
    } catch (err) {
      setState({ busy: false, error: describeError(err), saved: false });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-panel rounded-xl border border-line p-4 sm:p-6">
      <h2 className="font-display font-semibold text-ink mb-4">Thông tin cơ thể</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>Giới tính</Label>
          <select value={form.gender} onChange={set("gender")} className={fieldClass}>
            <option value="">Chưa chọn</option>
            {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
        <div>
          <Label>Ngày sinh</Label>
          <input type="date" value={form.birthDate} onChange={set("birthDate")} min="1900-01-01" className={fieldClass} />
        </div>
        <div>
          <Label>Chiều cao (cm)</Label>
          <input type="number" inputMode="decimal" min={80} max={250} step="0.1" value={form.heightCm} onChange={set("heightCm")} className={fieldClass} />
        </div>
        <div>
          <Label>Cân nặng mục tiêu (kg)</Label>
          <input type="number" inputMode="decimal" min={20} max={400} step="0.1" value={form.targetWeightKg} onChange={set("targetWeightKg")} className={fieldClass} />
        </div>
        <div className="sm:col-span-2">
          <Label>Mức vận động</Label>
          <select value={form.activityLevel} onChange={set("activityLevel")} className={fieldClass}>
            <option value="">Chưa chọn</option>
            {ACTIVITIES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-5">
        <Button type="submit" disabled={state.busy}>{state.busy ? "Đang lưu..." : "Lưu thông tin"}</Button>
        {state.saved && <span className="text-sm text-cyan">Đã lưu.</span>}
        {state.error && <span role="alert" className="text-sm text-red-400">{state.error}</span>}
      </div>
    </form>
  );
}

function TargetForm() {
  const { targetInfo, saveTarget } = useBody();
  const { target, suggestion, missing } = targetInfo;
  const [form, setForm] = useState({ kcal: "", proteinG: "", carbsG: "", fatG: "" });
  const [state, setState] = useState({ busy: false, error: "", saved: false });

  useEffect(() => {
    const src = target ?? suggestion;
    if (src) setForm({ kcal: src.kcal, proteinG: src.proteinG, carbsG: src.carbsG, fatG: src.fatG });
  }, [target, suggestion]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const macroKcal = (Number(form.proteinG) || 0) * 4 + (Number(form.carbsG) || 0) * 4 + (Number(form.fatG) || 0) * 9;

  async function handleSubmit(e) {
    e.preventDefault();
    setState({ busy: true, error: "", saved: false });
    try {
      await saveTarget({
        kcal: Number(form.kcal),
        proteinG: Number(form.proteinG),
        carbsG: Number(form.carbsG),
        fatG: Number(form.fatG),
      });
      setState({ busy: false, error: "", saved: true });
    } catch (err) {
      setState({ busy: false, error: describeError(err), saved: false });
    }
  }

  const missingLabels = { gender: "giới tính", birthDate: "ngày sinh", heightCm: "chiều cao", weight: "cân nặng (nhập ở trang Tiến độ)", activityLevel: "mức vận động" };

  return (
    <form onSubmit={handleSubmit} className="bg-panel rounded-xl border border-line p-4 sm:p-6">
      <h2 className="font-display font-semibold text-ink mb-1">Mục tiêu dinh dưỡng mỗi ngày</h2>
      {suggestion ? (
        <p className="text-sm text-muted mb-4">
          Gợi ý cho mục tiêu {GOAL_LABEL[suggestion.goal]}: <b className="text-ink">{suggestion.kcal} kcal</b>
          {" "}(trao đổi chất cơ bản {suggestion.bmr}, tiêu hao cả ngày {suggestion.tdee} kcal).
          {target ? "" : " Bạn chưa lưu mục tiêu riêng nên hệ thống đang dùng gợi ý này."}
        </p>
      ) : (
        <p className="text-sm text-muted mb-4">
          Để có gợi ý tự động, hãy bổ sung: {missing.map((m) => missingLabels[m] ?? m).join(", ")}. Bạn cũng có thể tự nhập mục tiêu bên dưới.
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div><Label>Calo (kcal)</Label><input required type="number" inputMode="numeric" min={800} max={6000} value={form.kcal} onChange={set("kcal")} className={fieldClass} /></div>
        <div><Label>Protein (g)</Label><input required type="number" inputMode="numeric" min={0} max={500} value={form.proteinG} onChange={set("proteinG")} className={fieldClass} /></div>
        <div><Label>Carbs (g)</Label><input required type="number" inputMode="numeric" min={0} max={1000} value={form.carbsG} onChange={set("carbsG")} className={fieldClass} /></div>
        <div><Label>Chất béo (g)</Label><input required type="number" inputMode="numeric" min={0} max={400} value={form.fatG} onChange={set("fatG")} className={fieldClass} /></div>
      </div>
      {form.kcal !== "" && Math.abs(macroKcal - Number(form.kcal)) > Number(form.kcal) * 0.1 && (
        <p className="text-xs text-orange-400 mt-2">
          Macro hiện cộng lại thành khoảng {macroKcal} kcal, lệch hơn 10% so với mục tiêu calo.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 mt-5">
        <Button type="submit" disabled={state.busy}>{state.busy ? "Đang lưu..." : "Lưu mục tiêu"}</Button>
        {suggestion && (
          <button
            type="button"
            onClick={() => setForm({ kcal: suggestion.kcal, proteinG: suggestion.proteinG, carbsG: suggestion.carbsG, fatG: suggestion.fatG })}
            className="text-sm font-medium text-cyan hover:text-cyan/80"
          >
            Dùng số gợi ý
          </button>
        )}
        {state.saved && <span className="text-sm text-cyan">Đã lưu.</span>}
        {state.error && <span role="alert" className="text-sm text-red-400">{state.error}</span>}
      </div>
    </form>
  );
}

function PasswordForm() {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [state, setState] = useState({ busy: false, error: "", saved: false });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.next.length < 8) return setState({ busy: false, error: "Mật khẩu mới phải có ít nhất 8 ký tự.", saved: false });
    if (form.next !== form.confirm) return setState({ busy: false, error: "Hai mật khẩu mới không khớp.", saved: false });
    setState({ busy: true, error: "", saved: false });
    try {
      const data = await api("/auth/change-password", { method: "POST", body: { currentPassword: form.current, newPassword: form.next } });
      setAccessToken(data.accessToken); // thiết bị này nhận phiên mới; các thiết bị khác bị đăng xuất
      setForm({ current: "", next: "", confirm: "" });
      setState({ busy: false, error: "", saved: true });
    } catch (err) {
      setState({ busy: false, error: describeError(err), saved: false });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-panel rounded-xl border border-line p-4 sm:p-6">
      <h2 className="font-display font-semibold text-ink mb-1">Đổi mật khẩu</h2>
      <p className="text-sm text-muted mb-4">Sau khi đổi, các thiết bị khác sẽ bị đăng xuất.</p>
      <div className="grid sm:grid-cols-3 gap-4">
        <div><Label>Mật khẩu hiện tại</Label><input required type="password" autoComplete="current-password" value={form.current} onChange={set("current")} className={fieldClass} /></div>
        <div><Label>Mật khẩu mới</Label><input required type="password" autoComplete="new-password" value={form.next} onChange={set("next")} className={fieldClass} /></div>
        <div><Label>Nhập lại mật khẩu mới</Label><input required type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} className={fieldClass} /></div>
      </div>
      <div className="flex items-center gap-3 mt-5">
        <Button type="submit" disabled={state.busy}>{state.busy ? "Đang lưu..." : "Đổi mật khẩu"}</Button>
        {state.saved && <span className="text-sm text-cyan">Đã đổi mật khẩu.</span>}
        {state.error && <span role="alert" className="text-sm text-red-400">{state.error}</span>}
      </div>
    </form>
  );
}

function DataSection() {
  const [state, setState] = useState({ busy: false, error: "" });

  async function handleExport() {
    setState({ busy: true, error: "" });
    try {
      const data = await api("/me/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: "latis-du-lieu-cua-toi.json" });
      a.click();
      URL.revokeObjectURL(url);
      setState({ busy: false, error: "" });
    } catch (err) {
      setState({ busy: false, error: describeError(err) });
    }
  }

  return (
    <div className="bg-panel rounded-xl border border-line p-4 sm:p-6">
      <h2 className="font-display font-semibold text-ink mb-1">Dữ liệu của tôi</h2>
      <p className="text-sm text-muted mb-4">
        Tải về toàn bộ dữ liệu của bạn. Nếu muốn xoá tài khoản, hãy liên hệ huấn luyện viên — chỉ quản trị viên mới có quyền xoá tài khoản.
      </p>
      <button onClick={handleExport} disabled={state.busy} className="text-sm font-semibold text-cyan hover:text-cyan/80 disabled:opacity-60">
        Tải dữ liệu (JSON)
      </button>
      {state.error && <p role="alert" className="mt-3 text-sm text-red-400">{state.error}</p>}
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const { status, reload, profile, latestWeight, bmi } = useBody();
  const category = bmi !== null ? bmiCategory(bmi) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-ink">Hồ sơ</h1>
        <p className="text-sm sm:text-base text-muted mt-1">Thông tin cá nhân, chỉ số cơ thể và mục tiêu dinh dưỡng.</p>
      </div>

      {status === "error" && (
        <p className="text-sm text-red-400">
          Không tải được hồ sơ. <button onClick={reload} className="underline">Thử lại</button>
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 lg:order-1 order-2 bg-panel rounded-xl border border-line p-4 sm:p-6">
          <h2 className="font-display font-semibold text-ink mb-4">Thông tin tài khoản</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              ["Họ tên", user.fullName],
              ["Email", user.email],
              ["Số điện thoại", formatPhone(user.phone)],
              ["Cân nặng hiện tại", latestWeight !== null ? `${latestWeight} kg` : "Chưa nhập"],
            ].map(([label, value]) => (
              <div key={label} className="space-y-1">
                <p className="text-xs text-muted uppercase tracking-wide">{label}</p>
                <p className="font-medium text-ink break-words">{value}</p>
              </div>
            ))}
          </div>
          <Link to="/app/progress" className="inline-block mt-6 text-sm font-medium text-cyan hover:text-cyan/80">
            Cập nhật cân nặng tuần này →
          </Link>
        </div>

        <div className="lg:order-2 order-1 bg-panel rounded-xl border border-line p-6 flex flex-col items-center justify-center text-center">
          <p className="text-sm text-muted mb-2">Chỉ số BMI</p>
          {bmi !== null ? (
            <>
              <p className="text-4xl font-display font-bold text-ink">{bmi}</p>
              <span className={`mt-3 text-sm font-medium px-3 py-1 rounded-full ${category.color}`}>{category.label}</span>
            </>
          ) : (
            <p className="text-sm text-muted">
              {profile?.heightCm ? "Hãy nhập cân nặng ở trang Tiến độ." : "Hãy nhập chiều cao và cân nặng để tính BMI."}
            </p>
          )}
        </div>
      </div>

      <BodyForm />
      <TargetForm />
      <PasswordForm />
      <DataSection />
    </div>
  );
}
