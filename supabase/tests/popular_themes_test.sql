-- Which themes are popular: the share, the two, the order, and who may ask.
--
-- Twelve accounts of its own, removed at the end so the blocks after
-- this one count what they counted before. The existing three accounts may
-- hold a theme by now (`preferences_theme_test` leaves one on Cosmic),
-- so each check reads the denominator rather than assuming it.

insert into auth.users (id, email)
select md5('popular-themes-' || g)::uuid, 'popular' || g || '@x.com'
from generate_series(1, 12) g;

/** The theme of the g-th seeded account. */
create function pg_temp.seed_theme(g int, t text) returns void language sql as $$
  insert into public.preferences (owner_id, theme)
  values (md5('popular-themes-' || g)::uuid, t)
  on conflict (owner_id) do update set theme = excluded.theme;
$$;

-- Start every seeded account on nothing chosen, and park the three the
-- runner made so they are out of the denominator.
select pg_temp.seed_theme(g, null) from generate_series(1, 12) g;
update public.preferences set theme = null where owner_id in
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');

-- ── the owner's example: three chose, two on one theme ──
do $$
declare got text[];
begin
  perform pg_temp.seed_theme(1, 'coffee');
  perform pg_temp.seed_theme(2, 'coffee');
  perform pg_temp.seed_theme(3, 'wine');
  select coalesce(array_agg(theme), '{}') into got from public.popular_themes();
  assert got = array['coffee'], format('two of three on coffee gave %s', got);
end $$;

-- ── one person is not a crowd, whatever the share ──
do $$
declare got text[];
begin
  perform pg_temp.seed_theme(1, 'coffee');
  perform pg_temp.seed_theme(2, null);
  perform pg_temp.seed_theme(3, null);
  select coalesce(array_agg(theme), '{}') into got from public.popular_themes();
  assert got = '{}', format('one of one on coffee was called popular: %s', got);
end $$;

-- ── a fifth is the line, and the never-chose are not in the denominator ──
do $$
declare got text[];
begin
  -- Ten chose: two on coffee (a fifth, said), one each on eight others.
  perform pg_temp.seed_theme(1, 'coffee');
  perform pg_temp.seed_theme(2, 'coffee');
  perform pg_temp.seed_theme(3, 'rose');
  perform pg_temp.seed_theme(4, 'wine');
  perform pg_temp.seed_theme(5, 'plum');
  perform pg_temp.seed_theme(6, 'navy');
  perform pg_temp.seed_theme(7, 'slate');
  perform pg_temp.seed_theme(8, 'honey');
  perform pg_temp.seed_theme(9, 'royal');
  perform pg_temp.seed_theme(10, 'dark');
  select coalesce(array_agg(theme), '{}') into got from public.popular_themes();
  assert got = array['coffee'], format('two of ten on coffee gave %s', got);
  -- Two more accounts that never chose change nothing: two of ten is
  -- still a fifth of those who chose.
  perform pg_temp.seed_theme(11, null);
  perform pg_temp.seed_theme(12, null);
  select coalesce(array_agg(theme), '{}') into got from public.popular_themes();
  assert got = array['coffee'], format('two of ten on coffee, two never chose, gave %s', got);
  -- An eleventh who chose something else: two of eleven is under a fifth.
  perform pg_temp.seed_theme(11, 'duck');
  select coalesce(array_agg(theme), '{}') into got from public.popular_themes();
  assert got = '{}', format('two of eleven on coffee was said: %s', got);
  -- And a twelfth on coffee: three of twelve is a quarter.
  perform pg_temp.seed_theme(12, 'coffee');
  select coalesce(array_agg(theme), '{}') into got from public.popular_themes();
  assert got = array['coffee'], format('three of twelve on coffee gave %s', got);
end $$;

-- ── most worn first; level ones by name, so the order holds between calls ──
do $$
declare got text[];
begin
  perform pg_temp.seed_theme(1, 'wine');
  perform pg_temp.seed_theme(2, 'wine');
  perform pg_temp.seed_theme(3, 'wine');
  perform pg_temp.seed_theme(4, 'coffee');
  perform pg_temp.seed_theme(5, 'coffee');
  perform pg_temp.seed_theme(6, 'rose');
  perform pg_temp.seed_theme(7, 'rose');
  perform pg_temp.seed_theme(8, 'plum');
  perform pg_temp.seed_theme(9, null);
  perform pg_temp.seed_theme(10, null);
  perform pg_temp.seed_theme(11, null);
  perform pg_temp.seed_theme(12, null);
  select array_agg(theme) into got from public.popular_themes();
  assert got = array['wine', 'coffee', 'rose'], format('order came back as %s', got);
end $$;

-- ── names, never figures and never whose ──
do $$
declare cols text;
begin
  select string_agg(format_type(t.oid, null), ',' order by a.ordinality) into cols
    from pg_proc p
    cross join lateral unnest(p.proallargtypes) with ordinality as a(oid, ordinality)
    join pg_type t on t.oid = a.oid
   where p.proname = 'popular_themes'
     and p.pronamespace = 'public'::regnamespace;
  assert cols = 'text', format('popular_themes returns (%s); it must return names only', cols);
  assert not exists (select 1 from pg_proc where proname = 'theme_counts' and pronamespace = 'public'::regnamespace),
    'theme_counts is still there; a figure the sheet no longer needs is a figure not to keep saying';
end $$;

-- ── a guest may ask, a reader may ask ──
do $$
begin
  assert has_function_privilege('anon', 'public.popular_themes()', 'execute'),
    'popular_themes is closed to guests, who see the same sheet';
  assert has_function_privilege('authenticated', 'public.popular_themes()', 'execute'),
    'popular_themes is closed to readers';
end $$;

delete from auth.users where email like 'popular%@x.com';

select 'all popular theme checks passed' as result;
