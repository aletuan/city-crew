-- Integration test for 20260912030000_editorial_collections_to_owner.sql.
--
-- The migration's own call is a no-op on a bench, which has no desk
-- account — so what is driven here is `adopt_editorial_collections`
-- itself, against a seed this file makes: one editorial identity holding
-- a public list, and one desk account to adopt it.
--
-- Asserted: the row moves, its old owner and old handle are written down
-- for a restore, the byline follows the new owner (the stamp trigger),
-- lists that belong to ordinary readers are left alone, a second call
-- moves nothing, and an unknown address moves nothing.

\set ON_ERROR_STOP on

-- The sign-up trigger builds each profile from the metadata, exactly as
-- it does for a real account — so the handles arrive as the courier, not
-- as a second insert.
insert into auth.users (id, email, raw_user_meta_data) values
  ('5eed0000-0000-0000-0000-0000000000aa', 'pen@editors.citycrew.invalid', '{"handle":"penname","full_name":"Pen Name"}'),
  ('d4000000-0000-0000-0000-0000000000aa', 'desk-adopt@example.com', '{"handle":"deskhandle","full_name":"The Desk"}'),
  ('d4000000-0000-0000-0000-0000000000bb', 'reader-adopt@example.com', '{"handle":"readerhandle","full_name":"A Reader"}');

insert into public.collections (slug, owner_id, city_id, title_en, is_public, curator_handle) values
  ('pen-list', '5eed0000-0000-0000-0000-0000000000aa', 'hanoi', 'Pen list', true, 'penname'),
  ('reader-list', 'd4000000-0000-0000-0000-0000000000bb', 'hanoi', 'Reader list', true, 'readerhandle');

-- ------------------------------------------------------------- the move
--
-- The bench already holds the seed lists the editorial migration adopted,
-- so the call moves those as well as this file's own. What is pinned is
-- the count against what was there, not a bare number.

do $$
declare
  waiting int;
  moved int;
  c record;
  origin record;
begin
  select count(*) into waiting
  from public.collections col join auth.users u on u.id = col.owner_id
  where u.email like '%@editors.citycrew.invalid';
  assert waiting > 1, 'the bench has no editorial collections to adopt';

  select public.adopt_editorial_collections('desk-adopt@example.com') into moved;
  assert moved = waiting, format('expected %s collections to move, got %s', waiting, moved);

  select owner_id, curator_handle into c from public.collections where slug = 'pen-list';
  assert c.owner_id = 'd4000000-0000-0000-0000-0000000000aa',
    format('pen-list did not move: %s', c.owner_id);
  -- The stamp trigger fired on the update: the byline is the new owner's.
  assert c.curator_handle = 'deskhandle',
    format('the byline did not follow the owner: %s', c.curator_handle);

  -- Written down before the move, so a restore has both halves.
  select previous_owner_id, previous_curator_handle into origin
  from public.editorial_collection_origin o
  join public.collections col on col.id = o.collection_id
  where col.slug = 'pen-list';
  assert origin.previous_owner_id = '5eed0000-0000-0000-0000-0000000000aa',
    'the old owner was not recorded';
  assert origin.previous_curator_handle = 'penname',
    format('the old byline was not recorded: %s', origin.previous_curator_handle);
end $$;

-- A reader's own list is nobody's to adopt.
do $$
declare c record;
begin
  select owner_id, curator_handle into c from public.collections where slug = 'reader-list';
  assert c.owner_id = 'd4000000-0000-0000-0000-0000000000bb', 'a reader list was adopted';
  assert c.curator_handle = 'readerhandle', 'a reader byline was rewritten';
end $$;

-- Idempotent, and an unknown address moves nothing rather than raising.
do $$
declare moved int;
begin
  select public.adopt_editorial_collections('desk-adopt@example.com') into moved;
  assert moved = 0, format('a second call moved %s rows', moved);

  select public.adopt_editorial_collections('nobody@example.com') into moved;
  assert moved = 0, format('an unknown address moved %s rows', moved);
end $$;

-- Not an endpoint: `anon` and `authenticated` cannot call it.
do $$
declare who text;
begin
  foreach who in array array['anon', 'authenticated'] loop
    assert not has_function_privilege(who, 'public.adopt_editorial_collections(text)', 'execute'),
      format('%s can execute adopt_editorial_collections', who);
  end loop;
end $$;

-- ------------------------------------------------------------ the restore
--
-- Also the rehearsal of the real one: owner first, then handle, because
-- the stamp trigger fires on the first write and would otherwise put the
-- new owner's name back over the one being restored.

update public.collections c
set owner_id = o.previous_owner_id
from public.editorial_collection_origin o where o.collection_id = c.id;

update public.collections c
set curator_handle = o.previous_curator_handle
from public.editorial_collection_origin o where o.collection_id = c.id;

do $$
declare c record;
begin
  select owner_id, curator_handle into c from public.collections where slug = 'pen-list';
  assert c.owner_id = '5eed0000-0000-0000-0000-0000000000aa', 'the restore left the owner moved';
  assert c.curator_handle = 'penname',
    format('the restore did not put the byline back: %s', c.curator_handle);
end $$;

-- Left as found, so the files after this one see the bench they expect.
delete from public.editorial_collection_origin;
delete from public.collections where slug in ('pen-list', 'reader-list');
delete from public.profiles where id in (
  '5eed0000-0000-0000-0000-0000000000aa', 'd4000000-0000-0000-0000-0000000000aa',
  'd4000000-0000-0000-0000-0000000000bb');
delete from auth.users where id in (
  '5eed0000-0000-0000-0000-0000000000aa', 'd4000000-0000-0000-0000-0000000000aa',
  'd4000000-0000-0000-0000-0000000000bb');
