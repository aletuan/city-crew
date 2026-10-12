-- The theme follows the account (12 Oct 2026).
--
-- It was a device setting: NSUserDefaults for the look, AsyncStorage for
-- the ground. Two people on one phone shared it, and one person on two
-- phones chose it twice. The owner asked for it to follow the account
-- instead, so it is a column on `preferences`, the row that is already
-- "what this person told us" and already nobody else's business — the
-- table's policies name the caller, and `preferences_test.sql` holds
-- them to it, so nothing new is needed for the theme to be private.
--
-- Plain text, not an enum or a check against the app's list of looks:
-- that list grew by eleven in two days, and a constraint here would have
-- to be migrated every time it grows. A value a build does not know is
-- left alone by that build (`isPref` in lib/look), not read as Auto and
-- not overwritten — so a newer build's choice survives an older one. The
-- length check is the one honest limit: no look's name is longer than a
-- word, and a column that could hold a paragraph invites one.
--
-- Null is "never chose", which the app treats differently from any
-- choice: the first sign-in takes the device's theme and keeps it, so a
-- new account never restarts on arrival.
alter table public.preferences
  add column if not exists theme text
    constraint preferences_theme_short check (theme is null or length(theme) <= 32);

comment on column public.preferences.theme is
  'The app''s own Pref string (lib/look); null until the account chooses one.';
