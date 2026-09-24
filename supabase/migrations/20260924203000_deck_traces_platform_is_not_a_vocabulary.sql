-- The platform check was a guess, and it threw every row away.
--
-- `deck_traces` shipped with `platform in ('ios', 'android')`, copied from
-- `startup_traces` because it was the table this one was modelled on. The
-- copy carried no reasoning with it, and it was wrong: every insert the
-- app made was refused with
--
--   new row for relation "deck_traces" violates check constraint
--   "deck_traces_platform_check"
--
-- and `reportDeck` swallows failures by design, so the table stayed empty
-- and said nothing about why. Twelve minutes of POSTs, all 400, all
-- silent — found in the edge and Postgres logs, not in the app.
--
-- A trace table exists to receive whatever the phone says. Refusing a row
-- because the platform is spelled in a way this file did not anticipate is
-- the constraint defeating the thing it is attached to: the one value that
-- would have explained the failure is the value it would not store.
--
-- So the check bounds the length and nothing else. That still stops the
-- open insert being used to store arbitrary payloads, which is all the
-- original was for.
--
-- `startup_traces` keeps its enumeration. It has been filing rows for
-- weeks against exactly those two values, so there is nothing there to
-- learn and no reason to touch a constraint that is not failing.

alter table public.deck_traces drop constraint if exists deck_traces_platform_check;
alter table public.deck_traces add constraint deck_traces_platform_check
  check (length(platform) between 1 and 20);
