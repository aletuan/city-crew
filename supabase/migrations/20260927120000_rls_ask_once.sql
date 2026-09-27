-- Every RLS policy asks who you are once per query, not once per row.
--
-- ── what was slow ──
--
-- A policy that says `submitted_by = auth.uid()` is an expression, and
-- Postgres evaluates an expression for every row it checks. `auth.uid()`
-- reads the JWT out of a setting and parses it as JSON, so the catalog
-- query — 295 places and 1,770 photos for Ho Chi Minh City, where the
-- photo policies look the place up again and re-apply the place policy
-- there — parsed the same token thousands of times to get the same answer.
-- Supabase's performance advisor flagged 43 policies (`auth_rls_initplan`).
--
-- Written as `(select auth.uid())`, the call is an uncorrelated subquery:
-- the planner makes it an InitPlan, runs it once, and every row compares
-- against the remembered value. Same for `is_editor()`, which takes no
-- arguments and so cannot differ between rows either.
--
-- ── measured, 27 September 2026 ──
--
-- The app's catalog query, signed in, seven runs each, median. Production,
-- HCMC as it stands (895,571 bytes, identical in every case):
--
--   no RLS at all (the floor)       28 ms
--   these policies, before          51 ms
--   these policies, rewritten       38 ms   (this file applied in a
--                                            transaction, then rolled back)
--
-- The same dry run rewrote 55 of the 68 policies (the 43 the advisor named,
-- and those calling only `is_editor()`), left none per-row and none reading
-- its own table, and made 20 lists for one account before refusing the 21st.
--
-- A replica of both tables with these exact policies, on a laptop roughly
-- three times faster than production, at larger catalogs:
--
--   places / photos     floor    before    after
--    1,000 /  6,000       39        63        45
--    3,000 / 18,000      118       198       131
--    9,000 / 54,000      394       680       401
--
-- So the policies' own cost goes from 60–90% on top of the floor to under
-- 15%, at every size. What is left is building the JSON, which is not
-- RLS's to fix.
--
-- ── why a loop and not 43 hand-written ALTERs ──
--
-- Rewriting the text Postgres already holds, rather than retyping each
-- policy, means nothing can be mistyped: the only change to any policy is
-- the wrapping, and the rule itself is the one that was there. It also
-- means the same file is correct against production and against the test
-- harness, which applies a subset of the migrations — and
-- `supabase/tests/run.sh` runs the whole RLS suite a second time with this
-- applied after every migration, which is the proof that no rule changed.
--
-- Idempotent: a call already inside `SELECT ` is left alone, so a second
-- run alters nothing. Only `public`; the storage schema's policies are not
-- ours to alter from a migration.
--
-- A policy written after this one should use `(select auth.uid())` from the
-- start. `rls_ask_once_test.sql` fails if one does not.
--
-- ── the three caps that read their own table, first ──
--
-- Postgres refuses a policy that reaches back into its own table — but it
-- only looks when the policies it would apply there contain a subquery.
-- Three daily caps count the caller's own rows inline, inside an INSERT
-- policy on the same table: 20 lists, 1,000 history events and 20 friend
-- requests a day. They worked because the read policies they met had no
-- subquery in them. `(select auth.uid())` *is* a subquery, so wrapping
-- those read policies turned every one of these inserts into
-- "infinite recursion detected in policy" — found by the second pass of
-- `run.sh` before it reached production, where it would have stopped
-- anyone making a list.
--
-- The count moves into a definer function, the way
-- `own_collection_places_today` and `trip_invite_count` already do it for
-- the same reason. That is the same number, not merely a similar one: the
-- inline count saw the caller's rows through RLS, and each table's read
-- policy gives an owner every row of their own (`owners read their
-- collections`, `owners read their events`, `parties see their own
-- edges`), so filtering on the caller gives the definer the same rows.
--
-- Only the count is replaced, matched on its exact shape; the rest of each
-- policy — the ownership check, `history_on`, `blocked_with` — is left as
-- the policy has it. A count in any other shape is left alone, and the
-- test fails on it rather than this guessing.
--
-- Executable by anon as well, for the reason the allowlist in
-- `function_grants_test.sql` gives: each policy is `to public`, and a
-- guest's insert must be refused, not fail on a missing grant.
--
-- Each function is created only once its table exists, because the test
-- harness applies a subset of the migrations in stages.

do $$
declare
  cap record;
begin
  for cap in select * from (values
    ('collections',  'own_collections_today',     'c', 'owner_id'),
    ('place_events', 'own_place_events_today',    'e', 'user_id'),
    ('friendships',  'own_friend_requests_today', 'f', 'requester')
  ) v(tbl, fn, alias, col)
  loop
    continue when to_regclass('public.' || cap.tbl) is null;
    execute format($f$
      create or replace function public.%1$I()
      returns integer language sql stable security definer set search_path = public as $b$
        select count(*)::integer from public.%2$I %3$s
         where %3$s.%4$I = auth.uid() and %3$s.created_at > now() - interval '1 day';
      $b$;
      revoke all on function public.%1$I() from public;
      grant execute on function public.%1$I() to anon, authenticated;
    $f$, cap.fn, cap.tbl, cap.alias, cap.col);
  end loop;
end $$;

-- ── then every policy ──

do $$
declare
  r record;
  q text;
  c text;
begin
  for r in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
  loop
    q := r.qual;
    c := r.with_check;

    -- The three self-counting caps, above. `\s+` because Postgres prints
    -- the stored subquery across lines.
    if r.tablename in ('collections', 'place_events', 'friendships') then
      c := regexp_replace(c,
        '\(\s*SELECT count\(\*\) AS count\s+FROM ' || r.tablename || ' (\w)\s+WHERE \(\(\1\.(owner_id|user_id|requester) = auth\.uid\(\)\) AND \(\1\.created_at > \(now\(\) - ''1 day''::interval\)\)\)\)',
        '(SELECT ' || case r.tablename
          when 'collections' then 'own_collections_today'
          when 'place_events' then 'own_place_events_today'
          else 'own_friend_requests_today' end || '())');
    end if;

    -- Not after `SELECT ` (already wrapped), and not after a name
    -- character or a dot, so `public.is_editor()` is taken whole rather
    -- than split into `public.(SELECT is_editor())`.
    q := regexp_replace(regexp_replace(q,
           '(?<!SELECT )(?<![.\w])(auth\.uid\(\))', '(SELECT \1)', 'g'),
           '(?<!SELECT )(?<![.\w])((?:public\.)?is_editor\(\))', '(SELECT \1)', 'g');
    c := regexp_replace(regexp_replace(c,
           '(?<!SELECT )(?<![.\w])(auth\.uid\(\))', '(SELECT \1)', 'g'),
           '(?<!SELECT )(?<![.\w])((?:public\.)?is_editor\(\))', '(SELECT \1)', 'g');

    if q is distinct from r.qual then
      execute format('alter policy %I on public.%I using (%s)', r.policyname, r.tablename, q);
    end if;
    if c is distinct from r.with_check then
      execute format('alter policy %I on public.%I with check (%s)', r.policyname, r.tablename, c);
    end if;
  end loop;
end $$;
