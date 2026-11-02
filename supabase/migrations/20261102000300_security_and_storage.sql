-- mmGO security: row-level security on every table, column-level write limits,
-- function permissions, and the private bucket for stamp photos.

-- ---------- turn on RLS everywhere ----------
alter table public.continents enable row level security;
alter table public.countries enable row level security;
alter table public.cities enable row level security;
alter table public.landmarks enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.skill_levels enable row level security;
alter table public.skill_xp enable row level security;
alter table public.stamps enable row level security;
alter table public.xp_events enable row level security;
alter table public.stamp_reports enable row level security;
alter table public.city_awards enable row level security;
alter table public.quests enable row level security;
alter table public.quest_steps enable row level security;
alter table public.quest_completions enable row level security;
alter table public.friendships enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- ---------- the world: readable by anyone, written only by admins ----------
create policy "Anyone can read continents" on public.continents for select to anon, authenticated using (true);
create policy "Anyone can read countries" on public.countries for select to anon, authenticated using (true);
create policy "Anyone can read cities" on public.cities for select to anon, authenticated using (true);
create policy "Anyone can read landmarks" on public.landmarks for select to anon, authenticated using (true);
create policy "Anyone can read the level table" on public.skill_levels for select to anon, authenticated using (true);
create policy "Anyone can read quests" on public.quests for select to anon, authenticated using (true);
create policy "Anyone can read quest steps" on public.quest_steps for select to anon, authenticated using (true);
revoke insert, update, delete on public.continents, public.countries, public.cities, public.landmarks,
  public.skill_levels, public.quests, public.quest_steps from anon, authenticated;

-- ---------- players ----------
create policy "Players can see travellers" on public.profiles for select to authenticated using (true);
create policy "Players edit their own traveller" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (avatar, home_city_id) on public.profiles to authenticated;   -- not name, not XP

create policy "Players see their own private details" on public.profile_private for select to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.profile_private from anon, authenticated;

create policy "Players can see skill levels" on public.skill_xp for select to authenticated using (true);
revoke insert, update, delete on public.skill_xp from anon, authenticated;

-- ---------- stamps and XP: read your own, written only by claim_stamp ----------
create policy "Players see their own stamps" on public.stamps for select to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.stamps from anon, authenticated;

create policy "Players see their own XP history" on public.xp_events for select to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.xp_events from anon, authenticated;

create policy "Players can see chapters completed" on public.city_awards for select to authenticated using (true);
revoke insert, update, delete on public.city_awards from anon, authenticated;

create policy "Players see their own quest completions" on public.quest_completions for select to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.quest_completions from anon, authenticated;

create policy "Players report stamps as themselves" on public.stamp_reports for insert to authenticated
  with check ((select auth.uid()) = reporter_id);
create policy "Players see their own reports" on public.stamp_reports for select to authenticated
  using ((select auth.uid()) = reporter_id);
revoke update, delete on public.stamp_reports from anon, authenticated;

-- ---------- friends ----------
create policy "Players see their own friendships" on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));
create policy "Players send friend requests" on public.friendships for insert to authenticated
  with check ((select auth.uid()) = requester_id and status = 'pending');
create policy "Players accept requests sent to them" on public.friendships for update to authenticated
  using ((select auth.uid()) = addressee_id) with check ((select auth.uid()) = addressee_id and status = 'accepted');
create policy "Either friend can remove a friendship" on public.friendships for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));
revoke update on public.friendships from anon, authenticated;
grant update (status) on public.friendships to authenticated;

-- ---------- clans ----------
create or replace function public.is_group_leader(p_group_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members
                 where group_id = p_group_id and user_id = (select auth.uid()) and role = 'leader');
$$;

create policy "Players can see clans" on public.groups for select to authenticated using (true);
create policy "Players create clans as themselves" on public.groups for insert to authenticated
  with check ((select auth.uid()) = created_by);
create policy "Leaders rename their clan" on public.groups for update to authenticated
  using (public.is_group_leader(id)) with check (public.is_group_leader(id));
create policy "Leaders disband their clan" on public.groups for delete to authenticated
  using (public.is_group_leader(id));
revoke update on public.groups from anon, authenticated;
grant update (name) on public.groups to authenticated;

create policy "Players can see clan members" on public.group_members for select to authenticated using (true);
create policy "Players join clans as members" on public.group_members for insert to authenticated
  with check ((select auth.uid()) = user_id and role = 'member');
create policy "Players leave, or leaders remove members" on public.group_members for delete to authenticated
  using ((select auth.uid()) = user_id or public.is_group_leader(group_id));
revoke update on public.group_members from anon, authenticated;

-- ---------- function permissions ----------
revoke execute on function public._award_stamp_xp(bigint) from public, anon, authenticated;
revoke execute on function public._add_group_leader() from public, anon, authenticated;
revoke execute on function public.create_traveller(text, date, bigint, jsonb) from public, anon;
revoke execute on function public.claim_stamp(bigint, double precision, double precision, real, text) from public, anon;
revoke execute on function public.city_progress(bigint) from public, anon;
revoke execute on function public.leaderboard(text, text, text, text, integer) from public, anon;
revoke execute on function public.traveller_name_available(text) from public, anon;
revoke execute on function public.is_group_leader(bigint) from public, anon;
grant execute on function public.create_traveller(text, date, bigint, jsonb) to authenticated;
grant execute on function public.claim_stamp(bigint, double precision, double precision, real, text) to authenticated;
grant execute on function public.city_progress(bigint) to authenticated;
grant execute on function public.leaderboard(text, text, text, text, integer) to authenticated;
grant execute on function public.traveller_name_available(text) to authenticated;
grant execute on function public.is_group_leader(bigint) to authenticated;

-- ---------- stamp photos: private, one folder per player ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('stamp-photos', 'stamp-photos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

create policy "Players upload stamp photos to their own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'stamp-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Players view their own stamp photos" on storage.objects for select to authenticated
  using (bucket_id = 'stamp-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Players delete unused stamp photos" on storage.objects for delete to authenticated
  using (bucket_id = 'stamp-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
         and not exists (select 1 from public.stamps s where s.photo_path = name));
