# Handoff — Daybook (2026-11-04, night)

Read this first, then `CLAUDE.md`. Code on `main` is pushed to https://github.com/arushatre/schedule-planner.
The design preview described below is **not** in git (on purpose).

User's standing rules:
- No `Co-Authored-By` / Claude attribution in commits or PRs.
- ECC GateGuard hook is active. The first edit or creation of each file asks for facts. New files and risky actions → `ecc:council`, per `~/.claude/CLAUDE.md`.
- The user wants questions asked when something is ambiguous ("don't guess"), and nothing committed or pushed unless they say so.
- Test UI headlessly (Playwright script, no visible browser) unless the user asks to watch.

## Shipped this session (2026-11-04, late night)

- **Folder move:** the phone app lives in `mobile-app/` (CI, lint ignore and docs updated). `mobile/` in older notes below means `mobile-app/`.
- **Dashboard:** "Today" is now "Dashboard" on web and iPhone; the Daybook wordmark goes there. The schedule shows
  24 hours in a scroll box centered on the current time (other days: first item or 9 AM).
- **Customize (web) / Settings (iPhone):** heading font, body font and text size as plain choices; your name for the
  greeting; switches for Next up, the schedule and Next 7 days; default priority and category for new tasks. Shared
  model: `Personal` in `src/lib/appearance.ts`. The phone maps serif fonts to Georgia and the rest to the system font
  (no bundled fonts).
- **Drag to reorder ("My order"):** `tasks.sort_order` (migration `20261106120000_task_sort_order.sql`, pushed to
  hosted Supabase). Web: grip on each row (Dashboard day list and each Next-7-days day, List page in "My order" (the
  new default sort), Calendar day panel); Space + arrows also work. iPhone: three-line handle on the right, hold and
  drag (Dashboard, List tab). Logic: `compareByOrder` (`src/lib/recurrence.ts`), `orderAfterMove`, `nextSortOrder`,
  `dropIndex` (`src/lib/tasks.ts`). New tasks go to the end; Overdue, Next up and the schedule stay in time order.
- **Fix:** category color dots were zero-size outside flex rows (`CategoryDot` is now `inline-block`).

Not done / known limits:
- The phone app still ships Expo's placeholder icons (blue chevron), not the Daybook mark.
- The phone drag has no auto-scroll, and the phone app has still never run on a device or simulator (no Xcode).
- A quick-add typed in the first moment after sign-in, before categories load, saves as Uncategorized (pre-existing).
- `REMAINING-dashboard-customize.md` (untracked) is finished and can be deleted. `graphify-out/` (untracked) is a
  knowledge graph of the repo from `/graphify`.

## Shipped earlier today (2026-11-04, evening)

**The home-screen redesign shipped on web and iPhone: palette C "Midnight & Bronze" + the New layout.**
- Theme: `midnight` tone + `bronze` accent are the default preset (`src/lib/appearance.ts`); new tokens `highlight` (bronze progress / now line) and `--ember` (streak fire). The frame (sidebar, phone header) is now a quiet neutral, not navy.
- Web Today (`src/features/today/`): greeting + stats line, week strip, left column Next up / Tasks / Next 7 days, right column Overdue dropdown (rendered only when something is overdue; open/closed remembered in `daybook:overdue-open`) above `Schedule.tsx` (hour grid, now line, classes dashed). Task rows get a 12%/15% category wash; overdue = thin left rule + bold "Nd late", no red.
- Streak (`StreakButton.tsx`, phone `components/StreakSheet.tsx`): ember from day one; tiers in `streakTier()` (1, 2–5 quiet, 6–29 gradient + tiny hover fireworks, 30+ shimmer + "On fire"). Phone plays the fireworks on press (no hover). Click/tap opens the history: current/longest, 5-week grid, streak runs (started / ended / restarted after N days off), and times per day.
- Streak data: new table `activity_events` (migration `20261105120000_activity_events.sql`, RLS tests in `rls.test.sql`). Any add/edit/check/delete logs one event (throttled to one per 5 min); signing in alone does not, nor does first-run category seeding. `src/sync/activity.ts` queues events per account offline and never throws. Streak days = activity days ∪ task-completion days. The user said the definition "might change later": change where `touch()` / `record()` is called.
- Hosted Supabase has the `activity_events` table (pushed 2026-11-04).
- Not done: "Focus for today" (needs a schema decision), overlapping schedule items stack instead of sitting side by side, activity is not in JSON backups, phone app still never run on a simulator (bundles with `expo export`).

## Design preview (not committed, now historical)

- **File:** `design-preview.local/index.html`, with fonts copied into `design-preview.local/fonts/`.
  - `*.local` is in `.gitignore`, so it can't be committed by accident.
  - It is one self-contained HTML file with sample tasks. It reads no account data.
- **Open it:** in the Claude browser pane, `navigate` to `file:///Users/arushatre/schedule-planner/design-preview.local/index.html`. Use `resize_window` 1440×1000 to see the laptop layout.
  - The pane serves it as a `data:` page, so `localStorage` is blocked and settings and focus notes aren't remembered. The code handles this.
  - Each `navigate` opens a new tab; close stale ones.
- **Preview toolbar:** Palette (A/B/C) · Layout (New/Classic) · Mode (Light/Dark) · Overdue (1 task/None) · Streak (2/4/12/45).
- **The sample "now" is fixed at 2:40 PM,** so done tasks, Next up and the now line agree.

**Palettes.** The user approved the light modes of A and B.

| | Light | Dark |
| --- | --- | --- |
| A · Serene Nature | `#F1F1F1` bg, white cards, navy `#1D3557` text + button, sage progress, mustard "now" line | charcoal `#14181E`, lightened navy accent `#8FB0D9`, **bronze `#B8925A` button** |
| B · Graphite | graphite neutrals, **espresso `#2B211C`** accent + button (teal removed entirely) | graphite `#16181B`, bronze accent `#C4A06A`, bronze button |
| C · Midnight & Bronze | cool porcelain `#F2F4F7`, midnight ink `#121A26` button, bronze `#A88450` progress/now | deep midnight `#0E131B` (not graphite), bronze accent + button |

**Layouts**
- **New sections:**
  - greeting and stats
  - week strip
  - left column: Next up card, Focus for today, Tasks list (overdue first), Next 7 days
  - right column: "Today's schedule" hour timeline with a now line
- **Classic sections (single column):**
  - progress ring with a "Next up" line
  - week strip with open counts
  - collapsible Overdue
  - Today grouped into Morning / Afternoon / Evening / Anytime
  - Next 7 days
  - a quick-add bar fixed to the bottom

**User feedback already applied in the preview (carry into the real build)**
- **Category tints:** every task box gets a light wash of its category color (`color-mix`, 12% light / 15% dark). Work is yellow, Personal green, School blue. Tasks with no category keep the plain card background. This covers rows, Next up, Focus, Next 7 days and timeline blocks.
- **Focus for today:** reads "1. Title" with a note underneath. Notes are edited with a pencil button (visible on hover, always on touch) or a double-click. Enter saves, Esc cancels. The note needs a field in the real data model (e.g. a per-day focus list plus notes); **that schema is not decided yet.**
- **Overdue** appears only when there are overdue tasks. It uses a clock icon, a bold "2d late" and a thin left rule; no red, no panel.
- **Streak:** a red 🔥 emoji (the user's explicit exception to the no-red rule). Hovering the text gets fancier by tier: 1–2 days, 3–6 days (fire gradient), 7–29 days (shimmer and flicker), 30+ days (adds an "On fire" tag).
- **Main buttons:** bronze in every dark mode, and nothing teal or teal-adjacent anywhere (the user called teal "too AI-generated").

**Hard dislikes, gathered over this session**
- red (except the streak emoji), beige, purple
- tinted *section* panels or bands
- glows
- vibrant buttons
- teal
- "random colors in random places"
- navy as a background (the old navy sidebar)

The user liked:
- minimal neutral surfaces
- one accent per palette
- the new sections
- category tints *on task boxes only*

## What shipped this session (on `main`)

1. **Vercel hosting** (the user's choice; GitHub Pages also still deploys). Live at https://daybook-arush23.vercel.app.
   - Every push to `main` auto-deploys.
   - Vercel Deployment Protection is on, so visitors must be signed in to Vercel. The user may want to turn it off under Settings → Deployment Protection.
2. **Hosted Supabase** project `hjvgtkuwoykbdacmtfgo`, connected through the Vercel integration.
   - `src/lib/supabase.ts` falls back to `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
   - `vite.config.ts` has `envPrefix: ['VITE_', 'NEXT_PUBLIC_']`.
   - Never add a `SUPABASE_` prefix: that would ship the service-role key to the browser.
   - The user ran `db push` and set the redirect URLs. Sign-up on the live site is the user's to confirm.
3. **Colors** (three passes; the current state is the third):
   - **`366200f`:** Serene Nature became the default preset (`cloud` tone + `navy` accent in `src/lib/appearance.ts`).
   - **`cfc92c6`:** section tints (sage card, yellow week band, vermilion overdue panel). The user said it looked ugly.
   - **`269b10f`:** minimal scheme.
     - Neutral surfaces, with a navy frame (sidebar, phone header, sign-in band) and buttons.
     - Vermilion means overdue only; generated tokens `overdue`/`overdue-soft`, `frame`/`frame-fg`.
     - The palette's other colors are category colors only; `clay` is labeled "Terracotta".
     - A contrast test in `src/lib/appearance.test.ts` checks every preset.
     - It also fixed month-view chips overflowing their day cell (`MonthGrid` `grid-cols-1`).

   The planned redesign will probably replace the navy sidebar frame, since the user now dislikes navy backgrounds.

## Run it

```bash
npm install
npm run db:start                 # Docker Desktop must be running
cp .env.example .env             # values from: npx supabase status -o env
npm run dev                      # http://localhost:5173 (the preview launch config may land on 5174)
cd mobile-app && npm install && cp .env.example .env.local && npx expo start
```

Verified at `269b10f`:
- `npx tsc -b --noEmit`
- `npm run lint`
- `npm test` (163 passed, 2 skipped)
- `npm run build`
- phone (`mobile-app/`) `npx tsc --noEmit`
- `npx expo export --platform ios`

## Known limits and unverified items

- The phone app has never run on a device or simulator (Xcode isn't installed). It is only typechecked and bundled.
- The local test account `e2e@daybook.test` exists on the local DB only; its password is in a session scratchpad, not the repo. A sample overdue task, "Return library book", was added to it for screenshots.
- Web alerts only fire while the app is open. The phone schedules local notifications (at most 60).
- Tailwind config changes need a dev-server restart before new color classes appear.
- Google Calendar sync has never run against Google.
