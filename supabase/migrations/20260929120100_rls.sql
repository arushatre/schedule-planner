-- Row-level security: every table, every command, owner only.
-- (select auth.uid()) is evaluated once per statement instead of once per row.

do $$
declare
  t text;
begin
  foreach t in array array[
    'categories', 'tasks', 'subtasks', 'tags', 'task_tags', 'task_occurrence_overrides', 'class_blocks'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      t || ': select own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      t || ': insert own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated '
      'using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t || ': update own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      t || ': delete own', t);

    -- Anonymous visitors get nothing; signed-in users get CRUD, filtered by the policies above.
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
