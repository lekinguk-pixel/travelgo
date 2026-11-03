-- Gentler, more reliable media fetching:
--   * rate-limited answers (HTTP 429) are retried later instead of failing
--   * candidates whose Wikipedia page has no coordinates fall back to Wikidata (P625)
--   * smaller batches every 10 minutes

alter table public.landmark_candidates
  add column qid text,
  add column page jsonb;

alter table public.media_requests drop constraint media_requests_kind_check;
alter table public.media_requests add constraint media_requests_kind_check
  check (kind in ('landmark', 'city', 'candidate', 'candidate_coords', 'landmark_file', 'city_file'));

create or replace function public._add_candidate(p_cand public.landmark_candidates, j jsonb, v_lat double precision, v_lng double precision, v_file text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if (select public.distance_m(c.lat, c.lng, v_lat, v_lng) from public.cities c where c.id = p_cand.city_id) > 40000 then
    raise exception 'Coordinates are too far from the city';
  end if;
  insert into public.landmarks (city_id, name, description, lat, lng, radius_m, rarity, is_major, skills,
      wikidata_id, location_verified, wiki_title, summary, wiki_url, photo_file, media_checked_at)
  values (p_cand.city_id, p_cand.name, j->>'description', v_lat, v_lng, p_cand.radius_m, p_cand.rarity, p_cand.is_major,
      p_cand.skills, j->>'wikibase_item', true, p_cand.wiki_title, j->>'extract',
      j#>>'{content_urls,desktop,page}', v_file, now())
  on conflict (city_id, name) do nothing;
  update public.landmark_candidates set status = 'added', note = null, page = null where id = p_cand.id;
end;
$$;

create or replace function public._commons_file_from_page(j jsonb)
returns text language sql immutable set search_path = '' as $$
  select case when v ~ '^https://(upload|thumb)\.wikimedia\.org/wikipedia/commons/'
    then public._url_decode(regexp_replace(v, '^.*/commons/(thumb/)?[0-9a-f]/[0-9a-f]{2}/([^/?]+).*$', '\2')) end
  from (select coalesce(j#>>'{originalimage,source}', j#>>'{thumbnail,source}') as v) s;
$$;

create or replace function public.process_media_responses()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  r record; j jsonb; v_file text; v_lat double precision; v_lng double precision; v_req bigint;
  v_info jsonb; v_meta jsonb; v_thumb text; v_done integer := 0; v_failed integer := 0; v_retry integer := 0;
  v_cand public.landmark_candidates;
begin
  for r in
    select m.request_id, m.kind, m.ref_id, h.status_code, h.content, h.error_msg
    from public.media_requests m join net._http_response h on h.id = m.request_id
  loop
    begin
      if r.status_code = 429 or r.status_code >= 500 or r.status_code is null then
        -- Try again on a later run.
        if r.kind = 'candidate' then update public.landmark_candidates set status = 'new' where id = r.ref_id; end if;
        v_retry := v_retry + 1;
        delete from public.media_requests where request_id = r.request_id;
        continue;
      end if;
      if r.status_code <> 200 then raise exception 'HTTP %', r.status_code; end if;
      j := r.content::jsonb;

      if r.kind in ('landmark', 'city', 'candidate') then
        if j->>'type' = 'disambiguation' then raise exception 'Disambiguation page'; end if;
        v_file := public._commons_file_from_page(j);
        v_lat := (j#>>'{coordinates,lat}')::double precision;
        v_lng := (j#>>'{coordinates,lon}')::double precision;

        if r.kind = 'city' then
          update public.cities set summary = j->>'extract', wiki_url = j#>>'{content_urls,desktop,page}',
            photo_file = v_file, media_checked_at = now() where id = r.ref_id;
        elsif r.kind = 'landmark' then
          update public.landmarks set summary = j->>'extract', wiki_url = j#>>'{content_urls,desktop,page}',
            photo_file = v_file, media_checked_at = now(),
            description = coalesce(description, j->>'description'),
            wikidata_id = coalesce(wikidata_id, j->>'wikibase_item'),
            lat = case when v_lat is not null and public.distance_m(lat, lng, v_lat, v_lng) between 150 and 2000 then v_lat else lat end,
            lng = case when v_lat is not null and public.distance_m(lat, lng, v_lat, v_lng) between 150 and 2000 then v_lng else lng end,
            location_verified = location_verified or (v_lat is not null and public.distance_m(lat, lng, v_lat, v_lng) <= 2000)
          where id = r.ref_id;
        else
          select * into v_cand from public.landmark_candidates where id = r.ref_id;
          if v_lat is not null then
            perform public._add_candidate(v_cand, j, v_lat, v_lng, v_file);
          elsif j->>'wikibase_item' is not null then
            -- No coordinates on the Wikipedia page: ask Wikidata.
            update public.landmark_candidates set qid = j->>'wikibase_item', page = j, status = 'requested' where id = v_cand.id;
            v_req := net.http_get(
              url := 'https://www.wikidata.org/w/api.php?action=wbgetclaims&format=json&property=P625&entity=' || (j->>'wikibase_item'),
              headers := public._wm_headers(), timeout_milliseconds := 15000);
            insert into public.media_requests (request_id, kind, ref_id) values (v_req, 'candidate_coords', v_cand.id);
          else
            raise exception 'No coordinates on Wikipedia';
          end if;
        end if;

      elsif r.kind = 'candidate_coords' then
        select * into v_cand from public.landmark_candidates where id = r.ref_id;
        v_lat := (j#>>'{claims,P625,0,mainsnak,datavalue,value,latitude}')::double precision;
        v_lng := (j#>>'{claims,P625,0,mainsnak,datavalue,value,longitude}')::double precision;
        if v_lat is null then raise exception 'No coordinates on Wikipedia or Wikidata'; end if;
        perform public._add_candidate(v_cand, v_cand.page, v_lat, v_lng, public._commons_file_from_page(v_cand.page));

      else
        v_info := (select p.value from jsonb_each(j#>'{query,pages}') p limit 1)->'imageinfo'->0;
        if v_info is null then raise exception 'No file info'; end if;
        v_meta := v_info->'extmetadata';
        v_thumb := coalesce(v_info->>'thumburl', v_info->>'url');
        if r.kind = 'landmark_file' then
          update public.landmarks set
            photo_url = v_thumb,
            photo_thumb_url = replace(v_thumb, '/1280px-', '/500px-'),
            photo_credit = coalesce(public._strip_html(v_meta#>>'{Artist,value}'), public._strip_html(v_meta#>>'{Credit,value}'), 'Wikimedia Commons'),
            photo_license = coalesce(v_meta#>>'{LicenseShortName,value}', 'See source'),
            photo_license_url = v_meta#>>'{LicenseUrl,value}',
            photo_source_url = v_info->>'descriptionurl'
          where id = r.ref_id;
        else
          update public.cities set
            photo_url = v_thumb,
            photo_thumb_url = replace(v_thumb, '/1280px-', '/500px-'),
            photo_credit = coalesce(public._strip_html(v_meta#>>'{Artist,value}'), public._strip_html(v_meta#>>'{Credit,value}'), 'Wikimedia Commons'),
            photo_license = coalesce(v_meta#>>'{LicenseShortName,value}', 'See source'),
            photo_license_url = v_meta#>>'{LicenseUrl,value}',
            photo_source_url = v_info->>'descriptionurl'
          where id = r.ref_id;
        end if;
      end if;
      v_done := v_done + 1;
    exception when others then
      v_failed := v_failed + 1;
      if r.kind in ('candidate', 'candidate_coords') then update public.landmark_candidates set status = 'failed', note = sqlerrm where id = r.ref_id;
      elsif r.kind = 'landmark' then update public.landmarks set media_checked_at = now() where id = r.ref_id;
      elsif r.kind = 'city' then update public.cities set media_checked_at = now() where id = r.ref_id;
      elsif r.kind = 'landmark_file' then update public.landmarks set photo_file = null where id = r.ref_id;
      else update public.cities set photo_file = null where id = r.ref_id; end if;
    end;
    delete from public.media_requests where request_id = r.request_id;
  end loop;
  return jsonb_build_object('stored', v_done, 'failed', v_failed, 'retry_later', v_retry,
    'waiting', (select count(*) from public.media_requests));
end;
$$;

revoke execute on function public._add_candidate(public.landmark_candidates, jsonb, double precision, double precision, text),
  public._commons_file_from_page(jsonb), public.process_media_responses() from public, anon, authenticated;

-- Retry the rate-limited ones; fix titles that didn't match a Wikipedia article.
update public.landmark_candidates set status = 'new', note = null where status = 'failed' and note like 'HTTP 429%';
update public.landmark_candidates set status = 'new', note = null where status = 'failed' and note = 'No coordinates on Wikipedia';
update public.landmark_candidates lc set wiki_title = v.t, status = 'new', note = null
from public.cities c, (values
  ('Amsterdam', 'A''DAM Lookout', 'A''DAM Toren'),
  ('Belfast', 'Botanic Gardens', 'Botanic Gardens (Belfast)'),
  ('Belfast', 'Cave Hill', 'Cavehill'),
  ('York', 'Clifford''s Tower', 'York Castle')
) as v(city, name, t)
where lc.city_id = c.id and c.name = v.city and lc.name = v.name;
-- No reliable article: drop these for now.
delete from public.landmark_candidates lc using public.cities c
where lc.city_id = c.id and (c.name, lc.name) in (('Bath', 'Sally Lunn''s'), ('Edinburgh', 'Victoria Street'), ('Edinburgh', 'Camera Obscura'));

select cron.unschedule('landmark-media');
select cron.schedule('landmark-media', '*/10 * * * *', $$select public.process_media_responses(); select public.queue_media_fetch(40);$$);
