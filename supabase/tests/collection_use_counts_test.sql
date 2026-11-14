-- How the public lists were used (20261114100000): three totals per
-- public list, the same for every reader, and nothing that says who.
--
-- Exercised, not read, like `collection_stats_test`: `rls_client` with
-- `test.uid` in a reader's seat, and `anon` signed out — the seat a
-- guest's shelf is ranked from.
--
--   e9…0a  the curator: a public list, a private one, and a public one
--          nobody has touched
--   e9…0b  a reader who plans twice from the public list, and copies it
--   e9…0c  a reader who plans once from it
--   e9…0d  a reader who only likes it

grant usage on schema public to rls_client, anon;

insert into auth.users (id, email, raw_user_meta_data) values
 ('e9000000-0000-0000-0000-00000000000a', 'use-curator@x.com', '{"handle":"usecurator"}'),
 ('e9000000-0000-0000-0000-00000000000b', 'use-planner@x.com', '{"handle":"useplanner"}'),
 ('e9000000-0000-0000-0000-00000000000c', 'use-second@x.com',  '{"handle":"usesecond"}'),
 ('e9000000-0000-0000-0000-00000000000d', 'use-liker@x.com',   '{"handle":"useliker"}');

insert into public.collections (id, slug, owner_id) values
 ('e9000000-0000-0000-0000-0000000000c1', 'use-public',  'e9000000-0000-0000-0000-00000000000a'),
 ('e9000000-0000-0000-0000-0000000000c2', 'use-private', 'e9000000-0000-0000-0000-00000000000a'),
 ('e9000000-0000-0000-0000-0000000000c3', 'use-quiet',   'e9000000-0000-0000-0000-00000000000a');
update public.collections set is_public = true
 where id in ('e9000000-0000-0000-0000-0000000000c1', 'e9000000-0000-0000-0000-0000000000c3');

-- ── trips ──
--
-- The curator's own trip from their own list, two by one reader, one by
-- another, and one from the private list by its owner.
insert into public.trips (id, owner_id, city_id, title, day, when_part) values
 ('e9000000-0000-0000-0000-0000000000a1', 'e9000000-0000-0000-0000-00000000000a', 'hanoi', 'curator''s own',  current_date, 'day'),
 ('e9000000-0000-0000-0000-0000000000a2', 'e9000000-0000-0000-0000-00000000000b', 'hanoi', 'planner''s first', current_date, 'day'),
 ('e9000000-0000-0000-0000-0000000000a3', 'e9000000-0000-0000-0000-00000000000b', 'hanoi', 'planner''s second', current_date, 'day'),
 ('e9000000-0000-0000-0000-0000000000a4', 'e9000000-0000-0000-0000-00000000000c', 'hanoi', 'second reader''s', current_date, 'day'),
 ('e9000000-0000-0000-0000-0000000000a5', 'e9000000-0000-0000-0000-00000000000a', 'hanoi', 'from the private', current_date, 'day');
insert into public.trip_collections (trip_id, collection_id) values
 ('e9000000-0000-0000-0000-0000000000a1', 'e9000000-0000-0000-0000-0000000000c1'),
 ('e9000000-0000-0000-0000-0000000000a2', 'e9000000-0000-0000-0000-0000000000c1'),
 ('e9000000-0000-0000-0000-0000000000a3', 'e9000000-0000-0000-0000-0000000000c1'),
 ('e9000000-0000-0000-0000-0000000000a4', 'e9000000-0000-0000-0000-0000000000c1'),
 ('e9000000-0000-0000-0000-0000000000a5', 'e9000000-0000-0000-0000-0000000000c2');

-- ── copies ──
--
-- The planner's, twice over, and the curator's own.
insert into public.collections (slug, owner_id, copied_from) values
 ('use-copy-planner',   'e9000000-0000-0000-0000-00000000000b', 'e9000000-0000-0000-0000-0000000000c1'),
 ('use-copy-planner-2', 'e9000000-0000-0000-0000-00000000000b', 'e9000000-0000-0000-0000-0000000000c1'),
 ('use-copy-own',       'e9000000-0000-0000-0000-00000000000a', 'e9000000-0000-0000-0000-0000000000c1');

-- ── opens ──
insert into public.collection_views (collection_id, day, views) values
 ('e9000000-0000-0000-0000-0000000000c1', date '2026-11-13', 12),
 ('e9000000-0000-0000-0000-0000000000c1', date '2026-11-14', 18),
 ('e9000000-0000-0000-0000-0000000000c2', date '2026-11-14', 7);

-- ── likes ──
--
-- Three readers and the curator. One like is from the last minute of 12
-- November in Vietnam, the day before opens were counted; one is from
-- the first minute of the 13th, which a day read off UTC's calendar
-- would file under the 12th.
insert into public.collection_likes (collection_id, user_id, created_at) values
 ('e9000000-0000-0000-0000-0000000000c1', 'e9000000-0000-0000-0000-00000000000a', now()),
 ('e9000000-0000-0000-0000-0000000000c1', 'e9000000-0000-0000-0000-00000000000b', now()),
 ('e9000000-0000-0000-0000-0000000000c1', 'e9000000-0000-0000-0000-00000000000c', timestamptz '2026-11-12 16:59:00+00'),
 ('e9000000-0000-0000-0000-0000000000c1', 'e9000000-0000-0000-0000-00000000000d', timestamptz '2026-11-12 17:00:00+00');

-- ── the shape: three totals and a slug, and nothing that says who ──
do $$
declare cols text;
begin
  select string_agg(a.name, ',' order by a.at) into cols
    from pg_proc p
    cross join lateral unnest(p.proargnames, p.proargmodes) with ordinality as a(name, mode, at)
   where p.oid = 'public.collection_use_counts()'::regprocedure and a.mode = 't';
  assert cols = 'slug,uses,views,liked', format('collection_use_counts answers %s', cols);
end $$;

-- ── the figures, the same from every seat ──
do $$
declare seat text; got text; quiet text; n int; seats int := 0;
begin
  foreach seat in array array['anon:', 'rls_client:e9000000-0000-0000-0000-00000000000a',
                              'rls_client:e9000000-0000-0000-0000-00000000000b'] loop
    execute format('set local role %I', split_part(seat, ':', 1));
    perform set_config('test.uid', split_part(seat, ':', 2), true);
    select format('%s/%s/%s', uses, views, liked) into got
      from public.collection_use_counts() where slug = 'use-public';
    select format('%s/%s/%s', uses, views, liked) into quiet
      from public.collection_use_counts() where slug = 'use-quiet';
    select count(*) into n from public.collection_use_counts()
     where slug in ('use-private', 'use-copy-planner', 'use-copy-planner-2', 'use-copy-own');
    reset role;
    -- Uses: two people planned from it (the planner twice, counted once;
    -- the curator's own not at all) and one person copied it (twice,
    -- counted once; the curator's own not at all). The planner did both
    -- things and is counted for each.
    -- Views: every open, 12 + 18.
    -- Liked: the planner's and the one from the first minute of the 13th
    -- in Vietnam; not the curator's own, not the one from the 12th.
    assert got = '3/30/2', format('%s reads the public list as %s', seat, got);
    -- A public list nobody has touched has a row, of zeros.
    assert quiet = '0/0/0', format('%s reads the untouched list as %s', seat, quiet);
    -- A private list has no row for anybody, its owner included, and
    -- neither has a private copy.
    assert n = 0, format('%s was answered about %s private lists', seat, n);
    seats := seats + 1;
  end loop;
  assert seats = 3, 'not every seat was asked';
end $$;

-- A list gone private leaves the answer, and comes back with its figures.
update public.collections set is_public = false where id = 'e9000000-0000-0000-0000-0000000000c1';
do $$
declare n int;
begin
  set local role anon;
  select count(*) into n from public.collection_use_counts() where slug = 'use-public';
  reset role;
  assert n = 0, 'a list gone private is still answered about';
end $$;
update public.collections set is_public = true where id = 'e9000000-0000-0000-0000-0000000000c1';

-- ── the day likes are counted from is Vietnam's ──
--
-- The two likes a minute apart above already hold it at any hour. This
-- holds the definition, as `collection_stats_test` holds the counter's.
do $$
begin
  assert pg_get_functiondef('public.collection_use_counts()'::regprocedure) ~ 'Asia/Ho_Chi_Minh',
    'collection_use_counts no longer names Vietnam''s zone';
end $$;

-- ── grants: a guest may ask, and nobody reads the tables through it ──
do $$
begin
  assert has_function_privilege('anon', 'public.collection_use_counts()', 'execute'), 'a guest cannot ask';
  assert has_function_privilege('authenticated', 'public.collection_use_counts()', 'execute'), 'a reader cannot ask';
  assert not has_table_privilege('anon', 'public.collection_views', 'select'), 'a guest reads the counter';
  assert not has_table_privilege('anon', 'public.trip_collections', 'select'), 'a guest reads trip sources';
end $$;

select 'all collection-use-counts checks passed';
