-- A comment on `cities`, and nothing else: the first file to go through
-- `apply-migrations.yml` (25 Nov 2026). Until this one the workflow had
-- only ever found nothing to apply, so its approval, its transaction and
-- the wait the function deploy and the EAS Update do for it had been
-- run against stand-ins, never against the live project.
--
-- Chosen because it cannot matter: no row, no column, no policy and no
-- grant changes, the statement is the same run twice, and nothing reads a
-- table's comment. The words are true of the table, so the file can stay
-- once it has done its job.

comment on table public.cities is
  'The cities the catalog covers. A place belongs to one (places.city_id); the app shows one at a time.';
