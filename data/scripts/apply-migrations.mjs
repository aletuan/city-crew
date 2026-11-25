// What `.github/workflows/apply-migrations.yml` applies to the live
// project, and the request that applies each.
//
// The job runs only after a person approves it (the `supabase-live`
// environment) and only while the `APPLY_MIGRATIONS` variable is `on`.
// This file decides what it may do once let through.
//
// ── what it applies ──
//
// The files the live history lacks (`drift().missing`), oldest first, and
// nothing else. It refuses to start while the history disagrees in any
// other way — a live row with no file, a file applied under another
// version, a version under two names — because applying onto a history
// that does not say what ran is how the two drifted apart before
// (25 Nov 2026). It also refuses a missing file older than the newest
// live row: that is a file merged out of order, and running it after
// files that came later is a decision for a person, not for a job.
//
// ── how one file is applied ──
//
// Its SQL and its history row in one transaction, the row carrying the
// file's own version, so the history cannot drift the way the Supabase
// MCP's `apply_migration` made it drift (it stamps the minute it ran).
// One request per file, stopping at the first failure: a file that
// fails leaves nothing behind, and the files after it wait.
//
// Not `supabase db push`: that needs the database password as a second
// secret, and the Management API this job already reads the history
// through runs the same SQL with the access token the function deploys
// use.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drift, parseFile } from './migration-drift.mjs';

/**
 * The files to apply, oldest first, or why none may be.
 *
 * @param {string[]} files  the names in `supabase/migrations`
 * @param {{ version: string, name: string }[]} live  the live history
 * @returns {{ apply: string[], refuse: string | null }}
 */
export function planApply(files, live) {
  const d = drift(files, live);
  const other = [
    d.extra.length && `${d.extra.length} live row(s) with no file: ${d.extra.join(', ')}`,
    d.restamped.length && `${d.restamped.length} file(s) applied under another version: ${d.restamped.map((r) => r.name).join(', ')}`,
    d.renamed.length && `${d.renamed.length} version(s) under two names: ${d.renamed.map((r) => r.version).join(', ')}`,
  ].filter(Boolean);
  if (other.length) return { apply: [], refuse: `the live history disagrees with the repo — ${other.join('; ')}` };
  const newest = live.reduce((m, r) => (r.version > m ? r.version : m), '');
  const apply = [...d.missing].sort();
  const early = apply.filter((f) => f.slice(0, 14) <= newest);
  if (early.length) {
    return { apply: [], refuse: `older than the newest live migration (${newest}), so merged out of order: ${early.join(', ')}` };
  }
  return { apply: apply.map((f) => `${f}.sql`), refuse: null };
}

/**
 * The body of one Management API query: the file's SQL and its history
 * row, in one transaction. The SQL goes into the row by dollar-quoting
 * under a tag the file itself does not contain.
 */
export function applyBody(file, sql) {
  const m = parseFile(file);
  if (!m) throw new Error(`not a migration file name: ${file}`);
  // A file that ends or opens a transaction of its own would split the
  // file from its history row, and `concurrently` cannot run inside one
  // at all. None of the 155 files on 25 Nov 2026 does either; one that
  // does is applied by a person.
  const bare = sql.replace(/--[^\n]*/g, '');
  if (/^\s*(begin|commit|rollback|start\s+transaction)\s*;/im.test(bare) || /\bconcurrently\b/i.test(bare)) {
    throw new Error(`${file} manages its own transaction or builds an index concurrently: apply it by hand`);
  }
  let tag = 'migration';
  for (let i = 0; sql.includes(`$${tag}$`); i += 1) tag = `migration${i}`;
  const quoted = `$${tag}$${sql}$${tag}$`;
  const query = [
    'begin;',
    sql,
    ';',
    'insert into supabase_migrations.schema_migrations (version, name, statements, created_by)',
    `  values ('${m.version}', '${m.name}', array[${quoted}], 'apply-migrations workflow');`,
    'commit;',
  ].join('\n');
  return JSON.stringify({ query });
}

/**
 * `node apply-migrations.mjs plan <live.json>` prints the files to apply,
 * one a line, or exits 1 with the reason it will not.
 * `node apply-migrations.mjs body <file>` prints that file's request body.
 */
function main([cmd, arg]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const dir = join(root, 'supabase/migrations');
  if (cmd === 'plan') {
    const live = JSON.parse(readFileSync(arg, 'utf8'));
    if (!Array.isArray(live) || live.length === 0) {
      console.error('The live history came back empty or unreadable.');
      process.exit(2);
    }
    const { apply, refuse } = planApply(readdirSync(dir), live);
    if (refuse) {
      console.error(`Not applying anything: ${refuse}.`);
      process.exit(1);
    }
    for (const f of apply) console.log(f);
    return;
  }
  if (cmd === 'body') {
    process.stdout.write(applyBody(arg, readFileSync(join(dir, arg), 'utf8')));
    return;
  }
  console.error('usage: apply-migrations.mjs plan <live.json> | body <file>');
  process.exit(2);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
