// The gallery's calls, pinned by shape: which table and columns a read
// asks for, which function a write names, and that every write throws.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fake: null as ReturnType<typeof import('../testing').fakeSupabase> | null }));
vi.mock('../supabase', async () => {
  const { fakeSupabase } = await import('../testing');
  h.fake = fakeSupabase();
  return { supabase: h.fake.client };
});

import { fetchGallery, reorderGallery, setCover, setHidden } from './gallery';

const fake = () => h.fake!;
beforeEach(() => fake().reset());

describe('fetchGallery', () => {
  // Its own query, not the catalog embed: the embed lacks the three
  // columns the boundary is decided on, and it is read through `photosOf`,
  // which drops hidden rows before the gallery could see them.
  it('reads every photograph on the place with the columns the boundary needs, in order', async () => {
    fake().replies({ data: [{ id: 'a', sort_order: 0 }] });
    expect(await fetchGallery('place-1')).toEqual([{ id: 'a', sort_order: 0 }]);
    const q = fake().log[0];
    expect(q).toMatchObject({ table: 'place_photos', op: 'select', filters: [['place_id', 'place-1']] });
    for (const col of ['source', 'uploaded_by', 'hidden_by', 'is_hidden', 'sort_order']) {
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

  it('is an empty gallery, not a crash, when the reply carries no rows', async () => {
    fake().replies({ data: null });
    expect(await fetchGallery('place-1')).toEqual([]);
  });

  it('throws on a failed read', async () => {
    fake().replies({ error: { message: 'boom' } });
    await expect(fetchGallery('place-1')).rejects.toThrow('boom');
  });
});

describe('the three writes', () => {
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

  it('reorders through guide_reorder_photos with the whole list', async () => {
    fake().replies({ data: null });
    await reorderGallery('place-1', ['b', 'a']);
    const q = fake().log[0];
    expect(q).toMatchObject({ op: 'rpc', fn: 'guide_reorder_photos' });
    expect(JSON.stringify(q)).toContain('"target_place":"place-1"');
    expect(JSON.stringify(q)).toContain('["b","a"]');
  });

  // Every one of them throws. A refusal from the server is a bug on one
  // side or the other, and a screen that swallowed it would draw a
  // success it did not have.
  it.each([
    ['setCover', () => setCover('p')],
    ['setHidden', () => setHidden('p', true)],
    ['reorderGallery', () => reorderGallery('place-1', ['p'])],
  ])('%s throws when the server refuses', async (_name, call) => {
    fake().replies({ error: { message: 'not yours to set' } });
    await expect(call()).rejects.toThrow('not yours to set');
  });
});
