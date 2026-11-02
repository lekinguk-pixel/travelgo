-- Starter content: continents, a few countries, UK cities, and London's
-- 48 major landmarks (chapter 1) with three quests.
-- Coordinates are approximate and flagged location_verified = false until
-- checked against map data.

insert into public.continents (code, name) values
  ('AF', 'Africa'), ('AN', 'Antarctica'), ('AS', 'Asia'), ('EU', 'Europe'),
  ('NA', 'North America'), ('OC', 'Oceania'), ('SA', 'South America');

insert into public.countries (code, name, continent_code) values
  ('GB', 'United Kingdom', 'EU'), ('FR', 'France', 'EU'), ('IT', 'Italy', 'EU'),
  ('ES', 'Spain', 'EU'), ('DE', 'Germany', 'EU'), ('JP', 'Japan', 'AS'), ('US', 'United States', 'NA');

insert into public.cities (name, region, country_code, lat, lng) values
  ('London', 'England', 'GB', 51.5072, -0.1276),
  ('Manchester', 'England', 'GB', 53.4808, -2.2426),
  ('Edinburgh', 'Scotland', 'GB', 55.9533, -3.1883),
  ('Bristol', 'England', 'GB', 51.4545, -2.5879),
  ('Liverpool', 'England', 'GB', 53.4084, -2.9916),
  ('Cardiff', 'Wales', 'GB', 51.4816, -3.1791),
  ('Belfast', 'Northern Ireland', 'GB', 54.5973, -5.9301),
  ('York', 'England', 'GB', 53.9600, -1.0873),
  ('Bath', 'England', 'GB', 51.3811, -2.3590),
  ('Brighton', 'England', 'GB', 50.8225, -0.1372);

insert into public.landmarks (city_id, name, lat, lng, radius_m, rarity, skills)
select c.id, v.name, v.lat, v.lng, v.radius_m, v.rarity::public.rarity, v.skills::public.skill[]
from public.cities c
cross join (values
  ('Tower Bridge', 51.5055, -0.0754, 150, 'rare', '{explorer,culture}'),
  ('Tower of London', 51.5081, -0.0759, 200, 'epic', '{explorer,culture}'),
  ('Big Ben', 51.5007, -0.1246, 150, 'rare', '{explorer,culture}'),
  ('Westminster Abbey', 51.4993, -0.1273, 150, 'epic', '{explorer,pilgrim,culture}'),
  ('Buckingham Palace', 51.5014, -0.1419, 200, 'rare', '{explorer,culture}'),
  ('London Eye', 51.5033, -0.1196, 150, 'uncommon', '{explorer}'),
  ('St Paul''s Cathedral', 51.5138, -0.0984, 150, 'epic', '{explorer,pilgrim,culture}'),
  ('The Shard', 51.5045, -0.0865, 150, 'uncommon', '{explorer}'),
  ('Trafalgar Square', 51.5080, -0.1281, 150, 'common', '{explorer}'),
  ('Piccadilly Circus', 51.5101, -0.1340, 120, 'common', '{explorer}'),
  ('British Museum', 51.5194, -0.1270, 150, 'rare', '{explorer,culture}'),
  ('Natural History Museum', 51.4967, -0.1764, 150, 'uncommon', '{explorer,culture,nature}'),
  ('Science Museum', 51.4978, -0.1745, 120, 'uncommon', '{explorer,culture}'),
  ('Victoria and Albert Museum', 51.4966, -0.1722, 120, 'uncommon', '{explorer,culture}'),
  ('Tate Modern', 51.5076, -0.0994, 150, 'uncommon', '{explorer,culture}'),
  ('Millennium Bridge', 51.5095, -0.0985, 120, 'common', '{explorer}'),
  ('Shakespeare''s Globe', 51.5081, -0.0972, 120, 'uncommon', '{explorer,culture}'),
  ('Borough Market', 51.5055, -0.0910, 150, 'uncommon', '{explorer,foodie}'),
  ('Covent Garden', 51.5117, -0.1240, 150, 'common', '{explorer,foodie}'),
  ('Camden Market', 51.5414, -0.1460, 200, 'uncommon', '{explorer,foodie}'),
  ('Hyde Park', 51.5073, -0.1657, 400, 'common', '{explorer,nature}'),
  ('Kensington Palace', 51.5058, -0.1877, 200, 'uncommon', '{explorer,culture}'),
  ('Royal Albert Hall', 51.5010, -0.1774, 120, 'uncommon', '{explorer,culture}'),
  ('Regent''s Park', 51.5272, -0.1527, 400, 'common', '{explorer,nature}'),
  ('Primrose Hill', 51.5394, -0.1608, 200, 'uncommon', '{explorer,nature}'),
  ('Royal Observatory Greenwich', 51.4769, -0.0005, 150, 'legendary', '{explorer,culture}'),
  ('Cutty Sark', 51.4827, -0.0096, 120, 'uncommon', '{explorer,culture}'),
  ('Kew Gardens', 51.4787, -0.2955, 400, 'rare', '{explorer,nature}'),
  ('St James''s Park', 51.5025, -0.1348, 300, 'common', '{explorer,nature}'),
  ('Leadenhall Market', 51.5128, -0.0834, 100, 'uncommon', '{explorer,foodie}'),
  ('Sky Garden', 51.5111, -0.0835, 100, 'uncommon', '{explorer,nature}'),
  ('The Monument', 51.5101, -0.0860, 100, 'common', '{explorer,culture}'),
  ('Somerset House', 51.5110, -0.1172, 150, 'common', '{explorer,culture}'),
  ('National Gallery', 51.5089, -0.1283, 120, 'rare', '{explorer,culture}'),
  ('Downing Street', 51.5034, -0.1276, 100, 'common', '{explorer}'),
  ('Horse Guards Parade', 51.5048, -0.1281, 150, 'common', '{explorer,culture}'),
  ('Abbey Road Crossing', 51.5320, -0.1778, 80, 'rare', '{explorer,culture}'),
  ('Hampstead Heath', 51.5600, -0.1520, 400, 'uncommon', '{explorer,nature}'),
  ('Portobello Road', 51.5156, -0.2050, 250, 'common', '{explorer,foodie}'),
  ('Brick Lane', 51.5216, -0.0716, 250, 'common', '{explorer,foodie}'),
  ('ArcelorMittal Orbit', 51.5383, -0.0129, 150, 'uncommon', '{explorer}'),
  ('Thames Barrier', 51.4974, 0.0370, 300, 'rare', '{explorer}'),
  ('Hampton Court Palace', 51.4036, -0.3378, 250, 'epic', '{explorer,culture}'),
  ('Wembley Stadium', 51.5560, -0.2795, 200, 'uncommon', '{explorer}'),
  ('Little Venice', 51.5222, -0.1835, 200, 'uncommon', '{explorer,nature}'),
  ('St Pancras Station', 51.5313, -0.1258, 150, 'common', '{explorer,culture}'),
  ('Westminster Cathedral', 51.4961, -0.1394, 120, 'uncommon', '{explorer,pilgrim}'),
  ('Chinatown Gate', 51.5115, -0.1310, 100, 'common', '{explorer,foodie}')
) as v(name, lat, lng, radius_m, rarity, skills)
where c.name = 'London' and c.country_code = 'GB';

insert into public.quests (city_id, name, description, xp_reward)
select c.id, q.name, q.description, q.xp_reward
from public.cities c cross join (values
  ('The Thames Trail', 'Follow the river past six of London''s most famous sights.', 500),
  ('Royal London', 'Visit the palaces where kings and queens have lived.', 600),
  ('Market Crawl', 'Eat your way through five of London''s great markets.', 400)
) as q(name, description, xp_reward)
where c.name = 'London' and c.country_code = 'GB';

insert into public.quest_steps (quest_id, landmark_id, position)
select q.id, l.id, s.position
from (values
  ('The Thames Trail', 'Tower Bridge', 1), ('The Thames Trail', 'Tower of London', 2),
  ('The Thames Trail', 'Millennium Bridge', 3), ('The Thames Trail', 'Tate Modern', 4),
  ('The Thames Trail', 'London Eye', 5), ('The Thames Trail', 'Big Ben', 6),
  ('Royal London', 'Buckingham Palace', 1), ('Royal London', 'Kensington Palace', 2),
  ('Royal London', 'Horse Guards Parade', 3), ('Royal London', 'Hampton Court Palace', 4),
  ('Market Crawl', 'Borough Market', 1), ('Market Crawl', 'Covent Garden', 2),
  ('Market Crawl', 'Leadenhall Market', 3), ('Market Crawl', 'Camden Market', 4),
  ('Market Crawl', 'Brick Lane', 5)
) as s(quest_name, landmark_name, position)
join public.cities c on c.name = 'London' and c.country_code = 'GB'
join public.quests q on q.city_id = c.id and q.name = s.quest_name
join public.landmarks l on l.city_id = c.id and l.name = s.landmark_name;
