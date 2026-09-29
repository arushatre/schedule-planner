-- RLS verification: proves that one user can never read, change, delete, or attach
-- to another user's rows, and that anonymous callers get nothing.
-- Run with `npm run db:test` (supabase test db). Everything rolls back at the end.

begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres, RLS bypassed). A = 1111…, B = 2222…
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'a@rls.test', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@rls.test', 'authenticated', 'authenticated');

insert into public.categories (id, user_id, name, color_key) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'A school', 'slate'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'B school', 'moss');

insert into public.tasks (id, user_id, category_id, title) values
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0000-0000-0000-000000000001', 'A task'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
   'bbbbbbbb-0000-0000-0000-000000000001', 'B task');

insert into public.subtasks (id, task_id, user_id, title) values
  ('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002',
   '11111111-1111-1111-1111-111111111111', 'A subtask');

insert into public.tags (id, user_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'english'),
  ('bbbbbbbb-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'history');

insert into public.task_tags (task_id, tag_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000004',
   '11111111-1111-1111-1111-111111111111');

insert into public.task_occurrence_overrides (task_id, user_id, occurrence_date, completed) values
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '2026-10-01', true);

insert into public.class_blocks (id, user_id, title, weekdays, start_time, end_time) values
  ('aaaaaaaa-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111',
   'Math', '{1,3,5}', '09:00', '09:50');

-- ---------------------------------------------------------------------------
-- As user B: none of A's rows are visible
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is((select count(*)::int from public.categories where user_id = '11111111-1111-1111-1111-111111111111'), 0, 'B cannot read A categories');
select is((select count(*)::int from public.tasks where user_id = '11111111-1111-1111-1111-111111111111'), 0, 'B cannot read A tasks');
select is((select count(*)::int from public.subtasks where user_id = '11111111-1111-1111-1111-111111111111'), 0, 'B cannot read A subtasks');
select is((select count(*)::int from public.tags where user_id = '11111111-1111-1111-1111-111111111111'), 0, 'B cannot read A tags');
select is((select count(*)::int from public.task_tags where user_id = '11111111-1111-1111-1111-111111111111'), 0, 'B cannot read A task_tags');
select is((select count(*)::int from public.task_occurrence_overrides where user_id = '11111111-1111-1111-1111-111111111111'), 0, 'B cannot read A overrides');
select is((select count(*)::int from public.class_blocks where user_id = '11111111-1111-1111-1111-111111111111'), 0, 'B cannot read A class blocks');
select is((select count(*)::int from public.tasks), 1, 'B sees exactly their own task');

-- Updates and deletes of A's rows silently match nothing
select is_empty($$ update public.tasks set title = 'pwned' where id = 'aaaaaaaa-0000-0000-0000-000000000002' returning id $$, 'B cannot update A task');
select is_empty($$ delete from public.tasks where id = 'aaaaaaaa-0000-0000-0000-000000000002' returning id $$, 'B cannot delete A task');
select is_empty($$ update public.subtasks set done = true where id = 'aaaaaaaa-0000-0000-0000-000000000003' returning id $$, 'B cannot update A subtask');
select is_empty($$ delete from public.categories where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning id $$, 'B cannot delete A category');

-- Writing rows owned by A, or attaching to A's parents, is rejected
select throws_ok($$ insert into public.tasks (user_id, title) values ('11111111-1111-1111-1111-111111111111', 'forged') $$,
  '42501', null, 'B cannot insert a task owned by A');
select throws_ok($$ insert into public.subtasks (task_id, user_id, title) values
  ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'sneaky') $$,
  '23503', null, 'B cannot attach a subtask to A task');
select throws_ok($$ insert into public.task_tags (task_id, tag_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222') $$,
  '23503', null, 'B cannot put their tag on A task');
select throws_ok($$ insert into public.task_tags (task_id, tag_id, user_id) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222') $$,
  '23503', null, 'B cannot use A tag on their own task');
select throws_ok($$ insert into public.task_occurrence_overrides (task_id, user_id, occurrence_date, completed) values
  ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '2026-10-02', true) $$,
  '23503', null, 'B cannot add an override to A task');
select throws_ok($$ update public.tasks set user_id = '11111111-1111-1111-1111-111111111111'
  where id = 'bbbbbbbb-0000-0000-0000-000000000002' $$,
  '42501', null, 'B cannot hand their task to A');
select throws_ok($$ insert into public.tasks (title, category_id) values ('uses A category', 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  '23503', null, 'B cannot use A category');
select throws_ok($$ select public.save_task('{"id":"aaaaaaaa-0000-0000-0000-000000000002","title":"hijack"}'::jsonb) $$,
  '42501', null, 'B cannot overwrite A task through save_task');
select throws_ok($$ insert into public.tags (user_id, name) values ('11111111-1111-1111-1111-111111111111', 'forged') $$,
  '42501', null, 'B cannot insert a tag owned by A');
select throws_ok($$ insert into public.class_blocks (user_id, title, weekdays, start_time, end_time) values
  ('11111111-1111-1111-1111-111111111111', 'forged', '{1}', '10:00', '11:00') $$,
  '42501', null, 'B cannot insert a class block owned by A');

-- save_task works for B's own data and normalizes children
select lives_ok($$ select public.save_task('{
  "id": "bbbbbbbb-0000-0000-0000-000000000009",
  "title": "Essay draft",
  "status": "in_progress",
  "priority": "urgent",
  "subtasks": [
    {"id": "bbbbbbbb-0000-0000-0000-00000000000a", "title": "Outline", "done": true},
    {"id": "bbbbbbbb-0000-0000-0000-00000000000b", "title": "Write"}
  ],
  "tags": ["School", "school", "english"],
  "overrides": []
}'::jsonb) $$, 'B can save their own task aggregate');
select is((select count(*)::int from public.subtasks where task_id = 'bbbbbbbb-0000-0000-0000-000000000009'), 2, 'save_task wrote subtasks');
select is((select count(*)::int from public.task_tags where task_id = 'bbbbbbbb-0000-0000-0000-000000000009'), 2, 'save_task de-duplicates tags case-insensitively');

-- ---------------------------------------------------------------------------
-- As user A: data is intact and B's rows are invisible
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is((select title from public.tasks where id = 'aaaaaaaa-0000-0000-0000-000000000002'), 'A task', 'A task survived B''s attempts');
select is((select count(*)::int from public.subtasks), 1, 'A still has their subtask');
select is((select count(*)::int from public.tasks where user_id = '22222222-2222-2222-2222-222222222222'), 0, 'A cannot read B tasks');

-- ---------------------------------------------------------------------------
-- Anonymous: no access to anything
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select throws_ok('select * from public.categories', '42501', null, 'anon cannot read categories');
select throws_ok('select * from public.tasks', '42501', null, 'anon cannot read tasks');
select throws_ok('select * from public.subtasks', '42501', null, 'anon cannot read subtasks');
select throws_ok('select * from public.tags', '42501', null, 'anon cannot read tags');
select throws_ok('select * from public.task_tags', '42501', null, 'anon cannot read task_tags');
select throws_ok('select * from public.task_occurrence_overrides', '42501', null, 'anon cannot read overrides');
select throws_ok('select * from public.class_blocks', '42501', null, 'anon cannot read class blocks');
select throws_ok($$ select public.save_task('{}'::jsonb) $$, '42501', null, 'anon cannot call save_task');

-- ---------------------------------------------------------------------------
-- Schema hygiene (as postgres)
-- ---------------------------------------------------------------------------
reset role;

select throws_ok($$ insert into public.tasks (user_id, title, status) values ('22222222-2222-2222-2222-222222222222', 'x', 'not_started') $$,
  '22P02', null, 'status enum rejects unknown values');
select throws_ok($$ insert into public.tasks (user_id, title) values ('22222222-2222-2222-2222-222222222222', '   ') $$,
  '23514', null, 'blank titles are rejected');
select throws_ok($$ insert into public.tasks (user_id, title, recurrence_weekdays) values ('22222222-2222-2222-2222-222222222222', 'x', '{7}') $$,
  '23514', null, 'weekdays outside 0-6 are rejected');
select throws_ok($$ insert into public.class_blocks (user_id, title, weekdays, start_time, end_time) values
  ('22222222-2222-2222-2222-222222222222', 'x', '{1}', '10:00', '09:00') $$,
  '23514', null, 'class blocks must end after they start');

update public.tasks set updated_at = '2000-01-01' where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select ok((select updated_at > '2000-01-01' from public.tasks where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  'updated_at is maintained by trigger');

-- Cascades
delete from public.categories where id = 'bbbbbbbb-0000-0000-0000-000000000001';
select is((select category_id from public.tasks where id = 'bbbbbbbb-0000-0000-0000-000000000002'), null,
  'deleting a category keeps its tasks and clears category_id');

delete from public.tasks where id = 'aaaaaaaa-0000-0000-0000-000000000002';
select is((select count(*)::int from public.subtasks where user_id = '11111111-1111-1111-1111-111111111111'), 0,
  'deleting a task cascades to subtasks');
select is((select count(*)::int from public.task_occurrence_overrides where user_id = '11111111-1111-1111-1111-111111111111')
  + (select count(*)::int from public.task_tags where user_id = '11111111-1111-1111-1111-111111111111'), 0,
  'deleting a task cascades to overrides and task_tags');

delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.categories where user_id = '11111111-1111-1111-1111-111111111111')
  + (select count(*)::int from public.tags where user_id = '11111111-1111-1111-1111-111111111111')
  + (select count(*)::int from public.class_blocks where user_id = '11111111-1111-1111-1111-111111111111'), 0,
  'deleting a user removes everything they own');

select * from finish();
rollback;
