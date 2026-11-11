-- 'system' becomes null; every other theme, and null, is left as it was.
-- Brings its own five accounts and removes them at the end.

insert into auth.users (id, email)
select md5('unchosen-theme-' || g)::uuid, 'unchosen' || g || '@x.com'
from generate_series(1, 5) g;

insert into public.preferences (owner_id, theme) values
  (md5('unchosen-theme-1')::uuid, 'system'),
  (md5('unchosen-theme-2')::uuid, 'system'),
  (md5('unchosen-theme-3')::uuid, 'slate'),
  (md5('unchosen-theme-4')::uuid, 'light'),
  (md5('unchosen-theme-5')::uuid, null)
on conflict (owner_id) do update set theme = excluded.theme;

\ir ../migrations/20261111035923_unchosen_theme_follows_slate.sql

do $$
begin
  assert (select count(*) from public.preferences
           where owner_id in (select md5('unchosen-theme-' || g)::uuid from generate_series(1, 5) g)
             and theme = 'system') = 0, 'a system theme was left behind';
  assert (select count(*) from public.preferences
           where owner_id in (select md5('unchosen-theme-' || g)::uuid from generate_series(1, 5) g)
             and theme is null) = 3, 'expected the two system rows and the null row to be null';
  assert (select theme from public.preferences where owner_id = md5('unchosen-theme-3')::uuid) = 'slate', 'a chosen look changed';
  assert (select theme from public.preferences where owner_id = md5('unchosen-theme-4')::uuid) = 'light', 'light changed';
end $$;

delete from public.preferences where owner_id in (select md5('unchosen-theme-' || g)::uuid from generate_series(1, 5) g);
delete from auth.users where id in (select md5('unchosen-theme-' || g)::uuid from generate_series(1, 5) g);
