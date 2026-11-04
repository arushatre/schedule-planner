# Handoff — Daybook (2026-11-04, night)

Read this first, then `CLAUDE.md`. Everything below is committed and pushed to `main` on
https://github.com/arushatre/schedule-planner.

User's standing rules: no `Co-Authored-By` / Claude attribution in commits or PRs. ECC GateGuard hook is active
(first edit/creation of each file asks for facts; new files → `ecc:council` per `~/.claude/CLAUDE.md`).

## Run it

```bash
npm install
npm run db:start                 # Docker Desktop must be running
cp .env.example .env             # values from: npx supabase status -o env
npm run dev                      # http://localhost:5173, sign up on the sign-in screen
cd mobile && npm install && cp .env.example .env.local && npx expo start   # phone, see mobile/README.md
```

Verified at handoff:
- Root: `npx tsc -b --noEmit`, `npm run lint`, `npm test` (161 passed, 2 skipped), `npm run build`, `npm run db:test` (47/47).
- Mobile: `npx tsc --noEmit`, `npx expo-doctor` (20/20), `npx expo export --platform ios`.

## What changed this session

1. **Customize page and the Cobalt & Porcelain color scheme.** See `src/lib/appearance.ts` and `src/features/kit/KitPage.tsx`.
2. **Alerts and the morning briefing.** See `src/lib/reminders.ts` and `src/hooks/useReminders.ts`. Decided by `ecc:council`.
3. **Expo phone app** in `mobile/`. Decided by `llm-council`.
4. **Accounts and live sync on every device.** Decided by `ecc:council`, unanimous: accounts over a no-account sync code.
   - **Web:**
     - Auth is back on (`AuthProvider` + `AuthGate`). `useTheme()` now runs in `AuthGate`, so the sign-in screens are themed.
     - **Keep me signed in** for every sign-in method: the session goes to localStorage when on, sessionStorage when off (`src/lib/supabase.ts`, key `daybook:keepSignedIn`).
     - **Forgot password** already existed.
     - The account section in Settings is restored (`src/features/settings/AccountSection.tsx`).
     - On first sign-in, the app offers to import both the legacy `daybook` DB and this week's local-only `daybook:local` cache.
     - The auth screen is split into `MethodTabs.tsx` and `InboxNotice.tsx`.
   - **Database:** migration `20261104120000_task_alerts.sql` adds `tasks.alerts smallint[]` (0–10080, at most 32 entries), and `save_task` writes it sorted with duplicates removed. pgTAP covers the round trip and range check. `config.toml` adds redirect URLs for the preview ports 5174 and 5180.
   - **Phone:**
     - `mobile/src/supabase.ts`: Keep me signed in uses the kv-store when on and memory when off.
     - `screens/AuthScreen.tsx`: sign in, create account, and forgot password (the reset link goes to the web app's reset page via `EXPO_PUBLIC_WEB_URL`).
     - `sync.ts` and `outbox.ts` mirror `SyncEngine`: ordered outbox, merging writes to the same record, backoff, rollback of refused writes, and pulls or realtime never overwriting pending writes. Pulls happen on sign-in, on foreground, on pull-to-refresh and on Sync now; realtime runs while the app is open.
     - `cache.ts` keeps a per-account cache. Notifications are re-planned whenever tasks change.
     - Pre-account phone data is uploaded if the account is empty, otherwise the app asks.
     - Replacing the account from a backup is guarded and confirmed.
   - **Phone UI:**
     - Week strip, swipe to complete, an undo snackbar for complete and delete, and a subtasks checklist.
     - Haptics, pull-to-refresh, and a priority marker on rows.
     - New files in `mobile/src/components/`.
   - **Shared:** `src/sync/records.ts` holds the pure `planLegacyImport` and `sameRecord`, used by the web and the phone.
   - **How the work was split:**
     - A web agent and a phone UI agent did the work.
     - A manager agent built the phone sync, then reviewed the other two. It fixed four bugs: Keep me signed in only showed for password sign-in, undo lost "in progress", VoiceOver didn't announce the snackbar, and the replace-account import was unguarded.
     - The orchestrator verified in the browser:
       - sign-up and sign-in
       - a task added by a second client appeared live
       - checking it off reached the database
       - the Settings account section
       - the Forgot password email arrived in Mailpit
       - signing back in restored the data

## Needs the user (blocking "works from anywhere")

1. **Hosted Supabase project.**
   - Create it at supabase.com, then run `npx supabase login`, `link` and `db push`.
   - Put the URL and anon key in `.env` and `mobile/.env.local`.
   - Set the Site URL and Redirect URLs.
   - Turn off "Confirm email" or set up SMTP (the built-in email only sends a few messages per hour).
   - The steps are in the README under "Use it on every device, from anywhere".
2. **Host the web app** so the phone and iPad browsers can reach it. GitHub Pages is proposed, but it isn't set up: that needs the user's OK, because the site would be public (data stays protected by RLS). It needs `base: '/schedule-planner/'`, the PWA scope, a Pages workflow, and the Pages origin added to the Supabase redirect URLs and the Google OAuth client.
3. **Phone install:**
   - Expo Go needs the laptop dev server running.
   - A standalone install needs Xcode (not installed). With a free Apple ID it expires every 7 days.

## Known limits and unverified items

- The phone app has never run on a device. It is only typechecked, bundled and checked with expo-doctor, and its sync logic is unit-tested plus covered by a Node script against the local DB.
- Web alerts only fire while the app is open. The phone schedules real local notifications (at most 60 queued).
- With Keep me signed in off on the web, each new tab needs a fresh sign-in (sessionStorage is per tab).
- The local `config.toml` redirect URL changes take effect after `npm run db:stop && npm run db:start`.
- Local test account: `e2e@daybook.test` (local dev DB only; the password is in the session scratchpad, not the repo).
- Google Calendar sync has never run against Google. `src/lib/googleCalendar.ts` is about 355 lines.
