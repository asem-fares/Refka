-- Refka v1 schema. Runs unchanged on Supabase (Postgres 15+) and on local Postgres 16 after tests/local_prelude.sql.
-- Re-runnable: tables and indexes use "if not exists" (a re-run never changes an existing table; write a new
-- migration for that).
-- Rule: the front end never touches tables. RLS is enabled on every table with NO policies and all table
-- privileges are revoked from anon and authenticated. Every read and write goes through a function in 0002.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- gyms
create table if not exists public.gyms (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique
              check (slug ~ '^[a-z0-9]([a-z0-9-]{1,28})[a-z0-9]$' and slug !~ '--'),
  name        text not null check (char_length(name) between 2 and 60),
  name_ar     text check (name_ar is null or char_length(name_ar) <= 60),
  country     text not null default 'EG',
  currency    text not null default 'EGP',
  brand       jsonb not null default '{}'::jsonb,
  settings    jsonb not null default '{"cross": true, "posts": "all"}'::jsonb,
  pay         jsonb not null default '{"cash": false}'::jsonb,
  status      text not null default 'draft' check (status in ('draft','live')),
  owner_id    uuid not null references auth.users(id) on delete restrict,
  qr_secret   text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  created_at  timestamptz not null default now()
);
create unique index if not exists gyms_owner_uq on public.gyms(owner_id);   -- one gym per owner in v1

create table if not exists public.gym_staff (
  gym_id  uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role    text not null default 'owner' check (role in ('owner')),
  name    text,
  primary key (gym_id, user_id)
);

-- ---------------------------------------------------------------- packages
create table if not exists public.packages (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid not null references public.gyms(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 60),
  name_ar      text check (name_ar is null or char_length(name_ar) <= 60),
  months       int  not null check (months between 1 and 36),
  price        int  not null check (price > 0 and price <= 10000000),
  before_price int  check (before_price is null or before_price > price),
  until        date,
  active       boolean not null default true,
  sort         int not null default 0,
  deleted_at   timestamptz,                      -- soft delete so old memberships and payments keep their package
  created_at   timestamptz not null default now(),
  check (before_price is null or until is not null)
);
create index if not exists packages_gym_ix on public.packages(gym_id, sort);

-- ---------------------------------------------------------------- memberships
create table if not exists public.memberships (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  phone      text not null check (phone ~ '^\+[0-9]{10,15}$'),
  name       text not null check (char_length(name) between 2 and 60),
  gender     text check (gender in ('m','f')),
  package_id uuid references public.packages(id) on delete set null,
  starts     date,
  ends       date,
  user_id    uuid references auth.users(id) on delete set null,
  status     text not null default 'listed' check (status in ('listed','active','guest')),
  qr_used_bucket bigint,                         -- replay protection for the rotating QR
  qr_used_at     timestamptz,
  created_at timestamptz not null default now(),
  unique (gym_id, phone),
  check (status = 'listed' or user_id is not null),
  check (status <> 'listed' or user_id is null)
);
create unique index if not exists memberships_gym_user_uq on public.memberships(gym_id, user_id) where user_id is not null;
create index if not exists memberships_user_ix on public.memberships(user_id) where user_id is not null;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  phone      text not null unique check (phone ~ '^\+[0-9]{10,15}$'),
  name       text not null check (char_length(name) between 2 and 60),
  gender     text not null check (gender in ('m','f')),
  birth_year int  not null check (birth_year between 1900 and 2100),
  bio        text check (bio is null or char_length(bio) <= 300),
  goal       text check (goal is null or char_length(goal) <= 40),
  level      text check (level is null or char_length(level) <= 40),
  times      text[] not null default '{}',
  vis        text not null check (vis in ('all','gender','none')),
  avatar     text check (avatar is null or char_length(avatar) <= 56000),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- payments
create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  package_id    uuid references public.packages(id) on delete set null,
  amount        int not null check (amount > 0),
  method        text not null check (method in ('instapay','wallet','cash')),
  ref           text check (ref is null or char_length(ref) <= 60),
  status        text not null default 'pending' check (status in ('pending','ok','rejected')),
  created_at    timestamptz not null default now(),
  decided_by    uuid references auth.users(id) on delete set null,
  decided_at    timestamptz
);
create unique index if not exists payments_one_pending_uq on public.payments(membership_id) where status = 'pending';
create index if not exists payments_gym_ix on public.payments(gym_id, status, created_at);

-- ---------------------------------------------------------------- checkins
create table if not exists public.checkins (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  at            timestamptz not null default now(),
  via           text not null check (via in ('qr','desk'))
);
create index if not exists checkins_gym_at_ix on public.checkins(gym_id, at desc);
create index if not exists checkins_membership_ix on public.checkins(membership_id, at desc);

-- ---------------------------------------------------------------- requests
create table if not exists public.requests (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  from_user  uuid not null references auth.users(id) on delete cascade,
  to_user    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('train','spot')),
  slot       text check (slot is null or char_length(slot) <= 40),
  status     text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check (from_user <> to_user)
);
create unique index if not exists requests_one_pending_uq on public.requests(gym_id, from_user, to_user) where status = 'pending';
create index if not exists requests_to_ix on public.requests(to_user, gym_id, status);
create index if not exists requests_from_ix on public.requests(from_user, created_at desc);

-- ---------------------------------------------------------------- refkas
create table if not exists public.refkas (
  id        uuid primary key default gen_random_uuid(),
  gym_id    uuid not null references public.gyms(id) on delete cascade,
  a         uuid not null references auth.users(id) on delete cascade,
  b         uuid not null references auth.users(id) on delete cascade,
  since     timestamptz not null default now(),
  ended_at  timestamptz,
  a_read_at timestamptz,                         -- read markers for unread counts
  b_read_at timestamptz,
  check (a < b)
);
create unique index if not exists refkas_one_open_uq on public.refkas(gym_id, a, b) where ended_at is null;
create index if not exists refkas_a_ix on public.refkas(a);
create index if not exists refkas_b_ix on public.refkas(b);

create table if not exists public.messages (
  id        uuid primary key default gen_random_uuid(),
  refka_id  uuid not null references public.refkas(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade,
  body      text not null check (char_length(body) between 1 and 1000),
  at        timestamptz not null default now()
);
create index if not exists messages_refka_ix on public.messages(refka_id, at);
create index if not exists messages_from_ix on public.messages(from_user, at desc);

-- ---------------------------------------------------------------- blocks, posts, reports
create table if not exists public.blocks (
  blocker uuid not null references auth.users(id) on delete cascade,
  blocked uuid not null references auth.users(id) on delete cascade,
  at      timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index if not exists blocks_blocked_ix on public.blocks(blocked);

create table if not exists public.posts (
  id      uuid primary key default gen_random_uuid(),
  gym_id  uuid not null references public.gyms(id) on delete cascade,
  by_user uuid not null references auth.users(id) on delete cascade,
  body    text not null check (char_length(body) <= 500),
  img     text check (img is null or char_length(img) <= 205000),
  status  text not null default 'live' check (status in ('live','pending','hidden')),
  at      timestamptz not null default now(),
  check (char_length(body) >= 1 or img is not null)
);
create index if not exists posts_gym_at_ix on public.posts(gym_id, at desc);
create index if not exists posts_by_ix on public.posts(by_user, at desc);

create table if not exists public.post_respects (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  at      timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.reports (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  by_user    uuid not null references auth.users(id) on delete cascade,
  about_user uuid references auth.users(id) on delete set null,
  about_post uuid references public.posts(id) on delete set null,
  reason     text not null check (char_length(reason) between 1 and 500),
  status     text not null default 'open' check (status in ('open','done')),
  at         timestamptz not null default now()
);
create index if not exists reports_gym_ix on public.reports(gym_id, status, at);

-- ---------------------------------------------------------------- lock everything down
do $$
declare t text;
begin
  foreach t in array array['gyms','gym_staff','packages','memberships','profiles','payments','checkins',
                           'requests','refkas','messages','blocks','posts','post_respects','reports']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
  end loop;
end $$;
