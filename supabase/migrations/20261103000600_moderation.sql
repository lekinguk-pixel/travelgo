-- mmGO moderation: every stamp photo has a review status, friends can report
-- photos, photos reported by 3+ players are hidden automatically, and
-- moderators review a queue. AI screening plugs in later via set_ai_verdict.

-- ---------- moderators and settings ----------
create table public.moderators (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.moderators enable row level security;
revoke all on public.moderators from anon, authenticated;

create table public.app_settings (
  key text primary key,
  value jsonb not null
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
-- While AI screening is off, new photos are approved straight away.
insert into public.app_settings (key, value) values ('ai_photo_screening', 'false');

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.moderators where user_id = auth.uid());
$$;

-- The founder's account is the first moderator.
insert into public.moderators (user_id) select id from auth.users where email = 'lekinguk@gmail.com';

-- ---------- photo status on stamps ----------
-- pending  = waiting for AI screening (only the owner sees it)
-- approved = visible to friends
-- flagged  = AI thinks it may break the rules; hidden until a moderator decides
-- hidden   = reported by 3+ players; hidden until a moderator decides
-- removed  = a moderator removed the photo (the stamp is kept)
alter table public.stamps add column photo_status text not null default 'approved'
  check (photo_status in ('pending', 'approved', 'flagged', 'hidden', 'removed'));
alter table public.stamps add column moderation jsonb;
create index stamps_photo_path_idx on public.stamps (photo_path);
create index stamps_photo_status_idx on public.stamps (photo_status) where photo_status in ('flagged', 'hidden');

create or replace function public._initial_photo_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.photo_status := case when coalesce((select value = 'true'::jsonb from public.app_settings where key = 'ai_photo_screening'), false)
                           then 'pending' else 'approved' end;
  return new;
end;
$$;
create trigger stamps_initial_photo_status before insert on public.stamps
for each row execute function public._initial_photo_status();

-- ---------- reports ----------
alter table public.stamp_reports add column details text check (details is null or char_length(details) <= 500);
alter table public.stamp_reports add column resolved_at timestamptz;
alter table public.stamp_reports add constraint stamp_reports_reason_valid
  check (reason in ('inappropriate', 'not_there', 'bullying', 'other'));
drop policy if exists "Players report stamps as themselves" on public.stamp_reports;
revoke insert on public.stamp_reports from anon, authenticated;

create or replace function public.report_stamp(p_stamp_id bigint, p_reason text, p_details text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_owner uuid; v_open integer;
begin
  if v_uid is null then raise exception 'You need to be signed in.' using errcode = '28000'; end if;
  if p_reason not in ('inappropriate', 'not_there', 'bullying', 'other') then
    raise exception 'Choose a reason for the report.' using errcode = '22023'; end if;
  select user_id into v_owner from public.stamps where id = p_stamp_id;
  if v_owner is null then raise exception 'That stamp no longer exists.' using errcode = '22023'; end if;
  if v_owner = v_uid then raise exception 'You can''t report your own stamp.' using errcode = '22023'; end if;
  if not public.are_friends(v_uid, v_owner) then
    raise exception 'You can only report stamps you can see.' using errcode = '42501'; end if;
  if (select count(*) from public.stamp_reports where reporter_id = v_uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'You''ve sent a lot of reports today. Thanks for helping; please try again tomorrow.' using errcode = '54000'; end if;
  insert into public.stamp_reports (stamp_id, reporter_id, reason, details)
  values (p_stamp_id, v_uid, p_reason, nullif(trim(coalesce(p_details, '')), ''))
  on conflict (stamp_id, reporter_id) do update set reason = excluded.reason, details = excluded.details, created_at = now(), resolved_at = null;
  select count(*) into v_open from public.stamp_reports where stamp_id = p_stamp_id and resolved_at is null;
  if v_open >= 3 then
    update public.stamps set photo_status = 'hidden' where id = p_stamp_id and photo_status = 'approved';
  end if;
  return 'reported';
end;
$$;

-- ---------- what friends can see ----------
-- Friends see a photo only once it's approved; the owner always sees their own.
create or replace function public.can_view_photo(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_moderator() or exists (
    select 1 from public.stamps s
    where s.photo_path = p_name and s.photo_status = 'approved' and public.are_friends(auth.uid(), s.user_id));
$$;
drop policy if exists "Friends view each other's stamp photos" on storage.objects;
create policy "Friends and moderators view approved stamp photos" on storage.objects for select to authenticated
  using (bucket_id = 'stamp-photos' and public.can_view_photo(name));

create or replace function public.friends_feed(p_limit integer default 30)
returns table (stamp_id bigint, user_id uuid, traveller_name text, avatar jsonb, landmark text,
               rarity public.rarity, city text, claimed_at timestamptz, photo_path text, xp_awarded integer)
language sql stable security definer set search_path = '' as $$
  select s.id, s.user_id, p.traveller_name::text, p.avatar, l.name, l.rarity, c.name, s.claimed_at,
         case when s.photo_status = 'approved' then s.photo_path end, s.xp_awarded
  from public.stamps s
  join public.profiles p on p.id = s.user_id
  join public.landmarks l on l.id = s.landmark_id
  join public.cities c on c.id = l.city_id
  where s.status = 'verified' and s.user_id <> auth.uid() and public.are_friends(auth.uid(), s.user_id)
  order by s.claimed_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

create or replace function public.traveller_journey(p_user_id uuid)
returns table (stamp_id bigint, landmark text, rarity public.rarity, city text, claimed_at timestamptz, photo_path text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.are_friends(auth.uid(), p_user_id) then
    raise exception 'You can only see the journeys of your friends.' using errcode = '42501'; end if;
  return query
    select s.id, l.name, l.rarity, c.name, s.claimed_at,
           case when s.photo_status = 'approved' or s.user_id = auth.uid() then s.photo_path end
    from public.stamps s
    join public.landmarks l on l.id = s.landmark_id
    join public.cities c on c.id = l.city_id
    where s.user_id = p_user_id and s.status = 'verified'
    order by s.claimed_at desc;
end;
$$;

-- ---------- moderator tools ----------
create or replace function public.moderation_queue()
returns table (stamp_id bigint, user_id uuid, traveller_name text, landmark text, city text, claimed_at timestamptz,
               photo_path text, photo_status text, stamp_status public.stamp_status, moderation jsonb, distance_m real, reports jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_moderator() then raise exception 'Moderators only.' using errcode = '42501'; end if;
  return query
    select s.id, s.user_id, p.traveller_name::text, l.name, c.name, s.claimed_at, s.photo_path, s.photo_status, s.status,
           s.moderation, s.distance_m,
           coalesce((select jsonb_agg(jsonb_build_object('reason', r.reason, 'details', r.details, 'by', rp.traveller_name::text, 'at', r.created_at) order by r.created_at)
                     from public.stamp_reports r join public.profiles rp on rp.id = r.reporter_id
                     where r.stamp_id = s.id and r.resolved_at is null), '[]'::jsonb)
    from public.stamps s
    join public.profiles p on p.id = s.user_id
    join public.landmarks l on l.id = s.landmark_id
    join public.cities c on c.id = l.city_id
    where s.photo_status in ('flagged', 'hidden')
       or s.status = 'pending_review'
       or exists (select 1 from public.stamp_reports r where r.stamp_id = s.id and r.resolved_at is null)
    order by (s.photo_status = 'flagged') desc, s.claimed_at;
end;
$$;

-- keep:   photo is fine (approve it, close reports, and verify a pending stamp)
-- hide:   remove the photo from view but keep the stamp and its XP
-- remove: delete the stamp entirely and take back its XP (cheating)
create or replace function public.moderate_stamp(p_stamp_id bigint, p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_s record; v_e record;
begin
  if not public.is_moderator() then raise exception 'Moderators only.' using errcode = '42501'; end if;
  select * into v_s from public.stamps where id = p_stamp_id;
  if not found then return; end if;
  if p_action = 'keep' then
    update public.stamps set photo_status = 'approved' where id = p_stamp_id;
    if v_s.status = 'pending_review' then
      update public.stamps set status = 'verified' where id = p_stamp_id;
      perform public._award_stamp_xp(p_stamp_id);
    end if;
  elsif p_action = 'hide' then
    update public.stamps set photo_status = 'removed' where id = p_stamp_id;
  elsif p_action = 'remove' then
    for v_e in select skill, sum(amount)::bigint as amount from public.xp_events where stamp_id = p_stamp_id and skill is not null group by skill loop
      update public.skill_xp set xp = greatest(0, xp - v_e.amount) where user_id = v_s.user_id and skill = v_e.skill;
    end loop;
    update public.profiles set total_xp = greatest(0, total_xp - coalesce((select sum(amount) from public.xp_events where stamp_id = p_stamp_id), 0))
    where id = v_s.user_id;
    delete from public.stamps where id = p_stamp_id;
    return;
  else
    raise exception 'Unknown action.' using errcode = '22023';
  end if;
  update public.stamp_reports set resolved_at = now() where stamp_id = p_stamp_id and resolved_at is null;
end;
$$;

-- ---------- AI screening hook (called by the moderate-photo function) ----------
create or replace function public.set_ai_verdict(p_stamp_id bigint, p_flagged boolean, p_result jsonb)
returns void language sql security definer set search_path = '' as $$
  update public.stamps
  set photo_status = case when p_flagged then 'flagged' else 'approved' end,
      moderation = p_result
  where id = p_stamp_id and photo_status = 'pending';
$$;

-- ---------- permissions ----------
revoke execute on function public._initial_photo_status() from public, anon, authenticated;
revoke execute on function public.set_ai_verdict(bigint, boolean, jsonb) from public, anon, authenticated;
revoke execute on function public.is_moderator() from public, anon;
revoke execute on function public.report_stamp(bigint, text, text) from public, anon;
revoke execute on function public.can_view_photo(text) from public, anon;
revoke execute on function public.moderation_queue() from public, anon;
revoke execute on function public.moderate_stamp(bigint, text) from public, anon;
grant execute on function public.is_moderator(), public.report_stamp(bigint, text, text), public.can_view_photo(text),
  public.moderation_queue(), public.moderate_stamp(bigint, text) to authenticated;
grant execute on function public.set_ai_verdict(bigint, boolean, jsonb) to service_role;
drop function if exists public.can_view_photo_folder(text);
