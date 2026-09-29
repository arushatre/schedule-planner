-- Realtime: clients subscribe to the parent tables only. Children (subtasks, tags,
-- task_tags, occurrence overrides) are only ever written through save_task(), which
-- always touches the parent task row, so a task change event means "refetch this task".
-- Postgres Changes enforce RLS on these events; DELETE events carry only primary keys.

alter publication supabase_realtime add table public.tasks, public.categories, public.class_blocks;
