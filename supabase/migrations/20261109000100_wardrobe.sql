-- Wardrobe: a catalogue of clothing items, what each player owns, and
-- location-exclusive drops granted when a landmark is stamped for real.
-- Avatars (profiles.avatar, v2) are checked on every save: only starter items
-- or items the player owns can be worn.

create table public.items (
  key text primary key check (key ~ '^[a-z_]{2,32}$'),
  name text not null,
  slot text not null check (slot in ('hat', 'top', 'bottom', 'shoes', 'neck', 'pack')),
  rarity public.rarity not null default 'common',
  source text not null check (source in ('starter', 'landmark', 'journey')),
  price_coins integer check (price_coins > 0),
  colorable boolean not null default true,
  description text,
  sort integer not null default 0
);

create table public.item_drops (
  item_key text not null references public.items (key) on delete cascade,
  landmark_id bigint not null references public.landmarks (id) on delete cascade,
  primary key (item_key, landmark_id)
);

create table public.player_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_key text not null references public.items (key) on delete cascade,
  source text not null check (source in ('landmark', 'journey', 'gift')),
  stamp_id bigint references public.stamps (id) on delete set null,
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_key)
);

alter table public.items enable row level security;
alter table public.item_drops enable row level security;
alter table public.player_items enable row level security;
create policy "Anyone can read the item catalogue" on public.items for select using (true);
create policy "Anyone can see where items drop" on public.item_drops for select using (true);
create policy "Players see their own items" on public.player_items for select using (user_id = auth.uid());
revoke insert, update, delete on public.items, public.item_drops, public.player_items from anon, authenticated;

insert into public.items (key, name, slot, rarity, source, price_coins, colorable, description, sort) values
  -- starter wardrobe
  ('cap', 'Cap', 'hat', 'common', 'starter', null, true, null, 1),
  ('beanie', 'Beanie', 'hat', 'common', 'starter', null, true, null, 2),
  ('bucket', 'Bucket hat', 'hat', 'common', 'starter', null, true, null, 3),
  ('sunhat', 'Sun hat', 'hat', 'common', 'starter', null, true, null, 4),
  ('tee', 'T-shirt', 'top', 'common', 'starter', null, true, null, 1),
  ('vest', 'Vest top', 'top', 'common', 'starter', null, true, null, 2),
  ('hoodie', 'Hoodie', 'top', 'common', 'starter', null, true, null, 3),
  ('jacket', 'Jacket', 'top', 'common', 'starter', null, true, null, 4),
  ('jumper', 'Striped jumper', 'top', 'common', 'starter', null, true, null, 5),
  ('raincoat', 'Raincoat', 'top', 'common', 'starter', null, true, null, 6),
  ('jeans', 'Jeans', 'bottom', 'common', 'starter', null, true, null, 1),
  ('shorts', 'Shorts', 'bottom', 'common', 'starter', null, true, null, 2),
  ('cargo', 'Cargo trousers', 'bottom', 'common', 'starter', null, true, null, 3),
  ('skirt', 'Skirt', 'bottom', 'common', 'starter', null, true, null, 4),
  ('trainers', 'Trainers', 'shoes', 'common', 'starter', null, true, null, 1),
  ('boots', 'Boots', 'shoes', 'common', 'starter', null, true, null, 2),
  ('sandals', 'Sandals', 'shoes', 'common', 'starter', null, true, null, 3),
  ('scarf', 'Scarf', 'neck', 'common', 'starter', null, true, null, 1),
  ('camera', 'Camera', 'neck', 'common', 'starter', null, false, null, 2),
  ('backpack', 'Backpack', 'pack', 'common', 'starter', null, true, null, 1),
  ('satchel', 'Satchel', 'pack', 'common', 'starter', null, true, null, 2),
  -- location exclusives: only from stamping the landmark for real
  ('bearskin', 'Guardsman''s bearskin', 'hat', 'epic', 'landmark', null, false, 'The tall fur hat of the King''s Guard.', 10),
  ('beret', 'Parisian beret', 'hat', 'rare', 'landmark', null, false, 'Tilted just so, beneath the Iron Lady.', 11),
  ('tartan_scarf', 'Tartan scarf', 'neck', 'rare', 'landmark', null, false, 'Woven for windy castle ramparts.', 10),
  ('viking_helmet', 'Viking helmet', 'hat', 'rare', 'landmark', null, false, 'Jorvik''s finest. (Real Vikings didn''t have horns.)', 12),
  ('laurel_wreath', 'Golden laurel', 'hat', 'epic', 'landmark', null, false, 'Worn by champions of the arena.', 13),
  ('liberty_crown', 'Liberty crown', 'hat', 'epic', 'landmark', null, false, 'Seven rays for seven seas and continents.', 14),
  ('flower_crown', 'Tulip crown', 'hat', 'uncommon', 'landmark', null, false, 'Picked fresh from the floating flower market.', 15),
  ('sakura_pin', 'Sakura hairpin', 'hat', 'rare', 'landmark', null, false, 'Cherry blossom from the thousand gates.', 16),
  ('alpine_hat', 'Alpine hat', 'hat', 'rare', 'landmark', null, false, 'Feather and all, from the bridge over the Reuss.', 17),
  ('dragon_scarf', 'Red dragon scarf', 'neck', 'rare', 'landmark', null, false, 'Y Ddraig Goch, from Cardiff''s castle walls.', 11),
  ('fez', 'Bazaar fez', 'hat', 'uncommon', 'landmark', null, false, 'Haggled for in a market of 4,000 shops.', 18),
  -- journey shop: bought with coins earned on the digital journey
  ('pith_helmet', 'Explorer''s helmet', 'hat', 'uncommon', 'journey', 600, false, null, 20),
  ('pilot_cap', 'Aviator cap', 'hat', 'rare', 'journey', 900, false, null, 21),
  ('captain_hat', 'Captain''s hat', 'hat', 'rare', 'journey', 1200, false, null, 22),
  ('puffer', 'Puffer jacket', 'top', 'uncommon', 'journey', 800, true, null, 20),
  ('hiking_boots', 'Hiking boots', 'shoes', 'uncommon', 'journey', 500, false, null, 20),
  ('medal', 'Voyager''s medal', 'neck', 'epic', 'journey', 1500, false, null, 20);

insert into public.item_drops (item_key, landmark_id)
select v.item, l.id from (values
  ('bearskin', 'London', 'Buckingham Palace'),
  ('beret', 'Paris', 'Eiffel Tower'),
  ('tartan_scarf', 'Edinburgh', 'Edinburgh Castle'),
  ('viking_helmet', 'York', 'Jorvik Viking Centre'),
  ('laurel_wreath', 'Rome', 'Colosseum'),
  ('liberty_crown', 'New York', 'Statue of Liberty'),
  ('flower_crown', 'Amsterdam', 'Bloemenmarkt'),
  ('sakura_pin', 'Kyoto', 'Fushimi Inari-taisha'),
  ('alpine_hat', 'Lucerne', 'Chapel Bridge'),
  ('dragon_scarf', 'Cardiff', 'Cardiff Castle'),
  ('fez', 'Istanbul', 'Grand Bazaar')
) as v(item, city, landmark)
join public.cities c on c.name = v.city
join public.landmarks l on l.city_id = c.id and l.name = v.landmark;

-- ---------- avatar v2 ----------
alter table public.profiles drop constraint profiles_avatar_valid;

create or replace function public._default_avatar()
returns jsonb language sql immutable set search_path = '' as $$
  select '{"v":2,"body":"neutral","skin":"#EBB58C","hair":"short","hairColor":"#4A2E1E","top":"jacket","topColor":"#2A7F75","bottom":"jeans","bottomColor":"#2F4A73","shoes":"trainers","shoesColor":"#C8553D","hat":"cap","hatColor":"#C8553D","neck":"none","neckColor":"#D9A441","pack":"backpack","packColor":"#B5784A"}'::jsonb;
$$;

-- Throws a friendly error if the avatar isn't valid for this player.
create or replace function public._check_avatar(p_user uuid, p_av jsonb)
returns void language plpgsql stable security definer set search_path = '' as $$
declare v_slot text; v_key text; v_item public.items;
begin
  if p_av->>'v' is distinct from '2' then raise exception 'Please update mmGO to change your look.'; end if;
  if coalesce(p_av->>'body', '') not in ('masc', 'fem', 'neutral') then raise exception 'Pick a body style.'; end if;
  if coalesce(p_av->>'hair', '') not in ('none', 'buzz', 'short', 'curly', 'long', 'bob', 'bun', 'afro') then raise exception 'Pick a hairstyle.'; end if;
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

create or replace function public._avatar_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.avatar is distinct from old.avatar then
    -- Old-style looks from earlier app versions become the default traveller in their colours.
    if new.avatar->>'v' is null then
      new.avatar := public._default_avatar()
        || jsonb_build_object('hatColor', coalesce(new.avatar->>'hat', '#C8553D'), 'topColor', coalesce(new.avatar->>'coat', '#2A7F75'), 'packColor', coalesce(new.avatar->>'pack', '#B5784A'));
    end if;
    perform public._check_avatar(new.id, new.avatar);
  end if;
  return new;
end;
$$;
create trigger profiles_avatar_guard before insert or update of avatar on public.profiles
for each row execute function public._avatar_guard();

alter table public.profiles alter column avatar set default public._default_avatar();
-- Convert existing players' looks.
update public.profiles set avatar = public._default_avatar()
  || jsonb_build_object('hatColor', coalesce(avatar->>'hat', '#C8553D'), 'topColor', coalesce(avatar->>'coat', '#2A7F75'), 'packColor', coalesce(avatar->>'pack', '#B5784A'))
where avatar->>'v' is null;

-- ---------- drops ----------
create or replace function public._grant_stamp_drops()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'verified' and (tg_op = 'INSERT' or old.status is distinct from 'verified') then
    insert into public.player_items (user_id, item_key, source, stamp_id)
    select new.user_id, d.item_key, 'landmark', new.id from public.item_drops d where d.landmark_id = new.landmark_id
    on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger stamps_grant_drops after insert or update of status on public.stamps
for each row execute function public._grant_stamp_drops();

-- Everything in the catalogue, whether this player owns it, and where to get it.
create or replace function public.my_wardrobe()
returns table (key text, name text, slot text, rarity public.rarity, source text, price_coins integer, colorable boolean,
               description text, owned boolean, landmark_id bigint, landmark_name text, city_name text)
language sql stable security definer set search_path = '' as $$
  select i.key, i.name, i.slot, i.rarity, i.source, i.price_coins, i.colorable, i.description,
         i.source = 'starter' or exists (select 1 from public.player_items p where p.user_id = auth.uid() and p.item_key = i.key),
         l.id, l.name, c.name
  from public.items i
  left join public.item_drops d on d.item_key = i.key
  left join public.landmarks l on l.id = d.landmark_id
  left join public.cities c on c.id = l.city_id
  order by i.slot, i.sort, i.name;
$$;

-- Items unlocked by a particular stamp (for the celebration screen).
create or replace function public.stamp_drops(p_stamp_id bigint)
returns table (key text, name text, slot text, rarity public.rarity, description text)
language sql stable security definer set search_path = '' as $$
  select i.key, i.name, i.slot, i.rarity, i.description
  from public.player_items p join public.items i on i.key = p.item_key
  where p.stamp_id = p_stamp_id and p.user_id = auth.uid();
$$;

revoke execute on function public._check_avatar(uuid, jsonb), public._avatar_guard(), public._grant_stamp_drops() from public, anon, authenticated;
revoke execute on function public.my_wardrobe(), public.stamp_drops(bigint) from public, anon;
grant execute on function public.my_wardrobe(), public.stamp_drops(bigint) to authenticated;
