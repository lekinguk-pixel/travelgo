-- mmGO core schema: the world (continents > countries > cities > landmarks),
-- players, stamps, XP and skills, social (friends, clans), quests and city awards.

create extension if not exists citext with schema extensions;

-- ---------- enums ----------
create type public.rarity as enum ('common', 'uncommon', 'rare', 'epic', 'legendary');
create type public.stamp_status as enum ('verified', 'pending_review', 'rejected');
create type public.skill as enum ('explorer', 'wanderer', 'culture', 'nature', 'foodie', 'pilgrim');
create type public.group_role as enum ('leader', 'member');
create type public.city_tier as enum ('bronze', 'silver', 'gold');

-- ---------- the world ----------
create table public.continents (
  code text primary key,
  name text not null unique
);

create table public.countries (
  code text primary key,                      -- ISO 3166-1 alpha-2, e.g. GB
  name text not null,
  continent_code text not null references public.continents (code)
);
create index countries_continent_idx on public.countries (continent_code);

create table public.cities (
  id bigint generated always as identity primary key,
  name text not null,
  region text,                                -- e.g. England, Scotland
  country_code text not null references public.countries (code),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  created_at timestamptz not null default now(),
  unique (name, country_code)
);
create index cities_country_idx on public.cities (country_code);

create table public.landmarks (
  id bigint generated always as identity primary key,
  city_id bigint not null references public.cities (id) on delete cascade,
  name text not null,
  description text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  radius_m integer not null default 150 check (radius_m between 25 and 2000),
  rarity public.rarity not null default 'common',
  is_major boolean not null default true,     -- counts toward bronze/silver/gold
  skills public.skill[] not null default '{explorer}',
  osm_id text,
  wikidata_id text,
  location_verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (city_id, name)
);
create index landmarks_city_idx on public.landmarks (city_id);

-- ---------- players ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  traveller_name extensions.citext not null unique
    check (traveller_name ~ '^[A-Za-z0-9_]{3,16}$'),
  avatar jsonb not null default '{"hat": "#C8553D", "coat": "#2A7F75", "pack": "#B5784A"}',
  home_city_id bigint references public.cities (id),
  total_xp bigint not null default 0,
  created_at timestamptz not null default now()
);
create index profiles_home_city_idx on public.profiles (home_city_id);

-- Kept apart from profiles so it is never readable by other players.
create table public.profile_private (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  date_of_birth date not null,
  created_at timestamptz not null default now()
);

-- ---------- XP and skills ----------
-- RuneScape-style curve, scaled down 10x: level 99 needs about 1.3M XP.
create table public.skill_levels (
  level integer primary key check (level between 1 and 99),
  xp_required bigint not null
);
insert into public.skill_levels (level, xp_required)
select l, floor(coalesce((
  select sum(floor(n + 300 * power(2, n / 7.0))) from generate_series(1, l - 1) n
), 0) / 4 / 10)::bigint
from generate_series(1, 99) l;

create table public.skill_xp (
  user_id uuid not null references public.profiles (id) on delete cascade,
  skill public.skill not null,
  xp bigint not null default 0,
  primary key (user_id, skill)
);

-- ---------- stamps ----------
create table public.stamps (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  landmark_id bigint not null references public.landmarks (id) on delete cascade,
  photo_path text not null,
  claimed_at timestamptz not null default now(),
  lat double precision not null,
  lng double precision not null,
  accuracy_m real,
  distance_m real not null,
  status public.stamp_status not null default 'verified',
  review_note text,
  xp_awarded integer not null default 0,
  unique (user_id, landmark_id)
);
create index stamps_landmark_idx on public.stamps (landmark_id);
create index stamps_user_time_idx on public.stamps (user_id, claimed_at desc);

-- Ledger of every XP gain; leaderboards for any period are built from this.
create table public.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount > 0),
  skill public.skill,
  reason text not null,
  stamp_id bigint references public.stamps (id) on delete cascade,
  city_id bigint references public.cities (id) on delete set null,
  created_at timestamptz not null default now()
);
create index xp_events_user_idx on public.xp_events (user_id, created_at desc);
create index xp_events_time_idx on public.xp_events (created_at);
create index xp_events_city_idx on public.xp_events (city_id, created_at);
create index xp_events_stamp_idx on public.xp_events (stamp_id);

create table public.stamp_reports (
  stamp_id bigint not null references public.stamps (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now(),
  primary key (stamp_id, reporter_id)
);
create index stamp_reports_reporter_idx on public.stamp_reports (reporter_id);

-- ---------- chapters completed ----------
create table public.city_awards (
  user_id uuid not null references public.profiles (id) on delete cascade,
  city_id bigint not null references public.cities (id) on delete cascade,
  tier public.city_tier not null,
  awarded_at timestamptz not null default now(),
  primary key (user_id, city_id, tier)
);
create index city_awards_city_idx on public.city_awards (city_id);

-- ---------- quests ----------
create table public.quests (
  id bigint generated always as identity primary key,
  city_id bigint not null references public.cities (id) on delete cascade,
  name text not null,
  description text,
  xp_reward integer not null default 500 check (xp_reward > 0),
  unique (city_id, name)
);

create table public.quest_steps (
  quest_id bigint not null references public.quests (id) on delete cascade,
  landmark_id bigint not null references public.landmarks (id) on delete cascade,
  position integer not null,
  primary key (quest_id, landmark_id)
);
create index quest_steps_landmark_idx on public.quest_steps (landmark_id);

create table public.quest_completions (
  quest_id bigint not null references public.quests (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (quest_id, user_id)
);
create index quest_completions_user_idx on public.quest_completions (user_id);

-- ---------- social ----------
create table public.friendships (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create index friendships_addressee_idx on public.friendships (addressee_id);

create table public.groups (
  id bigint generated always as identity primary key,
  name extensions.citext not null unique check (char_length(name) between 3 and 30),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index groups_created_by_idx on public.groups (created_by);

create table public.group_members (
  group_id bigint not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.group_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);
