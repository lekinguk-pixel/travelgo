-- 1) Taps earn coins on the road too (+1 every 5th tap, +10 jackpot every 50th, counted over your lifetime taps
--    so the app can show exactly which tap dropped a coin).
-- 2) Arrival outfits: travelling (digitally) to certain cities unlocks their outfit.
-- 3) Flag tees for every country: visit for real (a verified stamp) or arrive there on your journey.
-- 4) World firsts: the first players to stamp every landmark in a city, country, continent and the world.

-- ---------- items: new sources ----------
alter table public.items drop constraint items_source_check;
alter table public.items add constraint items_source_check check (source in ('starter', 'landmark', 'journey', 'arrival', 'flag'));

create table public.arrival_drops (
  item_key text not null references public.items (key) on delete cascade,
  city_id bigint not null references public.cities (id) on delete cascade,
  primary key (item_key, city_id)
);
alter table public.arrival_drops enable row level security;
create policy "Anyone can see arrival drops" on public.arrival_drops for select using (true);

insert into public.items (key, name, slot, rarity, source, price_coins, colorable, description, sort) values
  ('carnival_crown', 'Carnival crown', 'hat', 'epic', 'arrival', null, false, 'Feathers fit for the Sambadrome.', 40),
  ('sombrero', 'Sombrero', 'hat', 'rare', 'arrival', null, false, 'Wide-brimmed shade for the Zócalo.', 40),
  ('chullo', 'Chullo', 'hat', 'rare', 'arrival', null, false, 'Andean knit with ear flaps, for the cold Cusco nights.', 40),
  ('clogs', 'Wooden clogs', 'shoes', 'rare', 'arrival', null, false, 'Klompen for the canals.', 40),
  ('lopapeysa', 'Lopapeysa', 'top', 'epic', 'arrival', null, false, 'An Icelandic wool jumper with a yoke pattern.', 40),
  ('elephant_pants', 'Elephant trousers', 'bottom', 'rare', 'arrival', null, false, 'Breezy market trousers from Bangkok.', 40),
  ('gondolier_hat', 'Gondolier''s boater', 'hat', 'rare', 'arrival', null, false, 'Straw and ribbon for the Grand Canal.', 41),
  ('lederhosen', 'Lederhosen', 'bottom', 'epic', 'arrival', null, false, 'Leather shorts and braces from Munich.', 41),
  ('lei', 'Flower lei', 'neck', 'rare', 'arrival', null, false, 'Aloha! A garland of plumeria.', 40),
  ('aloha_shirt', 'Aloha shirt', 'top', 'rare', 'arrival', null, false, 'Hibiscus print for Waikīkī.', 41),
  ('campaign_hat', 'Ranger hat', 'hat', 'rare', 'arrival', null, false, 'A wide, pinched hat for the Rockies.', 41),
  ('kilt', 'Tartan kilt', 'bottom', 'epic', 'arrival', null, false, 'Highland dress from Edinburgh.', 42),
  ('kimono', 'Kimono', 'top', 'epic', 'arrival', null, false, 'Silk and an obi sash, for a Kyoto evening.', 42),
  ('fisherman_cap', 'Greek fisherman''s cap', 'hat', 'rare', 'arrival', null, false, 'The classic Aegean cap.', 42),
  ('breton_top', 'Breton top', 'top', 'rare', 'arrival', null, false, 'Navy stripes, very Parisian.', 43),
  ('block_print_scarf', 'Block-print scarf', 'neck', 'rare', 'arrival', null, false, 'Hand-stamped cotton from Jaipur.', 41)
on conflict (key) do nothing;

insert into public.arrival_drops (item_key, city_id)
select v.item, c.id from (values
  ('carnival_crown', 'Rio de Janeiro', 'BR'), ('sombrero', 'Mexico City', 'MX'), ('chullo', 'Cusco', 'PE'),
  ('clogs', 'Amsterdam', 'NL'), ('lopapeysa', 'Reykjavík', 'IS'), ('elephant_pants', 'Bangkok', 'TH'),
  ('gondolier_hat', 'Venice', 'IT'), ('lederhosen', 'Munich', 'DE'), ('lei', 'Honolulu', 'US'),
  ('aloha_shirt', 'Honolulu', 'US'), ('campaign_hat', 'Banff', 'CA'), ('kilt', 'Edinburgh', 'GB'),
  ('kimono', 'Kyoto', 'JP'), ('fisherman_cap', 'Athens', 'GR'), ('breton_top', 'Paris', 'FR'),
  ('block_print_scarf', 'Jaipur', 'IN')
) as v(item, city, cc)
join public.cities c on c.name = v.city and c.country_code = v.cc
on conflict do nothing;

-- One flag tee per country (and for any country added later).
create or replace function public._ensure_flag_item(p_code text, p_name text)
returns void language sql volatile security definer set search_path = '' as $$
  insert into public.items (key, name, slot, rarity, source, price_coins, colorable, description, sort)
  values ('flag_' || lower(p_code), p_name || ' flag tee', 'top', 'uncommon', 'flag', null, true,
          'A tee with a little ' || p_name || ' flag on the chest. Visit ' || p_name || ' for real, or arrive there on your digital journey.', 60)
  on conflict (key) do nothing;
$$;
select public._ensure_flag_item(code, name) from public.countries;

create or replace function public._countries_flag_item()
returns trigger language plpgsql security definer set search_path = '' as $$
begin perform public._ensure_flag_item(new.code, new.name); return new; end;
$$;
create trigger countries_flag_item after insert on public.countries for each row execute function public._countries_flag_item();

-- A verified stamp also unlocks the flag tee of that country.
create or replace function public._grant_stamp_drops()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'verified' and (tg_op = 'INSERT' or old.status is distinct from 'verified') then
    insert into public.player_items (user_id, item_key, source, stamp_id)
    select new.user_id, d.item_key, 'landmark', new.id from public.item_drops d where d.landmark_id = new.landmark_id
    on conflict do nothing;
    insert into public.player_items (user_id, item_key, source, stamp_id)
    select new.user_id, i.key, 'landmark', new.id
    from public.landmarks l join public.cities c on c.id = l.city_id
    join public.items i on i.key = 'flag_' || lower(c.country_code)
    where l.id = new.landmark_id
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- Wardrobe: where each locked item comes from (landmark, journey arrival city, or flag country).
create or replace function public.my_wardrobe()
returns table (key text, name text, slot text, rarity public.rarity, source text, price_coins integer, colorable boolean,
               description text, owned boolean, landmark_id bigint, landmark_name text, city_name text)
language sql stable security definer set search_path = '' as $$
  select i.key, i.name, i.slot, i.rarity, i.source, i.price_coins, i.colorable, i.description,
         i.source = 'starter' or exists (select 1 from public.player_items p where p.user_id = auth.uid() and p.item_key = i.key),
         l.id, l.name, coalesce(c.name, ac.name, fc.name)
  from public.items i
  left join public.item_drops d on d.item_key = i.key
  left join public.landmarks l on l.id = d.landmark_id
  left join public.cities c on c.id = l.city_id
  left join lateral (select ad.city_id from public.arrival_drops ad where ad.item_key = i.key limit 1) a on true
  left join public.cities ac on ac.id = a.city_id
  left join public.countries fc on i.source = 'flag' and i.key = 'flag_' || lower(fc.code)
  order by i.slot, i.sort, i.name;
$$;

-- ---------- journey: coins on every road, and arrival unlocks ----------
create or replace function public.journey_sync(p_taps integer default 0)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); j public.journeys; v_secs double precision; v_hours double precision; v_taps integer;
  v_pace jsonb; v_gain double precision; v_arrival jsonb; v_first boolean; v_reward integer; v_items jsonb;
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

  -- Tap coins, counted on lifetime taps: every 5th tap drops a coin, every 50th a 10-coin jackpot.
  j.coins := j.coins + ((j.taps + v_taps) / 5 - j.taps / 5) + 10 * ((j.taps + v_taps) / 50 - j.taps / 50);

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
      -- Unlock the city's arrival outfits and the country's flag tee.
      with won as (
        insert into public.player_items (user_id, item_key, source)
        select v_user, k, 'journey' from (
          select ad.item_key k from public.arrival_drops ad where ad.city_id = j.to_city_id
          union select i.key from public.cities c join public.items i on i.key = 'flag_' || lower(c.country_code) where c.id = j.to_city_id
        ) x
        on conflict do nothing
        returning item_key
      )
      select coalesce(jsonb_agg(jsonb_build_object('key', i.key, 'name', i.name, 'slot', i.slot, 'rarity', i.rarity) order by i.source), '[]'::jsonb)
      into v_items from won join public.items i on i.key = won.item_key;
      v_arrival := (select jsonb_build_object('city_id', c.id, 'name', c.name, 'country', co.name, 'photo', c.photo_url,
                      'coins', v_reward, 'first_visit', v_first, 'km', round(j.route_km::numeric, 1), 'items', v_items)
                    from public.cities c join public.countries co on co.code = c.country_code where c.id = j.to_city_id);
      j.coins := j.coins + v_reward;
      j.city_id := j.to_city_id; j.to_city_id := null; j.route_km := 0; j.progress_km := 0;
    end if;
  else
    -- Parked in a city: sightseeing earns a little while you're away.
    j.coins := j.coins + floor(v_hours * 30)::int;
  end if;

  update public.journeys set city_id = j.city_id, to_city_id = j.to_city_id, route_km = j.route_km, progress_km = j.progress_km,
    coins = j.coins, total_km = j.total_km, taps = j.taps + v_taps, last_sync = now()
  where user_id = v_user returning * into j;
  return public._journey_view(j, v_arrival);
end;
$$;

-- Destinations list can show which cities hold an arrival outfit.
create or replace function public.arrival_rewards()
returns table (city_id bigint, item_key text, item_name text, owned boolean)
language sql stable security definer set search_path = '' as $$
  select ad.city_id, i.key, i.name, exists (select 1 from public.player_items p where p.user_id = auth.uid() and p.item_key = i.key)
  from public.arrival_drops ad join public.items i on i.key = ad.item_key;
$$;

-- ---------- world firsts ----------
create table public.world_firsts (
  id bigint generated always as identity primary key,
  scope text not null check (scope in ('city', 'country', 'continent', 'world')),
  ref text not null,                 -- city id, country code, continent code, or 'world'
  user_id uuid not null references public.profiles (id) on delete cascade,
  place integer not null,
  landmarks integer not null,        -- how many landmarks it took
  stamp_id bigint references public.stamps (id) on delete set null,
  completed_at timestamptz not null default now(),
  unique (scope, ref, user_id),
  unique (scope, ref, place)
);
create index world_firsts_user_idx on public.world_firsts (user_id);
create index world_firsts_recent_idx on public.world_firsts (completed_at desc);
alter table public.world_firsts enable row level security;
create policy "World firsts are public" on public.world_firsts for select using (true);
revoke insert, update, delete on public.world_firsts from anon, authenticated;

-- Record a finish if this user has now stamped every landmark in the scope.
create or replace function public._record_finish(p_user uuid, p_scope text, p_ref text, p_label text, p_stamp bigint)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare v_total integer; v_mine integer; v_place integer;
begin
  if exists (select 1 from public.world_firsts where scope = p_scope and ref = p_ref and user_id = p_user) then return; end if;
  select count(*) into v_total from public.landmarks l join public.cities c on c.id = l.city_id join public.countries co on co.code = c.country_code
  where case p_scope when 'city' then c.id::text = p_ref when 'country' then co.code = p_ref when 'continent' then co.continent_code = p_ref else true end;
  if v_total < 3 then return; end if;     -- too small to be a race
  select count(*) into v_mine from public.stamps s join public.landmarks l on l.id = s.landmark_id
  join public.cities c on c.id = l.city_id join public.countries co on co.code = c.country_code
  where s.user_id = p_user and s.status = 'verified'
    and case p_scope when 'city' then c.id::text = p_ref when 'country' then co.code = p_ref when 'continent' then co.continent_code = p_ref else true end;
  if v_mine < v_total then return; end if;
  perform pg_advisory_xact_lock(hashtext('world_first:' || p_scope || ':' || p_ref));
  select coalesce(max(place), 0) + 1 into v_place from public.world_firsts where scope = p_scope and ref = p_ref;
  insert into public.world_firsts (scope, ref, user_id, place, landmarks, stamp_id) values (p_scope, p_ref, p_user, v_place, v_total, p_stamp)
  on conflict do nothing;
  if v_place <= 3 then
    insert into public.inbox_messages (user_id, kind, title, body, route)
    values (p_user, 'game',
      case v_place when 1 then 'WORLD FIRST: ' || p_label when 2 then '2nd in the world: ' || p_label else '3rd in the world: ' || p_label end,
      case v_place when 1 then 'You''re the first traveller ever to stamp all ' || v_total || ' landmarks in ' || p_label || '. Your name is on the World firsts board for good.'
        else 'You''re the ' || case v_place when 2 then 'second' else 'third' end || ' traveller to stamp all ' || v_total || ' landmarks in ' || p_label || '.' end,
      '/(tabs)/ranks');
  end if;
end;
$$;

create or replace function public._check_world_firsts()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v record;
begin
  if new.status = 'verified' and (tg_op = 'INSERT' or old.status is distinct from 'verified') then
    select c.id city_id, c.name city, co.code cc, co.name country, co.continent_code cont, ct.name continent into v
    from public.landmarks l join public.cities c on c.id = l.city_id join public.countries co on co.code = c.country_code
    join public.continents ct on ct.code = co.continent_code where l.id = new.landmark_id;
    perform public._record_finish(new.user_id, 'city', v.city_id::text, v.city, new.id);
    perform public._record_finish(new.user_id, 'country', v.cc, v.country, new.id);
    perform public._record_finish(new.user_id, 'continent', v.cont, v.continent, new.id);
    perform public._record_finish(new.user_id, 'world', 'world', 'the whole world', new.id);
  end if;
  return new;
end;
$$;
create trigger stamps_world_firsts after insert or update of status on public.stamps
for each row execute function public._check_world_firsts();

-- Everything the World firsts board needs, in one call.
create or replace function public.world_firsts_board()
returns jsonb language sql stable security definer set search_path = '' as $$
  with lm as (
    select l.id, c.id city_id, c.name city, co.code cc, co.name country, co.continent_code cont
    from public.landmarks l join public.cities c on c.id = l.city_id join public.countries co on co.code = c.country_code
  ),
  st as (select s.user_id, lm.* from public.stamps s join lm on lm.id = s.landmark_id where s.status = 'verified'),
  who as (select id, traveller_name::text name, avatar from public.profiles),
  fin as (
    select f.scope, f.ref, f.place, f.completed_at, f.user_id, w.name, w.avatar, f.user_id = auth.uid() is_me
    from public.world_firsts f join who w on w.id = f.user_id
  ),
  country_tot as (select cc, country, cont, count(*) total from lm group by 1, 2, 3),
  country_lead as (
    select distinct on (cc) cc, user_id, count(*) n from st group by cc, user_id order by cc, count(*) desc, min(user_id::text)
  ),
  country_me as (select cc, count(*) n from st where user_id = auth.uid() group by cc),
  city_tot as (select city_id, city, country, count(*) total from lm group by 1, 2, 3 having count(*) >= 3),
  city_lead as (
    select distinct on (city_id) city_id, user_id, count(*) n from st group by city_id, user_id order by city_id, count(*) desc, min(user_id::text)
  ),
  world_tot as (select count(*) total from lm),
  world_lead as (select user_id, count(*) n from st group by user_id order by count(*) desc limit 5)
  select jsonb_build_object(
    'world', jsonb_build_object(
      'total', (select total from world_tot),
      'mine', (select count(*) from st where user_id = auth.uid()),
      'finishers', coalesce((select jsonb_agg(jsonb_build_object('place', place, 'name', name, 'avatar', avatar, 'at', completed_at, 'is_me', is_me) order by place)
                             from fin where scope = 'world' and place <= 3), '[]'::jsonb),
      'leaders', coalesce((select jsonb_agg(jsonb_build_object('name', w.name, 'avatar', w.avatar, 'n', wl.n, 'is_me', wl.user_id = auth.uid()) order by wl.n desc)
                           from world_lead wl join who w on w.id = wl.user_id), '[]'::jsonb)),
    'continents', coalesce((select jsonb_agg(jsonb_build_object('code', ct.code, 'name', ct.name,
         'total', (select count(*) from lm where cont = ct.code),
         'mine', (select count(*) from st where cont = ct.code and user_id = auth.uid()),
         'first', (select jsonb_build_object('name', name, 'avatar', avatar, 'at', completed_at, 'is_me', is_me) from fin where scope = 'continent' and ref = ct.code and place = 1))
         order by ct.name)
       from public.continents ct where exists (select 1 from lm where cont = ct.code)), '[]'::jsonb),
    'countries', coalesce((select jsonb_agg(jsonb_build_object('code', t.cc, 'name', t.country, 'continent', t.cont, 'total', t.total,
         'mine', coalesce(m.n, 0),
         'finishers', (select count(*) from fin where scope = 'country' and ref = t.cc),
         'first', (select jsonb_build_object('name', name, 'avatar', avatar, 'at', completed_at, 'is_me', is_me) from fin where scope = 'country' and ref = t.cc and place = 1),
         'leader', (select jsonb_build_object('name', w.name, 'n', cl.n, 'is_me', cl.user_id = auth.uid()) from who w where w.id = cl.user_id))
         order by t.country)
       from country_tot t left join country_lead cl on cl.cc = t.cc left join country_me m on m.cc = t.cc), '[]'::jsonb),
    'recent_cities', coalesce((select jsonb_agg(x order by x->>'at' desc) from (
         select jsonb_build_object('city_id', t.city_id, 'city', t.city, 'country', t.country, 'total', t.total,
           'name', f.name, 'avatar', f.avatar, 'at', f.completed_at, 'is_me', f.is_me) x
         from fin f join city_tot t on t.city_id::text = f.ref where f.scope = 'city' and f.place = 1
         order by f.completed_at desc limit 20) r), '[]'::jsonb),
    'races', coalesce((select jsonb_agg(x order by (x->>'pct')::numeric desc) from (
         select jsonb_build_object('city_id', t.city_id, 'city', t.city, 'country', t.country, 'total', t.total,
           'n', cl.n, 'pct', round(cl.n::numeric / t.total, 3), 'name', w.name, 'is_me', cl.user_id = auth.uid()) x
         from city_tot t join city_lead cl on cl.city_id = t.city_id join who w on w.id = cl.user_id
         where not exists (select 1 from fin where scope = 'city' and ref = t.city_id::text)
         order by cl.n::numeric / t.total desc limit 10) r), '[]'::jsonb),
    'mine', coalesce((select jsonb_agg(jsonb_build_object('scope', f.scope, 'ref', f.ref, 'place', f.place, 'at', f.completed_at,
         'label', case f.scope when 'city' then (select name from public.cities where id::text = f.ref)
                               when 'country' then (select name from public.countries where code = f.ref)
                               when 'continent' then (select name from public.continents where code = f.ref) else 'The world' end)
         order by f.completed_at desc) from public.world_firsts f where f.user_id = auth.uid()), '[]'::jsonb)
  );
$$;

-- World firsts won by a particular stamp (for the celebration screen).
create or replace function public.stamp_world_firsts(p_stamp_id bigint)
returns table (scope text, place integer, label text, landmarks integer)
language sql stable security definer set search_path = '' as $$
  select f.scope, f.place,
    case f.scope when 'city' then (select name from public.cities where id::text = f.ref)
                 when 'country' then (select name from public.countries where code = f.ref)
                 when 'continent' then (select name from public.continents where code = f.ref) else 'the whole world' end,
    f.landmarks
  from public.world_firsts f where f.stamp_id = p_stamp_id and f.user_id = auth.uid()
  order by case f.scope when 'world' then 0 when 'continent' then 1 when 'country' then 2 else 3 end;
$$;

revoke execute on function public._ensure_flag_item(text, text), public._countries_flag_item(), public._record_finish(uuid, text, text, text, bigint),
  public._check_world_firsts() from public, anon, authenticated;
revoke execute on function public.arrival_rewards(), public.world_firsts_board(), public.stamp_world_firsts(bigint) from public, anon;
grant execute on function public.arrival_rewards(), public.world_firsts_board(), public.stamp_world_firsts(bigint) to authenticated;

-- Backfill: players who already have verified stamps get those countries' flag tees.
insert into public.player_items (user_id, item_key, source, stamp_id)
select distinct on (s.user_id, c.country_code) s.user_id, 'flag_' || lower(c.country_code), 'landmark', s.id
from public.stamps s join public.landmarks l on l.id = s.landmark_id join public.cities c on c.id = l.city_id
where s.status = 'verified' order by s.user_id, c.country_code, s.id
on conflict do nothing;
