-- Check-ins: three at one place in a day, and no cap across places.
--
-- The first cut (`20261008130000_checkins.sql`) refused the thirty-first
-- visit in a day, on the guess that more was a script. A day out that
-- walks a whole lane of cafés is not one, and the owner's own test
-- afternoon hit the number. The cap across places goes.
--
-- What replaces it is a rule about one place: three visits in a day.
-- Breakfast, lunch and a drink after work are three; a fourth is a tap
-- that got away. A day is the last twenty-four hours, not the calendar
-- day — the server has no clock of the reader's to draw midnight with,
-- and a rolling day is the same rule for Hanoi and Melbourne. The
-- ten-minute rule stays beside it; the two answer different slips.
--
-- `PER_PLACE_PER_DAY` in `app/src/lib/checkin.ts` is the app's copy of
-- the three, and the pill stops offering "again" at it, so this refusal
-- is reached only from a second phone. Same definer function, same
-- policy; only the function body changes, so `create or replace` is
-- the whole migration.

create or replace function public.may_check_in(p_place uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    select count(*) from public.checkins c
    where c.user_id = (select auth.uid())
      and c.place_id = p_place
      and c.at > now() - interval '1 day'
  ) < 3
  and not exists (
    select 1 from public.checkins c
    where c.user_id = (select auth.uid())
      and c.place_id = p_place
      and c.at > now() - interval '10 minutes'
  );
$$;
