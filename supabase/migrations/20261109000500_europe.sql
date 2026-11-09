-- Complete Europe: every safe European country, at least 4 cities in larger ones.
-- New cities are scanned automatically (city_scan) and get their top 12 sights from Wikidata.

-- Scan tuning after the Porto test: keep road bridges, allow bookshops, and treat
-- railway stations like stadiums (half weight, at most one per city).
create or replace function public._is_sight(p_types text)
returns boolean language sql immutable set search_path = '' as $$
  with t as (select lower(x) as ty from unnest(string_to_array(coalesce(p_types, ''), '|')) x)
  select exists (select 1 from t where ty ~ '(church|cathedral|basilica|chapel|mosque|synagogue|temple|monastery|abbey|convent|shrine|museum|gallery|palace|castle|fortress|^fort|citadel|tower|bridge|square|plaza|park|garden|theat(re|er)|opera|concert hall|library|bookshop|bookstore|monument|statue|fountain|archaeological|ruins|amphithea|stadium|market|tourist attraction|gate|city wall|defensive wall|lighthouse|viewpoint|mountain|hill|cave|waterfall|beach|zoo|aquarium|botanical|heritage|landmark|café|observatory|windmill|manor|villa|mansion|town hall|city hall|parliament|legislative building|royal residence|mausoleum|ferris wheel|castle|old town|historic (centre|center|district))')
     and not exists (select 1 from t where
           ty ~ '^((big|large|small|medium-sized) )?(city|town|village|capital|capital city|human settlement|urban area|metropolitan area|suburb|locality|quarter|neighbou?rhood)$'
        or ty ~ '^(former )?(municipality|freguesia|commune|district|borough|parish|civil parish|county|province|region|city district|urban municipality|statutory city|county seat|cadastral|administrative)'
        or ty ~ '(battle|siege|massacre|^war$|match|final|tournament|season|festival|company|publisher|periodical|newspaper|magazine|sports club|football club|sports team|league|governing body|university|school|college|hospital|metro|tram system|light rail|transport network|rapid transit|railway line|^(road|street|avenue|highway|motorway|boulevard)$|^river|main stem|^sea$|strait|gulf|^bay$|^lake$|reservoir|^canal$|^island$|memorial|cemetery|grave|concentration camp|extermination|genocide|embassy|consulate|ministry|government agency|diocese|electoral|constituency|defunct|demolished|destroyed|airport|ship|car park|industrial park|business park|office park|market town)');
$$;

create or replace function public._apply_city_scan(p_city_id bigint, p_json jsonb)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare r record; v_rank integer := 0; v_stadiums integer := 0; v_bridges integer := 0; v_stations integer := 0; v_rarity text; v_skills text[]; v_radius integer; v_title text;
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
             * case when lower(coalesce(b->'types'->>'value', '')) ~ 'bridge' then 0.8 else 1 end
             * case when lower(coalesce(b->'types'->>'value', '')) ~ '(railway station|train station)' then 0.5 else 1 end desc
  loop
    exit when v_rank >= 12;
    continue when r.name ~ '^Q[0-9]+$';                                   -- no English label
    continue when exists (select 1 from public.landmarks where wikidata_id = r.qid);
    continue when exists (select 1 from public.landmark_candidates where qid = r.qid or (city_id = p_city_id and name = r.name));
    if r.types ~ '(stadium|arena|sports venue)' then v_stadiums := v_stadiums + 1; continue when v_stadiums > 1; end if;
    if r.types ~ 'bridge' then v_bridges := v_bridges + 1; continue when v_bridges > 2; end if;
    if r.types ~ '(railway station|train station)' then v_stations := v_stations + 1; continue when v_stations > 1; end if;
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

revoke execute on function public._is_sight(text), public._apply_city_scan(bigint, jsonb) from public, anon, authenticated;

insert into public.countries (code, name, continent_code) values
  ('NO', 'Norway', 'EU'),
  ('SE', 'Sweden', 'EU'),
  ('FI', 'Finland', 'EU'),
  ('IS', 'Iceland', 'EU'),
  ('EE', 'Estonia', 'EU'),
  ('LV', 'Latvia', 'EU'),
  ('LT', 'Lithuania', 'EU'),
  ('SK', 'Slovakia', 'EU'),
  ('SI', 'Slovenia', 'EU'),
  ('RO', 'Romania', 'EU'),
  ('BG', 'Bulgaria', 'EU'),
  ('RS', 'Serbia', 'EU'),
  ('BA', 'Bosnia and Herzegovina', 'EU'),
  ('ME', 'Montenegro', 'EU'),
  ('AL', 'Albania', 'EU'),
  ('MK', 'North Macedonia', 'EU'),
  ('XK', 'Kosovo', 'EU'),
  ('MD', 'Moldova', 'EU'),
  ('LU', 'Luxembourg', 'EU'),
  ('MT', 'Malta', 'EU'),
  ('CY', 'Cyprus', 'EU'),
  ('MC', 'Monaco', 'EU'),
  ('SM', 'San Marino', 'EU'),
  ('VA', 'Vatican City', 'EU'),
  ('LI', 'Liechtenstein', 'EU'),
  ('AD', 'Andorra', 'EU')
on conflict (code) do nothing;

insert into public.cities (name, region, country_code, lat, lng, airport_code, wiki_title, scan_radius_km)
select v.name, v.region, v.cc, v.lat, v.lng, v.ap, v.wiki, v.rad from (values
  ('Oslo', 'Oslo', 'NO', 59.9139, 10.7522, 'OSL', 'Oslo', 6),
  ('Bergen', 'Vestland', 'NO', 60.3913, 5.3221, 'BGO', 'Bergen', 4),
  ('Tromsø', 'Troms', 'NO', 69.6492, 18.9553, 'TOS', 'Tromsø', 5),
  ('Stavanger', 'Rogaland', 'NO', 58.9700, 5.7331, 'SVG', 'Stavanger', 4),
  ('Stockholm', 'Stockholm County', 'SE', 59.3293, 18.0686, 'ARN', 'Stockholm', 6),
  ('Gothenburg', 'Västra Götaland', 'SE', 57.7089, 11.9746, 'GOT', 'Gothenburg', 5),
  ('Malmö', 'Skåne', 'SE', 55.6050, 13.0038, 'MMX', 'Malmö', 4),
  ('Uppsala', 'Uppsala County', 'SE', 59.8586, 17.6389, 'ARN', 'Uppsala', 4),
  ('Helsinki', 'Uusimaa', 'FI', 60.1699, 24.9384, 'HEL', 'Helsinki', 6),
  ('Turku', 'Southwest Finland', 'FI', 60.4518, 22.2666, 'TKU', 'Turku', 4),
  ('Rovaniemi', 'Lapland', 'FI', 66.5039, 25.7294, 'RVN', 'Rovaniemi', 8),
  ('Tampere', 'Pirkanmaa', 'FI', 61.4978, 23.7610, 'TMP', 'Tampere', 4),
  ('Reykjavík', 'Capital Region', 'IS', 64.1466, -21.9426, 'KEF', 'Reykjavík', 6),
  ('Akureyri', 'Northeast', 'IS', 65.6885, -18.1262, 'AEY', 'Akureyri', 5),
  ('Tallinn', 'Harju County', 'EE', 59.4370, 24.7536, 'TLL', 'Tallinn', 5),
  ('Tartu', 'Tartu County', 'EE', 58.3780, 26.7290, 'TAY', 'Tartu', 4),
  ('Pärnu', 'Pärnu County', 'EE', 58.3859, 24.4971, 'TLL', 'Pärnu', 4),
  ('Riga', 'Riga', 'LV', 56.9496, 24.1052, 'RIX', 'Riga', 5),
  ('Jūrmala', 'Riga Region', 'LV', 56.9680, 23.7704, 'RIX', 'Jūrmala', 6),
  ('Sigulda', 'Vidzeme', 'LV', 57.1537, 24.8538, 'RIX', 'Sigulda', 4),
  ('Vilnius', 'Vilnius County', 'LT', 54.6872, 25.2797, 'VNO', 'Vilnius', 5),
  ('Kaunas', 'Kaunas County', 'LT', 54.8985, 23.9036, 'KUN', 'Kaunas', 5),
  ('Klaipėda', 'Klaipėda County', 'LT', 55.7033, 21.1443, 'PLQ', 'Klaipėda', 5),
  ('Trakai', 'Vilnius County', 'LT', 54.6379, 24.9346, 'VNO', 'Trakai', 3),
  ('Bratislava', 'Bratislava Region', 'SK', 48.1486, 17.1077, 'BTS', 'Bratislava', 5),
  ('Košice', 'Košice Region', 'SK', 48.7164, 21.2611, 'KSC', 'Košice', 4),
  ('Banská Bystrica', 'Banská Bystrica Region', 'SK', 48.7363, 19.1462, 'BTS', 'Banská Bystrica', 4),
  ('Ljubljana', 'Central Slovenia', 'SI', 46.0569, 14.5058, 'LJU', 'Ljubljana', 5),
  ('Bled', 'Upper Carniola', 'SI', 46.3683, 14.1146, 'LJU', 'Bled', 3),
  ('Piran', 'Slovenian Istria', 'SI', 45.5285, 13.5683, 'TRS', 'Piran', 3),
  ('Maribor', 'Drava', 'SI', 46.5547, 15.6459, 'MBX', 'Maribor', 4),
  ('Bucharest', 'Bucharest', 'RO', 44.4268, 26.1025, 'OTP', 'Bucharest', 6),
  ('Brașov', 'Brașov County', 'RO', 45.6427, 25.5887, 'GHV', 'Brașov', 5),
  ('Cluj-Napoca', 'Cluj County', 'RO', 46.7712, 23.6236, 'CLJ', 'Cluj-Napoca', 4),
  ('Sibiu', 'Sibiu County', 'RO', 45.7983, 24.1256, 'SBZ', 'Sibiu', 4),
  ('Sofia', 'Sofia City', 'BG', 42.6977, 23.3219, 'SOF', 'Sofia', 6),
  ('Plovdiv', 'Plovdiv Province', 'BG', 42.1354, 24.7453, 'PDV', 'Plovdiv', 4),
  ('Varna', 'Varna Province', 'BG', 43.2141, 27.9147, 'VAR', 'Varna', 5),
  ('Veliko Tarnovo', 'Veliko Tarnovo Province', 'BG', 43.0757, 25.6172, 'SOF', 'Veliko Tarnovo', 4),
  ('Belgrade', 'Belgrade', 'RS', 44.7866, 20.4489, 'BEG', 'Belgrade', 6),
  ('Novi Sad', 'Vojvodina', 'RS', 45.2671, 19.8335, 'BEG', 'Novi Sad', 5),
  ('Niš', 'Nišava District', 'RS', 43.3209, 21.8958, 'INI', 'Niš', 4),
  ('Sarajevo', 'Sarajevo Canton', 'BA', 43.8563, 18.4131, 'SJJ', 'Sarajevo', 5),
  ('Mostar', 'Herzegovina-Neretva', 'BA', 43.3438, 17.8078, 'OMO', 'Mostar', 4),
  ('Banja Luka', 'Republika Srpska', 'BA', 44.7722, 17.1910, 'BNX', 'Banja Luka', 4),
  ('Kotor', 'Bay of Kotor', 'ME', 42.4247, 18.7712, 'TIV', 'Kotor', 4),
  ('Budva', 'Coastal Region', 'ME', 42.2911, 18.8403, 'TIV', 'Budva', 4),
  ('Podgorica', 'Central Region', 'ME', 42.4304, 19.2594, 'TGD', 'Podgorica', 5),
  ('Tirana', 'Tirana County', 'AL', 41.3275, 19.8187, 'TIA', 'Tirana', 5),
  ('Berat', 'Berat County', 'AL', 40.7058, 19.9522, 'TIA', 'Berat', 3),
  ('Gjirokastër', 'Gjirokastër County', 'AL', 40.0758, 20.1389, 'TIA', 'Gjirokastër', 3),
  ('Shkodër', 'Shkodër County', 'AL', 42.0683, 19.5126, 'TIA', 'Shkodër', 4),
  ('Skopje', 'Skopje Region', 'MK', 41.9981, 21.4254, 'SKP', 'Skopje', 5),
  ('Ohrid', 'Southwestern Region', 'MK', 41.1172, 20.8016, 'OHD', 'Ohrid', 4),
  ('Bitola', 'Pelagonia', 'MK', 41.0297, 21.3292, 'SKP', 'Bitola', 4),
  ('Pristina', 'Pristina District', 'XK', 42.6629, 21.1655, 'PRN', 'Pristina', 5),
  ('Prizren', 'Prizren District', 'XK', 42.2139, 20.7397, 'PRN', 'Prizren', 4),
  ('Chișinău', 'Chișinău', 'MD', 47.0105, 28.8638, 'KIV', 'Chișinău', 6),
  ('Luxembourg City', 'Luxembourg', 'LU', 49.6116, 6.1319, 'LUX', 'Luxembourg City', 5),
  ('Valletta', 'South Eastern', 'MT', 35.8989, 14.5146, 'MLA', 'Valletta', 3),
  ('Mdina', 'Northern', 'MT', 35.8858, 14.4031, 'MLA', 'Mdina', 1.5),
  ('Victoria', 'Gozo', 'MT', 36.0443, 14.2512, 'MLA', 'Victoria, Gozo', 4),
  ('Nicosia', 'Nicosia District', 'CY', 35.1856, 33.3823, 'LCA', 'Nicosia', 4),
  ('Limassol', 'Limassol District', 'CY', 34.7071, 33.0226, 'PFO', 'Limassol', 6),
  ('Paphos', 'Paphos District', 'CY', 34.7720, 32.4297, 'PFO', 'Paphos', 6),
  ('Larnaca', 'Larnaca District', 'CY', 34.9003, 33.6232, 'LCA', 'Larnaca', 5),
  ('Monaco', 'Monaco', 'MC', 43.7384, 7.4246, 'NCE', 'Monaco', 1.6),
  ('San Marino', 'San Marino', 'SM', 43.9356, 12.4473, 'RMI', 'San Marino', 3),
  ('Vatican City', 'Vatican City', 'VA', 41.9029, 12.4534, 'FCO', 'Vatican City', 0.6),
  ('Vaduz', 'Oberland', 'LI', 47.1410, 9.5209, 'ZRH', 'Vaduz', 4),
  ('Andorra la Vella', 'Andorra la Vella', 'AD', 42.5063, 1.5218, 'BCN', 'Andorra la Vella', 4),
  ('Nice', 'Provence-Alpes-Côte d''Azur', 'FR', 43.7102, 7.2620, 'NCE', 'Nice', 5),
  ('Lyon', 'Auvergne-Rhône-Alpes', 'FR', 45.7640, 4.8357, 'LYS', 'Lyon', 5),
  ('Marseille', 'Provence-Alpes-Côte d''Azur', 'FR', 43.2965, 5.3698, 'MRS', 'Marseille', 6),
  ('Strasbourg', 'Grand Est', 'FR', 48.5734, 7.7521, 'SXB', 'Strasbourg', 4),
  ('Seville', 'Andalusia', 'ES', 37.3891, -5.9845, 'SVQ', 'Seville', 5),
  ('Granada', 'Andalusia', 'ES', 37.1773, -3.5986, 'GRX', 'Granada', 4),
  ('Valencia', 'Valencian Community', 'ES', 39.4699, -0.3763, 'VLC', 'Valencia', 6),
  ('Florence', 'Tuscany', 'IT', 43.7696, 11.2558, 'FLR', 'Florence', 4),
  ('Venice', 'Veneto', 'IT', 45.4408, 12.3155, 'VCE', 'Venice', 4),
  ('Milan', 'Lombardy', 'IT', 45.4642, 9.1900, 'MIL', 'Milan', 5),
  ('Naples', 'Campania', 'IT', 40.8518, 14.2681, 'NAP', 'Naples', 5),
  ('Munich', 'Bavaria', 'DE', 48.1351, 11.5820, 'MUC', 'Munich', 6),
  ('Hamburg', 'Hamburg', 'DE', 53.5511, 9.9937, 'HAM', 'Hamburg', 6),
  ('Cologne', 'North Rhine-Westphalia', 'DE', 50.9375, 6.9603, 'CGN', 'Cologne', 5),
  ('Rotterdam', 'South Holland', 'NL', 51.9244, 4.4777, 'RTM', 'Rotterdam', 5),
  ('Utrecht', 'Utrecht', 'NL', 52.0907, 5.1214, 'AMS', 'Utrecht', 4),
  ('The Hague', 'South Holland', 'NL', 52.0705, 4.3007, 'RTM', 'The Hague', 5),
  ('Galway', 'Connacht', 'IE', 53.2707, -9.0568, 'SNN', 'Galway', 4),
  ('Cork', 'Munster', 'IE', 51.8985, -8.4756, 'ORK', 'Cork (city)', 5),
  ('Kilkenny', 'Leinster', 'IE', 52.6541, -7.2448, 'DUB', 'Kilkenny', 3),
  ('Bruges', 'West Flanders', 'BE', 51.2093, 3.2247, 'BRU', 'Bruges', 4),
  ('Ghent', 'East Flanders', 'BE', 51.0543, 3.7174, 'BRU', 'Ghent', 4),
  ('Antwerp', 'Antwerp', 'BE', 51.2194, 4.4025, 'ANR', 'Antwerp', 5),
  ('Porto', 'Norte', 'PT', 41.1496, -8.6110, 'OPO', 'Porto', 4),
  ('Sintra', 'Lisbon District', 'PT', 38.7980, -9.3880, 'LIS', 'Sintra', 4),
  ('Évora', 'Alentejo', 'PT', 38.5714, -7.9135, 'LIS', 'Évora', 3),
  ('Český Krumlov', 'South Bohemia', 'CZ', 48.8127, 14.3175, 'PRG', 'Český Krumlov', 3),
  ('Brno', 'South Moravia', 'CZ', 49.1951, 16.6068, 'BRQ', 'Brno', 5),
  ('Karlovy Vary', 'Karlovy Vary Region', 'CZ', 50.2310, 12.8710, 'KLV', 'Karlovy Vary', 4),
  ('Salzburg', 'Salzburg', 'AT', 47.8095, 13.0550, 'SZG', 'Salzburg', 4),
  ('Innsbruck', 'Tyrol', 'AT', 47.2692, 11.4041, 'INN', 'Innsbruck', 5),
  ('Hallstatt', 'Upper Austria', 'AT', 47.5622, 13.6493, 'SZG', 'Hallstatt', 3),
  ('Aarhus', 'Central Denmark', 'DK', 56.1629, 10.2039, 'AAR', 'Aarhus', 5),
  ('Odense', 'Southern Denmark', 'DK', 55.4038, 10.4024, 'CPH', 'Odense', 4),
  ('Helsingør', 'Capital Region', 'DK', 56.0361, 12.6136, 'CPH', 'Helsingør', 4),
  ('Thessaloniki', 'Central Macedonia', 'GR', 40.6401, 22.9444, 'SKG', 'Thessaloniki', 5),
  ('Santorini', 'South Aegean', 'GR', 36.4167, 25.4317, 'JTR', 'Santorini', 9),
  ('Rhodes', 'South Aegean', 'GR', 36.4341, 28.2176, 'RHO', 'Rhodes (city)', 4),
  ('Antalya', 'Antalya Province', 'TR', 36.8969, 30.7133, 'AYT', 'Antalya', 6),
  ('Göreme', 'Nevşehir Province', 'TR', 38.6431, 34.8289, 'NAV', 'Göreme', 6),
  ('Selçuk', 'İzmir Province', 'TR', 37.9511, 27.3689, 'ADB', 'Selçuk', 5),
  ('Zagreb', 'City of Zagreb', 'HR', 45.8150, 15.9819, 'ZAG', 'Zagreb', 5),
  ('Zadar', 'Zadar County', 'HR', 44.1194, 15.2314, 'ZAD', 'Zadar', 4),
  ('Pula', 'Istria County', 'HR', 44.8666, 13.8496, 'PUY', 'Pula', 4),
  ('Geneva', 'Canton of Geneva', 'CH', 46.2044, 6.1432, 'GVA', 'Geneva', 5),
  ('Bern', 'Canton of Bern', 'CH', 46.9480, 7.4474, 'BRN', 'Bern', 4),
  ('Interlaken', 'Canton of Bern', 'CH', 46.6863, 7.8632, 'BRN', 'Interlaken', 6),
  ('Eger', 'Heves', 'HU', 47.9025, 20.3772, 'BUD', 'Eger', 3),
  ('Pécs', 'Baranya', 'HU', 46.0727, 18.2323, 'BUD', 'Pécs', 4),
  ('Debrecen', 'Hajdú-Bihar', 'HU', 47.5316, 21.6273, 'DEB', 'Debrecen', 4),
  ('Warsaw', 'Masovia', 'PL', 52.2297, 21.0122, 'WAW', 'Warsaw', 6),
  ('Gdańsk', 'Pomerania', 'PL', 54.3520, 18.6466, 'GDN', 'Gdańsk', 5),
  ('Wrocław', 'Lower Silesia', 'PL', 51.1079, 17.0385, 'WRO', 'Wrocław', 5)
) as v(name, region, cc, lat, lng, ap, wiki, rad)
on conflict (name, country_code) do nothing;

-- Only the new cities get scanned; existing cities keep their hand-picked landmarks.
update public.cities set scan_status = 'pending' where scan_status is null and created_at = now();

-- St Peter's and the Vatican Museums belong to Vatican City, not Rome.
update public.landmarks set city_id = (select id from public.cities where name = 'Vatican City' and country_code = 'VA')
where wikidata_id in ('Q12512', 'Q182955');

-- Porto fix-ups from the test scan.
update public.landmark_candidates set status = 'failed', note = 'Transit station, not a sight'
where name = 'Campanhã railway station' and status = 'new';
insert into public.landmark_candidates (city_id, name, wiki_title, rarity, skills, radius_m, is_major)
select c.id, v.name, v.t, v.r::public.rarity, v.s::public.skill[], v.rad, true
from public.cities c, (values
  ('Dom Luís I Bridge', 'Dom Luís I Bridge', 'epic', '{explorer,culture}', 200),
  ('Livraria Lello', 'Livraria Lello', 'rare', '{explorer,culture}', 80)
) as v(name, t, r, s, rad)
where c.name = 'Porto' and c.country_code = 'PT'
on conflict (city_id, name) do nothing;

select cron.unschedule('landmark-media');
select cron.schedule('landmark-media', '*/10 * * * *',
  $$select public.process_media_responses(); select public._requeue_stuck_candidates(); select public.queue_city_scans(6); select public.queue_media_fetch(80);$$);
