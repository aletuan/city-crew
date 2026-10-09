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

// ---- the city cover's own columns are not hand-editable here; the
// mechanism itself lives in cityHero.js and is tested there.

test('the city hero photo columns are not hand-editable through saveCityHero', async () => {
  const { api } = await loadApi([]);
  // The URL and the path belong to setCityHeroPhoto, which owns the file
  // beside them; only the credit is typed.
  await assert.rejects(
    () => api.saveCityHero('dalat', { hero_photo_uri: 'https://evil.test/x.jpg' }),
    /field not editable: hero_photo_uri/,
  );
  await assert.rejects(
    () => api.saveCityHero('dalat', { hero_photo_path: 'cities/dalat/x.jpg' }),
    /field not editable: hero_photo_path/,
  );
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
        { photo_uri: 'hidden.jpg', is_cover: false, is_hidden: true, sort_order: -1 },
        { photo_uri: 'first.jpg', is_cover: false, is_hidden: false, sort_order: 0 },
        { photo_uri: 'cover.jpg', is_cover: true, is_hidden: false, sort_order: 9 },
      ],
    }],
    error: null, count: 1,
  }]);
  const { rows } = await api.places({});
  assert.equal(rows[0].cover_url, 'cover.jpg');
  assert.equal(rows[0].photo_count, 2);
  assert.equal(client.calls.length, 1); // no submitter lookup: added_by is null

  // And the fallback half of that rule, which is the database's job here.
  //
  // `photosOf` in the app reads cover first, then lowest `sort_order`.
  // This file only ever had the first half: the embed came back in no
  // order, so a place with no cover handed the desk whichever row
  // PostgREST felt like and the reader something else. Rare once; not any
  // more, since a reader's upload takes the cover and deleting it takes
  // the flag away.
  //
  // Asserted on the query rather than the outcome because the ordering is
  // now PostgREST's — a fake client returns whatever list it was handed,
  // so an outcome assertion here would pass with the clause deleted.
  assert.ok(
    client.calls[0].chain.some(
      ([m, args]) => m === 'order' && args[0] === 'sort_order'
        && args[1]?.referencedTable === 'place_photos',
    ),
    'the embedded photos are not ordered by sort_order',
  );
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

// ---- local guides: the desk's one-bit grant, read in bulk and written one
// row at a time. The rules are all RLS; what these pin is the shape of the
// two calls, because a wrong verb here is a grant that silently does
// nothing (delete matching no rows) or one that throws on the second click.

test('localGuides answers a map of who, to where', async () => {
  const { api } = await loadApi([
    { data: [
      { user_id: 'a', city_id: 'hanoi' },
      { user_id: 'a', city_id: 'danang' },
      { user_id: 'b', city_id: null },
    ], error: null },
  ]);
  const guides = await api.localGuides();
  assert.ok(guides instanceof Map);
  assert.deepEqual([...guides.get('a')].sort(), ['danang', 'hanoi']);
  // null is a member, not an absence: it is the all-cities grant.
  assert.deepEqual([...guides.get('b')], [null]);
});

// Read whole rather than per row: the board draws ten at a time, and ten
// round trips to answer ten yes/no questions is ten times the wrong shape.
test('localGuides asks once, with no filter — RLS is what scopes it', async () => {
  const { api, client } = await loadApi([{ data: [], error: null }]);
  await api.localGuides();
  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0].table, 'local_guides');
  assert.equal(client.calls[0].chain.some(([m]) => m === 'eq'), false);
});

// Delete then insert, not upsert: the two shapes of uniqueness are partial
// indexes, and a partial index cannot be an ON CONFLICT target. Deleting
// the row it is about to write is what keeps a second click harmless.
test('setLocalGuide clears the scope it is about to write', async () => {
  const { api, client } = await loadApi([
    { data: null, error: null }, { data: null, error: null },
  ]);
  await api.setLocalGuide('u1', true, 'hanoi');
  assert.ok(client.calls[0].chain.some(([m]) => m === 'delete'));
  const eqs = client.calls[0].chain.filter(([m]) => m === 'eq').map(([, a]) => a);
  assert.deepEqual(eqs, [['user_id', 'u1'], ['city_id', 'hanoi']]);
  const [, insArgs] = client.calls[1].chain.find(([m]) => m === 'insert');
  assert.deepEqual(insArgs[0], { user_id: 'u1', city_id: 'hanoi' });
});

// No city is the all-cities grant: one row whose city_id is null, matched
// with `is` rather than `eq` because SQL will not compare to null.
test('setLocalGuide writes the everywhere grant as a null city', async () => {
  const { api, client } = await loadApi([
    { data: null, error: null }, { data: null, error: null },
  ]);
  await api.setLocalGuide('u1', true);
  const [, isArgs] = client.calls[0].chain.find(([m]) => m === 'is');
  assert.deepEqual(isArgs, ['city_id', null]);
  const [, insArgs] = client.calls[1].chain.find(([m]) => m === 'insert');
  assert.deepEqual(insArgs[0], { user_id: 'u1', city_id: null });
});

// Nothing is sent for `added_by`. The column defaults to `auth.uid()`, so
// the database records which editor did this from the request's own
// credentials — see 20260919180000_local_guide_granted_by.sql.
test('setLocalGuide leaves added_by to the database', async () => {
  const { api, client } = await loadApi([
    { data: null, error: null }, { data: null, error: null },
  ]);
  await api.setLocalGuide('u1', true);
  const [, args] = client.calls[1].chain.find(([m]) => m === 'insert');
  assert.equal('added_by' in args[0], false);
});

// Revoking one city leaves the others standing; revoking with no city in
// hand takes the person's rows entirely, which is the only reading that
// matches a box that was ticked and has just been unticked.
test('setLocalGuide revokes one city, or the lot', async () => {
  const one = await loadApi([{ data: null, error: null }]);
  await one.api.setLocalGuide('u1', false, 'hanoi');
  const eqs = one.client.calls[0].chain.filter(([m]) => m === 'eq').map(([, a]) => a);
  assert.deepEqual(eqs, [['user_id', 'u1'], ['city_id', 'hanoi']]);

  const all = await loadApi([{ data: null, error: null }]);
  await all.api.setLocalGuide('u1', false);
  const chain = all.client.calls[0].chain;
  assert.deepEqual(chain.filter(([m]) => m === 'eq').map(([, a]) => a), [['user_id', 'u1']]);
  assert.equal(chain.some(([m]) => m === 'is'), false, 'the lot means no city filter at all');
});

// Loud, so the screen can put its optimistic tick back.
test('setLocalGuide surfaces a refusal rather than reporting success', async () => {
  const { api } = await loadApi([{ data: null, error: { message: 'not an editor' } }]);
  await assert.rejects(() => api.setLocalGuide('u1', true), /not an editor/);
});

// ---- the reads with no branch of their own. Each is one query, so what a
// test can pin is the query: the table, and the filter that decides what
// the screen is allowed to see. An outcome-only assertion would pass with
// the filter deleted, because the fake returns whatever it was handed.

test('reports reads the queue through its function, and an empty answer is an empty list', async () => {
  const { api, client } = await loadApi([{ data: null, error: null }]);
  assert.deepEqual(await api.reports(), []);
  assert.equal(client.calls[0].kind, 'rpc');
  assert.equal(client.calls[0].fn, 'reports_queue');
});

test('moderateCollection names the list and which way the switch goes', async () => {
  const { api, client } = await loadApi([{ data: null, error: null }]);
  await api.moderateCollection('c1', false);
  assert.equal(client.calls[0].fn, 'moderate_collection');
  assert.deepEqual(client.calls[0].args, { target: 'c1', hide: false });
});

test('categoryTerms answers category → terms, and a null terms column is an empty list', async () => {
  const { api } = await loadApi([{
    data: [{ category: 'fun', terms: ['cinema'] }, { category: 'food', terms: null }],
    error: null,
  }]);
  assert.deepEqual(await api.categoryTerms(), { fun: ['cinema'], food: [] });
});

test('cities come back in the editors\' own order', async () => {
  const { api, client } = await loadApi([{ data: [{ id: 'hanoi' }], error: null }]);
  assert.deepEqual(await api.cities(), [{ id: 'hanoi' }]);
  assert.deepEqual(client.calls[0].chain.find(([m]) => m === 'order'), ['order', ['sort_order']]);
});

test('city returns the one row, and says so when there is none', async () => {
  const found = await loadApi([{ data: [{ id: 'hanoi', hero_title_en: 'x' }], error: null }]);
  assert.equal((await found.api.city('hanoi')).hero_title_en, 'x');
  assert.deepEqual(found.client.calls[0].chain.find(([m]) => m === 'eq'), ['eq', ['id', 'hanoi']]);

  const missing = await loadApi([{ data: [], error: null }]);
  await assert.rejects(() => missing.api.city('atlantis'), /not found/);
});

// The editor's photo strip is drawn in this order, and PostgREST hands an
// embed back in none — so the sort is the function, not a nicety.
test('place sorts its photos by sort_order, and a missing slug is not found', async () => {
  const { api } = await loadApi([{
    data: [{ slug: 'a', place_photos: [{ id: 'c', sort_order: 2 }, { id: 'a', sort_order: 0 }, { id: 'b', sort_order: 1 }] }],
    error: null,
  }]);
  const place = await api.place('a');
  assert.deepEqual(place.place_photos.map((p) => p.id), ['a', 'b', 'c']);

  const missing = await loadApi([{ data: [], error: null }]);
  await assert.rejects(() => missing.api.place('gone'), /not found/);
});

test('cityCounts tallies every place by city, unscoped', async () => {
  const { api, client } = await loadApi([{
    data: [{ city_id: 'hanoi' }, { city_id: 'hanoi' }, { city_id: 'dalat' }],
    error: null,
  }]);
  assert.deepEqual(await api.cityCounts(), { hanoi: 2, dalat: 1 });
  assert.equal(client.calls[0].chain.some(([m]) => m === 'eq'), false);
});

// Both flags, because either alone is a place nobody can see — the
// sentence in the comment above `contributors` this pins.
test('contributors counts only app-added places that are approved and published', async () => {
  const { api, client } = await loadApi([
    { data: [{ added_by: 'u1', city_id: 'hanoi' }, { added_by: 'u1', city_id: 'dalat' }], error: null },
    { data: [{ id: 'u1', handle: 'nguyen' }], error: null },
  ]);
  const { rows, profiles } = await api.contributors(7);
  assert.equal(rows.length, 2);
  assert.equal(profiles.u1.handle, 'nguyen');
  const eqs = client.calls[0].chain.filter(([m]) => m === 'eq').map(([, a]) => a);
  assert.deepEqual(eqs, [['channel', 'mobile'], ['review_status', 'approved'], ['is_published', true]]);
  // One lookup for the person who added both.
  assert.deepEqual(client.calls[1].chain.find(([m]) => m === 'in'), ['in', ['id', ['u1']]]);
  // The window starts at midnight six days back, so "7 days" includes today.
  const [, [, since]] = client.calls[0].chain.find(([m]) => m === 'gte');
  const expected = new Date(); expected.setHours(0, 0, 0, 0); expected.setDate(expected.getDate() - 6);
  assert.equal(since, expected.toISOString());
});

test('contributors with nobody in the window skips the profile lookup', async () => {
  const { api, client } = await loadApi([{ data: [], error: null }]);
  assert.deepEqual(await api.contributors(), { rows: [], profiles: {} });
  assert.equal(client.calls.length, 1);
});

test('contributors keeps the rows when the profile lookup comes back empty', async () => {
  const { api } = await loadApi([
    { data: [{ added_by: 'u1' }], error: null },
    { data: null, error: { message: 'denied' } },
  ]);
  const { rows, profiles } = await api.contributors();
  assert.equal(rows.length, 1);
  assert.deepEqual(profiles, {});
});

test('coverage reads published places only', async () => {
  const { api, client } = await loadApi([{ data: [{ slug: 'a' }], error: null }]);
  assert.deepEqual(await api.coverage(), [{ slug: 'a' }]);
  assert.equal(client.calls[0].table, 'places');
  assert.deepEqual(client.calls[0].chain.find(([m]) => m === 'eq'), ['eq', ['is_published', true]]);
});

test('existingByPlaceIds keys the matches by google_place_id', async () => {
  const { api, client } = await loadApi([{
    data: [{ google_place_id: 'g1', slug: 'a', name_en: 'A', review_status: 'approved' }],
    error: null,
  }]);
  const found = await api.existingByPlaceIds(['g1', 'g2']);
  assert.deepEqual(Object.keys(found), ['g1']);
  assert.equal(found.g1.slug, 'a');
  assert.deepEqual(client.calls[0].chain.find(([m]) => m === 'in'), ['in', ['google_place_id', ['g1', 'g2']]]);
});

test('existingByPlaceIds asks nothing for an empty search', async () => {
  const { api, client } = await loadApi([]);
  assert.deepEqual(await api.existingByPlaceIds([]), {});
  assert.deepEqual(await api.existingByPlaceIds(undefined), {});
  assert.equal(client.calls.length, 0);
});

// ---- the edge-function wrappers. Two functions share an endpoint each and
// tell their callers apart by `action`, so a wrong word here reaches the
// other branch of the function, not an error.

function recordInvoke(reply = { data: { ok: true }, error: null }) {
  const sent = [];
  return { sent, invoke: async (name, opts) => { sent.push([name, opts.body]); return reply; } };
}

test('each wrapper sends its own function name and body', async () => {
  const rec = recordInvoke();
  const { api } = await loadApi([], { invoke: rec.invoke });
  await api.searchPlaces('phở', 'hanoi');
  await api.importPlace('g1', 'food', 'hanoi');
  await api.scanCategories();
  await api.scanCity('dalat', 'cafe');
  await api.suspendUser('u1');
  await api.suspendUser('u2', false);
  assert.deepEqual(rec.sent, [
    ['fetch-place', { action: 'search', query: 'phở', city: 'hanoi' }],
    ['fetch-place', { action: 'import', place_id: 'g1', category: 'food', city: 'hanoi' }],
    ['scan-city', { action: 'categories' }],
    ['scan-city', { action: 'scan', city: 'dalat', category_key: 'cafe' }],
    ['suspend-user', { user_id: 'u1', suspend: true }],
    ['suspend-user', { user_id: 'u2', suspend: false }],
  ]);
});

test('invoke returns the function\'s data on success', async () => {
  const rec = recordInvoke({ data: { results: [1] }, error: null });
  const { api } = await loadApi([], { invoke: rec.invoke });
  assert.deepEqual(await api.scanCategories(), { results: [1] });
});

// A non-2xx arrives as a generic "Edge Function returned a non-2xx status
// code"; the sentence worth showing is in the response body.
test('invoke surfaces the body of a non-2xx, not the generic wrapper message', async () => {
  const error = { message: 'non-2xx', context: { json: async () => ({ error: 'already imported' }) } };
  const { api } = await loadApi([], { invoke: async () => ({ data: null, error }) });
  await assert.rejects(() => api.importPlace('g1'), /^Error: already imported$/);
});

test('invoke falls back to the wrapper message when the body is not JSON', async () => {
  const error = { message: 'non-2xx', context: { json: async () => { throw new SyntaxError('bad'); } } };
  const { api } = await loadApi([], { invoke: async () => ({ data: null, error }) });
  await assert.rejects(() => api.importPlace('g1'), /^Error: non-2xx$/);
});

test('invoke falls back to the wrapper message when there is no response at all', async () => {
  const { api } = await loadApi([], { invoke: async () => ({ data: null, error: { message: 'offline' } }) });
  await assert.rejects(() => api.scanCategories(), /^Error: offline$/);
});

// A 200 that carries an error is still a failure.
test('invoke treats an error inside a 200 as a failure', async () => {
  const { api } = await loadApi([], { invoke: async () => ({ data: { error: 'quota' }, error: null }) });
  await assert.rejects(() => api.scanCity('hanoi', 'cafe'), /quota/);
});

// ---- uploadPhoto: the one path a file enters the bucket from the desk.

function recordBucket({ uploadError = null, removed } = {}) {
  const log = { uploads: [], removes: [], buckets: [] };
  const storageFrom = (name) => {
    log.buckets.push(name);
    return {
      upload: async (path, blob, opts) => { log.uploads.push({ path, blob, opts }); return { error: uploadError }; },
      getPublicUrl: (path) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
      remove: async (paths) => {
        log.removes.push(paths);
        return { data: (removed ?? paths).map((name) => ({ name })), error: null };
      },
    };
  };
  return { log, storageFrom };
}

test('uploadPhoto on a slug that does not exist fails before anything is uploaded', async () => {
  const bucket = recordBucket();
  const { api } = await loadApi([{ data: [], error: null }], { storageFrom: bucket.storageFrom });
  await assert.rejects(() => api.uploadPhoto('gone', 'blob', 'x.jpg'), /place not found/);
  assert.equal(bucket.log.uploads.length, 0);
});

test('uploadPhoto stores the file under the slug, sanitised, marked as already shrunk', async () => {
  const bucket = recordBucket();
  const { api, client } = await loadApi([
    { data: [{ id: 'p1' }], error: null },
    { data: [{ sort_order: 0 }, { sort_order: 4 }, { sort_order: 2 }], error: null },
    { data: [{ id: 'new' }], error: null },
  ], { storageFrom: bucket.storageFrom });
  const blob = { size: 1 };
  const row = await api.uploadPhoto('cafe-a', blob, 'mặt tiền (1).png');
  assert.deepEqual(row, { id: 'new' });

  const [up] = bucket.log.uploads;
  assert.match(up.path, /^cafe-a\/\d+-m_t_ti_n__1_\.png\.jpg$/);
  assert.equal(up.blob, blob);
  assert.deepEqual(up.opts, { contentType: 'image/jpeg', metadata: { shrunk: '1' } });
  assert.ok(bucket.log.buckets.every((b) => b === 'place-photos'));

  const [, insertArgs] = client.calls[2].chain.find(([m]) => m === 'insert');
  assert.equal(insertArgs[0].sort_order, 5, 'one past the highest, not the count');
  assert.equal(insertArgs[0].place_id, 'p1');
  assert.equal(insertArgs[0].storage_path, up.path);
  assert.equal(insertArgs[0].photo_uri, `https://cdn.test/${up.path}`);
  assert.equal(insertArgs[0].source, 'upload');
  assert.equal(insertArgs[0].is_cover, false);
});

test('uploadPhoto truncates a long name to 60 characters, and names a nameless file "photo"', async () => {
  const bucket = recordBucket();
  const long = 'a'.repeat(100);
  const first = await loadApi([
    { data: [{ id: 'p1' }], error: null }, { data: [], error: null }, { data: [{}], error: null },
  ], { storageFrom: bucket.storageFrom });
  await first.api.uploadPhoto('s', {}, long);
  assert.match(bucket.log.uploads[0].path, new RegExp(`^s/\\d+-${'a'.repeat(60)}\\.jpg$`));
  // The first photo of a place is sort_order 0, not 1 and not -Infinity.
  const [, insertArgs] = first.client.calls[2].chain.find(([m]) => m === 'insert');
  assert.equal(insertArgs[0].sort_order, 0);

  const second = await loadApi([
    { data: [{ id: 'p1' }], error: null }, { data: [], error: null }, { data: [{}], error: null },
  ], { storageFrom: bucket.storageFrom });
  await second.api.uploadPhoto('s', {});
  assert.match(bucket.log.uploads[1].path, /^s\/\d+-photo\.jpg$/);
});

test('uploadPhoto surfaces a refused upload and writes no row', async () => {
  const bucket = recordBucket({ uploadError: { message: 'Payload too large' } });
  const { api, client } = await loadApi([{ data: [{ id: 'p1' }], error: null }], { storageFrom: bucket.storageFrom });
  await assert.rejects(() => api.uploadPhoto('s', {}, 'x'), /Payload too large/);
  assert.equal(client.calls.length, 1);
});

// ---- deletePhoto: the cover invariant from the other side. patchPhoto
// keeps "exactly one cover" when one is chosen; this keeps it when the
// chosen one goes away.

test('deleting the cover promotes the first visible remaining photo', async () => {
  const bucket = recordBucket();
  const { api, client } = await loadApi([
    { data: [{ id: 'ph1', place_id: 'p1', is_cover: true, storage_path: 'a/1.jpg' }], error: null },
    { data: [], error: null },           // collections cleared
    { data: [{ id: 'ph1' }], error: null }, // photo row deleted
    { data: [{ id: 'ph2' }], error: null }, // next visible
    { data: [{ id: 'ph2' }], error: null }, // promoted
  ], { storageFrom: bucket.storageFrom });
  assert.deepEqual(await api.deletePhoto('ph1'), { ok: true, left: [] });

  const pick = client.calls[3].chain;
  assert.ok(pick.some(([m, a]) => m === 'eq' && a[0] === 'place_id' && a[1] === 'p1'));
  assert.ok(pick.some(([m, a]) => m === 'eq' && a[0] === 'is_hidden' && a[1] === false), 'a hidden photo cannot become the cover');
  assert.ok(pick.some(([m, a]) => m === 'order' && a[0] === 'sort_order'));
  const promote = client.calls[4].chain;
  assert.deepEqual(promote.find(([m]) => m === 'update'), ['update', [{ is_cover: true }]]);
  assert.deepEqual(promote.find(([m]) => m === 'eq'), ['eq', ['id', 'ph2']]);
});

test('deleting the cover of a place with nothing visible left promotes nothing', async () => {
  const { api, client } = await loadApi([
    { data: [{ id: 'ph1', place_id: 'p1', is_cover: true, storage_path: null }], error: null },
    { data: [], error: null }, { data: [], error: null },
    { data: [], error: null }, // no visible photo remains
  ]);
  await api.deletePhoto('ph1');
  assert.equal(client.calls.length, 4);
});

test('deleting a photo that is not the cover leaves the cover alone', async () => {
  const { api, client } = await loadApi([
    { data: [{ id: 'ph2', place_id: 'p1', is_cover: false, storage_path: null }], error: null },
    { data: [], error: null }, { data: [], error: null },
  ]);
  await api.deletePhoto('ph2');
  assert.equal(client.calls.length, 3);
  assert.equal(client.calls.some((c) => c.chain.some(([m, a]) => m === 'update' && a[0].is_cover === true)), false);
});

// collections.cover_photo_id would otherwise point at a row that is gone,
// and a list's card would draw a broken picture.
test('deletePhoto clears the cover of every list pointing at it, before deleting the row', async () => {
  const { api, client } = await loadApi([
    { data: [{ id: 'ph1', place_id: 'p1', is_cover: false, storage_path: null }], error: null },
    { data: [{ id: 'col1' }], error: null }, { data: [], error: null },
  ]);
  await api.deletePhoto('ph1');
  const clear = client.calls[1];
  assert.equal(clear.table, 'collections');
  assert.deepEqual(clear.chain.find(([m]) => m === 'update'), ['update', [{ cover_photo_id: null }]]);
  assert.deepEqual(clear.chain.find(([m]) => m === 'eq'), ['eq', ['cover_photo_id', 'ph1']]);
  const del = client.calls[2];
  assert.equal(del.table, 'place_photos');
  assert.ok(del.chain.some(([m]) => m === 'delete'));
  assert.deepEqual(del.chain.find(([m]) => m === 'eq'), ['eq', ['id', 'ph1']]);
});

test('deletePhoto removes the stored object, and reports one Storage kept', async () => {
  const bucket = recordBucket({ removed: [] });
  const { api } = await loadApi([
    { data: [{ id: 'ph1', place_id: 'p1', is_cover: false, storage_path: 'a/1.jpg' }], error: null },
    { data: [], error: null }, { data: [], error: null },
  ], { storageFrom: bucket.storageFrom });
  const result = await api.deletePhoto('ph1');
  assert.deepEqual(bucket.log.removes, [['a/1.jpg']]);
  assert.deepEqual(bucket.log.buckets, ['place-photos']);
  assert.deepEqual(result, { ok: true, left: ['a/1.jpg'] });
});

test('deletePhoto on an id that no longer exists touches nothing else', async () => {
  const bucket = recordBucket();
  const { api, client } = await loadApi([{ data: [], error: null }], { storageFrom: bucket.storageFrom });
  await assert.rejects(() => api.deletePhoto('gone'), /not found/);
  assert.equal(client.calls.length, 1);
  assert.equal(bucket.log.removes.length, 0);
});

// ---- resizeImage. The browser does the decoding and encoding; what is ours
// is the arithmetic (longest edge to maxEdge, never up) and the encoder
// settings. Stand-ins for the three browser objects record what they are
// asked, which is all that arithmetic produces — a real canvas would add
// nothing these assertions could see.

async function resizeWith(width, height, maxEdge) {
  const drawn = [];
  let toBlobArgs;
  const canvas = {
    getContext: (kind) => { assert.equal(kind, '2d'); return { drawImage: (...a) => drawn.push(a) }; },
    toBlob: (cb, type, quality) => { toBlobArgs = [type, quality]; cb({ jpeg: true }); },
  };
  const bitmap = { width, height };
  const saved = { createImageBitmap: globalThis.createImageBitmap, document: globalThis.document };
  globalThis.createImageBitmap = async () => bitmap;
  globalThis.document = { createElement: (tag) => { assert.equal(tag, 'canvas'); return canvas; } };
  try {
    const { resizeImage } = await import(`../src/api.js?t=${n++}`);
    const blob = await (maxEdge === undefined ? resizeImage({}) : resizeImage({}, maxEdge));
    return { blob, canvas, drawn, toBlobArgs, bitmap };
  } finally {
    globalThis.createImageBitmap = saved.createImageBitmap;
    globalThis.document = saved.document;
  }
}

test('resizeImage brings the longest edge down to 1200, keeping the proportions', async () => {
  const landscape = await resizeWith(4000, 3000);
  assert.deepEqual([landscape.canvas.width, landscape.canvas.height], [1200, 900]);
  assert.deepEqual(landscape.drawn, [[landscape.bitmap, 0, 0, 1200, 900]]);
  assert.deepEqual(landscape.toBlobArgs, ['image/jpeg', 0.8]);
  assert.deepEqual(landscape.blob, { jpeg: true });

  const portrait = await resizeWith(3024, 4032);
  assert.deepEqual([portrait.canvas.width, portrait.canvas.height], [900, 1200]);
});

test('resizeImage never enlarges a photo already under the limit', async () => {
  const small = await resizeWith(800, 600);
  assert.deepEqual([small.canvas.width, small.canvas.height], [800, 600]);
});

test('resizeImage honours a smaller limit when one is asked for', async () => {
  const thumb = await resizeWith(1000, 500, 400);
  assert.deepEqual([thumb.canvas.width, thumb.canvas.height], [400, 200]);
});
