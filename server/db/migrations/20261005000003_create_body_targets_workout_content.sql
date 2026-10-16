-- migrate:up

-- ===== Hồ sơ: thêm trường phục vụ tính BMI / nhu cầu năng lượng =====
alter table profiles
  add column target_weight_kg numeric(5,1) check (target_weight_kg between 20 and 400),
  add column activity_level   text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  add constraint profiles_height_range check (height_cm is null or height_cm between 80 and 250),
  add constraint profiles_birth_range  check (birth_date is null or birth_date between date '1900-01-01' and date '2100-01-01');

-- ===== Chỉ số cơ thể: mỗi người một dòng mỗi ngày =====
create table body_metrics (
  id           bigint generated always as identity primary key,
  user_id      uuid          not null references users(id) on delete cascade,
  measured_on  date          not null,
  weight_kg    numeric(5,1)  not null check (weight_kg between 20 and 400),
  body_fat_pct numeric(4,1)  check (body_fat_pct between 2 and 70),
  waist_cm     numeric(5,1)  check (waist_cm between 30 and 250),
  note         text          check (length(note) <= 500),
  created_at   timestamptz   not null default now(),
  updated_at   timestamptz   not null default now(),
  unique (user_id, measured_on)
);

-- ===== Mục tiêu dinh dưỡng: lịch sử theo ngày hiệu lực; mục tiêu hiện hành = dòng mới nhất <= ngày xem =====
create table nutrition_targets (
  id             bigint generated always as identity primary key,
  user_id        uuid     not null references users(id) on delete cascade,
  effective_from date     not null,
  kcal           smallint not null check (kcal between 800 and 6000),
  protein_g      smallint not null check (protein_g between 0 and 500),
  carbs_g        smallint not null check (carbs_g between 0 and 1000),
  fat_g          smallint not null check (fat_g between 0 and 400),
  set_by         uuid references users(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (user_id, effective_from)
);

-- ===== Giáo án tuần (dùng chung cho mọi học viên; giáo án riêng từng người làm sau) =====
create table workout_plan_days (
  weekday    smallint primary key check (weekday between 1 and 7), -- 1 = Thứ 2 ... 7 = Chủ nhật
  name       text        not null check (length(name) between 1 and 80),
  updated_by uuid references users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table workout_plan_items (
  id       bigint generated always as identity primary key,
  weekday  smallint not null references workout_plan_days(weekday) on delete cascade,
  position smallint not null,
  name     text     not null check (length(name) between 1 and 120),
  sets     smallint check (sets between 1 and 20),
  reps     text     check (length(reps) <= 20),
  unique (weekday, position)
);

insert into workout_plan_days (weekday, name) values
  (1, 'Ngực + Tay sau'), (2, 'Lưng + Tay trước'), (3, 'Nghỉ / Cardio nhẹ'), (4, 'Vai'),
  (5, 'Chân'), (6, 'Full body nhẹ'), (7, 'Nghỉ ngơi');

insert into workout_plan_items (weekday, position, name, sets, reps) values
  (1, 1, 'Bench Press', 4, '8'), (1, 2, 'Incline Dumbbell Press', 3, '10'), (1, 3, 'Tricep Pushdown', 3, '12'),
  (2, 1, 'Deadlift', 4, '6'), (2, 2, 'Lat Pulldown', 3, '10'), (2, 3, 'Barbell Curl', 3, '12'),
  (3, 1, 'Đi bộ nhanh 30 phút', null, null),
  (4, 1, 'Overhead Press', 4, '8'), (4, 2, 'Lateral Raise', 3, '15'), (4, 3, 'Face Pull', 3, '15'),
  (5, 1, 'Squat', 4, '8'), (5, 2, 'Leg Press', 3, '10'), (5, 3, 'Leg Curl', 3, '12'),
  (6, 1, 'Circuit training 20 phút', null, null);

-- ===== Nhật ký tập: mỗi dòng là một hiệp =====
create table workout_sets (
  id                bigint generated always as identity primary key,
  user_id           uuid          not null references users(id) on delete cascade,
  performed_on      date          not null,
  exercise_name     text          not null check (length(exercise_name) between 1 and 120),
  reps              smallint      not null check (reps between 1 and 500),
  weight_kg         numeric(6,1)  not null default 0 check (weight_kg between 0 and 1000), -- 0 = bodyweight
  client_request_id uuid,
  created_at        timestamptz   not null default now(),
  unique (user_id, client_request_id)
);
create index workout_sets_user_day_idx      on workout_sets (user_id, performed_on);
create index workout_sets_user_exercise_idx on workout_sets (user_id, exercise_name, performed_on desc);

-- ===== Nội dung trang giới thiệu do admin chỉnh =====
create table site_content (
  key        text primary key check (key in ('about')),
  data       jsonb       not null,
  updated_by uuid references users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Ảnh PT lưu thẳng trong database (đã resize, vài trăm KB): đi cùng backup, không cần thư mục riêng.
create table site_assets (
  key          text primary key check (key in ('coach_photo')),
  content_type text        not null,
  data         bytea       not null,
  updated_at   timestamptz not null default now()
);

insert into site_content (key, data) values ('about', $json$
{
  "name": "Trung Phạm",
  "title": "Founder & Head Coach",
  "bio": "Tôi xây dựng LATIS sau nhiều năm huấn luyện trực tiếp và nhận ra một vấn đề lặp lại: học viên tiến bộ chậm không phải vì thiếu nỗ lực, mà vì thiếu dữ liệu để biết khi nào cần điều chỉnh. LATIS là hệ thống tôi dùng để coaching từng học viên — tập luyện, dinh dưỡng và tiến độ đều được theo dõi bằng số liệu thật, không đoán mò.",
  "quote": "Không cần đoán bạn đang tiến bộ hay không — dữ liệu sẽ nói cho bạn biết.",
  "badge": { "title": "HLV tiêu biểu", "subtitle": "Fitness Summit 2024" },
  "stats": [
    { "value": "200+", "label": "Học viên đã huấn luyện" },
    { "value": "7 năm", "label": "Kinh nghiệm coaching" },
    { "value": "1,200+", "label": "Buổi coaching 1:1" },
    { "value": "94%", "label": "Tỷ lệ đạt mục tiêu" }
  ],
  "achievements": [
    { "title": "Chứng chỉ PT Quốc tế (ACE)", "desc": "Được công nhận chuyên môn huấn luyện cá nhân theo chuẩn quốc tế." },
    { "title": "Chuyên gia dinh dưỡng thể hình", "desc": "Xây dựng meal plan khoa học, cá nhân hóa theo mục tiêu từng học viên." },
    { "title": "Huấn luyện viên tiêu biểu 2024", "desc": "Được vinh danh tại sự kiện Fitness Summit nhờ kết quả học viên nổi bật." },
    { "title": "200+ học viên thành công", "desc": "Đồng hành cùng học viên từ người mới bắt đầu đến vận động viên thi đấu." }
  ]
}
$json$::jsonb);

-- migrate:down
drop table site_assets;
drop table site_content;
drop table workout_sets;
drop table workout_plan_items;
drop table workout_plan_days;
drop table nutrition_targets;
drop table body_metrics;
alter table profiles
  drop constraint profiles_birth_range,
  drop constraint profiles_height_range,
  drop column activity_level,
  drop column target_weight_kg;
