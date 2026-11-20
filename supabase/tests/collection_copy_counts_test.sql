-- How many people copied each public list (20261120160000): one figure
-- per copied public list, the same for every reader, naming nobody.
--
--   f1…0a  the curator: a public list, a private one, a public one
--          nobody copied
--   f1…0b  a reader who copies the public list twice
--   f1…0c  a reader who copies it once, and the private one is not theirs
--          to copy

grant usage on schema public to rls_client, anon;

insert into auth.users (id, email, raw_user_meta_data) values
 ('f1000000-0000-0000-0000-00000000000a', 'cc-curator@x.com', '{"handle":"cccurator"}'),
 ('f1000000-0000-0000-0000-00000000000b', 'cc-twice@x.com',   '{"handle":"cctwice"}'),
 ('f1000000-0000-0000-0000-00000000000c', 'cc-once@x.com',    '{"handle":"cconce"}');

insert into public.collections (id, slug, owner_id) values
 ('f1000000-0000-0000-0000-0000000000c1', 'cc-public',  'f1000000-0000-0000-0000-00000000000a'),
 ('f1000000-0000-0000-0000-0000000000c2', 'cc-private', 'f1000000-0000-0000-0000-00000000000a'),
 ('f1000000-0000-0000-0000-0000000000c3', 'cc-quiet',   'f1000000-0000-0000-0000-00000000000a');
update public.collections set is_public = true
 where id in ('f1000000-0000-0000-0000-0000000000c1', 'f1000000-0000-0000-0000-0000000000c3');

-- Two copies by one reader, one by another, the curator's own, and a
-- copy of the private list made while it was the curator's alone.
insert into public.collections (slug, owner_id, copied_from) values
 ('cc-copy-twice-1', 'f1000000-0000-0000-0000-00000000000b', 'f1000000-0000-0000-0000-0000000000c1'),
 ('cc-copy-twice-2', 'f1000000-0000-0000-0000-00000000000b', 'f1000000-0000-0000-0000-0000000000c1'),
 ('cc-copy-once',    'f1000000-0000-0000-0000-00000000000c', 'f1000000-0000-0000-0000-0000000000c1'),
 ('cc-copy-own',     'f1000000-0000-0000-0000-00000000000a', 'f1000000-0000-0000-0000-0000000000c1'),
 ('cc-copy-private', 'f1000000-0000-0000-0000-00000000000c', 'f1000000-0000-0000-0000-0000000000c2');

-- ── the shape: a slug and a count, nothing that says who ──
do $$
declare cols text;
begin
  select string_agg(a.name, ',' order by a.at) into cols
    from pg_proc p
    cross join lateral unnest(p.proargnames, p.proargmodes) with ordinality as a(name, mode, at)
   where p.oid = 'public.collection_copy_counts()'::regprocedure and a.mode = 't';
  assert cols = 'slug,copies', format('collection_copy_counts answers %s', cols);
end $$;

-- ── the figure, the same from every seat ──
do $$
declare seat text; got int; others int; seats int := 0;
begin
  foreach seat in array array['anon:', 'rls_client:f1000000-0000-0000-0000-00000000000a',
                              'rls_client:f1000000-0000-0000-0000-00000000000b'] loop
    execute format('set local role %I', split_part(seat, ':', 1));
    perform set_config('test.uid', split_part(seat, ':', 2), true);
    select copies into got from public.collection_copy_counts() where slug = 'cc-public';
    select count(*) into others from public.collection_copy_counts() where slug <> 'cc-public'
      and slug like 'cc-%';
    reset role;
    -- Two people: the reader who copied twice counted once, the
    -- curator's own copy not at all.
    assert got = 2, format('%s reads the public list as %s', seat, got);
    -- No row for the private list, nor for one nobody copied, nor for
    -- any copy.
    assert others = 0, format('%s was answered about %s other lists', seat, others);
    seats := seats + 1;
  end loop;
  assert seats = 3, 'not every seat was asked';
end $$;

-- A list gone private leaves the answer.
update public.collections set is_public = false where id = 'f1000000-0000-0000-0000-0000000000c1';
do $$
declare n int;
begin
  set local role anon;
  select count(*) into n from public.collection_copy_counts() where slug = 'cc-public';
  reset role;
  assert n = 0, 'a private list was counted';
end $$;
