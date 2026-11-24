// The photos on a visit, against the fake client: the columns read, the
// links asked for and how long they live, what goes to the function, and
// which refusal a failed call turns into.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fake: null as ReturnType<typeof import('../testing').fakeSupabase> | null }));
vi.mock('../supabase', async () => {
  const { fakeSupabase } = await import('../testing');
  h.fake = fakeSupabase();
  return { supabase: h.fake.client };
});

import { PhotoError } from '../checkin';
import { fetchCheckinPhotos, removeCheckinPhoto, SIGNED_FOR_S, signCheckinPhotos, uploadCheckinPhoto } from './checkinPhotos';

const fake = () => h.fake!;
/** A refusal as supabase-js hands it back: the response rides on `context`. */
const refused = (context: unknown) => fake().replies({ data: null, error: { message: 'non-2xx', context } as never });
beforeEach(() => fake().reset());

const why = async (p: Promise<unknown>) => {
  const e = await p.then(() => null, (x: unknown) => x);
  expect(e).toBeInstanceOf(PhotoError);
  return (e as PhotoError).why;
};

describe('fetchCheckinPhotos', () => {
  it('reads one visit’s rows in their order and marks the hidden ones', async () => {
    fake().replies({ data: [
      { id: 'p1', path: 'u1/a.jpg', width: 1200, height: 900, hidden_at: null },
      { id: 'p2', path: 'u1/b.jpg', width: 900, height: 1200, hidden_at: '2026-11-25T01:00:00Z' },
    ] });
    const rows = await fetchCheckinPhotos('k1');
    const [call] = fake().log;
    expect(call.table).toBe('checkin_photos');
    expect(call.payload).toBe('id, path, width, height, hidden_at');
    expect(call.filters).toEqual([['checkin_id', 'k1']]);
    expect(call.order).toEqual(['position']);
    expect(rows).toEqual([
      { id: 'p1', path: 'u1/a.jpg', width: 1200, height: 900, hidden: false },
      { id: 'p2', path: 'u1/b.jpg', width: 900, height: 1200, hidden: true },
    ]);
  });
  it('reads a visit with none as an empty list', async () => {
    fake().replies({ data: null, error: null });
    expect(await fetchCheckinPhotos('k1')).toEqual([]);
  });
  it('throws the database’s words when the read fails', async () => {
    fake().replies({ data: null, error: { message: 'offline' } });
    await expect(fetchCheckinPhotos('k1')).rejects.toThrow('offline');
  });
});

describe('signCheckinPhotos', () => {
  it('asks nothing for no paths', async () => {
    expect(await signCheckinPhotos([])).toEqual({});
    expect(fake().log).toEqual([]);
  });
  it('asks the private bucket for hour-long links and keeps only the ones it signed', async () => {
    fake().replies({ data: [
      { path: 'u1/a.jpg', signedUrl: 'https://s/a?token=1', error: null },
      { path: 'u1/b.jpg', signedUrl: null, error: 'Object not found' },
      { path: null, signedUrl: 'https://s/orphan', error: null },
      { path: 'u1/c.jpg', signedUrl: 'https://s/c?token=3', error: 'late' },
    ] });
    const links = await signCheckinPhotos(['u1/a.jpg', 'u1/b.jpg']);
    expect(SIGNED_FOR_S).toBe(3600);
    expect(fake().log).toEqual([{ table: 'checkin-photos', fn: 'createSignedUrls', op: 'storage', payload: { paths: ['u1/a.jpg', 'u1/b.jpg'], expiresIn: 3600 }, filters: [] }]);
    expect(links).toEqual({ 'u1/a.jpg': 'https://s/a?token=1' });
  });
  it('reads a null answer as no links', async () => {
    fake().replies({ data: null, error: null });
    expect(await signCheckinPhotos(['u1/a.jpg'])).toEqual({});
  });
  it('throws the bucket’s words when signing fails', async () => {
    fake().replies({ data: null, error: { message: 'forbidden' } });
    await expect(signCheckinPhotos(['u1/a.jpg'])).rejects.toThrow('forbidden');
  });
});

describe('uploadCheckinPhoto', () => {
  it('sends the visit and the bytes to the function and returns the stored photo', async () => {
    fake().replies({ data: { id: 'p9', path: 'u1/k1/p9.jpg', width: 1200, height: 800, extra: 'dropped' }, error: null });
    expect(await uploadCheckinPhoto('k1', 'AAAA')).toEqual({ id: 'p9', path: 'u1/k1/p9.jpg', width: 1200, height: 800 });
    expect(fake().log).toEqual([{ fn: 'checkin-photo', op: 'invoke', payload: { checkin: 'k1', image: 'AAAA' }, filters: [] }]);
  });
  it('reads the refusal from a body still to be parsed', async () => {
    refused({ status: 429, json: async () => ({ error: 'photo:day' }) });
    expect(await why(uploadCheckinPhoto('k1', 'AAAA'))).toBe('day');
  });
  it('reads the refusal from a body already parsed', async () => {
    refused({ status: 409, body: { error: 'photo:full' } });
    expect(await why(uploadCheckinPhoto('k1', 'AAAA'))).toBe('full');
  });
  it('falls back to the parsed body when the stream will not read', async () => {
    refused({ status: 415, body: { error: 'not_jpeg' }, json: async () => { throw new Error('read already'); } });
    expect(await why(uploadCheckinPhoto('k1', 'AAAA'))).toBe('image');
  });
  it('goes by the status when the body names nothing', async () => {
    refused({ status: 401, body: { error: 42 } });
    expect(await why(uploadCheckinPhoto('k1', 'AAAA'))).toBe('signed_out');
  });
  it('calls a failure with no context at all another failure', async () => {
    fake().replies({ data: null, error: { message: 'Failed to send a request' } });
    expect(await why(uploadCheckinPhoto('k1', 'AAAA'))).toBe('other');
  });
});

describe('removeCheckinPhoto', () => {
  it('asks the function to take one photo away', async () => {
    fake().replies({ data: { removed: 'p9' }, error: null });
    await removeCheckinPhoto('p9');
    expect(fake().log).toEqual([{ fn: 'checkin-photo', op: 'invoke', payload: { remove: 'p9' }, filters: [] }]);
  });
  it('throws the refusal when it fails', async () => {
    refused({ status: 500, body: null });
    expect(await why(removeCheckinPhoto('p9'))).toBe('other');
  });
});
