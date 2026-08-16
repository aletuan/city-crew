-- Two questions, two columns: how a place got in, and who did it.
--
-- `source` answered a bit of both and neither cleanly. It said 'phone' for
-- a visitor's suggestion, which is a *channel*, and it said nothing at all
-- about the person — while `submitted_by` carried an account, but only for
-- that one channel. So "who imported these forty places" had no answer and
-- "how did this arrive" had one that changed shape depending on the answer.
--
--   channel   how it arrived: mobile | desk | scan | seed
--   added_by  the account that did it, whatever the channel
--
-- 'phone' becomes 'mobile' with it — the word the app is called by, and
-- the one asked for.
--
-- `seed` stays a channel even though it is not one anybody can use today.
-- Twenty-four rows came in that way and dropping the word would make them
-- either lie or go blank, which is a worse record than an obsolete term.

alter table public.places rename column source to channel;
alter index if exists places_source_idx rename to places_channel_idx;

alter table public.places drop constraint if exists places_source_check;
update public.places set channel = 'mobile' where channel = 'phone';
alter table public.places
  add constraint places_channel_check
  check (channel is null or channel in ('mobile', 'desk', 'scan', 'seed'));

comment on column public.places.channel is
  'How this row arrived: mobile | desk | scan | seed. Null only on rows that predate the column and could not be attributed.';

-- ─────────────────────────────── who did it ──────────────────────────────
--
-- Separate from `submitted_by`, which stays exactly what it was and must:
-- it means "a visitor suggested this from the app", and three things read
-- it that way — the daily suggestion cap, the RLS policy that lets a
-- contributor see their own pending row, and the app's "only you can see
-- this". `added_by` makes no such claim. It records who performed the
-- insert, including editors, for whom none of those three rules apply.
--
-- For a mobile row the two hold the same account, and that is not
-- duplication: one is an audit fact, the other is a contribution with
-- rules attached to it.

alter table public.places
  add column if not exists added_by uuid references auth.users(id) on delete set null;

comment on column public.places.added_by is
  'The account that created this row, any channel. See submitted_by for the narrower "a visitor suggested this" meaning.';

create index if not exists places_added_by_idx on public.places (added_by);

-- Backfill: the mobile rows only, where the account is recorded rather
-- than reasoned about.
--
-- Nothing for desk and scan, deliberately. Both are gated on the editors
-- allow-list, that list holds exactly one account today, and it was
-- created before every desk and scan row — so the arithmetic points one
-- way. But the allow-list keeps no history, so "one editor now" is not
-- "one editor then", and the difference between those two matters more
-- here than it did for the channel: getting a channel wrong mislabels a
-- pipeline, getting this wrong puts a named person's handle on work they
-- may not have done. Blank says what is actually known.
--
-- Nothing for seed either, and that one is not even uncertain: the
-- bootstrap ran as a script under the service role. No account did it.
update public.places set added_by = submitted_by where channel = 'mobile';
