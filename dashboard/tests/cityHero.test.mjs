// The city cover, tested against the module rather than through api.js.
//
// No `mock.module`, no cache-busting import: `setCityHeroPhoto` takes its
// client as an argument, so one import covers every branch. That is the
// whole reason it is not in api.js — see the note at the top of
// src/cityHero.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeSupabase } from './_fakeSupabase.mjs';
import { cityHeroApi } from '../src/cityHero.js';

/** The two arguments every call here shares. */
const deps = (responses, extra) => ({
  client: fakeSupabase(responses, extra),
});
const call = (c) => cityHeroApi({ supabase: c, bucket: 'place-photos' });

// One cover per city, replaced rather than collected. Two things are worth
// pinning: the credit is not optional, and the file bookkeeping runs in the
// one order that cannot leave the row naming a file that is not there.

test('cover: setCityHeroPhoto refuses a photo nobody is credited for', async () => {
  const { client } = deps([]);
  await assert.rejects(
    () => call(client).setCityHeroPhoto('dalat', new Blob(), 'a.jpg', { credit: '   ' }),
    /a credit is required/,
  );
  // And it refuses before spending a round trip, let alone an upload.
  assert.equal(client.calls.length, 0);
});

test('cover: setCityHeroPhoto writes the row, then deletes the file it replaced', async () => {
  const removed = [];
  const { client } = deps([
    { data: [{ hero_photo_path: 'cities/dalat/old.jpg' }], error: null }, // read the old path
    { data: [{ id: 'dalat' }], error: null },                            // update the row
  ], {
    storageFrom: () => ({
      upload: async () => ({ error: null }),
      getPublicUrl: (path) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
      remove: async (paths) => { removed.push(...paths); return { data: paths.map((n2) => ({ name: n2 })), error: null }; },
    }),
  });

  const res = await call(client).setCityHeroPhoto('dalat', new Blob(), 'pine street.jpg', {
    credit: '@toilatuong.studio', creditUri: ' https://example.test/s ',
  });

  const [, updateArgs] = client.calls[1].chain.find(([m]) => m === 'update');
  assert.match(updateArgs[0].hero_photo_path, /^cities\/dalat\/\d+-pine_street\.jpg\.jpg$/);
  assert.equal(updateArgs[0].hero_photo_credit, '@toilatuong.studio');
  // Trimmed, because a stray space would be stored and then linked to.
  assert.equal(updateArgs[0].hero_photo_credit_uri, 'https://example.test/s');
  // The old file goes only after the row points at the new one.
  assert.deepEqual(removed, ['cities/dalat/old.jpg']);
  assert.equal(res.ok, true);
});

test('cover: setCityHeroPhoto takes its own upload back when the row refuses the write', async () => {
  const removed = [];
  const { client } = deps([
    { data: [{ hero_photo_path: null }], error: null },
    { data: [], error: null },   // not an editor: nothing updated
  ], {
    storageFrom: () => ({
      upload: async () => ({ error: null }),
      getPublicUrl: () => ({ data: { publicUrl: 'https://cdn.test/new.jpg' } }),
      remove: async (paths) => { removed.push(...paths); return { data: [], error: null }; },
    }),
  });
  await assert.rejects(
    () => call(client).setCityHeroPhoto('dalat', new Blob(), 'a.jpg', { credit: 'Someone' }),
    /not saved/,
  );
  // Nothing points at the file we just uploaded, so it does not stay.
  assert.equal(removed.length, 1);
  assert.match(removed[0], /^cities\/dalat\//);
});

test('cover: clearCityHeroPhoto empties all four columns and removes the file', async () => {
  const removed = [];
  const { client } = deps([
    { data: [{ hero_photo_path: 'cities/hue/old.jpg' }], error: null },
    { data: [{ id: 'hue' }], error: null },
  ], {
    storageFrom: () => ({
      remove: async (paths) => { removed.push(...paths); return { data: paths.map((n2) => ({ name: n2 })), error: null }; },
    }),
  });
  await call(client).clearCityHeroPhoto('hue');
  const [, updateArgs] = client.calls[1].chain.find(([m]) => m === 'update');
  assert.deepEqual(updateArgs[0], {
    hero_photo_uri: null, hero_photo_path: null,
    hero_photo_credit: null, hero_photo_credit_uri: null,
  });
  assert.deepEqual(removed, ['cities/hue/old.jpg']);
});

test('cover: clearCityHeroPhoto on a city that never had one touches no file', async () => {
  let asked = false;
  const { client } = deps([
    { data: [{ hero_photo_path: null }], error: null },
    { data: [{ id: 'hue' }], error: null },
  ], {
    storageFrom: () => ({ remove: async () => { asked = true; return { data: [], error: null }; } }),
  });
  const res = await call(client).clearCityHeroPhoto('hue');
  assert.equal(asked, false);
  assert.deepEqual(res, { ok: true, left: [] });
});

