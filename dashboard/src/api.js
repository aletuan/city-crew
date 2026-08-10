// Data layer for the curation dashboard. Talks straight to Supabase with the
// anon key + the signed-in editor's session; Row Level Security (see
// supabase/migrations/) is what authorizes every write. Same interface the
// components used against the old localhost Express API.

import { supabase } from './lib/supabase.js';

const BUCKET = 'place-photos';

// Same whitelist the old server enforced — kept client-side so a typo'd field
// fails loudly here instead of silently bouncing off RLS.
const EDITABLE = new Set([
  'name_en', 'name_vi', 'desc_en', 'desc_vi', 'neighborhood_en', 'neighborhood_vi',
  'address', 'category', 'categories', 'is_featured', 'vibe_tags', 'emoji',
  'price_level', 'price_display', 'price_vnd', 'duration_min', 'duration_max',
  'opening_hours', 'website', 'phone', 'saved_count', 'sort_order', 'is_published',
  'review_status', 'review_note',
]);

const db = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

// functions.invoke wraps non-2xx in a generic message — surface the body.
async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const detail = await error.context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

const PAGE_SIZE = 24;
const SORT_COLUMNS = { created_at: 'created_at', rating_count: 'rating_count', rating: 'rating' };

export const api = {
  cities: async () =>
    db(await supabase.from('cities').select('id, name_en, name_vi, short_en, short_vi').order('sort_order')),

  // The full row, hero columns included — for the City hero screen.
  city: async (id) => {
    const rows = db(await supabase.from('cities').select('*').eq('id', id).limit(1));
    if (!rows.length) throw new Error('not found');
    return rows[0];
  },

  saveCityHero: async (id, fields) => {
    const editable = new Set([
      'hero_title_en', 'hero_title_vi', 'hero_title_ja',
      'hero_cta_en', 'hero_cta_vi', 'hero_cta_ja', 'hero_place_slug',
    ]);
    const patch = {};
    for (const [k, v] of Object.entries(fields)) {
      if (!editable.has(k)) throw new Error(`field not editable: ${k}`);
      // '' means "cleared" in the form; the app's fallbacks key off null.
      patch[k] = v === '' ? null : v;
    }
    const rows = db(await supabase.from('cities').update(patch).eq('id', id).select('id'));
    if (!rows.length) throw new Error('not found (or not an editor — check the editors table)');
    return { ok: true };
  },

  // Paginated by default — {rows, total, pageSize} — for the list page.
  // PlaceEditor's prev/next needs every matching slug in order, not one
  // page of it, so it passes `all: true` for the plain, unpaginated array
  // this returned before pagination existed.
  places: async (params = {}) => {
    const sortColumn = SORT_COLUMNS[params.sort] ?? 'created_at';
    const ascending = params.dir === 'asc';
    let query = supabase
      .from('places')
      .select(
        'slug, name_en, name_vi, category, categories, is_featured, vibe_tags, neighborhood_en, review_status, is_published, rating, rating_count, price_vnd, price_display, created_at, place_photos(photo_uri, is_cover, is_hidden)',
        { count: 'exact' },
      )
      .order(sortColumn, { ascending, nullsFirst: false })
      .order('slug'); // stable tiebreaker
    if (params.city) query = query.eq('city_id', params.city);
    if (params.status) query = query.eq('review_status', params.status);
    if (params.category) query = query.contains('categories', [params.category]);
    if (params.vibe) query = query.contains('vibe_tags', [params.vibe]);
    if (params.q) query = query.or(`name_en.ilike.%${params.q}%,name_vi.ilike.%${params.q}%`);
    if (!params.all) {
      const page = Math.max(1, Number(params.page) || 1);
      query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    }
    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    const rows = data.map((r) => {
      const visible = r.place_photos.filter((p) => !p.is_hidden);
      const cover = visible.find((p) => p.is_cover) ?? visible[0];
      const { place_photos, ...rest } = r;
      return { ...rest, cover_url: cover?.photo_uri ?? null, photo_count: visible.length };
    });
    return params.all ? rows : { rows, total: count, pageSize: PAGE_SIZE };
  },

  place: async (slug) => {
    const rows = db(await supabase.from('places').select('*, place_photos(*)').eq('slug', slug).limit(1));
    if (!rows.length) throw new Error('not found');
    const place = rows[0];
    place.place_photos.sort((a, b) => a.sort_order - b.sort_order);
    return place;
  },

  savePlace: async (slug, fields) => {
    const patch = {};
    for (const [k, v] of Object.entries(fields)) {
      if (!EDITABLE.has(k)) throw new Error(`field not editable: ${k}`);
      patch[k] = v;
    }
    if (!Object.keys(patch).length) throw new Error('no fields');
    if ('review_status' in patch) patch.reviewed_at = new Date().toISOString();
    patch.updated_at = new Date().toISOString();
    const rows = db(await supabase.from('places').update(patch).eq('slug', slug).select('slug'));
    if (!rows.length) throw new Error('not found (or not an editor — check the editors table)');
    return { ok: true };
  },

  deletePlace: async (slug) => {
    const places = db(await supabase.from('places').select('id').eq('slug', slug).limit(1));
    if (!places.length) throw new Error('not found');
    const placeId = places[0].id;

    // Collect uploaded objects before the cascade wipes the photo rows.
    const uploads = db(await supabase.from('place_photos')
      .select('storage_path').eq('place_id', placeId).eq('source', 'upload'));

    db(await supabase.from('places').delete().eq('id', placeId).select('id'));

    const paths = uploads.map((u) => u.storage_path).filter(Boolean);
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    return { ok: true, removed_uploads: paths.length };
  },

  // Same shape as deletePlace, batched — a bad scan-city run can bring in
  // a dozen duds at once, and deleting those one at a time (one confirm,
  // one round-trip each) is the thing this exists to avoid.
  deletePlaces: async (slugs) => {
    if (!slugs?.length) return { ok: true, deleted: 0, removed_uploads: 0 };
    const places = db(await supabase.from('places').select('id').in('slug', slugs));
    const ids = places.map((p) => p.id);
    if (!ids.length) return { ok: true, deleted: 0, removed_uploads: 0 };

    const uploads = db(await supabase.from('place_photos')
      .select('storage_path').in('place_id', ids).eq('source', 'upload'));

    db(await supabase.from('places').delete().in('id', ids).select('id'));

    const paths = uploads.map((u) => u.storage_path).filter(Boolean);
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    return { ok: true, deleted: ids.length, removed_uploads: paths.length };
  },

  /** Flip every approved-but-unpublished place live, scoped to a city.
   *  Approve and publish are separate switches; this closes the gap in one tap. */
  publishApproved: async (city) => {
    let query = supabase.from('places')
      .update({ is_published: true, updated_at: new Date().toISOString() })
      .eq('review_status', 'approved')
      .eq('is_published', false);
    if (city) query = query.eq('city_id', city);
    const rows = db(await query.select('slug'));
    return { published: rows.length };
  },

  progress: async (city) => {
    let query = supabase.from('places').select('review_status, category, categories, vibe_tags');
    if (city) query = query.eq('city_id', city);
    const rows = db(await query);
    const by = (key) => rows.reduce((acc, r) => ((acc[r[key]] = (acc[r[key]] ?? 0) + 1), acc), {});
    // Counts for the multi-valued columns: one place can add to several keys.
    const byTag = (key) => rows.reduce((acc, r) => {
      for (const v of r[key] ?? []) acc[v] = (acc[v] ?? 0) + 1;
      return acc;
    }, {});
    return {
      total: rows.length,
      by_status: by('review_status'),
      by_category: by('category'),
      by_category_tag: byTag('categories'),
      by_vibe: byTag('vibe_tags'),
    };
  },

  sync: () => invoke('sync-mockup', {}),

  // Keyed by google_place_id — global, not city-scoped, matching the
  // fetch-place import guard's own duplicate check. Lets "Add a place"
  // flag a search result that's already in the catalog before the editor
  // clicks Import and hits the 409.
  existingByPlaceIds: async (placeIds) => {
    if (!placeIds?.length) return {};
    const rows = db(await supabase.from('places')
      .select('google_place_id, slug, name_en, review_status')
      .in('google_place_id', placeIds));
    return Object.fromEntries(rows.map((r) => [r.google_place_id, r]));
  },

  searchPlaces: (query, city) => invoke('fetch-place', { action: 'search', query, city }),
  importPlace: (place_id, category, city) => invoke('fetch-place', { action: 'import', place_id, category, city }),

  scanCategories: () => invoke('scan-city', { action: 'categories' }),
  scanCity: (city, category_key) => invoke('scan-city', { action: 'scan', city, category_key }),

  patchPhoto: async (id, { is_cover, is_hidden }) => {
    if (is_cover === true) {
      const rows = db(await supabase.from('place_photos').select('place_id').eq('id', id).limit(1));
      if (!rows.length) throw new Error('not found');
      db(await supabase.from('place_photos').update({ is_cover: false }).eq('place_id', rows[0].place_id).select('id'));
      db(await supabase.from('place_photos').update({ is_cover: true, is_hidden: false }).eq('id', id).select('id'));
    }
    if (typeof is_hidden === 'boolean') {
      db(await supabase.from('place_photos').update({ is_hidden }).eq('id', id).select('id'));
    }
    return { ok: true };
  },

  reorderPhotos: async (slug, ids) => {
    for (const [i, id] of ids.entries()) {
      db(await supabase.from('place_photos').update({ sort_order: i }).eq('id', id).select('id'));
    }
    return { ok: true };
  },

  uploadPhoto: async (slug, blob, filename) => {
    const places = db(await supabase.from('places').select('id').eq('slug', slug).limit(1));
    if (!places.length) throw new Error('place not found');
    const placeId = places[0].id;

    const safeName = String(filename ?? 'photo').replace(/[^\w.-]/g, '_').slice(0, 60);
    const path = `${slug}/${Date.now()}-${safeName}.jpg`;

    const { error: upErr } = await supabase.storage.from(BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg' });
    if (upErr) throw new Error(upErr.message);
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

    const existing = db(await supabase.from('place_photos').select('sort_order').eq('place_id', placeId));
    const rows = db(await supabase.from('place_photos').insert({
      place_id: placeId,
      photo_ref: null,
      photo_uri: publicUrl,
      storage_path: path,
      source: 'upload',
      attribution_name: null,
      attribution_uri: null,
      sort_order: Math.max(-1, ...existing.map((r) => r.sort_order)) + 1,
      is_cover: false,
    }).select('*'));
    return rows[0];
  },

  deletePhoto: async (id) => {
    const rows = db(await supabase.from('place_photos').select('*').eq('id', id).limit(1));
    if (!rows.length) throw new Error('not found');
    const photo = rows[0];
    db(await supabase.from('collections').update({ cover_photo_id: null }).eq('cover_photo_id', photo.id).select('id'));
    db(await supabase.from('place_photos').delete().eq('id', photo.id).select('id'));
    if (photo.source === 'upload' && photo.storage_path) {
      await supabase.storage.from(BUCKET).remove([photo.storage_path]);
    }
    // keep a cover: promote the first visible photo if the cover was deleted
    if (photo.is_cover) {
      const rest = db(await supabase.from('place_photos')
        .select('id').eq('place_id', photo.place_id).eq('is_hidden', false)
        .order('sort_order').limit(1));
      if (rest.length) db(await supabase.from('place_photos').update({ is_cover: true }).eq('id', rest[0].id).select('id'));
    }
    return { ok: true };
  },
};

// Client-side resize: longest edge ≤ 1600px, JPEG 0.85 — keeps uploads ~<1MB.
export async function resizeImage(file, maxEdge = 1600) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
}
