// The gallery's calls, pinned by shape: which table and columns a read
// asks for, which function a write names, and that every write throws.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fake: null as ReturnType<typeof import('../testing').fakeSupabase> | null }));
vi.mock('../supabase', async () => {
  const { fakeSupabase } = await import('../testing');
  h.fake = fakeSupabase();
  return { supabase: h.fake.client };
});

import { fetchGallery, savePhotoScore, setCover, setHidden } from './gallery';
import { SCORER_VERSION } from '../photoScore';

const fake = () => h.fake!;
beforeEach(() => fake().reset());

describe('fetchGallery', () => {
  // Its own query, not the catalog embed: the embed lacks `source`, and
  // it is read through `photosOf`, which drops hidden rows before the
  // gallery could see them.
  it('reads every photograph on the place, source included, in order', async () => {
    fake().replies({ data: [{ id: 'a', sort_order: 0 }] });
    expect(await fetchGallery('place-1')).toEqual([{ id: 'a', sort_order: 0, score: null }]);
    const q = fake().log[0];
    expect(q).toMatchObject({ table: 'place_photos', op: 'select', filters: [['place_id', 'place-1']] });
    // `storage_path` is what a delete hands to the bucket afterwards.
    for (const col of ['source', 'is_hidden', 'is_cover', 'sort_order', 'storage_path']) {
      expect(String(q.payload)).toContain(col);
    }
    expect(JSON.stringify(q.order)).toContain('sort_order');
  });

  // No filter on hidden — RLS returns them to the keeper and to nobody
  // else. A `.eq('is_hidden', false)` here would hide the very rows the
  // screen exists to show.
  it('does not filter hidden rows away', async () => {
    fake().replies({ data: [] });
    await fetchGallery('place-1');
    expect(fake().log[0].filters).toEqual([['place_id', 'place-1']]);
  });

  // The score is embedded, so the gallery costs one read and not two.
  it('carries each photograph\'s score, as an object whichever way PostgREST embeds it', async () => {
    const sc = { scorer_version: 1, aesthetic: 0.4, is_utility: false, signals: {} };
    fake().replies({ data: [
      { id: 'a', photo_scores: sc },
      { id: 'b', photo_scores: [sc] },
      { id: 'c', photo_scores: [] },
      { id: 'd', photo_scores: null },
    ] });
    const got = await fetchGallery('place-1');
    expect(got.map((p) => p.score)).toEqual([sc, sc, null, null]);
    // The embed's own key does not survive into the photograph.
    expect(got[0]).not.toHaveProperty('photo_scores');
    expect(String(fake().log[0].payload)).toMatch(/photo_scores\(scorer_version, aesthetic, is_utility, signals\)/);
  });

  it('is an empty gallery, not a crash, when the reply carries no rows', async () => {
    fake().replies({ data: null });
    expect(await fetchGallery('place-1')).toEqual([]);
  });

  it('throws on a failed read', async () => {
    fake().replies({ error: { message: 'boom' } });
    await expect(fetchGallery('place-1')).rejects.toThrow('boom');
  });
});

describe('the two writes', () => {
  // Rpcs, not updates: there is no update policy for a guide and there is
  // not meant to be one.
  it('sets the cover through guide_set_cover', async () => {
    fake().replies({ data: null });
    await setCover('photo-1');
    const q = fake().log[0];
    expect(q).toMatchObject({ op: 'rpc', fn: 'guide_set_cover' });
    expect(JSON.stringify(q)).toContain('photo-1');
  });

  it('hides and shows through guide_set_hidden, carrying which', async () => {
    fake().replies({ data: null }, { data: null });
    await setHidden('photo-1', true);
    await setHidden('photo-1', false);
    expect(fake().log[0]).toMatchObject({ op: 'rpc', fn: 'guide_set_hidden' });
    expect(JSON.stringify(fake().log[0])).toContain('"hidden":true');
    expect(JSON.stringify(fake().log[1])).toContain('"hidden":false');
  });

  // Every one of them throws. A refusal from the server is a bug on one
  // side or the other, and a screen that swallowed it would draw a
  // success it did not have.
  it.each([
    ['setCover', () => setCover('p')],
    ['setHidden', () => setHidden('p', true)],
  ])('%s throws when the server refuses', async (_name, call) => {
    fake().replies({ error: { message: 'not yours to set' } });
    await expect(call()).rejects.toThrow('not yours to set');
  });
});

describe('savePhotoScore', () => {
  const reading = { aesthetic: 0.42, isUtility: true, signals: { brightness: 0.5 } };

  // An upsert, in the scorer's name and at this moment, so a rescore
  // passes the update policy that asks for the writer's own name.
  it('keeps the reading against its photograph, in the scorer\'s name', async () => {
    fake().replies({ data: null });
    await savePhotoScore('photo-1', reading, 'u1');
    const q = fake().log[0];
    expect(q).toMatchObject({ table: 'photo_scores', op: 'insert', upsert: true });
    expect(q.payload).toMatchObject({
      photo_id: 'photo-1', scorer_version: SCORER_VERSION,
      aesthetic: 0.42, is_utility: true, signals: { brightness: 0.5 }, scored_by: 'u1',
    });
    expect(Date.parse((q.payload as { scored_at: string }).scored_at)).not.toBeNaN();
  });

  it('throws when the server refuses', async () => {
    fake().replies({ error: { message: 'not yours to score' } });
    await expect(savePhotoScore('photo-1', reading, 'u1')).rejects.toThrow('not yours to score');
  });
});
