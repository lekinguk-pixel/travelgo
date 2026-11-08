-- Self-healing media fetch: a candidate left "requested" with no request in
-- flight (e.g. a Wikidata look-up that was rate-limited) goes back in the queue.
create or replace function public._requeue_stuck_candidates()
returns integer language sql volatile security definer set search_path = '' as $$
  with fixed as (
    update public.landmark_candidates lc set status = 'new', page = null, qid = null
    where lc.status = 'requested'
      and not exists (select 1 from public.media_requests m where m.ref_id = lc.id and m.kind in ('candidate', 'candidate_coords'))
    returning 1)
  select count(*)::int from fixed;
$$;
revoke execute on function public._requeue_stuck_candidates() from public, anon, authenticated;

select cron.unschedule('landmark-media');
select cron.schedule('landmark-media', '*/10 * * * *',
  $$select public.process_media_responses(); select public._requeue_stuck_candidates(); select public.queue_media_fetch(40);$$);

-- Title fixes for the new Croatian landmarks.
update public.landmark_candidates lc set wiki_title = 'Marjan, Split', status = 'new', note = null
from public.cities c where lc.city_id = c.id and c.name = 'Split' and lc.name = 'Marjan';
update public.landmark_candidates lc set note = 'No English Wikipedia article; left out'
from public.cities c where lc.city_id = c.id and (c.name, lc.name) in
  (('Dubrovnik', 'Minčeta Tower'), ('Dubrovnik', 'Church of St. Blaise'), ('Split', 'Archaeological Museum'));
