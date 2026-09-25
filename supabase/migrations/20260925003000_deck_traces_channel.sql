-- Which build filed the row.
--
-- `DECK_TRACE` and `DECK_TRACE_UPLOAD` are hand-held on at the moment,
-- against the rule the launch trace follows, because the phone the deck
-- is being investigated from appeared to be running a production-channel
-- build — the one install whose numbers are wanted being the one install
-- the rule excludes.
--
-- "Appeared to be" is the problem. That was inferred twice from the
-- silence of `startup_traces`, and the inference was wrong once. A row
-- that says which channel it came from settles it in one visit, and
-- settles the question the constants exist for: whether putting them back
-- to `!IS_PRODUCTION_CHANNEL` costs the investigation its only device.
--
-- Nullable, because `Updates.channel` is null for a build that carries no
-- stamp — Expo Go, or a bare dev build — and null is the honest answer
-- there rather than a word invented for it.

alter table public.deck_traces
  add column if not exists channel text
  check (channel is null or length(channel) <= 40);
