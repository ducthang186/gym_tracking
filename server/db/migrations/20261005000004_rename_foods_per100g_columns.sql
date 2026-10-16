-- migrate:up
-- CamelCasePlugin đổi `kcalPer100g` → `kcal_per100g` khi ghi (không tách số), nên đặt tên cột theo đúng quy tắc đó
-- để đọc và ghi đối xứng.
alter table foods rename column kcal_per_100g    to kcal_per100g;
alter table foods rename column protein_per_100g to protein_per100g;
alter table foods rename column carbs_per_100g   to carbs_per100g;
alter table foods rename column fat_per_100g     to fat_per100g;

-- migrate:down
alter table foods rename column kcal_per100g    to kcal_per_100g;
alter table foods rename column protein_per100g to protein_per_100g;
alter table foods rename column carbs_per100g   to carbs_per_100g;
alter table foods rename column fat_per100g     to fat_per_100g;
