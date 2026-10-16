/** Bật bằng biến môi trường khi build (`VITE_DEMO=true`): giao diện chạy với máy chủ giả trong trình duyệt, không cần API. */
export const DEMO = import.meta.env.VITE_DEMO === "true";

export const DEMO_PASSWORD = "Demo@12345";
export const DEMO_ACCOUNTS = [
  { label: "Học viên", email: "demo-an@demo.example.com", hint: "Nguyễn Văn An — tập đều, có ảnh và check-in", to: "/app" },
  { label: "Huấn luyện viên", email: "demo-coach@demo.example.com", hint: "HLV Minh Tuấn — quản lý 3 học viên", to: "/admin" },
  { label: "Quản trị viên", email: "demo-admin@demo.example.com", hint: "Trung Phạm — toàn quyền, duyệt tài khoản", to: "/admin" },
];
