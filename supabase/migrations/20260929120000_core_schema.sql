-- Core schema: every row belongs to exactly one auth user via user_id.
-- Child tables reference their parent through a composite (id, user_id) key so a
-- row can never point at a parent owned by someone else (FK checks bypass RLS).

create type public.task_status as enum ('todo', 'in_progress', 'done');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.recurrence_kind as enum ('none', 'daily', 'weekly', 'weekdays', 'monthly');
create type public.palette_key as enum ('clay', 'moss', 'slate', 'plum', 'ochre', 'teal', 'rose', 'graphite');

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  color_key   public.palette_key not null default 'graphite',
  archived    boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)
);

create table public.tasks (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id         uuid,
  title               text not null check (char_length(btrim(title)) between 1 and 500),
  notes               text not null default '',
  due_date            date,
  due_time            time,
  priority            public.task_priority not null default 'medium',
  status              public.task_status not null default 'todo',
  recurrence_kind     public.recurrence_kind not null default 'none',
  recurrence_weekdays smallint[] not null default '{}' check (recurrence_weekdays <@ '{0,1,2,3,4,5,6}'),
  recurrence_until    date,
  reminder_time       time,
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, user_id),
  -- Deleting a category only clears category_id; user_id is left intact.
  foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete set null (category_id)
);

create table public.subtasks (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 500),
  done        boolean not null default false,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade
);

create table public.tags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)
);
create unique index tags_user_name_key on public.tags (user_id, lower(name));

create table public.task_tags (
  task_id     uuid not null,
  tag_id      uuid not null,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (task_id, tag_id),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade,
  foreign key (tag_id, user_id) references public.tags (id, user_id) on delete cascade
);

-- Per-occurrence state for recurring tasks: completion and single-occurrence reschedules.
create table public.task_occurrence_overrides (
  task_id          uuid not null,
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  occurrence_date  date not null,
  completed        boolean not null default false,
  moved_to         date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (task_id, occurrence_date),
  check (completed or moved_to is not null),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade
);

create table public.class_blocks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  location    text not null default '',
  weekdays    smallint[] not null check (cardinality(weekdays) > 0 and weekdays <@ '{0,1,2,3,4,5,6}'),
  start_time  time not null,
  end_time    time not null,
  color_key   public.palette_key not null default 'slate',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (end_time > start_time)
);

create index tasks_user_status_due_idx on public.tasks (user_id, status, due_date);
create index tasks_user_updated_idx on public.tasks (user_id, updated_at);
create index tasks_category_idx on public.tasks (category_id);
create index subtasks_task_idx on public.subtasks (task_id, position);
create index task_tags_tag_idx on public.task_tags (tag_id);
create index categories_user_idx on public.categories (user_id, sort_order);
create index class_blocks_user_idx on public.class_blocks (user_id);

create trigger set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.subtasks
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.tags
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.task_occurrence_overrides
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.class_blocks
  for each row execute function public.set_updated_at();
