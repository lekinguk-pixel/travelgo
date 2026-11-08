-- Fix the five landmark candidates that didn't match a Wikipedia article.
-- Two had the wrong title; three have no English article, so they're
-- swapped for nearby landmarks that do.
update public.landmark_candidates lc set name = v.new_name, wiki_title = v.t,
  rarity = v.rarity::public.rarity, skills = v.skills::public.skill[], radius_m = v.radius,
  status = 'new', note = null, qid = null, page = null
from public.cities c, (values
  ('Brussels', 'Notre-Dame du Sablon', 'Notre-Dame du Sablon', 'Notre Dame du Sablon', 'uncommon', '{explorer,pilgrim}', 80),
  ('Lisbon', 'Time Out Market', 'Time Out Market', 'Time Out Market Lisboa', 'common', '{explorer,foodie}', 80),
  ('Lisbon', 'LX Factory', 'Carmo Convent', 'Carmo Convent', 'uncommon', '{explorer,culture,pilgrim}', 80),
  ('Amsterdam', 'A''DAM Lookout', 'Eye Filmmuseum', 'Eye Filmmuseum', 'uncommon', '{explorer,culture}', 100),
  ('Copenhagen', 'Torvehallerne', 'Copenhagen Opera House', 'Copenhagen Opera House', 'uncommon', '{explorer,culture}', 120)
) as v(city, old_name, new_name, t, rarity, skills, radius)
where lc.city_id = c.id and c.name = v.city and lc.name = v.old_name and lc.status = 'failed';
