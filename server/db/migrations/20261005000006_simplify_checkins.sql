-- migrate:up
-- Check-in tuần chỉ cần biết "tuần này có tập hay không" (thay cho 5 thang điểm). Theo dõi thay đổi dựa vào ảnh.
alter table weekly_checkins add column trained boolean;
update weekly_checkins set trained = (workout_adherence >= 2);
alter table weekly_checkins
  alter column trained set not null,
  drop column energy,
  drop column sleep,
  drop column hunger,
  drop column nutrition_adherence,
  drop column workout_adherence;

-- migrate:down
alter table weekly_checkins
  add column energy              smallint not null default 3 check (energy between 1 and 5),
  add column sleep               smallint not null default 3 check (sleep between 1 and 5),
  add column hunger              smallint not null default 3 check (hunger between 1 and 5),
  add column nutrition_adherence smallint not null default 3 check (nutrition_adherence between 1 and 5),
  add column workout_adherence   smallint not null default 3 check (workout_adherence between 1 and 5);
update weekly_checkins set workout_adherence = case when trained then 4 else 1 end;
alter table weekly_checkins drop column trained;
