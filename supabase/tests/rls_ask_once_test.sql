-- The ask-once rewrite: nothing left unwrapped, and a second run a no-op.
--
-- That no *rule* changed is not proven here but by run.sh's second pass,
-- which applies the rewrite after every migration and runs every RLS test
-- against the result. This file holds the two properties that pass cannot:
-- that the rewrite reached every policy, and that it is safe to re-apply.

\set ON_ERROR_STOP on

create temp table _before as
  select tablename, policyname, qual, with_check from pg_policies where schemaname = 'public';

\ir ../migrations/20260927120000_rls_ask_once.sql

do $$
declare n int; bare text;
begin
  -- Idempotent: the second application changed nothing at all.
  select count(*) into n from (
    (select tablename, policyname, qual, with_check from pg_policies where schemaname = 'public'
     except select * from _before)
    union all
    (select * from _before
     except select tablename, policyname, qual, with_check from pg_policies where schemaname = 'public')
  ) d;
  if n > 0 then
    raise exception 'a second run of the rewrite changed % policies', n;
  end if;

  -- Something was there to rewrite, so the check below is not vacuous.
  select count(*) into n from pg_policies
   where schemaname = 'public' and coalesce(qual, '') || coalesce(with_check, '') ~ 'SELECT auth\.uid\(\)';
  if n = 0 then
    raise exception 'no policy asks for auth.uid() at all — the harness is not testing the rewrite';
  end if;

  -- Nothing per-row is left. A policy added by a later migration fails
  -- here until it is written `(select auth.uid())`.
  select string_agg(tablename || '.' || policyname, ', ') into bare from pg_policies
   where schemaname = 'public'
     and coalesce(qual, '') || ' ' || coalesce(with_check, '')
         ~ '(?<!SELECT )(?<![.\w])(auth\.uid\(\)|(public\.)?is_editor\(\))';
  if bare is not null then
    raise exception 'policies still evaluate per row: %', bare;
  end if;

  -- And none reads its own table. With the calls wrapped, one that does
  -- is refused by Postgres as infinite recursion on every write it guards
  -- — which is what the three daily caps did until their counts moved into
  -- definer functions.
  select string_agg(tablename || '.' || policyname, ', ') into bare from pg_policies
   where schemaname = 'public'
     and coalesce(qual, '') || ' ' || coalesce(with_check, '') ~* ('FROM (public\.)?' || tablename || '\M');
  if bare is not null then
    raise exception 'policies read their own table, which Postgres will refuse: %', bare;
  end if;
end $$;

select 'all ask-once checks passed' as result;
