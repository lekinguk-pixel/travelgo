# mmGO Android app (Expo)

Expo Router app, wired to the Supabase backend in `../supabase`.

## Screens

| Route | Screen |
| --- | --- |
| `/` | Animated title screen |
| `/sign-in`, `/verify` | Email sign-in with a 6-digit code |
| `/create-traveller`, `/home-city` | Avatar, traveller name, date of birth (13+), home city |
| `/send-off` | Your traveller walks out of town; chapter 1 begins |
| `/(tabs)` | Explore (city chapter), My book, Stamp, Ranks, Me |
| `/camera/[id]` | GPS check, photo, claim stamp |
| `/stamp-collected` | Loot screen with XP and level-ups |

## Setup notes

- Supabase URL and publishable key live in `app.json` under `extra`. They are safe to ship in the app.
- Sign-in during testing: email + password, with **Confirm email switched off** in Supabase (Authentication → Sign In / Providers → Email), so no emails are sent.
- Before launch: set up a proper email sender on our own domain, switch Confirm email back on, and re-enable the 6-digit email code flow (`sendCode` in `app/sign-in.tsx` and `app/verify.tsx`). The **Magic Link** and **Confirm signup** templates must both include `{{ .Token }}`.
- Builds run on EAS from the GitHub repo with base directory `mobile`. Profiles in `eas.json`: `preview` makes an installable APK, `production` makes a Play Store bundle.
- Package versions are installed with `npx expo install` so they match the Expo SDK.

## Signing keys

- `credentials/preview.jks` + `credentials.json` sign **test builds only** (`preview` and `development` profiles). It is a throwaway key kept in this private repo so cloud builds work without extra setup. Never use it for the Play Store.
- The `production` profile uses an Expo-managed key, created the first time a production build is run by an account owner (`eas credentials` or the first `eas build --profile production`).
