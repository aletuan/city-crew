# Migrations: from a merged file to the live project

Out of `CLAUDE.md` on 28 Nov 2026, word for word but for the headings and
one count. `CLAUDE.md` is read at the start of every session and this is
needed only by one that writes, applies or waits on a migration; it keeps
four lines there and the rest is here.

Project ref **`amdvitzpogaejzzqroco`** (`citycrew-data`, ap-southeast-1).

## A merge applies them, once approved

**CI tests migrations; a merge applies them only once approved.**
`.github/workflows/apply-migrations.yml` runs on a merge that touches
`supabase/migrations/`, waits in the `supabase-live` environment for its
reviewer to press Approve, then applies what the live history lacks —
each file and its history row in one transaction, under the file's own
version — and checks the history afterwards. It does nothing while the
`APPLY_MIGRATIONS` repository variable is not `on`: GitHub gives an
environment it has not seen no reviewer at all. Until that variable is
on, a migration merged is not a migration that has run; apply it
yourself, as below. It refuses to apply onto a history that disagrees
with the repo, or a file merged out of order
(`data/scripts/apply-migrations.mjs`).

## The deploys wait for it

**The Edge Functions deploy and the EAS Update wait for it.** Both start
on the same merge and hold until every migration in the commit is on
live (`.github/actions/wait-for-migrations`): thirty minutes, then red
with nothing deployed — approve, and re-run the job (that file's header
lists what each red message means and what to do). So a function or a
screen and the migration it needs can merge together. What waiting
cannot fix is the other direction: a migration that drops or renames
something live code still reads breaks it from the approval until the
new code is out. Add in one pull request, remove in a later one.

## The drift check

`.github/workflows/migration-drift.yml` checks it for you: after a merge
that touches `supabase/migrations/` it waits up to 30 minutes for the
migration to appear on live, and goes red if it does not; it also runs
daily. Since 25 Nov 2026 the live history and the folder agree version
for version, both ways, and the job holds them to it. (No count is
written here: it was 155 that day and wrong two days later.)

## By hand

**By hand, apply a migration under its file's version.** The Supabase MCP's
`apply_migration` stamps the minute it ran instead, which is how the two
histories drifted apart. Run the file's SQL with `execute_sql` and record
it in the same call:
`insert into supabase_migrations.schema_migrations (version, name,
statements) values ('<file version>', '<name>', array['<the SQL>'])`.
A migration applied the other way shows up as "applied under another
version", with the one-line update that fixes it.

## Where the rest is

| | |
|---|---|
| `.github/actions/wait-for-migrations/action.yml` | Its header: why the deploys wait, what waiting cannot fix, and what each red message means with what to do. |
| `data/scripts/apply-migrations.mjs` | What is refused before anything is applied (a history that disagrees, a file out of order, a file that manages its own transaction), and why. |
| `data/scripts/migration-drift.mjs` | The four ways the two histories can disagree, and which of them holds a deploy back. |
| `supabase/tests/run.sh` | What the `migrations` CI job runs against a throwaway Postgres. |
