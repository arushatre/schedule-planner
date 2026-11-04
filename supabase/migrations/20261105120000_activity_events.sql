-- Activity log behind the streak history: one row whenever the user does something in the app
-- (add, edit, check off, delete). Times are UTC; clients group them into local days on read,
-- so changing what counts as "activity" later never needs a migration.
-- Rows are insert-only. The client generates the id, so a retried insert is a no-op.

create table public.activity_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  at          timestamptz not null,
  kind        text not null check (char_length(kind) between 1 and 40),
  created_at  timestamptz not null default now()
);

create index activity_events_user_at_idx on public.activity_events (user_id, at);

alter table public.activity_events enable row level security;

create policy "activity_events: select own" on public.activity_events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "activity_events: insert own" on public.activity_events
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "activity_events: delete own" on public.activity_events
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.activity_events from anon;
grant select, insert, delete on public.activity_events to authenticated;
