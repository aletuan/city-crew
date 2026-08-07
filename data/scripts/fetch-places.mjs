// Fetch real place data from Google Places API (New) for the candidates list.
// Writes/merges data/review/places.review.json for human curation; raw API
// responses are cached in data/review/.cache so re-runs cost nothing.
//
// Usage: node --env-file=../.env scripts/fetch-places.mjs [--force] [--only slug1,slug2]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = join(DATA_DIR, 'review', '.cache');
const REVIEW_PATH = join(DATA_DIR, 'review', 'places.review.json');
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const MAX_API_CALLS = 300; // hard cap: ~50 searches + ~50 details + ~150 photos
const HCMC_CENTER = { latitude: 10.7769, longitude: 106.7009 };

if (!API_KEY) {
  console.error('GOOGLE_MAPS_API_KEY missing — run with --env-file=../.env');
  process.exit(1);
}

const force = process.argv.includes('--force');
const onlyArg = process.argv[process.argv.indexOf('--only') + 1];
const only = process.argv.includes('--only') ? onlyArg.split(',') : null;

let apiCalls = 0;
async function api(url, opts) {
  if (++apiCalls > MAX_API_CALLS) throw new Error(`API call cap (${MAX_API_CALLS}) reached`);
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  return res.json();
}

function cachePath(slug, kind) {
  return join(CACHE_DIR, `${slug}.${kind}.json`);
}

async function cached(slug, kind, fetcher) {
  const p = cachePath(slug, kind);
  if (!force && existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'));
  const data = await fetcher();
  writeFileSync(p, JSON.stringify(data, null, 2));
  return data;
}

async function textSearch(query) {
  return api('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 1,
      locationBias: { circle: { center: HCMC_CENTER, radius: 25000 } },
    }),
  });
}

async function placeDetails(placeId) {
  const fields = [
    'id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount',
    'priceLevel', 'regularOpeningHours.weekdayDescriptions', 'photos',
    'websiteUri', 'internationalPhoneNumber', 'nationalPhoneNumber',
  ].join(',');
  return api(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: { 'X-Goog-Api-Key': API_KEY, 'X-Goog-FieldMask': fields },
  });
}

async function resolvePhoto(photoName) {
  return api(
    `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&skipHttpRedirect=true`,
    { headers: { 'X-Goog-Api-Key': API_KEY } },
  );
}

const PRICE_LEVEL_DISPLAY = {
  PRICE_LEVEL_FREE: '0₫',
  PRICE_LEVEL_INEXPENSIVE: '50k₫',
  PRICE_LEVEL_MODERATE: '150k₫',
  PRICE_LEVEL_EXPENSIVE: '300k₫',
  PRICE_LEVEL_VERY_EXPENSIVE: '500k₫',
};

const { candidates } = JSON.parse(readFileSync(join(DATA_DIR, 'seeds', 'candidates.json'), 'utf8'));
mkdirSync(CACHE_DIR, { recursive: true });

const review = existsSync(REVIEW_PATH)
  ? JSON.parse(readFileSync(REVIEW_PATH, 'utf8'))
  : { places: {} };

let fetched = 0, skipped = 0, failed = [];

for (const cand of candidates) {
  if (only && !only.includes(cand.slug)) continue;
  if (!force && review.places[cand.slug] && !review.places[cand.slug].fetch_failed) {
    skipped++;
    continue;
  }
  try {
    const search = await cached(cand.slug, 'search', () => textSearch(cand.query));
    const hit = search.places?.[0];
    if (!hit) throw new Error('no search result');

    const det = await cached(cand.slug, 'details', () => placeDetails(hit.id));

    const photos = [];
    for (const [i, photo] of (det.photos ?? []).slice(0, 3).entries()) {
      const media = await cached(cand.slug, `photo${i}`, () => resolvePhoto(photo.name));
      const attr = photo.authorAttributions?.[0];
      photos.push({
        photo_ref: photo.name,
        photo_uri: media.photoUri,
        width_px: photo.widthPx,
        height_px: photo.heightPx,
        attribution_name: attr?.displayName ?? null,
        attribution_uri: attr?.uri ?? null,
        is_cover: i === 0,
      });
    }

    // Curated fields (desc_*, duration_*, name_vi…) start as guesses; the
    // curation pass edits them and flips needs_review to false.
    review.places[cand.slug] = {
      slug: cand.slug,
      google_place_id: det.id,
      name_en: det.displayName?.text ?? cand.query,
      name_vi: det.displayName?.text ?? cand.query,
      category: cand.category,
      is_featured: cand.featured,
      vibe_tags: cand.vibe_tags,
      neighborhood_en: cand.area,
      neighborhood_vi: cand.area,
      address: det.formattedAddress ?? null,
      lat: det.location?.latitude ?? null,
      lng: det.location?.longitude ?? null,
      rating: det.rating ?? null,
      rating_count: det.userRatingCount ?? null,
      price_level: det.priceLevel ?? null,
      price_display: PRICE_LEVEL_DISPLAY[det.priceLevel] ?? null,
      price_vnd: null,
      duration_min: null,
      duration_max: null,
      desc_en: '',
      desc_vi: '',
      emoji: '',
      opening_hours: det.regularOpeningHours?.weekdayDescriptions ?? null,
      website: det.websiteUri ?? null,
      // Some places only carry the local format — fall back so phone
      // coverage is as complete as Google allows.
      phone: det.internationalPhoneNumber ?? det.nationalPhoneNumber ?? null,
      saved_count: 0,
      photos,
      needs_review: true,
    };
    fetched++;
    console.log(`✓ ${cand.slug}: ${det.displayName?.text} (${photos.length} photos)`);
  } catch (err) {
    failed.push(cand.slug);
    review.places[cand.slug] = { ...review.places[cand.slug], slug: cand.slug, fetch_failed: String(err) };
    console.error(`✗ ${cand.slug}: ${err.message ?? err}`);
  }
}

writeFileSync(REVIEW_PATH, JSON.stringify(review, null, 2));
console.log(`\nDone: ${fetched} fetched, ${skipped} skipped, ${failed.length} failed. API calls: ${apiCalls}`);
if (failed.length) console.log('Failed slugs:', failed.join(', '));
