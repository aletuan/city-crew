-- How many accounts wear each theme — the one number the Theme sheet may
-- say about other people (12 Oct 2026).
--
-- The owner asked whether the looks could be ordered, or badged, by how
-- often they are chosen. Ordered, no: a picker of fourteen cards lives on
-- spatial memory, and a grid that reshuffles under the finger is the
-- personalised menu Office 2000 shipped and withdrew (Findlater &
-- McGrenere, 2004: a static menu beats an adaptive one; a split menu
-- beats both). Badged, yes, on a few cards, with the grid left alone —
-- "Popular" on the two or three most worn — which is what this answers.
--
-- ── what is counted ──
--
-- What people *wear*, not what they *tap*. A tap counter that only ever
-- goes up measures trying — a reader who tries all fourteen in a minute
-- gives each one point and the one they keep for a month nothing more —
-- and it freezes the ranking in favour of whichever looks came first,
-- since a look added later can never catch up without a decay rule.
-- `preferences.theme` already holds every account's current choice: it
-- counts what is kept, a change moves one from the old to the new, a
-- newer look is level with the oldest from the day it ships, and nothing
-- new is collected. Null is "never chose" and is not a vote for the
-- default. Guests are not counted; for "which looks do people like" that
-- is enough.
--
-- ── what may be said ──
--
-- Totals, and nothing else. Security definer so it can see past the
-- owner-only policies on `preferences`, and its return type is why that
-- is safe: a theme's name and an integer, with no way to ask whose. And
-- only once a theme has twenty wearers. Below that the figure is the
-- first handful of testers, and with a dozen accounts in all "1 wears
-- Wine" is a sentence about one person. Twenty is where no single reader
-- can be read out of a count. The function says nothing until then, so
-- the app shows nothing until then, and the threshold is here rather
-- than in the app because it is the privacy rule and not a display one.
--
-- Callable signed out: the sheet shows a guest the same cards it shows an
-- account holder, and a badge on them is a fact about the catalogue, not
-- about the guest. `function_grants_test` lists it for that reason.

create or replace function public.theme_counts()
returns table (theme text, wearers integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.theme, count(*)::integer
  from public.preferences p
  where p.theme is not null
  group by p.theme
  having count(*) >= 20;
$$;

comment on function public.theme_counts() is
  'Accounts wearing each theme, for themes worn by at least twenty; see 20261012120000_theme_counts.';

revoke all on function public.theme_counts() from public;
grant execute on function public.theme_counts() to anon, authenticated;
