-- The account's own comments and hearts, for the copy of its data
-- (20261119110000): everything the caller wrote and liked, nobody
-- else's, and other people by handle alone.
--
--   …0a  the caller          …0b  the list's owner
--   …0c  somebody the caller blocked after answering them

grant usage on schema public to rls_client, anon;

insert into auth.users (id, email, raw_user_meta_data) values
 ('c9e00000-0000-0000-0000-00000000000a', 'c9-a@x.com', '{"handle":"c9me","full_name":"Me Nine"}'),
 ('c9e00000-0000-0000-0000-00000000000b', 'c9-b@x.com', '{"handle":"c9owner","full_name":"Owner Nine"}'),
 ('c9e00000-0000-0000-0000-00000000000c', 'c9-c@x.com', '{"handle":"c9other","full_name":"Other Nine"}');
insert into public.places (id, slug, is_published, review_status)
values ('c9e00000-0000-0000-0000-0000000000f1', 'c9-cafe', true, 'approved');
insert into public.collections (id, slug, owner_id) values
 ('c9e00000-0000-0000-0000-0000000000c1', 'c9-public',  'c9e00000-0000-0000-0000-00000000000b'),
 ('c9e00000-0000-0000-0000-0000000000c2', 'c9-private', 'c9e00000-0000-0000-0000-00000000000b');
update public.collections set is_public = true where id = 'c9e00000-0000-0000-0000-0000000000c1';
insert into public.comments (id, author, collection_id, parent_id, root_id, depth, body, created_at) values
 ('c9e00000-0000-0000-0000-0000000000a1', 'c9e00000-0000-0000-0000-00000000000c', 'c9e00000-0000-0000-0000-0000000000c1', null, null, 0, 'theirs', '2026-11-01'),
 ('c9e00000-0000-0000-0000-0000000000a2', 'c9e00000-0000-0000-0000-00000000000a', 'c9e00000-0000-0000-0000-0000000000c1',
  'c9e00000-0000-0000-0000-0000000000a1', 'c9e00000-0000-0000-0000-0000000000a1', 1, 'hi @c9owner at Cafe', '2026-11-02'),
 ('c9e00000-0000-0000-0000-0000000000a3', 'c9e00000-0000-0000-0000-00000000000a', 'c9e00000-0000-0000-0000-0000000000c2', null, null, 0, 'on a list since hidden', '2026-11-03'),
 ('c9e00000-0000-0000-0000-0000000000a4', 'c9e00000-0000-0000-0000-00000000000b', 'c9e00000-0000-0000-0000-0000000000c1', null, null, 0, 'the owner, tagging @c9me', '2026-11-04');
insert into public.comment_mentions (comment_id, at, len, person_id, place_id) values
 ('c9e00000-0000-0000-0000-0000000000a2', 3,  8, 'c9e00000-0000-0000-0000-00000000000b', null),
 ('c9e00000-0000-0000-0000-0000000000a2', 15, 4, null, 'c9e00000-0000-0000-0000-0000000000f1'),
 ('c9e00000-0000-0000-0000-0000000000a4', 19, 5, 'c9e00000-0000-0000-0000-00000000000a', null);
insert into public.comment_likes (comment_id, user_id, created_at) values
 ('c9e00000-0000-0000-0000-0000000000a4', 'c9e00000-0000-0000-0000-00000000000a', '2026-11-05'),
 ('c9e00000-0000-0000-0000-0000000000a2', 'c9e00000-0000-0000-0000-00000000000b', '2026-11-06');
-- Blocked since: the answer the caller wrote to them is still the caller's.
insert into public.blocks (blocker, blocked) values
 ('c9e00000-0000-0000-0000-00000000000a', 'c9e00000-0000-0000-0000-00000000000c');

create function public._c9_takeout(as_user text) returns jsonb
language plpgsql set search_path = public as $$
declare got jsonb;
begin
  execute 'set local role ' || (case when as_user = '' then 'anon' else 'rls_client' end);
  perform set_config('test.uid', as_user, true);
  got := public.my_comment_takeout();
  reset role;
  return got;
end $$;

do $$
declare got jsonb; c jsonb;
begin
  got := public._c9_takeout('c9e00000-0000-0000-0000-00000000000a');

  -- Two comments, oldest first; not the one that tags the caller.
  assert jsonb_array_length(got -> 'comments') = 2, format('the caller wrote 2, the copy has %s', got -> 'comments');
  c := got -> 'comments' -> 0;
  assert c ->> 'collection_slug' = 'c9-public' and c ->> 'text' = 'hi @c9owner at Cafe',
    format('the first comment reads %s', c);
  assert c ->> 'in_reply_to' = 'c9other' and (c -> 'is_reply')::boolean,
    format('an answer to somebody since blocked reads %s', c);
  assert c -> 'people' = '["c9owner"]'::jsonb and c -> 'places' = '["c9-cafe"]'::jsonb,
    format('its tags read %s / %s', c -> 'people', c -> 'places');
  assert (c ->> 'at')::timestamptz = '2026-11-02'::timestamptz, format('written at %s', c ->> 'at');
  c := got -> 'comments' -> 1;
  assert c ->> 'collection_slug' = 'c9-private' and c ->> 'in_reply_to' is null and not (c -> 'is_reply')::boolean
     and c -> 'people' = '[]'::jsonb and c -> 'places' = '[]'::jsonb,
    format('a comment on a list since hidden reads %s', c);

  -- One heart: the one the caller set, not the one set on the caller's.
  assert got -> 'hearts' = jsonb_build_array(jsonb_build_object(
           'collection_slug', 'c9-public', 'author', 'c9owner', 'at', (got -> 'hearts' -> 0 -> 'at'))),
    format('the hearts read %s', got -> 'hearts');

  -- Nobody's id and nobody's name, anywhere in it.
  assert got::text not like '%c9e00000%' and got::text not like '%Nine%',
    format('the copy carries an id or a name: %s', got);

  -- Somebody with nothing written gets two empty lists, not a null.
  got := public._c9_takeout('c9e00000-0000-0000-0000-00000000000c');
  assert jsonb_array_length(got -> 'comments') = 1 and got -> 'hearts' = '[]'::jsonb,
    format('the other person''s copy reads %s', got);

  -- And not for the signed-out, who have no account to copy.
  assert not has_function_privilege('anon', 'public.my_comment_takeout()', 'execute'), 'a guest may ask for a takeout';
  assert has_function_privilege('authenticated', 'public.my_comment_takeout()', 'execute'), 'a reader may not ask for theirs';
end $$;

-- A writer whose profile is gone: a null, for the app to drop.
delete from public.profiles where id = 'c9e00000-0000-0000-0000-00000000000b';
do $$
declare got jsonb;
begin
  got := public._c9_takeout('c9e00000-0000-0000-0000-00000000000a');
  assert got -> 'hearts' -> 0 -> 'author' = 'null'::jsonb, format('a heart on a nameless comment reads %s', got -> 'hearts');
  assert got -> 'comments' -> 0 -> 'people' = '[]'::jsonb, format('a tag of a nameless person reads %s', got -> 'comments' -> 0);
end $$;

drop function public._c9_takeout(text);

select 'all comment takeout checks passed' as result;
