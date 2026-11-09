-- Travel deals on every city (not just the weekly inbox idea), and the "spin the globe" wheel.

-- Clicks from city pages, landmark pages, the wheel, etc. (the inbox keeps its own table).
create table public.deal_clicks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  city_id bigint references public.cities (id) on delete set null,
  partner_key text not null,
  source text not null check (source in ('city', 'landmark', 'spin', 'journey', 'stamp')),
  created_at timestamptz not null default now()
);
create index deal_clicks_city_idx on public.deal_clicks (city_id);
alter table public.deal_clicks enable row level security;

-- One place that turns a partner's template into a link for a trip from home (h) to d.
create or replace function public._partner_url(p public.partners, d public.cities, h public.cities, p_sub text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_url text := p.url_template; dc text;
begin
  select name into dc from public.countries where code = d.country_code;
  v_url := replace(v_url, '{city}', public._url_encode(d.name));
  v_url := replace(v_url, '{country}', public._url_encode(coalesce(dc, '')));
  v_url := replace(v_url, '{from_city}', public._url_encode(coalesce(h.name, '')));
  v_url := replace(v_url, '{from_iata_lc}', lower(coalesce(h.airport_code, '')));
  v_url := replace(v_url, '{to_iata_lc}', lower(coalesce(d.airport_code, '')));
  v_url := replace(v_url, '{from_iata}', coalesce(h.airport_code, ''));
  v_url := replace(v_url, '{to_iata}', coalesce(d.airport_code, ''));
  if p.wrapper_template is not null then
    v_url := replace(replace(p.wrapper_template, '{url}', public._url_encode(v_url)), '{sub}', public._url_encode(coalesce(p_sub, '')));
  end if;
  return v_url;
end;
$$;

-- Which partners make sense for a trip from the player's home city to this one.
create or replace function public._deal_partners(p_user uuid, p_city_id bigint)
returns setof public.partners language sql stable security definer set search_path = '' as $$
  with d as (select c.*, co.continent_code from public.cities c join public.countries co on co.code = c.country_code where c.id = p_city_id),
       h as (select c.*, co.continent_code from public.profiles pr join public.cities c on c.id = pr.home_city_id
             join public.countries co on co.code = c.country_code where pr.id = p_user)
  select p.* from public.partners p
  left join d on true left join h on true
  where p.active and d.id is not null
    and (p.mode = 'any'
      or (p.mode = 'flight' and h.airport_code is not null and d.airport_code is not null and h.airport_code <> d.airport_code
          and public.distance_m(h.lat, h.lng, d.lat, d.lng) > 250000)
      or (p.mode = 'train' and h.id is not null and h.id <> d.id and h.continent_code = 'EU' and d.continent_code = 'EU'
          and public.distance_m(h.lat, h.lng, d.lat, d.lng) between 30000 and 900000))
  order by p.sort, p.key;
$$;

-- Deal buttons for a city page. Partner links are only for players aged 18 and over.
create or replace function public.city_deals(p_city_id bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_home text;
begin
  if v_user is null or not public._is_adult(v_user) then
    return jsonb_build_object('eligible', false, 'links', '[]'::jsonb);
  end if;
  select c.name into v_home from public.profiles pr join public.cities c on c.id = pr.home_city_id where pr.id = v_user;
  return jsonb_build_object('eligible', true, 'from_city', v_home, 'links', coalesce((
    select jsonb_agg(jsonb_build_object('key', p.key, 'label', p.button_label, 'partner', p.name,
      'promo_code', p.promo_code, 'promo_text', p.promo_text) order by p.sort, p.key)
    from public._deal_partners(v_user, p_city_id) p), '[]'::jsonb));
end;
$$;

create or replace function public.deal_click(p_city_id bigint, p_partner text, p_source text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); p public.partners; d public.cities; h public.cities;
begin
  if v_user is null or not public._is_adult(v_user) then raise exception 'Travel deals are for players aged 18 and over.'; end if;
  if p_source not in ('city', 'landmark', 'spin', 'journey', 'stamp') then raise exception 'Unknown source.'; end if;
  select * into p from public._deal_partners(v_user, p_city_id) x where x.key = p_partner;
  if p.key is null then raise exception 'That partner isn''t available for this trip.'; end if;
  select * into d from public.cities where id = p_city_id;
  select c.* into h from public.profiles pr join public.cities c on c.id = pr.home_city_id where pr.id = v_user;
  insert into public.deal_clicks (user_id, city_id, partner_key, source) values (v_user, p_city_id, p.key, p_source);
  return public._partner_url(p, d, h, 'mmgo-' || p_source || '-' || p_city_id);
end;
$$;

-- The inbox now builds its links the same way.
create or replace function public.inbox_click(p_message_id bigint, p_partner text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare m public.inbox_messages; p public.partners; d public.cities; h public.cities;
begin
  select * into m from public.inbox_messages where id = p_message_id and user_id = auth.uid() and kind = 'travel_idea';
  if m.id is null then raise exception 'That message isn''t in your inbox.'; end if;
  if not public._travel_ideas_on(auth.uid()) then raise exception 'Travel ideas are switched off.'; end if;
  select * into p from public.partners where key = p_partner and active and (mode = 'any' or mode = m.travel_mode);
  if p.key is null then raise exception 'That partner isn''t available.'; end if;
  select * into d from public.cities where id = m.city_id;
  select * into h from public.cities where id = m.from_city_id;
  insert into public.inbox_clicks (message_id, partner_key, campaign) values (m.id, p.key, m.campaign);
  update public.inbox_messages set read_at = coalesce(read_at, now()) where id = m.id;
  return public._partner_url(p, d, h, m.campaign);
end;
$$;

-- Spin the globe: a handful of random, safe cities with enough to stamp. The app picks the winner.
create or replace function public.spin_cities(p_continent text default null, p_unstamped boolean default false, p_count integer default 8)
returns table (id bigint, name text, country text, continent text, photo_thumb_url text, summary text, landmarks integer)
language sql volatile security definer set search_path = '' as $$
  select c.id, c.name, co.name, co.continent_code, c.photo_thumb_url, left(c.summary, 300),
         (select count(*)::int from public.landmarks l where l.city_id = c.id)
  from public.cities c join public.countries co on co.code = c.country_code
  where c.travel_ok and co.travel_ok
    and (p_continent is null or co.continent_code = p_continent)
    and c.id is distinct from (select home_city_id from public.profiles where id = auth.uid())
    and (select count(*) from public.landmarks l where l.city_id = c.id) >= 4
    and (not p_unstamped or not exists (
      select 1 from public.stamps s join public.landmarks l on l.id = s.landmark_id
      where s.user_id = auth.uid() and l.city_id = c.id and s.status <> 'rejected'))
  order by random()
  limit greatest(2, least(coalesce(p_count, 8), 12));
$$;

revoke execute on function public._partner_url(public.partners, public.cities, public.cities, text),
  public._deal_partners(uuid, bigint) from public, anon, authenticated;
revoke execute on function public.city_deals(bigint), public.deal_click(bigint, text, text),
  public.spin_cities(text, boolean, integer) from public, anon;
grant execute on function public.city_deals(bigint), public.deal_click(bigint, text, text),
  public.spin_cities(text, boolean, integer) to authenticated;
