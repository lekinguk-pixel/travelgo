-- mmGO inbox: game messages plus occasional, opt-in travel ideas with
-- partner (affiliate) links, and player referral codes.
--
-- Rules built in:
--   * Travel ideas are only for players aged 18+ who switched them on
--     (off by default). Switching off hides them straight away.
--   * At most one travel idea a week (or a month, if the player prefers).
--   * Suggestions use home city and stamps only, never live location.
--   * Partner links carry a campaign tag (rule + city + week), never anything
--     that identifies the player.
--   * Link templates live in public.partners, so real affiliate links can
--     replace the placeholders without an app update.

-- ---------- destinations ----------
alter table public.cities add column airport_code text check (airport_code ~ '^[A-Z]{3}$');

insert into public.countries (code, name, continent_code) values
  ('NL', 'Netherlands', 'EU'), ('IE', 'Ireland', 'EU'), ('BE', 'Belgium', 'EU'),
  ('PT', 'Portugal', 'EU'), ('CZ', 'Czechia', 'EU'), ('AT', 'Austria', 'EU'), ('DK', 'Denmark', 'EU')
on conflict (code) do nothing;

-- Chapters coming soon: cities exist before their landmarks are added.
insert into public.cities (name, region, country_code, lat, lng) values
  ('Paris', 'Île-de-France', 'FR', 48.8566, 2.3522),
  ('Amsterdam', 'North Holland', 'NL', 52.3676, 4.9041),
  ('Dublin', 'Leinster', 'IE', 53.3498, -6.2603),
  ('Barcelona', 'Catalonia', 'ES', 41.3874, 2.1686),
  ('Madrid', 'Community of Madrid', 'ES', 40.4168, -3.7038),
  ('Brussels', 'Brussels', 'BE', 50.8503, 4.3517),
  ('Lisbon', 'Lisbon', 'PT', 38.7223, -9.1393),
  ('Rome', 'Lazio', 'IT', 41.9028, 12.4964),
  ('Prague', 'Prague', 'CZ', 50.0755, 14.4378),
  ('Berlin', 'Berlin', 'DE', 52.5200, 13.4050),
  ('Vienna', 'Vienna', 'AT', 48.2082, 16.3738),
  ('Copenhagen', 'Capital Region', 'DK', 55.6761, 12.5683)
on conflict (name, country_code) do nothing;

update public.cities c set airport_code = v.code
from (values
  ('London', 'LON'), ('Manchester', 'MAN'), ('Edinburgh', 'EDI'), ('Bristol', 'BRS'),
  ('Liverpool', 'LPL'), ('Cardiff', 'CWL'), ('Belfast', 'BFS'), ('York', 'LBA'),
  ('Bath', 'BRS'), ('Brighton', 'LGW'),
  ('Paris', 'PAR'), ('Amsterdam', 'AMS'), ('Dublin', 'DUB'), ('Barcelona', 'BCN'),
  ('Madrid', 'MAD'), ('Brussels', 'BRU'), ('Lisbon', 'LIS'), ('Rome', 'ROM'),
  ('Prague', 'PRG'), ('Berlin', 'BER'), ('Vienna', 'VIE'), ('Copenhagen', 'CPH')
) as v(name, code)
where c.name = v.name;

-- ---------- partners (affiliate programmes) ----------
-- url_template is the page on the partner's site. Placeholders:
--   {city} {country} {from_city} {from_iata} {to_iata} {from_iata_lc} {to_iata_lc}
-- wrapper_template (optional) is the affiliate network's tracking link, with
--   {url} = the encoded partner page and {sub} = the campaign tag.
--   e.g. Travelpayouts: https://tp.media/r?marker=YOUR_ID&p=PROGRAMME&u={url}&sub_id={sub}
-- While wrapper_template is null the link works but earns nothing.
create table public.partners (
  key text primary key,
  name text not null,
  button_label text not null,
  mode text not null default 'any' check (mode in ('any', 'train', 'flight')),
  url_template text not null,
  wrapper_template text,
  promo_code text,
  promo_text text,
  sort integer not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.partners (key, name, button_label, mode, url_template, sort) values
  ('stays',   'Booking.com',  'Find a stay',   'any',    'https://www.booking.com/searchresults.en-gb.html?ss={city}%2C+{country}', 1),
  ('tickets', 'GetYourGuide', 'Book tickets',  'any',    'https://www.getyourguide.co.uk/s/?q={city}', 2),
  ('flights', 'Skyscanner',   'Find flights',  'flight', 'https://www.skyscanner.net/transport/flights/{from_iata_lc}/{to_iata_lc}/', 3),
  ('trains',  'Trainline',    'Find trains',   'train',  'https://www.thetrainline.com/', 3);

-- Curated seasonal picks (you control these).
create table public.seasonal_picks (
  city_id bigint not null references public.cities (id) on delete cascade,
  month integer not null check (month between 1 and 12),
  reason text not null,
  primary key (city_id, month)
);
insert into public.seasonal_picks (city_id, month, reason)
select c.id, v.month, v.reason from public.cities c
join (values
  ('Edinburgh', 8, 'Festival month: the whole city becomes a stage'),
  ('Edinburgh', 12, 'Christmas markets and Hogmanay'),
  ('Prague', 12, 'Christmas markets in the Old Town Square'),
  ('Vienna', 12, 'Christmas markets outside the Rathaus'),
  ('Berlin', 11, 'Christmas markets open late November'),
  ('Amsterdam', 4, 'Tulip season'),
  ('Lisbon', 6, 'Festas de Lisboa street parties'),
  ('Barcelona', 9, 'Warm seas and the La Mercè festival'),
  ('Bath', 11, 'Bath Christmas Market starts late November'),
  ('York', 12, 'St Nicholas Fair Christmas market'),
  ('Dublin', 3, 'St Patrick''s Day')
) as v(name, month, reason) on c.name = v.name;

-- ---------- inbox ----------
create table public.inbox_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  travel_ideas boolean not null default false,
  frequency text not null default 'weekly' check (frequency in ('weekly', 'monthly')),
  consented_at timestamptz,          -- when they last switched travel ideas on
  updated_at timestamptz not null default now()
);

create table public.inbox_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('travel_idea', 'social', 'game', 'referral')),
  title text not null,
  body text not null,
  route text,                        -- in-app screen to open, e.g. /friends
  city_id bigint references public.cities (id) on delete set null,
  from_city_id bigint references public.cities (id) on delete set null,
  travel_mode text check (travel_mode in ('train', 'flight')),
  campaign text,                     -- tracking tag for partner links
  week_start date not null default date_trunc('week', now())::date,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  dismissed_at timestamptz
);
create index inbox_messages_user_idx on public.inbox_messages (user_id, created_at desc);
create unique index inbox_one_idea_a_week on public.inbox_messages (user_id, week_start) where kind = 'travel_idea';

create table public.inbox_dismissed_cities (
  user_id uuid not null references public.profiles (id) on delete cascade,
  city_id bigint not null references public.cities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, city_id)
);

-- Clicks are counted per message and partner. Reports to partners only ever
-- see the campaign tag.
create table public.inbox_clicks (
  id bigint generated always as identity primary key,
  message_id bigint not null references public.inbox_messages (id) on delete cascade,
  partner_key text not null references public.partners (key),
  campaign text,
  clicked_at timestamptz not null default now()
);
create index inbox_clicks_message_idx on public.inbox_clicks (message_id);

-- ---------- referrals ----------
create table public.referral_codes (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now()
);
create table public.referrals (
  referred_id uuid primary key references public.profiles (id) on delete cascade,
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (referred_id <> referrer_id)
);
create index referrals_referrer_idx on public.referrals (referrer_id);

-- Everything above is reached only through the functions below.
alter table public.partners enable row level security;
alter table public.seasonal_picks enable row level security;
alter table public.inbox_prefs enable row level security;
alter table public.inbox_messages enable row level security;
alter table public.inbox_dismissed_cities enable row level security;
alter table public.inbox_clicks enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
revoke all on public.partners, public.seasonal_picks, public.inbox_prefs, public.inbox_messages,
  public.inbox_dismissed_cities, public.inbox_clicks, public.referral_codes, public.referrals
  from anon, authenticated;

-- ---------- helpers ----------
create or replace function public._url_encode(p text)
returns text language sql immutable set search_path = '' as $$
  select coalesce(string_agg(
    case when b between 48 and 57 or b between 65 and 90 or b between 97 and 122 or b in (45, 46, 95, 126)
      then chr(b) else '%' || upper(lpad(to_hex(b), 2, '0')) end, '' order by i), '')
  from (select i, get_byte(convert_to(p, 'UTF8'), i) as b
        from generate_series(0, length(convert_to(p, 'UTF8')) - 1) as i) s;
$$;

create or replace function public._is_adult(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profile_private
                 where user_id = p_user and date_of_birth <= (current_date - interval '18 years')::date);
$$;

create or replace function public._travel_ideas_on(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public._is_adult(p_user)
     and coalesce((select travel_ideas from public.inbox_prefs where user_id = p_user), false);
$$;

create or replace function public._fmt_minutes(p integer)
returns text language sql immutable set search_path = '' as $$
  select case when p < 60 then p || 'm'
              when p % 60 = 0 then (p / 60) || 'h'
              else (p / 60) || 'h ' || (p % 60) || 'm' end;
$$;

-- Choose the best destination for one player. Priority:
--   1 near_tier : a city away from home where they're a few stamps off a tier
--   2 friends   : a city a friend stamped in the last 30 days
--   3 seasonal  : a curated pick for this month
--   4 nearest   : the closest city they haven't started
-- Skips home, dismissed, gold-completed and recently suggested cities.
create or replace function public._pick_travel_idea(p_user uuid)
returns table (city_id bigint, rule text, reason text)
language sql stable security definer set search_path = '' as $$
  with me as (
    select p.id, c.id as home_id, c.lat, c.lng
    from public.profiles p join public.cities c on c.id = p.home_city_id where p.id = p_user
  ),
  excluded as (
    select home_id as cid from me
    union select d.city_id from public.inbox_dismissed_cities d where d.user_id = p_user
    union select m.city_id from public.inbox_messages m
      where m.user_id = p_user and m.kind = 'travel_idea' and m.city_id is not null
        and m.created_at > now() - interval '56 days'
    union select a.city_id from public.city_awards a where a.user_id = p_user and a.tier = 'gold'
  ),
  progress as (
    select l.city_id,
           count(distinct l.id) filter (where l.is_major) as majors,
           count(distinct l.id) filter (where l.is_major and s.id is not null) as mine
    from public.landmarks l
    left join public.stamps s on s.landmark_id = l.id and s.user_id = p_user and s.status = 'verified'
    group by l.city_id
  ),
  near_tier as (
    select pr.city_id, 1 as prio, t.remaining, t.tier
    from progress pr
    cross join lateral (
      select (thr - pr.mine)::int as remaining, tier from (values
        (ceil(pr.majors * 0.5), 'bronze'), (ceil(pr.majors * 0.8), 'silver'), (pr.majors::numeric, 'gold')) v(thr, tier)
      where thr > pr.mine order by thr limit 1) t
    where pr.mine > 0 and pr.majors > 0 and t.remaining <= 5
  ),
  friend_trips as (
    select distinct on (l.city_id) l.city_id, 2 as prio, fp.traveller_name::text as friend, s.claimed_at
    from public.stamps s
    join public.landmarks l on l.id = s.landmark_id
    join public.profiles fp on fp.id = s.user_id
    where s.status = 'verified' and s.claimed_at > now() - interval '30 days'
      and s.user_id <> p_user and public.are_friends(p_user, s.user_id)
    order by l.city_id, s.claimed_at desc
  ),
  candidates as (
    select n.city_id, 1 as prio, 'near_tier' as rule,
           format('You''re %s stamp%s from %s here', n.remaining, case when n.remaining = 1 then '' else 's' end, n.tier) as reason
    from near_tier n
    union all
    select f.city_id, 2, 'friends', format('Your friend %s stamped here recently', f.friend) from friend_trips f
    union all
    select sp.city_id, 3, 'seasonal', sp.reason from public.seasonal_picks sp
      where sp.month = extract(month from now())::int
    union all
    select c.id, 4, 'nearest', 'A new chapter close to home' from public.cities c
      where not exists (select 1 from progress pr where pr.city_id = c.id and pr.mine > 0)
  )
  select cand.city_id, cand.rule, cand.reason
  from candidates cand
  join public.cities c on c.id = cand.city_id
  cross join me
  where cand.city_id not in (select cid from excluded where cid is not null)
  order by cand.prio, public.distance_m(me.lat, me.lng, c.lat, c.lng)
  limit 1;
$$;

-- Create this week's travel idea for one player (if they're eligible and due).
-- Returns the message id, or null.
create or replace function public._create_travel_idea(p_user uuid)
returns bigint language plpgsql volatile security definer set search_path = '' as $$
declare
  v_pick record; v_home public.cities; v_dest public.cities; v_freq text;
  v_km double precision; v_mode text; v_min integer; v_landmarks integer; v_id bigint;
  v_week date := date_trunc('week', now())::date;
begin
  if not public._travel_ideas_on(p_user) then return null; end if;
  select frequency into v_freq from public.inbox_prefs where user_id = p_user;
  if exists (select 1 from public.inbox_messages where user_id = p_user and kind = 'travel_idea'
             and (week_start = v_week or (v_freq = 'monthly' and created_at > now() - interval '28 days'))) then
    return null;
  end if;

  select * into v_pick from public._pick_travel_idea(p_user);
  if v_pick.city_id is null then return null; end if;
  select c.* into v_home from public.profiles p join public.cities c on c.id = p.home_city_id where p.id = p_user;
  select * into v_dest from public.cities where id = v_pick.city_id;

  v_km := public.distance_m(v_home.lat, v_home.lng, v_dest.lat, v_dest.lng) / 1000;
  -- Train within the same country (Northern Ireland only by train with itself), otherwise fly.
  if v_home.country_code = v_dest.country_code and v_km < 450
     and (coalesce(v_home.region, '') = 'Northern Ireland') = (coalesce(v_dest.region, '') = 'Northern Ireland') then
    v_mode := 'train'; v_min := greatest(30, round(v_km / 110 * 60 / 5) * 5)::int;
  else
    v_mode := 'flight'; v_min := greatest(45, round((v_km / 700 * 60 + 30) / 5) * 5)::int;
  end if;
  select count(*) into v_landmarks from public.landmarks where city_id = v_dest.id;

  insert into public.inbox_messages (user_id, kind, title, body, route, city_id, from_city_id, travel_mode, campaign, week_start)
  values (
    p_user, 'travel_idea',
    'Your next chapter: ' || v_dest.name,
    format('%s · about %s by %s from %s · %s',
      v_pick.reason, public._fmt_minutes(v_min), case v_mode when 'train' then 'train' else 'plane' end, v_home.name,
      case when v_landmarks = 0 then 'chapter coming soon' else v_landmarks || ' landmarks to stamp' end),
    null, v_dest.id, v_home.id, v_mode,
    format('ti_%s_%s_%s', v_pick.rule, v_dest.id, to_char(v_week, 'IYYYIW')),
    v_week)
  on conflict do nothing
  returning id into v_id;
  return v_id;
end;
$$;

-- Weekly job: one idea for every eligible player who is due.
create or replace function public.generate_travel_ideas()
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare v_user uuid; v_n integer := 0;
begin
  for v_user in select user_id from public.inbox_prefs where travel_ideas loop
    if public._create_travel_idea(v_user) is not null then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end;
$$;

-- ---------- player-facing functions ----------
create or replace function public.inbox_settings()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'eligible', public._is_adult(auth.uid()),
    'travel_ideas', public._travel_ideas_on(auth.uid()),
    'frequency', coalesce((select frequency from public.inbox_prefs where user_id = auth.uid()), 'weekly'));
$$;

create or replace function public.set_travel_ideas(p_on boolean, p_frequency text default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Sign in first.'; end if;
  if p_on and not public._is_adult(v_user) then raise exception 'Travel ideas are for players aged 18 and over.'; end if;
  if p_frequency is not null and p_frequency not in ('weekly', 'monthly') then raise exception 'Choose weekly or monthly.'; end if;
  insert into public.inbox_prefs (user_id, travel_ideas, frequency, consented_at, updated_at)
  values (v_user, p_on, coalesce(p_frequency, 'weekly'), case when p_on then now() end, now())
  on conflict (user_id) do update set
    travel_ideas = excluded.travel_ideas,
    frequency = coalesce(p_frequency, public.inbox_prefs.frequency),
    consented_at = case when p_on then now() else public.inbox_prefs.consented_at end,
    updated_at = now();
  -- Give a first idea straight away, so switching on shows something.
  if p_on then perform public._create_travel_idea(v_user); end if;
  return public.inbox_settings();
end;
$$;

create or replace function public.my_inbox(p_limit integer default 50)
returns table (id bigint, kind text, title text, body text, route text, city_id bigint,
               created_at timestamptz, read_at timestamptz, links jsonb)
language sql stable security definer set search_path = '' as $$
  select m.id, m.kind, m.title, m.body, m.route, m.city_id, m.created_at, m.read_at,
    case when m.kind = 'travel_idea' then coalesce((
      select jsonb_agg(jsonb_build_object('key', p.key, 'label', p.button_label, 'partner', p.name,
                                          'promo_code', p.promo_code, 'promo_text', p.promo_text) order by p.sort)
      from public.partners p
      join public.cities d on d.id = m.city_id
      join public.cities h on h.id = m.from_city_id
      where p.active and (p.mode = 'any' or p.mode = m.travel_mode)
        and (p.key <> 'flights' or (d.airport_code is not null and h.airport_code is not null))
    ), '[]'::jsonb) else '[]'::jsonb end
  from public.inbox_messages m
  where m.user_id = auth.uid() and m.dismissed_at is null
    and (m.kind <> 'travel_idea' or public._travel_ideas_on(auth.uid()))
  order by m.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

create or replace function public.inbox_unread_count()
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.inbox_messages m
  where m.user_id = auth.uid() and m.read_at is null and m.dismissed_at is null
    and (m.kind <> 'travel_idea' or public._travel_ideas_on(auth.uid()));
$$;

create or replace function public.mark_inbox_read(p_id bigint default null)
returns void language sql volatile security definer set search_path = '' as $$
  update public.inbox_messages set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_id is null or id = p_id);
$$;

-- Dismiss a message. For a travel idea, not_interested also stops that city being suggested again.
create or replace function public.dismiss_inbox(p_id bigint, p_not_interested boolean default false)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare v_city bigint;
begin
  update public.inbox_messages set dismissed_at = now(), read_at = coalesce(read_at, now())
  where id = p_id and user_id = auth.uid()
  returning case when kind = 'travel_idea' then city_id end into v_city;
  if p_not_interested and v_city is not null then
    insert into public.inbox_dismissed_cities (user_id, city_id) values (auth.uid(), v_city) on conflict do nothing;
  end if;
end;
$$;

-- Build the partner link for a travel idea, count the click and return the URL to open.
create or replace function public.inbox_click(p_message_id bigint, p_partner text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare m public.inbox_messages; p public.partners; d public.cities; h public.cities; dc text; v_url text;
begin
  select * into m from public.inbox_messages where id = p_message_id and user_id = auth.uid() and kind = 'travel_idea';
  if m.id is null then raise exception 'That message isn''t in your inbox.'; end if;
  if not public._travel_ideas_on(auth.uid()) then raise exception 'Travel ideas are switched off.'; end if;
  select * into p from public.partners where key = p_partner and active and (mode = 'any' or mode = m.travel_mode);
  if p.key is null then raise exception 'That partner isn''t available.'; end if;
  select * into d from public.cities where id = m.city_id;
  select * into h from public.cities where id = m.from_city_id;
  select name into dc from public.countries where code = d.country_code;

  v_url := p.url_template;
  v_url := replace(v_url, '{city}', public._url_encode(d.name));
  v_url := replace(v_url, '{country}', public._url_encode(coalesce(dc, '')));
  v_url := replace(v_url, '{from_city}', public._url_encode(coalesce(h.name, '')));
  v_url := replace(v_url, '{from_iata_lc}', lower(coalesce(h.airport_code, '')));
  v_url := replace(v_url, '{to_iata_lc}', lower(coalesce(d.airport_code, '')));
  v_url := replace(v_url, '{from_iata}', coalesce(h.airport_code, ''));
  v_url := replace(v_url, '{to_iata}', coalesce(d.airport_code, ''));
  if p.wrapper_template is not null then
    v_url := replace(replace(p.wrapper_template, '{url}', public._url_encode(v_url)), '{sub}', public._url_encode(coalesce(m.campaign, '')));
  end if;

  insert into public.inbox_clicks (message_id, partner_key, campaign) values (m.id, p.key, m.campaign);
  update public.inbox_messages set read_at = coalesce(read_at, now()) where id = m.id;
  return v_url;
end;
$$;

-- ---------- referral codes ----------
create or replace function public.my_referral()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_code text; v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if v_user is null or not exists (select 1 from public.profiles where id = v_user) then raise exception 'Sign in first.'; end if;
  select code into v_code from public.referral_codes where user_id = v_user;
  if v_code is null then
    loop
      v_code := '';
      for i in 1..6 loop v_code := v_code || substr(v_chars, 1 + floor(random() * 32)::int, 1); end loop;
      exit when not exists (select 1 from public.referral_codes where code = v_code);
    end loop;
    insert into public.referral_codes (user_id, code) values (v_user, v_code);
  end if;
  return jsonb_build_object(
    'code', v_code,
    'invited', (select count(*) from public.referrals where referrer_id = v_user),
    'can_redeem', not exists (select 1 from public.referrals where referred_id = v_user)
                  and (select created_at from public.profiles where id = v_user) > now() - interval '14 days');
end;
$$;

-- A new player (first 14 days) enters a friend's code: they become friends
-- and both get an inbox message.
create or replace function public.redeem_referral(p_code text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_ref uuid; v_me text; v_them text;
begin
  if v_user is null then raise exception 'Sign in first.'; end if;
  if (select created_at from public.profiles where id = v_user) <= now() - interval '14 days' then
    raise exception 'Invite codes can only be used in your first 14 days.';
  end if;
  if exists (select 1 from public.referrals where referred_id = v_user) then raise exception 'You''ve already used an invite code.'; end if;
  select user_id into v_ref from public.referral_codes where code = upper(trim(p_code));
  if v_ref is null then raise exception 'That invite code doesn''t exist.'; end if;
  if v_ref = v_user then raise exception 'That''s your own code.'; end if;

  insert into public.referrals (referred_id, referrer_id) values (v_user, v_ref);
  delete from public.friendships where (requester_id = v_user and addressee_id = v_ref) or (requester_id = v_ref and addressee_id = v_user);
  insert into public.friendships (requester_id, addressee_id, status) values (v_ref, v_user, 'accepted');

  select traveller_name into v_me from public.profiles where id = v_user;
  select traveller_name into v_them from public.profiles where id = v_ref;
  insert into public.inbox_messages (user_id, kind, title, body, route) values
    (v_ref, 'referral', v_me || ' joined with your invite', 'You''re now friends. Follow their journey and race them up the leaderboard.', '/traveller/' || v_user),
    (v_user, 'referral', 'You''re friends with ' || v_them, 'You joined with their invite. See where they''ve been.', '/traveller/' || v_ref);
  return v_them;
end;
$$;

-- ---------- game and social messages ----------
create or replace function public._inbox_friendship()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    select traveller_name into v_name from public.profiles where id = new.requester_id;
    insert into public.inbox_messages (user_id, kind, title, body, route)
    values (new.addressee_id, 'social', v_name || ' wants to be friends', 'Accept to follow each other''s journeys.', '/friends');
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    select traveller_name into v_name from public.profiles where id = new.addressee_id;
    insert into public.inbox_messages (user_id, kind, title, body, route)
    values (new.requester_id, 'social', v_name || ' accepted your friend request', 'See where they''ve been.', '/traveller/' || new.addressee_id);
  end if;
  return new;
end;
$$;
create trigger friendships_inbox after insert or update on public.friendships
for each row execute function public._inbox_friendship();

create or replace function public._inbox_city_award()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_city text;
begin
  select name into v_city from public.cities where id = new.city_id;
  insert into public.inbox_messages (user_id, kind, title, body, route)
  values (new.user_id, 'game', initcap(new.tier::text) || ' chapter: ' || v_city,
    case new.tier when 'gold' then 'Every major landmark stamped. A chapter complete.'
                  when 'silver' then 'Silver earned. Gold is the full set.'
                  else 'Bronze earned. Keep going for silver.' end,
    '/book');
  return new;
end;
$$;
create trigger city_awards_inbox after insert on public.city_awards
for each row execute function public._inbox_city_award();

-- ---------- permissions ----------
revoke execute on function public._url_encode(text), public._is_adult(uuid), public._travel_ideas_on(uuid),
  public._fmt_minutes(integer), public._pick_travel_idea(uuid), public._create_travel_idea(uuid),
  public.generate_travel_ideas(), public._inbox_friendship(), public._inbox_city_award()
  from public, anon, authenticated;
revoke execute on function public.inbox_settings(), public.set_travel_ideas(boolean, text), public.my_inbox(integer),
  public.inbox_unread_count(), public.mark_inbox_read(bigint), public.dismiss_inbox(bigint, boolean),
  public.inbox_click(bigint, text), public.my_referral(), public.redeem_referral(text)
  from public, anon;
grant execute on function public.inbox_settings(), public.set_travel_ideas(boolean, text), public.my_inbox(integer),
  public.inbox_unread_count(), public.mark_inbox_read(bigint), public.dismiss_inbox(bigint, boolean),
  public.inbox_click(bigint, text), public.my_referral(), public.redeem_referral(text)
  to authenticated;

-- ---------- weekly schedule: Mondays 09:00 UTC ----------
create extension if not exists pg_cron;
select cron.schedule('weekly-travel-ideas', '0 9 * * 1', $$select public.generate_travel_ideas()$$);
