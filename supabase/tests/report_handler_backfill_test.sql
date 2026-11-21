-- The second half of report_handler_test.sql, after the migration ran a
-- second time over the rows that file left: the removal's report names
-- the editor in its target's log line; the dismissal names nobody, though
-- a line for its target exists, because a dismissal is never in the log.
do $$
declare r record;
begin
  select * into r from public.reports where id = 'd1e00000-0000-0000-0000-0000000000d2';
  assert r.handled_by = 'd1e00000-0000-0000-0000-00000000000e',
    format('the removal''s report names %s', r.handled_by);
  select * into r from public.reports where id = 'd1e00000-0000-0000-0000-0000000000d1';
  assert r.handled_by is null, format('a dismissal was given %s from the log', r.handled_by);
end $$;
