-- Hearts on comments (20261118190000): set and taken back through one
-- function, by anybody who could read the comment; counted and marked
-- as the reader's in what a thread returns; gone with the comment, and
-- with the account.
--
--   c1…0a  the owner of a public list (c1) and a private one (c2)
--   c1…0b  a writer
--   c1…0c  a reader
--   c1…0d  a reader the writer will block

grant usage on schema public to rls_client, anon;

insert into auth.users (id, email, raw_user_meta_data) values
 ('c1ec0000-0000-0000-0000-00000000000a', 'cl-owner@x.com', '{"handle":"clowner"}'),
 ('c1ec0000-0000-0000-0000-00000000000b', 'cl-b@x.com',     '{"handle":"clb"}'),
 ('c1ec0000-0000-0000-0000-00000000000c', 'cl-c@x.com',     '{"handle":"clc"}'),
 ('c1ec0000-0000-0000-0000-00000000000d', 'cl-d@x.com',     '{"handle":"cld"}');
insert into public.collections (id, slug, owner_id) values
 ('c1ec0000-0000-0000-0000-0000000000c1', 'cl-public',  'c1ec0000-0000-0000-0000-00000000000a'),
 ('c1ec0000-0000-0000-0000-0000000000c2', 'cl-private', 'c1ec0000-0000-0000-0000-00000000000a');
update public.collections set is_public = true where id = 'c1ec0000-0000-0000-0000-0000000000c1';
insert into public.comments (id, author, collection_id, parent_id, body, created_at) values
 ('c1ec0000-0000-0000-0000-0000000000a1', 'c1ec0000-0000-0000-0000-00000000000b', 'c1ec0000-0000-0000-0000-0000000000c1', null, 'r1', '2026-11-01'),
 ('c1ec0000-0000-0000-0000-0000000000a2', 'c1ec0000-0000-0000-0000-00000000000c', 'c1ec0000-0000-0000-0000-0000000000c1', null, 'r2', '2026-11-02'),
 ('c1ec0000-0000-0000-0000-0000000000a9', 'c1ec0000-0000-0000-0000-00000000000b', 'c1ec0000-0000-0000-0000-0000000000c2', null, 'hidden', '2026-11-03');
insert into public.comments (id, author, collection_id, parent_id, body, created_at) values
 ('c1ec0000-0000-0000-0000-0000000000b1', 'c1ec0000-0000-0000-0000-00000000000c', 'c1ec0000-0000-0000-0000-0000000000c1', 'c1ec0000-0000-0000-0000-0000000000a1', 'x1', '2026-11-04');

create function public._cl_why(q text) returns text
language plpgsql set search_path = public as $$
begin
  execute q;
  return 'ok';
exception when others then
  return sqlerrm;
end $$;
grant execute on function public._cl_why(text) to rls_client, anon;

-- Each comment as "body:likes" with a * where the heart is the reader's.
create function public._cl_reads(as_user text) returns text
language plpgsql set search_path = public as $$
declare seen text;
begin
  execute 'set local role ' || (case when as_user = '' then 'anon' else 'rls_client' end);
  perform set_config('test.uid', as_user, true);
  select string_agg(t.body || ':' || t.likes || (case when t.liked then '*' else '' end), ' ' order by t.body) into seen
    from public.comment_thread('c1ec0000-0000-0000-0000-0000000000c1') t;
  reset role;
  return seen;
end $$;

-- ── who may call what, and that nobody touches the table ──
do $$
begin
  assert not has_function_privilege('anon', 'public.like_comment(uuid, boolean)', 'execute'), 'a guest may like';
  assert has_function_privilege('authenticated', 'public.like_comment(uuid, boolean)', 'execute'), 'a reader may not like';
  assert not has_table_privilege('authenticated', 'public.comment_likes', 'select, insert, update, delete'),
    'a reader holds a privilege on comment_likes';
  assert (select count(*) from pg_policies where tablename = 'comment_likes') = 0, 'comment_likes grew a policy';
  assert has_function_privilege('anon', 'public.comment_thread(uuid, text)', 'execute'), 'a guest cannot read a thread';
end $$;

-- ── nothing liked: zeros, for a reader and for a guest ──
do $$
declare got text;
begin
  got := public._cl_reads('c1ec0000-0000-0000-0000-00000000000c');
  assert got = 'r1:0 r2:0 x1:0', format('before any heart: %s', got);
  got := public._cl_reads('');
  assert got = 'r1:0 r2:0 x1:0', format('a guest before any heart: %s', got);
end $$;

-- ── a heart set, set again, and seen: counted for all, marked for its owner ──
do $$
declare got text;
begin
  set local role rls_client;
  set local test.uid = 'c1ec0000-0000-0000-0000-00000000000c';
  perform public.like_comment('c1ec0000-0000-0000-0000-0000000000a1', true);
  perform public.like_comment('c1ec0000-0000-0000-0000-0000000000a1', true);
  -- One's own comment, too.
  perform public.like_comment('c1ec0000-0000-0000-0000-0000000000a2', true);
  set local test.uid = 'c1ec0000-0000-0000-0000-00000000000a';
  perform public.like_comment('c1ec0000-0000-0000-0000-0000000000a1', true);
  perform public.like_comment('c1ec0000-0000-0000-0000-0000000000b1', true);
  reset role;
  got := public._cl_reads('c1ec0000-0000-0000-0000-00000000000c');
  assert got = 'r1:2* r2:1* x1:1', format('the reader who liked two: %s', got);
  got := public._cl_reads('c1ec0000-0000-0000-0000-00000000000a');
  assert got = 'r1:2* r2:1 x1:1*', format('the owner: %s', got);
  got := public._cl_reads('c1ec0000-0000-0000-0000-00000000000b');
  assert got = 'r1:2 r2:1 x1:1', format('the writer, who liked none: %s', got);
  got := public._cl_reads('');
  assert got = 'r1:2 r2:1 x1:1', format('a guest: %s', got);
end $$;

-- ── taken back, and taken back again ──
do $$
declare got text;
begin
  set local role rls_client;
  set local test.uid = 'c1ec0000-0000-0000-0000-00000000000c';
  perform public.like_comment('c1ec0000-0000-0000-0000-0000000000a1', false);
  perform public.like_comment('c1ec0000-0000-0000-0000-0000000000a1', false);
  reset role;
  got := public._cl_reads('c1ec0000-0000-0000-0000-00000000000c');
  -- Only the reader's own heart went: the owner's stands.
  assert got = 'r1:1 r2:1* x1:1', format('after taking one back: %s', got);
end $$;

-- ── what is refused ──
insert into public.blocks (blocker, blocked) values
 ('c1ec0000-0000-0000-0000-00000000000b', 'c1ec0000-0000-0000-0000-00000000000d');
do $$
declare got text; n int;
begin
  set local role rls_client;
  set local test.uid = '';
  got := public._cl_why('select public.like_comment(''c1ec0000-0000-0000-0000-0000000000a1'', true)');
  assert got = 'comment:signed_out', format('nobody liking: %s', got);
  set local test.uid = 'c1ec0000-0000-0000-0000-00000000000c';
  got := public._cl_why('select public.like_comment(''c1ec0000-0000-0000-0000-0000000000ff'', true)');
  assert got = 'comment:parent', format('a comment that is not there: %s', got);
  got := public._cl_why('select public.like_comment(''c1ec0000-0000-0000-0000-0000000000a9'', true)');
  assert got = 'comment:parent', format('a comment on a private list: %s', got);
  -- Blocked by the writer: their comment is not there to like.
  set local test.uid = 'c1ec0000-0000-0000-0000-00000000000d';
  got := public._cl_why('select public.like_comment(''c1ec0000-0000-0000-0000-0000000000a1'', true)');
  assert got = 'comment:parent', format('liking one who blocked you: %s', got);
  -- Nor straight into the table.
  got := public._cl_why('insert into public.comment_likes (comment_id, user_id) values (''c1ec0000-0000-0000-0000-0000000000a2'', ''c1ec0000-0000-0000-0000-00000000000d'')');
  assert got like '%permission denied%', format('writing the table: %s', got);
  reset role;
  select count(*) into n from public.comment_likes;
  assert n = 3, format('%s hearts stand after the refusals, 3 were set', n);
end $$;
delete from public.blocks where blocker = 'c1ec0000-0000-0000-0000-00000000000b';

-- ── a heart goes with its comment, with the comment above it, and with its account ──
do $$
declare n int;
begin
  -- r1 deleted: its own heart and the one on x1 under it.
  set local role rls_client;
  set local test.uid = 'c1ec0000-0000-0000-0000-00000000000b';
  perform public.delete_comment('c1ec0000-0000-0000-0000-0000000000a1');
  reset role;
  select count(*) into n from public.comment_likes;
  assert n = 1, format('%s hearts after a liked comment and its liked answer went, 1 is left', n);
end $$;
delete from auth.users where id = 'c1ec0000-0000-0000-0000-00000000000c';
do $$
begin
  -- c's account: its comment r2 and its own heart on it.
  assert (select count(*) from public.comment_likes) = 0, 'a heart outlived its account';
end $$;

drop function public._cl_reads(text);
drop function public._cl_why(text);
delete from public.collections where id in ('c1ec0000-0000-0000-0000-0000000000c1', 'c1ec0000-0000-0000-0000-0000000000c2');
delete from auth.users where email in ('cl-owner@x.com', 'cl-b@x.com', 'cl-d@x.com');

select 'all comment like checks passed' as result;
