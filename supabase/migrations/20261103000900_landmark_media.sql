-- Real photos and information for landmarks and cities, from Wikipedia
-- (text, CC BY-SA 4.0) and Wikimedia Commons (photos, each with its own free
-- licence and author credit, which the app shows).
--
-- New landmarks are added as candidates first. A candidate only becomes a real,
-- stampable landmark once Wikipedia has given it coordinates, so nobody can be
-- asked to stamp a place whose location we haven't checked.

create extension if not exists pg_net with schema extensions;

alter table public.landmarks
  add column wiki_title text,
  add column summary text,
  add column wiki_url text,
  add column photo_url text,
  add column photo_thumb_url text,
  add column photo_credit text,
  add column photo_license text,
  add column photo_license_url text,
  add column photo_source_url text,
  add column photo_file text,
  add column media_checked_at timestamptz;

alter table public.cities
  add column wiki_title text,
  add column summary text,
  add column wiki_url text,
  add column photo_url text,
  add column photo_thumb_url text,
  add column photo_credit text,
  add column photo_license text,
  add column photo_license_url text,
  add column photo_source_url text,
  add column photo_file text,
  add column media_checked_at timestamptz;

create table public.landmark_candidates (
  id bigint generated always as identity primary key,
  city_id bigint not null references public.cities (id) on delete cascade,
  name text not null,
  wiki_title text not null,
  rarity public.rarity not null default 'common',
  skills public.skill[] not null default '{explorer}',
  radius_m integer not null default 150,
  is_major boolean not null default true,
  status text not null default 'new' check (status in ('new', 'requested', 'added', 'failed')),
  note text,
  unique (city_id, name)
);

-- Outstanding web requests made through pg_net.
create table public.media_requests (
  request_id bigint primary key,
  kind text not null check (kind in ('landmark', 'city', 'candidate', 'landmark_file', 'city_file')),
  ref_id bigint not null,
  created_at timestamptz not null default now()
);

alter table public.landmark_candidates enable row level security;
alter table public.media_requests enable row level security;
revoke all on public.landmark_candidates, public.media_requests from anon, authenticated;

-- Wikimedia asks every client to identify itself.
create or replace function public._wm_headers()
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('User-Agent', 'mmGO/0.1 (https://github.com/lekinguk-pixel/travelgo)',
                            'Api-User-Agent', 'mmGO/0.1 (https://github.com/lekinguk-pixel/travelgo)');
$$;

create or replace function public._wiki_summary_url(p_title text)
returns text language sql immutable set search_path = '' as $$
  select 'https://en.wikipedia.org/api/rest_v1/page/summary/' || public._url_encode(replace(p_title, ' ', '_')) || '?redirect=true';
$$;

create or replace function public._commons_file_url(p_file text)
returns text language sql immutable set search_path = '' as $$
  select 'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=1280&titles='
         || public._url_encode('File:' || p_file);
$$;

create or replace function public._url_decode(p text)
returns text language plpgsql immutable set search_path = '' as $$
declare v bytea := ''::bytea; i integer := 1; c text;
begin
  while i <= length(p) loop
    c := substr(p, i, 1);
    if c = '%' and substr(p, i + 1, 2) ~ '^[0-9A-Fa-f]{2}$' then
      v := v || decode(substr(p, i + 1, 2), 'hex'); i := i + 3;
    else
      v := v || convert_to(c, 'UTF8'); i := i + 1;
    end if;
  end loop;
  return convert_from(v, 'UTF8');
end;
$$;

create or replace function public._strip_html(p text)
returns text language sql immutable set search_path = '' as $$
  select nullif(btrim(regexp_replace(regexp_replace(coalesce(p, ''), '<[^>]*>', '', 'g'), '\s+', ' ', 'g')), '');
$$;

-- Send requests for everything still missing media (up to p_limit).
create or replace function public.queue_media_fetch(p_limit integer default 200)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare r record; v_n integer := 0; v_req bigint;
begin
  for r in
    select 'city' as kind, id, wiki_title as t from public.cities
      where wiki_title is not null and media_checked_at is null
        and not exists (select 1 from public.media_requests m where m.kind = 'city' and m.ref_id = cities.id)
    union all
    select 'landmark', id, wiki_title from public.landmarks
      where wiki_title is not null and media_checked_at is null
        and not exists (select 1 from public.media_requests m where m.kind = 'landmark' and m.ref_id = landmarks.id)
    union all
    select 'candidate', id, wiki_title from public.landmark_candidates where status = 'new'
    limit p_limit
  loop
    v_req := net.http_get(url := public._wiki_summary_url(r.t), headers := public._wm_headers(), timeout_milliseconds := 15000);
    insert into public.media_requests (request_id, kind, ref_id) values (v_req, r.kind, r.id);
    if r.kind = 'candidate' then update public.landmark_candidates set status = 'requested' where id = r.id; end if;
    v_n := v_n + 1;
  end loop;
  -- Photo licence look-ups for anything whose page image we know.
  for r in
    select 'landmark_file' as kind, id, photo_file as f from public.landmarks
      where photo_file is not null and photo_url is null
        and not exists (select 1 from public.media_requests m where m.kind = 'landmark_file' and m.ref_id = landmarks.id)
    union all
    select 'city_file', id, photo_file from public.cities
      where photo_file is not null and photo_url is null
        and not exists (select 1 from public.media_requests m where m.kind = 'city_file' and m.ref_id = cities.id)
    limit p_limit
  loop
    v_req := net.http_get(url := public._commons_file_url(r.f), headers := public._wm_headers(), timeout_milliseconds := 15000);
    insert into public.media_requests (request_id, kind, ref_id) values (v_req, r.kind, r.id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- Read the answers that have come back and store them.
create or replace function public.process_media_responses()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  r record; j jsonb; v_img text; v_file text; v_lat double precision; v_lng double precision;
  v_info jsonb; v_meta jsonb; v_thumb text; v_done integer := 0; v_failed integer := 0; v_cand public.landmark_candidates;
begin
  for r in
    select m.request_id, m.kind, m.ref_id, h.status_code, h.content, h.error_msg
    from public.media_requests m join net._http_response h on h.id = m.request_id
  loop
    begin
      if r.status_code is distinct from 200 then raise exception 'HTTP % %', r.status_code, coalesce(r.error_msg, ''); end if;
      j := r.content::jsonb;

      if r.kind in ('landmark', 'city', 'candidate') then
        if j->>'type' = 'disambiguation' then raise exception 'Disambiguation page'; end if;
        v_img := coalesce(j#>>'{originalimage,source}', j#>>'{thumbnail,source}');
        -- Only Commons images are free to reuse; skip anything hosted locally on Wikipedia.
        v_file := case when v_img ~ '^https://(upload|thumb)\.wikimedia\.org/wikipedia/commons/'
          then public._url_decode(regexp_replace(v_img, '^.*/commons/(thumb/)?[0-9a-f]/[0-9a-f]{2}/([^/?]+).*$', '\2')) end;
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
            -- Use Wikipedia's coordinates when ours are 150 m to 2 km out (further means the wrong article).
            lat = case when v_lat is not null and public.distance_m(lat, lng, v_lat, v_lng) between 150 and 2000 then v_lat else lat end,
            lng = case when v_lat is not null and public.distance_m(lat, lng, v_lat, v_lng) between 150 and 2000 then v_lng else lng end,
            location_verified = location_verified or (v_lat is not null and public.distance_m(lat, lng, v_lat, v_lng) <= 2000)
          where id = r.ref_id;
        else
          select * into v_cand from public.landmark_candidates where id = r.ref_id;
          if v_lat is null then raise exception 'No coordinates on Wikipedia'; end if;
          -- Sanity check: within 40 km of the city.
          if (select public.distance_m(c.lat, c.lng, v_lat, v_lng) from public.cities c where c.id = v_cand.city_id) > 40000 then
            raise exception 'Coordinates are too far from the city';
          end if;
          insert into public.landmarks (city_id, name, description, lat, lng, radius_m, rarity, is_major, skills,
              wikidata_id, location_verified, wiki_title, summary, wiki_url, photo_file, media_checked_at)
          values (v_cand.city_id, v_cand.name, j->>'description', v_lat, v_lng, v_cand.radius_m, v_cand.rarity, v_cand.is_major,
              v_cand.skills, j->>'wikibase_item', true, v_cand.wiki_title, j->>'extract',
              j#>>'{content_urls,desktop,page}', v_file, now())
          on conflict (city_id, name) do nothing;
          update public.landmark_candidates set status = 'added', note = null where id = v_cand.id;
        end if;

      else -- Commons file info
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
      if r.kind = 'candidate' then update public.landmark_candidates set status = 'failed', note = sqlerrm where id = r.ref_id;
      elsif r.kind = 'landmark' then update public.landmarks set media_checked_at = now() where id = r.ref_id;
      elsif r.kind = 'city' then update public.cities set media_checked_at = now() where id = r.ref_id;
      elsif r.kind = 'landmark_file' then update public.landmarks set photo_file = null where id = r.ref_id;
      else update public.cities set photo_file = null where id = r.ref_id; end if;
    end;
    delete from public.media_requests where request_id = r.request_id;
  end loop;
  return jsonb_build_object('stored', v_done, 'failed', v_failed,
    'waiting', (select count(*) from public.media_requests));
end;
$$;

revoke execute on function public._wm_headers(), public._wiki_summary_url(text), public._commons_file_url(text),
  public._strip_html(text), public._url_decode(text), public.queue_media_fetch(integer), public.process_media_responses()
  from public, anon, authenticated;

-- Keep new content flowing in: every 10 minutes, collect answers and send new requests.
select cron.schedule('landmark-media', '*/10 * * * *', $$select public.process_media_responses(); select public.queue_media_fetch(200);$$);
