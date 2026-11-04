# Daybook

A calendar and checkable task list. Every task is both a list item and a calendar event. Sign in with one account
on your laptop, phone and iPad and you see the same tasks everywhere, with live updates: add a task on the phone and
it appears on the laptop a moment later. Each device keeps a local copy, so it opens instantly and works offline;
changes upload when you're back online. Data lives in Supabase (Postgres), and row-level security means an account
can only ever read or change its own rows.

The phone app is in [`mobile/`](mobile/README.md).

## Run it (local server)

You need Node and Docker Desktop (for the local Supabase stack).

```bash
npm install
npm run db:start                 # local Postgres, Auth, Realtime (first run downloads images)
cp .env.example .env             # then paste API_URL / ANON_KEY from: npx supabase status -o env
npm run dev                      # http://localhost:5173
```

Create an account on the sign-in screen. Locally, emails (password reset, magic links) land in Mailpit at
http://127.0.0.1:54324 instead of a real inbox.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check and produce a production build in `dist/` |
| `npm run preview` | Serve the production build (service worker and offline mode work here) |
| `npm run lint` | ESLint (no `any`, named exports only, import order) |
| `npm test` | Vitest unit tests (also runs the phone app's sync-queue tests) |
| `npm run test:integration` | Adapter tests against the local Supabase stack |
| `npm run db:start` / `db:stop` | Start / stop the local Supabase stack |
| `npm run db:reset` | Rebuild the local database from `supabase/migrations/` |
| `npm run db:test` | pgTAP suite proving row-level security |
| `npm run db:types` | Regenerate `src/types/database.ts` after changing a migration |

### Use it on every device, from anywhere

The local server only works while the laptop is on and the other device is on the same Wi-Fi. To use Daybook from
anywhere, point it at a free hosted Supabase project:

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. In this folder: `npx supabase login`, `npx supabase link --project-ref <your project ref>`, then
   `npx supabase db push` to create the tables and security rules.
3. Dashboard → Project Settings → API: put the Project URL and the anon key in `.env` (web) and
   `mobile/.env.local` (phone).
4. Dashboard → Authentication → URL Configuration: set the Site URL to where the web app runs and add it under
   Redirect URLs, so password-reset links come back to the app. Under Sign In / Providers → Email, either turn off
   "Confirm email" or set up custom SMTP: Supabase's built-in email only sends a few messages per hour.
5. Host the web app (for example GitHub Pages) so the phone and iPad browsers can open it.

Free projects pause after about a week without use; opening the dashboard resumes them.

### Signing in

Email and password (or a magic link). **Keep me signed in** (on by default) keeps you signed in on that device;
turn it off on a shared computer and closing the tab signs you out. **Forgot password?** emails a reset link. Tasks
saved on a device before accounts existed are offered for import on the first sign-in there.

### Open the local server on your phone or iPad (same Wi-Fi)

```bash
npm run dev -- --host            # prints a Network address, e.g. http://10.39.83.47:5173
```

Open that Network address in Safari on the phone or iPad. Also set `VITE_SUPABASE_URL` in `.env` to the laptop's
Wi-Fi IP (e.g. `http://10.39.83.47:54321`), because `127.0.0.1` on the phone means the phone. Campus networks such as
eduroam often block device-to-device traffic; a phone hotspot works around that.

## What's in it

- **Today**: today's tasks, a clickable week strip, overdue, next 7 days, progress and a streak
- **List** and **Board**: group, sort, AND-combined filters, fuzzy search, bulk actions, Kanban columns
- **Calendar**: Month, Week, Day and Agenda; drag chips to reschedule; weekly class schedule overlay
- **Insights**: tasks completed per category by week
- **Customize**: six color schemes (Cobalt & Porcelain is the default) plus one-click choices for light/dark,
  background tone, accent, heading and body fonts, corner style and text size. Saved per device.
- **Alerts**: give any task as many alerts as you like (at due time, 10/30 min, 1/2 hr, 1/2 days, 1 week before)
  on top of an optional reminder time. They show as macOS notifications.
- **Morning briefing**: once a day after 7:00 a notification summarizes what's due, what's overdue and what's next
- Recurring tasks, subtasks, tags, categories with a curated palette
- Natural-language quick-add: `Essay draft fri 5pm #school !urgent`, `Gym every mon wed fri 7am`
- Keyboard shortcuts (press `?`), installable PWA that works offline
- JSON backup/restore and `.ics` export (Settings)

### Laptop notifications

Settings → Alerts & notifications → turn it on and allow notifications when the browser asks, then press
**Send a test notification**. If nothing appears, check System Settings → Notifications for your browser and that
Focus mode is off. Alerts fire while Daybook is open in a tab or installed as an app (the install icon in Chrome's
address bar puts it in your Dock). Alerts that came due while it was closed are delivered when you next open it, as
long as the task isn't past due.

## Google Calendar (and iPhone / Mac)

Settings → Calendar apps → **Connect Google Calendar** pushes dated tasks and classes into a separate
"Daybook" calendar in your Google account (one-way; your other calendars are never read or changed).
It needs a free Google OAuth client ID once:

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the **Google Calendar API**.
2. **OAuth consent screen**: choose *External*, fill in the app name, and add your own Google address under **Test users**.
3. **Credentials → Create credentials → OAuth client ID → Web application.** Under *Authorized JavaScript origins* add
   `http://localhost:5173` (and your hosted URL later, e.g. `https://<you>.github.io`).
4. Copy the client ID into `.env` as `VITE_GOOGLE_CLIENT_ID=...` and restart `npm run dev`.
5. Click **Connect Google Calendar**. Google warns the app is unverified because it's your own test app: choose *Continue*.

Google's browser sign-in gives an access token for about an hour, so edits sync automatically for an hour after you
connect or press **Sync now**; after that, press **Sync now** again. Each device pushes its own data and only removes
events it created.

**iPhone / Mac:** Apple Calendar can't be reached from a web page, so it shows Daybook through Google: either add your
Google account in Calendar's account settings and turn on "Daybook", or copy the calendar's *Secret address in iCal
format* from Google Calendar's settings and add it as a subscribed calendar.

## Notes

- Shared, framework-free logic lives in `src/lib` (dates, recurrence, quick-add, alerts, backup format, colors)
  and is used by both the web app and the phone app.
- Sync: `src/sync/` (web: Dexie cache + ordered outbox + Realtime) and `mobile/src/sync.ts` (same rules, on-device
  key-value cache). Schema, RLS and the `save_task` RPC live in `supabase/migrations/`.
- Design tokens: colors are generated by `src/lib/appearance.ts` (Customize page); type, spacing and shadows live in
  `tailwind.config.ts` and `src/styles/index.css`.
- App icons are generated by `node scripts/generate-icons.mjs`.
