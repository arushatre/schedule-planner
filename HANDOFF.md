# Handoff — Daybook (2026-11-04, evening)

Read this first, then `CLAUDE.md` (note: `CLAUDE.md` still describes Supabase as live; today the app runs
local-only, and the next task switches accounts back on). Everything below is committed and pushed to
`main` on https://github.com/arushatre/schedule-planner unless listed under "In progress".

User's standing rules: no `Co-Authored-By` / Claude attribution in commits or PRs. ECC GateGuard hook is active
(first edit/creation of each file asks for facts; new files → `ecc:council` per `~/.claude/CLAUDE.md`).

## Run it

```bash
npm install && npm run dev                 # web, http://localhost:5173 (no sign-in today)
npm run dev -- --host                      # also reachable from phone/iPad on the same Wi-Fi
cd mobile && npm install && npx expo start # phone app via Expo Go (see mobile/README.md)
```

Verified at handoff: root `npx tsc -b --noEmit`, `npm run lint`, `npm test` (141 passed, 2 skipped),
`npm run build`; mobile `npx tsc --noEmit`, `npx expo export --platform ios`, `npx expo-doctor` (20/20).

## Done today (all pushed)

1. **Local-only mode, Today redesign, Google Calendar push** (from the previous session).
2. **Customize page** (`src/features/kit/KitPage.tsx`, `src/lib/appearance.ts`): every surface/text/accent token
   is generated from a background tone + accent. Six presets (default *Cobalt & Porcelain*), mode, tone, accent,
   heading/body font, corners, text size. Tailwind fonts/radii read CSS vars; stored at `daybook:appearance`.
3. **Alerts + notification "agent"** (`src/lib/reminders.ts`, `src/hooks/useReminders.ts`,
   `src/components/task/AlertPicker.tsx`): `Task.alerts: number[]` (minutes before due; untimed = 9:00),
   catch-up of alerts missed while closed (only latest per task), daily 7:00 morning briefing, test button.
   Decided by `ecc:council` (no launchd helper, no LLM).
4. **Expo phone app** in `mobile/` (SDK 58, decided by `llm-council`): Today, All tasks, Settings, Task editor;
   imports `../src` via the `@/` alias (`mobile/tsconfig.json`, `mobile/metro.config.js`); data in `expo-sqlite`
   kv-store in the web backup format; local notifications planned by shared `planNotifications` (≤60 for iOS).
   **Never run on a device** (no Xcode on this Mac); only typechecked and bundled.

## In progress: accounts + live sync on every device

The user asked: same data on laptop, phone and iPad with live updates; prefer a no-account option if feasible,
otherwise accounts with **Keep me signed in** and **Forgot password**; revise the phone app's features/UX with
notifications; use subagents with a manager agent; no quality drop.

**`ecc:council` verdict (unanimous):** use email + password accounts. The no-account option (anonymous sign-in +
shared sync code) is feasible but needs the same hosted backend, a rewrite of user_id RLS + pgTAP to space
membership, and the code becomes a password with no reset. P2P/LAN is only live while both devices are on.
Phone app: sync first, don't chase full parity; add week strip, swipe-to-complete, undo, subtasks/categories in
the editor, sign-in; re-plan notifications after every sync/realtime change; leave insights, category manager and
class-schedule editing to the web app (usable in the phone's browser).

What already exists (switched off in commit 9e27899): `src/auth/*`, `src/features/auth/*` (password + magic link
+ forgot/reset), `src/sync/` SyncEngine (Dexie cache + outbox + realtime), `createSupabaseRemote(client)` (reusable
by the phone app; `remote.ts` only type-imports Dexie bits), migrations + RLS + pgTAP in `supabase/`. The old
wiring is visible with `git show 29eb3cd:src/main.tsx` and `git show 29eb3cd:src/sync/SyncProvider.tsx`.

Prepared (committed now): phone deps installed (`@supabase/supabase-js`, gesture-handler, reanimated, worklets,
expo-haptics); `.claude/launch.json` has a `web-phone` config (`--host`, port 5180). Local Supabase runs via
`npx supabase start` (Docker Desktop must be open); `.env` points at it.

Remaining plan:
1. **Web**
   - Add a migration for the `alerts int[]` column and update `save_task` to write it.
   - Update `mappers.ts` both ways (remove the `shortcut:` comment), regenerate `src/types/database.ts` with `npm run db:types`, and add a pgTAP check.
   - Re-enable `AuthProvider`/`AuthGate` in `main.tsx`, with `SyncProvider` defaulting to `createSupabaseRemote`.
   - Keep me signed in: a custom auth `storage` in `src/lib/supabase.ts` (localStorage when on, sessionStorage when off), with a checkbox on `AuthScreen`.
   - Offer to import this week's local-only data (`daybook:local` IndexedDB) into the account on first sign-in, alongside the legacy `daybook` DB.
   - Restore the Settings account/sync section (see `git diff 29eb3cd -- src/features/settings/SettingsDialog.tsx`).
2. **Phone**
   - `mobile/src/supabase.ts`, with the session in kv-store when "keep me signed in" is on and in memory when off.
   - A sign-in / create-account / forgot-password screen. The reset link opens the web app's reset page.
   - Sync in `store.ts`: kv-store outbox, `createSupabaseRemote`, a pull on launch and foreground, and realtime. Re-plan notifications after every change.
   - UI: week strip, swipe to complete with undo, subtasks checklist, haptics, pull-to-refresh (`syncNow`).
3. **Hosting (needs the user)**
   - The user creates a free Supabase project and runs `npx supabase login`, `link` and `db push`.
   - They provide the URL and anon key.
   - In the Supabase dashboard: set the Site URL and redirect URLs, and either turn off confirm email or set SMTP. The built-in email only sends a few messages per hour.
   - Host the web app (GitHub Pages workflow; needs the user's OK to enable Pages, which makes it public).
   - Free projects pause after about a week of inactivity.
4. Verify:
   - Two browser sessions show live updates.
   - Mobile typecheck, bundle and expo-doctor pass.
   - RLS tests pass (`npm run db:test`).
   - Update README / CLAUDE.md / this file, then commit and push.

## Known limits

- Web alerts only fire while the app is open; the phone app schedules real local notifications.
- Free-Apple-ID sideload of the phone app expires every 7 days; Expo Go needs the laptop's dev server.
- Google Calendar sync: OAuth token lasts ~1h; client ID not set up yet; never run against Google.
- `src/lib/googleCalendar.ts` is ~355 lines (guideline 300).
