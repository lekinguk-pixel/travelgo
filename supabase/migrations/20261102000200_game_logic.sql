-- mmGO game logic: creating a traveller, claiming stamps (GPS, photo and speed
-- checks), XP and skill levels, city tiers, quests and leaderboards.
-- All writes to stamps, XP and profiles go through these functions.

alter table public.profiles add constraint profiles_avatar_valid check (
  avatar ?& array['hat', 'coat', 'pack']
  and avatar->>'hat' ~ '^#[0-9A-Fa-f]{6}$'
  and avatar->>'coat' ~ '^#[0-9A-Fa-f]{6}$'
  and avatar->>'pack' ~ '^#[0-9A-Fa-f]{6}$'
);

-- ---------- helpers ----------
create or replace function public.distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable parallel safe set search_path = '' as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)));
$$;

create or replace function public.xp_for_rarity(r public.rarity)
returns integer language sql immutable set search_path = '' as $$
  select case r when 'common' then 80 when 'uncommon' then 100 when 'rare' then 120
                when 'epic' then 150 when 'legendary' then 250 end;
$$;

create or replace function public.level_for_xp(p_xp bigint)
returns integer language sql stable set search_path = '' as $$
  select coalesce(max(level), 1) from public.skill_levels where xp_required <= p_xp;
$$;

-- ---------- create your traveller ----------
create or replace function public.create_traveller(
  p_name text, p_date_of_birth date, p_home_city_id bigint, p_avatar jsonb default null)
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_uid is null then raise exception 'You need to be signed in.' using errcode = '28000'; end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'You already have a traveller.' using errcode = '23505'; end if;
  if p_date_of_birth is null or p_date_of_birth > current_date or p_date_of_birth < date '1900-01-01' then
    raise exception 'Enter a valid date of birth.' using errcode = '22023'; end if;
  if extract(year from age(current_date, p_date_of_birth)) < 13 then
    raise exception 'mmGO is for players aged 13 and over.' using errcode = '22023'; end if;
  if p_name is null or p_name !~ '^[A-Za-z0-9_]{3,16}$' then
    raise exception 'Traveller names use 3 to 16 letters, numbers or underscores.' using errcode = '22023'; end if;
  if lower(p_name) in ('admin', 'mmgo', 'moderator', 'support', 'official', 'system') then
    raise exception 'That traveller name is reserved.' using errcode = '22023'; end if;
  if exists (select 1 from public.profiles where lower(traveller_name::text) = lower(p_name)) then
    raise exception 'That traveller name is taken.' using errcode = '23505'; end if;
  if p_home_city_id is not null and not exists (select 1 from public.cities where id = p_home_city_id) then
    raise exception 'Unknown home city.' using errcode = '22023'; end if;

  insert into public.profiles (id, traveller_name, avatar, home_city_id)
  values (v_uid, p_name, coalesce(p_avatar, '{"hat": "#C8553D", "coat": "#2A7F75", "pack": "#B5784A"}'::jsonb), p_home_city_id)
  returning * into v_profile;
  insert into public.profile_private (user_id, date_of_birth) values (v_uid, p_date_of_birth);
  insert into public.skill_xp (user_id, skill)
  select v_uid, s from unnest(enum_range(null::public.skill)) s;
  return v_profile;
exception when unique_violation then
  raise exception 'That traveller name is taken.' using errcode = '23505';
end;
$$;

create or replace function public.traveller_name_available(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_name ~ '^[A-Za-z0-9_]{3,16}$'
     and lower(p_name) not in ('admin', 'mmgo', 'moderator', 'support', 'official', 'system')
     and not exists (select 1 from public.profiles where lower(traveller_name::text) = lower(p_name));
$$;

-- ---------- XP for a verified stamp (internal) ----------
create or replace function public._award_stamp_xp(p_stamp_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s record; v_prev record; v_q record;
  v_xp integer; v_sk public.skill; v_cur bigint;
  v_gains jsonb := '[]'; v_total integer := 0;
  v_km double precision := 0; v_wander integer := 0;
  v_major integer; v_done integer; v_new_tiers text[] := '{}'; v_quests text[] := '{}';
begin
  select st.*, l.rarity, l.skills, l.city_id, l.name as landmark_name into s
  from public.stamps st join public.landmarks l on l.id = st.landmark_id
  where st.id = p_stamp_id and st.status = 'verified';
  if not found then return null; end if;

  v_xp := public.xp_for_rarity(s.rarity);
  for v_sk in select distinct x from unnest(array['explorer'::public.skill] || s.skills) x loop
    select xp into v_cur from public.skill_xp where user_id = s.user_id and skill = v_sk;
    v_cur := coalesce(v_cur, 0);
    insert into public.skill_xp (user_id, skill, xp) values (s.user_id, v_sk, v_xp)
    on conflict (user_id, skill) do update set xp = public.skill_xp.xp + excluded.xp;
    insert into public.xp_events (user_id, amount, skill, reason, stamp_id, city_id)
    values (s.user_id, v_xp, v_sk, 'stamp', s.id, s.city_id);
    v_gains := v_gains || jsonb_build_object('skill', v_sk, 'xp', v_xp,
      'level_before', public.level_for_xp(v_cur), 'level_after', public.level_for_xp(v_cur + v_xp));
    v_total := v_total + v_xp;
  end loop;

  -- Wanderer: 1 XP per km travelled since your previous stamp (max 250).
  select lat, lng into v_prev from public.stamps
  where user_id = s.user_id and status = 'verified' and id <> s.id and claimed_at <= s.claimed_at
  order by claimed_at desc limit 1;
  if found then
    v_km := public.distance_m(v_prev.lat, v_prev.lng, s.lat, s.lng) / 1000;
    v_wander := least(250, floor(v_km)::integer);
  end if;
  if v_wander >= 1 then
    select xp into v_cur from public.skill_xp where user_id = s.user_id and skill = 'wanderer';
    v_cur := coalesce(v_cur, 0);
    insert into public.skill_xp (user_id, skill, xp) values (s.user_id, 'wanderer', v_wander)
    on conflict (user_id, skill) do update set xp = public.skill_xp.xp + excluded.xp;
    insert into public.xp_events (user_id, amount, skill, reason, stamp_id, city_id)
    values (s.user_id, v_wander, 'wanderer', 'distance', s.id, s.city_id);
    v_gains := v_gains || jsonb_build_object('skill', 'wanderer', 'xp', v_wander,
      'level_before', public.level_for_xp(v_cur), 'level_after', public.level_for_xp(v_cur + v_wander));
    v_total := v_total + v_wander;
  end if;

  -- City chapter tiers: bronze 50%, silver 80%, gold 100% of major landmarks.
  select count(*) into v_major from public.landmarks where city_id = s.city_id and is_major;
  select count(*) into v_done from public.stamps st join public.landmarks l on l.id = st.landmark_id
  where st.user_id = s.user_id and st.status = 'verified' and l.city_id = s.city_id and l.is_major;
  if v_major > 0 then
    if v_done * 100 >= v_major * 50 then
      insert into public.city_awards (user_id, city_id, tier) values (s.user_id, s.city_id, 'bronze') on conflict do nothing;
      if found then v_new_tiers := v_new_tiers || 'bronze'; end if;
    end if;
    if v_done * 100 >= v_major * 80 then
      insert into public.city_awards (user_id, city_id, tier) values (s.user_id, s.city_id, 'silver') on conflict do nothing;
      if found then v_new_tiers := v_new_tiers || 'silver'; end if;
    end if;
    if v_done >= v_major then
      insert into public.city_awards (user_id, city_id, tier) values (s.user_id, s.city_id, 'gold') on conflict do nothing;
      if found then v_new_tiers := v_new_tiers || 'gold'; end if;
    end if;
  end if;

  -- Quests: completed when every step has a verified stamp.
  for v_q in
    select q.id, q.name, q.xp_reward from public.quests q
    join public.quest_steps qs on qs.quest_id = q.id and qs.landmark_id = s.landmark_id
    where not exists (select 1 from public.quest_completions qc where qc.quest_id = q.id and qc.user_id = s.user_id)
      and not exists (
        select 1 from public.quest_steps q2
        where q2.quest_id = q.id and not exists (
          select 1 from public.stamps st2 where st2.user_id = s.user_id and st2.landmark_id = q2.landmark_id and st2.status = 'verified'))
  loop
    insert into public.quest_completions (quest_id, user_id) values (v_q.id, s.user_id);
    insert into public.xp_events (user_id, amount, skill, reason, stamp_id, city_id)
    values (s.user_id, v_q.xp_reward, null, 'quest', s.id, s.city_id);
    v_total := v_total + v_q.xp_reward;
    v_quests := v_quests || v_q.name;
  end loop;

  update public.stamps set xp_awarded = v_total where id = s.id;
  update public.profiles set total_xp = total_xp + v_total where id = s.user_id;

  return jsonb_build_object(
    'xp_total', v_total, 'skills', v_gains, 'km_travelled', round(v_km::numeric, 1),
    'city', jsonb_build_object('city_id', s.city_id, 'stamped', v_done, 'major_landmarks', v_major),
    'new_city_tiers', to_jsonb(v_new_tiers), 'quests_completed', to_jsonb(v_quests));
end;
$$;

-- ---------- claim a stamp ----------
create or replace function public.claim_stamp(
  p_landmark_id bigint, p_lat double precision, p_lng double precision, p_accuracy_m real, p_photo_path text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_lm record; v_last record;
  v_dist double precision; v_km double precision; v_hours double precision; v_speed double precision;
  v_status public.stamp_status := 'verified'; v_note text;
  v_recent integer; v_stamp_id bigint; v_result jsonb;
begin
  if v_uid is null then raise exception 'You need to be signed in.' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'Create your traveller first.' using errcode = '22023'; end if;

  select * into v_lm from public.landmarks where id = p_landmark_id;
  if not found then raise exception 'Unknown landmark.' using errcode = '22023'; end if;
  if exists (select 1 from public.stamps where user_id = v_uid and landmark_id = p_landmark_id) then
    raise exception 'You already have the % stamp.', v_lm.name using errcode = '23505'; end if;

  if p_lat is null or p_lng is null or p_accuracy_m is null or p_accuracy_m > 100 then
    raise exception 'Your GPS signal is too weak. Move somewhere more open and try again.' using errcode = '22023'; end if;
  v_dist := public.distance_m(p_lat, p_lng, v_lm.lat, v_lm.lng);
  if v_dist > v_lm.radius_m + least(p_accuracy_m, 50) then
    raise exception 'You are % m from %. Get within % m to stamp it.', round(v_dist), v_lm.name, v_lm.radius_m
      using errcode = '22023'; end if;

  if p_photo_path is null or split_part(p_photo_path, '/', 1) <> v_uid::text then
    raise exception 'Photos must be uploaded to your own folder.' using errcode = '42501'; end if;
  if not exists (select 1 from storage.objects o
                 where o.bucket_id = 'stamp-photos' and o.name = p_photo_path and o.owner_id = v_uid::text) then
    raise exception 'Upload your photo before claiming the stamp.' using errcode = '22023'; end if;
  if exists (select 1 from public.stamps where photo_path = p_photo_path) then
    raise exception 'Each photo can only be used for one stamp.' using errcode = '23505'; end if;

  select count(*) into v_recent from public.stamps where user_id = v_uid and claimed_at > now() - interval '1 hour';
  if v_recent >= 30 then
    raise exception 'Slow down, explorer! You can claim up to 30 stamps an hour.' using errcode = '54000'; end if;

  -- Impossible travel (faster than a plane) is held for review, not rejected.
  select lat, lng, claimed_at into v_last from public.stamps
  where user_id = v_uid order by claimed_at desc limit 1;
  if found then
    v_km := public.distance_m(v_last.lat, v_last.lng, p_lat, p_lng) / 1000;
    v_hours := greatest(extract(epoch from now() - v_last.claimed_at) / 3600, 1.0 / 3600);
    v_speed := v_km / v_hours;
    if v_km > 5 and v_speed > 900 then
      v_status := 'pending_review';
      v_note := format('Travelled %s km at about %s km/h since the previous stamp',
                       round(v_km::numeric, 1), round(v_speed::numeric));
    end if;
  end if;

  insert into public.stamps (user_id, landmark_id, photo_path, lat, lng, accuracy_m, distance_m, status, review_note)
  values (v_uid, p_landmark_id, p_photo_path, p_lat, p_lng, p_accuracy_m, v_dist, v_status, v_note)
  returning id into v_stamp_id;

  if v_status = 'verified' then
    v_result := public._award_stamp_xp(v_stamp_id);
  end if;

  return jsonb_build_object(
    'stamp_id', v_stamp_id, 'status', v_status, 'landmark', v_lm.name, 'rarity', v_lm.rarity,
    'distance_m', round(v_dist::numeric), 'rewards', v_result,
    'message', case when v_status = 'verified' then 'Stamp collected!'
                    else 'Stamp saved. It will be checked before XP is added, because you travelled unusually fast.' end);
end;
$$;

-- ---------- your progress in a city ----------
create or replace function public.city_progress(p_city_id bigint)
returns jsonb language sql stable security definer set search_path = '' as $$
  with t as (
    select
      (select count(*) from public.landmarks where city_id = p_city_id and is_major) as major,
      (select count(*) from public.stamps st join public.landmarks l on l.id = st.landmark_id
        where st.user_id = auth.uid() and st.status = 'verified' and l.city_id = p_city_id and l.is_major) as done)
  select jsonb_build_object(
    'city_id', p_city_id, 'stamped', done, 'major_landmarks', major,
    'bronze_at', ceil(major * 0.5)::int, 'silver_at', ceil(major * 0.8)::int, 'gold_at', major,
    'tier', case when major = 0 then null when done >= major then 'gold'
                 when done * 100 >= major * 80 then 'silver' when done * 100 >= major * 50 then 'bronze' end)
  from t;
$$;

-- ---------- leaderboards ----------
-- scope: world | continent (EU) | country (GB) | city (city id)
-- period: week | month | all     mode: solo | friends | clans
create or replace function public.leaderboard(
  p_scope text default 'world', p_scope_id text default null,
  p_period text default 'week', p_mode text default 'solo', p_limit integer default 50)
returns table (rank bigint, entry_id text, name text, avatar jsonb, xp bigint, is_me boolean)
language sql stable security definer set search_path = '' as $$
  with ev as (
    select e.user_id, e.amount
    from public.xp_events e
    left join public.cities c on c.id = e.city_id
    left join public.countries co on co.code = c.country_code
    where (p_period = 'all'
           or (p_period = 'week' and e.created_at >= date_trunc('week', now()))
           or (p_period = 'month' and e.created_at >= date_trunc('month', now())))
      and case p_scope
            when 'world' then true
            when 'city' then e.city_id::text = p_scope_id
            when 'country' then c.country_code = upper(p_scope_id)
            when 'continent' then co.continent_code = upper(p_scope_id)
            else false end
  ),
  players as (
    select ev.user_id::text as entry_id, p.traveller_name::text as name, p.avatar, sum(ev.amount)::bigint as xp
    from ev join public.profiles p on p.id = ev.user_id
    where p_mode = 'solo'
       or (p_mode = 'friends' and (ev.user_id = auth.uid() or exists (
             select 1 from public.friendships f where f.status = 'accepted'
               and ((f.requester_id = auth.uid() and f.addressee_id = ev.user_id)
                 or (f.addressee_id = auth.uid() and f.requester_id = ev.user_id)))))
    group by ev.user_id, p.traveller_name, p.avatar
  ),
  clans as (
    select g.id::text as entry_id, g.name::text as name, null::jsonb as avatar, sum(ev.amount)::bigint as xp
    from ev join public.group_members gm on gm.user_id = ev.user_id
    join public.groups g on g.id = gm.group_id
    where p_mode = 'clans'
    group by g.id, g.name
  ),
  ranked as (
    select x.*, rank() over (order by x.xp desc, x.name) as r
    from (select * from players where p_mode in ('solo', 'friends') union all select * from clans) x
  )
  select r, entry_id, name, avatar, xp,
         case when p_mode = 'clans'
              then exists (select 1 from public.group_members gm where gm.group_id::text = ranked.entry_id and gm.user_id = auth.uid())
              else ranked.entry_id = auth.uid()::text end
  from ranked
  where r <= least(greatest(p_limit, 1), 100)
     or (p_mode <> 'clans' and ranked.entry_id = auth.uid()::text)
     or (p_mode = 'clans' and exists (select 1 from public.group_members gm where gm.group_id::text = ranked.entry_id and gm.user_id = auth.uid()))
  order by r;
$$;

-- ---------- clans: the creator becomes leader ----------
create or replace function public._add_group_leader()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.group_members (group_id, user_id, role) values (new.id, new.created_by, 'leader');
  return new;
end;
$$;
create trigger groups_add_leader after insert on public.groups
for each row execute function public._add_group_leader();
