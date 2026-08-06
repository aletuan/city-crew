// Local curation API for the cityCrew dashboard. Holds the Supabase secret key
// (from data/.env) so it never reaches the browser bundle; the Vite dev server
// proxies /api/* here. Localhost-only, single reviewer.
//
// Run: node --env-file=../data/.env server/index.mjs   (or `npm run api`)

import express from 'express';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 8787;
const BUCKET = 'place-photos';
const run = promisify(execFile);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Idempotent bucket setup — public read, service-key-only writes.
{
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: '10MB',
    allowedMimeTypes: ['image/jpeg', 'image/webp', 'image/png'],
  });
  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`bucket setup: ${error.message}`);
  }
}

const app = express();
app.use(express.json());

// Async route wrapper: Supabase errors become clean 500 JSON, not hung requests.
const route = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(req.method, req.path, err.message);
  res.status(err.status ?? 500).json({ error: err.message });
});
const bad = (message, status = 400) => Object.assign(new Error(message), { status });
const db = ({ data, error }) => { if (error) throw bad(error.message, 500); return data; };

// ── places ──────────────────────────────────────────────────────────────────

app.get('/api/places', route(async (req, res) => {
  const { status, category, vibe, q } = req.query;
  let query = supabase
    .from('places')
    .select('slug, name_en, name_vi, category, is_featured, vibe_tags, neighborhood_en, review_status, rating, place_photos(photo_uri, is_cover, is_hidden)')
    .order('slug');
  if (status) query = query.eq('review_status', status);
  if (category) query = query.eq('category', category);
  if (vibe) query = query.contains('vibe_tags', [vibe]);
  if (q) query = query.or(`name_en.ilike.%${q}%,name_vi.ilike.%${q}%`);
  const rows = db(await query);
  res.json(rows.map((r) => {
    const visible = r.place_photos.filter((p) => !p.is_hidden);
    const cover = visible.find((p) => p.is_cover) ?? visible[0];
    const { place_photos, ...rest } = r;
    return { ...rest, cover_url: cover?.photo_uri ?? null, photo_count: visible.length };
  }));
}));

app.get('/api/places/:slug', route(async (req, res) => {
  const rows = db(await supabase
    .from('places')
    .select('*, place_photos(*)')
    .eq('slug', req.params.slug)
    .limit(1));
  if (!rows.length) throw bad('not found', 404);
  const place = rows[0];
  place.place_photos.sort((a, b) => a.sort_order - b.sort_order);
  res.json(place);
}));

const EDITABLE = new Set([
  'name_en', 'name_vi', 'desc_en', 'desc_vi', 'neighborhood_en', 'neighborhood_vi',
  'address', 'category', 'is_featured', 'vibe_tags', 'emoji',
  'price_level', 'price_display', 'price_vnd', 'duration_min', 'duration_max',
  'opening_hours', 'website', 'phone', 'saved_count', 'sort_order', 'is_published',
  'review_status', 'review_note',
]);

app.patch('/api/places/:slug', route(async (req, res) => {
  const fields = {};
  for (const [k, v] of Object.entries(req.body)) {
    if (!EDITABLE.has(k)) throw bad(`field not editable: ${k}`);
    fields[k] = v;
  }
  if (!Object.keys(fields).length) throw bad('no fields');
  if ('review_status' in fields) fields.reviewed_at = new Date().toISOString();
  fields.updated_at = new Date().toISOString();
  const rows = db(await supabase.from('places').update(fields).eq('slug', req.params.slug).select('slug'));
  if (!rows.length) throw bad('not found', 404);
  res.json({ ok: true });
}));

app.delete('/api/places/:slug', route(async (req, res) => {
  const places = db(await supabase.from('places').select('id').eq('slug', req.params.slug).limit(1));
  if (!places.length) throw bad('not found', 404);
  const placeId = places[0].id;

  // Collect uploaded objects before the cascade wipes the photo rows.
  const uploads = db(await supabase.from('place_photos')
    .select('storage_path').eq('place_id', placeId).eq('source', 'upload'));

  // Deleting the place cascades place_photos and collection_places;
  // collections.cover_photo_id is ON DELETE SET NULL.
  db(await supabase.from('places').delete().eq('id', placeId));

  const paths = uploads.map((u) => u.storage_path).filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  res.json({ ok: true, removed_uploads: paths.length });
}));

// ── photos ──────────────────────────────────────────────────────────────────

app.post('/api/places/:slug/photos', express.raw({ type: 'image/*', limit: '15mb' }), route(async (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw bad('empty body — send raw image bytes with an image/* content-type');
  const places = db(await supabase.from('places').select('id').eq('slug', req.params.slug).limit(1));
  if (!places.length) throw bad('place not found', 404);
  const placeId = places[0].id;

  const ext = (req.headers['content-type'] ?? 'image/jpeg').split('/')[1].replace('jpeg', 'jpg');
  const safeName = String(req.query.filename ?? 'photo').replace(/[^\w.-]/g, '_').slice(0, 60);
  const path = `${req.params.slug}/${Date.now()}-${safeName}.${ext}`;

  const { error: upErr } = await supabase.storage.from(BUCKET)
    .upload(path, req.body, { contentType: req.headers['content-type'] });
  if (upErr) throw bad(upErr.message, 500);
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
  res.json(rows[0]);
}));

app.patch('/api/photos/:id', route(async (req, res) => {
  const { is_cover, is_hidden } = req.body;
  if (is_cover === true) {
    const rows = db(await supabase.from('place_photos').select('place_id').eq('id', req.params.id).limit(1));
    if (!rows.length) throw bad('not found', 404);
    db(await supabase.from('place_photos').update({ is_cover: false }).eq('place_id', rows[0].place_id));
    db(await supabase.from('place_photos').update({ is_cover: true, is_hidden: false }).eq('id', req.params.id));
  }
  if (typeof is_hidden === 'boolean') {
    db(await supabase.from('place_photos').update({ is_hidden }).eq('id', req.params.id));
  }
  res.json({ ok: true });
}));

app.put('/api/places/:slug/photo-order', route(async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) throw bad('ids array required');
  for (const [i, id] of ids.entries()) {
    db(await supabase.from('place_photos').update({ sort_order: i }).eq('id', id));
  }
  res.json({ ok: true });
}));

app.delete('/api/photos/:id', route(async (req, res) => {
  const rows = db(await supabase.from('place_photos').select('*').eq('id', req.params.id).limit(1));
  if (!rows.length) throw bad('not found', 404);
  const photo = rows[0];
  db(await supabase.from('collections').update({ cover_photo_id: null }).eq('cover_photo_id', photo.id));
  db(await supabase.from('place_photos').delete().eq('id', photo.id));
  if (photo.source === 'upload' && photo.storage_path) {
    await supabase.storage.from(BUCKET).remove([photo.storage_path]);
  }
  // keep a cover: promote the first visible photo if the cover was deleted
  if (photo.is_cover) {
    const rest = db(await supabase.from('place_photos')
      .select('id').eq('place_id', photo.place_id).eq('is_hidden', false)
      .order('sort_order').limit(1));
    if (rest.length) db(await supabase.from('place_photos').update({ is_cover: true }).eq('id', rest[0].id));
  }
  res.json({ ok: true });
}));

// ── progress + sync ─────────────────────────────────────────────────────────

app.get('/api/progress', route(async (_req, res) => {
  const rows = db(await supabase.from('places').select('review_status, category'));
  const by = (key) => rows.reduce((acc, r) => ((acc[r[key]] = (acc[r[key]] ?? 0) + 1), acc), {});
  res.json({ total: rows.length, by_status: by('review_status'), by_category: by('category') });
}));

app.post('/api/sync', route(async (_req, res) => {
  const dataDir = join(ROOT, 'data');
  const env = { ...process.env };
  const snap = await run('node', ['scripts/export-snapshot.mjs'], { cwd: dataDir, env });
  const inject = await run('node', ['scripts/inject-mockup.mjs'], { cwd: dataDir, env });
  res.json({ ok: true, snapshot: snap.stdout.trim(), inject: inject.stdout.trim() });
}));

app.listen(PORT, '127.0.0.1', () => {
  console.log(`citycrew dashboard api on http://127.0.0.1:${PORT}`);
});
