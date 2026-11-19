-- A reported comment at the desk (20261119100000): the queue shows the
-- desk the words, the list they are on and who wrote them, and the
-- desk's removal leaves a line in the log — once, without the words,
-- and only for an editor.
--
--   …0a  the writer of the comments
--   …0b  the owner of the list (and a profile somebody reported)
--   …0c  the reporter
--   …0e  the desk
--
--   k1   a comment with an answer under it (k2): removed, both go
--   k3   a comment nobody answered

grant usage on schema public to rls_client;

insert into auth.users (id, email, raw_user_meta_data) values
 ('c8e00000-0000-0000-0000-00000000000a', 'c8-a@x.com', '{"handle":"c8writer"}'),
 ('c8e00000-0000-0000-0000-00000000000b', 'c8-b@x.com', '{"handle":"c8owner","full_name":"Owner Eight","bio":"a bio"}'),
 ('c8e00000-0000-0000-0000-00000000000c', 'c8-c@x.com', '{"handle":"c8reporter"}'),
 ('c8e00000-0000-0000-0000-00000000000e', 'anhlt1983@gmail.com', '{"handle":"c8desk"}');
insert into public.collections (id, slug, owner_id, title_en, desc_en) values
 ('c8e00000-0000-0000-0000-0000000000c1', 'c8-list', 'c8e00000-0000-0000-0000-00000000000b', 'Coffee in Hoi An', 'About the list');
update public.collections set is_public = true where id = 'c8e00000-0000-0000-0000-0000000000c1';
insert into public.comments (id, author, collection_id, parent_id, body, created_at) values
 ('c8e00000-0000-0000-0000-0000000000a1', 'c8e00000-0000-0000-0000-00000000000a', 'c8e00000-0000-0000-0000-0000000000c1', null, 'buy followers here', '2026-11-01'),
 ('c8e00000-0000-0000-0000-0000000000a2', 'c8e00000-0000-0000-0000-00000000000b', 'c8e00000-0000-0000-0000-0000000000c1', 'c8e00000-0000-0000-0000-0000000000a1', 'please stop', '2026-11-02'),
 ('c8e00000-0000-0000-0000-0000000000a3', 'c8e00000-0000-0000-0000-00000000000a', 'c8e00000-0000-0000-0000-0000000000c1', null, 'and here too', '2026-11-03');
delete from public.reports;
delete from public.moderation_log;
insert into public.reports (id, reporter, kind, target_id, reason, created_at) values
 ('c8e00000-0000-0000-0000-0000000000d1', 'c8e00000-0000-0000-0000-00000000000c', 'comment',    'c8e00000-0000-0000-0000-0000000000a1', 'spam',  '2026-11-04'),
 ('c8e00000-0000-0000-0000-0000000000d2', 'c8e00000-0000-0000-0000-00000000000c', 'comment',    'c8e00000-0000-0000-0000-0000000000a3', 'spam',  '2026-11-05'),
 ('c8e00000-0000-0000-0000-0000000000d3', 'c8e00000-0000-0000-0000-00000000000c', 'collection', 'c8e00000-0000-0000-0000-0000000000c1', 'other', '2026-11-06'),
 ('c8e00000-0000-0000-0000-0000000000d4', 'c8e00000-0000-0000-0000-00000000000c', 'profile',    'c8e00000-0000-0000-0000-00000000000b', 'other', '2026-11-07');

-- What the queue says of each report, oldest first:
-- "kind|title|body|handle|owner", with ∅ for a null.
create function public._c8_queue(as_desk boolean) returns text
language plpgsql set search_path = public as $$
declare got text;
begin
  set local role rls_client;
  if as_desk then
    perform set_config('test.uid', 'c8e00000-0000-0000-0000-00000000000e', true);
    perform set_config('test.jwt', '{"email": "anhlt1983@gmail.com"}', true);
  else
    perform set_config('test.uid', 'c8e00000-0000-0000-0000-00000000000a', true);
    perform set_config('test.jwt', '{"email": "c8-a@x.com"}', true);
  end if;
  select string_agg(
           concat_ws('|', q.kind, coalesce(q.title, '∅'), coalesce(q.body, '∅'), coalesce(q.owner_handle, '∅'),
                     coalesce(right(q.owner_id::text, 1), '∅')),
           E'\n' order by q.created_at)
    into got from public.reports_queue() q;
  reset role;
  return got;
end $$;

-- ── the queue: a comment with its words, its list and its writer ──
do $$
declare got text;
begin
  got := public._c8_queue(true);
  assert got = E'comment|Coffee in Hoi An|buy followers here|c8writer|a\n'
            || E'comment|Coffee in Hoi An|and here too|c8writer|a\n'
            || E'collection|Coffee in Hoi An|About the list|c8owner|b\n'
            || 'profile|Owner Eight|a bio|c8owner|b',
    format('the queue said: %s', got);
  -- And still nothing to anybody else.
  got := public._c8_queue(false);
  assert got is null, format('a writer read the queue: %s', got);
end $$;

-- ── removing: the desk's alone ──
do $$
declare n int;
begin
  -- As the comment's own writer, whom `delete_comment` would let
  -- through: only the desk's own check stands between them and a line
  -- in the log under their name.
  set local role rls_client;
  set local test.uid = 'c8e00000-0000-0000-0000-00000000000a';
  set local test.jwt = '{"email": "c8-a@x.com"}';
  begin
    perform public.moderate_comment('c8e00000-0000-0000-0000-0000000000a3');
    assert false, 'a writer removed a comment as the desk';
  exception when raise_exception then null;
  end;
  reset role;
  select count(*) into n from public.comments where id = 'c8e00000-0000-0000-0000-0000000000a3';
  assert n = 1, 'a refused removal took the comment';
  select count(*) into n from public.moderation_log;
  assert n = 0, 'a refused removal was logged';
end $$;

-- ── removed: gone with its answers, and one line each, without the words ──
do $$
declare n int; r record;
begin
  set local role rls_client;
  set local test.uid = 'c8e00000-0000-0000-0000-00000000000e';
  set local test.jwt = '{"email": "anhlt1983@gmail.com"}';
  perform public.moderate_comment('c8e00000-0000-0000-0000-0000000000a3');
  perform public.moderate_comment('c8e00000-0000-0000-0000-0000000000a1');
  reset role;

  select count(*) into n from public.comments where collection_id = 'c8e00000-0000-0000-0000-0000000000c1';
  assert n = 0, format('%s comments left after the desk removed both threads', n);

  select count(*) into n from public.moderation_log where action = 'remove_comment';
  assert n = 2, format('%s lines for two removals', n);
  select * into r from public.moderation_log where target_id = 'c8e00000-0000-0000-0000-0000000000a1';
  assert r.actor = 'c8e00000-0000-0000-0000-00000000000e' and r.actor_email = 'anhlt1983@gmail.com',
    format('the line names %s / %s', r.actor, r.actor_email);
  assert r.detail = jsonb_build_object('author', 'c8e00000-0000-0000-0000-00000000000a',
                                       'collection', 'c8e00000-0000-0000-0000-0000000000c1', 'answers', 1),
    format('the line keeps %s', r.detail);
  select (detail ->> 'answers')::int into n from public.moderation_log where target_id = 'c8e00000-0000-0000-0000-0000000000a3';
  assert n = 0, format('an unanswered comment went with %s answers', n);
  assert not exists (select 1 from public.moderation_log l where l.detail::text like '%here%'),
    'the log kept the removed words';
end $$;

-- ── what did not happen is not logged ──
do $$
declare n int;
begin
  set local role rls_client;
  set local test.uid = 'c8e00000-0000-0000-0000-00000000000e';
  set local test.jwt = '{"email": "anhlt1983@gmail.com"}';
  perform public.moderate_comment('c8e00000-0000-0000-0000-0000000000a3');  -- already gone
  perform public.moderate_comment('c8e00000-0000-0000-0000-0000000000ff');  -- never was
  reset role;
  select count(*) into n from public.moderation_log;
  assert n = 2, format('%s lines after two acts that changed nothing', n);
end $$;

-- ── and the queue afterwards: nothing left to show, the report kept ──
do $$
declare got text;
begin
  got := public._c8_queue(true);
  assert got = E'comment|∅|∅|∅|∅\n'
            || E'comment|∅|∅|∅|∅\n'
            || E'collection|Coffee in Hoi An|About the list|c8owner|b\n'
            || 'profile|Owner Eight|a bio|c8owner|b',
    format('after the removals the queue said: %s', got);
end $$;

drop function public._c8_queue(boolean);
delete from public.reports;
delete from public.moderation_log;

select 'all comments-at-the-desk checks passed' as result;
