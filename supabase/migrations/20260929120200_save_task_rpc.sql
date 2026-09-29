-- Saves a task and all of its children in one transaction so a dropped connection
-- can never leave a half-synced task. JSON is only the wire format; every value is
-- written to the normalized tables. SECURITY INVOKER: RLS applies to every statement,
-- and user_id always comes from auth.uid(), never from the payload.
--
-- Payload:
-- { id, category_id, title, notes, due_date, due_time, priority, status,
--   recurrence_kind, recurrence_weekdays, recurrence_until, reminder_time,
--   completed_at, created_at,
--   subtasks:  [{ id, title, done }],          -- array order is the display order
--   tags:      [text],
--   overrides: [{ occurrence_date, completed, moved_to }] }

create function public.save_task(p jsonb)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_task_id uuid := (p ->> 'id')::uuid;
  v_subtasks jsonb := coalesce(p -> 'subtasks', '[]'::jsonb);
  v_tags jsonb := coalesce(p -> 'tags', '[]'::jsonb);
  v_overrides jsonb := coalesce(p -> 'overrides', '[]'::jsonb);
  v_saved_at timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if v_task_id is null then
    raise exception 'task id is required' using errcode = '22023';
  end if;

  -- If the id belongs to another user, ON CONFLICT DO UPDATE fails the update
  -- policy and raises 42501 instead of touching their row.
  insert into public.tasks as t (
    id, user_id, category_id, title, notes, due_date, due_time, priority, status,
    recurrence_kind, recurrence_weekdays, recurrence_until, reminder_time, completed_at, created_at
  )
  values (
    v_task_id,
    v_uid,
    (p ->> 'category_id')::uuid,
    p ->> 'title',
    coalesce(p ->> 'notes', ''),
    (p ->> 'due_date')::date,
    (p ->> 'due_time')::time,
    coalesce((p ->> 'priority')::public.task_priority, 'medium'),
    coalesce((p ->> 'status')::public.task_status, 'todo'),
    coalesce((p ->> 'recurrence_kind')::public.recurrence_kind, 'none'),
    array(select jsonb_array_elements_text(coalesce(p -> 'recurrence_weekdays', '[]'::jsonb))::smallint),
    (p ->> 'recurrence_until')::date,
    (p ->> 'reminder_time')::time,
    (p ->> 'completed_at')::timestamptz,
    coalesce((p ->> 'created_at')::timestamptz, now())
  )
  on conflict (id) do update set
    category_id         = excluded.category_id,
    title               = excluded.title,
    notes               = excluded.notes,
    due_date            = excluded.due_date,
    due_time            = excluded.due_time,
    priority            = excluded.priority,
    status              = excluded.status,
    recurrence_kind     = excluded.recurrence_kind,
    recurrence_weekdays = excluded.recurrence_weekdays,
    recurrence_until    = excluded.recurrence_until,
    reminder_time       = excluded.reminder_time,
    completed_at        = excluded.completed_at
  returning t.updated_at into v_saved_at;

  -- Subtasks: drop the ones no longer present, upsert the rest in order.
  delete from public.subtasks s
  where s.task_id = v_task_id
    and s.id not in (select (e ->> 'id')::uuid from jsonb_array_elements(v_subtasks) as x(e));

  insert into public.subtasks as s (id, task_id, user_id, title, done, position)
  select (x.e ->> 'id')::uuid, v_task_id, v_uid, x.e ->> 'title',
         coalesce((x.e ->> 'done')::boolean, false), (x.ord - 1)::integer
  from jsonb_array_elements(v_subtasks) with ordinality as x(e, ord)
  on conflict (id) do update set
    title    = excluded.title,
    done     = excluded.done,
    position = excluded.position
  where s.task_id = excluded.task_id;

  -- Tags: create missing ones (case-insensitive), then replace this task's links.
  insert into public.tags (user_id, name)
  select distinct on (lower(btrim(n.name))) v_uid, btrim(n.name)
  from jsonb_array_elements_text(v_tags) as n(name)
  where btrim(n.name) <> ''
  on conflict (user_id, lower(name)) do nothing;

  delete from public.task_tags tt where tt.task_id = v_task_id;

  insert into public.task_tags (task_id, tag_id, user_id)
  select distinct v_task_id, tg.id, v_uid
  from jsonb_array_elements_text(v_tags) as n(name)
  join public.tags tg on tg.user_id = v_uid and lower(tg.name) = lower(btrim(n.name));

  -- Occurrence overrides are small and keyed by date, so replace them wholesale.
  delete from public.task_occurrence_overrides o where o.task_id = v_task_id;

  insert into public.task_occurrence_overrides (task_id, user_id, occurrence_date, completed, moved_to)
  select v_task_id, v_uid, (e ->> 'occurrence_date')::date,
         coalesce((e ->> 'completed')::boolean, false), (e ->> 'moved_to')::date
  from jsonb_array_elements(v_overrides) as x(e);

  return v_saved_at;
end;
$$;

revoke execute on function public.save_task(jsonb) from public, anon;
grant execute on function public.save_task(jsonb) to authenticated;
