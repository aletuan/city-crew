// Export published places + collections into the exact shape the mockup
// consumes, bucketed per city:
//   { generated_from, default_city,
//     cities: [{ id, name_en, name_vi, short_en, short_vi, sort_order }],
//     places: { hcmc: { foryou, food, out }, hanoi: {…}, … },
//     collections: { hcmc: [...], hanoi: [...], … } }
// Only cities with ≥1 published place appear — a city toggle to an empty
// demo screen is worse than no toggle.
//
// Default: reads from Supabase with the anon key — the same access path the
// app uses. With --local, reads the curated repo files instead
// (review/places.review.json + seeds/collections.json, HCMC-only bootstrap).
//
// Usage: node --env-file=.env scripts/export-snapshot.mjs [--local]

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const local = process.argv.includes('--local');

const HCMC_CITY = {
  id: 'hcmc', name_en: 'Ho Chi Minh City', name_vi: 'TP. Hồ Chí Minh',
  short_en: 'Saigon', short_vi: 'Sài Gòn', sort_order: 1,
};

let places, collections, cities;
if (local) {
  const review = JSON.parse(readFileSync(join(DATA_DIR, 'review', 'places.review.json'), 'utf8'));
  const seeds = JSON.parse(readFileSync(join(DATA_DIR, 'seeds', 'collections.json'), 'utf8'));
  places = Object.values(review.places)
    .filter((p) => !p.needs_review && !p.fetch_failed)
    .filter((p) => (p.review_status ?? 'approved') === 'approved' && (p.is_published ?? true))
    .map((p) => ({ ...p, city_id: 'hcmc', place_photos: p.photos.map((ph, i) => ({ ...ph, sort_order: i })) }));
  const bySlug = Object.fromEntries(places.map((p) => [p.slug, p]));
  collections = seeds.collections.map((c) => ({
    ...c,
    city_id: 'hcmc',
    collection_places: c.places.map((slug, i) => ({ sort_order: i, places: { slug } })),
    cover: { photo_uri: bySlug[c.cover]?.photos.find((ph) => ph.is_cover)?.photo_uri ?? null },
  }));
  cities = [HCMC_CITY]; // the local bootstrap files predate multi-city
} else {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

  const { data: ct, error: ctErr } = await supabase
    .from('cities')
    .select('id, name_en, name_vi, short_en, short_vi, sort_order')
    .eq('is_active', true)
    .order('sort_order');
  if (ctErr) throw new Error(ctErr.message);
  cities = ct;

  // The demo ships only reviewer-approved, published places.
  const { data: p, error: pErr } = await supabase
    .from('places')
    .select('*, place_photos(*)')
    .eq('is_published', true)
    .eq('review_status', 'approved')
    .order('sort_order', { ascending: true, nullsFirst: false });
  if (pErr) throw new Error(pErr.message);
  places = p;

  const { data: c, error: cErr } = await supabase
    .from('collections')
    .select('*, collection_places(sort_order, places(slug)), cover:place_photos!collections_cover_photo_id_fkey(photo_uri)')
    .eq('is_public', true)
    .order('sort_order');
  if (cErr) throw new Error(cErr.message);
  collections = c;
}

const fmtDuration = (min, max, vi) => {
  if (!min) return null;
  if ((max ?? min) <= 60) {
    const range = min === max || !max ? `${min}` : `${min}–${max}`;
    return vi ? `${range} phút` : `${range} min`;
  }
  const h = (m) => Math.round(m / 30) / 2; // nearest half hour
  const range = min === max || !max || h(min) === h(max) ? `${h(min)}` : `${h(min)}–${h(max)}`;
  return vi ? `${range} giờ` : `${range}h`;
};

const toCard = (p) => {
  const photos = (p.place_photos ?? [])
    .filter((ph) => !ph.is_hidden)
    .sort((a, b) => a.sort_order - b.sort_order);
  const cover = photos.find((ph) => ph.is_cover) ?? photos[0];
  return {
    id: p.slug,
    photo_url: cover?.photo_uri ?? null,
    photos: photos.map((ph) => ({ url: ph.photo_uri, attr_name: ph.attribution_name, attr_uri: ph.attribution_uri })),
    attr_name: cover?.attribution_name ?? null,
    attr_uri: cover?.attribution_uri ?? null,
    emoji: p.emoji,
    en: p.name_en, vi: p.name_vi,
    loc_en: p.neighborhood_en, loc_vi: p.neighborhood_vi,
    address: p.address,
    lat: p.lat, lng: p.lng,
    rating: p.rating ? `${p.rating}/5` : null,
    rating_count: p.rating_count,
    price: p.price_display,
    price_vnd: p.price_vnd,
    votes: p.saved_count,
    dur_en: fmtDuration(p.duration_min, p.duration_max, false),
    dur_vi: fmtDuration(p.duration_min, p.duration_max, true),
    dur_min: p.duration_min,
    dur_max: p.duration_max,
    vibes: p.vibe_tags,
    desc_en: p.desc_en, desc_vi: p.desc_vi,
  };
};

// Per-city buckets. Cities with zero published places are dropped entirely —
// the mockup's city toggle should never lead to an empty screen.
const activeCities = cities.filter((city) => places.some((p) => p.city_id === city.id));
if (!activeCities.length) throw new Error('no city has published places');

const placesByCity = {};
const collectionsByCity = {};
for (const city of activeCities) {
  const cityPlaces = places.filter((p) => p.city_id === city.id);
  placesByCity[city.id] = {
    foryou: cityPlaces.filter((p) => p.is_featured).slice(0, 10).map(toCard),
    food: cityPlaces.filter((p) => p.category === 'food').map(toCard),
    out: cityPlaces.filter((p) => p.category === 'out').map(toCard),
  };

  // Count only published members within the same city — with the service key
  // the nested join is not RLS-filtered, and unpublished places must not
  // inflate the card count.
  const publishedSlugs = new Set(cityPlaces.map((p) => p.slug));
  collectionsByCity[city.id] = collections
    .filter((c) => c.city_id === city.id)
    .flatMap((c) => {
      const memberSlugs = (c.collection_places ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((cp) => cp.places?.slug)
        .filter((slug) => slug && publishedSlugs.has(slug));
      if (!memberSlugs.length) return []; // hide collections with no approved members
      return {
        slug: c.slug,
        title_en: c.title_en, title_vi: c.title_vi,
        desc_en: c.desc_en, desc_vi: c.desc_vi,
        curator: c.curator_handle,
        // Fall back to the first member's cover if the collection's own cover
        // photo was deleted (the FK nulls it) or never set.
        cover_url: c.cover?.photo_uri
          ?? cityPlaces.find((p) => p.slug === memberSlugs[0])?.place_photos
            ?.filter((ph) => !ph.is_hidden)
            ?.sort((a, b) => (b.is_cover ? 1 : 0) - (a.is_cover ? 1 : 0))?.[0]?.photo_uri
          ?? null,
        count: memberSlugs.length,
        place_slugs: memberSlugs,
      };
    });
}

const snapshot = {
  generated_from: local ? 'local review files' : process.env.SUPABASE_URL,
  default_city: activeCities.some((c) => c.id === 'hcmc') ? 'hcmc' : activeCities[0].id,
  cities: activeCities,
  places: placesByCity,
  collections: collectionsByCity,
};

const out = join(DATA_DIR, 'snapshot', 'citycrew-data.json');
writeFileSync(out, JSON.stringify(snapshot, null, 2));
const perCity = activeCities
  .map((c) => `${c.id}=${Object.values(placesByCity[c.id]).flat().length} cards/${collectionsByCity[c.id].length} cols`)
  .join(', ');
console.log(`OK: ${places.length} places across ${activeCities.length} cities (${perCity}) → ${out}`);
