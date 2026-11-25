// Which migrations in the repo the live project has not run.
//
// CI tests every migration against a throwaway Postgres; nothing applies
// one to the live project (CLAUDE.md, "Supabase"). So a migration merged
// and never applied reads exactly like one that ran, until a screen asks
// for a column that is not there. This turns that silence into a red job
// within minutes of the merge (`.github/workflows/migration-drift.yml`).
// It only reads: the workflow asks the project for its history, and this
// compares.
//
// ── why by name, and not by version ──
//
// The two histories do not share versions. A migration applied through
// the Supabase MCP is stamped with the minute it ran
// (`20261125014020_checkin_photo_desk`), while the file keeps the
// version written into its name (`20261125120000_checkin_photo_desk`).
// Measured on 25 Nov 2026: of 148 files and 142 live rows, no version
// matched and 129 names did. Until the history is repaired (the second
// step proposed that day), the name is the only key the two sides share.
// A version that does match counts too, so a repaired history needs no
// change here.
//
// ── the files the live history does not name ──
//
// 19 files matched no live name on 25 Nov 2026. Each was checked against
// the live schema that day and is listed in KNOWN with what was found. A
// new file is never added here to make the job green: a file that is not
// on live is a migration to apply.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Files that are on live under no name of their own, by the name in the
 * file (version dropped).
 *
 * - `{ as }`: applied under another name. The live name must still be in
 *   the history, so a renamed migration that vanishes still turns red.
 * - `{ folded }`: no row in the live history, but every function, table,
 *   bucket and trigger it creates was found on live on 25 Nov 2026 — the
 *   SQL ran by hand or inside another migration. Three functions of
 *   `place_submissions` are absent, as they should be: the later
 *   `lists_stay_public_around_unlive_places` drops them.
 * - `{ data }`: changes rows, creates nothing, so nothing on live says
 *   whether it ran. Not verified; listed so the job can run at all.
 */
export const KNOWN = {
  japanese_content_columns: { as: 'add_japanese_content_columns' },
  place_reviewer_attribution: { as: 'add_reviewer_attribution_to_places' },
  city_hero_photo: { as: 'city_hero_photo_20260919' },
  place_city_and_branch_names: { as: 'place_city_and_branch_names_20260919' },
  place_import_audit: { as: 'place_import_audit_20260919' },
  vungtau_places_follow_coordinates: { as: 'vungtau_places_follow_coordinates_20260920' },
  activity_rows_carry_face: { folded: true },
  avatars_bucket: { folded: true },
  collection_shares: { folded: true },
  collection_stats: { folded: true },
  collection_use_counts: { folded: true },
  friend_suggestions: { folded: true },
  own_collection_members: { folded: true },
  place_submissions: { folded: true },
  profiles: { folded: true },
  publish_collections: { folded: true },
  trip_invites: { folded: true },
  backfill_google_blurb_source: { data: true },
  tagline_audit: { data: true },
};

/** `20261125120000_checkin_photo_desk.sql` → its version and its name. */
export function parseFile(file) {
  const m = /^(\d{14})_(.+)\.sql$/.exec(file);
  return m ? { version: m[1], name: m[2] } : null;
}

/**
 * The files live has not run, and the KNOWN entries that no longer
 * describe anything.
 *
 * @param {string[]} files  the names in `supabase/migrations`
 * @param {{ version: string, name: string }[]} live  the live history
 */
export function drift(files, live, known = KNOWN) {
  const versions = new Set(live.map((r) => r.version));
  const names = new Set(live.map((r) => r.name));
  const missing = [];
  const seen = new Set();
  for (const file of files) {
    const m = parseFile(file);
    if (!m) continue;
    if (versions.has(m.version) || names.has(m.name)) continue;
    const k = known[m.name];
    if (k) {
      seen.add(m.name);
      // Renamed on live, and the live name gone: not on live after all.
      if (k.as && !names.has(k.as)) missing.push(file);
      continue;
    }
    missing.push(file);
  }
  // An entry whose file now matches live by itself, or whose file is gone.
  const stale = Object.keys(known).filter((n) => !seen.has(n));
  return { missing, stale };
}

/** Run by the workflow: `node migration-drift.mjs <live.json>`. */
function main(livePath) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const files = readdirSync(join(root, 'supabase/migrations')).sort();
  const live = JSON.parse(readFileSync(livePath, 'utf8'));
  if (!Array.isArray(live) || live.length === 0) {
    // An empty answer is a failed read, not a project with no history.
    console.error('The live history came back empty or unreadable:', JSON.stringify(live).slice(0, 300));
    process.exit(2);
  }
  const { missing, stale } = drift(files, live);
  console.log(`${files.length} files, ${live.length} live rows.`);
  for (const n of stale) console.log(`note: KNOWN['${n}'] no longer needed — remove it.`);
  if (missing.length) {
    console.error(`\nNot on the live project (${missing.length}):`);
    for (const f of missing) console.error(`  supabase/migrations/${f}`);
    console.error('\nApply each to amdvitzpogaejzzqroco (CLAUDE.md, "Supabase").');
    process.exit(1);
  }
  console.log('Every migration in the repo is on the live project.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv[2]);
