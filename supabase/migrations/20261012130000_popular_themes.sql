-- Which themes are popular — by share, and said as names (12 Oct 2026).
--
-- `theme_counts()` (20261012120000, the same morning) said a figure per
-- theme once twenty accounts wore it, and the app took the three largest.
-- The owner's correction: popular is a share of the people, not a count
-- of them. Two of three readers on one theme is two thirds, and that is
-- popular on the day there are three readers; twenty of ten thousand is
-- a fifth of a percent, and is not. A fixed count is wrong at both ends.
--
-- ── the rule ──
--
-- A theme is popular when at least one in five of the accounts that
-- chose a theme wear it, and at least two do. The share is what the
-- owner asked for, against the accounts that chose — null is "never
-- chose", and the default is not a vote, so it is not in the denominator
-- either. The two is what keeps one person from being a crowd: with three
-- accounts, one on Wine is a third, and "Wine is popular" would be a
-- sentence about one reader. One in five, because the sheet offers
-- seventeen settings and a look worn by a fifth of everyone who chose is
-- worn at more than three times its even share; at three readers it is
-- the owner's two-of-three, and at ten thousand it is the two or three
-- looks that are actually worn. The app shows at most three of what this
-- says, which is its rule and not this one's.
--
-- ── what leaves the server ──
--
-- Names, in order of share, and nothing else. The count function needed
-- a twenty-wearer floor because a small public figure is a sentence
-- about one person — "1 wears Wine" among five accounts. With no figure
-- there is no such sentence: what a guest can learn is that Coffee is
-- worn by a fifth or more of those who chose, and that Coffee has more
-- than Wine. Security definer so it can see past the owner-only policies
-- on `preferences`, and a return type of one text column is why that is
-- safe. Callable signed out: the sheet shows a guest the same cards.
--
-- The count function goes. Nothing else called it, and a public figure
-- the sheet no longer needs is a figure not to keep saying.

drop function if exists public.theme_counts();

create or replace function public.popular_themes()
returns table (theme text)
language sql
stable
security definer
set search_path = public
as $$
  with chosen as (
    select p.theme from public.preferences p where p.theme is not null
  ),
  counted as (
    select c.theme, count(*) as wearers from chosen c group by c.theme
  )
  select k.theme
  from counted k
  where k.wearers >= 2
    and k.wearers * 5 >= (select count(*) from chosen)
  order by k.wearers desc, k.theme asc;
$$;

comment on function public.popular_themes() is
  'Themes worn by at least a fifth of the accounts that chose one, and by at least two, most worn first; see 20261012130000_popular_themes.';

revoke all on function public.popular_themes() from public;
grant execute on function public.popular_themes() to anon, authenticated;
