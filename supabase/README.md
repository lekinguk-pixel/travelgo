# mmGO backend (Supabase)

Project: `mmGO` (ref `pianamkdbfwuxrlacgcy`), region eu-west-2 (London).
API URL: https://pianamkdbfwuxrlacgcy.supabase.co

The migrations in `migrations/` are applied in filename order and are the source of truth for the database.

## What's in the database

| Area | Tables |
| --- | --- |
| The world | `continents`, `countries`, `cities`, `landmarks` (rarity, skills, stamp radius) |
| Players | `profiles` (traveller name, pixel avatar, home city, total XP), `profile_private` (date of birth, only visible to the player) |
| Progress | `stamps`, `xp_events` (every XP gain, used for weekly leaderboards), `skill_xp`, `skill_levels` (1–99 curve), `city_awards` (bronze / silver / gold) |
| Quests | `quests`, `quest_steps`, `quest_completions` |
| Social | `friendships`, `groups` (clans), `group_members` |
| Safety | `stamp_reports` |

## Functions the app calls

| Function | What it does |
| --- | --- |
| `create_traveller(name, date_of_birth, home_city_id, avatar)` | Creates the player. Rejects under-13s, reserved and taken names. |
| `traveller_name_available(name)` | Live availability check for the name field. |
| `claim_stamp(landmark_id, lat, lng, accuracy_m, photo_path)` | Checks GPS distance and accuracy, that the photo was uploaded by this player and not reused, rate limits (30 an hour), and impossible travel (held for review). Awards skill XP, Wanderer XP for distance, city tiers and quest rewards. |
| `city_progress(city_id)` | Stamped vs major landmarks and current tier. |
| `leaderboard(scope, scope_id, period, mode, limit)` | Scope `world` / `continent` / `country` / `city`, period `week` / `month` / `all`, mode `solo` / `friends` / `clans`. Always includes the caller's own row. |

Players can never write to stamps, XP or profiles directly; row-level security and column grants block it, and all changes go through these functions.

## Stamp photos

Private bucket `stamp-photos`, max 10 MB, JPEG / PNG / WebP / HEIC. Each player can only upload to, view and delete from their own folder (`<user id>/...`). The app uploads first, then calls `claim_stamp` with the path.

## XP rules

- Stamp XP by rarity: common 80, uncommon 100, rare 120, epic 150, legendary 250. Explorer always gets it, plus each skill the landmark is tagged with.
- Wanderer: 1 XP per km since your previous stamp, up to 250.
- Skill levels follow the RuneScape curve scaled down 10x (level 99 at about 1.3M XP).
- City tiers: bronze at 50%, silver at 80%, gold at 100% of a city's major landmarks.

## Known follow-ups

- London landmark coordinates are approximate (`location_verified = false`); verify against OpenStreetMap before launch.
- Other UK cities exist but have no landmarks yet; generate them from open map data.
- Supabase's linter flags the player-facing functions as callable SECURITY DEFINER functions. That is intentional: they are the only way to write game data.

## Moderation

- Every stamp has a `photo_status`: `approved` (friends can see it), `pending` (waiting for the AI check), `flagged` (AI or an error; hidden until reviewed), `hidden` (3+ player reports; hidden until reviewed) or `removed` (a moderator hid it; the stamp is kept).
- Players report friends' photos with `report_stamp`. Moderators (table `moderators`) use `moderation_queue` and `moderate_stamp` (`keep`, `hide`, `remove`, where remove also takes back the XP). The app's moderator screen is at Me → Moderation queue.
- AI screening: edge function `moderate-photo` sends new photos to OpenAI's free `omni-moderation-latest` model. It needs the `OPENAI_API_KEY` secret (Supabase → Edge Functions → Secrets). Switch it on with
  `update public.app_settings set value = 'true' where key = 'ai_photo_screening';`
  While it's off, new photos are approved immediately. Photos stuck as `pending` for 30 minutes appear in the moderation queue.

## Inbox, travel ideas and partner links

- `inbox_messages` holds friend news (requests and accepts), chapter medals, invites and travel ideas. The app calls `my_inbox`, `inbox_unread_count`, `mark_inbox_read`, `dismiss_inbox` (with "not interested" for a city) and `inbox_click`.
- **Travel ideas** are off by default and only for players aged 18+ (`set_travel_ideas`, `inbox_settings`). At most one a week, or a month if the player chooses. A job (`pg_cron`, Mondays 09:00 UTC) runs `generate_travel_ideas()`. Picks, in order: a city they're a few stamps from a tier in, a city a friend stamped in the last 30 days, a seasonal pick (`seasonal_picks`), the nearest city they haven't started. It skips home, dismissed, gold and recently suggested cities. Only home city and stamps are used, never live location.
- **Partner links** are built server-side by `inbox_click`, which also counts the click (`inbox_clicks`). Templates live in `partners`:
  - `url_template`: the partner page, with `{city}`, `{country}`, `{from_city}`, `{from_iata}`, `{to_iata}`, `{from_iata_lc}`, `{to_iata_lc}`.
  - `wrapper_template`: the affiliate tracking link, with `{url}` (the encoded partner page) and `{sub}` (the campaign tag, e.g. `ti_friends_23_202645`, never anything about the player). While it's empty, links work but earn nothing.
  - `promo_code` / `promo_text`: optional partner discount shown on the card.
  - Going live is a data change, no app update. For example, once you have a Travelpayouts marker and programme ID:
    `update public.partners set wrapper_template = 'https://tp.media/r?marker=YOUR_MARKER&p=PROGRAMME_ID&u={url}&sub_id={sub}' where key = 'stays';`
- **Referrals**: `my_referral` gives each player a 6-character code; `redeem_referral` (first 14 days only, once) makes the two players friends and messages both.

## Landmark photos and information

- Landmarks and cities carry `summary`, `wiki_url` (Wikipedia, CC BY-SA 4.0) and a photo from Wikimedia Commons: `photo_url` (1280 px), `photo_thumb_url` (500 px), `photo_credit`, `photo_license`, `photo_license_url`, `photo_source_url`. The app shows the credit and licence under every photo.
- Only Commons images are used (they're all freely licensed). Images hosted only on Wikipedia (often non-free) are skipped.
- **Adding a city:** insert the city with a `wiki_title`, then add rows to `landmark_candidates` (name, Wikipedia title, rarity, skills, radius, is_major). A job (`pg_cron` "landmark-media", every 10 minutes, 40 requests a run) fetches each Wikipedia page through `pg_net`. A candidate becomes a real landmark only once Wikipedia or Wikidata gives coordinates within 40 km of the city. Failures are kept in `landmark_candidates.note`; rate-limited requests retry automatically.
- Existing landmarks get their coordinates corrected from Wikipedia when ours were 150 m to 2 km out, and `location_verified` is set.
