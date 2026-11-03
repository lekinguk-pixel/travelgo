-- Photos still waiting for the AI check after 30 minutes go to the moderators' queue.

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
       or (s.photo_status = 'pending' and s.claimed_at < now() - interval '30 minutes')
       or s.status = 'pending_review'
       or exists (select 1 from public.stamp_reports r where r.stamp_id = s.id and r.resolved_at is null)
    order by (s.photo_status = 'flagged') desc, s.claimed_at;
end;
$$;

