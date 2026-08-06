// Snapshot the curated database back into data/review/places.review.json so
// git keeps a history of curation sessions. The DB is the source of truth;
// this file is a backup/export only (see the guard in push-data.mjs).
//
// Usage: node --env-file=.env scripts/backup-db.mjs

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const { data: places, error } = await supabase
  .from('places')
  .select('*, place_photos(*)')
  .order('slug');
if (error) throw new Error(error.message);

const out = { exported_at: new Date().toISOString(), source: process.env.SUPABASE_URL, places: {} };
for (const p of places) {
  const { place_photos, id, created_at, updated_at, ...rest } = p;
  out.places[p.slug] = {
    ...rest,
    photos: place_photos
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(({ id: _id, place_id: _pid, ...photo }) => photo),
  };
}

writeFileSync(join(DATA_DIR, 'review', 'places.review.json'), JSON.stringify(out, null, 2));
console.log(`OK: backed up ${places.length} places to review/places.review.json`);
