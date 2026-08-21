-- `updated_at` starts telling the truth.
--
-- Four tables carry the column — `places`, `trips`, `preferences` and
-- `category_terms` — and all four default it to `now()` on insert and then
-- never touch it again. So it has meant "when this row was created" on
-- everything except the rows whose writer happened to remember to set it,
-- which is `importPlace` and nothing else.
--
-- ── what that cost ──
--
-- Thirty-three places were edited by hand on 2026-08-20 — twenty
-- categories and thirteen names. Three rows have an `updated_at` from that
-- day. The other thirty still claim they were last touched whenever they
-- were imported, so the dashboard's recently-changed view never showed
-- them and anything syncing on a timestamp would have skipped every one.
--
-- ── all four, and what the trips migration already said about this ──
--
-- `20260817000000_trips.sql` decided this deliberately and wrote down the
-- condition for revisiting it: *"`updated_at` is maintained by the client
-- on save rather than by a trigger … A trigger would be tidier and is
-- worth having when something other than the app writes here; nothing does
-- yet."* That is not an objection, it is a note that the cost had not been
-- earned. Table by table, it has now:
--
--   `places`          the condition is met, with thirty rows to show for
--                     it — the desk and hand-run SQL write here, and
--                     neither remembers the column
--   `category_terms`  edited from the desk by design; that is the whole
--                     point of the table
--   `preferences`     `savePreferences` already sets it by hand on every
--                     write, so the trigger makes that redundant rather
--                     than necessary — and removes the chance of the next
--                     writer forgetting
--   `trips`           the condition is still not met; nothing but the app
--                     writes here. Included because it is the tidiness
--                     that comment called worth having, and because a
--                     column that means "when this changed" on three
--                     tables and "when this was written" on the fourth is
--                     a column nobody can read without checking which
--                     table they are looking at
--
-- ── the past is left alone ──
--
-- No backfill. The rows are stale by an amount nobody recorded, and the
-- only honest values to write would be the ones we do not have; `now()`
-- would say thirty places changed at the instant of this migration, which
-- is a different false statement from the one already there and a harder
-- one to notice later. This fixes what happens next.

create or replace function public.stamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Not callable over the wire. Any function in `public` with execute
-- granted is an endpoint at /rest/v1/rpc/stamp_updated_at, and this one
-- has no business being one — the same reasoning `stamp_curator` carries,
-- which the profiles migration learned from an advisory.
--
-- Deliberately *not* `security definer`, unlike `stamp_curator`: that one
-- reads `profiles` and needs to see past RLS. This one writes a column on
-- the row already being written and needs no privilege at all, so it is
-- not given any.
revoke execute on function public.stamp_updated_at() from anon, authenticated, public;

-- `before update`, so an insert keeps whatever it was given. That matters
-- for one caller: `importPlace` sets `updated_at` explicitly when it
-- creates a place, and a trigger on insert would overwrite it with a value
-- a few milliseconds different for no reason.
--
-- ── the guard that could not be written, and what it costs ──
--
-- This wanted `when (new is distinct from old)`, so a save that changes
-- nothing would leave the timestamp alone. Postgres refuses it:
--
--   BEFORE trigger's WHEN condition cannot reference NEW generated columns
--
-- `places.needs_classification` is generated from `categories` and
-- `vibe_tags`, and it is the only generated column in the database — so
-- the one table that most needs this stamping is the one table that
-- cannot have the guard.
--
-- Moving the same test into the function body looks like the obvious way
-- round and is worse. In a BEFORE trigger a generated column is not yet
-- computed, so `new.needs_classification` is null while the old row holds
-- a real value; `new is distinct from old` would therefore be true on
-- every update, always. That is not a guard, it is a guard-shaped comment
-- that never fails — the kind of thing that reads as covered and is not.
--
-- So the cost is stated instead of hidden: **an update that changes
-- nothing still moves `updated_at`**. A dashboard save with no edits will
-- look like an edit. That is a smaller and much louder wrong than the one
-- being fixed, where thirty real edits left no trace at all.

drop trigger if exists places_stamp_updated_at on public.places;
create trigger places_stamp_updated_at
  before update on public.places
  for each row execute function public.stamp_updated_at();

drop trigger if exists trips_stamp_updated_at on public.trips;
create trigger trips_stamp_updated_at
  before update on public.trips
  for each row execute function public.stamp_updated_at();

drop trigger if exists preferences_stamp_updated_at on public.preferences;
create trigger preferences_stamp_updated_at
  before update on public.preferences
  for each row execute function public.stamp_updated_at();

drop trigger if exists category_terms_stamp_updated_at on public.category_terms;
create trigger category_terms_stamp_updated_at
  before update on public.category_terms
  for each row execute function public.stamp_updated_at();
