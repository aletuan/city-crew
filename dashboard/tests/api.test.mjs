// dashboard/src/api.js is the desk's whole write path to Supabase — CRUD on
// places, moderation, photo management — and until now it had zero
// automated coverage: everything in it ran for the first time in
// production. `mock.module` swaps out `./lib/supabase.js` (which throws on
// import outside a Vite build — it reads `import.meta.env`) for the fake in
// `_fakeSupabase.mjs`, so api.js's own logic runs for real while every
// network call is a scripted, inspectable stand-in.
//
// Each test re-imports api.js with a cache-busting query string, because ESM
// caches a module the first time it loads — without a fresh specifier every
// test after the first would see the previous test's fake client.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { fakeSupabase } from './_fakeSupabase.mjs';

let n = 0;
let activeMock = null;
async function loadApi(responses, extra) {
  activeMock?.restore();
  const client = fakeSupabase(responses, extra);
  activeMock = mock.module('../src/lib/supabase.js', { namedExports: { supabase: client } });
  const mod = await import(`../src/api.js?t=${n++}`);
  return { api: mod.api, client };
}

// ---- savePlace: the field whitelist is the one thing standing between a
// typo'd key and a silent no-op (RLS blocks an unknown column at the row
// level, not the field level, so this is the only place that fails loudly).

test('savePlace rejects a field outside the editable whitelist', async () => {
  const { api } = await loadApi([]);
  await assert.rejects(
    () => api.savePlace('a-slug', { saved_count: 99 }),
    /field not editable: saved_count/,
  );
});

test('savePlace refuses an empty patch rather than sending a no-op update', async () => {
  const { api } = await loadApi([]);
  await assert.rejects(() => api.savePlace('a-slug', {}), /no fields/);
});

test('savePlace stamps reviewed_at only when review_status is part of the patch', async () => {
  const { api, client } = await loadApi([{ data: [{ slug: 'a-slug' }], error: null }]);
  await api.savePlace('a-slug', { review_status: 'approved' });
  const [, updateArgs] = client.calls[0].chain.find(([m]) => m === 'update');
  assert.ok('reviewed_at' in updateArgs[0]);
  assert.ok('updated_at' in updateArgs[0]);
});

test('savePlace leaves reviewed_at alone for an ordinary field edit', async () => {
  const { api, client } = await loadApi([{ data: [{ slug: 'a-slug' }], error: null }]);
  await api.savePlace('a-slug', { name_en: 'New name' });
  const [, updateArgs] = client.calls[0].chain.find(([m]) => m === 'update');
  assert.equal('reviewed_at' in updateArgs[0], false);
  assert.equal(updateArgs[0].name_en, 'New name');
});

test('savePlace surfaces "not an editor" rather than a bare 0-rows result', async () => {
  const { api } = await loadApi([{ data: [], error: null }]);
  await assert.rejects(() => api.savePlace('a-slug', { name_en: 'x' }), /not an editor/);
});

// ---- saveCityHero: same whitelist idea, plus the '' → null convention the
// app's own fallbacks depend on.

test('saveCityHero rejects a field outside its own (smaller) whitelist', async () => {
  const { api } = await loadApi([]);
  await assert.rejects(
    () => api.saveCityHero('hanoi', { name_en: 'nope' }),
    /field not editable: name_en/,
  );
});

test('saveCityHero turns a cleared form field into null, not an empty string', async () => {
  const { api, client } = await loadApi([{ data: [{ id: 'hanoi' }], error: null }]);
  await api.saveCityHero('hanoi', { hero_title_en: '', hero_sub_en: 'Still here' });
  const [, updateArgs] = client.calls[0].chain.find(([m]) => m === 'update');
  assert.equal(updateArgs[0].hero_title_en, null);
  assert.equal(updateArgs[0].hero_sub_en, 'Still here');
});

test('saveCityHero on an unknown city reports not found, not a silent success', async () => {
  const { api } = await loadApi([{ data: [], error: null }]);
  await assert.rejects(() => api.saveCityHero('atlantis', {}), /not found/);
});

// ---- deletePlace / deletePlaces: the bug this repo already had once —
// files outliving their rows — so the sequence (collect paths, delete rows,
// then remove objects) is exactly what these pin down.

test('deletePlace collects storage paths before the row disappears, and skips places with none', async () => {
  const { api, client } = await loadApi([
    { data: [{ id: 'p1' }], error: null }, // places lookup by slug
    { data: [{ storage_path: 'a/1.jpg' }, { storage_path: null }], error: null }, // place_photos
    { data: [{ id: 'p1' }], error: null }, // delete
  ], {
    storageFrom: () => ({ remove: async (paths) => ({ data: paths.map((n) => ({ name: n })), error: null }) }),
  });
  const result = await api.deletePlace('a-slug');
  assert.deepEqual(result, { ok: true, removed_uploads: 1, left: [] });
  // The delete call must target the id looked up, not the slug itself.
  const deleteCall = client.calls[2];
  assert.deepEqual(deleteCall.chain.find(([m]) => m === 'eq'), ['eq', ['id', 'p1']]);
});

test('deletePlace on a slug that no longer exists fails before touching Storage', async () => {
  const { api } = await loadApi([{ data: [], error: null }]);
  await assert.rejects(() => api.deletePlace('gone'), /not found/);
});

test('deletePlaces is a no-op for an empty list — no round trip at all', async () => {
  const { api, client } = await loadApi([]);
  const result = await api.deletePlaces([]);
  assert.deepEqual(result, { ok: true, deleted: 0, removed_uploads: 0 });
  assert.equal(client.calls.length, 0);
});

test('deletePlaces batches every id into one delete, and reports what Storage left behind', async () => {
  const { api } = await loadApi([
    { data: [{ id: 'p1' }, { id: 'p2' }], error: null },
    { data: [{ storage_path: 'a/1.jpg' }], error: null },
    { data: [{ id: 'p1' }, { id: 'p2' }], error: null },
  ], {
    storageFrom: () => ({ remove: async () => ({ data: [], error: null }) }), // nothing removed
  });
  const result = await api.deletePlaces(['s1', 's2']);
  assert.deepEqual(result, { ok: true, deleted: 2, removed_uploads: 0, left: ['a/1.jpg'] });
});

// ---- patchPhoto: the cover invariant (exactly one photo per place is the
// cover) and the independent is_hidden toggle.

test('patchPhoto promoting a cover unsets the old one on the same place, then sets the new one visible', async () => {
  const { api, client } = await loadApi([
    { data: [{ place_id: 'p1' }], error: null }, // lookup place_id for photo
    { data: [{ id: 'old' }], error: null },      // unset previous cover
    { data: [{ id: 'new' }], error: null },      // set new cover
  ]);
  await api.patchPhoto('new', { is_cover: true });
  const unsetCall = client.calls[1];
  assert.deepEqual(unsetCall.chain.find(([m]) => m === 'update'), ['update', [{ is_cover: false }]]);
  assert.deepEqual(unsetCall.chain.find(([m]) => m === 'eq'), ['eq', ['place_id', 'p1']]);
  const setCall = client.calls[2];
  assert.deepEqual(setCall.chain.find(([m]) => m === 'update'), ['update', [{ is_cover: true, is_hidden: false }]]);
});

test('patchPhoto hiding a photo does not touch is_cover at all', async () => {
  const { api, client } = await loadApi([{ data: [{ id: 'p1' }], error: null }]);
  await api.patchPhoto('p1', { is_hidden: true });
  assert.equal(client.calls.length, 1);
  assert.deepEqual(client.calls[0].chain.find(([m]) => m === 'update'), ['update', [{ is_hidden: true }]]);
});

// ---- reorderPhotos: index *is* the new sort_order, one update per id.

test('reorderPhotos writes each photo\'s array index as its sort_order', async () => {
  const { api, client } = await loadApi([
    { data: [{ id: 'a' }], error: null },
    { data: [{ id: 'b' }], error: null },
    { data: [{ id: 'c' }], error: null },
  ]);
  await api.reorderPhotos('slug', ['a', 'b', 'c']);
  const orders = client.calls.map((c) => c.chain.find(([m]) => m === 'update')[1][0].sort_order);
  assert.deepEqual(orders, [0, 1, 2]);
});

// ---- places(): the filter row's params turning into the right query, and
// the response reshaping (cover photo, visible-only photo_count).

test('places() maps each filter param to its own query clause', async () => {
  const { api, client } = await loadApi([{ data: [], error: null, count: 0 }]);
  await api.places({
    city: 'hanoi', status: 'approved', category: 'cafe', vibe: 'chill',
    needs: true, threads: 'no', channel: 'mobile', q: 'phở',
  });
  const chain = client.calls[0].chain;
  const has = (m, args) => chain.some(([mm, aa]) => mm === m && JSON.stringify(aa) === JSON.stringify(args));
  assert.ok(has('eq', ['city_id', 'hanoi']));
  assert.ok(has('eq', ['review_status', 'approved']));
  assert.ok(has('contains', ['categories', ['cafe']]));
  assert.ok(has('contains', ['vibe_tags', ['chill']]));
  assert.ok(has('eq', ['needs_classification', true]));
  assert.ok(has('is', ['threads_handle', null]));
  assert.ok(has('eq', ['channel', 'mobile']));
  assert.ok(chain.some(([m, a]) => m === 'or' && a[0].includes('phở')));
});

test('places() defaults to created_at desc and paginates by 24', async () => {
  const { api, client } = await loadApi([{ data: [], error: null, count: 0 }]);
  await api.places({ page: 2 });
  const chain = client.calls[0].chain;
  assert.ok(chain.some(([m, a]) => m === 'order' && a[0] === 'created_at' && a[1].ascending === false));
  assert.ok(chain.some(([m, a]) => m === 'range' && a[0] === 24 && a[1] === 47));
});

test('places() with all:true skips pagination and returns a plain array', async () => {
  const { api, client } = await loadApi([{
    data: [{ slug: 's', place_photos: [], added_by: null }],
    error: null, count: 1,
  }]);
  const result = await api.places({ all: true });
  assert.ok(Array.isArray(result));
  assert.equal(client.calls[0].chain.some(([m]) => m === 'range'), false);
});

test('places() picks the cover photo, falling back to the first visible one, and counts only visible photos', async () => {
  const { api, client } = await loadApi([{
    data: [{
      slug: 'a', added_by: null,
      place_photos: [
        { photo_uri: 'hidden.jpg', is_cover: false, is_hidden: true },
        { photo_uri: 'first.jpg', is_cover: false, is_hidden: false },
        { photo_uri: 'cover.jpg', is_cover: true, is_hidden: false },
      ],
    }],
    error: null, count: 1,
  }]);
  const { rows } = await api.places({});
  assert.equal(rows[0].cover_url, 'cover.jpg');
  assert.equal(rows[0].photo_count, 2);
  assert.equal(client.calls.length, 1); // no submitter lookup: added_by is null
});

test('places() looks up each contributor once, even when several rows share one', async () => {
  const row = (slug) => ({ slug, added_by: 'u1', place_photos: [] });
  const { api, client } = await loadApi([
    { data: [row('a'), row('b')], error: null, count: 2 },
    { data: [{ id: 'u1', handle: 'nguyen', full_name: 'Nguyen' }], error: null },
  ]);
  const { rows } = await api.places({});
  assert.equal(rows[0].submitter.handle, 'nguyen');
  assert.equal(rows[1].submitter.handle, 'nguyen');
  assert.deepEqual(client.calls[1].chain.find(([m]) => m === 'in'), ['in', ['id', ['u1']]]);
});

// ---- approvePlaces / publishApproved: the two switches stay independent.

test('approvePlaces excludes already-approved rows so the count reflects real changes', async () => {
  const { api, client } = await loadApi([{ data: [{ slug: 'a' }], error: null }]);
  const result = await api.approvePlaces(['a', 'b']);
  assert.equal(result.approved, 1);
  assert.ok(client.calls[0].chain.some(([m, a]) => m === 'neq' && a[0] === 'review_status'));
});

test('approvePlaces on an empty selection makes no request', async () => {
  const { api, client } = await loadApi([]);
  assert.deepEqual(await api.approvePlaces([]), { ok: true, approved: 0 });
  assert.equal(client.calls.length, 0);
});

test('publishApproved only ever flips approved-and-unpublished rows, optionally scoped to one city', async () => {
  const { api, client } = await loadApi([{ data: [{ slug: 'a' }, { slug: 'b' }], error: null }]);
  const result = await api.publishApproved('hanoi');
  assert.equal(result.published, 2);
  const chain = client.calls[0].chain;
  assert.ok(chain.some(([m, a]) => m === 'eq' && a[0] === 'review_status' && a[1] === 'approved'));
  assert.ok(chain.some(([m, a]) => m === 'eq' && a[0] === 'is_published' && a[1] === false));
  assert.ok(chain.some(([m, a]) => m === 'eq' && a[0] === 'city_id' && a[1] === 'hanoi'));
});

// ---- progress(): the aggregation an editor's whole triage screen is built
// on — in particular the "approved but nobody can see it" gap the comments
// in api.js call out by name.

test('progress() counts a place as unpublished only when approved and not yet live', async () => {
  const rows = [
    { slug: 'a', review_status: 'approved', is_published: false, categories: ['cafe'], vibe_tags: ['chill'] },
    { slug: 'b', review_status: 'approved', is_published: true, categories: [], vibe_tags: [] },
    { slug: 'c', review_status: 'pending', is_published: false, categories: [], vibe_tags: [] },
  ];
  const { api } = await loadApi([{ data: rows, error: null }]);
  const result = await api.progress();
  assert.equal(result.unpublished, 1);
  assert.equal(result.total, 3);
  assert.equal(result.by_status.approved, 2);
});

test('progress() names the unclassified rows and which half is missing, rather than only counting them', async () => {
  const rows = [
    { slug: 'a', name_en: 'A', review_status: 'pending', is_published: false, needs_classification: true, categories: [], vibe_tags: ['chill'] },
    { slug: 'b', name_en: 'B', review_status: 'pending', is_published: false, needs_classification: true, categories: ['cafe'], vibe_tags: [] },
    { slug: 'c', name_en: 'C', review_status: 'approved', is_published: true, needs_classification: false, categories: ['cafe'], vibe_tags: ['chill'] },
  ];
  const { api } = await loadApi([{ data: rows, error: null }]);
  const result = await api.progress();
  assert.equal(result.unclassified.length, 2);
  assert.equal(result.unclassified.find((r) => r.slug === 'a').no_category, true);
  assert.equal(result.unclassified.find((r) => r.slug === 'a').no_vibe, false);
  assert.equal(result.unclassified.find((r) => r.slug === 'b').no_vibe, true);
});

// ---- saveCount / categoryTerms: small but easy to get backwards.

test('saveCount trusts a live row count over the hand-typed saved_count column', async () => {
  const { api, client } = await loadApi([{ data: null, error: null, count: 7 }]);
  assert.equal(await api.saveCount('place-1'), 7);
  assert.ok(client.calls[0].chain.some(([m, a]) => m === 'eq' && a[0] === 'place_id' && a[1] === 'place-1'));
});

test('saveCategoryTerms trims, drops blanks, and de-duplicates before writing', async () => {
  const { api, client } = await loadApi([{ data: [{ category: 'food' }], error: null }]);
  const clean = await api.saveCategoryTerms('food', [' cinema ', '', 'cinema', 'rạp']);
  assert.deepEqual(clean, ['cinema', 'rạp']);
  const [, upsertArgs] = client.calls[0].chain.find(([m]) => m === 'upsert');
  assert.deepEqual(upsertArgs[0].terms, ['cinema', 'rạp']);
});

// ---- moderation actions: each flag independent, and the RPC target named
// correctly — the part a typo in a refactor would not catch.

test('moderateProfile clears only the flagged fields', async () => {
  const { api, client } = await loadApi([{ data: null, error: null }]);
  await api.moderateProfile('u1', { bio: true });
  assert.deepEqual(client.calls[0].args, {
    target: 'u1', clear_bio: true, clear_avatar: false, clear_name: false,
  });
});

test('markReport stamps handled_at and the chosen status', async () => {
  const { api, client } = await loadApi([{ data: null, error: null }]);
  await api.markReport('r1', 'dismissed');
  const [, updateArgs] = client.calls[0].chain.find(([m]) => m === 'update');
  assert.equal(updateArgs[0].status, 'dismissed');
  assert.ok(updateArgs[0].handled_at);
});
