-- migrate:up
create table foods (
  id               uuid primary key default gen_random_uuid(),
  name             text         not null check (length(name) between 1 and 120),
  kcal_per_100g    numeric(6,1) not null check (kcal_per_100g between 0 and 1000),
  protein_per_100g numeric(5,1) not null default 0 check (protein_per_100g between 0 and 100),
  carbs_per_100g   numeric(5,1) not null default 0 check (carbs_per_100g between 0 and 100),
  fat_per_100g     numeric(5,1) not null default 0 check (fat_per_100g between 0 and 100),
  is_archived      boolean      not null default false, -- xoá mềm: nhật ký cũ vẫn giữ nguyên
  created_by       uuid references users(id) on delete set null,
  created_at       timestamptz  not null default now()
);
create unique index foods_name_active_uq on foods (lower(name)) where not is_archived;

create type meal_slot as enum ('breakfast', 'lunch', 'dinner', 'snack');

create table food_log_entries (
  id                bigint generated always as identity primary key,
  user_id           uuid      not null references users(id) on delete cascade,
  logged_on         date      not null,           -- ngày theo giờ địa phương của người dùng
  slot              meal_slot not null default 'snack',
  food_id           uuid references foods(id) on delete set null,
  -- ảnh chụp giá trị tại thời điểm ghi: sửa/xoá món sau này không làm lệch nhật ký cũ
  food_name         text         not null,
  grams             numeric(7,1) not null check (grams > 0 and grams <= 5000),
  kcal              numeric(7,1) not null check (kcal >= 0),
  protein_g         numeric(6,1) not null default 0,
  carbs_g           numeric(6,1) not null default 0,
  fat_g             numeric(6,1) not null default 0,
  client_request_id uuid,                          -- chống ghi trùng khi client gửi lại request
  created_at        timestamptz  not null default now(),
  unique (user_id, client_request_id)
);
create index food_log_entries_user_day_idx on food_log_entries (user_id, logged_on);

-- Dữ liệu ban đầu (giá trị trung bình trên 100g).
insert into foods (name, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g) values
  ('Cơm trắng', 130, 2.7, 28, 0.3),
  ('Cơm gạo lứt', 123, 2.7, 26, 1),
  ('Ức gà (luộc, không da)', 165, 31, 0, 3.6),
  ('Thịt bò nạc', 250, 26, 0, 15),
  ('Thịt heo nạc', 242, 27, 0, 14),
  ('Cá hồi', 208, 20, 0, 13),
  ('Trứng gà (luộc)', 155, 13, 1.1, 11),
  ('Sữa chua Hy Lạp (không đường)', 59, 10, 3.6, 0.4),
  ('Yến mạch (khô)', 389, 17, 66, 7),
  ('Khoai lang (luộc)', 86, 1.6, 20, 0.1),
  ('Khoai tây (luộc)', 87, 1.9, 20, 0.1),
  ('Chuối', 89, 1.1, 23, 0.3),
  ('Táo', 52, 0.3, 14, 0.2),
  ('Rau xanh (bông cải, cải bó xôi...)', 25, 2.5, 4, 0.3),
  ('Bánh mì trắng', 265, 9, 49, 3.2),
  ('Whey protein (bột)', 380, 80, 8, 5),
  ('Hạt óc chó', 654, 15, 14, 65),
  ('Dầu ô liu', 884, 0, 0, 100);

-- migrate:down
drop table food_log_entries;
drop type meal_slot;
drop table foods;
