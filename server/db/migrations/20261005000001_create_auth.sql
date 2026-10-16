-- migrate:up
create extension if not exists citext;

create type user_role      as enum ('client', 'coach', 'admin');
create type account_status as enum ('pending', 'active', 'suspended');
create type client_status  as enum ('active', 'paused', 'ended');

create table users (
  id            uuid primary key default gen_random_uuid(),
  email         citext unique not null,
  phone         text   unique not null,
  password_hash text   not null,
  role          user_role      not null default 'client',
  status        account_status not null default 'active',
  failed_logins smallint       not null default 0,
  locked_until  timestamptz,
  last_login_at timestamptz,
  created_at    timestamptz    not null default now(),
  constraint users_phone_format check (phone ~ '^\+84[35789][0-9]{8}$')
);

create table profiles (
  id         uuid primary key references users(id) on delete cascade,
  full_name  text          not null,
  avatar_key text,
  gender     text check (gender in ('male', 'female', 'other')),
  birth_date date,
  height_cm  numeric(5,1),
  timezone   text          not null default 'Asia/Ho_Chi_Minh',
  coach_id   uuid          references profiles(id) on delete set null,
  status     client_status not null default 'active',
  package    text,
  created_at timestamptz   not null default now()
);
create index profiles_coach_id_idx on profiles (coach_id) where coach_id is not null;

create table refresh_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  family_id  uuid not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  revoked_at timestamptz,
  user_agent text,
  ip         inet,
  created_at timestamptz not null default now()
);
create index refresh_tokens_user_id_idx    on refresh_tokens (user_id);
create index refresh_tokens_family_id_idx  on refresh_tokens (family_id);
create index refresh_tokens_expires_at_idx on refresh_tokens (expires_at);

create type auth_token_type as enum ('reset_password');

create table auth_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  type       auth_token_type not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index auth_tokens_expires_at_idx on auth_tokens (expires_at);

create table audit_log (
  id             bigint generated always as identity primary key,
  actor_id       uuid references users(id) on delete set null,
  target_user_id uuid references users(id) on delete set null,
  action         text not null,
  meta           jsonb,
  ip             inet,
  created_at     timestamptz not null default now()
);
create index audit_log_target_idx on audit_log (target_user_id, created_at desc);
create index audit_log_actor_idx  on audit_log (actor_id, created_at desc);

-- migrate:down
drop table if exists audit_log;
drop table if exists auth_tokens;
drop type  if exists auth_token_type;
drop table if exists refresh_tokens;
drop table if exists profiles;
drop table if exists users;
drop type  if exists client_status;
drop type  if exists account_status;
drop type  if exists user_role;
