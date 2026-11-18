-- Comments on a collection (20261118050000), as a client meets them:
-- through the five functions, since the tables answer to nobody.
--
--   c0…0a  the owner: one public list (c1, with place f1 on it), one private (c2)
--   c0…0b  a commenter, friend of c
--   c0…0c  a friend of b
--   c0…0d  a stranger to all of them
--   c0…0e  the desk
--
-- Every comment gets its time set by hand after it is written: a `do`
-- block is one transaction and `now()` is its start, so two comments
-- made in one would tie, and the order under test would be the order of
-- two random uuids.

grant usage on schema public to rls_client, anon;

insert into auth.users (id, email, raw_user_meta_data) values
 ('c0000000-0000-0000-0000-00000000000a', 'cm-owner@x.com',    '{"handle":"cmowner"}'),
 ('c0000000-0000-0000-0000-00000000000b', 'cm-writer@x.com',   '{"handle":"cmwriter"}'),
 ('c0000000-0000-0000-0000-00000000000c', 'cm-friend@x.com',   '{"handle":"cmfriend"}'),
 ('c0000000-0000-0000-0000-00000000000d', 'cm-stranger@x.com', '{"handle":"cmstranger"}'),
 ('c0000000-0000-0000-0000-00000000000e', 'desk@cm.test',      '{"handle":"cmdesk"}');
insert into public.editors (email) values ('desk@cm.test') on conflict do nothing;

insert into public.friendships (requester, addressee, status) values
 ('c0000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-00000000000c', 'accepted');

insert into public.places (id, slug, is_published, review_status) values
 ('c0000000-0000-0000-0000-0000000000f1', 'cm-on-the-list', true, 'approved'),
 ('c0000000-0000-0000-0000-0000000000f2', 'cm-elsewhere',   true, 'approved');
insert into public.collections (id, slug, owner_id) values
 ('c0000000-0000-0000-0000-0000000000c1', 'cm-public',  'c0000000-0000-0000-0000-00000000000a'),
 ('c0000000-0000-0000-0000-0000000000c2', 'cm-private', 'c0000000-0000-0000-0000-00000000000a'),
 ('c0000000-0000-0000-0000-0000000000c3', 'cm-second',  'c0000000-0000-0000-0000-00000000000a');
update public.collections set is_public = true
 where id in ('c0000000-0000-0000-0000-0000000000c1', 'c0000000-0000-0000-0000-0000000000c3');
insert into public.collection_places (collection_id, place_id) values
 ('c0000000-0000-0000-0000-0000000000c1', 'c0000000-0000-0000-0000-0000000000f1');

-- What a call was refused with, or 'ok'. Runs as whoever calls it.
create function public._cm_why(q text) returns text
language plpgsql set search_path = public as $$
begin
  execute q;
  return 'ok';
exception when others then
  return sqlerrm;
end $$;

-- A name for a comment, so the blocks below can speak of "the root".
create table public._cm (k text primary key, id uuid not null);
grant select, insert on public._cm to rls_client;
grant select on public._cm to anon;
grant execute on function public._cm_why(text) to rls_client, anon;

-- ── who may call what ──
do $$
declare
  f regprocedure;
begin
  foreach f in array array[
    'public.post_comment(uuid, uuid, text, jsonb)', 'public.delete_comment(uuid)',
    'public.own_comments_today()'
  ]::regprocedure[] loop
    assert not has_function_privilege('anon', f, 'execute'), format('%s is open to anon', f);
    assert has_function_privilege('authenticated', f, 'execute'), format('%s is closed to readers', f);
  end loop;
  foreach f in array array[
    'public.comment_thread(uuid, text)', 'public.comment_previews(uuid[])'
  ]::regprocedure[] loop
    assert has_function_privilege('anon', f, 'execute'), format('%s is closed to guests', f);
    assert has_function_privilege('authenticated', f, 'execute'), format('%s is closed to readers', f);
  end loop;
  foreach f in array array[
    'public.comment_prune(uuid)', 'public.comment_clean(text)',
    'public.comment_subject_visible(uuid)'
  ]::regprocedure[] loop
    assert not has_function_privilege('anon', f, 'execute'), format('%s is open to anon', f);
    assert not has_function_privilege('authenticated', f, 'execute'), format('%s is open to readers', f);
  end loop;
  -- Nothing of this migration's is open to a guest but the two reads.
  assert (select string_agg(p.proname, ', ' order by p.proname)
            from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'comment%'
             and has_function_privilege('anon', p.oid, 'execute')) = 'comment_previews, comment_thread',
    'the comment functions open to a guest are not exactly the two reads';
  assert not has_table_privilege('authenticated', 'public.comments', 'select, insert, update, delete'),
    'a reader holds a privilege on comments';
  assert not has_table_privilege('authenticated', 'public.comment_mentions', 'select, insert, update, delete'),
    'a reader holds a privilege on comment_mentions';
  assert not has_table_privilege('anon', 'public.banned_words', 'select'), 'a guest reads the banned words';
end $$;

-- ── a root, with the three tags its writer may make ──
do $$
declare made uuid; r record;
begin
  set local role rls_client;
  set local test.uid = 'c0000000-0000-0000-0000-00000000000b';
  -- 0123456789…: "Hi @cmowner and @cmfriend at Cafe" — owner, friend, place.
  made := public.post_comment('c0000000-0000-0000-0000-0000000000c1', null,
    '  Hi @cmowner and @cmfriend at Cafe  ',
    '[{"at":16,"len":9,"person":"c0000000-0000-0000-0000-00000000000c"},
      {"at":3,"len":8,"person":"c0000000-0000-0000-0000-00000000000a"},
      {"at":29,"len":4,"place":"c0000000-0000-0000-0000-0000000000f1"}]');
  insert into public._cm values ('r1', made);
  select * into r from public.comment_thread('c0000000-0000-0000-0000-0000000000c1');
  reset role;
  assert r.id = made and r.depth = 0 and r.parent_id is null and r.root_id is null, 'the root is not a root';
  assert r.body = 'Hi @cmowner and @cmfriend at Cafe', format('the body came back as [%s]', r.body);
  assert r.handle = 'cmwriter' and not r.gone, format('written by %s, gone %s', r.handle, r.gone);
  assert jsonb_array_length(r.mentions) = 3, format('%s tags came back', jsonb_array_length(r.mentions));
  assert r.mentions -> 0 ->> 'handle' = 'cmowner' and (r.mentions -> 0 ->> 'at')::int = 3,
    format('the tags are not in reading order: %s', r.mentions);
  assert r.mentions -> 2 ->> 'place' = 'c0000000-0000-0000-0000-0000000000f1'
     and r.mentions -> 2 ->> 'person' is null, format('the place tag came back as %s', r.mentions -> 2);
end $$;
update public.comments set created_at = '2026-11-01 10:00+00' where id = (select id from public._cm where k = 'r1');

-- ── what is refused, and with what ──
do $$
declare
  l1 text := '''c0000000-0000-0000-0000-0000000000c1''';
  r1 text := quote_literal((select id from public._cm where k = 'r1'));
  got text;
  n int;
begin
  set local role rls_client;

  set local test.uid = '';
  got := public._cm_why(format('select public.post_comment(%s, null, ''hello'')', l1));
  assert got = 'comment:signed_out', format('signed out: %s', got);

  set local test.uid = 'c0000000-0000-0000-0000-00000000000b';
  got := public._cm_why('select public.post_comment(''c0000000-0000-0000-0000-0000000000c2'', null, ''hello'')');
  assert got = 'comment:subject', format('a private list: %s', got);
  got := public._cm_why('select public.post_comment(''c0000000-0000-0000-0000-0000000000ff'', null, ''hello'')');
  assert got = 'comment:subject', format('no such list: %s', got);
  got := public._cm_why(format('select public.post_comment(%s, null, ''   '')', l1));
  assert got = 'comment:empty', format('only spaces: %s', got);
  got := public._cm_why(format('select public.post_comment(%s, null, null)', l1));
  assert got = 'comment:empty', format('no body: %s', got);
  got := public._cm_why(format('select public.post_comment(%s, null, repeat(''é'', 501))', l1));
  assert got = 'comment:long', format('501 characters: %s', got);
  -- 500 is counted in characters, not bytes: 500 two-byte letters fit.
  got := public._cm_why(format('select public.delete_comment(public.post_comment(%s, null, repeat(''é'', 500)))', l1));
  assert got = 'ok', format('500 characters: %s', got);

  -- A reply to a comment on another list, and to one that is not there.
  got := public._cm_why(format('select public.post_comment(''c0000000-0000-0000-0000-0000000000c3'', %s, ''hello'')', r1));
  assert got = 'comment:parent', format('a parent on another list: %s', got);
  got := public._cm_why(format('select public.post_comment(%s, ''c0000000-0000-0000-0000-0000000000ff'', ''hello'')', l1));
  assert got = 'comment:parent', format('a parent that is not there: %s', got);

  -- Tags: a stranger, oneself, nobody, a place off the list, past the
  -- end, two at once, two on one spot, not a list, and not a number.
  got := public._cm_why(format('select public.post_comment(%s, null, ''hello'', ''[{"at":0,"len":5,"person":"c0000000-0000-0000-0000-00000000000d"}]'')', l1));
  assert got = 'comment:mention', format('tagging a stranger: %s', got);
  got := public._cm_why(format('select public.post_comment(%s, null, ''hello'', ''[{"at":0,"len":5,"person":"c0000000-0000-0000-0000-00000000000b"}]'')', l1));
  assert got = 'comment:mention', format('tagging oneself: %s', got);
  got := public._cm_why(format('select public.post_comment(%s, null, ''hello'', ''[{"at":0,"len":5,"person":"c0000000-0000-0000-0000-0000000000ff"}]'')', l1));
  assert got = 'comment:mention', format('tagging nobody: %s', got);
  got := public._cm_why(format('select public.post_comment(%s, null, ''hello'', ''[{"at":0,"len":5,"place":"c0000000-0000-0000-0000-0000000000f2"}]'')', l1));
  assert got = 'comment:mention', format('a place off the list: %s', got);
  got := public._cm_why(format('select public.post_comment(%s, null, ''hello'', ''[{"at":1,"len":5,"place":"c0000000-0000-0000-0000-0000000000f1"}]'')', l1));
  assert got = 'comment:mention', format('a tag past the end: %s', got);
  got := public._cm_why(format('select public.post_comment(%s, null, ''hello'', ''[{"at":0,"len":5,"place":"c0000000-0000-0000-0000-0000000000f1","person":"c0000000-0000-0000-0000-00000000000a"}]'')', l1));
  assert got = 'comment:mention', format('a tag that is two things: %s', got);
  got := public._cm_why(format('select public.post_comment(%s, null, ''hello'', ''[{"at":0,"len":2,"place":"c0000000-0000-0000-0000-0000000000f1"},{"at":0,"len":5,"person":"c0000000-0000-0000-0000-00000000000a"}]'')', l1));
  assert got = 'comment:mention', format('two tags on one spot: %s', got);
  got := public._cm_why(format('select public.post_comment(%s, null, ''hello'', ''{"at":0}'')', l1));
  assert got = 'comment:mention', format('tags that are not a list: %s', got);
  got := public._cm_why(format('select public.post_comment(%s, null, ''hello'', ''[{"at":"x","len":5,"place":"c0000000-0000-0000-0000-0000000000f1"}]'')', l1));
  assert got = 'comment:mention', format('a tag at "x": %s', got);
  got := public._cm_why(format('select public.post_comment(%s, null, ''hello'', ''[{"at":0,"len":0,"place":"c0000000-0000-0000-0000-0000000000f1"}]'')', l1));
  assert got = 'comment:mention', format('a tag of no length: %s', got);

  -- Ten tags a comment, and the eleventh refuses it — each of these would pass alone.
  got := public._cm_why(format($q$select public.post_comment(%s, null, 'abcdefghijk',
    (select jsonb_agg(jsonb_build_object('at', g, 'len', 1, 'place', 'c0000000-0000-0000-0000-0000000000f1'))
       from generate_series(0, 10) g))$q$, l1));
  assert got = 'comment:mention', format('eleven tags: %s', got);
  got := public._cm_why(format($q$select public.delete_comment(public.post_comment(%s, null, 'abcdefghijk',
    (select jsonb_agg(jsonb_build_object('at', g, 'len', 1, 'place', 'c0000000-0000-0000-0000-0000000000f1'))
       from generate_series(0, 9) g)))$q$, l1));
  assert got = 'ok', format('ten tags: %s', got);

  got := public._cm_why(format('select * from public.comment_thread(%s, ''top'')', l1));
  assert got = 'comment:order', format('an order there is not: %s', got);
  reset role;

  -- A refusal leaves nothing behind — not the comment whose tag failed.
  select count(*) into n from public.comments;
  assert n = 1, format('%s comments stand after the refusals, 1 was written', n);
end $$;

-- ── a stranger writes, and may now tag whoever is in the thread ──
do $$
declare made uuid;
begin
  set local role rls_client;
  set local test.uid = 'c0000000-0000-0000-0000-00000000000d';
  made := public.post_comment('c0000000-0000-0000-0000-0000000000c1', null, 'cmwriter said it',
    '[{"at":0,"len":8,"person":"c0000000-0000-0000-0000-00000000000b"}]');
  insert into public._cm values ('r2', made);
  reset role;
end $$;
update public.comments set created_at = '2026-11-02 10:00+00' where id = (select id from public._cm where k = 'r2');

-- ── answers, three deep ──
do $$
declare x uuid;
begin
  set local role rls_client;
  set local test.uid = 'c0000000-0000-0000-0000-00000000000c';
  x := public.post_comment('c0000000-0000-0000-0000-0000000000c1', (select id from public._cm where k = 'r1'), 'first answer');
  insert into public._cm values ('x1', x);
  set local test.uid = 'c0000000-0000-0000-0000-00000000000a';
  x := public.post_comment('c0000000-0000-0000-0000-0000000000c1', x, 'answer to the answer');
  insert into public._cm values ('x2', x);
  set local test.uid = 'c0000000-0000-0000-0000-00000000000b';
  x := public.post_comment('c0000000-0000-0000-0000-0000000000c1', x, 'and a third');
  insert into public._cm values ('x3', x);
  -- A second answer to the root, written last and dated first.
  x := public.post_comment('c0000000-0000-0000-0000-0000000000c1', (select id from public._cm where k = 'r1'), 'an earlier answer');
  insert into public._cm values ('x0', x);
  reset role;
end $$;
update public.comments set created_at = '2026-11-03 10:00+00' where id = (select id from public._cm where k = 'x1');
update public.comments set created_at = '2026-11-04 10:00+00' where id = (select id from public._cm where k = 'x2');
update public.comments set created_at = '2026-11-05 10:00+00' where id = (select id from public._cm where k = 'x3');
update public.comments set created_at = '2026-11-02 12:00+00' where id = (select id from public._cm where k = 'x0');

-- Roots newest first; under each, its answers oldest first — whatever
-- they answer. Read signed out: the thread is as public as the list.
do $$
declare seen text; deep text; roots int;
begin
  set local role anon;
  set local test.uid = '';
  select string_agg(m.k, ' ' order by t.ord), string_agg(t.depth::text, '' order by t.ord)
    into seen, deep
    from public.comment_thread('c0000000-0000-0000-0000-0000000000c1') with ordinality as t(id, parent_id, root_id, depth, body, created_at, gone, author, handle, full_name, avatar_url, mentions, ord)
    join public._cm m on m.id = t.id;
  reset role;
  assert seen = 'r2 r1 x0 x1 x2 x3', format('the thread reads: %s', seen);
  assert deep = '001123', format('the depths read: %s', deep);
  select count(*) into roots from public.comments
   where root_id = (select id from public._cm where k = 'r1');
  assert roots = 4, format('%s comments name r1 as their root, 4 hang under it', roots);
end $$;

-- ── the card: a count, and the two newest ──
do $$
declare r record; rows int;
begin
  set local role anon;
  set local test.uid = '';
  select count(*) into rows from public.comment_previews(array[
    'c0000000-0000-0000-0000-0000000000c1', 'c0000000-0000-0000-0000-0000000000c2',
    'c0000000-0000-0000-0000-0000000000c3']::uuid[]);
  select * into r from public.comment_previews(array['c0000000-0000-0000-0000-0000000000c1']::uuid[]);
  reset role;
  assert rows = 1, format('%s lists came back, one has comments', rows);
  assert r.n = 6, format('the card counts %s, 6 were written', r.n);
  assert jsonb_array_length(r.latest) = 2, format('the card shows %s', jsonb_array_length(r.latest));
  assert r.latest -> 0 ->> 'body' = 'and a third' and r.latest -> 1 ->> 'body' = 'answer to the answer',
    format('the two newest came back as %s', r.latest);
  assert r.latest -> 0 ->> 'handle' = 'cmwriter', format('the newest is by %s', r.latest -> 0 ->> 'handle');
end $$;

-- ── a block: each is a husk to the other, and neither can reach the other ──
insert into public.blocks (blocker, blocked) values
 ('c0000000-0000-0000-0000-00000000000c', 'c0000000-0000-0000-0000-00000000000d');
do $$
declare r record; n int; got text;
begin
  set local role rls_client;
  -- The blocker reads the stranger's root as gone, and the card drops it.
  set local test.uid = 'c0000000-0000-0000-0000-00000000000c';
  select * into r from public.comment_thread('c0000000-0000-0000-0000-0000000000c1')
   where id = (select id from public._cm where k = 'r2');
  assert r.gone and r.body is null and r.author is null and r.handle is null and r.mentions = '[]'::jsonb,
    format('the blocked stranger still shows: %s', row_to_json(r));
  select p.n into n from public.comment_previews(array['c0000000-0000-0000-0000-0000000000c1']::uuid[]) p;
  assert n = 5, format('the blocker''s card counts %s, 5 are theirs to see', n);
  -- The blocked reads the blocker's answer as gone too, and cannot answer or tag them.
  set local test.uid = 'c0000000-0000-0000-0000-00000000000d';
  select * into r from public.comment_thread('c0000000-0000-0000-0000-0000000000c1')
   where id = (select id from public._cm where k = 'x1');
  assert r.gone and r.body is null and r.author is null, 'the blocker still shows to the blocked';
  got := public._cm_why(format('select public.post_comment(''c0000000-0000-0000-0000-0000000000c1'', %L, ''hello'')',
    (select id from public._cm where k = 'x1')));
  assert got = 'comment:parent', format('answering one who blocked you: %s', got);
  got := public._cm_why('select public.post_comment(''c0000000-0000-0000-0000-0000000000c1'', null, ''hello'', ''[{"at":0,"len":5,"person":"c0000000-0000-0000-0000-00000000000c"}]'')');
  assert got = 'comment:mention', format('tagging one who blocked you: %s', got);
  -- A third reader sees them both.
  set local test.uid = 'c0000000-0000-0000-0000-00000000000b';
  select count(*) into n from public.comment_thread('c0000000-0000-0000-0000-0000000000c1') where gone;
  assert n = 0, format('a third reader sees %s husks', n);
  reset role;
end $$;

-- Blocked by the owner, the list is not there to write on.
insert into public.blocks (blocker, blocked) values
 ('c0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000d');
do $$
declare got text;
begin
  set local role rls_client;
  set local test.uid = 'c0000000-0000-0000-0000-00000000000d';
  got := public._cm_why('select public.post_comment(''c0000000-0000-0000-0000-0000000000c1'', null, ''hello'')');
  reset role;
  assert got = 'comment:subject', format('writing on the list of one who blocked you: %s', got);
end $$;

-- ── taking one back ──
do $$
declare got text; n int; r record;
begin
  set local role rls_client;
  -- Not a stranger's to take.
  set local test.uid = 'c0000000-0000-0000-0000-00000000000d';
  got := public._cm_why(format('select public.delete_comment(%L)', (select id from public._cm where k = 'x3')));
  assert got = 'comment:not_yours', format('a stranger deleting: %s', got);
  set local test.uid = '';
  got := public._cm_why(format('select public.delete_comment(%L)', (select id from public._cm where k = 'x3')));
  assert got = 'comment:signed_out', format('nobody deleting: %s', got);

  -- Answered: a husk, and its tags gone.
  set local test.uid = 'c0000000-0000-0000-0000-00000000000c';
  perform public.delete_comment((select id from public._cm where k = 'x1'));
  perform public.delete_comment((select id from public._cm where k = 'x1'));
  select * into r from public.comment_thread('c0000000-0000-0000-0000-0000000000c1')
   where id = (select id from public._cm where k = 'x1');
  assert r.gone and r.body is null and r.author is null, 'an answered comment did not leave a husk';
  -- A husk is not answered again.
  got := public._cm_why(format('select public.post_comment(''c0000000-0000-0000-0000-0000000000c1'', %L, ''hello'')',
    (select id from public._cm where k = 'x1')));
  assert got = 'comment:parent', format('answering a husk: %s', got);

  -- Unanswered: gone outright. The writer takes x3; x2 above it is living and stays.
  set local test.uid = 'c0000000-0000-0000-0000-00000000000b';
  perform public.delete_comment((select id from public._cm where k = 'x3'));
  select count(*) into n from public.comment_thread('c0000000-0000-0000-0000-0000000000c1');
  assert n = 5, format('%s rows after the leaf went, 5 remain', n);

  -- The last answer under a husk takes the husk with it — and stops at the living root.
  set local test.uid = 'c0000000-0000-0000-0000-00000000000a';
  perform public.delete_comment((select id from public._cm where k = 'x2'));
  select string_agg(m.k, ' ' order by m.k) into got
    from public.comment_thread('c0000000-0000-0000-0000-0000000000c1') t join public._cm m on m.id = t.id;
  assert got = 'r1 r2 x0', format('after the prune the thread holds: %s', got);

  -- The owner of the list takes a stranger's; the desk takes anybody's; a
  -- comment that is not there is not an error.
  perform public.delete_comment((select id from public._cm where k = 'r2'));
  set local test.uid = 'c0000000-0000-0000-0000-00000000000e';
  set local test.jwt = '{"email":"desk@cm.test"}';
  perform public.delete_comment((select id from public._cm where k = 'x0'));
  perform public.delete_comment('c0000000-0000-0000-0000-0000000000ff');
  select string_agg(m.k, ' ' order by m.k) into got
    from public.comment_thread('c0000000-0000-0000-0000-0000000000c1') t join public._cm m on m.id = t.id;
  reset role;
  assert got = 'r1', format('after the owner and the desk the thread holds: %s', got);
end $$;
do $$
declare n int;
begin
  select count(*) into n from public.comment_mentions;
  -- r1's three; r2's one went with r2.
  assert n = 3, format('%s tags stand, 3 are r1''s', n);
end $$;

-- A husk keeps no tags: the row that says who was spoken to goes with the words.
do $$
declare kid uuid; n int;
begin
  set local role rls_client;
  set local test.uid = 'c0000000-0000-0000-0000-00000000000c';
  kid := public.post_comment('c0000000-0000-0000-0000-0000000000c1', (select id from public._cm where k = 'r1'), 'still here');
  insert into public._cm values ('k1', kid);
  set local test.uid = 'c0000000-0000-0000-0000-00000000000b';
  perform public.delete_comment((select id from public._cm where k = 'r1'));
  reset role;
  select count(*) into n from public.comment_mentions;
  assert n = 0, format('%s tags outlived the comment they were on', n);
  select count(*) into n from public.comments
   where id = (select id from public._cm where k = 'r1') and body is null and deleted_at is not null and author is not null;
  assert n = 1, 'the answered root is not a husk';
end $$;

-- ── the owner's switch: no new comment, and the old ones still read ──
update public.collections set comments_off = true where id = 'c0000000-0000-0000-0000-0000000000c1';
do $$
declare got text; n int; cards int;
begin
  set local role rls_client;
  set local test.uid = 'c0000000-0000-0000-0000-00000000000a';
  got := public._cm_why('select public.post_comment(''c0000000-0000-0000-0000-0000000000c1'', null, ''hello'')');
  select count(*) into n from public.comment_thread('c0000000-0000-0000-0000-0000000000c1');
  select p.n into cards from public.comment_previews(array['c0000000-0000-0000-0000-0000000000c1']::uuid[]) p;
  reset role;
  assert got = 'comment:off', format('writing with comments off: %s', got);
  assert n = 2, format('%s rows read with comments off, 2 are there', n);
  -- The husk is drawn in the thread and is not a comment on the card.
  assert cards = 1, format('the card counts %s, one of the two is a husk', cards);
end $$;
update public.collections set comments_off = false where id = 'c0000000-0000-0000-0000-0000000000c1';

-- ── the list goes private: the thread is hidden, not lost ──
update public.collections set is_public = false where id = 'c0000000-0000-0000-0000-0000000000c1';
do $$
declare n int; cards int;
begin
  set local role rls_client;
  set local test.uid = 'c0000000-0000-0000-0000-00000000000a';
  select count(*) into n from public.comment_thread('c0000000-0000-0000-0000-0000000000c1');
  select count(*) into cards from public.comment_previews(array['c0000000-0000-0000-0000-0000000000c1']::uuid[]);
  reset role;
  assert n = 0 and cards = 0, format('a private list shows %s comments and %s cards', n, cards);
  select count(*) into n from public.comments where collection_id = 'c0000000-0000-0000-0000-0000000000c1';
  assert n = 2, format('%s comments kept while private, 2 were there', n);
end $$;
update public.collections set is_public = true where id = 'c0000000-0000-0000-0000-0000000000c1';

-- ── the words the desk keeps out ──
do $$
declare got text; refused boolean := false; n int;
begin
  set local role rls_client;
  -- A reader neither writes the list nor reads it.
  set local test.uid = 'c0000000-0000-0000-0000-00000000000b';
  begin
    insert into public.banned_words (word) values ('nope');
  exception when insufficient_privilege then refused := true;
  end;
  select count(*) into n from public.banned_words;
  assert refused and n = 0, format('a reader wrote a banned word (%s) or read %s', not refused, n);
  -- The desk does both.
  set local test.uid = 'c0000000-0000-0000-0000-00000000000e';
  set local test.jwt = '{"email":"desk@cm.test"}';
  insert into public.banned_words (word) values ('ass'), ('đồ ngu');
  set local test.jwt = '';

  set local test.uid = 'c0000000-0000-0000-0000-00000000000b';
  got := public._cm_why('select public.post_comment(''c0000000-0000-0000-0000-0000000000c3'', null, ''What an ASS!'')');
  assert got = 'comment:banned', format('a banned word, shouted: %s', got);
  got := public._cm_why('select public.post_comment(''c0000000-0000-0000-0000-0000000000c3'', null, ''Đồ  ngu, thật'')');
  assert got = 'comment:banned', format('two banned words, spaced out: %s', got);
  -- Whole words: a class is not stopped for what it contains.
  got := public._cm_why('select public.post_comment(''c0000000-0000-0000-0000-0000000000c3'', null, ''A class act, đồ ăn ngon'')');
  assert got = 'ok', format('a clean comment: %s', got);
  reset role;
end $$;
delete from public.banned_words;

-- ── thirty a day ──
insert into public.comments (author, collection_id, body)
select 'c0000000-0000-0000-0000-00000000000c', 'c0000000-0000-0000-0000-0000000000c3', 'filler ' || g
  from generate_series(1, 28) g;
-- One of them a day and a minute old: it is not today's.
update public.comments set created_at = now() - interval '1 day 1 minute'
 where body = 'filler 1';
do $$
declare got text; n int;
begin
  set local role rls_client;
  set local test.uid = 'c0000000-0000-0000-0000-00000000000c';
  -- 27 fillers today and "still here" make 28.
  n := public.own_comments_today();
  assert n = 28, format('counted %s of today''s, 28 were written', n);
  got := public._cm_why('select public.post_comment(''c0000000-0000-0000-0000-0000000000c3'', null, ''twenty-nine'')')
      || ' ' || public._cm_why('select public.post_comment(''c0000000-0000-0000-0000-0000000000c3'', null, ''thirty'')')
      || ' ' || public._cm_why('select public.post_comment(''c0000000-0000-0000-0000-0000000000c3'', null, ''thirty-one'')');
  reset role;
  assert got = 'ok ok comment:cap', format('the 29th, 30th and 31st: %s', got);
end $$;

-- ── the tree keeps itself, whoever writes ──
do $$
declare got text; r record;
begin
  got := public._cm_why(format(
    'insert into public.comments (author, collection_id, parent_id, body) values (null, ''c0000000-0000-0000-0000-0000000000c3'', %L, ''x'')',
    (select id from public._cm where k = 'k1')));
  assert got = 'comment:parent', format('a row answering across lists: %s', got);
  -- A row that lies about where it hangs is put where it hangs.
  insert into public.comments (collection_id, parent_id, root_id, depth, body)
  values ('c0000000-0000-0000-0000-0000000000c1', (select id from public._cm where k = 'k1'), null, 7, 'x')
  returning root_id, depth into r;
  assert r.root_id = (select id from public._cm where k = 'r1') and r.depth = 2,
    format('placed at root %s depth %s', r.root_id, r.depth);
  delete from public.comments where body = 'x';
  got := public._cm_why('insert into public.comments (body) values (''x'')');
  assert got like '%comments_one_subject%', format('a comment on nothing: %s', got);
  got := public._cm_why('update public.comments set body = null where body = ''still here''');
  assert got like '%comments_gone_has_no_body%', format('a living comment with no body: %s', got);
end $$;

-- ── a comment can be reported ──
do $$
declare got text;
begin
  set local role rls_client;
  set local test.uid = 'c0000000-0000-0000-0000-00000000000b';
  got := public._cm_why(format(
    'insert into public.reports (reporter, kind, target_id, reason) values (''c0000000-0000-0000-0000-00000000000b'', ''comment'', %L, ''spam'')',
    (select id from public._cm where k = 'k1')));
  reset role;
  assert got = 'ok', format('reporting a comment: %s', got);
end $$;
delete from public.reports where kind = 'comment';

-- ── an account is deleted: its words go at once ──
--
-- The writer has the husk r1 already; give them one answered comment and
-- one unanswered, and a tag pointing at them.
do $$
declare a uuid; b uuid;
begin
  set local role rls_client;
  set local test.uid = 'c0000000-0000-0000-0000-00000000000b';
  a := public.post_comment('c0000000-0000-0000-0000-0000000000c1', null, 'answered, then gone');
  b := public.post_comment('c0000000-0000-0000-0000-0000000000c1', null, 'unanswered, then gone');
  insert into public._cm values ('a1', a), ('b1', b);
  set local test.uid = 'c0000000-0000-0000-0000-00000000000a';
  a := public.post_comment('c0000000-0000-0000-0000-0000000000c1', a, 'to cmwriter',
    '[{"at":3,"len":8,"person":"c0000000-0000-0000-0000-00000000000b"}]');
  insert into public._cm values ('a2', a);
  reset role;
end $$;
delete from auth.users where id = 'c0000000-0000-0000-0000-00000000000b';
do $$
declare r record; n int;
begin
  select * into r from public.comments where id = (select id from public._cm where k = 'a1');
  assert r.author is null and r.body is null and r.deleted_at is not null,
    format('the answered comment kept author %s body %s', r.author, r.body);
  select count(*) into n from public.comments where id = (select id from public._cm where k = 'b1');
  assert n = 0, 'the unanswered comment outlived its account';
  select count(*) into n from public.comments where author = 'c0000000-0000-0000-0000-00000000000b' or body like '%then gone%';
  assert n = 0, format('%s rows still carry the account or its words', n);
  -- The answer stays, as plain words: the tag went with the person.
  select count(*) into n from public.comment_mentions where comment_id = (select id from public._cm where k = 'a2');
  assert n = 0, 'a tag outlived the person it pointed at';
  select count(*) into n from public.comments where id = (select id from public._cm where k = 'a2') and body = 'to cmwriter';
  assert n = 1, 'the answer to a deleted account did not stay';
end $$;

-- ── a list is deleted: its thread goes with it ──
delete from public.collections where id in
 ('c0000000-0000-0000-0000-0000000000c1', 'c0000000-0000-0000-0000-0000000000c2', 'c0000000-0000-0000-0000-0000000000c3');
do $$
declare n int;
begin
  select count(*) into n from public.comments;
  assert n = 0, format('%s comments outlived their lists', n);
end $$;

drop table public._cm;
drop function public._cm_why(text);
delete from public.blocks where blocker in ('c0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000c');
delete from public.places where slug in ('cm-on-the-list', 'cm-elsewhere');
delete from public.editors where email = 'desk@cm.test';
delete from auth.users where email in ('cm-owner@x.com', 'cm-friend@x.com', 'cm-stranger@x.com', 'desk@cm.test');

select 'all comment checks passed' as result;
