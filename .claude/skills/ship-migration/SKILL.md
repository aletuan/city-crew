---
name: ship-migration
description: Write a City Crew Supabase migration, test it against the throwaway Postgres the `migrations` CI job uses, apply it to the live project amdvitzpogaejzzqroco, check the repo still describes what is live, and regenerate the app's database types. Use for any schema, policy, function or data change to the production database.
disable-model-invocation: true
---

# Ship a migration

CLAUDE.md says it in one line: **CI tests migrations; nothing applies them
to the live project.** A file merged into `supabase/migrations/` is a
migration that has run in a throwaway Postgres, twice, and nowhere else.
This skill is the rest of the way, and its last step is the one that has
been skipped before: checking that what is live and what is in the tree
still agree.

User-only because step 5 writes to production, for every reader.

## 1. Write the file

`supabase/migrations/<yyyymmddhhmmss>_<name>.sql`, `<name>` in snake_case
and saying what the change does (`lists_stay_public_around_unlive_places`,
not `fix_rls`). The timestamp is provisional: step 6 replaces it.

Open with a comment that carries the reasoning, the way
`20261024100000_fetch_place_allowance.sql` does: what was wrong, the
numbers and where they were measured, the alternative that was rejected
and why. The SQL says what; the header says why it is that SQL.

Write it to be re-runnable where Postgres allows (`create or replace`,
`if not exists`, `drop policy if exists` before `create policy`).
`run.sh` applies some migrations twice on purpose.

A migration that adds or replaces a policy runs again under the ask-once
rewrite (`*_rls_ask_once.sql`, applied after every migration in the
second pass). If a policy calls `auth.uid()` or `is_editor()`, write it
as `(select auth.uid())` or `(select is_editor())`, the form the rewrite
produces. Otherwise the second pass rewrites it for you, and production,
which ran the rewrite once in September and never again, gets the slow
per-row form you did not test.

## 2. Write its test, and put it in `run.sh`

`run.sh` does not glob the whole directory. It names each migration and
the order it runs in, so **a migration not listed in `run.sh` is not
tested at all**, and the `migrations` job stays green without it.

- `supabase/tests/<name>_test.sql`: assert what the migration did.
  Exercise a policy as the role that meets it, don't just read its text;
  `profiles_rls_test.sql` shows how. Raise on failure (`do $$ … raise
  exception … $$`) so `ON_ERROR_STOP` turns it red.
- Add a block at the end of `supabase/tests/run.sh`, after the last `echo
  "→ …"`. Give it a dated comment saying what it tests and why it sits
  where it does, then run the migration, then the test. Copy the shape of
  the block above it.

Check the test against a broken migration before you trust it: comment
out the line the test is about, run step 3, and see it go red.

## 3. Run both passes

```bash
supabase/tests/run.sh
ASK_ONCE_EVERY_STEP=1 supabase/tests/run.sh
```

CI runs both. Each takes about 9 s in a cloud container (24 Oct 2026),
and Postgres 16 is installed there. With no `PG_URL`, the script makes
and removes its own cluster. Both must exit 0.

## 4. Stop and confirm

Show the user the SQL that is about to run on production, with one line
on what it changes for a reader, and wait for a yes. Before you ask, say
plainly if the migration:
- drops or rewrites data (`delete`, `update` without a narrow `where`,
  `drop column`, `drop table`, `truncate`)
- narrows a policy, so that something readable or writable now is not
- takes a lock on a large table (`alter table … add column … default`
  with a volatile default, or a new index without `concurrently`)

A migration that app code depends on must be live **before** that code
merges. A merge to main publishes an EAS Update to every installed
build within minutes (`app-preview.yml`), and that code queries the live
schema. So the usual order is: open the PR, wait for a green
`migrations` job, apply, then merge.

## 5. Apply

Supabase MCP, `apply_migration`:
- `project_id`: `amdvitzpogaejzzqroco`
- `name`: exactly the `<name>` from the filename, nothing more
- `query`: the file's contents, unchanged, comments included

Not `execute_sql`. That runs the SQL but records nothing in
`supabase_migrations.schema_migrations`, and the next drift check cannot
find it.

## 6. Make the file's version match what was recorded

`apply_migration` stamps the version with the time it ran, not the one
in your filename. `list_migrations` shows it. Rename the file to that
version (`git mv`), so that the tree and `schema_migrations` agree on
both halves:

```
20261024100000_fetch_place_allowance.sql   ← provisional, written in step 1
20261024121933 fetch_place_allowance       ← what list_migrations says
```

`run.sh` matches on `*_<name>.sql`, so the rename changes nothing it
does.

## 7. Check the tree still describes what is live

Compare the names in `list_migrations` against the files in
`supabase/migrations/`, name against name (the part after the first
`_`):

- Your migration must be in both, under the same version.
- Nothing else should be **newly** live-only or file-only. The two lists
  do not match from end to end, so don't try to make them. As of 24 Oct
  2026, 13 names exist only live and 14 only as files, all from before
  21 Oct: early migrations applied under different names, and data fixes
  applied by hand. Those are known. A new mismatch dated after that is
  not, and is worth stopping for: it is the "a merge silently dropped an
  applied migration" case from CLAUDE.md.

Then check that the objects themselves exist. Run an `execute_sql`
catalog query (`pg_tables`, `pg_policies`, `pg_proc`, `information_schema
.columns`) for what the migration created, and show the result.

## 8. Regenerate the app's types

Skip this only if nothing the app's `public` schema exposes changed
(tables, views, columns, functions, enums).

```bash
cd app && npm run types:db
```

That needs `supabase login` (or `SUPABASE_ACCESS_TOKEN`). If neither is
available, use the Supabase MCP `generate_typescript_types` for the
project instead, and write it the way the script does: keep everything
in `app/src/lib/database.types.ts` above `export type Json` (the
hand-written header) and replace the rest with the output.

Then run `npm run typecheck`. A changed column type usually turns up
here first.

## 9. Commit

In the same PR: the migration under its final version, its test, the
`run.sh` block, and `database.types.ts`. Say in the PR body that it has
been applied to `amdvitzpogaejzzqroco`, and give the recorded version.
If an Edge Function goes with the change, deploying it is a separate
step. A function in the tree is no more deployed than a migration is
applied.
