-- The theme count: what it says, what it keeps quiet, and who may ask.
--
-- Twenty-four accounts of its own, so the threshold can be stood on from
-- both sides: twenty on one theme (said), three on another (not said),
-- one that never chose (not a vote). All removed at the end, and
-- `preferences` rows go with them, so the blocks after this one count
-- what they counted before.

insert into auth.users (id, email)
select md5('theme-counts-' || g)::uuid, 'theme' || g || '@x.com'
from generate_series(1, 24) g;

insert into public.preferences (owner_id, theme)
select md5('theme-counts-' || g)::uuid,
       case when g <= 20 then 'coffee' when g <= 23 then 'wine' else null end
from generate_series(1, 24) g
on conflict (owner_id) do update set theme = excluded.theme;

-- ── says the theme twenty wear, and only that ──
do $$
declare got record; n int := 0;
begin
  for got in select * from public.theme_counts() loop
    n := n + 1;
    assert got.theme = 'coffee', format('a theme under the threshold was said: %s', got.theme);
    assert got.wearers = 20, format('coffee counted %s, not 20', got.wearers);
  end loop;
  assert n = 1, format('%s rows; wine (3) and null (1) must stay unsaid', n);
end $$;

-- ── the twentieth wearer is what turns it on ──
do $$
declare n int;
begin
  update public.preferences set theme = 'rose'
   where owner_id = md5('theme-counts-20')::uuid;
  select count(*) into n from public.theme_counts();
  assert n = 0, format('nineteen on coffee was said (%s rows)', n);
  update public.preferences set theme = 'coffee'
   where owner_id = md5('theme-counts-20')::uuid;
end $$;

-- ── a change of theme moves the count, never adds to it ──
do $$
declare n int;
begin
  update public.preferences set theme = 'coffee'
   where owner_id in (md5('theme-counts-21')::uuid, md5('theme-counts-22')::uuid);
  select wearers into n from public.theme_counts() where theme = 'coffee';
  assert n = 22, format('two wearers moving to coffee gave %s, not 22', n);
end $$;

-- ── totals, never whose ──
--
-- The return type is the privacy boundary: a name and an integer, no
-- column a uuid could sit in.
do $$
declare cols text;
begin
  select string_agg(format_type(t.oid, null), ',' order by a.ordinality) into cols
    from pg_proc p
    cross join lateral unnest(p.proallargtypes) with ordinality as a(oid, ordinality)
    join pg_type t on t.oid = a.oid
   where p.proname = 'theme_counts'
     and p.pronamespace = 'public'::regnamespace;
  assert cols = 'text,integer', format('theme_counts returns (%s); it must return a name and a count only', cols);
end $$;

-- ── a guest may ask, a reader may ask ──
do $$
begin
  assert has_function_privilege('anon', 'public.theme_counts()', 'execute'),
    'theme_counts is closed to guests, who see the same sheet';
  assert has_function_privilege('authenticated', 'public.theme_counts()', 'execute'),
    'theme_counts is closed to readers';
end $$;

delete from auth.users where email like 'theme%@x.com';

select 'all theme count checks passed' as result;
