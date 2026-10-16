# LATIS — Thiết kế hệ thống và cơ sở dữ liệu

> **Phiên bản 3 — tự viết backend, không dùng dịch vụ bên thứ ba.**
>
> Tài liệu kỹ thuật cho giai đoạn chuyển từ prototype (dữ liệu mẫu trong `localStorage`)
> sang hệ thống thật có API, database, đăng nhập và phân quyền do bạn tự xây dựng.
>
> Quy mô mục tiêu: **200–500 người dùng ở mức cực điểm**, nghiệp vụ chính là
> **tính calo / nhật ký ăn** và **lịch tập**.

### Ràng buộc thiết kế

**Không đăng ký thêm bất kỳ dịch vụ bên thứ ba nào.** Toàn bộ hệ thống là phần mềm mã nguồn mở chạy
trên **một máy chủ Linux** do bạn quản lý. Hệ quả, và cách xử lý từng việc, nằm ở
[mục 1](#1-kết-luận-nhanh):

- Không lưu trữ đám mây (S3/R2) → ảnh nằm trên ổ đĩa máy chủ
- Không gửi email, không SMS → không xác thực email/SĐT; quên mật khẩu do coach/admin cấp link
- Không CAPTCHA, không dịch vụ giám sát, không CDN, không đăng nhập Google/Facebook
- Backup ra ngoài máy chủ bằng cách **máy tính của bạn chủ động kéo về** qua SSH

Hai thứ duy nhất nằm ngoài phần mềm: **máy chủ** (máy Linux bạn sẵn có hoặc thuê) và **tên miền**
(cần để có HTTPS). Chứng chỉ HTTPS do Let's Encrypt cấp tự động thông qua Caddy — bạn không phải tạo
tài khoản ở đâu cả.

> **Giả định:** backend viết bằng **Node.js + TypeScript** (frontend đã là React/JS nên dùng chung
> ngôn ngữ và kiểu dữ liệu). Nếu bạn dùng ngôn ngữ khác (Python/FastAPI, Go, PHP/Laravel), phần
> **schema, luồng xác thực, phân quyền, ảnh, backup và triển khai vẫn giữ nguyên** — chỉ thay thư viện.

---

## Mục lục

- [1. Kết luận nhanh](#1-kết-luận-nhanh)
- [2. Phân tích quy mô](#2-phân-tích-quy-mô)
- [3. Kiến trúc hệ thống](#3-kiến-trúc-hệ-thống)
- [4. So sánh các phương án công nghệ](#4-so-sánh-các-phương-án-công-nghệ)
- [5. Thiết kế cơ sở dữ liệu](#5-thiết-kế-cơ-sở-dữ-liệu)
- [6. Bảy quyết định thiết kế quan trọng](#6-bảy-quyết-định-thiết-kế-quan-trọng)
- [7. Index và các truy vấn chính](#7-index-và-các-truy-vấn-chính)
- [8. Xác thực và phân quyền](#8-xác-thực-và-phân-quyền)
- [9. Lưu trữ ảnh tiến độ](#9-lưu-trữ-ảnh-tiến-độ)
- [10. Thiết kế API](#10-thiết-kế-api)
- [11. Logic tính toán đặt ở đâu](#11-logic-tính-toán-đặt-ở-đâu)
- [12. Những gì không nên làm ở quy mô này](#12-những-gì-không-nên-làm-ở-quy-mô-này)
- [13. Lộ trình xây dựng backend](#13-lộ-trình-xây-dựng-backend)
- [14. Chi phí vận hành](#14-chi-phí-vận-hành)
- [15. Backup, bảo mật và dữ liệu sức khỏe](#15-backup-bảo-mật-và-dữ-liệu-sức-khỏe)
- [16. Triển khai lên production](#16-triển-khai-lên-production)
- [17. Ghi chú thêm](#17-ghi-chú-thêm)

---

## 1. Kết luận nhanh

| Thành phần | Lựa chọn | Lý do ngắn |
|---|---|---|
| Backend | **Node.js + TypeScript + Fastify** (một ứng dụng, chia module) | Cùng ngôn ngữ với frontend; có sẵn plugin cookie, rate limit, header bảo mật |
| Validate đầu vào | **Zod** ở mọi endpoint | Một schema cho cả validate và kiểu TypeScript |
| Database | **PostgreSQL 18** | Dữ liệu quan hệ, cần `SUM`/`GROUP BY` theo ngày. Dev dùng bản cài sẵn trên máy; production chạy bằng Docker cùng phiên bản chính |
| Truy cập DB | **Kysely** (query builder có kiểu) + **dbmate** (migration bằng file SQL) | SQL vẫn là nguồn sự thật; không ORM che khuất truy vấn |
| Xác thực | **Tự xây**: mật khẩu **argon2id**; access token **JWT 15 phút** (giữ trong bộ nhớ); refresh token **ngẫu nhiên, xoay vòng, trong cookie httpOnly** | Token không nằm trong `localStorage` (chống XSS đánh cắp) |
| Phân quyền | **Tầng ứng dụng**: một module `policy` tập trung + kiểm thử tự động | Thay cho Row Level Security — xem [mục 8](#8-xác-thực-và-phân-quyền) |
| Lưu ảnh | **Ổ đĩa máy chủ** (thư mục riêng, không public), phục vụ qua API sau khi kiểm tra quyền; xử lý bằng `sharp` | Không cần dịch vụ lưu trữ ngoài |
| Hosting | **1 máy chủ Linux** chạy Docker Compose: **Caddy** (HTTPS tự động) + API + Postgres | Một origin duy nhất → không CORS, cookie đơn giản |
| Frontend | **Giữ React + Vite**, thêm **TanStack Query**; Caddy phục vụ file tĩnh | Không cần Vercel/GitHub Pages khi chạy thật |
| Backup | `pg_dump` mỗi 6 giờ, mã hoá bằng `age`; **máy tính của bạn kéo về** bằng `rsync` | Có bản sao ngoài máy chủ mà không cần dịch vụ đám mây |
| Chi phí | **0đ dịch vụ**; chỉ máy chủ + tên miền | Chi tiết ở [mục 14](#14-chi-phí-vận-hành) |

### Những thứ thường dùng dịch vụ ngoài — và cách thay thế ở đây

| Nhu cầu | Cách thông thường | Cách thay thế trong thiết kế này | Đánh đổi |
|---|---|---|---|
| Lưu ảnh | S3 / R2 | Ổ đĩa máy chủ, phục vụ qua API | Ảnh gắn với một máy chủ; phải tự backup; đĩa có hạn |
| Xác thực email | Dịch vụ gửi email | **Không xác thực.** Email chỉ là tên đăng nhập do học viên khai | Có thể đăng ký bằng email của người khác → xem mục 8 |
| Xác thực số điện thoại | SMS OTP | **Không xác thực.** SĐT dùng để liên hệ và định danh | Coach tự xác nhận bằng cách gọi/nhắn khi cần |
| Quên mật khẩu | Link gửi qua email | **Admin/coach cấp link đặt lại dùng một lần**, tự gửi cho học viên qua Zalo/điện thoại | Phải có người can thiệp; hợp lý với dịch vụ coaching nơi coach quen học viên |
| Chống bot đăng ký | CAPTCHA | Giới hạn tốc độ + trường bẫy (honeypot) + tuỳ chọn **duyệt tay** tài khoản mới | Duyệt tay tốn thao tác của coach |
| Backup ngoài máy chủ | Bucket đám mây | Máy tính của bạn chủ động kéo về qua SSH | Phụ thuộc máy bạn bật và chạy đều |
| Cảnh báo sập / backup hỏng | Dịch vụ giám sát | Script trên máy bạn kiểm tra và bật thông báo hệ điều hành; trang admin hiển thị tuổi backup | Chỉ cảnh báo khi máy bạn đang bật |
| HTTPS | Cloudflare / dịch vụ SSL | Caddy + Let's Encrypt | Cần tên miền trỏ đúng về máy chủ |
| Đăng nhập Google | Google OAuth | Không có | — |

### Bạn được gì và mất gì khi tự viết backend

| Mất so với dùng nền tảng có sẵn | Được |
|---|---|
| **Lưới an toàn Row Level Security.** Quên kiểm tra quyền ở một endpoint = lộ dữ liệu người khác. Đây là lỗi phổ biến nhất của API tự viết | Không phí dịch vụ, không giới hạn dung lượng, không bị tạm dừng |
| Backup được quản lý — phải tự dựng và **tự thử restore** | Không bị khoá vào nhà cung cấp; logic nghiệp vụ tự do |
| Auth có sẵn — phải tự viết và chịu trách nhiệm bảo mật | Dữ liệu sức khỏe của khách nằm hoàn toàn dưới quyền bạn |
| Hạ tầng được vá lỗi hộ — phải tự vá máy chủ | |
| Thời gian: ước tính thô **~20–26 ngày làm việc** | |

**Nguyên tắc xuyên suốt:** ở quy mô này, rủi ro lớn nhất **không phải** hệ thống quá tải mà là
(1) **lỗi phân quyền / bảo mật** do tự viết, và (2) **over-engineering**. Thiết kế cố tình đơn giản:
**một ứng dụng, một database, một máy chủ**.

---

## 2. Phân tích quy mô

Tính theo trường hợp xấu nhất (**500 người dùng đồng thời**, không phải 500 tổng số user):

| Chỉ số | Ước tính | Nhận xét |
|---|---|---|
| Request lúc cao điểm | 500 user × 1 hành động/10 giây ≈ **50 req/s** | Một API Fastify xử lý được hàng nghìn req/s cho truy vấn đơn giản → **dư rất nhiều** |
| Ghi nhật ký ăn | 500 user × 20 dòng/ngày = **10.000 dòng/ngày** | ~3,65 triệu dòng/năm |
| Dung lượng DB | ~230 byte/dòng gồm index → **~0,8 GB/năm** ở mức cực điểm | Đĩa 25–60 GB dư nhiều năm |
| Truy vấn nặng nhất | `SUM()` 20–30 dòng của 1 user trong 1 ngày | Có index `(user_id, logged_on)` → **dưới 1 ms** |
| **Ảnh tiến độ** | 500 user × 3 góc × 12 tuần × ~300 KB ≈ **5,4 GB cho mỗi chu kỳ 12 tuần** (≈ 20 GB/năm nếu chụp hằng tuần quanh năm) | **Đây là thứ quyết định kích thước ổ đĩa** — xem bên dưới |
| Kết nối DB | 1 instance API × pool 10 kết nối | Postgres mặc định cho 100 kết nối → **không cần PgBouncer** |
| Hash mật khẩu | argon2id ~100–300 ms CPU mỗi lần đăng nhập | Chỉ phát sinh lúc đăng nhập/đăng ký |

**Vì ảnh nằm trên ổ đĩa máy chủ**, cần chính sách để đĩa không đầy:
- Nén ảnh ở server về cạnh dài 1600 px, JPEG ~80 (khoảng 250–400 KB)
- Chỉ cho phép **1 ảnh cho mỗi góc mỗi tuần**; cho học viên xoá ảnh cũ
- Đề xuất chính sách lưu giữ: học viên kết thúc khoá thì giữ ảnh mốc **đầu – giữa – cuối**, xoá phần còn lại sau 6–12 tháng (cần báo trước cho học viên)
- Chọn đĩa **≥ 60 GB**, đặt cảnh báo khi dùng quá 80%

**Hệ quả vận hành của "một instance":** rate limit giữ trong bộ nhớ, bộ lập lịch chạy trong tiến
trình API. Chỉ đúng khi chạy **đúng 1 instance** — đủ cho quy mô này.

---

## 3. Kiến trúc hệ thống

```text
┌─────────────────────────────────────────────────────────────┐
│  TRÌNH DUYỆT / ĐIỆN THOẠI                                   │
│  React SPA (Vite) + TanStack Query                           │
│  · access token JWT giữ trong BỘ NHỚ (biến JS)               │
│  · refresh token nằm trong cookie httpOnly (JS không đọc được)│
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS   https://latis.vn  (một origin)
┌──────────────────────────▼──────────────────────────────────┐
│  MÁY CHỦ LINUX — Docker Compose                              │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Caddy  (cổng 80/443, tự cấp HTTPS bằng Let's Encrypt)   │ │
│  │   /api/*  ──► reverse proxy ──► api:3000                │ │
│  │   còn lại ──► phục vụ file tĩnh của SPA (dist/)         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ API  (Node.js + Fastify)        — modular monolith      │ │
│  │   auth · users · foods · food-log · nutrition          │ │
│  │   workouts · body-metrics · checkins · photos · admin  │ │
│  │   bộ lập lịch (setInterval): dọn token hết hạn         │ │
│  └───────┬─────────────────────────────┬──────────────────┘ │
│  ┌───────▼────────┐          ┌─────────▼───────────────┐    │
│  │ PostgreSQL 18  │          │ Ổ ĐĨA MÁY CHỦ            │    │
│  │ KHÔNG mở cổng  │          │ /var/lib/latis/storage    │    │
│  │ ra ngoài       │          │ /var/backups/latis       │    │
│  └────────────────┘          └─────────────────────────┘    │
└───────────────────────────────────▲──────────────────────────┘
                                    │ rsync qua SSH (máy bạn chủ động KÉO)
                          ┌─────────┴───────────┐
                          │ MÁY TÍNH CỦA BẠN     │  giữ bản sao ngoài máy chủ
                          └─────────────────────┘
```

### Vì sao một origin duy nhất

Caddy phục vụ cả SPA lẫn `/api` dưới cùng domain `latis.vn`. Hệ quả:
- **Không có CORS** — bớt một nguồn lỗi cấu hình (CORS sai là lỗ hổng phổ biến)
- Cookie refresh token dùng `SameSite=Lax` được, giảm rủi ro CSRF
- Môi trường dev cũng giống vậy nhờ proxy của Vite (xem [mục 13](#13-lộ-trình-xây-dựng-backend))

### Cấu trúc thư mục backend

Đặt thành thư mục `server/` ngay trong repo hiện tại (có `package.json` riêng):

```text
server/
├── src/
│   ├── server.ts                 # khởi động Fastify
│   ├── app.ts                    # buildApp(): đăng ký plugin + route (dùng chung cho test)
│   ├── config/env.ts             # đọc + validate biến môi trường bằng Zod, thiếu là không khởi động
│   ├── db/
│   │   ├── index.ts              # kết nối Kysely, pool tối đa 10
│   │   └── types.ts              # kiểu bảng (sinh bằng kysely-codegen khi schema lớn dần)
│   ├── jobs/                     # job nền chạy trong tiến trình API (dọn token hết hạn)
│   ├── modules/
│   │   ├── auth/                 # routes · service · repo · schemas · password · tokens · phone   ← đã có
│   │   ├── users/  foods/  food-log/  nutrition/  workouts/                                       ← chưa có
│   │   ├── body-metrics/  checkins/  photos/  admin/                                              ← chưa có
│   ├── lib/
│   │   ├── errors.ts             # AppError và các lỗi có mã HTTP
│   │   ├── policy.ts             # TẤT CẢ quyết định phân quyền nằm ở đây
│   │   ├── audit.ts              # ghi audit_log
│   │   ├── storage.ts            # đọc/ghi ảnh trên đĩa
│   │   └── calc.ts               # BMI, BMR, TDEE
│   └── scripts/create-admin.ts   # tạo admin đầu tiên
├── db/
│   ├── migrations/               # file SQL của dbmate
│   └── init/01-roles.sh          # tạo role ứng dụng quyền hạn chế
├── scripts/dev-db.sh             # dựng Postgres cục bộ cho dev
└── test/                         # kiểm thử tích hợp chạy với Postgres thật
```

Mỗi module gồm `routes` (nhận request, validate), `service` (nghiệp vụ), `repo` (truy vấn SQL).
**Chỉ `repo` được đụng vào database.**

---

## 4. So sánh các phương án công nghệ

### 4.1 Kiến trúc tổng thể

| Phương án | Ưu | Nhược | Quyết định |
|---|---|---|---|
| **A. API tự viết + Postgres tự host trên một máy chủ** | Không phụ thuộc ai; không giới hạn dung lượng | Tự backup, tự vá máy chủ | ✅ **Chọn** |
| B. Nền tảng backend có sẵn (Supabase, Firebase...) | Auth, storage có sẵn | Phải đăng ký dịch vụ — **vi phạm ràng buộc** | ❌ Loại |
| C. Postgres do dịch vụ ngoài quản lý (Neon...) | Bớt việc vận hành DB | Phải đăng ký dịch vụ — vi phạm ràng buộc | ❌ Loại |
| D. NoSQL (Firestore, MongoDB) | Linh hoạt schema | Sai mô hình cho tổng calo theo ngày, join món ăn ↔ nhật ký, báo cáo theo tuần — dễ sai lệch số liệu | ❌ Không nên |

### 4.2 Công nghệ backend

| Hạng mục | Chọn | Lựa chọn thay thế | Khi nào dùng cái khác |
|---|---|---|---|
| Ngôn ngữ | **TypeScript** | JavaScript thuần | Không nên: bắt lỗi sai tên cột lúc compile là giá trị lớn nhất khi tự viết backend |
| Framework | **Fastify** | Express | Express quen hơn nhưng thiếu validate và hiệu năng sẵn có; vẫn dùng được |
| | | NestJS | Quá nặng cho một người làm một mình |
| Truy cập DB | **Kysely** + **dbmate** | Drizzle ORM | Nếu thích định nghĩa schema bằng TypeScript thay vì SQL |
| | | Prisma | Hỗ trợ kém `CHECK`, index từng phần, index GIN — phải viết SQL tay anyway |
| Validate | **Zod** | Valibot, TypeBox | Tuỳ sở thích |
| Hash mật khẩu | **argon2** (id) | bcrypt | bcrypt vẫn chấp nhận được; argon2id là khuyến nghị hiện nay của OWASP |
| JWT | **jose** | jsonwebtoken | Cả hai dùng được; `jose` được bảo trì tích cực, API rõ ràng hơn |
| Xử lý ảnh | **sharp** | — | Xoá EXIF, xoay đúng chiều, resize, nén |
| Log | **pino** (có sẵn trong Fastify) | — | Cấu hình `redact` để không log mật khẩu/token |
| Kiểm thử | **Vitest** + `fastify.inject()` | Jest | Vitest chạy TypeScript/ESM sẵn, không cần cấu hình thêm |

### 4.3 Nơi đặt máy chủ

| Phương án | Ưu | Nhược |
|---|---|---|
| **VPS thuê** (chọn khi chạy thật) | IP công khai ổn định, hoạt động 24/7, có sẵn bản ghi mạng | Là chi phí duy nhất của hệ thống; đĩa nhỏ thì phải trả thêm |
| Máy tại nhà / văn phòng (mini PC) | Không trả phí thuê | Cần IP công khai và mở cổng — **một số nhà mạng không cấp** (dùng chung IP / NAT); mất điện, mất mạng là sập; IP đổi thì tên miền trỏ sai |
| Serverless / PaaS | Không quản lý máy | Phải đăng ký dịch vụ; serverless không hợp với Postgres (mỗi hàm mở kết nối riêng, cold start) |

Trong lúc phát triển, mọi thứ chạy ngay trên máy của bạn — chưa cần chọn dòng này.

---

## 5. Thiết kế cơ sở dữ liệu

SQL dưới đây chạy được trực tiếp trên PostgreSQL 13+ (đã kiểm chứng trên 18). Lưu thành các file
trong `server/db/migrations/` theo định dạng dbmate (xem [mục 16](#16-triển-khai-lên-production)):

```sql
-- migrate:up
...nội dung SQL...

-- migrate:down
...câu lệnh hoàn tác...
```

### 5.1 Tài khoản và phân quyền

**Tách `users` (thông tin đăng nhập) khỏi `profiles` (thông tin cá nhân/sức khỏe).** Lý do:
`password_hash` nằm ở bảng riêng nên một câu `SELECT *` bất cẩn trên bảng hồ sơ không bao giờ làm
rò mật khẩu ra response.

```sql
create extension if not exists citext;

create type user_role      as enum ('client', 'coach', 'admin');
create type account_status as enum ('pending', 'active', 'suspended');
create type client_status  as enum ('active', 'paused', 'ended');

create table users (
  id            uuid primary key default gen_random_uuid(),
  email         citext unique not null,        -- citext: không phân biệt hoa thường
  phone         text   unique not null,        -- E.164 đã chuẩn hoá, vd '+84912345678'
  password_hash text   not null,               -- argon2id, đã chứa salt + tham số
  role          user_role      not null default 'client',
  status        account_status not null default 'active',   -- 'pending' khi bật duyệt tay
  failed_logins smallint       not null default 0,
  locked_until  timestamptz,
  last_login_at timestamptz,
  created_at    timestamptz    not null default now(),
  constraint users_phone_format check (phone ~ '^\+84[35789][0-9]{8}$')
);

create table profiles (
  id         uuid primary key references users(id) on delete cascade,  -- dùng chung khoá với users
  full_name  text          not null,
  avatar_key text,                                  -- đường dẫn tương đối trong thư mục lưu trữ
  gender     text check (gender in ('male','female','other')),
  birth_date date,
  height_cm  numeric(5,1),
  timezone   text          not null default 'Asia/Ho_Chi_Minh',
  coach_id   uuid          references profiles(id) on delete set null,
  status     client_status not null default 'active',
  package    text,          -- 'starter' | 'coaching_1on1' | 'custom'
  created_at timestamptz   not null default now()
);
```

> **Email và số điện thoại đều chưa được xác thực** (không có dịch vụ gửi email/SMS). Hệ thống chỉ
> đảm bảo chúng **duy nhất và đúng định dạng**, không đảm bảo người đăng ký sở hữu chúng.
> Ràng buộc `CHECK` ở `phone` buộc mọi số lưu vào DB đều ở dạng chuẩn `+84` + đầu số di động
> (`3, 5, 7, 8, 9`) + 8 chữ số.
>
> `profiles.id = users.id` (cùng một UUID) nên mọi bảng bên dưới chỉ cần `references profiles(id)`.
>
> Khoá ngoại **không kiểm tra được** người được trỏ tới bằng `coach_id` có `role = 'coach'` hay
> không — việc này phải kiểm tra trong code khi gán coach (và có test).
>
> Nếu sau này một học viên có **nhiều** coach, tách bảng `coach_clients(coach_id, client_id,
> started_at)`. Hiện tại một cột `coach_id` là đủ.

### 5.2 Phiên đăng nhập, link đặt lại mật khẩu và nhật ký truy cập

```sql
-- Refresh token. CHỈ lưu hash SHA-256, không bao giờ lưu token gốc.
create table refresh_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  family_id  uuid not null,            -- cả chuỗi xoay vòng của MỘT lần đăng nhập
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,              -- đã được đổi lấy token mới
  revoked_at timestamptz,
  user_agent text,
  ip         inet,
  created_at timestamptz not null default now()
);

-- Link đặt lại mật khẩu do admin/coach cấp (dùng một lần). Không có email nên không có loại khác.
create type auth_token_type as enum ('reset_password');

create table auth_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  type       auth_token_type not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_by uuid references users(id) on delete set null,   -- admin/coach đã cấp link
  created_at timestamptz not null default now()
);

-- Nhật ký truy cập: ai (coach/admin) đã đọc hoặc sửa dữ liệu của học viên nào.
create table audit_log (
  id             bigint generated always as identity primary key,
  actor_id       uuid references users(id) on delete set null,
  target_user_id uuid references users(id) on delete set null,
  action         text not null,    -- 'read:food_log', 'login_failed', 'reset_link_issued'...
  meta           jsonb,
  ip             inet,
  created_at     timestamptz not null default now()
);
```

`audit_log` có hai việc: phát hiện coach/admin xem dữ liệu không đúng chỗ, và là bằng chứng cho
yêu cầu minh bạch về xử lý dữ liệu cá nhân ([mục 15](#15-backup-bảo-mật-và-dữ-liệu-sức-khỏe)).

### 5.3 Chỉ số cơ thể (chuỗi thời gian)

```sql
create table body_metrics (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references profiles(id) on delete cascade,
  measured_on  date not null,
  weight_kg    numeric(5,2),
  body_fat_pct numeric(4,1),
  waist_cm     numeric(5,1),
  chest_cm     numeric(5,1),
  hip_cm       numeric(5,1),
  note         text,
  created_at   timestamptz not null default now(),
  unique (user_id, measured_on)   -- mỗi ngày 1 bản ghi → nhập lại là UPDATE
);
```

Ràng buộc `unique` cho phép upsert, tránh trường hợp cân 3 lần/ngày tạo 3 dòng rồi biểu đồ bị gãy:

```sql
insert into body_metrics (user_id, measured_on, weight_kg)
values ($1, $2, $3)
on conflict (user_id, measured_on)
do update set weight_kg = excluded.weight_kg;
```

### 5.4 Mục tiêu dinh dưỡng — có phiên bản theo thời gian

```sql
create table nutrition_targets (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references profiles(id) on delete cascade,
  effective_from date not null,          -- áp dụng từ ngày này
  kcal           int  not null,
  protein_g      int  not null,
  carbs_g        int  not null,
  fat_g          int  not null,
  set_by         uuid references profiles(id),  -- coach nào điều chỉnh
  note           text,                          -- 'giảm 200 kcal vì cân đứng 2 tuần'
  created_at     timestamptz not null default now(),
  unique (user_id, effective_from)
);
```

### 5.5 Thực phẩm

```sql
create table foods (
  id               uuid primary key default gen_random_uuid(),
  name             text    not null,
  brand            text,
  kcal_per100g     numeric(6,1) not null,   -- "per100g" liền nhau: khớp quy tắc CamelCasePlugin (xem mục 13)
  protein_per100g  numeric(5,1) not null default 0,
  carbs_per100g    numeric(5,1) not null default 0,
  fat_per100g      numeric(5,1) not null default 0,
  serving_label    text,            -- '1 quả vừa', '1 muỗng canh'
  serving_grams    numeric(6,1),    -- 120 → user chọn "1 quả" thay vì tự đoán gram
  is_public        boolean not null default true,   -- admin tạo = dùng chung
  created_by       uuid references profiles(id),
  is_archived      boolean not null default false,  -- XOÁ MỀM
  created_at       timestamptz not null default now()
);
```

### 5.6 Nhật ký ăn — bảng quan trọng nhất của hệ thống

```sql
create type meal_slot as enum ('breakfast', 'lunch', 'dinner', 'snack');

create table food_log_entries (
  id                bigint generated always as identity primary key,
  user_id           uuid      not null references profiles(id) on delete cascade,
  logged_on         date      not null,    -- ngày theo GIỜ ĐỊA PHƯƠNG của user
  slot              meal_slot not null default 'snack',

  -- tham chiếu mềm tới foods: món bị xoá vẫn không làm hỏng nhật ký cũ
  food_id           uuid references foods(id) on delete set null,

  -- ẢNH CHỤP giá trị tại thời điểm ghi
  food_name         text         not null,
  grams             numeric(7,1) not null check (grams > 0),
  kcal              numeric(7,1) not null,
  protein_g         numeric(6,1) not null default 0,
  carbs_g           numeric(6,1) not null default 0,
  fat_g             numeric(6,1) not null default 0,

  -- chống ghi trùng khi mạng yếu và client gửi lại request
  client_request_id uuid,

  logged_at         timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  unique (user_id, client_request_id)
);
```

### 5.7 Meal plan (kế hoạch coach kê cho học viên)

```sql
create table meal_plans (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references profiles(id) on delete cascade,  -- NULL = template dùng lại
  coach_id    uuid references profiles(id) on delete set null,
  name        text not null,
  active_from date,
  active_to   date,
  created_at  timestamptz not null default now()
);

create table meal_plan_meals (
  id          bigint generated always as identity primary key,
  plan_id     uuid not null references meal_plans(id) on delete cascade,
  day_of_week smallint check (day_of_week between 1 and 7),  -- NULL = áp dụng mọi ngày
  slot        meal_slot not null,
  at_time     time,                   -- 07:00
  title       text not null,          -- 'Bữa sáng'
  sort_order  smallint not null default 0
);

create table meal_plan_items (
  id      bigint generated always as identity primary key,
  meal_id bigint       not null references meal_plan_meals(id) on delete cascade,
  food_id uuid         not null references foods(id),
  grams   numeric(7,1) not null
);
```

> Meal plan **tham chiếu trực tiếp** `foods` (không snapshot) — vì đây là kế hoạch tương lai,
> coach sửa số liệu món thì kế hoạch nên cập nhật theo. Ngược lại với nhật ký ăn ở 5.6.

### 5.8 Bài tập và giáo án

```sql
create table exercises (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  muscle_group text,        -- 'chest','back','legs','shoulders','arms','core','cardio'
  equipment    text,
  video_url    text,
  created_by   uuid references profiles(id),
  is_public    boolean not null default true,
  is_archived  boolean not null default false
);

create table workout_programs (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references profiles(id) on delete cascade,  -- NULL = template
  coach_id    uuid references profiles(id) on delete set null,
  name        text not null,          -- 'Giảm mỡ 12 tuần — Upper/Lower'
  active_from date,
  active_to   date,
  created_at  timestamptz not null default now()
);

create table workout_days (
  id          bigint generated always as identity primary key,
  program_id  uuid     not null references workout_programs(id) on delete cascade,
  day_of_week smallint check (day_of_week between 1 and 7),
  title       text     not null,      -- 'Upper A', 'Chân'
  sort_order  smallint not null default 0
);

create table workout_day_exercises (
  id             bigint generated always as identity primary key,
  workout_day_id bigint not null references workout_days(id) on delete cascade,
  exercise_id    uuid   not null references exercises(id),
  sort_order     smallint not null default 0,
  target_sets    smallint,
  target_reps    text,        -- '8–10' là KHOẢNG → phải là text, không phải int
  target_rir     text,        -- '1–2'
  rest_seconds   smallint,
  note           text
);
```

### 5.9 Buổi tập thực tế và lịch sử mức tạ

```sql
create table workout_sessions (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references profiles(id) on delete cascade,
  workout_day_id bigint references workout_days(id) on delete set null,
  performed_on   date not null,
  title          text,
  duration_min   smallint,
  note           text,
  created_at     timestamptz not null default now()
);

create table set_logs (
  id          bigint generated always as identity primary key,
  session_id  bigint   not null references workout_sessions(id) on delete cascade,
  exercise_id uuid     not null references exercises(id),
  set_no      smallint not null,
  weight_kg   numeric(6,2),
  reps        smallint,
  rir         smallint,
  created_at  timestamptz not null default now()
);
```

Đây là bảng cho tính năng **"weight history"** trong mockup: muốn biết lần trước đẩy bao nhiêu kg
thì truy vấn `set_logs` theo `exercise_id` của user, sắp xếp theo ngày giảm dần.

### 5.10 Check-in và ảnh tiến độ

```sql
create table checkins (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references profiles(id) on delete cascade,
  checkin_on     date not null,
  steps          int,
  sleep_hours    numeric(3,1),
  energy_level   smallint check (energy_level between 1 and 5),
  adherence_pct  smallint check (adherence_pct between 0 and 100),
  note           text,
  coach_feedback text,
  created_at     timestamptz not null default now(),
  unique (user_id, checkin_on)
);

create table progress_photos (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  taken_on    date not null,
  pose        text not null check (pose in ('front','side','back')),
  storage_key text not null,   -- đường dẫn TƯƠNG ĐỐI trong thư mục lưu trữ: 'progress/{user_id}/{taken_on}-{pose}.jpg'
  size_bytes  int  not null,
  created_at  timestamptz not null default now(),
  unique (user_id, taken_on, pose)
);
```

`storage_key` do **server tự sinh** từ `user_id`, `taken_on`, `pose` đã được validate — không bao giờ
ghép từ chuỗi người dùng gửi lên (chống path traversal, xem [mục 9](#9-lưu-trữ-ảnh-tiến-độ)).

### 5.11 Sơ đồ quan hệ

```text
users ─1:1─ profiles ─┬─< body_metrics
   │                  ├─< nutrition_targets
   ├─< refresh_tokens ├─< food_log_entries >─ foods
   ├─< auth_tokens    ├─< checkins
   └─< audit_log      ├─< progress_photos   (file nằm trên đĩa)
                      ├─< workout_sessions ─< set_logs >─ exercises
                      ├─< meal_plans ─< meal_plan_meals ─< meal_plan_items >─ foods
                      ├─< workout_programs ─< workout_days ─< workout_day_exercises >─ exercises
                      └─< profiles (coach_id, tự tham chiếu)
```

### 5.12 Xoá tài khoản

Xoá một hàng trong `users` sẽ **xoá dây chuyền** (`on delete cascade`) toàn bộ dữ liệu của người đó
trong database. Nhưng **file ảnh trên đĩa không tự xoá theo** — code phải xoá thư mục
`progress/{user_id}/` trước, rồi mới xoá hàng. Xem [mục 9](#9-lưu-trữ-ảnh-tiến-độ).

---

## 6. Bảy quyết định thiết kế quan trọng

### 6.1 Snapshot giá trị dinh dưỡng vào nhật ký ăn

`food_log_entries` lưu **bản sao** `food_name`, `kcal`, `protein_g`, `carbs_g`, `fat_g` thay vì
chỉ join sang `foods` để tính lại.

**Vì sao:** admin sửa "Ức gà" từ 165 → 170 kcal/100g. Nếu nhật ký chỉ join, **toàn bộ lịch sử
của mọi học viên tự đổi số** — biểu đồ tuần trước khác đi, coach phân tích sai, mất tin cậy.
Cùng nguyên tắc với hoá đơn lưu giá bán tại thời điểm mua, không join sang bảng giá hiện tại.

Kèm theo: nút xoá món trong trang Admin phải là **`is_archived = true`** (xoá mềm), không
`DELETE`. Và **server là bên tính snapshot** (client chỉ gửi `food_id` + `grams`) — xem
[mục 11](#11-logic-tính-toán-đặt-ở-đâu).

### 6.2 `logged_on` là `date` theo giờ địa phương, không phải `timestamp` UTC

**Bug sẽ gặp nếu làm sai:** học viên ăn khuya **00:30 ngày 05/10** giờ VN. UTC lúc đó là
**17:30 ngày 04/10**, bữa đó bị cộng vào ngày hôm trước, "calo còn lại hôm nay" sai.

**Cách làm đúng:**
- Lưu `timezone` trên `profiles`
- Client tính ngày địa phương rồi gửi lên: `new Date().toLocaleDateString('en-CA')` → `'2026-10-05'`
- **Không** dùng `now()::date` ở phía server (server chạy UTC)
- Server kiểm tra ngày gửi lên nằm trong khoảng hợp lý (không quá ±1 ngày so với hiện tại) để
  chặn dữ liệu rác
- `logged_at timestamptz` vẫn giữ để biết chính xác thời điểm ghi

### 6.3 Mục tiêu calo có phiên bản, không ghi đè

Điểm bán hàng của LATIS là *"tôi biết khi nào cần điều chỉnh"*. Muốn kể được câu chuyện đó thì
phải giữ lịch sử điều chỉnh. `nutrition_targets` có `effective_from` cho phép trả lời:
*"tuần 6 coach giảm từ 2.350 xuống 2.150 kcal, sau đó cân mới xuống tiếp"*.

### 6.4 Tổng calo tính trực tiếp (`SUM`), chưa cần bảng tổng hợp

Mỗi user mỗi ngày chỉ có 10–30 dòng. `SUM` với index `(user_id, logged_on)` chạy dưới 1 ms.
**Không** tạo bảng `daily_summary`, **không** dùng trigger cộng dồn — counter cộng dồn là nguồn
sai số kinh điển (xoá một dòng mà quên trừ là lệch số liệu vĩnh viễn).
**Khi nào mới cần:** lúc coach dashboard phải quét 100+ học viên × 90 ngày cùng lúc → dùng
**materialized view** refresh hằng đêm, không phải trigger.

### 6.5 Dùng `enum` và `check` constraint để chặn dữ liệu rác ngay ở DB

`meal_slot`, `user_role`, `pose`, `energy_level between 1 and 5`, `grams > 0`...
Validate bằng Zod ở API là lớp thứ nhất; ràng buộc ở DB là lớp **đảm bảo đúng** — vì sẽ có lúc
một đoạn code (script, migration, endpoint mới viết vội) đi vòng qua Zod.

### 6.6 `target_reps` là `text`, không phải số

"8–10 reps", "AMRAP", "30 giây" — đây là **mô tả mục tiêu** do người viết giáo án nhập.
Cố nhồi vào `int` sẽ phải thêm `reps_min`/`reps_max`/`reps_type` và vẫn thiếu trường hợp.
Ngược lại, `set_logs.reps` (số rep **thực tế đã làm**) thì phải là `smallint` vì cần tính toán.

### 6.7 Chống ghi trùng bằng `client_request_id`

Học viên ghi bữa ăn bằng điện thoại, mạng 4G yếu: request đã tới server nhưng response bị rớt,
app tự gửi lại → **món bị ghi hai lần, calo bị tính gấp đôi**.

Cách xử lý: client sinh một UUID cho mỗi lần bấm "Thêm vào nhật ký" và gửi kèm. Ràng buộc
`unique (user_id, client_request_id)` biến lần gửi lại thành no-op. Server trả về chính bản ghi cũ
thay vì lỗi, để client không cần phân biệt.

---

## 7. Index và các truy vấn chính

```sql
-- Nhật ký ăn: truy vấn nóng nhất của hệ thống
create index on food_log_entries (user_id, logged_on);

-- Biểu đồ cân nặng
create index on body_metrics (user_id, measured_on desc);

-- Lịch sử tập và mức tạ
create index on workout_sessions (user_id, performed_on desc);
create index on set_logs (session_id);
create index on set_logs (exercise_id);

-- Mục tiêu đang áp dụng
create index on nutrition_targets (user_id, effective_from desc);

-- Coach lấy danh sách học viên
create index on profiles (coach_id) where coach_id is not null;

-- Xoay vòng refresh token và dọn token hết hạn
create index on refresh_tokens (user_id);
create index on refresh_tokens (family_id);
create index on refresh_tokens (expires_at);
create index on auth_tokens (expires_at);

-- Audit: xem ai đã truy cập dữ liệu của một học viên
create index on audit_log (target_user_id, created_at desc);
create index on audit_log (actor_id, created_at desc);

-- Tìm kiếm món ăn theo tên (cần khi thực đơn vượt ~50 món, dropdown không còn đủ)
create extension if not exists pg_trgm;
create index foods_name_trgm on foods using gin (name gin_trgm_ops)
  where not is_archived;
```

### Truy vấn tổng hợp trong ngày

Đặt trong `repo` của module `food-log`, truyền `userId` và ngày làm tham số:

```sql
select
  coalesce(sum(f.kcal), 0)      as kcal_in,
  coalesce(sum(f.protein_g), 0) as protein_in,
  coalesce(sum(f.carbs_g), 0)   as carbs_in,
  coalesce(sum(f.fat_g), 0)     as fat_in,
  t.kcal      as kcal_goal,
  t.protein_g as protein_goal,
  t.carbs_g   as carbs_goal,
  t.fat_g     as fat_goal
from (select $1::uuid as uid) u
left join food_log_entries f
       on f.user_id = u.uid and f.logged_on = $2::date
left join lateral (
  select kcal, protein_g, carbs_g, fat_g
  from nutrition_targets
  where user_id = u.uid and effective_from <= $2::date
  order by effective_from desc
  limit 1
) t on true
group by t.kcal, t.protein_g, t.carbs_g, t.fat_g;
```

> Luôn trả về **đúng một dòng**, kể cả khi học viên chưa có mục tiêu (các cột `*_goal` là `NULL`).
> Bản hàm SQL ở phiên bản trước dùng `cross join` nên với user chưa có mục tiêu sẽ trả về
> **0 dòng** — lỗi đã được sửa ở bản này. Frontend cần xử lý `kcal_goal = null` (hiện "Chưa đặt mục tiêu").

### Lịch sử mức tạ của một bài tập

```sql
select s.performed_on, max(l.weight_kg) as top_weight, max(l.reps) as top_reps
from set_logs l
join workout_sessions s on s.id = l.session_id
where s.user_id = $1 and l.exercise_id = $2
group by s.performed_on
order by s.performed_on desc
limit 10;
```

---

## 8. Xác thực và phân quyền

Phần này tự xây toàn bộ đăng nhập và phân quyền — và là **phần dễ sai nhất** khi tự viết backend.
Hai nguyên tắc:

1. **Không tự phát minh mật mã.** Dùng thư viện đã được kiểm chứng (`argon2`, `jose`,
   `crypto.randomBytes`). Không tự nghĩ ra định dạng token, thuật toán hash hay cách mã hoá.
2. **Mặc định là từ chối.** Một endpoint mới chưa gắn kiểm tra quyền phải **không dùng được**,
   chứ không phải dùng được cho tất cả.

### 8.1 Các luồng

| Luồng | Endpoint | Các bước |
|---|---|---|
| Đăng ký | `POST /auth/register` | Validate `email`, `fullName`, `phone`, `password` → chuẩn hoá email (chữ thường) và SĐT (E.164) → kiểm tra trùng → hash mật khẩu → **một transaction** tạo `users` + `profiles` (role luôn là `client`) → nếu `status = active` thì cấp token luôn (đăng ký xong là đã đăng nhập) |
| Đăng nhập | `POST /auth/login` | Nhận `identifier` (**email hoặc số điện thoại**) + `password` → kiểm tra khoá tạm thời → so mật khẩu → kiểm tra trạng thái tài khoản → tạo access token + refresh token mới (`family_id` mới) → đặt cookie |
| Làm mới | `POST /auth/refresh` | Đọc cookie → tra theo hash → **xoay vòng** (xem 8.3) → trả access token mới |
| Đăng xuất | `POST /auth/logout` | Thu hồi cả `family_id` + xoá cookie |
| Thông tin tôi | `GET /me` | Trả thông tin tài khoản + hồ sơ của người đang đăng nhập |
| Đổi mật khẩu | `POST /auth/change-password` | Yêu cầu mật khẩu cũ → thu hồi mọi phiên khác |
| **Quên mật khẩu** | *(không tự phục vụ)* | Học viên liên hệ coach/admin → admin gọi `POST /admin/users/:id/reset-link` → nhận **một URL dùng một lần, hạn 24 giờ** hiển thị trên màn hình admin → tự gửi URL cho học viên (Zalo, tin nhắn) → học viên mở URL, đặt mật khẩu mới qua `POST /auth/reset-password` → mọi phiên cũ bị thu hồi |
| Xoá tài khoản | `DELETE /admin/users/:id` | **Chỉ admin** (người dùng không tự xoá được tài khoản của mình). Admin nhập lại mật khẩu của chính mình → xoá ảnh trên đĩa → xoá `users` (cascade) → ghi `audit_log` (`user_deleted`). Admin không được tự xoá mình nên luôn còn ít nhất một admin |

### 8.1.1 Quy tắc dữ liệu khi đăng ký

| Trường | Quy tắc |
|---|---|
| `email` | Bắt buộc; ≤ 254 ký tự; đúng định dạng; lưu **chữ thường**; duy nhất không phân biệt hoa/thường (`citext`) |
| `fullName` | 2–80 ký tự; chữ cái Unicode (có dấu tiếng Việt), dấu cách, dấu chấm, gạch nối, dấu nháy; **gộp khoảng trắng thừa** (`"  Nguyễn   Văn A "` → `"Nguyễn Văn A"`) |
| `phone` | Bắt buộc; **số di động Việt Nam**. Chấp nhận `0912345678`, `0912 345 678`, `091.234.5678`, `+84912345678`, `84912345678`; mọi dấu cách/chấm/gạch/ngoặc bị bỏ; **chuẩn hoá về `+84912345678`**; đầu số sau `0` phải là `3, 5, 7, 8` hoặc `9`; duy nhất |
| `password` | 8–128 ký tự (xem 8.2) |
| nhập lại mật khẩu | Chỉ kiểm tra ở **client**. Quan trọng hơn bình thường: vì không có "quên mật khẩu qua email", gõ nhầm mật khẩu khi đăng ký nghĩa là bị khoá ngoài tài khoản cho tới khi admin can thiệp |

Quy tắc chuẩn hoá SĐT là **một hàm duy nhất** (`modules/auth/phone.ts`) dùng cho cả đăng ký lẫn đăng
nhập bằng SĐT, kèm bộ test riêng. Dùng chung hàm là cách duy nhất để `0912 345 678` và
`+84912345678` luôn được coi là cùng một số.

Mã lỗi đăng ký trả về cho client: `email_taken`, `phone_taken`, `validation_error` (kèm danh sách
trường sai), `rate_limited`.

> **Đánh đổi có chủ đích:** báo "email/SĐT đã được dùng" cho phép kẻ xấu dò xem một email hoặc SĐT
> đã đăng ký hay chưa (account enumeration). Không có xác thực email thì không có cách che giấu việc
> này mà vẫn cho người dùng biết lý do lỗi. Giảm thiểu bằng giới hạn tốc độ theo IP (mục 8.6);
> dữ liệu bị lộ chỉ là "người này có tài khoản ở phòng tập này".

### 8.1.2 Hệ quả của việc không xác thực email/SĐT

- **Ai cũng đăng ký được bằng email/SĐT của người khác.** Không gây hại dữ liệu (họ không đọc được gì
  của chủ thật), nhưng có thể: (1) chiếm trước email của người khác → người đó không đăng ký được
  → họ nhắn coach, coach xử lý; (2) tạo tài khoản rác làm đầy danh sách.
- **Cách giảm thiểu, chọn mức phù hợp:**
  1. *Mặc định:* giới hạn tốc độ đăng ký theo IP + trường bẫy `website` ẩn (bot điền vào là biết)
  2. *Nên bật khi mở đăng ký công khai:* **duyệt tay** — đặt `REQUIRE_APPROVAL=true`, tài khoản mới ở
     trạng thái `pending`, không đăng nhập được cho tới khi coach/admin chuyển sang `active`.
     Hợp với mô hình coaching vì học viên vốn là người coach đã quen/đã chốt hợp đồng
  3. *Nếu coach chỉ nhận học viên đã biết:* tắt đăng ký công khai, admin tạo tài khoản và đưa link đặt mật khẩu
- Số điện thoại là **thông tin liên hệ do học viên tự khai**, không phải bằng chứng danh tính.

### 8.2 Lưu mật khẩu

- Dùng **argon2id** (thư viện `argon2` của Node mặc định đã là argon2id).
- OWASP khuyến nghị tối thiểu: bộ nhớ **19 MiB**, **2** lượt lặp, **1** luồng song song. Thư viện
  mặc định mạnh hơn (64 MiB, 3 lượt, 4 luồng). **Đo trên chính server của bạn**: mục tiêu là
  mỗi lần hash mất khoảng **100–300 ms**; trên VPS 1–2 GB RAM, hạ `memoryCost` xuống 19–32 MiB để
  nhiều người đăng nhập cùng lúc không làm tràn bộ nhớ.
- Độ dài mật khẩu: **tối thiểu 8, tối đa 128 ký tự** (giới hạn trên để chặn kẻ gửi mật khẩu dài hàng
  MB làm CPU quá tải). Không ép quy tắc "phải có chữ hoa, số, ký tự đặc biệt" — chúng đẩy người
  dùng vào mật khẩu dễ đoán; độ dài mới là yếu tố quyết định.
- Tuỳ chọn nên có sau: chặn khoảng 1.000 mật khẩu phổ biến bằng danh sách nhúng sẵn trong code
  (không gọi dịch vụ ngoài).
- Mật khẩu **không bao giờ** xuất hiện trong log, kể cả log lỗi (cấu hình `redact` của pino).

### 8.3 Token: access ngắn hạn + refresh xoay vòng

```text
ACCESS TOKEN   JWT, sống 15 phút
               · chỉ chứa: sub (user id), iat, exp, iss, aud — KHÔNG chứa role
               · client giữ trong BIẾN JS (bộ nhớ), gửi qua header  Authorization: Bearer ...
               · ký HS256 bằng JWT_SECRET ≥ 32 byte ngẫu nhiên; code ghim sẵn thuật toán khi verify

REFRESH TOKEN  chuỗi ngẫu nhiên 32 byte (crypto.randomBytes), sống 30 ngày
               · nằm trong cookie:  HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth
               · DB chỉ lưu SHA-256 của nó (token có entropy cao nên không cần hash chậm)
               · mỗi lần dùng được ĐỔI lấy token mới (xoay vòng), token cũ đánh dấu used_at
```

**Phát hiện đánh cắp token (reuse detection):** nếu một refresh token đã `used_at` lại bị đem ra
dùng, nghĩa là có hai bên cùng giữ bản sao → **thu hồi toàn bộ `family_id`**, buộc đăng nhập lại.

> Cạm bẫy: người dùng mở hai tab, cả hai cùng refresh một lúc → tab chậm hơn bị coi là "dùng lại"
> và cả hai bị đăng xuất. Hai cách giảm thiểu: (1) phía client dùng **Web Locks API**
> (`navigator.locks`) để chỉ một tab refresh tại một thời điểm; (2) phía server cho phép **ân hạn
> ~10 giây**: nếu token đã dùng cách đây dưới 10 giây thì chỉ trả 401 để client thử lại với cookie
> mới nhất, **không** thu hồi cả họ token.

**Vì sao role không nằm trong JWT:** mỗi request, server tra `users` theo khoá chính (id, role,
status) — tốn dưới 1 ms. Nhờ vậy khi bạn **khoá tài khoản hoặc đổi quyền, hiệu lực tức thì** thay vì
phải đợi token cũ hết hạn sau 15 phút.

**Phía frontend:**
- Khi tải trang: gọi `POST /auth/refresh` (cookie tự gửi kèm) để lấy access token — đây là
  "đăng nhập ngầm"; thất bại thì chuyển về `/login`.
- Khi API trả 401: gọi refresh **một lần** (gom các request đang chờ cùng đợi một lần refresh),
  rồi gửi lại request gốc.
- Bọc trong `AuthProvider`; bảo vệ route bằng `<RequireAuth>` và `<RequireRole role="admin">`.
  Hai component này chỉ để **trải nghiệm** — ranh giới bảo mật thật là server.

**Chống CSRF cho các endpoint dùng cookie** (`/auth/refresh`, `/auth/logout`): `SameSite=Lax` +
chỉ chấp nhận `POST` + yêu cầu `Content-Type: application/json` + kiểm tra header `Origin` phải
khớp `APP_ORIGIN`. Các endpoint còn lại dùng header `Authorization` nên không bị CSRF.

### 8.4 Ba vai trò

| Vai trò | Quyền |
|---|---|
| `client` (học viên) | Đọc/ghi **chỉ dữ liệu của mình**; đọc `foods` và `exercises` công khai |
| `coach` | Mọi quyền của client + **đọc dữ liệu và ghi mục tiêu/giáo án/meal plan cho học viên có `profiles.coach_id` = mình** |
| `admin` | Quản lý `foods`, `exercises`, tài khoản và vai trò |

### 8.5 Phân quyền ở tầng ứng dụng — thay cho Row Level Security

Mối nguy lớn nhất: **Broken Object Level Authorization (BOLA)** — mục số 1 trong OWASP API Security
Top 10. Ví dụ: `GET /food-log?userId=abc` mà server không kiểm tra `abc` có phải người đang đăng nhập
→ ai cũng đọc được nhật ký ăn của mọi người chỉ bằng cách đổi tham số.

Row Level Security của Postgres có thể chặn việc này ở tầng DB, nhưng thiết kế này chủ động không dựa vào nó. Bạn phải chặn bằng **kỷ luật code**, gồm 5 quy tắc:

1. **Route "dữ liệu của tôi" không bao giờ nhận `userId` từ body/query/path.** `userId` luôn lấy từ
   token đã xác thực (`req.user.id`).
2. **Route có `:clientId` (coach/admin xem học viên) bắt buộc gọi `assertCanAccessClient`** trước
   khi chạm database.
3. **Mọi hàm trong `repo` của bảng thuộc về user đều nhận `userId` tường minh** và có
   `where user_id = $1`. Không viết hàm kiểu `findById(id)` trên bảng nhật ký, cân nặng, ảnh...
4. **Trả 404 thay vì 403** khi truy cập tài nguyên của người khác — không tiết lộ tài nguyên đó
   có tồn tại hay không.
5. **Mọi quyết định phân quyền nằm trong `lib/policy.ts`**, không rải `if (role === ...)` khắp
   các handler.

```ts
// lib/policy.ts  — bản phác thảo
export async function assertCanAccessClient(
  actor: Actor,
  clientId: string,
  action: string,
) {
  if (actor.id === clientId) return; // chính chủ

  const allowed =
    actor.role === "admin" ||
    (actor.role === "coach" && (await profilesRepo.isCoachOf(actor.id, clientId)));

  if (!allowed) throw new NotFoundError(); // 404, không phải 403

  await audit.log({ actorId: actor.id, targetUserId: clientId, action });
}
```

**Kiểm thử là phần thay thế cho đảm bảo của RLS.** Viết một bộ kiểm thử tích hợp chạy với Postgres
thật, tạo sẵn học viên A, học viên B, coach của A, coach lạ, và admin; rồi với **mỗi endpoint đụng
tới dữ liệu cá nhân** kiểm tra cả ma trận:

```ts
test.each(userOwnedEndpoints)("%s — A không truy cập được dữ liệu của B", async (ep) => {
  const res = await app.inject(ep.requestFor({ target: userB, as: userA }));
  expect([403, 404]).toContain(res.statusCode);
});
```

Thêm endpoint mới mà không thêm vào danh sách này là lỗi quy trình. Chạy bộ test này trong CI ở
mọi lần push.

> **Tuỳ chọn tăng cường sau:** vẫn có thể bật RLS của Postgres làm lớp phòng thủ thứ hai (mỗi
> transaction chạy `SET LOCAL app.user_id = ...`, policy đọc `current_setting('app.user_id')`). Việc
> này hoạt động khi API kết nối bằng role không phải chủ bảng. Nó thêm độ phức tạp đáng kể
> (mọi truy vấn phải nằm trong transaction); chỉ nên làm khi quy mô hoặc yêu cầu tuân thủ tăng lên.

### 8.6 Chống dò mật khẩu và lạm dụng

| Điểm | Giới hạn |
|---|---|
| `POST /auth/login` | 10 request / 15 phút / IP (plugin rate limit) **và** theo tài khoản: 10 lần sai liên tiếp → khoá 15 phút (`failed_logins`, `locked_until`) |
| `POST /auth/register` | 5 request / giờ / IP |
| `POST /auth/refresh` | 60 request / 15 phút / IP |
| API còn lại | 120 request / phút / IP |

- Plugin `@fastify/rate-limit` với bộ nhớ trong tiến trình là đủ khi chạy 1 instance. Bộ đếm mất khi
  khởi động lại API — chấp nhận được.
- **Khoá theo tài khoản** chặn kẻ dò mật khẩu từ nhiều IP, nhưng mở ra cách quấy rối: ai đó cố
  tình đăng nhập sai 10 lần để khoá tài khoản người khác. Vì vậy thời gian khoá ngắn (15 phút) và
  tự mở; **khoá không kéo dài khi đã mở** (đếm lại từ 0 sau lần đăng nhập đúng).
- **Đằng sau Caddy, IP của client nằm trong `X-Forwarded-For`.** Phải cấu hình `trustProxy` của
  Fastify chỉ tin proxy của bạn (API chỉ nhận kết nối từ Caddy trong mạng Docker). Nếu cấu hình
  sai, mọi request nhìn như đến từ cùng một IP (rate limit vô nghĩa) hoặc kẻ tấn công tự giả mạo IP.
- Thông báo lỗi đăng nhập **luôn chung chung** ("Email/số điện thoại hoặc mật khẩu không đúng"). Khi
  định danh không tồn tại, vẫn chạy một lần hash giả để **thời gian phản hồi xấp xỉ nhau**. Các lỗi
  riêng như "tài khoản đang chờ duyệt" hay "đã bị khoá" chỉ trả về **sau khi mật khẩu đã đúng**.
  Riêng lỗi **khoá tạm thời do nhập sai nhiều lần** (`429 too_many_attempts`, kèm số giây phải chờ) được
  báo rõ ràng ngay cả khi mật khẩu đúng — vì người dùng thật cần biết vì sao mình bị chặn, và việc
  tài khoản có tồn tại hay không vốn đã lộ qua `email_taken` ở lúc đăng ký.
- **Trường bẫy:** form đăng ký có ô `website` ẩn bằng CSS. Người thật không thấy nên để trống; bot
  điền vào. Khi có giá trị, server trả `201` giả và không tạo gì — bot không biết đã bị chặn.
- Ghi `audit_log` cho đăng nhập thất bại, khoá tài khoản, cấp link đặt lại, đổi vai trò.

### 8.7 Tạo admin đầu tiên

Đăng ký luôn tạo `client`. **Không bao giờ** có endpoint HTTP nào nhận `role` từ request.
Admin đầu tiên được tạo bằng script chạy trên máy chủ:

```bash
# Dev
npm run admin:create -- --email you@example.com --phone 0912345678 --name "Tên của bạn"

# Production
docker compose run --rm api node dist/scripts/create-admin.js --email ... --phone ... --name ...
```

Script hỏi mật khẩu bằng prompt ẩn (không nhận qua tham số dòng lệnh để khỏi lưu vào lịch sử shell).
Đổi vai trò về sau chỉ qua endpoint của admin, có ghi `audit_log`, và **không cho phép hạ quyền
admin cuối cùng của hệ thống**.

### 8.8 Link đặt lại mật khẩu do admin/coach cấp

1. Admin (hoặc coach của học viên đó) bấm "Cấp link đặt lại mật khẩu" → server tạo token ngẫu nhiên
   32 byte, **lưu SHA-256 của nó** vào `auth_tokens` (hạn 24 giờ, `created_by` = người cấp), ghi
   `audit_log`, rồi trả URL **một lần duy nhất** cho người cấp.
2. URL có dạng `https://latis.vn/reset-password#token=...` — token nằm sau dấu `#` (**fragment**),
   nên trình duyệt **không gửi nó lên server**: không lọt vào log truy cập của Caddy, không bị lộ qua
   header `Referer`. Trang đặt lại mật khẩu đọc token từ fragment rồi gửi trong body của
   `POST /auth/reset-password`.
3. Server kiểm tra hash, còn hạn, chưa `used_at` → đặt mật khẩu mới, đánh dấu `used_at`, **thu hồi
   mọi refresh token của người đó**, ghi `audit_log`.
4. Cấp link mới không tự vô hiệu link cũ — nhưng mỗi link chỉ dùng được một lần và hết hạn sau 24 giờ.

URL này tương đương mật khẩu trong 24 giờ, nên admin cần gửi qua kênh riêng tư (tin nhắn trực tiếp),
không đăng vào nhóm chat.

### 8.9 Những gì không có vì không dùng dịch vụ ngoài

| Tính năng | Lý do không có | Thay bằng |
|---|---|---|
| Đăng nhập Google/Facebook | Cần đăng ký ứng dụng OAuth với nhà cung cấp | Email/SĐT + mật khẩu |
| OTP qua SMS | Cần dịch vụ SMS | Không |
| Xác thực email | Cần dịch vụ gửi email | Duyệt tay (8.1.2) |
| "Quên mật khẩu" tự phục vụ | Cần kênh gửi link | Link do admin/coach cấp (8.8) |
| Kiểm tra mật khẩu bị lộ (Have I Been Pwned) | Gọi dịch vụ ngoài | Danh sách ~1.000 mật khẩu phổ biến nhúng sẵn trong code (làm sau) |

---

## 9. Lưu trữ ảnh tiến độ

Ảnh nằm trên **ổ đĩa máy chủ**, không qua dịch vụ nào.

```text
STORAGE_DIR = /var/lib/latis/storage        (bind mount vào container api; quyền 700)
Khoá lưu     progress/{user_id}/{taken_on}-{pose}.jpg
ví dụ        progress/a3f1…/2026-10-04-front.jpg
```

- Thư mục này **không nằm trong thư mục Caddy phục vụ** và không có URL tĩnh nào trỏ tới. Cách duy
  nhất để lấy ảnh là qua API sau khi kiểm tra quyền.
- Mọi tên file/đường dẫn do **server tự sinh** từ `user_id` (UUID đã validate), `taken_on` (ngày đã
  validate) và `pose` (một trong ba giá trị cố định). **Không bao giờ** ghép từ chuỗi người dùng gửi
  lên → chặn tấn công path traversal (`../../etc/passwd`). Trước khi đọc/ghi còn kiểm tra đường dẫn
  đã resolve vẫn nằm trong `STORAGE_DIR`.

### 9.1 Luồng tải lên

```text
Client ──multipart──► POST /api/v1/photos ──► API:
   1. xác thực; kiểm tra hạn mức (tối đa N ảnh/user; đĩa còn trống > 1 GB)
   2. giới hạn 10 MB/ảnh (@fastify/multipart)
   3. sharp giải mã ảnh  → KHÔNG tin Content-Type do client khai; giải mã thất bại = từ chối
   4. .rotate()          → xoay đúng chiều theo EXIF rồi mới bỏ EXIF
   5. resize cạnh dài 1600 px, JPEG chất lượng ~80
   6. sharp mặc định XOÁ toàn bộ metadata → mất EXIF (GPS, kiểu máy, thời điểm chụp)
   7. ghi ra file tạm → đổi tên (rename) thành file đích   → ghi nguyên tử, không bao giờ để file dở dang
   8. ghi dòng vào progress_photos
```

Vì sao xử lý ở server: ảnh chụp bằng điện thoại thường chứa **toạ độ GPS của nhà người chụp** — với
ảnh cơ thể thì đây là rò rỉ riêng tư nghiêm trọng nếu ảnh bị lộ. Nén ở client chỉ là tối ưu băng
thông, không phải biện pháp bảo vệ.

Cấu hình `sharp` an toàn cho máy chủ nhỏ:
- `sharp(input, { limitInputPixels: 50_000_000 })` — chặn ảnh bom giải nén
- `sharp.cache(false)` và `sharp.concurrency(1)` nếu máy chủ chỉ có 1 GB RAM

### 9.2 Luồng xem ảnh

`GET /api/v1/photos/:id/file` → kiểm tra quyền (chính chủ, coach của học viên đó, hoặc admin;
coach/admin được ghi `audit_log`) → trả file bằng stream với các header:

```text
Content-Type: image/jpeg
Cache-Control: private, max-age=300
X-Content-Type-Options: nosniff
```

Thẻ `<img src>` **không gửi được header `Authorization`**, nên frontend tải ảnh bằng `fetch` (có
token), đổi thành `Blob`, rồi dùng `URL.createObjectURL(blob)` làm `src`. Nhớ gọi
`URL.revokeObjectURL` khi component biến mất để không rò bộ nhớ.

### 9.3 Xoá ảnh

Xoá file trước, xoá dòng sau; nếu xoá file lỗi thì dừng và giữ dòng để thử lại. Khi admin xoá tài khoản,
xoá cả thư mục `progress/{user_id}/` trước khi xoá `users`. Một job hằng tuần so khớp file trên đĩa
với bảng `progress_photos` để dọn file mồ côi.

### 9.4 Đổi sang nơi lưu khác về sau

Toàn bộ thao tác file nằm sau `lib/storage.ts` (`save`, `read`, `remove`, `removeDir`). Nếu sau này
bạn quyết định dùng lưu trữ đối tượng, chỉ thay file này, các nơi gọi không đổi.

---

## 10. Thiết kế API

REST, tiền tố `/api/v1`, JSON. Mọi endpoint (trừ nhóm `auth` và `GET /health`) yêu cầu access token.

| Nhóm | Endpoint chính | Ai được dùng |
|---|---|---|
| Auth | `POST /auth/register · login · refresh · logout · reset-password` | công khai (refresh/logout cần cookie) |
| | `POST /auth/change-password` | đã đăng nhập |
| Hồ sơ | `GET·PATCH /me` · `GET /me/export` | chính chủ |
| | `DELETE /admin/users/:id` | **chỉ admin** |
| Thực phẩm | `GET /foods?q=` | mọi người dùng đã đăng nhập |
| | `POST·PATCH /foods` · `POST /foods/:id/archive` | admin (coach tuỳ chọn) |
| Nhật ký ăn | `GET /food-log?date=` · `POST /food-log` · `DELETE /food-log/:id` | chính chủ |
| Tổng hợp | `GET /summary/daily?date=` | chính chủ |
| Mục tiêu | `GET /nutrition-targets/current?date=` | chính chủ |
| Chỉ số cơ thể | `GET /body-metrics?from=&to=` · `PUT /body-metrics/:date` (upsert) | chính chủ |
| Giáo án | `GET /workout/program/active` · `GET /exercises` | chính chủ / mọi người dùng |
| Buổi tập | `POST /workout-sessions` · `GET /workout-sessions` · `POST /workout-sessions/:id/sets` · `GET /exercises/:id/history` | chính chủ |
| Check-in | `GET·PUT /checkins/:date` | chính chủ |
| Ảnh | `POST /photos` · `GET /photos` · `GET /photos/:id/file` · `DELETE /photos/:id` | chính chủ (xem: cả coach, admin) |
| Coach | `GET /clients` · `GET /clients/:id/{summary, food-log, body-metrics, photos, checkins}` | coach của học viên đó, admin |
| | `POST /clients/:id/nutrition-targets` · `POST /clients/:id/programs` · `POST /clients/:id/meal-plans` | coach của học viên đó, admin |
| | `POST /clients/:id/reset-link` | coach của học viên đó, admin |
| Quản trị | `GET·PATCH /admin/users` · `PATCH /admin/users/:id/status` (duyệt/khoá) · `PATCH /admin/users/:id/role` · `POST /admin/users/:id/reset-link` | admin |
| | `POST·PATCH /admin/exercises` · `GET /admin/system/status` (tuổi backup, dung lượng đĩa/DB) | admin |
| Vận hành | `GET /health` | công khai (chỉ trả `ok`, không lộ thông tin) |

### Ví dụ một handler theo đúng các quy tắc

```ts
app.post(
  "/api/v1/food-log",
  { preHandler: app.requireAuth },
  async (req, reply) => {
    const body = createEntrySchema.parse(req.body); // Zod: sai là ném lỗi → 400
    const userId = req.user.id; // từ token — KHÔNG lấy từ body

    const food = await foodsRepo.findPublic(body.foodId); // server tự tra bảng foods
    if (!food) return reply.code(404).send({ error: "food_not_found" });

    const r = body.grams / 100;
    const entry = await foodLogRepo.insertIdempotent({
      userId,
      clientRequestId: body.clientRequestId,
      loggedOn: body.loggedOn,
      slot: body.slot,
      foodId: body.foodId,
      foodName: food.name, // snapshot do SERVER tính, không tin số kcal client gửi lên
      grams: body.grams,
      kcal: round1(food.kcalPer100g * r),
      proteinG: round1(food.proteinPer100g * r),
      carbsG: round1(food.carbsPer100g * r),
      fatG: round1(food.fatPer100g * r),
    });

    return reply.code(201).send(entry);
  },
);
```

`insertIdempotent` dùng `on conflict (user_id, client_request_id) do nothing`, rồi đọc lại và trả
bản ghi hiện có — gửi lại cùng `clientRequestId` cho cùng một kết quả.

**Quy ước chung:** lỗi trả dạng `{ "error": "mã_lỗi" }` (không trả stack trace ở production);
phân trang bằng `limit` + `cursor` cho danh sách dài; ngày luôn là chuỗi `YYYY-MM-DD`; thời điểm
luôn là ISO 8601 UTC; JSON dùng `camelCase`.

---

## 11. Logic tính toán đặt ở đâu

| Việc | Đặt ở đâu | Lý do |
|---|---|---|
| BMI | Module `calc` dùng chung | Dẫn xuất từ cân nặng + chiều cao, không lưu vào DB |
| BMR / TDEE (Mifflin-St Jeor) | Module `calc` dùng chung | Thuật toán có thể đổi; dễ viết unit test |
| Macro split từ mục tiêu | Module `calc`, **kết quả lưu** vào `nutrition_targets` | Coach có thể ghi đè số hệ thống gợi ý |
| **Calo của một món** = `kcal_per100g × gram / 100` | **Server**, lưu snapshot vào nhật ký | **Đổi so với phiên bản 1:** bản trước tính ở client. Khi đã có backend riêng, client chỉ gửi `food_id` + `grams`; server tra bảng `foods` và tự tính. Client không thể ghi số liệu sai, và admin sửa dữ liệu món không làm lệch cách tính |
| Món "tự nhập" (người dùng gõ calo/100g) | Client gửi `name` + giá trị/100g; server **chỉ kiểm tra khoảng hợp lệ** (vd 0–950 kcal/100g, vì chất béo thuần ~900) rồi tự tính | Đây là dữ liệu do người dùng khai, không phải dữ liệu đã xác minh |
| Tổng calo trong ngày, calo còn lại | **SQL** (truy vấn ở mục 7) | Tổng hợp là việc của DB |
| Trung bình cân nặng 7 ngày | **SQL** (window function `avg() over`) | Tránh tải hết lịch sử về client |

Nguyên tắc: **lưu dữ liệu đầu vào (input) và kết quả cuối (output), không lưu giá trị trung gian
có thể tính lại.** Chiều cao + cân nặng là input → lưu. BMI là dẫn xuất → tính khi cần.

Nên đặt `calc.ts` ở một thư mục dùng chung giữa `server/` và frontend (hoặc sao chép kèm test) để
BMI/TDEE hiển thị trên giao diện luôn khớp với giá trị server dùng.

---

## 12. Những gì không nên làm ở quy mô này

| Thứ không cần | Vì sao | Khi nào xem lại |
|---|---|---|
| Microservices | 1 app + 1 DB là đủ; chia nhỏ chỉ thêm độ phức tạp mạng | Không bao giờ, ở quy mô này |
| Redis / cache layer | Truy vấn đã dưới 1 ms nhờ index; cache thêm rủi ro dữ liệu cũ | p95 > 500 ms hoặc > 5.000 người dùng hoạt động/ngày |
| Message queue (Kafka/RabbitMQ) | Không có xử lý nền nặng | Gửi hàng nghìn email/push mỗi lần → dùng `pg-boss` (hàng đợi trên Postgres, không cần Redis) |
| Read replica / sharding | 500 user dùng chưa tới 5% năng lực 1 instance | > 50.000 user |
| Kubernetes / Docker Swarm | Docker Compose trên 1 VPS là đủ | Khi cần nhiều server |
| GraphQL | REST đủ cho client duy nhất là SPA của bạn | Khi có nhiều client khác nhau |
| PgBouncer | 1 instance × pool 10 kết nối, xa mức 100 | Khi chạy nhiều instance API |
| ORM tự đồng bộ schema (`synchronize: true`, `prisma db push`) | Sửa schema production không có lịch sử, có thể xoá cột | Không bao giờ ở production — chỉ dùng file migration |
| Tự nghĩ ra mật mã / định dạng token | Mật mã tự chế gần như chắc chắn có lỗ hổng | Không bao giờ |
| Mở cổng Postgres ra internet | Bị quét và tấn công dò mật khẩu trong vài giờ | Không bao giờ — chỉ truy cập qua mạng nội bộ Docker hoặc SSH tunnel |
| Lưu token trong `localStorage` | Một lỗ hổng XSS = lộ toàn bộ phiên | Giữ access token trong bộ nhớ, refresh token trong cookie httpOnly |

---

## 13. Lộ trình xây dựng backend

Code hiện tại đã có sẵn **đường nối (seam)** thuận lợi: toàn bộ state nằm trong 2 context
(`DailyLogContext`, `AppDataContext`). Chỉ cần đổi ruột các context đó từ `localStorage` sang gọi
API, **UI gần như không phải sửa**.

| Dữ liệu hiện tại | Đang ở | Sẽ thành |
|---|---|---|
| Đăng nhập/đăng ký | `Login.jsx` / `Register.jsx` chỉ `navigate('/app')` | `/auth/*` thật + `AuthProvider` |
| Nhật ký ăn trong ngày | `DailyLogContext.jsx` → `localStorage` | `GET/POST/DELETE /food-log` + `GET /summary/daily` |
| Danh sách món ăn | `data/foods.js` + `AppDataContext` | `GET /foods` (admin ghi qua `/foods`) |
| Lịch tập theo ngày | `data/mock.js` + `AppDataContext` | `workout_programs` → `workout_days` → `workout_day_exercises` |
| Danh sách học viên | `data/users.js` + `AppDataContext` | `GET /admin/users` |
| Hồ sơ, cân nặng, ảnh | `data/mock.js` | `/me`, `/body-metrics`, `/photos` |
| `/admin/*` | Chưa bảo vệ | `<RequireRole>` ở client **và** kiểm tra quyền ở mọi endpoint admin |

### Các bước

**Bước 1 — Khung backend (1–2 ngày)**
- Thư mục `server/`, TypeScript, Fastify, Zod đọc biến môi trường, pino
- Postgres cục bộ cho dev bằng `server/scripts/dev-db.sh` (cụm riêng trong `server/.pgdata`, cổng
  `54329`, không đụng tới Postgres hệ thống): `npm run db:start`
- Endpoint `GET /health`
- Frontend: thêm vào `vite.config.js` proxy để dev cũng là một origin:

  ```js
  server: { proxy: { "/api": "http://localhost:3000" } }
  ```

**Bước 2 — Schema và migration (1 ngày)**
- Chuyển SQL ở [mục 5](#5-thiết-kế-cơ-sở-dữ-liệu) và [mục 7](#7-index-và-các-truy-vấn-chính) thành
  các file `dbmate`, **mỗi bước một file** (bắt đầu bằng bảng tài khoản, thêm dần)
- Seed: 18 món trong `src/data/foods.js` + danh sách bài tập mẫu

**Bước 3 — Đăng ký, đăng nhập (4–6 ngày) — phần quan trọng nhất**
- Đăng ký (email + họ tên + SĐT + mật khẩu), đăng nhập bằng email hoặc SĐT, refresh xoay vòng, đăng xuất
- Rate limit, khoá tạm thời, `audit_log`
- Kiểm thử: luồng thành công, trùng email/SĐT, SĐT sai định dạng, token hết hạn, **tái sử dụng refresh
  token**, mật khẩu sai, khoá tài khoản, giới hạn tốc độ
- Frontend: `AuthProvider`, `api.ts` (tự refresh một lần), `RequireAuth`, `RequireRole`
- Sau đó: đổi mật khẩu, link đặt lại do admin cấp

**Bước 4 — Phân quyền + thực đơn + nhật ký ăn (3–4 ngày)**
- `lib/policy.ts` và **bộ kiểm thử ma trận A/B** ([mục 8.5](#8-xác-thực-và-phân-quyền))
- `foods`, `food-log`, `summary/daily`
- Đổi ruột `DailyLogContext` sang TanStack Query nhưng **giữ nguyên API** (`entries`, `addEntry`,
  `removeEntry`, `totals`, `remaining`) → `FoodCalculator.jsx`, `Dashboard.jsx` không phải sửa

**Bước 5 — Lịch tập, chỉ số cơ thể, mục tiêu, check-in (3–4 ngày)**

**Bước 6 — Ảnh (2 ngày)** — lưu trên đĩa qua `lib/storage.ts`, `sharp`, xoá ảnh

**Bước 7 — API cho coach và admin (3–4 ngày)**
- Nối `AdminUsers`, `AdminMenu`, `AdminWorkouts` vào API thật
- Trang chi tiết học viên cho coach; form điều chỉnh `nutrition_targets` (tạo phiên bản mới)
- Trang "Tình trạng hệ thống": tuổi backup, dung lượng đĩa và DB

**Bước 8 — Triển khai và kiểm thử trước khi mở cửa (2–3 ngày)** — theo [mục 16](#16-triển-khai-lên-production)

**Tổng ước tính thô: ~20–26 ngày làm việc cho một người.** Phần dễ đánh giá thấp nhất là Bước 3
và bộ kiểm thử phân quyền ở Bước 4.

### Trạng thái hiện tại (cập nhật 05/10/2026)

Toàn bộ chức năng trong thiết kế **đã có code** (backend + giao diện), trừ các mục ghi "chưa làm" ở cuối bảng.

| Phần | Trạng thái | Ghi chú |
|---|---|---|
| Khung backend | ✅ | `server/`: Fastify, TypeScript, Zod, pino (đã `redact` token/cookie), `GET /api/v1/health` |
| Đăng ký / đăng nhập | ✅ | Email + họ tên + SĐT + mật khẩu; đăng nhập bằng email **hoặc** SĐT; refresh xoay vòng + phát hiện dùng lại token; khoá tài khoản; rate limit; honeypot; duyệt tay (`REQUIRE_APPROVAL`); job dọn token |
| Mật khẩu & tài khoản | ✅ | `POST /auth/change-password` (đăng xuất mọi thiết bị khác), link đặt lại do admin/coach cấp (`POST /admin/users/:id/reset-link`, token trong fragment URL, dùng một lần, hết hạn 24 giờ, DB chỉ lưu băm) + `POST /auth/reset-password`, `GET /me/export`; **xoá tài khoản chỉ admin làm được**: `DELETE /admin/users/:id` (admin nhập lại mật khẩu của mình, xoá cả ảnh trên đĩa, không tự xoá mình, ghi audit) |
| Món ăn + nhật ký ăn | ✅ | `/foods`, `/food-log`, `/food-log/summary`; server tự tính calo; chọn bữa và ngày |
| Hồ sơ thể chất, cân nặng, mục tiêu | ✅ | `/me/profile`, `/body-metrics`, `/nutrition-targets` (gợi ý Mifflin–St Jeor: giảm 500 / tăng 300 kcal, protein 2,0 / 1,8 g/kg, mỡ 25% calo, sàn 1.200 kcal); BMI từ cân nặng mới nhất |
| Gợi ý kế hoạch ăn | ✅ | `GET /meal-plan/suggest`: hàm thuần `mealplan.ts`, xác định theo (day, variant), không lưu DB |
| Lịch tập | ✅ | Giáo án tuần **dùng chung** (`/workout-plan`, admin/coach sửa); nhật ký từng hiệp `/workout-log` + `/workout-log/history` |
| Check-in tuần | ✅ | Chỉ hỏi **tuần này có tập hay không** (`trained` true/false) + ghi chú: `/checkins` (thứ Hai là đầu tuần). Ảnh theo dõi thay đổi nộp ngay trong trang check-in (cùng bảng `progress_photos`, lọc theo tuần) và có so sánh ảnh đầu ↔ hiện tại; coach xem tuần nào có/không tập kèm ảnh của tuần đó và phản hồi qua `/clients/:id/checkins/:week/coach-note`. Migration `…0006` bỏ 5 cột thang điểm cũ |
| Ảnh trước/sau | ✅ | `/photos` (tối đa 60 ảnh/người, 8 MB/ảnh): giải mã lại bằng `sharp` → WebP + thumbnail, bỏ EXIF, lưu trên đĩa qua `lib/storage.ts`; chỉ phục vụ qua API có kiểm tra quyền (frontend tải bằng `AuthImage`) |
| Trang giới thiệu | ✅ | `site_content` (JSONB) + `site_assets` (ảnh PT trong DB). Công khai: `GET /public/about`, `/public/coach-photo`. Admin: `PUT /admin/about`, `POST·DELETE /admin/about/photo`; giao diện `/admin/content` |
| Phân quyền coach/admin | ✅ | `lib/policy.ts` (`findAccessibleClient`: admin tất cả, coach chỉ học viên được gán; ngoài phạm vi trả **404**); `/clients/:id/*` (overview, food-log, workout-log, body-metrics, photos, checkins, đặt mục tiêu) **ghi `audit_log` mọi lần xem**; `test/policy.test.ts` là ma trận A/B (đã thử phá policy → test báo đỏ) |
| Quản trị | ✅ | `/admin/users` (lọc, tìm theo tên/email/SĐT, phân trang; coach chỉ thấy học viên của mình), tạo tài khoản hộ, duyệt/khoá (khoá = đăng xuất ngay), đổi vai trò, gán coach/gói; `/admin/stats`; `/admin/system/status` (dung lượng DB/ảnh/đĩa, tuổi bản backup). Admin không tự đổi trạng thái/vai trò của mình |
| Triển khai & backup | 🔶 Viết xong, **chưa chạy thử** | `server/Dockerfile`, `docker-compose.yml`, `Caddyfile`, `.env.production.example`, `ops/backup.sh`, `ops/pull-backup.sh` (+ launchd), `ops/restore-drill.sh`. Máy phát triển không có Docker daemon nên chưa build/chạy; script shell mới chỉ qua `bash -n`. Làm theo 16.7 ở lần triển khai đầu |
| Chưa làm | ⬜ | Giáo án / meal plan **riêng từng học viên** (hiện giáo án dùng chung, kế hoạch ăn sinh tự động, không lưu); trang Chính sách bảo mật + checkbox đồng ý khi đăng ký; tin nhắn giữa coach và học viên; thanh toán; SEO cho landing page (mục 17) |

Kiểm thử **đã chạy: 158 test tích hợp / 10 file** (`npm test` trong `server/`, trên Postgres thật): chuẩn hoá SĐT, đăng ký, đăng nhập,
khoá tài khoản, token, CSRF, rate limit, đổi/đặt lại mật khẩu, xoá/xuất tài khoản, nhật ký ăn, cân nặng, mục tiêu, lịch tập,
nội dung giới thiệu + ảnh, quản trị, phân quyền A/B, check-in, ảnh tiến độ; cộng công thức (BMR, gợi ý, kế hoạch ăn, ngày tháng).
Việc chạy test đã bắt được một lỗi thật: `CamelCasePlugin` đổi `kcalPer100g` thành `kcal_per100g` khi ghi nhưng cột tên
`kcal_per_100g` → thêm món lỗi 500; đã đổi tên cột bằng migration `…0004`. **Quy tắc:** cột có số liền sau chữ đặt tên dạng
`xxx_per100g`, không có dấu `_` trước số.

**Chưa kiểm chứng trên trình duyệt thật** (chỉ `vite build` qua): toàn bộ giao diện của các chức năng mới — nhật ký ăn theo
bữa/ngày, trang Hồ sơ (đổi mật khẩu, tải dữ liệu), nút Xoá ở `/admin/users`, Tiến độ (biểu đồ, ảnh), Check-in, Lịch tập, `/admin/users`,
`/admin/users/:id`, `/admin/content`, trang đặt lại mật khẩu — và giao diện di động. Phần đã từng chạy trên trình duyệt
thật (đăng ký, cookie httpOnly, giữ phiên khi tải lại, nhiều tab) là bản trước khi thêm các chức năng này.

**Chạy trên máy dev** (cần Postgres đã cài; không cần Docker):

```bash
cd server
npm install
npm run db:start      # tạo cụm Postgres riêng (cổng 54329), file .env, DB latis + latis_test, áp migration
npm run dev           # API tại http://localhost:3000
npm test              # bộ test tích hợp
npm run admin:create -- --email you@example.com --phone 0912345678 --name "Tên của bạn"

cd ..                 # frontend
npm run dev           # http://localhost:5173/gym_tracking/  (Vite tự chuyển tiếp /api sang cổng 3000)
```

> **Lưu ý khi thử tay:** đăng ký bị giới hạn **5 lần/giờ/IP** (cố ý, chống spam). Nếu bạn thử đăng ký
> nhiều lần liên tiếp khi phát triển sẽ gặp lỗi "thao tác quá nhanh". Bộ đếm nằm trong bộ nhớ nên
> khởi động lại API (`npm run dev`) là xoá.

**Phần giao diện đã / chưa được kiểm chứng trên trình duyệt thật (Chrome tự động):**
- ✅ Đã kiểm chứng: chặn `/app` khi chưa đăng nhập; kiểm tra form đăng ký ở client; đăng ký thật và vào
  app; cookie refresh là `HttpOnly` + `SameSite=Lax` + `Path=/api/v1/auth`; không có JWT/refresh token trong
  `localStorage`/`sessionStorage`/`document.cookie`; tải lại trang vẫn giữ phiên; 3 tab mở cùng lúc đều vẫn
  đăng nhập (xoay vòng token không làm văng phiên); trang Hồ sơ hiện email/SĐT thật.
- ⬜ Chưa kiểm chứng: đăng xuất, đăng nhập lại (bằng email và bằng SĐT), quay về đúng trang đã định vào,
  chặn học viên vào `/admin`, báo trùng email/SĐT trên giao diện, **cách ly nhật ký ăn giữa hai tài khoản
  dùng chung trình duyệt**, giao diện di động. Phần logic phía server của các luồng này đã có test tự động;
  phần giao diện của chúng thì chưa được chạy thử.
- Kịch bản nằm ngoài repo (thư mục tạm của phiên làm việc) nên **không** được lưu lại — nếu muốn giữ làm
  test hồi quy, cần đưa vào repo (`e2e/`).

---

## 14. Chi phí vận hành

Không có dịch vụ nào cần đăng ký, nên **không có phí thuê bao phần mềm**. Chỉ còn hai khoản:

| Hạng mục | Chi phí |
|---|---|
| **Máy chủ Linux** | **0đ** nếu dùng máy sẵn có; nếu thuê VPS thì đây là khoản chi duy nhất (xem bên dưới) |
| **Tên miền** | ~400.000 VND/năm (cần để có HTTPS; không có tên miền thì chỉ chạy được trong mạng nội bộ) |
| Phần mềm (Postgres, Node, Caddy, Docker, `age`, `rsync`) | 0đ — mã nguồn mở |
| HTTPS (Let's Encrypt qua Caddy) | 0đ, tự động, không cần tài khoản |
| **Tổng** | **~35.000 VND/tháng** nếu có sẵn máy chủ |

**Nếu thuê VPS** (tham khảo trang giá DigitalOcean ngày 04/10/2026; Hetzner cũng có địa điểm
Singapore — bạn tự xem giá của họ):

| Gói | Cấu hình | Giá |
|---|---|---|
| Nhỏ | 1 vCPU / 1 GB RAM / 25 GB SSD | 6 USD/tháng |
| Vừa | 2 vCPU / 2 GB RAM / 60 GB SSD | 18 USD/tháng |

- **1 GB** chạy được giai đoạn đầu nhưng sát giới hạn: Postgres (~150–300 MB) + Node API
  (~150–300 MB) + Caddy + đỉnh bộ nhớ của `sharp`/`argon2`. Nếu dùng gói này: **bật swap 1–2 GB**,
  đặt `sharp.concurrency(1)`, hạ `memoryCost` của argon2. Và nhớ rằng **đĩa 25 GB sẽ đầy vì ảnh**
  (mục 2) — theo dõi sát hoặc chọn gói 60 GB.
- **2 GB / 60 GB** là mức nên dùng khi đã có học viên trả phí.

**Cái giá thật của việc tự làm tất cả:** thời gian — ~3–4 tuần xây dựng, rồi vận hành thường xuyên
(cập nhật hệ điều hành, theo dõi đĩa, kiểm tra backup). Hãy cân nhắc trung thực xem lựa chọn này có
đáng thời gian của bạn không, nhất là khi một học viên gói `1:1 Personal Coaching`
(3.200.000đ/tháng) đã trả gấp nhiều lần chi phí hạ tầng.

---

## 15. Backup, bảo mật và dữ liệu sức khỏe

Hệ thống lưu **cân nặng, số đo cơ thể và ảnh bán khoả thân** của khách hàng — dữ liệu cá nhân nhạy
cảm. Khi tự host, **bạn là người duy nhất chịu trách nhiệm** cho phần này.

### 15.1 Backup: hai lớp

**Lớp 1 — trên máy chủ** (chống lỡ tay, migration hỏng; **không** chống hỏng đĩa):
`/opt/latis/backup.sh` chạy bằng cron mỗi 6 giờ:

```bash
#!/usr/bin/env bash
# cron:  0 */6 * * * /opt/latis/backup.sh >> /var/log/latis-backup.log 2>&1
set -euo pipefail
cd /opt/latis
OUT_DIR=/var/backups/latis
TS=$(date +%F-%H%M)
mkdir -p "$OUT_DIR"

docker compose exec -T db pg_dump -U latis_owner -Fc latis \
  | age -r "$(cat /opt/latis/age.pub)" -o "$OUT_DIR/latis-$TS.dump.age"   # mã hoá bằng khoá CÔNG KHAI

find "$OUT_DIR" -name 'latis-*.dump.age' -mtime +7 -delete               # giữ 7 ngày trên máy chủ
```

**Lớp 2 — ngoài máy chủ** (chống hỏng/mất cả máy chủ): máy tính của bạn **chủ động kéo** về.
Dùng mô hình kéo (pull) thay vì để máy chủ đẩy đi, vì máy chủ không cần giữ thông tin đăng nhập vào
bất kỳ đâu — kẻ chiếm được máy chủ cũng không xoá được bản sao nằm trên máy bạn.

`~/bin/latis-pull-backup.sh` trên máy bạn:

```bash
#!/usr/bin/env bash
set -uo pipefail
SERVER="backup@latis.vn"
DEST="$HOME/latis-backups"
MAX_AGE_MIN=$((14 * 60))          # backup mới nhất không được cũ quá 14 giờ (backup chạy 6 giờ/lần)
mkdir -p "$DEST/db" "$DEST/photos"

notify() { osascript -e "display notification \"$1\" with title \"LATIS\"" 2>/dev/null || echo "$1"; }

# 1. Máy chủ còn sống không?
curl -fsS -m 10 "https://latis.vn/api/v1/health" > /dev/null || notify "Máy chủ không phản hồi /health"

# 2. Kéo bản dump mới (đã mã hoá) và ảnh
rsync -az --ignore-existing "$SERVER:/var/backups/latis/" "$DEST/db/"      || notify "Kéo backup DB thất bại"
rsync -az                   "$SERVER:/var/lib/latis/storage/" "$DEST/photos/" || notify "Kéo ảnh thất bại"

# 3. Bản backup mới nhất có quá cũ không?  (backup hỏng âm thầm là kịch bản phổ biến nhất)
if [ -z "$(find "$DEST/db" -name 'latis-*.dump.age' -mmin -"$MAX_AGE_MIN" | head -1)" ]; then
  notify "CẢNH BÁO: backup mới nhất đã quá cũ"
fi
```

Chạy định kỳ bằng `launchd` (macOS): tạo `~/Library/LaunchAgents/vn.latis.pullbackup.plist`
với `StartInterval` = `3600` (mỗi giờ) rồi `launchctl load` file đó. Script này đồng thời là **cảnh
báo sập** tự chế: nếu `/health` không trả lời, máy bạn bật thông báo. Giới hạn trung thực: chỉ cảnh
báo khi máy bạn đang bật và có mạng.

Điểm quan trọng:
- **Mã hoá trước khi rời máy chủ.** Khoá riêng của `age` cất ở trình quản lý mật khẩu hoặc ổ USB,
  **không để trên máy chủ**.
- **Tài khoản `backup` trên máy chủ chỉ có quyền đọc** hai thư mục trên (tạo user riêng, không cho
  `sudo`; có thể giới hạn khoá SSH chỉ chạy `rsync`). Máy bạn không dùng tài khoản `deploy`.
- **Ảnh không mã hoá khi nằm trên máy bạn** → bật **FileVault** (mã hoá toàn đĩa macOS).
- Trang admin hiển thị **tuổi bản backup mới nhất** (đọc thư mục `/var/backups/latis` gắn vào
  container ở chế độ chỉ đọc) — nhìn là biết backup có đang chạy không.
- Dọn bản cũ trên máy bạn thủ công (hoặc thêm `find ... -mtime +60 -delete` vào script).

**Mức mất dữ liệu chấp nhận được (RPO):** tối đa ~6 giờ tính từ lúc máy chủ hỏng (phụ thuộc lần kéo
gần nhất của máy bạn — nếu máy bạn tắt 3 ngày thì bản sao ngoài máy chủ cũ 3 ngày). **Thời gian dựng
lại (RTO):** ~1–2 giờ (dựng máy chủ mới, `docker compose up`, restore). Nếu cần RPO dưới 1 giờ, nâng
cấp lên lưu liên tục nhật ký WAL (pgBackRest hoặc WAL-G).

### 15.2 Bài tập restore (bắt buộc làm trước khi mở cửa)

```bash
age -d -i ~/khoa-rieng-age.txt -o restore.dump ~/latis-backups/db/latis-2026-10-05-0200.dump.age
createdb latis_restore_test
pg_restore --no-owner -d latis_restore_test restore.dump
psql latis_restore_test -c "select count(*) from users;"
```

Backup chưa từng restore thử thì **chưa thể coi là backup**. Lặp lại bài tập mỗi quý. Đây cũng là cách
có **môi trường staging miễn phí**: restore bản dump production về máy bạn, chạy migration mới lên
đó trước, thấy ổn mới áp lên production.

### 15.3 Bảo mật máy chủ

- [ ] SSH chỉ bằng khoá; tắt đăng nhập root; tắt đăng nhập bằng mật khẩu
- [ ] Tường lửa chỉ mở **22, 80, 443**
- [ ] `fail2ban` và `unattended-upgrades` (tự cài bản vá bảo mật)
- [ ] **Postgres không có `ports:` trong `docker-compose.yml`** — chỉ nằm trong mạng nội bộ Docker
- [ ] Hai role trong Postgres: `latis_owner` (chạy migration) và `latis_app` (API dùng — chỉ
  `SELECT/INSERT/UPDATE/DELETE`, không có quyền `DROP`, `ALTER`, tạo bảng)
- [ ] File `.env` trên máy chủ `chmod 600`, không bao giờ commit lên git
- [ ] Thư mục ảnh `chmod 700`, không nằm trong thư mục web
- [ ] Bật xác thực hai lớp cho GitHub và tài khoản nhà cung cấp VPS (nếu có)

> **Cạm bẫy của Docker:** Docker tự sửa `iptables` và **bỏ qua tường lửa `ufw`**. Nếu bạn ghi
> `ports: "5432:5432"` cho Postgres, nó sẽ **mở ra toàn internet** dù `ufw` đã chặn 5432. Vì vậy quy
> tắc là không bao giờ có `ports:` cho `db`.

### 15.4 Bảo mật ứng dụng

- [ ] `@fastify/helmet`: header bảo mật; Caddy bật HSTS
- [ ] Validate **mọi** body, query và param bằng Zod; giới hạn kích thước body (mặc định 1 MB, riêng upload ảnh 10 MB)
- [ ] Chỉ dùng truy vấn tham số hoá (Kysely làm sẵn) — không bao giờ ghép chuỗi SQL
- [ ] Production không trả stack trace; log không chứa mật khẩu, token, cookie (`pino` `redact`)
- [ ] `trustProxy` cấu hình đúng (xem [mục 8.6](#8-xác-thực-và-phân-quyền))
- [ ] `npm audit` chạy định kỳ; ghim phiên bản qua `package-lock.json`
- [ ] Không dùng `dangerouslySetInnerHTML` với dữ liệu người dùng ở frontend
- [ ] `JWT_SECRET` và mật khẩu DB chỉ nằm trong biến môi trường trên máy chủ

### 15.5 Tuân thủ quy định dữ liệu cá nhân

- Việt Nam có **Nghị định 13/2023/NĐ-CP** về bảo vệ dữ liệu cá nhân; dữ liệu sức khỏe thuộc nhóm
  **nhạy cảm**, cần có sự đồng ý rõ ràng và thông báo mục đích sử dụng. Theo hiểu biết của tôi, có
  thêm luật mới về bảo vệ dữ liệu cá nhân có hiệu lực từ 2026 — hãy kiểm tra văn bản hiện hành.
- Việc cần có: trang Chính sách bảo mật, checkbox đồng ý khi đăng ký, chức năng **xuất dữ liệu**
  (`GET /me/export`) và **xoá tài khoản** (chỉ admin: `DELETE /admin/users/:id`), và `audit_log` cho truy cập của coach/admin.
- Đây là ghi chú kỹ thuật, không phải tư vấn pháp lý — nếu thương mại hoá nên hỏi luật sư.

---

## 16. Triển khai lên production

Nguyên tắc: **schema nằm trong git dưới dạng file SQL, không bao giờ chỉnh tay trên production.**
Nhờ vậy dựng lại database từ đầu chỉ mất một lệnh và mọi thay đổi đều có lịch sử.

### 16.1 Môi trường

| Môi trường | Chạy ở đâu | Dữ liệu |
|---|---|---|
| **Local (dev)** | Máy bạn: Postgres cục bộ (`npm run db:start`), API `npm run dev`, Vite dev server | Dữ liệu giả |
| **Production** | Máy chủ Linux | Dữ liệu thật — **không thử nghiệm ở đây** |
| *Staging (miễn phí)* | Máy bạn, nạp bản dump production đã restore | Thử migration trước khi áp lên production |

### 16.2 Chuẩn bị máy chủ (làm một lần)

```bash
# Ubuntu LTS, đăng nhập bằng SSH key; rồi trên máy chủ:
adduser deploy && usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# /etc/ssh/sshd_config:  PermitRootLogin no   ·   PasswordAuthentication no
systemctl restart ssh

ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
apt update && apt install -y fail2ban unattended-upgrades age rsync
curl -fsSL https://get.docker.com | sh && usermod -aG docker deploy

# Thư mục dữ liệu (container api chạy bằng user uid 1000)
mkdir -p /var/lib/latis/storage /var/backups/latis /opt/latis
chown 1000:1000 /var/lib/latis/storage && chmod 700 /var/lib/latis/storage
chown deploy:deploy /var/backups/latis /opt/latis

# Tạo user chỉ-đọc cho máy bạn kéo backup (xem mục 15.1)
adduser --disabled-password --gecos "" backup
```

Trỏ bản ghi DNS `A` của `latis.vn` về IP máy chủ **trước khi** khởi động Caddy, để Caddy xin được
chứng chỉ Let's Encrypt (cần cổng 80/443 mở ra internet).

### 16.3 Cấu hình Docker Compose

`/opt/latis/docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:18          # cùng phiên bản chính với Postgres dùng khi dev
    restart: unless-stopped
    environment:
      POSTGRES_USER: latis_owner
      POSTGRES_PASSWORD: ${DB_OWNER_PASSWORD}
      POSTGRES_DB: latis
      APP_DB_PASSWORD: ${APP_DB_PASSWORD}
    volumes:
      # Image Postgres 18 đổi thư mục dữ liệu — gắn volume ở /var/lib/postgresql; đối chiếu tài liệu image
      - pgdata:/var/lib/postgresql
      - ./server/db/init:/docker-entrypoint-initdb.d:ro    # tạo role latis_app (chỉ chạy lần đầu)
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U latis_owner -d latis"]
      interval: 5s
      retries: 10
    # KHÔNG có "ports:" — Postgres chỉ truy cập được trong mạng nội bộ Docker

  migrate:
    image: ghcr.io/amacneil/dbmate
    command: --no-dump-schema up
    environment:
      DATABASE_URL: postgres://latis_owner:${DB_OWNER_PASSWORD}@db:5432/latis?sslmode=disable
    volumes:
      - ./server/db/migrations:/db/migrations:ro
    depends_on:
      db: { condition: service_healthy }
    restart: "no"

  api:
    build: ./server
    restart: unless-stopped
    env_file: .env
    volumes:
      - /var/lib/latis/storage:/var/lib/latis/storage
      - /var/backups/latis:/var/backups/latis:ro      # để trang admin đọc tuổi backup
    depends_on:
      migrate: { condition: service_completed_successfully }
    expose: ["3000"]            # chỉ lộ trong mạng nội bộ cho Caddy

  caddy:
    image: caddy:2
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./web:/srv/web:ro        # thư mục dist/ của frontend
      - caddy_data:/data
    depends_on: [api]

volumes:
  pgdata:
  caddy_data:
```

> Cờ dòng lệnh và đường dẫn mặc định của `dbmate`, cũng như thư mục dữ liệu của image Postgres 18,
> có thể khác giữa các phiên bản — đối chiếu tài liệu của phiên bản bạn dùng.

`/opt/latis/Caddyfile`:

```caddyfile
latis.vn {
	encode zstd gzip

	handle /api/* {
		reverse_proxy api:3000
	}

	handle {
		root * /srv/web
		try_files {path} /index.html
		file_server
	}
}
```

`server/db/init/01-roles.sh` — tạo role ứng dụng quyền hạn chế. Chạy một lần khi khởi tạo DB trống
(production, qua `docker-entrypoint-initdb.d`) và **dùng chung** với `scripts/dev-db.sh` khi dev. Script
**idempotent** (chạy lại không lỗi) và truyền giá trị qua biến `psql` (`:'app_pw'`, `:"owner"`) thay vì
nối chuỗi shell, nên mật khẩu chứa ký tự đặc biệt cũng an toàn:

```bash
#!/bin/bash
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
     -v owner="$POSTGRES_USER" -v db="$POSTGRES_DB" -v app_pw="$APP_DB_PASSWORD" <<'EOSQL'
select format('create role latis_app login password %L', :'app_pw')
where not exists (select 1 from pg_roles where rolname = 'latis_app') \gexec

grant connect on database :"db" to latis_app;
grant usage on schema public to latis_app;

-- Bảng/sequence do chủ sở hữu tạo (qua migration) tự cấp quyền DML cho latis_app.
alter default privileges for role :"owner" in schema public
  grant select, insert, update, delete on tables to latis_app;
alter default privileges for role :"owner" in schema public
  grant usage, select on sequences to latis_app;
EOSQL
```

> Quyền mặc định chỉ áp dụng cho bảng tạo **sau** khi script chạy → luôn chạy script này **trước** khi
> chạy migration (thứ tự `db:start` và `docker compose` đều đã đảm bảo điều này).

`/opt/latis/.env` (chmod 600, **không commit**):

```text
NODE_ENV=production
HOST=0.0.0.0                    # trong container phải nghe mọi địa chỉ để Caddy truy cập được
PORT=3000
APP_ORIGIN=https://latis.vn
TRUST_PROXY=true
DATABASE_URL=postgres://latis_app:<APP_DB_PASSWORD>@db:5432/latis
JWT_SECRET=<openssl rand -base64 48>
STORAGE_DIR=/var/lib/latis/storage
BACKUP_DIR=/var/backups/latis
REQUIRE_APPROVAL=false          # true = tài khoản mới phải được coach/admin duyệt
DB_OWNER_PASSWORD=<mật khẩu mạnh>
APP_DB_PASSWORD=<mật khẩu mạnh khác>
```

### 16.4 Quy trình migration

```bash
dbmate new add_checkins_table      # tạo server/db/migrations/2026…_add_checkins_table.sql
dbmate up                          # áp migration chưa chạy
dbmate status                      # xem tình trạng
```

Mỗi file có hai phần `-- migrate:up` và `-- migrate:down`; dbmate bọc từng file trong một
transaction. Luật:

1. **Đã áp lên production thì không sửa file cũ** — viết file mới. Sửa file cũ làm local và production lệch nhau.
2. **Thêm cột `NOT NULL` vào bảng đã có dữ liệu:** thêm cột cho phép NULL → điền giá trị → rồi mới đặt `NOT NULL`.
3. **Xoá hoặc đổi tên cột:** làm hai bản phát hành — bản đầu ngừng dùng cột, bản sau mới xoá. Đổi tên
   trực tiếp làm frontend cũ (đang nằm trong cache trình duyệt) lỗi ngay.
4. Chạy thử migration mới trên **bản restore của production** ở máy bạn trước khi áp thật.
5. Trước migration có rủi ro, chạy `backup.sh` bằng tay.

### 16.5 Triển khai lần đầu

```bash
# 1. Trên máy bạn: build frontend
npm run build                                        # base phải là '/' — xem mục 17
rsync -az --delete dist/ deploy@<ip>:/opt/latis/web/

# 2. Đưa mã backend + cấu hình lên máy chủ (git clone repo vào /opt/latis, hoặc rsync thư mục server/)
# 3. Trên máy chủ:
cd /opt/latis
docker compose up -d --build       # db → migrate → api → caddy

# 4. Tạo admin đầu tiên (mục 8.7)
docker compose run --rm api node dist/scripts/create-admin.js --email ... --phone ... --name ...

# 5. Cài cron backup, rồi chạy tay một lần để chắc nó hoạt động
crontab -e    # thêm:  0 */6 * * * /opt/latis/backup.sh >> /var/log/latis-backup.log 2>&1
```

### 16.6 Triển khai các lần sau

```bash
# Backend (có thể kèm migration)
ssh deploy@<ip> 'cd /opt/latis && git pull && docker compose up -d --build api'
#   → service `migrate` tự chạy trước khi API mới khởi động

# Frontend
npm run build && rsync -az --delete dist/ deploy@<ip>:/opt/latis/web/
```

API khởi động lại mất vài giây — ở quy mô này chấp nhận được; deploy ngoài giờ cao điểm. Chạy bộ test
(kể cả ma trận phân quyền) **trước** khi deploy.

### 16.7 Kiểm tra trước khi mở đăng ký thật

- [ ] **Từ máy ngoài, cổng 5432 không kết nối được** tới máy chủ (`nc -zv <ip> 5432` phải thất bại)
- [ ] Bộ test **ma trận A/B** phân quyền chạy xanh; thử tay lần nữa bằng 2 tài khoản thật
- [ ] Cookie refresh có đủ `HttpOnly; Secure; SameSite=Lax` (xem trong DevTools)
- [ ] Rate limit hoạt động **đằng sau Caddy** (thử 11 lần đăng nhập sai liên tiếp → bị chặn; kiểm tra
  log ghi đúng IP của bạn chứ không phải IP nội bộ Docker)
- [ ] Đăng ký bằng số điện thoại ở nhiều dạng (`0912…`, `+84 912…`) → cùng số bị báo trùng
- [ ] Upload ảnh chụp bằng điện thoại → kiểm tra file trên đĩa **không còn EXIF/GPS**
- [ ] Thử `GET /photos/:id/file` bằng tài khoản khác → bị chặn; thử đường dẫn `../` → bị chặn
- [ ] `backup.sh` chạy được, file xuất hiện trong `/var/backups/latis`, script kéo về máy bạn hoạt động, **đã restore thử thành công**
- [ ] Ăn lúc 00:30 giờ VN → bữa ăn tính vào đúng ngày mới
- [ ] Response lỗi ở production không chứa stack trace
- [ ] `https://latis.vn` có chứng chỉ hợp lệ và header bảo mật đầy đủ (kiểm tra bằng `curl -I`)

### 16.8 Giám sát tối thiểu (không dịch vụ ngoài)

- `GET /health` + script kéo backup trên máy bạn (mục 15.1) → cảnh báo sập/backup cũ
- Trang admin "Tình trạng hệ thống": tuổi backup, % đĩa đã dùng, dung lượng DB
- `docker compose logs -f api` cho log ứng dụng; `df -h` định kỳ
- Mỗi tháng: xem kích thước bảng `food_log_entries` và thư mục ảnh

---

## 17. Ghi chú thêm

**Dọn dẹp cấu hình cũ (đã làm 05/10/2026):** `vite.config.js` dùng `base: process.env.VITE_BASE ?? '/'` (địa chỉ dev giờ là
`http://localhost:5173/`, không còn `/gym_tracking/`); `package.json` đổi tên `latis-web` và bỏ `gh-pages`; xoá `public/404.html`,
`vercel.json` và đoạn script chuyển hướng trong `index.html`; `README.md` viết lại. Số "calo tiêu hao" mẫu đã bỏ khỏi công thức
"calo còn lại" (= mục tiêu − đã ăn). Các bản triển khai tĩnh cũ (GitHub Pages, Vercel) **không đăng nhập được** vì không có API
đứng sau — nên gỡ hoặc để nguyên mà không quảng bá. Bản `README.md` ở thư mục cha của repo (bản chép cũ) vẫn ghi Supabase.

**SEO cho landing page.** Vite SPA render ở client → Google index yếu, bất lợi cho trang bán dịch
vụ coaching. Ba lựa chọn, theo thứ tự công sức tăng dần:
1. Prerender trang chủ lúc build (`vite-plugin-ssr` / `react-snap`) — rẻ nhất
2. Tách landing thành trang tĩnh riêng (Astro), app giữ nguyên Vite; Caddy phục vụ cả hai
3. Migrate cả dự án sang Next.js — tốt nhất về lâu dài, nhưng tốn nhiều công

**TypeScript cho frontend.** Dự án đang là JSX thuần. Nên chuyển dần sang TS và dùng chung kiểu
với `server/` (một thư mục `shared/` chứa schema Zod và `calc.ts`) — bắt lỗi sai tên trường giữa
frontend và API ngay lúc code.

**Đặt tên nhất quán.** DB dùng `snake_case`, TypeScript và JSON dùng `camelCase`. `CamelCasePlugin`
của Kysely tự chuyển đổi hai chiều.

**Khi nào nên xem lại kiến trúc:** khi vượt ~5.000 người dùng hoạt động/ngày, khi cần chạy từ 2
instance API trở lên, hoặc khi thêm thanh toán trực tuyến (cần webhook có chữ ký, xử lý idempotent
và hàng đợi có retry — lúc đó thêm `pg-boss`, dùng chính Postgres làm hàng đợi).

---

*Cập nhật: 04/10/2026 — phiên bản 3: tự viết backend, không dùng dịch vụ bên thứ ba*
