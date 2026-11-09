-- Second, wider scan for cities that came back with fewer than 6 landmarks (small towns,
-- beach resorts, nature spots): twice the radius, fewer Wikipedia languages needed,
-- photo optional, and any place type that isn't on the block list. Plus hand-picked icons
-- the automatic finder couldn't reach.

alter table public.cities add column scan_pass smallint not null default 1;

create or replace function public._is_blocked(p_types text)
returns boolean language sql immutable set search_path = '' as $$
  with t as (select lower(x) as ty from unnest(string_to_array(coalesce(p_types, ''), '|')) x)
  select exists (select 1 from t where
       ty ~ '^((big|large|small|medium-sized) )?(city|town|village|capital|capital city|human settlement|urban area|metropolitan area|suburb|locality|quarter|neighbou?rhood)$'
    or ty ~ '^(former )?(municipality|freguesia|commune|district|borough|parish|civil parish|county|province|region|city district|urban municipality|statutory city|county seat|cadastral|administrative)'
    or ty ~ '(battle|siege|massacre|^war$|match|final|tournament|season|festival|company|publisher|periodical|newspaper|magazine|sports club|football club|sports team|league|governing body|university|school|college|hospital|metro|tram system|light rail|transport network|rapid transit|railway line|^(road|street|avenue|highway|motorway|boulevard)$|^river|main stem|^sea$|strait|gulf|^bay$|^lake$|reservoir|^canal$|^island$|memorial|cemetery|grave|concentration camp|extermination|genocide|embassy|consulate|ministry|government agency|diocese|electoral|constituency|defunct|demolished|destroyed|airport|ship|car park|industrial park|business park|office park|market town)');
$$;

create or replace function public._is_sight(p_types text)
returns boolean language sql immutable set search_path = '' as $$
  with t as (select lower(x) as ty from unnest(string_to_array(coalesce(p_types, ''), '|')) x)
  select exists (select 1 from t where ty ~ '(church|cathedral|basilica|chapel|mosque|synagogue|temple|monastery|abbey|convent|shrine|museum|gallery|palace|castle|fortress|^fort|citadel|tower|bridge|square|plaza|park|garden|theat(re|er)|opera|concert hall|library|bookshop|bookstore|monument|statue|fountain|archaeological|ruins|amphithea|stadium|market|tourist attraction|gate|city wall|defensive wall|lighthouse|viewpoint|mountain|hill|cave|waterfall|beach|zoo|aquarium|botanical|heritage|landmark|café|observatory|windmill|manor|villa|mansion|town hall|city hall|parliament|legislative building|royal residence|mausoleum|ferris wheel|castle|old town|historic (centre|center|district))')
     and not public._is_blocked(p_types);
$$;

-- Wider second pass: anything not blocked, minus everyday buildings and businesses.
create or replace function public._is_sight_relaxed(p_types text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p_types, '') <> '' and not public._is_blocked(p_types)
     and lower(p_types) !~ '(hotel|resort|hostel|casino|shopping|mall|retail|office|residential|apartment|condominium|housing|bank|enterprise|business|organi[sz]ation|nonprofit|club|restaurant|bar$|television|radio|broadcast|transmitter|power station|power plant|substation|factory|warehouse|prison|police|fire station|military|barracks|bus station|bus stop|railway station|train station|port$|harbou?r$|marina|ferry|road|street|bridge over|dam$|weir|pumping|water tower|sewage|landfill|golf|sports venue|stadium|arena|gym|swimming pool|school|kindergarten|hospital|clinic|pharmacy|cinema|nightclub|census|election|hurricane|earthquake|flood|fire$)';
$$;

create or replace function public._city_scan_url(p_lat double precision, p_lng double precision, p_radius numeric, p_relaxed boolean default false)
returns text language sql immutable set search_path = '' as $$
  select 'https://query.wikidata.org/sparql?format=json&query=' || public._url_encode(format($q$
SELECT ?item ?itemLabel ?sitelinks ?article (GROUP_CONCAT(DISTINCT ?tl; separator="|") AS ?types) WHERE {
  SERVICE wikibase:around { ?item wdt:P625 ?loc . bd:serviceParam wikibase:center "Point(%s %s)"^^geo:wktLiteral . bd:serviceParam wikibase:radius "%s" . }
  ?item wikibase:sitelinks ?sitelinks . FILTER(?sitelinks >= %s)
  %s
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
  OPTIONAL { ?item wdt:P31 ?t . ?t rdfs:label ?tl . FILTER(LANG(?tl) = "en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} GROUP BY ?item ?itemLabel ?sitelinks ?article ORDER BY DESC(?sitelinks) LIMIT 150
$q$, p_lng, p_lat, p_radius, case when p_relaxed then 2 else 4 end, case when p_relaxed then '' else '?item wdt:P18 ?img .' end));
$$;

create or replace function public.queue_city_scans(p_limit integer default 4)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare r record; v_req bigint; v_n integer := 0;
begin
  for r in select id, lat, lng, scan_radius_km, scan_pass from public.cities
           where scan_status = 'pending' and media_checked_at is not null order by id limit p_limit loop
    v_req := net.http_get(
      url := public._city_scan_url(r.lat, r.lng,
        case when r.scan_pass >= 2 then least(r.scan_radius_km * 2, 30) else r.scan_radius_km end, r.scan_pass >= 2),
      headers := public._wm_headers() || '{"Accept":"application/sparql-results+json"}'::jsonb, timeout_milliseconds := 60000);
    insert into public.media_requests (request_id, kind, ref_id) values (v_req, 'city_scan', r.id);
    update public.cities set scan_status = 'requested' where id = r.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- Pass 2 tops a city up to 12, carrying on the rarity ranking from what it already has.
create or replace function public._apply_city_scan(p_city_id bigint, p_json jsonb)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare r record; v_pass smallint; v_have integer; v_rank integer; v_added integer := 0;
  v_stadiums integer := 0; v_bridges integer := 0; v_stations integer := 0;
  v_rarity text; v_skills text[]; v_radius integer; v_title text;
begin
  select scan_pass into v_pass from public.cities where id = p_city_id;
  select count(*) into v_have from (
    select id from public.landmarks where city_id = p_city_id
    union all select id from public.landmark_candidates where city_id = p_city_id and status in ('new', 'requested')) x;
  v_rank := case when v_pass >= 2 then v_have else 0 end;
  for r in
    select b->'itemLabel'->>'value' as name,
           regexp_replace(b->'item'->>'value', '^.*/', '') as qid,
           (b->'sitelinks'->>'value')::int as sl,
           lower(coalesce(b->'types'->>'value', '')) as types,
           b->'article'->>'value' as article
    from jsonb_array_elements(p_json->'results'->'bindings') b
    where case when v_pass >= 2 then public._is_sight_relaxed(b->'types'->>'value') else public._is_sight(b->'types'->>'value') end
    order by (b->'sitelinks'->>'value')::numeric
             * case when lower(coalesce(b->'types'->>'value', '')) ~ '(stadium|arena|sports venue)' then 0.5 else 1 end
             * case when lower(coalesce(b->'types'->>'value', '')) ~ 'bridge' then 0.8 else 1 end
             * case when lower(coalesce(b->'types'->>'value', '')) ~ '(railway station|train station)' then 0.5 else 1 end desc
  loop
    exit when v_rank >= 12;
    continue when r.name ~ '^Q[0-9]+$';
    continue when exists (select 1 from public.landmarks where wikidata_id = r.qid);
    continue when exists (select 1 from public.landmark_candidates where qid = r.qid or (city_id = p_city_id and name = r.name));
    continue when exists (select 1 from public.landmarks where city_id = p_city_id and name = r.name);
    if r.types ~ '(stadium|arena|sports venue)' then v_stadiums := v_stadiums + 1; continue when v_stadiums > 1; end if;
    if r.types ~ 'bridge' then v_bridges := v_bridges + 1; continue when v_bridges > 2; end if;
    if r.types ~ '(railway station|train station)' then v_stations := v_stations + 1; continue when v_stations > 1; end if;
    v_rank := v_rank + 1;
    v_added := v_added + 1;
    v_rarity := case
      when v_rank = 1 then case when r.sl >= 80 then 'legendary' else 'epic' end
      when v_rank <= 3 then case when r.sl >= 60 then 'epic' else 'rare' end
      when v_rank <= 6 then case when r.sl >= 25 then 'rare' else 'uncommon' end
      when v_rank <= 9 then 'uncommon' else 'common' end;
    if r.types ~ '(stadium|arena|sports venue)' and v_rarity in ('legendary', 'epic') then v_rarity := 'rare'; end if;
    v_skills := array['explorer']
      || case when r.types ~ '(church|cathedral|basilica|chapel|mosque|synagogue|temple|monastery|abbey|convent|shrine)' then array['pilgrim'] else array[]::text[] end
      || case when r.types ~ '(museum|gallery|palace|castle|fortress|citadel|theat|opera|concert|library|monument|archaeolog|ruins|amphithea|heritage|town hall|city hall|parliament|mausoleum)' then array['culture'] else array[]::text[] end
      || case when r.types ~ '(park|garden|mountain|hill|cave|waterfall|beach|zoo|aquarium|botanical|viewpoint|nature|reef|lagoon|volcano|forest|reserve|canyon|gorge|cenote|island)' then array['nature'] else array[]::text[] end
      || case when r.types ~ '(market|café|brewery|food|winery|vineyard)' then array['foodie'] else array[]::text[] end;
    v_radius := case when r.types ~ '(park|garden|castle|fortress|citadel|palace|archaeolog|square|plaza|hill|mountain|zoo|stadium|beach|monastery|old town|historic|reserve|forest|lagoon|volcano|canyon|cenote)' then 250 else 120 end;
    v_title := replace(public._url_decode(regexp_replace(r.article, '^https://en\.wikipedia\.org/wiki/', '')), '_', ' ');
    insert into public.landmark_candidates (city_id, name, wiki_title, rarity, skills, radius_m, is_major, qid, sitelinks)
    values (p_city_id, left(r.name, 80), v_title, v_rarity::public.rarity, v_skills::public.skill[], v_radius, v_rank <= 10, r.qid, r.sl)
    on conflict (city_id, name) do nothing;
  end loop;
  update public.cities set scan_status = 'done',
    scan_note = case when v_pass >= 2 then coalesce(scan_note, '') || '; pass 2: +' || v_added else v_added || ' candidates' end
  where id = p_city_id;
  return v_added;
end;
$$;

revoke execute on function public._is_blocked(text), public._is_sight(text), public._is_sight_relaxed(text),
  public._city_scan_url(double precision, double precision, numeric, boolean),
  public.queue_city_scans(integer), public._apply_city_scan(bigint, jsonb)
  from public, anon, authenticated;
drop function if exists public._city_scan_url(double precision, double precision, numeric);

-- Hand-picked icons the finder couldn't reach (too far from the centre, or filtered out).
insert into public.landmark_candidates (city_id, name, wiki_title, rarity, skills, radius_m, is_major)
select c.id, v.name, v.t, v.r::public.rarity, v.s::public.skill[], v.rad, true
from (values
  ('San Francisco', 'US', 'Golden Gate Bridge', 'Golden Gate Bridge', 'legendary', '{explorer,culture}', 300),
  ('Bangkok', 'TH', 'Grand Palace', 'Grand Palace', 'legendary', '{explorer,culture,pilgrim}', 250),
  ('Hiroshima', 'JP', 'Itsukushima Shrine', 'Itsukushima Shrine', 'legendary', '{explorer,pilgrim,culture}', 200),
  ('Hiroshima', 'JP', 'Hiroshima Castle', 'Hiroshima Castle', 'rare', '{explorer,culture}', 200),
  ('Nikkō', 'JP', 'Nikkō Tōshō-gū', 'Nikkō Tōshō-gū', 'legendary', '{explorer,pilgrim,culture}', 250),
  ('Nikkō', 'JP', 'Shinkyō', 'Shinkyō', 'rare', '{explorer,culture}', 80),
  ('Nikkō', 'JP', 'Rinnō-ji', 'Rinnō-ji', 'rare', '{explorer,pilgrim}', 150),
  ('Nikkō', 'JP', 'Futarasan Shrine', 'Futarasan Shrine', 'uncommon', '{explorer,pilgrim}', 150),
  ('Nikkō', 'JP', 'Kegon Falls', 'Kegon Falls', 'epic', '{explorer,nature}', 250),
  ('Nikkō', 'JP', 'Lake Chūzenji', 'Lake Chūzenji', 'uncommon', '{explorer,nature}', 400),
  ('Dambulla', 'LK', 'Sigiriya', 'Sigiriya', 'legendary', '{explorer,culture,nature}', 300),
  ('Dambulla', 'LK', 'Dambulla Cave Temple', 'Dambulla cave temple', 'epic', '{explorer,pilgrim,culture}', 200),
  ('Xi''an', 'CN', 'Terracotta Army', 'Terracotta Army', 'legendary', '{explorer,culture}', 300),
  ('Puerto Ayora', 'EC', 'Charles Darwin Research Station', 'Charles Darwin Research Station', 'epic', '{explorer,nature}', 250),
  ('Monteverde', 'CR', 'Monteverde Cloud Forest Reserve', 'Monteverde Cloud Forest Reserve', 'legendary', '{explorer,nature}', 400),
  ('Bled', 'SI', 'Bled Castle', 'Bled Castle', 'epic', '{explorer,culture}', 200),
  ('Bled', 'SI', 'Bled Island', 'Bled Island', 'epic', '{explorer,pilgrim,nature}', 200),
  ('Bled', 'SI', 'Lake Bled', 'Lake Bled', 'rare', '{explorer,nature}', 400),
  ('Bled', 'SI', 'Vintgar Gorge', 'Vintgar Gorge', 'rare', '{explorer,nature}', 300)
) as v(city, cc, name, t, r, s, rad)
join public.cities c on c.name = v.city and c.country_code = v.cc
on conflict (city_id, name) do nothing;

-- Salar de Uyuni: its Wikipedia point is the middle of the salt flat, too far for the usual
-- check, so it goes in at the flat's edge by Colchani, where visitors drive on.
insert into public.landmarks (city_id, name, lat, lng, radius_m, rarity, is_major, skills, location_verified, wiki_title)
select c.id, 'Salar de Uyuni', -20.3010, -67.0450, 1500, 'legendary', true, '{explorer,nature}', true, 'Salar de Uyuni'
from public.cities c where c.name = 'Uyuni' and c.country_code = 'BO'
on conflict (city_id, name) do nothing;

-- Run the wider pass for every scanned city that still has fewer than 6 landmarks.
update public.cities c set scan_pass = 2, scan_status = 'pending'
where c.scan_status = 'done'
  and (select count(*) from public.landmarks l where l.city_id = c.id)
    + (select count(*) from public.landmark_candidates lc where lc.city_id = c.id and lc.status in ('new', 'requested')) < 6;
