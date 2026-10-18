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

const fake = () => h.fake!;
beforeEach(() => fake().reset());

describe('fetchGallery', () => {
  // Its own query, not the catalog embed: the embed lacks `source`, and
  // it is read through `photosOf`, which drops hidden rows before the
  // gallery could see them.
  it('reads every photograph on the place, source included, in order', async () => {
    fake().replies({ data: [{ id: 'a', sort_order: 0 }] });
    expect(await fetchGallery('place-1')).toEqual([{ id: 'a', sort_order: 0, score: null, kind: null }]);
    const q = fake().log[0];
    expect(q).toMatchObject({ table: 'place_photos', op: 'select' });
    expect(q.filters[0]).toEqual(['place_id', 'place-1']);
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
    expect(fake().log[0].filters.map(([col]) => col)).not.toContain('is_hidden');
  });

  // The place's photographs, and of their scores only the shown
  // scorer's: the second filter names the embed, so it narrows the
  // scores and never the photographs.
  it('asks for the shown scorer\'s score alone', async () => {
    fake().replies({ data: [] });
    await fetchGallery('place-1');
    expect(fake().log[0].filters).toEqual([
      ['place_id', 'place-1'], ['photo_scores.scorer', 'apple-vision'], ['labels.scorer', 'claude-labels'],
    ]);
  });

  // The score is embedded, so the gallery costs one read and not two.
  it('carries each photograph\'s score, as an object whichever way PostgREST embeds it', async () => {
    const sc = { scorer: 'apple-vision', scorer_version: 1, aesthetic: 0.4, is_utility: false, signals: {} };
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
    expect(String(fake().log[0].payload)).toMatch(/photo_scores\(scorer, scorer_version, aesthetic, is_utility, signals\)/);
  });

  // The labels ride in the same read, under their own name, and come out
  // as the kind the sheet may say — nothing when unsure or none.
  it('carries each photograph\'s kind from its labels, and only a sure one', async () => {
    fake().replies({ data: [
      { id: 'a', labels: { signals: { kind: 'food' } } },
      { id: 'b', labels: [{ signals: { kind: 'exterior' } }] },
      { id: 'c', labels: [{ signals: { kind: 'view', unsure: true } }] },
      { id: 'd', labels: [] },
      { id: 'e' },
    ] });
    const got = await fetchGallery('place-1');
    expect(got.map((p) => p.kind)).toEqual(['food', 'exterior', null, null, null]);
    expect(got[0]).not.toHaveProperty('labels');
    expect(String(fake().log[0].payload)).toContain('labels:photo_scores(signals)');
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
  // Not the shown scorer's version: the row is stamped by the one that read.
  const scorer = { id: 'apple-vision', version: 3 };

  // An upsert, in the scorer's name and at this moment, so a rescore
  // passes the update policy that asks for the writer's own name.
  it('keeps the reading against its photograph, in the scorer\'s name', async () => {
    fake().replies({ data: null });
    await savePhotoScore('photo-1', scorer, reading, 'u1');
    const q = fake().log[0];
    // On the pair the table is keyed on, so another scorer's row is left.
    expect(q).toMatchObject({ table: 'photo_scores', op: 'insert', upsert: true, onConflict: 'photo_id,scorer' });
    expect(q.payload).toMatchObject({
      photo_id: 'photo-1', scorer: 'apple-vision', scorer_version: 3,
      aesthetic: 0.42, is_utility: true, signals: { brightness: 0.5 }, scored_by: 'u1',
    });
    expect(Date.parse((q.payload as { scored_at: string }).scored_at)).not.toBeNaN();
  });

  it('throws when the server refuses', async () => {
    fake().replies({ error: { message: 'not yours to score' } });
    await expect(savePhotoScore('photo-1', scorer, reading, 'u1')).rejects.toThrow('not yours to score');
  });
});
