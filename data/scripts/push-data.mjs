// Push the curated review data + collections to Supabase via supabase-js.
// Reads SUPABASE_URL and SUPABASE_KEY from the environment (data/.env).
// Works with the service-role key, or with the anon key while temporary
// write policies are enabled (see upsert flow in the repo docs).
//
// Usage: node --env-file=.env scripts/push-data.mjs --force-bootstrap
//
// DANGER: this script deletes and reinserts every place's photos from the
// review JSON. After the curation dashboard exists, the DATABASE is the source
// of truth — running this would destroy uploaded photos, cover choices, and
// hidden flags. It refuses to run without --force-bootstrap.

import { readFileSync } from 'node:fs';

if (!process.argv.includes('--force-bootstrap')) {
  console.error(
    'push-data.mjs is a one-time bootstrap tool. The database is now curated\n'
    + 'directly via the dashboard; re-running this would wipe uploads and photo\n'
    + 'curation. Pass --force-bootstrap only if you really mean to reset from JSON.',
  );
  process.exit(1);
}
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const review = JSON.parse(readFileSync(join(DATA_DIR, 'review', 'places.review.json'), 'utf8'));
const { collections } = JSON.parse(readFileSync(join(DATA_DIR, 'seeds', 'collections.json'), 'utf8'));

const places = Object.values(review.places).filter((p) => !p.needs_review && !p.fetch_failed);
if (!places.length) throw new Error('no reviewed places — run upsert-supabase.mjs first to merge curation');

const fail = (label, error) => { throw new Error(`${label}: ${error.message}`); };

// 1. Upsert places
const placeRows = places.map((p) => ({
  slug: p.slug, google_place_id: p.google_place_id, name_en: p.name_en, name_vi: p.name_vi,
  category: p.category, is_featured: p.is_featured, vibe_tags: p.vibe_tags,
  neighborhood_en: p.neighborhood_en, neighborhood_vi: p.neighborhood_vi, address: p.address,
  lat: p.lat, lng: p.lng, rating: p.rating, rating_count: p.rating_count,
  price_level: p.price_level, price_display: p.price_display, price_vnd: p.price_vnd,
  duration_min: p.duration_min, duration_max: p.duration_max,
  desc_en: p.desc_en, desc_vi: p.desc_vi, emoji: p.emoji,
  opening_hours: p.opening_hours, website: p.website, phone: p.phone,
  saved_count: p.saved_count, is_published: true, updated_at: new Date().toISOString(),
}));
{
  const { error } = await supabase.from('places').upsert(placeRows, { onConflict: 'slug' });
  if (error) fail('places upsert', error);
}

const { data: idRows, error: idErr } = await supabase.from('places').select('id, slug');
if (idErr) fail('places select', idErr);
const idBySlug = Object.fromEntries(idRows.map((r) => [r.slug, r.id]));

// 2. Replace photos
{
  const ids = places.map((p) => idBySlug[p.slug]);
  const { error } = await supabase.from('place_photos').delete().in('place_id', ids);
  if (error) fail('photos delete', error);
  const photoRows = places.flatMap((p) => p.photos.map((ph, i) => ({
    place_id: idBySlug[p.slug], photo_ref: ph.photo_ref, photo_uri: ph.photo_uri,
    width_px: ph.width_px, height_px: ph.height_px,
    attribution_name: ph.attribution_name, attribution_uri: ph.attribution_uri,
    sort_order: i, is_cover: ph.is_cover === true,
  })));
  const { error: insErr } = await supabase.from('place_photos').insert(photoRows);
  if (insErr) fail('photos insert', insErr);
}

// 3. Collections
{
  const rows = collections.map((c) => ({
    slug: c.slug, title_en: c.title_en, title_vi: c.title_vi,
    desc_en: c.desc_en, desc_vi: c.desc_vi, curator_handle: c.curator_handle,
    is_public: true, sort_order: c.sort_order,
  }));
  const { error } = await supabase.from('collections').upsert(rows, { onConflict: 'slug' });
  if (error) fail('collections upsert', error);

  const { data: colRows, error: colErr } = await supabase.from('collections').select('id, slug');
  if (colErr) fail('collections select', colErr);
  const colIdBySlug = Object.fromEntries(colRows.map((r) => [r.slug, r.id]));

  const { data: coverRows, error: coverErr } = await supabase
    .from('place_photos').select('id, place_id').eq('is_cover', true);
  if (coverErr) fail('covers select', coverErr);
  const coverByPlaceId = Object.fromEntries(coverRows.map((r) => [r.place_id, r.id]));

  for (const c of collections) {
    const coverPhotoId = coverByPlaceId[idBySlug[c.cover]] ?? null;
    const { error: upErr } = await supabase.from('collections')
      .update({ cover_photo_id: coverPhotoId }).eq('slug', c.slug);
    if (upErr) fail(`collection cover ${c.slug}`, upErr);
  }

  const colIds = collections.map((c) => colIdBySlug[c.slug]);
  const { error: delErr } = await supabase.from('collection_places').delete().in('collection_id', colIds);
  if (delErr) fail('collection_places delete', delErr);
  const cpRows = collections.flatMap((c) => c.places.map((slug, i) => ({
    collection_id: colIdBySlug[c.slug], place_id: idBySlug[slug], sort_order: i,
  })));
  const { error: cpErr } = await supabase.from('collection_places').insert(cpRows);
  if (cpErr) fail('collection_places insert', cpErr);
}

console.log(`OK: pushed ${places.length} places, ${places.reduce((n, p) => n + p.photos.length, 0)} photos, ${collections.length} collections`);
