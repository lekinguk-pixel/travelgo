-- Eight more popular countries: Greece, Turkey, Croatia, Switzerland, Hungary,
-- Poland, the United States and Japan. Landmarks go in as candidates and become
-- live once Wikipedia/Wikidata confirm their coordinates (landmark-media job).

insert into public.countries (code, name, continent_code) values
  ('GR', 'Greece', 'EU'), ('TR', 'Turkey', 'EU'), ('HR', 'Croatia', 'EU'),
  ('CH', 'Switzerland', 'EU'), ('HU', 'Hungary', 'EU'), ('PL', 'Poland', 'EU')
on conflict (code) do nothing;

insert into public.cities (name, region, country_code, lat, lng, airport_code, wiki_title) values
  ('Athens', 'Attica', 'GR', 37.9838, 23.7275, 'ATH', 'Athens'),
  ('Istanbul', 'Marmara', 'TR', 41.0082, 28.9784, 'IST', 'Istanbul'),
  ('Dubrovnik', 'Dubrovnik-Neretva', 'HR', 42.6507, 18.0944, 'DBV', 'Dubrovnik'),
  ('Split', 'Split-Dalmatia', 'HR', 43.5081, 16.4402, 'SPU', 'Split, Croatia'),
  ('Zurich', 'Canton of Zurich', 'CH', 47.3769, 8.5417, 'ZRH', 'Zurich'),
  ('Lucerne', 'Canton of Lucerne', 'CH', 47.0502, 8.3093, 'ZRH', 'Lucerne'),
  ('Budapest', 'Central Hungary', 'HU', 47.4979, 19.0402, 'BUD', 'Budapest'),
  ('Kraków', 'Lesser Poland', 'PL', 50.0647, 19.9450, 'KRK', 'Kraków'),
  ('New York', 'New York State', 'US', 40.7128, -74.0060, 'NYC', 'New York City'),
  ('Tokyo', 'Kantō', 'JP', 35.6762, 139.6503, 'TYO', 'Tokyo'),
  ('Kyoto', 'Kansai', 'JP', 35.0116, 135.7681, 'OSA', 'Kyoto')
on conflict (name, country_code) do nothing;

insert into public.landmark_candidates (city_id, name, wiki_title, rarity, skills, radius_m, is_major)
select c.id, v.name, v.t, v.rarity::public.rarity, ('{explorer' || case when v.sk = '' then '' else ',' || v.sk end || '}')::public.skill[], v.radius, v.major
from public.cities c join (values
  -- Athens
  ('Athens', 'Acropolis of Athens', 'Acropolis of Athens', 'legendary', 'culture', 250, true),
  ('Athens', 'Parthenon', 'Parthenon', 'epic', 'culture', 120, true),
  ('Athens', 'Acropolis Museum', 'Acropolis Museum', 'rare', 'culture', 120, true),
  ('Athens', 'Ancient Agora', 'Ancient Agora of Athens', 'rare', 'culture', 200, true),
  ('Athens', 'Temple of Olympian Zeus', 'Temple of Olympian Zeus, Athens', 'rare', 'culture,pilgrim', 150, true),
  ('Athens', 'Temple of Hephaestus', 'Temple of Hephaestus', 'rare', 'culture', 80, true),
  ('Athens', 'Odeon of Herodes Atticus', 'Odeon of Herodes Atticus', 'rare', 'culture', 80, true),
  ('Athens', 'Panathenaic Stadium', 'Panathenaic Stadium', 'uncommon', '', 150, true),
  ('Athens', 'National Archaeological Museum', 'National Archaeological Museum, Athens', 'uncommon', 'culture', 120, true),
  ('Athens', 'Mount Lycabettus', 'Mount Lycabettus', 'uncommon', 'nature', 300, true),
  ('Athens', 'Hadrian''s Library', 'Hadrian''s Library', 'uncommon', 'culture', 80, true),
  ('Athens', 'Philopappos Monument', 'Philopappos Monument', 'uncommon', 'nature', 200, true),
  ('Athens', 'Plaka', 'Plaka', 'common', 'foodie', 300, true),
  ('Athens', 'Monastiraki', 'Monastiraki', 'common', 'foodie', 200, true),
  ('Athens', 'Syntagma Square', 'Syntagma Square', 'common', '', 150, true),
  -- Istanbul
  ('Istanbul', 'Hagia Sophia', 'Hagia Sophia', 'legendary', 'pilgrim,culture', 120, true),
  ('Istanbul', 'Blue Mosque', 'Sultan Ahmed Mosque', 'epic', 'pilgrim', 120, true),
  ('Istanbul', 'Topkapı Palace', 'Topkapı Palace', 'epic', 'culture', 250, true),
  ('Istanbul', 'Basilica Cistern', 'Basilica Cistern', 'rare', 'culture', 60, true),
  ('Istanbul', 'Grand Bazaar', 'Grand Bazaar, Istanbul', 'rare', 'foodie', 250, true),
  ('Istanbul', 'Dolmabahçe Palace', 'Dolmabahçe Palace', 'rare', 'culture', 200, true),
  ('Istanbul', 'Süleymaniye Mosque', 'Süleymaniye Mosque', 'rare', 'pilgrim', 150, true),
  ('Istanbul', 'Galata Tower', 'Galata Tower', 'uncommon', '', 60, true),
  ('Istanbul', 'Spice Bazaar', 'Spice Bazaar', 'uncommon', 'foodie', 100, true),
  ('Istanbul', 'Chora Church', 'Chora Church', 'uncommon', 'culture,pilgrim', 80, true),
  ('Istanbul', 'Hippodrome', 'Hippodrome of Constantinople', 'uncommon', 'culture', 200, true),
  ('Istanbul', 'Taksim Square', 'Taksim Square', 'common', '', 150, true),
  ('Istanbul', 'İstiklal Avenue', 'İstiklal Avenue', 'common', 'foodie', 400, true),
  -- Dubrovnik
  ('Dubrovnik', 'Walls of Dubrovnik', 'Walls of Dubrovnik', 'legendary', '', 400, true),
  ('Dubrovnik', 'Fort Lovrijenac', 'Fort Lovrijenac', 'rare', 'culture', 100, true),
  ('Dubrovnik', 'Minčeta Tower', 'Minčeta Tower', 'rare', '', 60, true),
  ('Dubrovnik', 'Stradun', 'Stradun (street)', 'uncommon', '', 200, true),
  ('Dubrovnik', 'Rector''s Palace', 'Rector''s Palace, Dubrovnik', 'uncommon', 'culture', 60, true),
  ('Dubrovnik', 'Dubrovnik Cathedral', 'Dubrovnik Cathedral', 'uncommon', 'pilgrim', 60, true),
  ('Dubrovnik', 'Sponza Palace', 'Sponza Palace', 'uncommon', 'culture', 50, true),
  ('Dubrovnik', 'Church of St. Blaise', 'Church of St. Blaise, Dubrovnik', 'uncommon', 'pilgrim', 50, true),
  ('Dubrovnik', 'Mount Srđ', 'Srđ', 'uncommon', 'nature', 300, true),
  ('Dubrovnik', 'Lokrum', 'Lokrum', 'uncommon', 'nature', 500, false),
  -- Split
  ('Split', 'Diocletian''s Palace', 'Diocletian''s Palace', 'legendary', 'culture', 200, true),
  ('Split', 'Cathedral of Saint Domnius', 'Cathedral of Saint Domnius', 'epic', 'pilgrim', 80, true),
  ('Split', 'Marjan', 'Marjan (Split)', 'uncommon', 'nature', 500, true),
  ('Split', 'Bačvice', 'Bačvice', 'common', 'nature', 200, true),
  ('Split', 'Stadion Poljud', 'Stadion Poljud', 'uncommon', '', 200, true),
  ('Split', 'Archaeological Museum', 'Archaeological Museum, Split', 'common', 'culture', 80, true),
  ('Split', 'Klis Fortress', 'Klis Fortress', 'rare', 'culture', 150, false),
  -- Zurich
  ('Zurich', 'Grossmünster', 'Grossmünster', 'epic', 'pilgrim', 80, true),
  ('Zurich', 'Fraumünster', 'Fraumünster', 'rare', 'pilgrim', 60, true),
  ('Zurich', 'Swiss National Museum', 'Swiss National Museum', 'rare', 'culture', 120, true),
  ('Zurich', 'Lindenhof', 'Lindenhof (Zürich)', 'uncommon', 'nature', 80, true),
  ('Zurich', 'Kunsthaus Zürich', 'Kunsthaus Zürich', 'uncommon', 'culture', 100, true),
  ('Zurich', 'Uetliberg', 'Uetliberg', 'uncommon', 'nature', 400, true),
  ('Zurich', 'Zurich Opera House', 'Zurich Opera House', 'uncommon', 'culture', 80, true),
  ('Zurich', 'St. Peter''s Church', 'St. Peter, Zürich', 'uncommon', 'pilgrim', 60, true),
  ('Zurich', 'Bahnhofstrasse', 'Bahnhofstrasse', 'common', '', 400, true),
  ('Zurich', 'Zürich Hauptbahnhof', 'Zürich Hauptbahnhof', 'common', '', 150, true),
  ('Zurich', 'FIFA Museum', 'FIFA Museum', 'common', 'culture', 80, true),
  -- Lucerne
  ('Lucerne', 'Chapel Bridge', 'Chapel Bridge', 'legendary', '', 80, true),
  ('Lucerne', 'Lion Monument', 'Lion Monument', 'epic', 'culture', 60, true),
  ('Lucerne', 'Musegg Wall', 'Museggmauer', 'rare', '', 300, true),
  ('Lucerne', 'Swiss Museum of Transport', 'Swiss Museum of Transport', 'rare', 'culture', 200, true),
  ('Lucerne', 'Spreuer Bridge', 'Spreuer Bridge', 'uncommon', '', 60, true),
  ('Lucerne', 'Jesuit Church', 'Jesuit Church, Lucerne', 'uncommon', 'pilgrim', 60, true),
  ('Lucerne', 'Church of St. Leodegar', 'Church of St. Leodegar', 'uncommon', 'pilgrim', 80, true),
  ('Lucerne', 'Mount Pilatus', 'Pilatus (mountain)', 'epic', 'nature', 400, false),
  -- Budapest
  ('Budapest', 'Hungarian Parliament', 'Hungarian Parliament Building', 'legendary', 'culture', 200, true),
  ('Budapest', 'Buda Castle', 'Buda Castle', 'epic', 'culture', 250, true),
  ('Budapest', 'Fisherman''s Bastion', 'Fisherman''s Bastion', 'epic', '', 100, true),
  ('Budapest', 'Széchenyi Chain Bridge', 'Széchenyi Chain Bridge', 'rare', '', 200, true),
  ('Budapest', 'St. Stephen''s Basilica', 'St. Stephen''s Basilica', 'rare', 'pilgrim', 100, true),
  ('Budapest', 'Matthias Church', 'Matthias Church', 'rare', 'pilgrim', 80, true),
  ('Budapest', 'Széchenyi Thermal Bath', 'Széchenyi thermal bath', 'rare', '', 150, true),
  ('Budapest', 'Dohány Street Synagogue', 'Dohány Street Synagogue', 'rare', 'pilgrim,culture', 80, true),
  ('Budapest', 'Heroes'' Square', 'Heroes'' Square (Budapest)', 'uncommon', 'culture', 150, true),
  ('Budapest', 'Gellért Hill', 'Gellért Hill', 'uncommon', 'nature', 300, true),
  ('Budapest', 'Great Market Hall', 'Great Market Hall (Budapest)', 'uncommon', 'foodie', 100, true),
  ('Budapest', 'Hungarian State Opera', 'Hungarian State Opera House', 'uncommon', 'culture', 80, true),
  ('Budapest', 'Shoes on the Danube Bank', 'Shoes on the Danube Bank', 'uncommon', 'culture', 50, true),
  ('Budapest', 'Vajdahunyad Castle', 'Vajdahunyad Castle', 'uncommon', 'culture', 120, true),
  ('Budapest', 'Margaret Island', 'Margaret Island', 'common', 'nature', 600, true),
  -- Kraków
  ('Kraków', 'Wawel Castle', 'Wawel Castle', 'legendary', 'culture', 250, true),
  ('Kraków', 'Main Square', 'Main Square, Kraków', 'epic', '', 200, true),
  ('Kraków', 'St. Mary''s Basilica', 'St. Mary''s Basilica, Kraków', 'epic', 'pilgrim', 80, true),
  ('Kraków', 'Cloth Hall', 'Cloth Hall, Kraków', 'rare', 'culture,foodie', 80, true),
  ('Kraków', 'Wawel Cathedral', 'Wawel Cathedral', 'rare', 'pilgrim', 100, true),
  ('Kraków', 'Schindler''s Factory', 'Oskar Schindler''s Enamel Factory', 'rare', 'culture', 80, true),
  ('Kraków', 'Kazimierz', 'Kazimierz', 'uncommon', 'foodie,culture', 400, true),
  ('Kraków', 'Kraków Barbican', 'Kraków Barbican', 'uncommon', '', 60, true),
  ('Kraków', 'St. Florian''s Gate', 'St. Florian''s Gate', 'uncommon', '', 50, true),
  ('Kraków', 'Collegium Maius', 'Collegium Maius', 'uncommon', 'culture', 60, true),
  ('Kraków', 'Kościuszko Mound', 'Kościuszko Mound', 'uncommon', 'nature', 150, true),
  ('Kraków', 'Town Hall Tower', 'Town Hall Tower, Kraków', 'uncommon', '', 40, true),
  ('Kraków', 'Planty Park', 'Planty Park', 'common', 'nature', 400, true),
  ('Kraków', 'Wieliczka Salt Mine', 'Wieliczka Salt Mine', 'legendary', 'culture', 200, false),
  -- New York
  ('New York', 'Statue of Liberty', 'Statue of Liberty', 'legendary', 'culture', 150, true),
  ('New York', 'Empire State Building', 'Empire State Building', 'epic', '', 100, true),
  ('New York', 'Brooklyn Bridge', 'Brooklyn Bridge', 'epic', '', 300, true),
  ('New York', 'Metropolitan Museum of Art', 'Metropolitan Museum of Art', 'epic', 'culture', 200, true),
  ('New York', 'Times Square', 'Times Square', 'rare', '', 200, true),
  ('New York', 'One World Trade Center', 'One World Trade Center', 'rare', '', 120, true),
  ('New York', '9/11 Memorial & Museum', 'National September 11 Memorial & Museum', 'rare', 'culture', 150, true),
  ('New York', 'Grand Central Terminal', 'Grand Central Terminal', 'rare', '', 120, true),
  ('New York', 'Central Park', 'Central Park', 'uncommon', 'nature', 800, true),
  ('New York', 'Rockefeller Center', 'Rockefeller Center', 'uncommon', '', 150, true),
  ('New York', 'The High Line', 'High Line', 'uncommon', 'nature', 400, true),
  ('New York', 'St. Patrick''s Cathedral', 'St. Patrick''s Cathedral (Manhattan)', 'uncommon', 'pilgrim', 80, true),
  ('New York', 'Flatiron Building', 'Flatiron Building', 'uncommon', '', 60, true),
  ('New York', 'Museum of Modern Art', 'Museum of Modern Art', 'uncommon', 'culture', 100, true),
  ('New York', 'Chrysler Building', 'Chrysler Building', 'uncommon', '', 80, true),
  ('New York', 'American Museum of Natural History', 'American Museum of Natural History', 'uncommon', 'culture,nature', 150, true),
  -- Tokyo
  ('Tokyo', 'Sensō-ji', 'Sensō-ji', 'legendary', 'pilgrim', 150, true),
  ('Tokyo', 'Meiji Shrine', 'Meiji Shrine', 'epic', 'pilgrim', 250, true),
  ('Tokyo', 'Tokyo Skytree', 'Tokyo Skytree', 'epic', '', 120, true),
  ('Tokyo', 'Tokyo Tower', 'Tokyo Tower', 'rare', '', 100, true),
  ('Tokyo', 'Shibuya Crossing', 'Shibuya Crossing', 'rare', '', 80, true),
  ('Tokyo', 'Imperial Palace', 'Tokyo Imperial Palace', 'rare', 'culture', 400, true),
  ('Tokyo', 'Shinjuku Gyoen', 'Shinjuku Gyo-en', 'uncommon', 'nature', 400, true),
  ('Tokyo', 'Tokyo National Museum', 'Tokyo National Museum', 'uncommon', 'culture', 150, true),
  ('Tokyo', 'Toyosu Market', 'Toyosu Market', 'uncommon', 'foodie', 200, true),
  ('Tokyo', 'Zōjō-ji', 'Zōjō-ji', 'uncommon', 'pilgrim', 120, true),
  ('Tokyo', 'Ueno Park', 'Ueno Park', 'common', 'nature', 400, true),
  ('Tokyo', 'Akihabara', 'Akihabara', 'common', '', 400, true),
  ('Tokyo', 'Takeshita Street', 'Takeshita Street', 'common', 'foodie', 200, true),
  ('Tokyo', 'Roppongi Hills', 'Roppongi Hills', 'common', '', 150, true),
  -- Kyoto
  ('Kyoto', 'Fushimi Inari-taisha', 'Fushimi Inari-taisha', 'legendary', 'pilgrim', 200, true),
  ('Kyoto', 'Kinkaku-ji', 'Kinkaku-ji', 'epic', 'pilgrim', 120, true),
  ('Kyoto', 'Kiyomizu-dera', 'Kiyomizu-dera', 'epic', 'pilgrim', 150, true),
  ('Kyoto', 'Arashiyama', 'Arashiyama', 'rare', 'nature', 400, true),
  ('Kyoto', 'Ginkaku-ji', 'Ginkaku-ji', 'rare', 'pilgrim', 100, true),
  ('Kyoto', 'Nijō Castle', 'Nijō Castle', 'rare', 'culture', 200, true),
  ('Kyoto', 'Ryōan-ji', 'Ryōan-ji', 'rare', 'pilgrim', 100, true),
  ('Kyoto', 'Gion', 'Gion', 'uncommon', 'culture,foodie', 300, true),
  ('Kyoto', 'Kyoto Imperial Palace', 'Kyoto Imperial Palace', 'uncommon', 'culture', 300, true),
  ('Kyoto', 'Sanjūsangen-dō', 'Sanjūsangen-dō', 'uncommon', 'pilgrim', 100, true),
  ('Kyoto', 'Nishiki Market', 'Nishiki Market', 'uncommon', 'foodie', 150, true),
  ('Kyoto', 'Heian Shrine', 'Heian Shrine', 'uncommon', 'pilgrim', 120, true),
  ('Kyoto', 'Tō-ji', 'Tō-ji', 'uncommon', 'pilgrim', 100, true),
  ('Kyoto', 'Philosopher''s Walk', 'Philosopher''s Walk', 'common', 'nature', 300, true),
  ('Kyoto', 'Kyoto Tower', 'Kyoto Tower', 'common', '', 60, true)
) as v(city, name, t, rarity, sk, radius, major) on c.name = v.city
on conflict (city_id, name) do nothing;

insert into public.seasonal_picks (city_id, month, reason)
select c.id, v.month, v.reason from public.cities c
join (values
  ('Kyoto', 4, 'Cherry blossom season'),
  ('Kyoto', 11, 'Autumn leaves around the temples'),
  ('Tokyo', 3, 'The first cherry blossoms in Ueno Park'),
  ('New York', 12, 'Christmas lights and the Rockefeller Center tree'),
  ('Budapest', 12, 'Christmas markets and steaming thermal baths'),
  ('Kraków', 12, 'Christmas market in the Main Square'),
  ('Dubrovnik', 7, 'The Dubrovnik Summer Festival'),
  ('Split', 6, 'Long sunny days on the Dalmatian coast'),
  ('Athens', 5, 'Warm spring days before the summer heat'),
  ('Istanbul', 4, 'Tulip festival season'),
  ('Lucerne', 2, 'Lucerne Carnival'),
  ('Zurich', 12, 'Christmas markets by the lake')
) as v(name, month, reason) on c.name = v.name
on conflict do nothing;

-- Title fixes after the first fetch.
update public.landmark_candidates lc set name = 'Hofkirche', wiki_title = 'Hofkirche, Lucerne', status = 'new', note = null
from public.cities c where lc.city_id = c.id and c.name = 'Lucerne' and lc.name = 'Church of St. Leodegar';
update public.landmark_candidates lc set status = 'failed', note = 'No English Wikipedia article; left out'
from public.cities c where lc.city_id = c.id and c.name = 'Lucerne' and lc.name = 'Musegg Wall';
