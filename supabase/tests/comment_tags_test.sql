-- Tags made usable (20261119050000): whom and what a caller may tag on a
-- list, in the order they are offered; held to what `post_comment`
-- accepts; and a place tag read back with the slug its page opens by.
--
--   …0a  the owner of a public list (c1) and a private one (c2)
--   …0b  the caller
--   …0c  the caller's friend, who has not written here
--   …0d  a stranger who wrote in the thread first
--   …0e  a stranger who has not
--   …0f  the caller's friend, since blocked
--   …10  the caller's friend who also wrote in the thread, last

grant usage on schema public to rls_client, anon;

insert into auth.users (id, email, raw_user_meta_data) values
 ('c7a60000-0000-0000-0000-00000000000a', 'ct-a@x.com', '{"handle":"ctowner"}'),
 ('c7a60000-0000-0000-0000-00000000000b', 'ct-b@x.com', '{"handle":"ctme"}'),
 ('c7a60000-0000-0000-0000-00000000000c', 'ct-c@x.com', '{"handle":"ctfriend"}'),
 ('c7a60000-0000-0000-0000-00000000000d', 'ct-d@x.com', '{"handle":"ctwriter"}'),
 ('c7a60000-0000-0000-0000-00000000000e', 'ct-e@x.com', '{"handle":"ctstranger"}'),
 ('c7a60000-0000-0000-0000-00000000000f', 'ct-f@x.com', '{"handle":"ctblocked"}'),
 ('c7a60000-0000-0000-0000-000000000010', 'ct-g@x.com', '{"handle":"ctboth"}');
insert into public.friendships (requester, addressee, status) values
 ('c7a60000-0000-0000-0000-00000000000b', 'c7a60000-0000-0000-0000-00000000000c', 'accepted'),
 ('c7a60000-0000-0000-0000-00000000000f', 'c7a60000-0000-0000-0000-00000000000b', 'accepted'),
 ('c7a60000-0000-0000-0000-000000000010', 'c7a60000-0000-0000-0000-00000000000b', 'accepted'),
 -- Asked, not answered: not a friend.
 ('c7a60000-0000-0000-0000-00000000000b', 'c7a60000-0000-0000-0000-00000000000e', 'pending');
insert into public.blocks (blocker, blocked) values
 ('c7a60000-0000-0000-0000-00000000000f', 'c7a60000-0000-0000-0000-00000000000b');

insert into public.places (id, slug, is_published, review_status, name_en, name_vi) values
 ('c7a60000-0000-0000-0000-0000000000f1', 'ct-alpha',  true,  'approved', 'Second', 'Thứ hai'),
 ('c7a60000-0000-0000-0000-0000000000f2', 'ct-beta',   true,  'approved', 'First',  'Thứ nhất'),
 ('c7a60000-0000-0000-0000-0000000000f3', 'ct-pending', false, 'pending',  'Unseen', 'Chưa duyệt'),
 ('c7a60000-0000-0000-0000-0000000000f4', 'ct-elsewhere', true, 'approved', 'Elsewhere', 'Nơi khác');
insert into public.collections (id, slug, owner_id) values
 ('c7a60000-0000-0000-0000-0000000000c1', 'ct-public',  'c7a60000-0000-0000-0000-00000000000a'),
 ('c7a60000-0000-0000-0000-0000000000c2', 'ct-private', 'c7a60000-0000-0000-0000-00000000000a');
update public.collections set is_public = true where id = 'c7a60000-0000-0000-0000-0000000000c1';
insert into public.collection_places (collection_id, place_id, sort_order) values
 ('c7a60000-0000-0000-0000-0000000000c1', 'c7a60000-0000-0000-0000-0000000000f1', 2),
 ('c7a60000-0000-0000-0000-0000000000c1', 'c7a60000-0000-0000-0000-0000000000f2', 1),
 ('c7a60000-0000-0000-0000-0000000000c1', 'c7a60000-0000-0000-0000-0000000000f3', 0),
 ('c7a60000-0000-0000-0000-0000000000c2', 'c7a60000-0000-0000-0000-0000000000f4', 0);
-- The stranger wrote first, the friend-who-wrote last, the owner between
-- them, the caller too, and the blocked one as well.
insert into public.comments (author, collection_id, parent_id, body, created_at) values
 ('c7a60000-0000-0000-0000-00000000000d', 'c7a60000-0000-0000-0000-0000000000c1', null, 'early',  '2026-11-01'),
 ('c7a60000-0000-0000-0000-00000000000a', 'c7a60000-0000-0000-0000-0000000000c1', null, 'owner',  '2026-11-02'),
 ('c7a60000-0000-0000-0000-00000000000b', 'c7a60000-0000-0000-0000-0000000000c1', null, 'mine',   '2026-11-03'),
 ('c7a60000-0000-0000-0000-00000000000f', 'c7a60000-0000-0000-0000-0000000000c1', null, 'hidden', '2026-11-04'),
 ('c7a60000-0000-0000-0000-000000000010', 'c7a60000-0000-0000-0000-0000000000c1', null, 'late',   '2026-11-05'),
 ('c7a60000-0000-0000-0000-00000000000d', 'c7a60000-0000-0000-0000-0000000000c2', null, 'private', '2026-11-06');

create function public._ct_why(q text) returns text
language plpgsql set search_path = public as $$
begin
  execute q;
  return 'ok';
exception when others then
  return sqlerrm;
end $$;
grant execute on function public._ct_why(text) to rls_client, anon;

-- What a caller is offered on a list: the handles in order, then the
-- place slugs in order.
create function public._ct_offered(as_user text, list uuid) returns text
language plpgsql set search_path = public as $$
declare got jsonb;
begin
  set local role rls_client;
  perform set_config('test.uid', as_user, true);
  got := public.comment_taggable(list);
  reset role;
  return coalesce((select string_agg(p ->> 'handle', ' ' order by n) from jsonb_array_elements(got -> 'people') with ordinality as x(p, n)), '')
      || ' | '
      || coalesce((select string_agg(p ->> 'slug', ' ' order by n) from jsonb_array_elements(got -> 'places') with ordinality as x(p, n)), '');
end $$;

-- ── who may ask ──
do $$
begin
  assert not has_function_privilege('anon', 'public.comment_taggable(uuid)', 'execute'), 'a guest may ask whom to tag';
  assert has_function_privilege('authenticated', 'public.comment_taggable(uuid)', 'execute'), 'a reader may not ask whom to tag';
  assert has_function_privilege('anon', 'public.comment_thread(uuid, text)', 'execute'), 'a guest cannot read a thread';
end $$;

-- ── the offer: owner, then the thread latest first, then friends; each once;
--    never the caller, never the blocked; places in the list's order, published only ──
do $$
declare got text;
begin
  got := public._ct_offered('c7a60000-0000-0000-0000-00000000000b', 'c7a60000-0000-0000-0000-0000000000c1');
  assert got = 'ctowner ctboth ctwriter ctfriend | ct-beta ct-alpha', format('the caller is offered: %s', got);
  -- Somebody with no friends here still has the owner and the thread —
  -- and the one who blocked the caller above is offered to others.
  got := public._ct_offered('c7a60000-0000-0000-0000-00000000000e', 'c7a60000-0000-0000-0000-0000000000c1');
  assert got = 'ctowner ctboth ctblocked ctme ctwriter | ct-beta ct-alpha', format('a stranger is offered: %s', got);
  -- The owner is not offered themself.
  got := public._ct_offered('c7a60000-0000-0000-0000-00000000000a', 'c7a60000-0000-0000-0000-0000000000c1');
  assert got = 'ctboth ctblocked ctme ctwriter | ct-beta ct-alpha', format('the owner is offered: %s', got);
end $$;

-- ── nothing where no comment could be written ──
do $$
declare got text;
begin
  got := public._ct_offered('c7a60000-0000-0000-0000-00000000000b', 'c7a60000-0000-0000-0000-0000000000c2');
  assert got = ' | ', format('on a private list: %s', got);
  got := public._ct_offered('c7a60000-0000-0000-0000-00000000000b', gen_random_uuid());
  assert got = ' | ', format('on no list at all: %s', got);
  got := public._ct_offered('', 'c7a60000-0000-0000-0000-0000000000c1');
  assert got = ' | ', format('signed out: %s', got);
  insert into public.blocks (blocker, blocked) values
   ('c7a60000-0000-0000-0000-00000000000a', 'c7a60000-0000-0000-0000-00000000000e');
  got := public._ct_offered('c7a60000-0000-0000-0000-00000000000e', 'c7a60000-0000-0000-0000-0000000000c1');
  assert got = ' | ', format('blocked by the owner: %s', got);
  delete from public.blocks where blocker = 'c7a60000-0000-0000-0000-00000000000a';
end $$;

-- ── what a place and a person carry ──
do $$
declare got jsonb;
begin
  set local role rls_client;
  set local test.uid = 'c7a60000-0000-0000-0000-00000000000b';
  got := public.comment_taggable('c7a60000-0000-0000-0000-0000000000c1');
  reset role;
  assert got -> 'places' -> 0 ->> 'id' = 'c7a60000-0000-0000-0000-0000000000f2'
     and got -> 'places' -> 0 ->> 'name_en' = 'First'
     and got -> 'places' -> 0 ->> 'name_vi' = 'Thứ nhất'
     and (got -> 'places' -> 0) ? 'name_ja' and (got -> 'places' -> 0) ? 'i18n',
    format('a place carries: %s', got -> 'places' -> 0);
  assert got -> 'people' -> 0 ->> 'id' = 'c7a60000-0000-0000-0000-00000000000a'
     and (got -> 'people' -> 0) ? 'full_name' and (got -> 'people' -> 0) ? 'avatar_url',
    format('a person carries: %s', got -> 'people' -> 0);
end $$;

-- ── held to `post_comment`: everybody offered can be tagged, and one who is not cannot ──
do $$
declare
  got jsonb; p jsonb; why text;
begin
  set local role rls_client;
  set local test.uid = 'c7a60000-0000-0000-0000-00000000000b';
  got := public.comment_taggable('c7a60000-0000-0000-0000-0000000000c1');
  for p in select * from jsonb_array_elements(got -> 'people') loop
    why := public._ct_why(format(
      $q$select public.post_comment('c7a60000-0000-0000-0000-0000000000c1', null, '@tagged', '[{"at":0,"len":7,"person":"%s"}]'::jsonb)$q$,
      p ->> 'id'));
    assert why = 'ok', format('offered %s, then refused: %s', p ->> 'handle', why);
  end loop;
  for p in select * from jsonb_array_elements(got -> 'places') loop
    why := public._ct_why(format(
      $q$select public.post_comment('c7a60000-0000-0000-0000-0000000000c1', null, 'a place', '[{"at":0,"len":7,"place":"%s"}]'::jsonb)$q$,
      p ->> 'id'));
    assert why = 'ok', format('offered %s, then refused: %s', p ->> 'slug', why);
  end loop;
  why := public._ct_why(
    $q$select public.post_comment('c7a60000-0000-0000-0000-0000000000c1', null, '@tagged', '[{"at":0,"len":7,"person":"c7a60000-0000-0000-0000-00000000000e"}]'::jsonb)$q$);
  assert why = 'comment:mention', format('a stranger not offered was taken: %s', why);
  why := public._ct_why(
    $q$select public.post_comment('c7a60000-0000-0000-0000-0000000000c1', null, '@tagged', '[{"at":0,"len":7,"person":"c7a60000-0000-0000-0000-00000000000f"}]'::jsonb)$q$);
  assert why = 'comment:mention', format('a blocked friend not offered was taken: %s', why);
  reset role;
end $$;

-- ── read back: a place tag has its slug, a person tag has none ──
do $$
declare tags jsonb;
begin
  set local role rls_client;
  set local test.uid = 'c7a60000-0000-0000-0000-00000000000b';
  perform public.post_comment('c7a60000-0000-0000-0000-0000000000c1', null, '@ctowner at First',
    '[{"at":0,"len":8,"person":"c7a60000-0000-0000-0000-00000000000a"},{"at":12,"len":5,"place":"c7a60000-0000-0000-0000-0000000000f2"}]'::jsonb);
  select t.mentions into tags from public.comment_thread('c7a60000-0000-0000-0000-0000000000c1') t where t.body = '@ctowner at First';
  reset role;
  assert tags -> 0 ->> 'handle' = 'ctowner' and tags -> 0 ->> 'slug' is null and (tags -> 0) ? 'slug',
    format('the person tag: %s', tags -> 0);
  assert tags -> 1 ->> 'slug' = 'ct-beta' and tags -> 1 ->> 'place' = 'c7a60000-0000-0000-0000-0000000000f2',
    format('the place tag: %s', tags -> 1);
  -- A place taken off the list afterwards still opens: the tag is the place's, not the list's.
  delete from public.collection_places where place_id = 'c7a60000-0000-0000-0000-0000000000f2';
  set local role anon;
  select t.mentions into tags from public.comment_thread('c7a60000-0000-0000-0000-0000000000c1') t where t.body = '@ctowner at First';
  reset role;
  assert tags -> 1 ->> 'slug' = 'ct-beta', format('after leaving the list: %s', tags -> 1);
end $$;

drop function public._ct_offered(text, uuid);
drop function public._ct_why(text);

select 'all comment tag checks passed' as result;
