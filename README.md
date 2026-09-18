# 💪 Trung Phạm Fitness — GymTrack

> Website cá nhân của PT Trung Phạm, cung cấp các khóa tập luyện cá nhân hóa, hướng dẫn dinh dưỡng và công cụ theo dõi tiến trình thể hình dành cho khách hàng.

🔗 **Demo trực tiếp:** https://ducthang186.github.io/gym_tracking/

---

## 📖 Mục lục

- [Giới thiệu](#-giới-thiệu)
- [Mục tiêu dự án](#-mục-tiêu-dự-án)
- [Cấu trúc website](#-cấu-trúc-website)
- [Tính năng](#-tính-năng)
- [Công nghệ sử dụng](#️-công-nghệ-sử-dụng)
- [Bắt đầu nhanh](#-bắt-đầu-nhanh)
- [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
- [Scripts](#-scripts)
- [Lộ trình phát triển](#-lộ-trình-phát-triển)
- [Đóng góp](#-đóng-góp)
- [Giấy phép](#-giấy-phép)

---

## 📌 Giới thiệu

**Trung Phạm Fitness — GymTrack** là website được phát triển dành cho PT Trung Phạm, với mục tiêu xây dựng nền tảng hỗ trợ kinh doanh dịch vụ huấn luyện cá nhân và quản lý hành trình tập luyện của khách hàng.

Website kết hợp giữa:

- **Landing Page:** Giới thiệu về PT Trung Phạm, phương pháp tập luyện, các khóa học và dịch vụ huấn luyện.
- **Fitness App:** Khu vực dành cho khách hàng theo dõi lịch tập, chế độ ăn uống, chỉ số cơ thể và tiến trình thay đổi thể hình.

Thông qua nền tảng, khách hàng có thể theo dõi kế hoạch tập luyện và dinh dưỡng được xây dựng theo mục tiêu cá nhân, đồng thời cập nhật kết quả theo thời gian.

---

## 🎯 Mục tiêu dự án

### Đối với PT Trung Phạm

- Xây dựng thương hiệu cá nhân trong lĩnh vực Fitness.
- Giới thiệu các khóa tập luyện và dịch vụ huấn luyện.
- Tiếp cận khách hàng tiềm năng thông qua landing page.
- Quản lý và theo dõi tiến trình tập luyện của khách hàng.
- Cung cấp kế hoạch tập luyện và dinh dưỡng có tính cá nhân hóa.

### Đối với khách hàng

- Tìm hiểu thông tin về PT Trung Phạm và các khóa tập.
- Theo dõi lịch tập luyện cá nhân.
- Xem và thực hiện kế hoạch dinh dưỡng.
- Theo dõi cân nặng, chỉ số cơ thể và tiến trình thay đổi.
- Lưu trữ hình ảnh before/after để đánh giá kết quả.

---

## 🎨 Cấu trúc website

Website được chia thành **2 khu vực chính**:

```text
┌──────────────────────────────────────────────────────────┐
│                  LANDING PAGE (/)                        │
│                                                          │
│  Giới thiệu PT Trung Phạm                                │
│  Hero · Dịch vụ · Khóa tập · Phương pháp · Bảng giá      │
│  Thành tựu · Feedback khách hàng · CTA đăng ký           │
│                                                          │
│                     ↓ Đăng ký / Vào app                 │
├──────────────────────────────────────────────────────────┤
│                     FITNESS APP                          │
│                        (/app/*)                          │
│                                                          │
│  Dashboard · Lịch ăn · Lịch tập · Tiến độ · Hồ sơ        │
│                                                          │
│  Khu vực dành cho khách hàng theo dõi hành trình         │
│  tập luyện và dinh dưỡng cá nhân                         │
└──────────────────────────────────────────────────────────┘
```

### Sơ đồ route

| Route | Màn hình | Mô tả |
|---|---|---|
| `/` | Landing Page | Giới thiệu PT Trung Phạm, dịch vụ, khóa tập và CTA đăng ký |
| `/app` | Dashboard | Tổng quan calo, macro, cân nặng và lịch tập |
| `/app/meal-plan` | Lịch ăn | Theo dõi thực đơn, trọng lượng và calo từng món |
| `/app/workout` | Lịch tập | Theo dõi lịch tập theo ngày và nhóm cơ |
| `/app/progress` | Tiến độ | Theo dõi cân nặng, biểu đồ và ảnh before/after |
| `/app/profile` | Hồ sơ | Quản lý thông tin cơ thể và chỉ số BMI |

> Các route ứng dụng sẽ được mở rộng để hỗ trợ hệ thống tài khoản và phân quyền giữa PT và khách hàng trong các giai đoạn tiếp theo.

---

## ✨ Tính năng

### 🏋️ Landing Page — Giới thiệu PT Trung Phạm

Landing page là khu vực giới thiệu thương hiệu cá nhân và dịch vụ huấn luyện của PT Trung Phạm.

- **Hero Section:** Giới thiệu thông điệp chính và lời kêu gọi hành động.
- **Giới thiệu PT Trung Phạm:** Thông tin cá nhân, kinh nghiệm và định hướng huấn luyện.
- **Dịch vụ huấn luyện:** Giới thiệu các hình thức và chương trình tập luyện.
- **Khóa tập:** Trình bày các gói tập và dịch vụ dành cho khách hàng.
- **Phương pháp tập luyện:** Giới thiệu cách xây dựng kế hoạch tập và dinh dưỡng.
- **Cách hoạt động:** Quy trình đăng ký, đánh giá thể trạng và bắt đầu chương trình.
- **Bảng giá:** Hiển thị các gói dịch vụ huấn luyện.
- **CTA đăng ký:** Hướng dẫn khách hàng liên hệ hoặc đăng ký khóa tập.

### 📊 Fitness App — Theo dõi hành trình tập luyện

Khu vực ứng dụng dành cho khách hàng của PT Trung Phạm.

#### Tổng quan (Dashboard)

- Theo dõi lượng calo nạp vào và tiêu hao.
- Hiển thị chỉ số macro: Protein, Carbs và Fat.
- Tổng quan cân nặng và tiến trình tập luyện.
- Hiển thị lịch ăn và lịch tập trong ngày.

#### Chế độ dinh dưỡng (Meal Plan)

- Theo dõi thực đơn theo ngày và tuần.
- Hiển thị trọng lượng từng món ăn (gram).
- Hiển thị lượng calo và macro của từng món.
- Đề xuất thực đơn dựa trên mục tiêu calo và macro.
- Theo dõi kế hoạch dinh dưỡng cá nhân.

#### Lịch tập luyện (Workout)

- Theo dõi lịch tập theo ngày và tuần.
- Phân chia lịch tập theo nhóm cơ.
- Hiển thị danh sách bài tập.
- Hỗ trợ quản lý kế hoạch tập luyện cá nhân.

#### Theo dõi tiến độ (Progress)

- Nhập và cập nhật cân nặng định kỳ.
- Hiển thị biểu đồ thay đổi cân nặng.
- Lưu trữ ảnh before/after theo từng mốc thời gian.
- Theo dõi tiến trình thay đổi hình thể.
- So sánh kết quả tập luyện theo thời gian.

#### Hồ sơ cá nhân (Profile)

- Quản lý thông tin cá nhân.
- Cập nhật chiều cao và cân nặng.
- Theo dõi chỉ số BMI.
- Quản lý các số đo cơ thể.
- Cập nhật thông tin thể trạng định kỳ.

---

## 🛠️ Công nghệ sử dụng

| Loại | Công nghệ |
|---|---|
| Frontend | React 19 + Vite |
| Styling | Tailwind CSS v4 |
| Routing | React Router v7 |
| Biểu đồ | Recharts |
| Icon | Lucide React |
| Backend | Node.js + Express *(kế hoạch)* |
| Database | PostgreSQL / Supabase *(kế hoạch)* |
| Lưu trữ ảnh | Supabase Storage / Cloudinary *(kế hoạch)* |
| Xác thực | JWT / Supabase Auth *(kế hoạch)* |
| Hosting | GitHub Pages |

### Định hướng phát triển hệ thống

Có thể sử dụng **Supabase** để tích hợp:

- PostgreSQL Database.
- Authentication.
- Storage lưu trữ hình ảnh.

Giải pháp này giúp đơn giản hóa việc phát triển backend trong giai đoạn đầu, đồng thời hỗ trợ mở rộng hệ thống khi số lượng khách hàng tăng lên.

---

## 🚀 Bắt đầu nhanh

### Yêu cầu

- Node.js >= 18
- npm

### Cài đặt

```bash
# Clone dự án
git clone https://github.com/ducthang186/gym_tracking.git

# Di chuyển vào thư mục dự án
cd gym_tracking

# Cài đặt dependencies
npm install

# Chạy môi trường phát triển
npm run dev
```

Mở trình duyệt tại:

```text
http://localhost:5173/gym_tracking/
```

---

### Build Production

```bash
# Build dự án
npm run build

# Xem trước bản build production
npm run preview
```

Thư mục build:

```text
dist/
```

### Deploy lên GitHub Pages

```bash
npm run deploy
```

Lệnh trên thực hiện build dự án và deploy thư mục `dist/` lên nhánh `gh-pages`.

---

## 📁 Cấu trúc thư mục

```text
.
├── public/
│   ├── favicon
│   └── 404.html
│
├── src/
│   ├── assets/
│   │   └── Ảnh, font, icon
│   │
│   ├── components/
│   │   ├── Layout.jsx
│   │   └── StatCard.jsx
│   │
│   ├── pages/
│   │   ├── Landing.jsx
│   │   ├── Dashboard.jsx
│   │   ├── MealPlan.jsx
│   │   ├── Workout.jsx
│   │   ├── Progress.jsx
│   │   └── Profile.jsx
│   │
│   ├── data/
│   │   └── Dữ liệu món ăn và bài tập
│   │
│   ├── index.css
│   ├── App.jsx
│   └── main.jsx
│
├── vite.config.js
├── package.json
└── README.md
```

---

## 📜 Scripts

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Chạy server phát triển |
| `npm run build` | Build dự án production |
| `npm run preview` | Xem trước bản build |
| `npm run deploy` | Deploy lên GitHub Pages |
| `npm run lint` | Kiểm tra lỗi code style |

---

## 🗺️ Lộ trình phát triển

### Giai đoạn 1 — Giao diện và trải nghiệm người dùng

- [x] Xây dựng landing page giới thiệu PT Trung Phạm.
- [x] Xây dựng giao diện ứng dụng Fitness.
- [x] Hiển thị dữ liệu mẫu về dinh dưỡng và tập luyện.
- [x] Xây dựng dashboard theo dõi tiến trình.
- [x] Responsive cho desktop và mobile.

### Giai đoạn 2 — Hệ thống khách hàng

- [ ] Kết nối database Supabase.
- [ ] Đăng ký và đăng nhập tài khoản.
- [ ] Phân quyền PT và khách hàng.
- [ ] Quản lý thông tin khách hàng.
- [ ] Quản lý khóa tập và gói dịch vụ.
- [ ] Lưu trữ lịch tập và chế độ ăn cá nhân.

### Giai đoạn 3 — Theo dõi tiến trình

- [ ] Upload ảnh before/after.
- [ ] Theo dõi cân nặng theo thời gian.
- [ ] Cập nhật số đo cơ thể hàng tuần.
- [ ] Quản lý lịch tập cá nhân.
- [ ] Tính toán và đề xuất meal plan theo mục tiêu.
- [ ] Theo dõi tiến độ hoàn thành kế hoạch.

### Giai đoạn 4 — Mở rộng hệ thống

- [ ] Dashboard quản lý dành cho PT.
- [ ] Quản lý nhiều khách hàng.
- [ ] Gửi thông báo và nhắc lịch tập.
- [ ] Xuất báo cáo tiến độ PDF.
- [ ] Tích hợp thanh toán khóa tập.
- [ ] Tối ưu SEO và triển khai website production.

---

## 🤝 Đóng góp

Đóng góp và đề xuất cải tiến luôn được chào đón!

1. Fork dự án.
2. Tạo branch mới:

```bash
git checkout -b feature/ten-tinh-nang
```

3. Commit thay đổi:

```bash
git commit -m "Thêm tính năng X"
```

4. Push lên repository:

```bash
git push origin feature/ten-tinh-nang
```

5. Mở Pull Request.

---

## 📄 Giấy phép

Dự án sử dụng giấy phép MIT.

---

<p align="center">
  Made with ❤️ for Trung Phạm Fitness
</p>

<p align="center">
  <a href="https://github.com/ducthang186">
    GitHub — ducthang186
  </a>
</p>