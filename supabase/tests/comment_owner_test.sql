-- The owner's side of comments (20261119070000): what a card and a field
-- are told about a closed thread and about whose list it is, and that
-- the switch is the owner's alone to throw.
--
--   …0a  the owner of a public list with comments (c1), a public one
--        with none (c2) and a private one (c3)
--   …0b  a writer
--   …0c  a reader

grant usage on schema public to rls_client, anon;

insert into auth.users (id, email, raw_user_meta_data) values
 ('c0e60000-0000-0000-0000-00000000000a', 'co-a@x.com', '{"handle":"coowner"}'),
 ('c0e60000-0000-0000-0000-00000000000b', 'co-b@x.com', '{"handle":"cowriter"}'),
 ('c0e60000-0000-0000-0000-00000000000c', 'co-c@x.com', '{"handle":"coreader"}');
insert into public.collections (id, slug, owner_id) values
 ('c0e60000-0000-0000-0000-0000000000c1', 'co-talked',  'c0e60000-0000-0000-0000-00000000000a'),
 ('c0e60000-0000-0000-0000-0000000000c2', 'co-quiet',   'c0e60000-0000-0000-0000-00000000000a'),
 ('c0e60000-0000-0000-0000-0000000000c3', 'co-private', 'c0e60000-0000-0000-0000-00000000000a');
update public.collections set is_public = true
 where id in ('c0e60000-0000-0000-0000-0000000000c1', 'c0e60000-0000-0000-0000-0000000000c2');
insert into public.comments (id, author, collection_id, parent_id, body, created_at) values
 ('c0e60000-0000-0000-0000-0000000000a1', 'c0e60000-0000-0000-0000-00000000000b', 'c0e60000-0000-0000-0000-0000000000c1', null, 'one', '2026-11-01'),
 ('c0e60000-0000-0000-0000-0000000000a2', 'c0e60000-0000-0000-0000-00000000000c', 'c0e60000-0000-0000-0000-0000000000c1', null, 'two', '2026-11-02'),
 ('c0e60000-0000-0000-0000-0000000000a3', 'c0e60000-0000-0000-0000-00000000000b', 'c0e60000-0000-0000-0000-0000000000c1', null, 'three', '2026-11-03'),
 ('c0e60000-0000-0000-0000-0000000000a9', 'c0e60000-0000-0000-0000-00000000000b', 'c0e60000-0000-0000-0000-0000000000c3', null, 'hidden', '2026-11-04');

-- What the cards are told for the three lists and one that does not
-- exist: "slug:n:latest count:off", by slug.
create function public._co_cards(as_user text) returns text
language plpgsql set search_path = public as $$
declare got text;
begin
  execute 'set local role ' || (case when as_user = '' then 'anon' else 'rls_client' end);
  perform set_config('test.uid', as_user, true);
  select string_agg(c.slug || ':' || p.n || ':' || jsonb_array_length(p.latest) || ':' || p.off, ' ' order by c.slug collate "C") into got
    from public.comment_previews(array[
      'c0e60000-0000-0000-0000-0000000000c1', 'c0e60000-0000-0000-0000-0000000000c2',
      'c0e60000-0000-0000-0000-0000000000c3', 'c0e60000-0000-0000-0000-0000000000ff']::uuid[]) p
    join public.collections c on c.id = p.collection_id;
  reset role;
  return got;
end $$;

-- What a field is told on a list: "off/mine".
create function public._co_field(as_user text, list uuid) returns text
language plpgsql set search_path = public as $$
declare got jsonb;
begin
  set local role rls_client;
  perform set_config('test.uid', as_user, true);
  got := public.comment_taggable(list);
  reset role;
  return (got ->> 'off') || '/' || (got ->> 'mine');
end $$;

-- ── who may ask ──
do $$
begin
  assert has_function_privilege('anon', 'public.comment_previews(uuid[])', 'execute'), 'a guest cannot read a card''s count';
  assert has_function_privilege('authenticated', 'public.comment_previews(uuid[])', 'execute'), 'a reader cannot read a card''s count';
  assert not has_function_privilege('anon', 'public.comment_taggable(uuid)', 'execute'), 'a guest may ask whom to tag';
end $$;

-- ── a card: every list the reader may see, with none and with some; open ──
do $$
declare got text;
begin
  got := public._co_cards('c0e60000-0000-0000-0000-00000000000c');
  assert got = 'co-quiet:0:0:false co-talked:3:2:false', format('a reader''s cards: %s', got);
  got := public._co_cards('');
  assert got = 'co-quiet:0:0:false co-talked:3:2:false', format('a guest''s cards: %s', got);
  -- Its owner is told nothing of a private list's thread either: there is none to show.
  got := public._co_cards('c0e60000-0000-0000-0000-00000000000a');
  assert got = 'co-quiet:0:0:false co-talked:3:2:false', format('the owner''s cards: %s', got);
end $$;

-- ── a field, open: whose list it is ──
do $$
declare got text;
begin
  got := public._co_field('c0e60000-0000-0000-0000-00000000000a', 'c0e60000-0000-0000-0000-0000000000c1');
  assert got = 'false/true', format('the owner''s field: %s', got);
  got := public._co_field('c0e60000-0000-0000-0000-00000000000b', 'c0e60000-0000-0000-0000-0000000000c1');
  assert got = 'false/false', format('a writer''s field: %s', got);
  -- Nothing is said of a list no comment could be written on, even to its owner.
  got := public._co_field('c0e60000-0000-0000-0000-00000000000a', 'c0e60000-0000-0000-0000-0000000000c3');
  assert got = 'false/false', format('on a private list: %s', got);
  got := public._co_field('', 'c0e60000-0000-0000-0000-0000000000c1');
  assert got = 'false/false', format('signed out: %s', got);
end $$;

-- ── the switch is the owner's: a stranger's write changes nothing ──
do $$
declare n integer;
begin
  set local role rls_client;
  set local test.uid = 'c0e60000-0000-0000-0000-00000000000b';
  update public.collections set comments_off = true where id = 'c0e60000-0000-0000-0000-0000000000c1';
  get diagnostics n = row_count;
  reset role;
  assert n = 0, 'a stranger closed somebody else''s thread';
  assert not (select comments_off from public.collections where id = 'c0e60000-0000-0000-0000-0000000000c1'),
    'the thread is closed after a stranger''s write';

  set local role rls_client;
  set local test.uid = 'c0e60000-0000-0000-0000-00000000000a';
  update public.collections set comments_off = true
   where id in ('c0e60000-0000-0000-0000-0000000000c1', 'c0e60000-0000-0000-0000-0000000000c2');
  get diagnostics n = row_count;
  reset role;
  assert n = 2, format('the owner closed %s of their two threads', n);
end $$;

-- ── closed: the cards and the fields say so, the thread still reads, the people are still offered ──
do $$
declare got text; seen integer; offered integer;
begin
  got := public._co_cards('c0e60000-0000-0000-0000-00000000000c');
  assert got = 'co-quiet:0:0:true co-talked:3:2:true', format('closed, a reader''s cards: %s', got);
  got := public._co_field('c0e60000-0000-0000-0000-00000000000a', 'c0e60000-0000-0000-0000-0000000000c1');
  assert got = 'true/true', format('closed, the owner''s field: %s', got);
  got := public._co_field('c0e60000-0000-0000-0000-00000000000c', 'c0e60000-0000-0000-0000-0000000000c1');
  assert got = 'true/false', format('closed, a reader''s field: %s', got);

  set local role rls_client;
  set local test.uid = 'c0e60000-0000-0000-0000-00000000000c';
  select count(*) into seen from public.comment_thread('c0e60000-0000-0000-0000-0000000000c1');
  select jsonb_array_length(public.comment_taggable('c0e60000-0000-0000-0000-0000000000c1') -> 'people') into offered;
  reset role;
  assert seen = 3, format('a closed thread reads %s of 3', seen);
  assert offered = 2, format('a closed thread offers %s people of 2', offered);
end $$;

-- ── and opened again by the owner ──
do $$
declare got text;
begin
  set local role rls_client;
  set local test.uid = 'c0e60000-0000-0000-0000-00000000000a';
  update public.collections set comments_off = false where id = 'c0e60000-0000-0000-0000-0000000000c1';
  reset role;
  got := public._co_cards('c0e60000-0000-0000-0000-00000000000c');
  assert got = 'co-quiet:0:0:true co-talked:3:2:false', format('reopened: %s', got);
end $$;

drop function public._co_cards(text);
drop function public._co_field(text, uuid);

select 'all comment owner checks passed' as result;
