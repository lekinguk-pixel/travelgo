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
- No moderator tooling yet for `pending_review` stamps or reports.
- Supabase's linter flags the player-facing functions as callable SECURITY DEFINER functions. That is intentional: they are the only way to write game data.
