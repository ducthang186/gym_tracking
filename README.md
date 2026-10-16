# LATIS — Coaching

Website của PT Trung Phạm: trang giới thiệu cho khách hàng tiềm năng, khu vực **học viên** (nhật ký ăn, tính calo,
lịch tập, cân nặng, ảnh trước/sau, check-in tuần) và khu vực **quản trị** cho huấn luyện viên.

Tài liệu thiết kế đầy đủ (kiến trúc, database, xác thực, phân quyền, backup, triển khai): **[system.md](system.md)**.

## Công nghệ

| Phần | Công nghệ |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, React Router, Recharts |
| Backend (`server/`) | Node 24, TypeScript, Fastify, Zod, Kysely |
| Database | PostgreSQL 18, migration bằng SQL thuần (dbmate) |
| Xác thực | Email **hoặc** số điện thoại + mật khẩu (argon2id); access token ngắn hạn + refresh token xoay vòng trong cookie httpOnly |
| Triển khai | Một máy chủ Linux: Docker Compose (Postgres, API, Caddy) — **không dùng dịch vụ bên thứ ba nào** |

## Chức năng

- **Đăng ký / đăng nhập:** email, họ tên, số điện thoại; khoá tài khoản khi nhập sai nhiều lần; đổi mật khẩu; quên mật khẩu → huấn luyện viên cấp liên kết đặt lại; tự tải dữ liệu của mình; **chỉ admin mới xoá được tài khoản**.
- **Dinh dưỡng:** tính calo theo món và gram, ghi nhật ký theo bữa/ngày, mục tiêu calo–macro (tự gợi ý từ hồ sơ), kế hoạch ăn gợi ý.
- **Lịch tập:** giáo án tuần do huấn luyện viên soạn; học viên ghi từng hiệp (mức tạ × số lần), xem lần tập trước.
- **Cơ thể:** cân nặng / vòng eo / % mỡ theo ngày, BMI, biểu đồ kèm trung bình 7 ngày, calo theo tuần–tháng, ảnh trước/sau có so sánh, check-in hàng tuần (có tập hay không + ảnh theo dõi thay đổi) có phản hồi của huấn luyện viên.
- **Quản trị:** duyệt/khoá tài khoản, gán huấn luyện viên, xem tiến độ từng học viên (mọi lần xem đều ghi nhật ký), đặt mục tiêu, quản lý thực đơn–lịch tập–trang giới thiệu, trạng thái hệ thống (dung lượng, tuổi bản backup).

## Chạy trên máy phát triển

Cần Node 24+ và PostgreSQL (`brew install postgresql@18`). Không cần Docker.

```bash
# 1. Database riêng cho dự án (cổng 54329, không đụng Postgres hệ thống) + áp migration + tạo server/.env
cd server && npm install && npm run db:start

# 2. API (http://localhost:3000)
npm run dev

# 3. Giao diện (http://localhost:5173) — terminal khác, ở thư mục gốc
npm install && npm run dev

# 4. Tạo tài khoản quản trị đầu tiên (hỏi mật khẩu ẩn)
cd server && npm run admin:create -- --email ban@example.com --phone 0912345678 --name "Trung Phạm"
```

Dữ liệu mẫu (tuỳ chọn, chỉ dev): `cd server && npm run seed:demo` tạo 1 huấn luyện viên + 6 học viên đủ các trạng thái (hoạt động, tạm dừng, chờ duyệt, bị khoá) kèm cân nặng, nhật ký ăn, lịch tập, check-in và ảnh. Tài khoản `demo-*@demo.example.com`, mật khẩu chung `Demo@12345`. Xoá bằng `npm run seed:demo -- --clean`.

Vite chuyển tiếp `/api` sang API nên trình duyệt chỉ làm việc với một origin — cookie và kiểm tra Origin chạy y như production.

```bash
cd server
npm test            # chạy trên database riêng `latis_test`, không đụng dữ liệu dev
npm run typecheck
npm run db:stop     # dừng Postgres dev       |   npm run db:reset  # XOÁ dữ liệu dev, dựng lại
```

## Bản demo không cần máy chủ (dùng cho Vercel)

`npm run build:demo` (hoặc `npm run dev:demo`) build giao diện với **máy chủ giả chạy trong trình duyệt** (`src/demo/demoApi.js`):
dữ liệu mẫu ngắn gọn, ba nút vào nhanh ở trang đăng nhập (học viên / huấn luyện viên / quản trị viên), mọi thao tác lưu trong
`localStorage` của người xem và có nút "Đặt lại dữ liệu demo". `vercel.json` đã bật chế độ này cho bản đưa lên Vercel.
Bản chạy thật (`npm run build`) không chứa mã demo.

## Cấu trúc

```
src/                 Frontend (pages, components, context, lib)
server/
  src/modules/       auth · account · admin · body · checkins · clients · content · nutrition · photos · workout
  src/lib/           policy.ts (ai được xem dữ liệu của ai), storage.ts, audit.ts ...
  db/migrations/     Schema dạng SQL (đã áp lên production thì không sửa, viết file mới)
  test/              Test tích hợp trên Postgres thật, gồm ma trận phân quyền
ops/                 Backup (mã hoá bằng age), kéo backup về máy bạn, bài tập restore
docker-compose.yml · Caddyfile · .env.production.example     Triển khai production
```

## Triển khai

Xem [system.md mục 16](system.md). Tóm tắt: build frontend (`npm run build`) → chép `dist/` lên máy chủ → `docker compose up -d --build`.
Trước khi mở đăng ký thật, làm hết danh sách ở mục 16.7 (đặc biệt: **thử restore backup**).

## Giấy phép

Mã nguồn riêng tư của dự án LATIS — Coaching.
