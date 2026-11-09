-- Automatic landmark finder. For each city marked for scanning, ask Wikidata for
-- things with photos and English Wikipedia articles near the city centre, ranked
-- by how many language editions of Wikipedia cover them (a good measure of fame).
-- Keep real sights (churches, museums, castles, bridges, parks...) and drop
-- settlements, events, organisations and places of mourning (memorials,
-- cemeteries). The top 12 become landmark candidates, which then go through the
-- usual Wikipedia checks (photo, description, confirmed coordinates).

alter table public.cities
  add column scan_status text check (scan_status in ('pending', 'requested', 'done', 'failed')),
  add column scan_radius_km numeric not null default 5,
  add column scan_note text,
  add column travel_ok boolean not null default true;
alter table public.countries add column travel_ok boolean not null default true;
alter table public.landmark_candidates add column sitelinks integer;

alter table public.media_requests drop constraint media_requests_kind_check;
alter table public.media_requests add constraint media_requests_kind_check
  check (kind in ('landmark', 'city', 'candidate', 'candidate_coords', 'landmark_file', 'city_file', 'city_scan'));

create or replace function public._city_scan_url(p_lat double precision, p_lng double precision, p_radius numeric)
returns text language sql immutable set search_path = '' as $$
  select 'https://query.wikidata.org/sparql?format=json&query=' || public._url_encode(format($q$
SELECT ?item ?itemLabel ?sitelinks ?article (GROUP_CONCAT(DISTINCT ?tl; separator="|") AS ?types) WHERE {
  SERVICE wikibase:around { ?item wdt:P625 ?loc . bd:serviceParam wikibase:center "Point(%s %s)"^^geo:wktLiteral . bd:serviceParam wikibase:radius "%s" . }
  ?item wikibase:sitelinks ?sitelinks . FILTER(?sitelinks >= 4)
  ?item wdt:P18 ?img .
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
  OPTIONAL { ?item wdt:P31 ?t . ?t rdfs:label ?tl . FILTER(LANG(?tl) = "en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} GROUP BY ?item ?itemLabel ?sitelinks ?article ORDER BY DESC(?sitelinks) LIMIT 120
$q$, p_lng, p_lat, p_radius));
$$;

-- Is this Wikidata thing a visitable sight? (types = its "instance of" labels joined by |)
create or replace function public._is_sight(p_types text)
returns boolean language sql immutable set search_path = '' as $$
  with t as (select lower(x) as ty from unnest(string_to_array(coalesce(p_types, ''), '|')) x)
  select exists (select 1 from t where ty ~ '(church|cathedral|basilica|chapel|mosque|synagogue|temple|monastery|abbey|convent|shrine|museum|gallery|palace|castle|fortress|^fort|citadel|tower|bridge|square|plaza|park|garden|theat(re|er)|opera|concert hall|library|monument|statue|fountain|archaeological|ruins|amphithea|stadium|market|tourist attraction|gate|city wall|defensive wall|lighthouse|viewpoint|mountain|hill|cave|waterfall|beach|zoo|aquarium|botanical|heritage|landmark|café|observatory|windmill|manor|villa|mansion|town hall|city hall|parliament|legislative building|royal residence|mausoleum|ferris wheel|castle|old town|historic (centre|center|district))')
     and not exists (select 1 from t where
           ty ~ '^((big|large|small|medium-sized) )?(city|town|village|capital|capital city|human settlement|urban area|metropolitan area|suburb|locality|quarter|neighbou?rhood)$'
        or ty ~ '^(former )?(municipality|freguesia|commune|district|borough|parish|civil parish|county|province|region|city district|urban municipality|statutory city|county seat|cadastral|administrative)'
        or ty ~ '(battle|siege|massacre|^war$|match|final|tournament|season|festival|company|publisher|periodical|newspaper|magazine|sports club|football club|sports team|league|governing body|university|school|college|hospital|metro|tram system|light rail|transport network|rapid transit|railway line|^road|highway|motorway|^river|main stem|^sea$|strait|gulf|^bay$|^lake$|reservoir|^canal$|^island$|memorial|cemetery|grave|concentration camp|extermination|genocide|embassy|consulate|ministry|government agency|diocese|electoral|constituency|defunct|demolished|destroyed|airport|ship|car park|industrial park|business park|office park|market town)');
$$;

-- Turn a Wikidata scan into the city's top 12 landmark candidates.
create or replace function public._apply_city_scan(p_city_id bigint, p_json jsonb)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare r record; v_rank integer := 0; v_stadiums integer := 0; v_bridges integer := 0; v_rarity text; v_skills text[]; v_radius integer; v_title text;
begin
  for r in
    select b->'itemLabel'->>'value' as name,
           regexp_replace(b->'item'->>'value', '^.*/', '') as qid,
           (b->'sitelinks'->>'value')::int as sl,
           lower(coalesce(b->'types'->>'value', '')) as types,
           b->'article'->>'value' as article
    from jsonb_array_elements(p_json->'results'->'bindings') b
    where public._is_sight(b->'types'->>'value')
    order by (b->'sitelinks'->>'value')::numeric
             * case when lower(coalesce(b->'types'->>'value', '')) ~ '(stadium|arena|sports venue)' then 0.5 else 1 end
             * case when lower(coalesce(b->'types'->>'value', '')) ~ 'bridge' then 0.8 else 1 end desc
  loop
    exit when v_rank >= 12;
    continue when r.name ~ '^Q[0-9]+$';                                   -- no English label
    continue when exists (select 1 from public.landmarks where wikidata_id = r.qid);
    continue when exists (select 1 from public.landmark_candidates where qid = r.qid or (city_id = p_city_id and name = r.name));
    if r.types ~ '(stadium|arena|sports venue)' then v_stadiums := v_stadiums + 1; continue when v_stadiums > 1; end if;
    if r.types ~ 'bridge' then v_bridges := v_bridges + 1; continue when v_bridges > 2; end if;
    v_rank := v_rank + 1;
    v_rarity := case
      when v_rank = 1 then case when r.sl >= 80 then 'legendary' else 'epic' end
      when v_rank <= 3 then case when r.sl >= 60 then 'epic' else 'rare' end
      when v_rank <= 6 then case when r.sl >= 25 then 'rare' else 'uncommon' end
      when v_rank <= 9 then 'uncommon' else 'common' end;
    if r.types ~ '(stadium|arena|sports venue)' and v_rarity in ('legendary', 'epic') then v_rarity := 'rare'; end if;
    v_skills := array['explorer']
      || case when r.types ~ '(church|cathedral|basilica|chapel|mosque|synagogue|temple|monastery|abbey|convent|shrine)' then array['pilgrim'] else array[]::text[] end
      || case when r.types ~ '(museum|gallery|palace|castle|fortress|citadel|theat|opera|concert|library|monument|archaeolog|ruins|amphithea|heritage|town hall|city hall|parliament|mausoleum)' then array['culture'] else array[]::text[] end
      || case when r.types ~ '(park|garden|mountain|hill|cave|waterfall|beach|zoo|aquarium|botanical|viewpoint|nature)' then array['nature'] else array[]::text[] end
      || case when r.types ~ '(market|café|brewery|food)' then array['foodie'] else array[]::text[] end;
    v_radius := case when r.types ~ '(park|garden|castle|fortress|citadel|palace|archaeolog|square|plaza|hill|mountain|zoo|stadium|beach|monastery|old town|historic)' then 250 else 120 end;
    v_title := replace(public._url_decode(regexp_replace(r.article, '^https://en\.wikipedia\.org/wiki/', '')), '_', ' ');
    insert into public.landmark_candidates (city_id, name, wiki_title, rarity, skills, radius_m, is_major, qid, sitelinks)
    values (p_city_id, left(r.name, 80), v_title, v_rarity::public.rarity, v_skills::public.skill[], v_radius, v_rank <= 10, r.qid, r.sl)
    on conflict (city_id, name) do nothing;
  end loop;
  update public.cities set scan_status = 'done', scan_note = v_rank || ' candidates' where id = p_city_id;
  return v_rank;
end;
$$;

-- Candidates must not duplicate a landmark that's already live anywhere.
create or replace function public._add_candidate(p_cand public.landmark_candidates, j jsonb, v_lat double precision, v_lng double precision, v_file text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if (select public.distance_m(c.lat, c.lng, v_lat, v_lng) from public.cities c where c.id = p_cand.city_id) > 40000 then
    raise exception 'Coordinates are too far from the city';
  end if;
  if j->>'wikibase_item' is not null and exists (select 1 from public.landmarks where wikidata_id = j->>'wikibase_item') then
    update public.landmark_candidates set status = 'failed', note = 'Already a landmark elsewhere', page = null where id = p_cand.id;
    return;
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

-- Queue: scans for cities whose own Wikipedia page (and so corrected coordinates) has arrived.
create or replace function public.queue_city_scans(p_limit integer default 4)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare r record; v_req bigint; v_n integer := 0;
begin
  for r in select id, lat, lng, scan_radius_km from public.cities
           where scan_status = 'pending' and media_checked_at is not null order by id limit p_limit loop
    v_req := net.http_get(url := public._city_scan_url(r.lat, r.lng, r.scan_radius_km),
      headers := public._wm_headers() || '{"Accept":"application/sparql-results+json"}'::jsonb, timeout_milliseconds := 60000);
    insert into public.media_requests (request_id, kind, ref_id) values (v_req, 'city_scan', r.id);
    update public.cities set scan_status = 'requested' where id = r.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- process_media_responses: add city scans, and let a city's Wikipedia page correct its coordinates.
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
        if r.kind = 'candidate' then update public.landmark_candidates set status = 'new' where id = r.ref_id; end if;
        if r.kind = 'city_scan' then update public.cities set scan_status = 'pending' where id = r.ref_id; end if;
        v_retry := v_retry + 1;
        delete from public.media_requests where request_id = r.request_id;
        continue;
      end if;
      if r.status_code <> 200 then raise exception 'HTTP %', r.status_code; end if;
      j := r.content::jsonb;

      if r.kind = 'city_scan' then
        perform public._apply_city_scan(r.ref_id, j);
      elsif r.kind in ('landmark', 'city', 'candidate') then
        if j->>'type' = 'disambiguation' then raise exception 'Disambiguation page'; end if;
        v_file := public._commons_file_from_page(j);
        v_lat := (j#>>'{coordinates,lat}')::double precision;
        v_lng := (j#>>'{coordinates,lon}')::double precision;

        if r.kind = 'city' then
          update public.cities set summary = j->>'extract', wiki_url = j#>>'{content_urls,desktop,page}',
            photo_file = v_file, media_checked_at = now(),
            lat = case when v_lat is not null and public.distance_m(lat, lng, v_lat, v_lng) <= 30000 then v_lat else lat end,
            lng = case when v_lat is not null and public.distance_m(lat, lng, v_lat, v_lng) <= 30000 then v_lng else lng end
          where id = r.ref_id;
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
            photo_url = v_thumb, photo_thumb_url = replace(v_thumb, '/1280px-', '/500px-'),
            photo_credit = coalesce(public._strip_html(v_meta#>>'{Artist,value}'), public._strip_html(v_meta#>>'{Credit,value}'), 'Wikimedia Commons'),
            photo_license = coalesce(v_meta#>>'{LicenseShortName,value}', 'See source'),
            photo_license_url = v_meta#>>'{LicenseUrl,value}', photo_source_url = v_info->>'descriptionurl'
          where id = r.ref_id;
        else
          update public.cities set
            photo_url = v_thumb, photo_thumb_url = replace(v_thumb, '/1280px-', '/500px-'),
            photo_credit = coalesce(public._strip_html(v_meta#>>'{Artist,value}'), public._strip_html(v_meta#>>'{Credit,value}'), 'Wikimedia Commons'),
            photo_license = coalesce(v_meta#>>'{LicenseShortName,value}', 'See source'),
            photo_license_url = v_meta#>>'{LicenseUrl,value}', photo_source_url = v_info->>'descriptionurl'
          where id = r.ref_id;
        end if;
      end if;
      v_done := v_done + 1;
    exception when others then
      v_failed := v_failed + 1;
      if r.kind in ('candidate', 'candidate_coords') then update public.landmark_candidates set status = 'failed', note = sqlerrm where id = r.ref_id;
      elsif r.kind = 'city_scan' then update public.cities set scan_status = 'failed', scan_note = sqlerrm where id = r.ref_id;
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

revoke execute on function public._city_scan_url(double precision, double precision, numeric), public._is_sight(text),
  public._apply_city_scan(bigint, jsonb), public.queue_city_scans(integer), public.process_media_responses(),
  public._add_candidate(public.landmark_candidates, jsonb, double precision, double precision, text)
  from public, anon, authenticated;

select cron.unschedule('landmark-media');
select cron.schedule('landmark-media', '*/10 * * * *',
  $$select public.process_media_responses(); select public._requeue_stuck_candidates(); select public.queue_city_scans(4); select public.queue_media_fetch(80);$$);
