-- First-run tour: a one-off, 15-tap "first journey" from your home city to a nearby city, with a postcard,
-- coins and that country's flag tee, so new players feel the whole loop in their first minute.

alter table public.journeys add column tutorial_done_at timestamptz;
alter table public.profiles add column tour_done_at timestamptz;

-- The tour's destination: the nearest city with plenty to stamp. A different country is more exciting,
-- so one within 600 km wins over a closer city at home.
create or replace function public._tour_target(p_user uuid)
returns bigint language sql stable security definer set search_path = '' as $$
  with h as (select c.* from public.profiles p join public.cities c on c.id = p.home_city_id where p.id = p_user),
  options as (
    select c.id, c.country_code <> h.country_code abroad, public.distance_m(h.lat, h.lng, c.lat, c.lng) d
    from public.cities c, h
    where c.id <> h.id and c.travel_ok and (select count(*) from public.landmarks l where l.city_id = c.id) >= 6
  )
  select id from options
  order by (abroad and d < 600000) desc, d
  limit 1;
$$;

create or replace function public.tour_preview()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'from', (select jsonb_build_object('id', c.id, 'name', c.name) from public.profiles p join public.cities c on c.id = p.home_city_id where p.id = auth.uid()),
    'to', (select jsonb_build_object('id', c.id, 'name', c.name, 'country', co.name, 'country_code', co.code,
                    'photo', c.photo_thumb_url, 'flag_key', 'flag_' || lower(co.code), 'flag_name', co.name || ' flag tee')
           from public.cities c join public.countries co on co.code = c.country_code where c.id = public._tour_target(auth.uid())),
    'done', exists (select 1 from public.journeys j where j.user_id = auth.uid() and j.tutorial_done_at is not null),
    'landmarks', (select count(*) from public.landmarks),
    'countries', (select count(distinct c.country_code) from public.cities c where exists (select 1 from public.landmarks l where l.city_id = c.id))
  );
$$;

-- Finish the first journey (once only): arrive, collect the postcard, 50 coins and the flag tee.
create or replace function public.tour_finish()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_to bigint; j public.journeys; v_flag text;
begin
  if v_user is null then raise exception 'Sign in first.'; end if;
  perform public.journey_sync(0);                       -- makes sure a journey exists
  select * into j from public.journeys where user_id = v_user for update;
  if j.tutorial_done_at is not null then raise exception 'You''ve already taken your first journey.'; end if;
  v_to := public._tour_target(v_user);
  if v_to is null then raise exception 'No nearby city found.'; end if;
  select 'flag_' || lower(country_code) into v_flag from public.cities where id = v_to;
  insert into public.postcards (user_id, city_id) values (v_user, v_to) on conflict do nothing;
  insert into public.player_items (user_id, item_key, source) select v_user, v_flag, 'journey'
  where exists (select 1 from public.items where key = v_flag) on conflict do nothing;
  update public.journeys set city_id = v_to, to_city_id = null, route_km = 0, progress_km = 0,
    coins = coins + 50, tutorial_done_at = now(), last_sync = now()
  where user_id = v_user returning * into j;
  return jsonb_build_object('coins', 50, 'flag_key', v_flag,
    'city', (select jsonb_build_object('id', c.id, 'name', c.name, 'country', co.name, 'photo', c.photo_url)
             from public.cities c join public.countries co on co.code = c.country_code where c.id = v_to));
end;
$$;

create or replace function public.tour_complete()
returns void language sql volatile security definer set search_path = '' as $$
  update public.profiles set tour_done_at = coalesce(tour_done_at, now()) where id = auth.uid();
$$;

revoke execute on function public._tour_target(uuid) from public, anon, authenticated;
revoke execute on function public.tour_preview(), public.tour_finish(), public.tour_complete() from public, anon;
grant execute on function public.tour_preview(), public.tour_finish(), public.tour_complete() to authenticated;
