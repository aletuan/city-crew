-- Who answered a report (20261121110000): the database names whoever
-- moved it out of 'new', whatever the desk's update sent; putting it back
-- to 'new' clears the answer; an update that leaves the status alone
-- leaves the answer alone. And the backfill copies a removal's editor
-- from the log, and nothing for a dismissal.
--
--   …0c  the reporter
--   …0e  the desk
--   …0f  somebody else, whose id the desk's update claims

grant usage on schema public to rls_client;
-- The trigger reads `auth.uid()` as the updater, as `authenticated` may.
grant usage on schema auth to rls_client;

insert into auth.users (id, email, raw_user_meta_data) values
 ('d1e00000-0000-0000-0000-00000000000c', 'rh-c@x.com', '{"handle":"rhreporter"}'),
 ('d1e00000-0000-0000-0000-00000000000e', 'anhlt1983@gmail.com', '{"handle":"rhdesk"}'),
 ('d1e00000-0000-0000-0000-00000000000f', 'rh-f@x.com', '{"handle":"rhother"}')
on conflict (id) do nothing;
delete from public.reports;
insert into public.reports (id, reporter, kind, target_id, reason) values
 ('d1e00000-0000-0000-0000-0000000000d1', 'd1e00000-0000-0000-0000-00000000000c', 'comment', 'd1e00000-0000-0000-0000-0000000000a1', 'spam'),
 ('d1e00000-0000-0000-0000-0000000000d2', 'd1e00000-0000-0000-0000-00000000000c', 'comment', 'd1e00000-0000-0000-0000-0000000000a2', 'spam');

-- ── the desk answers: its own name goes on the row, not the one it sent ──
do $$
declare r record;
begin
  set local role rls_client;
  set local test.uid = 'd1e00000-0000-0000-0000-00000000000e';
  set local test.jwt = '{"email": "anhlt1983@gmail.com"}';
  -- What `markReport` sends, plus a forged handler and a time from 2020.
  update public.reports
     set status = 'dismissed', handled_at = '2020-01-01',
         handled_by = 'd1e00000-0000-0000-0000-00000000000f'
   where id = 'd1e00000-0000-0000-0000-0000000000d1';
  reset role;
  select * into r from public.reports where id = 'd1e00000-0000-0000-0000-0000000000d1';
  assert r.status = 'dismissed', format('status %s', r.status);
  assert r.handled_by = 'd1e00000-0000-0000-0000-00000000000e',
    format('the answer names %s, not the desk', r.handled_by);
  assert r.handled_at > now() - interval '1 minute',
    format('the answer is dated %s', r.handled_at);
end $$;

-- ── an update that leaves the status alone leaves the answer alone ──
do $$
declare before_at timestamptz; r record;
begin
  select handled_at into before_at from public.reports where id = 'd1e00000-0000-0000-0000-0000000000d1';
  set local role rls_client;
  set local test.uid = 'd1e00000-0000-0000-0000-00000000000e';
  set local test.jwt = '{"email": "anhlt1983@gmail.com"}';
  update public.reports set note = 'looked again' where id = 'd1e00000-0000-0000-0000-0000000000d1';
  reset role;
  select * into r from public.reports where id = 'd1e00000-0000-0000-0000-0000000000d1';
  assert r.handled_by = 'd1e00000-0000-0000-0000-00000000000e' and r.handled_at = before_at,
    format('a note moved the answer to %s at %s', r.handled_by, r.handled_at);
end $$;

-- ── back to 'new': unanswered again ──
do $$
declare r record;
begin
  update public.reports set status = 'new' where id = 'd1e00000-0000-0000-0000-0000000000d1';
  select * into r from public.reports where id = 'd1e00000-0000-0000-0000-0000000000d1';
  assert r.handled_by is null and r.handled_at is null,
    format('a reopened report still says %s at %s', r.handled_by, r.handled_at);
end $$;

-- ── the backfill: a removal's editor from the log; a dismissal, nobody ──
do $$
declare r record;
begin
  alter table public.reports disable trigger reports_set_handler;
  update public.reports set status = 'actioned', handled_at = now(), handled_by = null
   where id = 'd1e00000-0000-0000-0000-0000000000d2';
  update public.reports set status = 'dismissed', handled_at = now(), handled_by = null
   where id = 'd1e00000-0000-0000-0000-0000000000d1';
  alter table public.reports enable trigger reports_set_handler;
  delete from public.moderation_log;
  insert into public.moderation_log (actor, actor_email, action, target_id, created_at) values
   ('d1e00000-0000-0000-0000-00000000000e', 'anhlt1983@gmail.com', 'remove_comment',
    'd1e00000-0000-0000-0000-0000000000a2', now()),
   -- Another target's line, at the same moment: not this report's.
   ('d1e00000-0000-0000-0000-00000000000f', 'rh-f@x.com', 'remove_comment',
    'd1e00000-0000-0000-0000-0000000000a1', now());
end $$;
