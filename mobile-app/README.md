# Daybook for iPhone

A React Native (Expo) version of Daybook: Today, all tasks with search, add/edit with alerts, quick-add
(`Essay fri 5pm #school`), color schemes, and alerts that arrive as real iPhone notifications **even when the app
is closed**. It reuses the web app's tested logic straight from `../src` (dates, recurrence, quick-add parser,
alerts, backup format, colors), so both apps behave the same.

Sign in with the same account as the web app and your tasks stay in sync between laptop, phone and iPad, live.
The phone keeps its own copy, so it opens instantly and works offline; changes upload when you're back online.

## Set up (once)

```bash
npm install            # in the repo root (shared code)
cd mobile
npm install
cp .env.example .env.local   # then fill it in (see "Accounts and sync")
```

## Option A: try it now with Expo Go (no Xcode)

1. Install **Expo Go** from the App Store on your iPhone (it's Expo's free viewer app, not a listing for Daybook).
2. On the laptop: `cd mobile && npx expo start`
3. Scan the QR code with the iPhone Camera. Phone and laptop must be on the same Wi-Fi (on campus Wi-Fi that
   blocks this, use `npx expo start --tunnel`).

Good for trying it out. Expo Go loads the app from your laptop, so the laptop has to be running `expo start`
when you open it.

## Option B: install it as a real app on your phone (no laptop needed after)

This builds Daybook and installs it directly from your Mac over a cable.

1. Install **Xcode** from the Mac App Store (about 10 GB), open it once, and sign in with your Apple ID under
   Xcode → Settings → Accounts.
2. On the iPhone: Settings → Privacy & Security → **Developer Mode** → on (it restarts).
3. Plug the iPhone in, then run:

   ```bash
   cd mobile
   npx expo run:ios --device --configuration Release
   ```

   Pick your phone when asked. The first build takes a few minutes.
4. On the iPhone: Settings → General → VPN & Device Management → trust your Apple ID.

**The catch with a free Apple ID:** Apple makes free-signed apps expire after **7 days**. Your data stays on the
phone, but the app won't open until you plug in and re-run step 3 (about 2 minutes). A paid Apple Developer
account ($99/year) makes the install last a year; students can sometimes get the fee waived through their school.

## Notifications

Settings tab → **Notifications** on → allow when iOS asks → **Send a test notification**. Daybook schedules the next
two weeks of alerts plus a 7:00 AM morning briefing on the phone itself, so they fire with the app closed. It
re-plans whenever a task changes (here or on another device) or you open the app (iOS allows at most 64 queued, so it keeps the soonest 60).

## Accounts and sync

The app talks to the same Supabase project as the web app. `mobile-app/.env.local` (gitignored) holds its address:

| Variable | Value |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Local: `http://<laptop Wi-Fi IP>:54321` (not `127.0.0.1`, which on the phone means the phone). Hosted: dashboard → Project Settings → API. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Local: `ANON_KEY` from `npx supabase status -o env` in the repo root. Hosted: the anon/public key. |
| `EXPO_PUBLIC_WEB_URL` | Optional. The web app's address; password-reset and confirmation emails link there. Add it to Supabase's redirect URLs (`supabase/config.toml` locally, Authentication → URL Configuration when hosted). |

These values are compiled into the app, so restart `npx expo start` after changing them. Only public values belong
here: every table is protected by row-level security.

- **Local stack** (laptop must be on, phone on the same Wi-Fi): `npm run db:start` in the repo root (needs Docker),
  then `cd mobile && npx expo start`. Find the laptop's IP with `ipconfig getifaddr en0`.
- **Hosted** (works anywhere): put the hosted project's URL and anon key in `.env.local`. For a release build, the
  values in `.env.local` at build time are the ones the app uses.

**Signing in.** Email and password, the same account as on the web. *Keep me signed in* (on by default) keeps you
signed in across restarts; off, closing the app signs you out. *Forgot password?* emails a link that opens the web
app's reset page; choose a new password there, then sign in on the phone.

**How sync works.** Every change is saved on the phone first (per account, in `expo-sqlite`'s key-value store)
together with a queue of changes waiting to upload. The queue uploads in order; if the network drops it retries
with backoff, and if the server refuses a change it is undone with a message. Changes from other devices arrive
live while the app is open, and everything is re-checked when you open the app or pull down to refresh (or
Settings → *Sync now*). A change that hasn't uploaded yet is never overwritten by one coming from the server.

**Tasks saved before accounts.** On the first sign-in, if your account is empty, tasks saved on this phone by the
earlier no-account version are uploaded. If the account already has tasks, Daybook asks first. The old copy stays
on the phone either way.

**Signing out** stops sync and clears this phone's alerts. Changes that haven't uploaded yet stay on the phone and
upload the next time you sign in to the same account here.

## Backups (optional)

Settings → *Export backup* saves a `.json` copy you can keep (AirDrop, Files). *Import backup* replaces everything
in your account, on every device, after asking. Web backups work too.

## Code

- `src/App.tsx`: tabs, editor sheet, re-planning notifications
- `src/store.ts`: app state, the per-account cache and change queue, sign-in/out, first-sign-in import
- `src/sync.ts`: uploads the queue, pulls, live updates (Supabase Realtime); same rules as the web's `src/sync/engine.ts`
- `src/outbox.ts`: pure queue/merge logic, tested by `outbox.test.ts` (runs in the root `npm test`)
- `src/supabase.ts`: Supabase client, *Keep me signed in* storage
- `src/notifications.ts`: local notification scheduling (`expo-notifications`)
- `src/screens/`: sign-in, Today, All tasks, Settings, Task editor
- `@/…` imports resolve to the web app's `../src` (see `tsconfig.json` and `metro.config.js`)

Check it with `npx tsc --noEmit` and `npx expo-doctor`.
