-- Who did the desk imports and the scan runs.
--
-- `20260816140000_place_channel.sql` left `added_by` blank for both, and
-- said why: the arithmetic pointed at the single editor account, but the
-- allow-list keeps no history, and putting a person's handle on work they
-- may not have done is a different kind of wrong from mislabelling a
-- pipeline. That was the right default without an answer. There is one
-- now — the account holder confirmed both channels were theirs — so the
-- rows can say so.
--
-- Derived rather than hardcoded. A uuid pasted into a migration is a fact
-- about one database that every other copy would inherit as fiction; this
-- reads the allow-list the two channels are actually gated on. And it only
-- acts when that list resolves to exactly one account, because "one editor
-- now" is the whole basis of the inference: with two, nothing here can say
-- which of them pressed Scan.
--
-- Seed keeps its blank, and that one is not uncertain at all: the
-- bootstrap ran as a script under the service role. No account did it.

do $$
declare
  resolved int;
  actor uuid;
begin
  -- The harness this runs under in CI stubs the catalog tables but not the
  -- allow-list; a migration that assumed it would fail the build rather
  -- than skip a backfill it has no input for.
  if to_regclass('public.editors') is null then
    raise notice 'no editors table — skipping the added_by backfill';
    return;
  end if;

  -- Counted first and fetched second, rather than one aggregate over both:
  -- uuid has no min(), and picking "the first row of the join" is exactly
  -- the guess the count is here to prevent.
  select count(*) into resolved
    from public.editors e
    join auth.users u on lower(u.email) = lower(e.email);

  if resolved <> 1 then
    raise notice 'the allow-list resolves to % accounts, not 1 — skipping', resolved;
    return;
  end if;

  select u.id into actor
    from public.editors e
    join auth.users u on lower(u.email) = lower(e.email);

  update public.places
     set added_by = actor
   where added_by is null
     and channel in ('desk', 'scan');
end $$;
