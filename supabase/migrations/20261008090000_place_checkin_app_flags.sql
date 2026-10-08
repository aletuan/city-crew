-- The Check-in pill on a place's detail screen, as a switch.
--
-- The app ships with `place_checkin` off (see `app/src/lib/flags.ts`):
-- what the pill opens is not built, and the tap only says so. This row
-- turns the pill on, so the placeholder can be judged where it will
-- live rather than in a mockup — and is the row to flip back the day it
-- misleads, on every phone at once, with nothing to publish:
--
--     update app_flags set enabled = false where key = 'place_checkin';
--
-- `on conflict do nothing`, like the first row: a value already set by
-- hand in the SQL editor outranks what a migration thinks it should be.
insert into public.app_flags (key, enabled, note) values
  ('place_checkin', true,
   'Draw the Check-in pill on a place''s detail screen. A placeholder: the tap says the feature is on its way. Off hides it everywhere.')
on conflict (key) do nothing;
