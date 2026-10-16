-- migrate:up
create type photo_angle as enum ('front', 'side', 'back');

-- Ảnh lưu trên đĩa máy chủ (đã xử lý, không EXIF); DB chỉ giữ siêu dữ liệu và khoá tệp.
create table progress_photos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references users(id) on delete cascade,
  taken_on   date        not null,
  angle      photo_angle not null,
  full_key   text        not null,
  thumb_key  text        not null,
  bytes      integer     not null,
  created_at timestamptz not null default now()
);
create index progress_photos_user_idx on progress_photos (user_id, taken_on desc, created_at desc);

-- Check-in hàng tuần: mỗi người một dòng mỗi tuần (week_start = thứ Hai).
create table weekly_checkins (
  id                  bigint generated always as identity primary key,
  user_id             uuid     not null references users(id) on delete cascade,
  week_start          date     not null check (extract(isodow from week_start) = 1),
  energy              smallint not null check (energy between 1 and 5),
  sleep               smallint not null check (sleep between 1 and 5),
  hunger              smallint not null check (hunger between 1 and 5),
  nutrition_adherence smallint not null check (nutrition_adherence between 1 and 5),
  workout_adherence   smallint not null check (workout_adherence between 1 and 5),
  note                text check (length(note) <= 1000),
  coach_note          text check (length(coach_note) <= 1000),
  coach_note_by       uuid references users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, week_start)
);

-- migrate:down
drop table weekly_checkins;
drop table progress_photos;
drop type photo_angle;
