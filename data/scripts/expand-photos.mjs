// Expand each place's Google photo set (up to TARGET per place) using the
// already-cached Place Details responses — only photo /media resolutions hit
// the API, and those are cached too. New photos are MERGED into the DB:
// existing rows, covers, and uploaded photos are never touched (the partial
// unique index on (place_id, photo_ref) makes re-runs no-ops).
//
// Usage: node --env-file=../.env --env-file=.env scripts/expand-photos.mjs

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = join(DATA_DIR, 'review', '.cache');
const TARGET = 8;
const MAX_API_CALLS = 300;
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!API_KEY) throw new Error('GOOGLE_MAPS_API_KEY missing (load ../.env)');
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) throw new Error('Supabase env missing (load .env)');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

let apiCalls = 0;
async function resolvePhoto(slug, idx, photoName) {
  const p = join(CACHE_DIR, `${slug}.photo${idx}.json`);
  if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'));
  if (++apiCalls > MAX_API_CALLS) throw new Error(`API call cap (${MAX_API_CALLS}) reached`);
  const res = await fetch(
    `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&skipHttpRedirect=true`,
    { headers: { 'X-Goog-Api-Key': API_KEY } },
  );
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  const data = await res.json();
  writeFileSync(p, JSON.stringify(data, null, 2));
  return data;
}

const { data: placeRows, error: pErr } = await supabase.from('places').select('id, slug');
if (pErr) throw new Error(pErr.message);
const idBySlug = Object.fromEntries(placeRows.map((r) => [r.slug, r.id]));

const { data: photoRows, error: phErr } = await supabase
  .from('place_photos').select('place_id, photo_ref, sort_order');
if (phErr) throw new Error(phErr.message);
const existingRefs = new Set(photoRows.map((r) => r.photo_ref).filter(Boolean));
const maxSort = {};
for (const r of photoRows) {
  maxSort[r.place_id] = Math.max(maxSort[r.place_id] ?? -1, r.sort_order);
}

let inserted = 0, skippedPlaces = 0, failures = [];
const slugs = readdirSync(CACHE_DIR)
  .filter((f) => f.endsWith('.details.json'))
  .map((f) => f.replace('.details.json', ''));

for (const slug of slugs) {
  const placeId = idBySlug[slug];
  if (!placeId) { skippedPlaces++; continue; }
  const det = JSON.parse(readFileSync(join(CACHE_DIR, `${slug}.details.json`), 'utf8'));
  const photos = (det.photos ?? []).slice(0, TARGET);
  const rows = [];
  for (const [i, photo] of photos.entries()) {
    if (existingRefs.has(photo.name)) continue;
    try {
      const media = await resolvePhoto(slug, i, photo.name);
      const attr = photo.authorAttributions?.[0];
      rows.push({
        place_id: placeId,
        photo_ref: photo.name,
        photo_uri: media.photoUri,
        width_px: photo.widthPx,
        height_px: photo.heightPx,
        attribution_name: attr?.displayName ?? null,
        attribution_uri: attr?.uri ?? null,
        sort_order: ++maxSort[placeId],
        is_cover: false,
        source: 'google',
      });
    } catch (err) {
      failures.push(`${slug}#${i}: ${err.message}`);
    }
  }
  if (rows.length) {
    const { error } = await supabase.from('place_photos').insert(rows);
    if (error) { failures.push(`${slug} insert: ${error.message}`); continue; }
    inserted += rows.length;
    console.log(`✓ ${slug}: +${rows.length} photos`);
  }
}

console.log(`\nDone: +${inserted} photos, ${skippedPlaces} cache entries without DB row, API calls: ${apiCalls}`);
if (failures.length) console.log('Failures:\n  ' + failures.join('\n  '));
