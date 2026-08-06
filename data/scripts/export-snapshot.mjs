// Export published places + collections into the exact shape the mockup
// consumes: { places: {foryou, food, out}, collections: [...] }.
//
// Default: reads from Supabase with the anon key — the same access path the
// future app would use. With --local, reads the curated repo files instead
// (review/places.review.json + seeds/collections.json), useful before the DB
// has been seeded.
//
// Usage: node --env-file=.env scripts/export-snapshot.mjs [--local]

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const local = process.argv.includes('--local');

let places, collections;
if (local) {
  const review = JSON.parse(readFileSync(join(DATA_DIR, 'review', 'places.review.json'), 'utf8'));
  const seeds = JSON.parse(readFileSync(join(DATA_DIR, 'seeds', 'collections.json'), 'utf8'));
  places = Object.values(review.places)
    .filter((p) => !p.needs_review && !p.fetch_failed)
    .map((p) => ({ ...p, place_photos: p.photos.map((ph, i) => ({ ...ph, sort_order: i })) }));
  const bySlug = Object.fromEntries(places.map((p) => [p.slug, p]));
  collections = seeds.collections.map((c) => ({
    ...c,
    collection_places: c.places.map((slug, i) => ({ sort_order: i, places: { slug } })),
    cover: { photo_uri: bySlug[c.cover]?.photos.find((ph) => ph.is_cover)?.photo_uri ?? null },
  }));
} else {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

  const { data: p, error: pErr } = await supabase
    .from('places')
    .select('*, place_photos(*)')
    .eq('is_published', true)
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
  const photos = (p.place_photos ?? []).sort((a, b) => a.sort_order - b.sort_order);
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
    price: p.price_display,
    votes: p.saved_count,
    dur_en: fmtDuration(p.duration_min, p.duration_max, false),
    dur_vi: fmtDuration(p.duration_min, p.duration_max, true),
    vibes: p.vibe_tags,
    desc_en: p.desc_en, desc_vi: p.desc_vi,
  };
};

const featured = places.filter((p) => p.is_featured);
const snapshot = {
  generated_from: local ? 'local review files' : process.env.SUPABASE_URL,
  places: {
    foryou: featured.slice(0, 10).map(toCard),
    food: places.filter((p) => p.category === 'food').map(toCard),
    out: places.filter((p) => p.category === 'out').map(toCard),
  },
  collections: collections.map((c) => ({
    slug: c.slug,
    title_en: c.title_en, title_vi: c.title_vi,
    desc_en: c.desc_en, desc_vi: c.desc_vi,
    curator: c.curator_handle,
    cover_url: c.cover?.photo_uri ?? null,
    count: (c.collection_places ?? []).length,
    place_slugs: (c.collection_places ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((cp) => cp.places?.slug)
      .filter(Boolean),
  })),
};

const out = join(DATA_DIR, 'snapshot', 'citycrew-data.json');
writeFileSync(out, JSON.stringify(snapshot, null, 2));
console.log(`OK: ${places.length} places (${snapshot.places.foryou.length} featured), ${collections.length} collections → ${out}`);
