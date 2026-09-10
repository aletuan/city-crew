-- reports, as a client sees them: anybody signed in may file one about
-- somebody else, twenty a day at most — and after that nobody but the
-- desk can see it. Not the person it names, and not the person who filed
-- it either: a readable queue would answer "who reported me".
--
-- Exercised, not read off pg_policy. `rls_client` sits at the table as the
-- reporter, the reported, a stranger, a signed-out caller and an editor.

grant usage on schema public to rls_client;
grant select, insert, update, delete on public.reports to rls_client;

-- Accounts of its own, removed at the end: the reporter, the curator whose
-- list is reported, and the desk.
insert into auth.users (id, email, raw_user_meta_data) values
 ('d1000000-0000-0000-0000-00000000000a', 'reporter@x.com', '{"handle":"reporter"}'),
 ('d1000000-0000-0000-0000-00000000000b', 'curator@x.com',  '{"handle":"curator","full_name":"Curator"}'),
 ('d1000000-0000-0000-0000-00000000000e', 'desk@x.com',     '{"handle":"deskreports"}');
insert into public.collections (id, slug, owner_id, is_public, title_en, desc_en) values
 ('d1000000-0000-0000-0000-0000000000c1', 'reported-list', 'd1000000-0000-0000-0000-00000000000b', true,
  'A list somebody objected to', 'The words the desk has to judge');

-- ── filing ───────────────────────────────────────────────────────────
do $$
begin
  set local role rls_client;
  set local test.uid = 'd1000000-0000-0000-0000-00000000000a';
  insert into public.reports (reporter, kind, target_id, reason)
  values ('d1000000-0000-0000-0000-00000000000a', 'collection', 'd1000000-0000-0000-0000-0000000000c1', 'offensive');
  reset role;
end $$;

do $$
declare n int;
begin
  select count(*) into n from public.reports where reporter = 'd1000000-0000-0000-0000-00000000000a';
  assert n = 1, format('a reader could not file a report (%s rows)', n);
end $$;

-- Not in somebody else's name, not pre-marked as handled, not about
-- yourself, and not signed out. Each of these is refused outright.
do $$
declare refused int := 0;
begin
  set local role rls_client;
  set local test.uid = 'd1000000-0000-0000-0000-00000000000a';
  begin
    insert into public.reports (reporter, kind, target_id, reason)
    values ('d1000000-0000-0000-0000-00000000000b', 'collection', 'd1000000-0000-0000-0000-0000000000c1', 'spam');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  begin
    insert into public.reports (reporter, kind, target_id, reason, status)
    values ('d1000000-0000-0000-0000-00000000000a', 'collection', 'd1000000-0000-0000-0000-0000000000c1', 'spam', 'dismissed');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  begin
    insert into public.reports (reporter, kind, target_id, reason)
    values ('d1000000-0000-0000-0000-00000000000a', 'profile', 'd1000000-0000-0000-0000-00000000000a', 'other');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  reset role;

  set local role rls_client;
  set local test.uid = '';
  begin
    insert into public.reports (reporter, kind, target_id, reason)
    values (null, 'collection', 'd1000000-0000-0000-0000-0000000000c1', 'spam');
  exception when insufficient_privilege then refused := refused + 1;
  end;
  reset role;

  assert refused = 4, format('%s of 4 improper reports were refused', refused);
end $$;

-- Twenty a day. The one above is the first; nineteen more go through and
-- the twenty-first does not.
do $$
declare refused bool := false;
begin
  set local role rls_client;
  set local test.uid = 'd1000000-0000-0000-0000-00000000000a';
  for i in 1..19 loop
    insert into public.reports (reporter, kind, target_id, reason)
    values ('d1000000-0000-0000-0000-00000000000a', 'profile', 'd1000000-0000-0000-0000-00000000000b', 'spam');
  end loop;
  begin
    insert into public.reports (reporter, kind, target_id, reason)
    values ('d1000000-0000-0000-0000-00000000000a', 'profile', 'd1000000-0000-0000-0000-00000000000b', 'spam');
  exception when insufficient_privilege then refused := true;
  end;
  reset role;
  assert refused, 'a twenty-first report inside a day was accepted';
end $$;

-- A day later the window has moved on. Aged by the table's owner, which
-- is the only way a test can make yesterday.
update public.reports set created_at = now() - interval '25 hours'
 where reporter = 'd1000000-0000-0000-0000-00000000000a';
do $$
begin
  set local role rls_client;
  set local test.uid = 'd1000000-0000-0000-0000-00000000000a';
  insert into public.reports (reporter, kind, target_id, reason)
  values ('d1000000-0000-0000-0000-00000000000a', 'profile', 'd1000000-0000-0000-0000-00000000000b', 'spam');
  reset role;
end $$;

-- ── reading ──────────────────────────────────────────────────────────
-- Filed is gone, as far as the reporter is concerned; the person named
-- never sees it; nor does anybody signed out.
do $$
declare by_reporter int; by_reported int; by_nobody int;
begin
  set local role rls_client;
  set local test.uid = 'd1000000-0000-0000-0000-00000000000a';
  select count(*) into by_reporter from public.reports;
  reset role;

  set local role rls_client;
  set local test.uid = 'd1000000-0000-0000-0000-00000000000b';
  select count(*) into by_reported from public.reports;
  reset role;

  set local role rls_client;
  set local test.uid = '';
  select count(*) into by_nobody from public.reports;
  reset role;

  assert by_reporter = 0, format('the reporter reads %s reports back', by_reporter);
  assert by_reported = 0, format('the reported person reads %s reports', by_reported);
  assert by_nobody = 0, format('a signed-out caller reads %s reports', by_nobody);
end $$;

-- The queue function is the desk's window, and it is editor-gated inside
-- the body as well as by grant: a definer function would otherwise lend
-- its reach to anybody who could call it.
do $$
declare n int;
begin
  set local role rls_client;
  set local test.uid = 'd1000000-0000-0000-0000-00000000000b';
  set local test.jwt = '{"email": "curator@x.com"}';
  select count(*) into n from public.reports_queue();
  reset role;
  assert n = 0, format('a non-editor read %s rows out of the report queue', n);
end $$;

-- The count the cap reads is the caller's own and nobody else's: the
-- reported curator, who filed nothing, is told zero.
do $$
declare mine int; theirs int;
begin
  set local role rls_client;
  set local test.uid = 'd1000000-0000-0000-0000-00000000000a';
  select public.my_reports_today() into mine;
  reset role;
  set local role rls_client;
  set local test.uid = 'd1000000-0000-0000-0000-00000000000b';
  select public.my_reports_today() into theirs;
  reset role;
  assert mine = 1, format('the reporter is told %s reports today, not 1', mine);
  assert theirs = 0, format('somebody who filed nothing is told %s', theirs);
end $$;

-- ── handling ─────────────────────────────────────────────────────────
-- Nobody but the desk marks a report done.
do $$
declare n int;
begin
  set local role rls_client;
  set local test.uid = 'd1000000-0000-0000-0000-00000000000a';
  with u as (update public.reports set status = 'dismissed' returning 1) select count(*) into n from u;
  reset role;
  assert n = 0, format('a reader dismissed %s reports', n);
end $$;

do $$
declare seen int; handled int; title text;
begin
  set local role rls_client;
  set local test.uid = 'd1000000-0000-0000-0000-00000000000e';
  set local test.jwt = '{"email": "anhlt1983@gmail.com"}';
  select count(*) into seen from public.reports;
  select q.title into title from public.reports_queue() q where q.kind = 'collection';
  with u as (
    update public.reports set status = 'actioned', handled_at = now(),
           handled_by = 'd1000000-0000-0000-0000-00000000000e'
     where kind = 'collection' returning 1
  ) select count(*) into handled from u;
  reset role;
  assert seen = 21, format('the desk sees %s of 21 reports', seen);
  assert title = 'A list somebody objected to', format('the queue showed the desk %L as the reported words', title);
  assert handled = 1, 'the desk could not mark a report handled';
end $$;

-- ── outliving the people in it ───────────────────────────────────────
-- A report is about the content. The reporter leaving must not take the
-- record with them, and neither must the thing it accuses being removed.
delete from public.collections where id = 'd1000000-0000-0000-0000-0000000000c1';
delete from auth.users where id = 'd1000000-0000-0000-0000-00000000000a';
do $$
declare n int; anon int;
begin
  select count(*), count(*) filter (where reporter is null) into n, anon
    from public.reports where target_id in ('d1000000-0000-0000-0000-0000000000c1', 'd1000000-0000-0000-0000-00000000000b');
  assert n = 21, format('%s of 21 reports survived the reporter leaving', n);
  assert anon = 21, 'a report still names a reporter who has left';
end $$;

-- Leave nothing behind for the files after this one.
delete from public.reports where target_id in ('d1000000-0000-0000-0000-0000000000c1', 'd1000000-0000-0000-0000-00000000000b');
delete from auth.users where id in ('d1000000-0000-0000-0000-00000000000b', 'd1000000-0000-0000-0000-00000000000e');

select 'all report checks passed' as result;
