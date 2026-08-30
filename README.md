# Leave It Here

> Don't organize it. Just leave it here.

A low-friction personal drop box. **DROP → UNDERSTAND → KEEP → BRING BACK.**

This repo currently contains the **project foundation only** — architecture, data
layer, state, AI abstraction, and screen scaffolding. The full product is not built yet.

## Stack (MVP)

| Concern | Choice |
| --- | --- |
| App | React Native + Expo (dev client) + TypeScript + expo-router |
| State | Zustand (`src/store`) |
| Local persistence | expo-sqlite + FTS5 (`src/db`) — source of truth |
| Media | expo-file-system + expo-image-manipulator (`src/lib/files.ts`) |
| Reminders | expo-notifications, **local only** (`src/lib/notifications.ts`) |
| Share input | expo-share-intent (wired in `app/_layout.tsx`) |
| Animation / feel | react-native-reanimated, gesture-handler, expo-haptics |
| AI | Pluggable `AIProvider` (`src/ai`) — Gemini in dev, backend proxy in prod |

**Deferred (not in MVP):** Supabase (no sync/backup yet), OneSignal (no push),
RevenueCat (no paywall — placeholder slice only in `src/store/entitlements.ts`).

## Setup

```bash
npm install
npx expo install --fix        # align native package versions to the SDK
cp .env.example .env           # add your dev Gemini key
npx expo prebuild              # generates ios/ + android/ (needed for share extension)
npm run ios                    # or: npm run android
```

> Requires a **dev client** — Expo Go cannot host the share extension.
> If the Reanimated Babel plugin name differs for your installed version,
> adjust `babel.config.js` per the Reanimated docs.

## AI key policy

- **Dev:** `EXPO_PUBLIC_AI_MODE=gemini-direct` calls Gemini straight from the app
  using `EXPO_PUBLIC_GEMINI_API_KEY` (git-ignored `.env`).
- **Any release build:** `EXPO_PUBLIC_AI_MODE=backend`. `src/ai/index.ts` throws
  at startup if a non-dev build is not in backend mode — a model key must never
  ship in the binary. `src/ai/backend.ts` already implements the proxy path;
  only the Edge Function needs writing.

## What resurfaces items

Only two explicit user actions (see `src/store/reminders.ts`):

1. `setReminder(id, when)` — user picks a time.
2. `acceptSuggestedDate(id)` — user accepts an AI-detected deadline.

There is **no** automatic "oldest item" resurfacing.

## Home

Home (`app/index.tsx`) is not a chronological archive. It shows only:
- **Ready to come back** — due / overdue reminders
- **Coming up** — future reminders
- a calm empty state when nothing needs attention

## Layout

```
app/                      expo-router screens
  _layout.tsx             root: hydrate, share-intent, notification deep-link
  index.tsx               Home (relevant-now)
  drop.tsx                manual quick drop (modal)
  item/[id].tsx           item detail + reminder controls
  search.tsx              full-text search
src/
  ai/                     AIProvider interface, gemini + backend impls, prompt, queue
  db/                     sqlite client + schema + typed item repo
  store/                  zustand slices: items, reminders, entitlements(placeholder)
  lib/                    haptics, files, notifications, id/hash
  theme/                  tokens
  types.ts               shared domain types
```

## Next build steps

1. Share-intent spike on a real device (highest risk).
2. Drop feature: image picker, paste detection, optimistic card animations.
3. Home + item-detail polish: Reanimated transitions, swipe gestures.
4. AI enrichment UI states (skeleton → content cross-fade).
5. Reminder scheduling polish + permission priming.
6. Edge Function proxy; flip default to backend mode.
