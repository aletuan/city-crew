// Does the live project's migration history say what the repo says?
//
// CI tests every migration against a throwaway Postgres; nothing applies
// one to the live project (CLAUDE.md, "Supabase"). So a migration merged
// and never applied reads exactly like one that ran, until a screen asks
// for a column that is not there — and a merge has silently dropped an
// applied migration from the tree before. This turns either into a red
// job (`.github/workflows/migration-drift.yml`). It only reads: the
// workflow asks the project for its history, and this compares.
//
// ── by version, both ways ──
//
// Every file must have a live row with its version and its name, and
// every live row a file. Four ways to fail, each a different mistake:
// - `missing`: a file live has not run — apply it.
// - `extra`: a live row no file describes — a migration applied by hand
//   and never committed, or a file a merge removed.
// - `restamped`: one name, two versions — a file applied under the
//   minute it ran, the way the Supabase MCP's `apply_migration` stamps
//   one. It ran; set the row's version to the file's. Told apart from a
//   `missing` and an `extra` that happen to share a name, because the
//   remedy is a one-line update, not an apply.
// - `renamed`: one version, two names — a file renamed after it ran.
//
// ── how the two histories came to agree ──
//
// Until 25 Nov 2026 they did not. Applied through the MCP, a migration
// was stamped with the minute it ran; the file kept its own version.
// Measured that day: 148 files, 142 live rows, 7 versions in common and
// 129 names. That afternoon the live history was repaired (the owner
// confirmed it): 128 rows took their file's version, 13 rows were added
// for files whose objects were all found on live with no row (two of
// them, data-only, could not be checked and say so in `created_by`), and
// 7 rows applied before this folder existed or never committed got files
// copied byte for byte from the live history. The table as it stood is
// kept as `supabase_migrations.schema_migrations_before_20261125`.
// After the repair: 155 rows, 155 files, every pair equal.
//
// Until then this compared by name, with 19 known exceptions; that
// version is in this file's history.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** `20261125120000_checkin_photo_desk.sql` → its version and its name. */
export function parseFile(file) {
  const m = /^(\d{14})_(.+)\.sql$/.exec(file);
  return m ? { version: m[1], name: m[2] } : null;
}

/**
 * What the two histories disagree on.
 *
 * @param {string[]} files  the names in `supabase/migrations`
 * @param {{ version: string, name: string }[]} live  the live history
 */
export function drift(files, live) {
  const repo = new Map(files.map(parseFile).filter(Boolean).map((m) => [m.version, m.name]));
  const onLive = new Map(live.map((r) => [r.version, r.name]));
  const missing = [];
  const renamed = [];
  for (const [version, name] of repo) {
    if (!onLive.has(version)) missing.push({ version, name });
    else if (onLive.get(version) !== name) renamed.push({ version, file: name, live: onLive.get(version) });
  }
  const extra = [...onLive].filter(([v]) => !repo.has(v)).map(([version, name]) => ({ version, name }));
  const restamped = [];
  for (const m of [...missing]) {
    const e = extra.find((x) => x.name === m.name);
    if (!e) continue;
    restamped.push({ name: m.name, file: m.version, live: e.version });
    missing.splice(missing.indexOf(m), 1);
    extra.splice(extra.indexOf(e), 1);
  }
  const both = (r) => `${r.version}_${r.name}`;
  return { missing: missing.map(both), extra: extra.map(both), restamped, renamed };
}

/**
 * The files live has not run: what a deploy that depends on the schema
 * waits for (`.github/actions/wait-for-migrations`).
 *
 * Only `missing`, on purpose. A row no file describes, or one under
 * another version, is a disagreement about the record and the drift job
 * goes red on it; neither means a column the new code asks for is not
 * there, so neither holds a deploy back.
 */
export function pending(files, live) {
  return drift(files, live).missing;
}

/** Run by the workflows: `node migration-drift.mjs <live.json> [--pending]`. */
function main(livePath, only) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const files = readdirSync(join(root, 'supabase/migrations')).sort();
  const live = JSON.parse(readFileSync(livePath, 'utf8'));
  if (!Array.isArray(live) || live.length === 0) {
    // An empty answer is a failed read, not a project with no history.
    console.error('The live history came back empty or unreadable:', JSON.stringify(live).slice(0, 300));
    process.exit(2);
  }
  if (only === '--pending') {
    const waiting = pending(files, live);
    if (!waiting.length) { console.log('Every migration in this commit is on the live project.'); return; }
    console.error(`Not on the live project yet (${waiting.length}):`);
    for (const f of waiting) console.error(`  supabase/migrations/${f}.sql`);
    process.exit(1);
  }
  const { missing, extra, restamped, renamed } = drift(files, live);
  console.log(`${files.length} files, ${live.length} live rows.`);
  if (missing.length) {
    console.error(`\nIn the repo, not on the live project (${missing.length}) — apply each:`);
    for (const f of missing) console.error(`  supabase/migrations/${f}.sql`);
  }
  if (extra.length) {
    console.error(`\nOn the live project, in no file (${extra.length}) — commit it, or find the merge that removed it:`);
    for (const f of extra) console.error(`  ${f}`);
  }
  if (restamped.length) {
    console.error(`\nApplied under another version (${restamped.length}) — set each live row to the file's:`);
    for (const r of restamped) {
      console.error(`  ${r.name}: live ${r.live}, file ${r.file}`);
      console.error(`    update supabase_migrations.schema_migrations set version = '${r.file}' where version = '${r.live}';`);
    }
  }
  if (renamed.length) {
    console.error(`\nOne version, two names (${renamed.length}):`);
    for (const r of renamed) console.error(`  ${r.version}: file "${r.file}", live "${r.live}"`);
  }
  if (missing.length || extra.length || restamped.length || renamed.length) process.exit(1);
  console.log('The live history and supabase/migrations agree, row for file.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv[2], process.argv[3]);
