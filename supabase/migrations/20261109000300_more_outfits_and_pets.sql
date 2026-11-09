-- Twice the starter wardrobe, twice the location exclusives, and optional pets.

insert into public.items (key, name, slot, rarity, source, price_coins, colorable, description, sort) values
  ('fedora', 'Fedora', 'hat', 'common', 'starter', null, true, null, 5),
  ('headband', 'Headband', 'hat', 'common', 'starter', null, true, null, 6),
  ('visor', 'Visor', 'hat', 'common', 'starter', null, true, null, 7),
  ('bandana', 'Bandana', 'hat', 'common', 'starter', null, true, null, 8),
  ('polo', 'Polo shirt', 'top', 'common', 'starter', null, true, null, 7),
  ('flannel', 'Flannel shirt', 'top', 'common', 'starter', null, true, null, 8),
  ('cardigan', 'Cardigan', 'top', 'common', 'starter', null, true, null, 9),
  ('windbreaker', 'Windbreaker', 'top', 'common', 'starter', null, true, null, 10),
  ('dress', 'Sundress', 'top', 'common', 'starter', null, true, null, 11),
  ('tracktop', 'Track top', 'top', 'common', 'starter', null, true, null, 12),
  ('joggers', 'Joggers', 'bottom', 'common', 'starter', null, true, null, 5),
  ('leggings', 'Leggings', 'bottom', 'common', 'starter', null, true, null, 6),
  ('dungarees', 'Dungarees', 'bottom', 'common', 'starter', null, true, null, 7),
  ('longskirt', 'Long skirt', 'bottom', 'common', 'starter', null, true, null, 8),
  ('hightops', 'High-tops', 'shoes', 'common', 'starter', null, true, null, 4),
  ('loafers', 'Loafers', 'shoes', 'common', 'starter', null, true, null, 5),
  ('wellies', 'Wellies', 'shoes', 'common', 'starter', null, true, null, 6),
  ('headphones', 'Headphones', 'neck', 'common', 'starter', null, true, null, 3),
  ('necklace', 'Necklace', 'neck', 'common', 'starter', null, true, null, 4),
  ('duffel', 'Duffel bag', 'pack', 'common', 'starter', null, true, null, 3),
  ('bumbag', 'Bum bag', 'pack', 'common', 'starter', null, true, null, 4),
  ('graffiti_jacket', 'Graffiti jacket', 'top', 'rare', 'landmark', null, false, 'Splashed with colour from the longest stretch of the Wall.', 30),
  ('crystal_pendant', 'Bohemian crystal', 'neck', 'rare', 'landmark', null, false, 'Cut glass from across the Vltava.', 30),
  ('top_hat', 'Opera top hat', 'hat', 'rare', 'landmark', null, false, 'For a night at the Staatsoper.', 30),
  ('mosaic_scarf', 'Mosaic scarf', 'neck', 'epic', 'landmark', null, false, 'Gaudí-style trencadís, in fabric.', 31),
  ('navigator_hat', 'Navigator''s tricorn', 'hat', 'rare', 'landmark', null, false, 'For setting sail from Belém, as the explorers did.', 31),
  ('mortarboard', 'Scholar''s mortarboard', 'hat', 'rare', 'landmark', null, false, 'Earned in the halls of the Book of Kells.', 32),
  ('athenian_sandals', 'Athenian sandals', 'shoes', 'epic', 'landmark', null, false, 'Laced for climbing to the Parthenon.', 30),
  ('happi_coat', 'Festival happi', 'top', 'rare', 'landmark', null, false, 'Worn at the festivals of Asakusa.', 31),
  ('hussar_jacket', 'Hussar jacket', 'top', 'epic', 'landmark', null, false, 'Gold-braided, fit for the Danube''s grandest hall.', 32),
  ('dragon_hood', 'Wawel dragon hood', 'hat', 'epic', 'landmark', null, false, 'The dragon of Wawel Hill, tamed at last.', 33),
  ('guitar', 'Cavern guitar', 'pack', 'rare', 'landmark', null, false, 'Where the Beatles played 292 times.', 30),
  ('toga', 'Roman toga', 'top', 'rare', 'landmark', null, false, 'For taking the waters like a Roman.', 33)
on conflict (key) do nothing;

insert into public.item_drops (item_key, landmark_id)
select v.item, l.id from (values
  ('graffiti_jacket', 'Berlin', 'East Side Gallery'),
  ('crystal_pendant', 'Prague', 'Charles Bridge'),
  ('top_hat', 'Vienna', 'Vienna State Opera'),
  ('mosaic_scarf', 'Barcelona', 'Sagrada Família'),
  ('navigator_hat', 'Lisbon', 'Belém Tower'),
  ('mortarboard', 'Dublin', 'Trinity College'),
  ('athenian_sandals', 'Athens', 'Acropolis of Athens'),
  ('happi_coat', 'Tokyo', 'Sensō-ji'),
  ('hussar_jacket', 'Budapest', 'Hungarian Parliament'),
  ('dragon_hood', 'Kraków', 'Wawel Castle'),
  ('guitar', 'Liverpool', 'The Cavern Club'),
  ('toga', 'Bath', 'Roman Baths')
) as v(item, city, landmark)
join public.cities c on c.name = v.city
join public.landmarks l on l.city_id = c.id and l.name = v.landmark
on conflict do nothing;

-- Pets: optional, cat / dog / rat / bird, any colour. Older avatars without a pet are fine.
create or replace function public._check_avatar(p_user uuid, p_av jsonb)
returns void language plpgsql stable security definer set search_path = '' as $$
declare v_slot text; v_key text; v_item public.items;
begin
  if p_av->>'v' is distinct from '2' then raise exception 'Please update mmGO to change your look.'; end if;
  if coalesce(p_av->>'body', '') not in ('masc', 'fem', 'neutral') then raise exception 'Pick a body style.'; end if;
  if coalesce(p_av->>'hair', '') not in ('none', 'buzz', 'short', 'curly', 'long', 'bob', 'bun', 'afro') then raise exception 'Pick a hairstyle.'; end if;
  if coalesce(p_av->>'pet', 'none') not in ('none', 'cat', 'dog', 'rat', 'bird') then raise exception 'Pick a cat, dog, rat or bird.'; end if;
  if p_av ? 'petColor' and coalesce(p_av->>'petColor', '') !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'That pet colour isn''t valid.'; end if;
  foreach v_slot in array array['skin', 'hairColor', 'topColor', 'bottomColor', 'shoesColor', 'hatColor', 'neckColor', 'packColor'] loop
    if coalesce(p_av->>v_slot, '') !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'That colour isn''t valid.'; end if;
  end loop;
  foreach v_slot in array array['hat', 'top', 'bottom', 'shoes', 'neck', 'pack'] loop
    v_key := p_av->>v_slot;
    if v_key = 'none' and v_slot in ('hat', 'neck', 'pack') then continue; end if;
    select * into v_item from public.items where key = v_key and slot = v_slot;
    if v_item.key is null then raise exception 'That outfit item doesn''t exist.'; end if;
    if v_item.source <> 'starter' and not exists (select 1 from public.player_items where user_id = p_user and item_key = v_key) then
      raise exception 'You haven''t unlocked the % yet.', v_item.name;
    end if;
  end loop;
end;
$$;
revoke execute on function public._check_avatar(uuid, jsonb) from public, anon, authenticated;
