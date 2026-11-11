-- An account that never chose a theme opens in Slate too (11 Nov 2026).
--
-- #1281 (9 Nov) made Slate the look an install wears before anyone has
-- chosen one, and the owner's rule was that every install that never chose
-- a colour moves to Slate. Accounts did not follow. Since the theme began
-- following the account (20261012014333_preferences_theme), the first
-- sign-in on a device saved that device's theme to `preferences.theme` when
-- the account had none — and before #1281 that was almost always 'system'
-- (Automatic), whether or not the reader ever opened the setting. On launch
-- `ThemeAccountSync` reads 'system' back, differs from the Slate the install
-- opened in, and restarts the app into Automatic: a relaunch the reader did
-- not ask for, and never Slate.
--
-- Measured on amdvitzpogaejzzqroco on 11 Nov 2026, before this ran: of 94
-- rows, 46 held 'system', 28 null, 20 a named look or 'light'. Ten of the
-- 46 had a session refreshed after #1281's update went out (21:10 UTC,
-- 8 Nov), so they were most likely restarted into Automatic already and
-- their device keeps it; on their next launch the sync finds null here and
-- writes 'system' back. This moves the other 36.
--
-- Null is "never chosen": the next launch keeps the device's look (Slate
-- on an install that never chose) and writes it here (rule 4 in
-- themeAccountSync). The server cannot tell a reader who tapped Automatic
-- from one whose first sign-in wrote it, so a reader who did choose
-- Automatic on purpose is moved too and can choose it again; the owner
-- took that trade on 11 Nov 2026. Named looks and 'light'/'dark' are
-- choices the old default never wrote, and are left alone.
--
-- Applied to amdvitzpogaejzzqroco on 11 Nov 2026 as 20261111035923
-- unchosen_theme_follows_slate: 46 rows to null, none 'system' left.
-- Re-runnable in the test database; on production it ran once, since a
-- second run would clear a 'system' chosen after it.

update public.preferences
   set theme = null
 where theme = 'system';
