-- The digital journey: an idle/tap side game. The player's traveller journeys
-- between mmGO's cities in (sped-up) real time, even while the app is closed.
-- It earns its own rewards only (coins, postcards, shop outfits) and never XP
-- or leaderboard places. Real stamps and medals make the traveller faster, and
-- unlock bikes, trains and a pilot's licence.
-- All progress is worked out here from timestamps, so taps and idle time can't be faked.

create table public.journeys (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  city_id bigint not null references public.cities (id),          -- where the traveller is (or set off from)
  to_city_id bigint references public.cities (id),                -- heading to, if travelling
  route_km double precision not null default 0,
  progress_km double precision not null default 0,
  coins bigint not null default 0 check (coins >= 0),
  total_km double precision not null default 0,
  taps bigint not null default 0,
  boots integer not null default 0 check (boots between 0 and 10),
  companion integer not null default 0 check (companion between 0 and 10),
  last_sync timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.postcards (
  user_id uuid not null references public.profiles (id) on delete cascade,
  city_id bigint not null references public.cities (id) on delete cascade,
  first_at timestamptz not null default now(),
  visits integer not null default 1,
  primary key (user_id, city_id)
);

alter table public.journeys enable row level security;
alter table public.postcards enable row level security;
create policy "Players see their own journey" on public.journeys for select using (user_id = auth.uid());
create policy "Players see their own postcards" on public.postcards for select using (user_id = auth.uid());
revoke insert, update, delete on public.journeys, public.postcards from anon, authenticated;

-- How much the player's real travels power the digital journey.
create or replace function public._journey_boost(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with s as (
    select count(*) as stamps, count(distinct c.country_code) as countries
    from public.stamps st join public.landmarks l on l.id = st.landmark_id join public.cities c on c.id = l.city_id
    where st.user_id = p_user and st.status = 'verified'
  ), best as (
    select city_id, max(case tier when 'gold' then 3 when 'silver' then 2 else 1 end) as t
    from public.city_awards where user_id = p_user group by city_id
  ), m as (
    select count(*) filter (where t = 1) as bronze, count(*) filter (where t = 2) as silver, count(*) filter (where t = 3) as gold from best
  )
  select jsonb_build_object(
    'stamps', s.stamps, 'countries', s.countries, 'bronze', m.bronze, 'silver', m.silver, 'gold', m.gold,
    'multiplier', round(least(5, 1 + 0.02 * least(s.stamps, 100) + 0.1 * m.bronze + 0.15 * m.silver + 0.25 * m.gold)::numeric, 2),
    'bike', s.stamps >= 5, 'train', (m.bronze + m.silver + m.gold) >= 1, 'pilot', s.countries >= 2)
  from s, m;
$$;

-- Speed (km per hour) and km per tap for a route, given the boost and upgrades.
create or replace function public._journey_pace(p_route_km double precision, p_boost jsonb, p_boots integer, p_companion integer)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare v_mode text; v_base double precision; v_mult double precision := (p_boost->>'multiplier')::double precision;
begin
  if p_route_km > 800 then v_mode := 'plane'; v_base := case when (p_boost->>'pilot')::boolean then 500 else 250 end;
  elsif (p_boost->>'train')::boolean then v_mode := 'train'; v_base := 80;
  elsif (p_boost->>'bike')::boolean then v_mode := 'bike'; v_base := 25;
  else v_mode := 'walk'; v_base := 12; end if;
  return jsonb_build_object('mode', v_mode,
    'kmh', round((v_base * v_mult * (1 + 0.2 * p_companion))::numeric, 1),
    'tap_km', round((0.04 * (1 + 0.5 * p_boots) * case when v_mode = 'plane' then 5 else 1 end * v_mult)::numeric, 3));
end;
$$;

create or replace function public._journey_view(j public.journeys, p_arrival jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_boost jsonb := public._journey_boost(j.user_id); v_pace jsonb; v_left double precision;
begin
  v_pace := public._journey_pace(j.route_km, v_boost, j.boots, j.companion);
  v_left := greatest(0, j.route_km - j.progress_km);
  return jsonb_build_object(
    'city', (select jsonb_build_object('id', c.id, 'name', c.name, 'country', co.name, 'photo', c.photo_thumb_url) from public.cities c join public.countries co on co.code = c.country_code where c.id = j.city_id),
    'to', (select jsonb_build_object('id', c.id, 'name', c.name, 'country', co.name, 'photo', c.photo_thumb_url) from public.cities c join public.countries co on co.code = c.country_code where c.id = j.to_city_id),
    'route_km', round(j.route_km::numeric, 1), 'progress_km', round(j.progress_km::numeric, 2), 'left_km', round(v_left::numeric, 1),
    'eta_minutes', case when j.to_city_id is null then null else ceil(v_left / greatest(0.1, (v_pace->>'kmh')::double precision) * 60) end,
    'mode', case when j.to_city_id is null then 'parked' else v_pace->>'mode' end,
    'kmh', (v_pace->>'kmh')::numeric, 'tap_km', (v_pace->>'tap_km')::numeric,
    'coins', j.coins, 'total_km', round(j.total_km::numeric, 1), 'taps', j.taps,
    'boots', j.boots, 'companion', j.companion,
    'boots_cost', case when j.boots >= 10 then null else 100 * power(2, j.boots)::int end,
    'companion_cost', case when j.companion >= 10 then null else 150 * power(2, j.companion)::int end,
    'postcards', (select count(*) from public.postcards where user_id = j.user_id),
    'boost', v_boost,
    'arrival', p_arrival);
end;
$$;

-- Catch up on idle time and banked taps, handle arrivals, and return the journey.
create or replace function public.journey_sync(p_taps integer default 0)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); j public.journeys; v_secs double precision; v_hours double precision; v_taps integer;
  v_pace jsonb; v_gain double precision; v_arrival jsonb; v_first boolean; v_reward integer;
begin
  if v_user is null then raise exception 'Sign in first.'; end if;
  select * into j from public.journeys where user_id = v_user for update;
  if j.user_id is null then
    insert into public.journeys (user_id, city_id)
    select v_user, coalesce(p.home_city_id, (select id from public.cities order by id limit 1)) from public.profiles p where p.id = v_user
    returning * into j;
    insert into public.postcards (user_id, city_id) values (v_user, j.city_id) on conflict do nothing;
  end if;

  v_secs := greatest(0, extract(epoch from now() - j.last_sync));
  v_hours := least(v_secs, 8 * 3600) / 3600.0;            -- idle progress is capped at 8 hours away
  v_taps := least(greatest(coalesce(p_taps, 0), 0), ceil(v_secs * 12)::int, 4000); -- at most 12 taps a second

  if j.to_city_id is not null then
    v_pace := public._journey_pace(j.route_km, public._journey_boost(v_user), j.boots, j.companion);
    v_gain := v_hours * (v_pace->>'kmh')::double precision + v_taps * (v_pace->>'tap_km')::double precision;
    j.total_km := j.total_km + least(v_gain, greatest(0, j.route_km - j.progress_km));
    j.progress_km := j.progress_km + v_gain;
    if j.progress_km >= j.route_km then
      v_first := not exists (select 1 from public.postcards where user_id = v_user and city_id = j.to_city_id);
      v_reward := round(j.route_km * 0.4)::int + case when v_first then 100 else 0 end;
      insert into public.postcards (user_id, city_id) values (v_user, j.to_city_id)
      on conflict (user_id, city_id) do update set visits = public.postcards.visits + 1;
      v_arrival := (select jsonb_build_object('city_id', c.id, 'name', c.name, 'country', co.name, 'photo', c.photo_url,
                      'coins', v_reward, 'first_visit', v_first, 'km', round(j.route_km::numeric, 1))
                    from public.cities c join public.countries co on co.code = c.country_code where c.id = j.to_city_id);
      j.coins := j.coins + v_reward;
      j.city_id := j.to_city_id; j.to_city_id := null; j.route_km := 0; j.progress_km := 0;
    end if;
  else
    -- Parked in a city: sightseeing earns a little, and taps earn a coin per 5.
    j.coins := j.coins + floor(v_hours * 30)::int + v_taps / 5;
  end if;

  update public.journeys set city_id = j.city_id, to_city_id = j.to_city_id, route_km = j.route_km, progress_km = j.progress_km,
    coins = j.coins, total_km = j.total_km, taps = j.taps + v_taps, last_sync = now()
  where user_id = v_user returning * into j;
  return public._journey_view(j, v_arrival);
end;
$$;

-- Set off for another city.
create or replace function public.journey_go(p_city_id bigint)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); j public.journeys; v_km double precision;
begin
  perform public.journey_sync(0);
  select * into j from public.journeys where user_id = v_user for update;
  if p_city_id = j.city_id then raise exception 'You''re already in that city.'; end if;
  select public.distance_m(a.lat, a.lng, b.lat, b.lng) / 1000 into v_km
  from public.cities a, public.cities b where a.id = j.city_id and b.id = p_city_id;
  if v_km is null then raise exception 'That city isn''t on the map.'; end if;
  v_km := v_km * case when v_km > 800 then 1.0 else 1.2 end;   -- roads wind; flights don't
  update public.journeys set to_city_id = p_city_id, route_km = v_km, progress_km = 0, last_sync = now()
  where user_id = v_user returning * into j;
  return public._journey_view(j, null);
end;
$$;

-- Spend coins on better boots (more km per tap) or a companion (faster idle travel).
create or replace function public.journey_upgrade(p_kind text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); j public.journeys; v_cost integer;
begin
  perform public.journey_sync(0);
  select * into j from public.journeys where user_id = v_user for update;
  if p_kind = 'boots' then
    if j.boots >= 10 then raise exception 'Your boots are already the best there are.'; end if;
    v_cost := 100 * power(2, j.boots)::int;
  elsif p_kind = 'companion' then
    if j.companion >= 10 then raise exception 'Your companion is fully trained.'; end if;
    v_cost := 150 * power(2, j.companion)::int;
  else raise exception 'Unknown upgrade.'; end if;
  if j.coins < v_cost then raise exception 'You need % more coins.', v_cost - j.coins; end if;
  update public.journeys set coins = coins - v_cost,
    boots = boots + case when p_kind = 'boots' then 1 else 0 end,
    companion = companion + case when p_kind = 'companion' then 1 else 0 end
  where user_id = v_user returning * into j;
  return public._journey_view(j, null);
end;
$$;

-- Buy an outfit from the journey shop.
create or replace function public.journey_buy_item(p_key text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); j public.journeys; v_item public.items;
begin
  perform public.journey_sync(0);
  select * into v_item from public.items where key = p_key and source = 'journey';
  if v_item.key is null then raise exception 'That item isn''t in the shop.'; end if;
  if exists (select 1 from public.player_items where user_id = v_user and item_key = p_key) then raise exception 'You already own the %.', v_item.name; end if;
  select * into j from public.journeys where user_id = v_user for update;
  if j.coins < v_item.price_coins then raise exception 'You need % more coins.', v_item.price_coins - j.coins; end if;
  update public.journeys set coins = coins - v_item.price_coins where user_id = v_user returning * into j;
  insert into public.player_items (user_id, item_key, source) values (v_user, p_key, 'journey');
  return public._journey_view(j, null);
end;
$$;

-- Postcards collected, with photos, newest first.
create or replace function public.my_postcards()
returns table (city_id bigint, name text, country text, photo text, first_at timestamptz, visits integer)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, co.name, c.photo_thumb_url, p.first_at, p.visits
  from public.postcards p join public.cities c on c.id = p.city_id join public.countries co on co.code = c.country_code
  where p.user_id = auth.uid() order by p.first_at desc;
$$;

revoke execute on function public._journey_boost(uuid), public._journey_pace(double precision, jsonb, integer, integer),
  public._journey_view(public.journeys, jsonb) from public, anon, authenticated;
revoke execute on function public.journey_sync(integer), public.journey_go(bigint), public.journey_upgrade(text),
  public.journey_buy_item(text), public.my_postcards() from public, anon;
grant execute on function public.journey_sync(integer), public.journey_go(bigint), public.journey_upgrade(text),
  public.journey_buy_item(text), public.my_postcards() to authenticated;
