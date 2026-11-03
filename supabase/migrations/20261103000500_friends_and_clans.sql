-- mmGO social: friends (add by traveller name, accept, remove), a feed of
-- friends' stamps, viewing a friend's journey and photos, and RuneScape-style
-- clans (one per player, joined with an invite code).

-- ======================= FRIENDS =======================

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select a = b or exists (
    select 1 from public.friendships f where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b) or (f.requester_id = b and f.addressee_id = a)));
$$;

-- Used by the storage policy: can the caller see photos in this player's folder?
create or replace function public.can_view_photo_folder(p_folder text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships f where f.status = 'accepted'
      and ((f.requester_id = auth.uid() and f.addressee_id::text = p_folder)
        or (f.addressee_id = auth.uid() and f.requester_id::text = p_folder)));
$$;

-- Add a friend by traveller name. Accepts automatically if they already asked you.
create or replace function public.add_friend(p_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_other uuid;
begin
  if v_uid is null then raise exception 'You need to be signed in.' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'Create your traveller first.' using errcode = '22023'; end if;
  select id into v_other from public.profiles where lower(traveller_name::text) = lower(trim(p_name));
  if v_other is null then
    raise exception 'No traveller called "%" was found. Check the spelling.', trim(p_name) using errcode = '22023'; end if;
  if v_other = v_uid then raise exception 'That''s you!' using errcode = '22023'; end if;
  if exists (select 1 from public.friendships where status = 'accepted'
             and ((requester_id = v_uid and addressee_id = v_other) or (requester_id = v_other and addressee_id = v_uid))) then
    return 'already_friends'; end if;
  if exists (select 1 from public.friendships where requester_id = v_other and addressee_id = v_uid) then
    update public.friendships set status = 'accepted' where requester_id = v_other and addressee_id = v_uid;
    return 'accepted';
  end if;
  if exists (select 1 from public.friendships where requester_id = v_uid and addressee_id = v_other) then
    return 'already_requested'; end if;
  if (select count(*) from public.friendships where requester_id = v_uid and status = 'pending') >= 50 then
    raise exception 'You have 50 friend requests waiting. Wait for some to be answered first.' using errcode = '54000'; end if;
  insert into public.friendships (requester_id, addressee_id) values (v_uid, v_other);
  return 'requested';
end;
$$;

-- Accept or decline a request someone sent you.
create or replace function public.respond_friend(p_user_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_accept then
    update public.friendships set status = 'accepted'
    where requester_id = p_user_id and addressee_id = auth.uid() and status = 'pending';
  else
    delete from public.friendships
    where requester_id = p_user_id and addressee_id = auth.uid() and status = 'pending';
  end if;
end;
$$;

-- Remove a friend, or cancel a request you sent.
create or replace function public.remove_friend(p_user_id uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.friendships
  where (requester_id = auth.uid() and addressee_id = p_user_id)
     or (requester_id = p_user_id and addressee_id = auth.uid());
$$;

-- Your friends, incoming requests and sent requests.
create or replace function public.my_friends()
returns table (user_id uuid, traveller_name text, avatar jsonb, total_xp bigint, home_city text, status text, since timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.traveller_name::text, p.avatar, p.total_xp, c.name,
         case when f.status = 'accepted' then 'friend'
              when f.addressee_id = auth.uid() then 'incoming' else 'outgoing' end,
         f.created_at
  from public.friendships f
  join public.profiles p on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  left join public.cities c on c.id = p.home_city_id
  where auth.uid() in (f.requester_id, f.addressee_id)
  order by f.status = 'accepted', p.total_xp desc;
$$;

-- Recent stamps from your friends, newest first.
create or replace function public.friends_feed(p_limit integer default 30)
returns table (stamp_id bigint, user_id uuid, traveller_name text, avatar jsonb, landmark text,
               rarity public.rarity, city text, claimed_at timestamptz, photo_path text, xp_awarded integer)
language sql stable security definer set search_path = '' as $$
  select s.id, s.user_id, p.traveller_name::text, p.avatar, l.name, l.rarity, c.name, s.claimed_at, s.photo_path, s.xp_awarded
  from public.stamps s
  join public.profiles p on p.id = s.user_id
  join public.landmarks l on l.id = s.landmark_id
  join public.cities c on c.id = l.city_id
  where s.status = 'verified' and s.user_id <> auth.uid() and public.are_friends(auth.uid(), s.user_id)
  order by s.claimed_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

-- A friend's stamp book (or your own).
create or replace function public.traveller_journey(p_user_id uuid)
returns table (stamp_id bigint, landmark text, rarity public.rarity, city text, claimed_at timestamptz, photo_path text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.are_friends(auth.uid(), p_user_id) then
    raise exception 'You can only see the journeys of your friends.' using errcode = '42501'; end if;
  return query
    select s.id, l.name, l.rarity, c.name, s.claimed_at, s.photo_path
    from public.stamps s
    join public.landmarks l on l.id = s.landmark_id
    join public.cities c on c.id = l.city_id
    where s.user_id = p_user_id and s.status = 'verified'
    order by s.claimed_at desc;
end;
$$;

-- Friends can see each other's stamp photos.
create policy "Friends view each other's stamp photos" on storage.objects for select to authenticated
  using (bucket_id = 'stamp-photos' and public.can_view_photo_folder((storage.foldername(name))[1]));

-- Friend requests now go through add_friend / respond_friend / remove_friend.
drop policy if exists "Players send friend requests" on public.friendships;
drop policy if exists "Players accept requests sent to them" on public.friendships;
drop policy if exists "Either friend can remove a friendship" on public.friendships;
revoke insert, update, delete on public.friendships from anon, authenticated;

-- ======================= CLANS =======================

-- One clan per player.
create unique index group_members_one_clan on public.group_members (user_id);

-- Invite codes, visible only to the clan's own members.
create table public.group_invites (
  group_id bigint primary key references public.groups (id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);
alter table public.group_invites enable row level security;
create policy "Clan members see their invite code" on public.group_invites for select to authenticated
  using (exists (select 1 from public.group_members gm
                 where gm.group_id = group_invites.group_id and gm.user_id = (select auth.uid())));
revoke insert, update, delete on public.group_invites from anon, authenticated;

-- Creating, joining and leaving now go through the functions below.
drop policy if exists "Players create clans as themselves" on public.groups;
drop policy if exists "Players join clans as members" on public.group_members;
drop policy if exists "Players leave, or leaders remove members" on public.group_members;
revoke insert, delete on public.groups from anon, authenticated;
revoke insert, delete on public.group_members from anon, authenticated;
alter table public.groups add constraint groups_name_chars check (name ~ '^[A-Za-z0-9 _''-]{3,30}$');

create or replace function public._new_clan_code()
returns text language plpgsql volatile set search_path = '' as $$
declare v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; v_code text;
begin
  loop
    v_code := '';
    for i in 1..6 loop v_code := v_code || substr(v_chars, 1 + floor(random() * 32)::int, 1); end loop;
    exit when not exists (select 1 from public.group_invites where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.create_clan(p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_name text := trim(regexp_replace(p_name, '\s+', ' ', 'g')); v_id bigint; v_code text;
begin
  if v_uid is null then raise exception 'You need to be signed in.' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'Create your traveller first.' using errcode = '22023'; end if;
  if exists (select 1 from public.group_members where user_id = v_uid) then
    raise exception 'You''re already in a clan. Leave it before starting a new one.' using errcode = '23505'; end if;
  if v_name is null or v_name !~ '^[A-Za-z0-9 _''-]{3,30}$' then
    raise exception 'Clan names use 3 to 30 letters, numbers, spaces, hyphens or apostrophes.' using errcode = '22023'; end if;
  begin
    insert into public.groups (name, created_by) values (v_name, v_uid) returning id into v_id;
  exception when unique_violation then
    raise exception 'A clan called "%" already exists. Try another name.', v_name using errcode = '23505';
  end;
  v_code := public._new_clan_code();
  insert into public.group_invites (group_id, code) values (v_id, v_code);
  return jsonb_build_object('id', v_id, 'name', v_name, 'code', v_code);
end;
$$;

create or replace function public.join_clan(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_group record;
begin
  if v_uid is null then raise exception 'You need to be signed in.' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'Create your traveller first.' using errcode = '22023'; end if;
  if exists (select 1 from public.group_members where user_id = v_uid) then
    raise exception 'You''re already in a clan. Leave it before joining another.' using errcode = '23505'; end if;
  select g.id, g.name::text as name into v_group
  from public.group_invites i join public.groups g on g.id = i.group_id
  where i.code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if not found then raise exception 'That invite code doesn''t match any clan. Check it and try again.' using errcode = '22023'; end if;
  if (select count(*) from public.group_members where group_id = v_group.id) >= 100 then
    raise exception 'That clan is full (100 members).' using errcode = '54000'; end if;
  insert into public.group_members (group_id, user_id, role) values (v_group.id, v_uid, 'member');
  return jsonb_build_object('id', v_group.id, 'name', v_group.name);
end;
$$;

-- Leave your clan. If the leader leaves, the longest-serving member takes over;
-- if nobody is left, the clan is disbanded.
create or replace function public.leave_clan()
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_m record; v_next uuid;
begin
  select group_id, role into v_m from public.group_members where user_id = v_uid;
  if not found then return; end if;
  delete from public.group_members where user_id = v_uid;
  if v_m.role = 'leader' then
    select user_id into v_next from public.group_members where group_id = v_m.group_id order by joined_at limit 1;
    if v_next is null then delete from public.groups where id = v_m.group_id;
    else update public.group_members set role = 'leader' where group_id = v_m.group_id and user_id = v_next;
    end if;
  end if;
end;
$$;

create or replace function public.kick_clan_member(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_group bigint;
begin
  select group_id into v_group from public.group_members where user_id = auth.uid() and role = 'leader';
  if v_group is null then raise exception 'Only the clan leader can remove members.' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'Use "Leave clan" to leave.' using errcode = '22023'; end if;
  delete from public.group_members where group_id = v_group and user_id = p_user_id;
end;
$$;

create or replace function public.reset_clan_code()
returns text language plpgsql security definer set search_path = '' as $$
declare v_group bigint; v_code text;
begin
  select group_id into v_group from public.group_members where user_id = auth.uid() and role = 'leader';
  if v_group is null then raise exception 'Only the clan leader can change the invite code.' using errcode = '42501'; end if;
  v_code := public._new_clan_code();
  update public.group_invites set code = v_code, created_at = now() where group_id = v_group;
  return v_code;
end;
$$;

-- Your clan with its members, or null if you're not in one.
create or replace function public.my_clan()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', g.id, 'name', g.name::text, 'role', me.role, 'code', i.code, 'created_at', g.created_at,
    'week_xp', coalesce((select sum(e.amount) from public.xp_events e
                         join public.group_members m on m.user_id = e.user_id
                         where m.group_id = g.id and e.created_at >= date_trunc('week', now())), 0),
    'members', (select jsonb_agg(jsonb_build_object(
                  'user_id', p.id, 'traveller_name', p.traveller_name::text, 'avatar', p.avatar,
                  'total_xp', p.total_xp, 'role', m.role, 'joined_at', m.joined_at)
                  order by m.role = 'leader' desc, p.total_xp desc)
                from public.group_members m join public.profiles p on p.id = m.user_id
                where m.group_id = g.id))
  from public.group_members me
  join public.groups g on g.id = me.group_id
  left join public.group_invites i on i.group_id = g.id
  where me.user_id = auth.uid();
$$;

-- ======================= PERMISSIONS =======================
revoke execute on function public._new_clan_code() from public, anon, authenticated;
revoke execute on function public.are_friends(uuid, uuid) from public, anon;
revoke execute on function public.can_view_photo_folder(text) from public, anon;
revoke execute on function public.add_friend(text) from public, anon;
revoke execute on function public.respond_friend(uuid, boolean) from public, anon;
revoke execute on function public.remove_friend(uuid) from public, anon;
revoke execute on function public.my_friends() from public, anon;
revoke execute on function public.friends_feed(integer) from public, anon;
revoke execute on function public.traveller_journey(uuid) from public, anon;
revoke execute on function public.create_clan(text) from public, anon;
revoke execute on function public.join_clan(text) from public, anon;
revoke execute on function public.leave_clan() from public, anon;
revoke execute on function public.kick_clan_member(uuid) from public, anon;
revoke execute on function public.reset_clan_code() from public, anon;
revoke execute on function public.my_clan() from public, anon;
grant execute on function public.are_friends(uuid, uuid), public.can_view_photo_folder(text),
  public.add_friend(text), public.respond_friend(uuid, boolean), public.remove_friend(uuid),
  public.my_friends(), public.friends_feed(integer), public.traveller_journey(uuid),
  public.create_clan(text), public.join_clan(text), public.leave_clan(), public.kick_clan_member(uuid),
  public.reset_clan_code(), public.my_clan() to authenticated;
