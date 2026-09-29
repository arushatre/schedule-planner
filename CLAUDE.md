# Project Overview
- Tech stack: React 18, TypeScript, Vite, Tailwind CSS 3 (custom theme), Zustand, Dexie, date-fns, dnd-kit, Framer Motion, lucide-react, Supabase (Postgres + Auth + Realtime)
- Main entry point: `src/main.tsx`

## Commands
- Install: `npm install`, then `cp .env.example .env` and fill in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (`npx supabase status -o env` prints the local values)
- Local backend (needs Docker): `npm run db:start` / `npm run db:stop`
- Reset DB from migrations: `npm run db:reset` (never edit the schema in the dashboard; add a file under `supabase/migrations/`)
- RLS test suite (pgTAP): `npm run db:test`
- Regenerate DB types after a migration: `npm run db:types` (writes `src/types/database.ts`)
- Dev server: `npm run dev` (magic-link emails land in Mailpit at http://127.0.0.1:54324)
- Build: `npm run build` (`npm run preview` to exercise the service worker / offline mode)
- Lint: `npm run lint`
- Test: `npm test` (unit tests, in-memory backend)
- Integration test against the local stack: `npm run test:integration`

## Data Model
- **Supabase is the source of truth**; every row has `user_id → auth.users(id) on delete cascade`, and RLS on every table limits select/insert/update/delete to `auth.uid() = user_id`. Anonymous access is revoked.
- Tables (`supabase/migrations/`): `categories`, `tasks`, `subtasks`, `tags`, `task_tags`, `task_occurrence_overrides` (per-date completion / reschedule of recurring tasks), `class_blocks`. Children reference parents by composite `(id, user_id)` keys so a row can never attach to another user's parent. `updated_at` is set by trigger.
- Enums: `task_status` (`todo`, `in_progress`, `done`), `task_priority` (`low`, `medium`, `high`, `urgent`), `recurrence_kind`, `palette_key`. The client mirrors them in `src/types/model.ts`; ids are UUIDs generated client-side (`crypto.randomUUID()`).
- Tasks (with children) are written atomically through the `save_task(jsonb)` RPC (security invoker, so RLS applies). Categories and class blocks use plain upserts. Mapping between app models and rows lives in `src/sync/mappers.ts`.
- **Offline-first client** (`src/sync/`): each user has an IndexedDB cache (`daybook:<uid>`) the app boots from. Store mutations update state optimistically and write cache + an ordered outbox in one transaction; `SyncEngine` drains the outbox when online, retries transient failures with backoff, and rolls back rejected writes. Pulls, Supabase Realtime (`tasks`, `categories`, `class_blocks`), and BroadcastChannel (same-browser tabs) never overwrite records with pending local writes. Conflicts resolve as last-write-to-reach-the-server wins.
- Auth: `AuthProvider` / `useSession()` (`src/auth/`); `AuthGate` renders nothing but the sign-in screen without a session. The pre-accounts `daybook` IndexedDB (`src/db/schema.ts`) is only read to offer a one-time import.

## Code Guidelines
- Strict TypeScript: no `any`.
- Use named exports rather than default exports.
- Group imports: third-party libraries first, then internal modules.

# CLAUDE.md

This file gives Claude Code persistent context for this project. Read it in full before doing anything else.

## Project Overview

A local-first web app that merges a **calendar** and a **checkable task list** for daily personal/school use. Every task is simultaneously an item in a checkable list and an event on a calendar — both views read/write the same underlying data. Originally local-only (v1); since Phase 1 it has Supabase accounts, a Postgres backend with row-level security, and offline-first sync, with IndexedDB as the local cache.

---

## Required Workflow — Explore, Plan, Implement, Commit

This is a real, non-trivial app. Do not jump straight to writing code. Follow Anthropic's recommended four-phase Claude Code workflow, and apply it both to the initial build and to every significant feature added afterward:

1. **Explore** — Before writing any code, read this file fully, check whether a project already exists in this directory, and state your understanding of the scope. Ask me anything genuinely ambiguous before proceeding. Do not modify files in this phase.
2. **Plan** — Use plan mode. Produce a concrete implementation plan: project scaffold, file/folder structure, the order you'll build features in (data layer → core task CRUD → list view → calendar view → drag/drop → polish), and how you'll verify each piece works. Show me the plan before implementing. I may edit it before you proceed.
3. **Implement** — Build against the plan, in the order specified. After each meaningful chunk (data layer, list view, calendar view, etc.), verify it actually works (run it, check for type errors, sanity-check the UI) before moving to the next chunk rather than writing everything then debugging at the end.
4. **Commit** — Once a chunk is working and verified, commit with a clear, descriptive message. Keep commits scoped (e.g., "Add task data model and IndexedDB persistence," not one giant commit at the end).

Repeat Explore → Plan → Implement → Commit for each major feature, not just once for the whole project.

---

## Tech Stack

- React 18 + TypeScript + Vite
- Tailwind CSS with a **fully custom theme** — do not use Tailwind's default color palette for anything user-facing; extend `theme.colors`, `theme.spacing`, `theme.fontSize`
- Zustand (or Context + useReducer) for state
- date-fns for all date math — never hand-roll date arithmetic
- Dexie.js as the IndexedDB wrapper for persistence
- dnd-kit for drag-and-drop rescheduling on the calendar
- lucide-react for icons
- Framer Motion for the small set of intentional transitions
- vite-plugin-pwa if implementing offline/installable support (nice-to-have)

Build the calendar grid custom rather than pulling in a full calendar library — third-party calendar libraries impose their own visual style that will fight the design system below.

---

## Core Features (Required)

### Task model
Title (required), notes, due date, optional due time, one category, zero-or-more tags, priority (low/medium/high), status (not started/in progress/done), subtasks with their own checkboxes and a progress indicator on the parent, recurrence (none/daily/weekly/custom weekday pattern/monthly), optional reminder time.

### Calendar view
Month, Week, Day, and Agenda sub-views. Tasks render as color-coded chips on their due date (color = category color). Click a date to see/quick-add tasks for that day. Drag a chip to reschedule. Clear "today" marker. Overdue tasks get a deliberate, distinct treatment — not just red text. Days with many tasks overflow gracefully ("+3 more," expandable).

### List view
Flat, checkable list, groupable by date/category/priority. Checking a task off shows an undo toast rather than instantly vanishing it. Filters (category, tag, priority, status, date range) combine with AND logic and are visibly active/clearable. Sort by due date, priority, or created date. Fuzzy search across title/notes/tags. Bulk select → complete/delete/reschedule.

### Categories & color coding
User-creatable/editable/archivable categories, each assigned a color from the curated palette (Design System section below — never a raw color picker). Color is consistent everywhere the task appears. Seed sensible defaults (School, Personal, Work) on first run.

### Today / Dashboard view (default landing screen)
Today's tasks (checkable inline), an Overdue section if any exist, a "next 7 days" glance, and light stats (completed today/this week, current streak).

### Data persistence
Supabase Postgres (per-user, RLS-protected) with a Dexie/IndexedDB cache and outbox for offline use — no data loss on refresh, restart, or going offline. JSON export/import for backup. `.ics` export so tasks can optionally show up in Google/Apple Calendar.

---

## Nice-to-Have Features (in this priority order, implement as time allows)

1. PWA support — installable, offline-capable
2. Weekly class/schedule overlay — recurring fixed blocks (e.g., "Math — MWF 9:00–9:50") shown distinctly from tasks
3. Keyboard shortcuts (`n` new task, `/` search, `e` edit, `Esc` close, `?` shortcut help)
4. Full dark mode, respecting system preference with a manual override
5. Natural-language quick-add ("Essay draft fri 5pm #english" → parsed fields)
6. Browser notifications for reminders, with graceful permission handling
7. Kanban board view (To Do / In Progress / Done) as an alternate to the list
8. Lightweight analytics — tasks completed per category over time

Accounts, sync, and the Supabase backend were added in Phase 1 (see Data Model above). Broader dashboard/Kanban UI changes are reserved for Phase 2.

---

## Design System — non-negotiable

The most common failure mode for AI-built UIs is looking generic and "vibe-coded." Avoid all of the following without exception:

**Never:**
- Glow/halo/highlight behind buttons or icons on hover or focus — use a subtle background tint shift or border change instead
- Rainbow or neon/saturated category colors
- Flat, plain, single-tone backgrounds with no depth
- Mixed icon styles, or emoji used as primary UI icons
- Default unstyled browser form controls (checkboxes, selects)
- Bouncy or exaggerated animation — motion should be 150–250ms,