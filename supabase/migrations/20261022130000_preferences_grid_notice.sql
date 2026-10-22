-- The grid notice is closed once, on every phone (22 Oct 2026).
--
-- A collection opens as a grid, and a notice under its card says where the
-- way back to the cards is, until the reader closes it with its ×. Whether
-- they had was kept on the phone, per reader. The owner asked for one ×
-- to be enough on every phone the account is signed into, so it is kept
-- on the account: a column on `preferences`, the row that is already
-- "what this person told us", under policies that already name the
-- caller (`preferences_test.sql`). The theme took the same road on 12 Oct.
--
-- A time rather than a flag: null is "never closed", and a time says when
-- without a second column, should anyone ever need to tell a notice
-- closed before a change to it from one closed after.
alter table public.preferences
  add column if not exists grid_notice_closed_at timestamptz;

comment on column public.preferences.grid_notice_closed_at is
  'When the reader closed the collection grid notice with its ×; null until they do.';
