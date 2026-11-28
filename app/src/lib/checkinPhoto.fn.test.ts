// The `checkin-photo` Edge Function, as deployed.
//
// The one door into the `checkin-photos` bucket, open to every account,
// so the tests that matter are the refusals and their order: nobody
// without a session; nothing too big, read or not; nothing that is not a
// JPEG, whatever it calls itself; nothing over 1600px; nowhere the
// database says no; and that what is stored is the picture without the
// GPS position the phone wrote into it. Then the bookkeeping: the file
// before the row, the file back when the row is refused, and a removal
// that touches only the caller's own photo.
//
// And the editor's way through (28 Nov 2026): the owner read from the
// visit and never from the body, an editor's upload written as the
// owner's with the editor named, the owner's caps asked, a stranger
// still refused before anything is stored, and an editor taking back
// only what the desk attached.
//
// Loaded unchanged, as `deleteAccount.fn.test.ts` loads its function. The
// storage fake is widened here to keep the bytes an upload was handed,
// which the shared one drops.

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { fakeSupabase } from './testing';

const h = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof fakeSupabase>,
  handler: null as unknown as (req: Request) => Promise<Response>,
  uploaded: [] as Uint8Array[],
  made: [] as unknown[][],
}));

vi.mock('npm:@supabase/supabase-js@2', async () => {
  const { fakeSupabase } = await import('./testing');
  h.fake = fakeSupabase();
  const storage = h.fake.client.storage;
  const client = {
    ...h.fake.client,
    storage: {
      from: (bucket: string) => {
        const b = storage.from(bucket);
        return { ...b, upload: (path: string, body: Uint8Array, opts?: unknown) => { h.uploaded.push(body); return b.upload(path, body, opts); } };
      },
    },
  };
  return { createClient: (...a: unknown[]) => { h.made.push(a); return client; } };
});

beforeAll(async () => {
  vi.stubGlobal('Deno', {
    serve: (fn: (req: Request) => Promise<Response>) => { h.handler = fn; },
    env: { get: (k: string) => ({ SUPABASE_URL: 'https://p.test', SUPABASE_SERVICE_ROLE_KEY: 'service' } as Record<string, string>)[k] },
  });
  const fn = '../../../supabase/functions/checkin-photo/index.ts';
  await import(/* @vite-ignore */ fn);
});

beforeEach(() => {
  h.fake.reset();
  h.uploaded.length = 0;
  h.made.length = 0;
});

const ME = '11111111-1111-4111-8111-111111111111';
const VISIT = '22222222-2222-4222-8222-222222222222';
const PHOTO = '33333333-3333-4333-8333-333333333333';
const SON = '44444444-4444-4444-8444-444444444444';
const signedIn = { data: { user: { id: ME, email: 'Me@X.com' } }, error: null };
/** The visit's row, as the function reads it to learn the owner. */
const visitOf = (owner: string | null) => ({ data: owner ? { user_id: owner } : null, error: null });
const myVisit = visitOf(ME);
const editorYes = { data: { email: 'me@x.com' }, error: null };
const editorNo = { data: null, error: null };

const seg = (m: number, p: number[]) => [0xff, m, (p.length + 2) >> 8, (p.length + 2) & 0xff, ...p];
const sof = (h: number, w: number) => seg(0xc0, [8, h >> 8, h & 0xff, w >> 8, w & 0xff, 1, 1, 0x11, 0]);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const GPS = seg(0xe1, [...ascii('Exif'), 0, 0, ...ascii('GPS 21.0285N')]);
const jpegOf = (h = 900, w = 1200, extra: number[] = []) =>
  Uint8Array.from([0xff, 0xd8, ...GPS, ...sof(h, w), ...seg(0xda, [1, 1, 0, 0, 63, 0]), 0x12, 0x34, 0xff, 0xd9, ...extra]);
const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

const call = (body: unknown, init: { method?: string; token?: string | null; raw?: string } = {}) =>
  h.handler(new Request('https://p.test/functions/v1/checkin-photo', {
    method: init.method ?? 'POST',
    headers: init.token === null ? {} : { Authorization: `Bearer ${init.token ?? 'jwt'}` },
    body: init.method === 'OPTIONS' || init.method === 'GET' ? undefined : (init.raw ?? JSON.stringify(body)),
  }));
const upload = (image: string = b64(jpegOf()), checkin: unknown = VISIT) => call({ checkin, image });
const fns = () => h.fake.log.map((a) => a.fn ?? a.op);

describe('checkin-photo: who and how', () => {
  it('answers the preflight and refuses anything but POST, asking nothing', async () => {
    expect((await call(null, { method: 'OPTIONS' })).status).toBe(200);
    expect((await call(null, { method: 'GET' })).status).toBe(405);
    expect(h.fake.log).toEqual([]);
  });

  it('stores nothing without a session', async () => {
    h.fake.replies({ data: { user: null }, error: null });
    const res = await upload();
    expect(res.status).toBe(401);
    expect(h.fake.log[0]).toMatchObject({ fn: 'getUser', payload: 'jwt' });
    expect(h.uploaded).toEqual([]);
  });

  it('asks GoTrue with no token at all when none was sent', async () => {
    h.fake.replies({ data: { user: null }, error: null });
    expect((await upload().then(() => call({}, { token: null }))).status).toBe(401);
    expect(h.fake.log.at(-1)).toMatchObject({ fn: 'getUser', payload: '' });
  });

  it('holds the service role, which is what writing the bucket takes', async () => {
    h.fake.replies({ data: { user: null }, error: null });
    await upload();
    expect(h.made[0].slice(0, 2)).toEqual(['https://p.test', 'service']);
  });

  it('wants a JSON body', async () => {
    h.fake.replies(signedIn);
    const res = await call(null, { raw: 'not json' });
    expect(res.status).toBe(400);
  });
});

describe('checkin-photo: an upload', () => {
  it('stores the picture without the position the phone wrote into it, at the row’s own path, and says where', async () => {
    h.fake.replies(signedIn, myVisit, { data: 2, error: null }, { data: {}, error: null }, { data: null, error: null });
    const res = await upload(b64(jpegOf(900, 1200, [...ascii('PK'), 3, 4])));
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out).toMatchObject({ position: 2, width: 1200, height: 900 });
    expect(out.path).toBe(`${ME}/${VISIT}/${out.id}.jpg`);
    expect(out.id).toMatch(/^[0-9a-f-]{36}$/);

    expect(fns()).toEqual(['getUser', 'select', 'checkin_photo_slot', 'upload', 'insert']);
    expect(h.fake.log[1]).toMatchObject({ table: 'checkins', op: 'select', payload: 'user_id', filters: [['id', VISIT]], maybe: true });
    expect(h.fake.log[2].payload).toEqual({ p_user: ME, p_checkin: VISIT });
    expect(h.fake.log[3]).toMatchObject({ table: 'checkin-photos', payload: { path: out.path, opts: { contentType: 'image/jpeg', upsert: false } } });
    const stored = h.uploaded[0];
    expect(Buffer.from(stored).includes(Buffer.from('GPS'))).toBe(false);
    expect(Buffer.from(stored).includes(Buffer.from('PK'))).toBe(false);
    expect([...stored.slice(0, 2)]).toEqual([0xff, 0xd8]);
    expect(h.fake.log[4]).toMatchObject({
      table: 'checkin_photos',
      payload: { id: out.id, checkin_id: VISIT, user_id: ME, uploaded_by: null, position: 2, path: out.path, width: 1200, height: 900, bytes: stored.length },
    });
  });

  it('wants a visit id and an image', async () => {
    for (const body of [{ image: b64(jpegOf()) }, { checkin: 'nope', image: b64(jpegOf()) }, { checkin: VISIT }, { checkin: VISIT, image: '' }, { checkin: VISIT, image: 7 }]) {
      h.fake.reset();
      h.fake.replies(signedIn);
      expect((await call(body)).status).toBe(400);
      expect(fns()).toEqual(['getUser']);
    }
  });

  it('refuses more than a megabyte before reading a byte of it', async () => {
    h.fake.replies(signedIn);
    const res = await upload('A'.repeat(Math.ceil(1048576 / 3) * 4 + 4));
    expect(res.status).toBe(413);
    expect(fns()).toEqual(['getUser']);
  });

  it('takes exactly a megabyte’s worth of base64 as far as reading it', async () => {
    h.fake.replies(signedIn);
    const res = await upload('A'.repeat(Math.ceil(1048576 / 3) * 4));
    expect(res.status).toBe(415);
  });

  it('refuses what is not base64', async () => {
    h.fake.replies(signedIn);
    expect((await upload('%%%not base64%%%')).status).toBe(400);
  });

  it('refuses what is not a JPEG, whatever it is called, and says why', async () => {
    h.fake.replies(signedIn);
    const res = await upload(b64(Uint8Array.from(ascii('PK\u0003\u0004 an archive'))));
    expect(res.status).toBe(415);
    expect(await res.json()).toEqual({ error: 'not_jpeg' });
    expect(fns()).toEqual(['getUser']);
    expect(h.uploaded).toEqual([]);
  });

  it('refuses an edge over 1600, either edge, and takes 1600', async () => {
    for (const [hh, ww, status] of [[1601, 100, 422], [100, 1601, 422]] as const) {
      h.fake.reset();
      h.fake.replies(signedIn);
      expect((await upload(b64(jpegOf(hh, ww)))).status).toBe(status);
      expect(fns()).toEqual(['getUser']);
    }
    h.fake.reset();
    h.fake.replies(signedIn, myVisit, { data: 1, error: null }, { data: {}, error: null }, { data: null, error: null });
    expect((await upload(b64(jpegOf(1600, 1600)))).status).toBe(200);
  });

  it('answers each refusal of the database with the status a phone can act on, and stores nothing', async () => {
    const cases: [string, number][] = [['photo:not_yours', 403], ['photo:full', 409], ['photo:day', 429], ['photo:account', 429], ['connection lost', 500]];
    for (const [message, status] of cases) {
      h.fake.reset();
      h.uploaded.length = 0;
      h.fake.replies(signedIn, myVisit, { data: null, error: { message } });
      const res = await upload();
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ error: message });
      expect(h.uploaded).toEqual([]);
    }
  });

  it('writes no row when the file could not be stored', async () => {
    h.fake.replies(signedIn, myVisit, { data: 1, error: null }, { data: null, error: { message: 'storage down' } });
    const res = await upload();
    expect(res.status).toBe(500);
    expect(fns()).toEqual(['getUser', 'select', 'checkin_photo_slot', 'upload']);
  });

  it('takes the file back when the row is refused — two uploads racing for one place end here', async () => {
    h.fake.replies(signedIn, myVisit, { data: 1, error: null }, { data: {}, error: null }, { data: null, error: { message: 'duplicate key' } }, { data: {}, error: null });
    const res = await upload();
    expect(res.status).toBe(409);
    expect(fns()).toEqual(['getUser', 'select', 'checkin_photo_slot', 'upload', 'insert', 'remove']);
    expect(h.fake.log[5].payload).toEqual([(h.fake.log[3].payload as { path: string }).path]);
  });

  it('answers the refusal even when taking the file back fails', async () => {
    h.fake.replies(signedIn, myVisit, { data: 1, error: null }, { data: {}, error: null }, { data: null, error: { message: 'duplicate key' } }, { throws: new Error('down') });
    expect((await upload()).status).toBe(409);
  });
});

describe('checkin-photo: a removal', () => {
  const remove = (id: unknown = PHOTO) => call({ remove: id });

  it('takes the caller’s own photo: the row first, then the file', async () => {
    h.fake.replies(signedIn, { data: { id: PHOTO, path: `${ME}/${VISIT}/${PHOTO}.jpg` }, error: null }, { data: null, error: null }, { data: {}, error: null });
    const res = await remove();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ removed: true });
    expect(fns()).toEqual(['getUser', 'select', 'delete', 'remove']);
    expect(h.fake.log[1]).toMatchObject({ table: 'checkin_photos', op: 'select', filters: [['id', PHOTO], ['user_id', ME]] });
    expect(h.fake.log[2]).toMatchObject({ table: 'checkin_photos', op: 'delete', filters: [['id', PHOTO], ['path', `${ME}/${VISIT}/${PHOTO}.jpg`]] });
    expect(h.fake.log[3]).toMatchObject({ table: 'checkin-photos', payload: [`${ME}/${VISIT}/${PHOTO}.jpg`] });
  });

  it('finds nobody else’s photo, and touches nothing', async () => {
    h.fake.replies(signedIn, { data: null, error: null }, editorNo);
    const res = await remove();
    expect(res.status).toBe(404);
    expect(fns()).toEqual(['getUser', 'select', 'select']);
    expect(h.fake.log[2]).toMatchObject({ table: 'editors', filters: [['email', 'me@x.com']] });
    expect(h.fake.log.some((a) => a.op === 'delete' || a.fn === 'remove')).toBe(false);
  });

  it('wants a photo id', async () => {
    for (const id of ['nope', 7, null]) {
      h.fake.reset();
      h.fake.replies(signedIn);
      expect((await remove(id)).status).toBe(400);
    }
  });

  it('says so when the read or the delete fails, and keeps the file while the row stands', async () => {
    h.fake.replies(signedIn, { data: null, error: { message: 'read failed' } });
    expect((await remove()).status).toBe(500);
    h.fake.reset();
    h.fake.replies(signedIn, { data: { id: PHOTO, path: 'p' }, error: null }, { data: null, error: { message: 'delete failed' } });
    expect((await remove()).status).toBe(500);
    expect(fns()).not.toContain('remove');
  });

  it('answers that the photo is gone when only the file’s removal fails: the prune takes the file', async () => {
    h.fake.replies(signedIn, { data: { id: PHOTO, path: 'p' }, error: null }, { data: null, error: null }, { throws: new Error('down') });
    expect((await remove()).status).toBe(200);
  });
});

describe('checkin-photo: an editor, for somebody’s visit', () => {
  const remove = (id: unknown = PHOTO) => call({ remove: id });

  it('stores the photo as the owner’s — their id in the path and on the row, their caps asked — and names the editor', async () => {
    h.fake.replies(signedIn, visitOf(SON), editorYes, { data: 1, error: null }, { data: {}, error: null }, { data: null, error: null });
    const res = await upload();
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out.path).toBe(`${SON}/${VISIT}/${out.id}.jpg`);
    expect(fns()).toEqual(['getUser', 'select', 'select', 'checkin_photo_slot', 'upload', 'insert']);
    // The editor is looked up by the token's email, lower-cased, and by nothing sent.
    expect(h.fake.log[2]).toMatchObject({ table: 'editors', op: 'select', filters: [['email', 'me@x.com']], maybe: true });
    expect(h.fake.log[3].payload).toEqual({ p_user: SON, p_checkin: VISIT });
    expect(h.fake.log[5]).toMatchObject({
      table: 'checkin_photos',
      payload: { checkin_id: VISIT, user_id: SON, uploaded_by: ME, path: out.path },
    });
  });

  it('refuses whoever is not an editor as it always did, with nothing stored and no cap asked', async () => {
    h.fake.replies(signedIn, visitOf(SON), editorNo);
    const res = await upload();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'photo:not_yours' });
    expect(fns()).toEqual(['getUser', 'select', 'select']);
    expect(h.uploaded).toEqual([]);
  });

  it('takes an owner named in the body from nobody: the visit’s row decides', async () => {
    h.fake.replies(signedIn, myVisit, { data: 1, error: null }, { data: {}, error: null }, { data: null, error: null });
    const res = await call({ checkin: VISIT, image: b64(jpegOf()), owner: SON, user_id: SON, uploaded_by: SON });
    expect(res.status).toBe(200);
    expect((await res.json()).path.startsWith(`${ME}/`)).toBe(true);
    expect(h.fake.log.at(-1)!.payload).toMatchObject({ user_id: ME, uploaded_by: null });
  });

  it('does not ask who is an editor for a caller’s own visit', async () => {
    h.fake.replies(signedIn, myVisit, { data: 1, error: null }, { data: {}, error: null }, { data: null, error: null });
    await upload();
    expect(h.fake.log.some((a) => a.table === 'editors')).toBe(false);
  });

  it('says a visit that is not there is not there, to anyone, storing nothing', async () => {
    h.fake.replies(signedIn, visitOf(null));
    const res = await upload();
    expect(res.status).toBe(404);
    expect(fns()).toEqual(['getUser', 'select']);
    expect(h.uploaded).toEqual([]);
  });

  it('says so when the visit cannot be read', async () => {
    h.fake.replies(signedIn, { data: null, error: { message: 'read failed' } });
    expect((await upload()).status).toBe(500);
    expect(h.uploaded).toEqual([]);
  });

  it('holds an editor to the owner’s caps: a fourth photo is full', async () => {
    h.fake.replies(signedIn, visitOf(SON), editorYes, { data: null, error: { message: 'photo:full' } });
    const res = await upload();
    expect(res.status).toBe(409);
    expect(h.uploaded).toEqual([]);
  });

  it('holds an editor’s picture to the same checks, before the visit is even read', async () => {
    for (const [image, status] of [[b64(Uint8Array.from(ascii('PK not a jpeg'))), 415], [b64(jpegOf(1601, 100)), 422], ['A'.repeat(Math.ceil(1048576 / 3) * 4 + 4), 413]] as const) {
      h.fake.reset();
      h.fake.replies(signedIn);
      expect((await upload(image)).status).toBe(status);
      expect(fns()).toEqual(['getUser']);
    }
  });

  it('is nobody’s editor without an email, and is not asked about', async () => {
    h.fake.replies({ data: { user: { id: ME } }, error: null }, visitOf(SON));
    const res = await upload();
    expect(res.status).toBe(403);
    expect(h.fake.log.some((a) => a.table === 'editors')).toBe(false);
  });

  it('lets an editor take back a photo the desk attached: read by id, the row then the file', async () => {
    const path = `${SON}/${VISIT}/${PHOTO}.jpg`;
    h.fake.replies(signedIn, { data: null, error: null }, editorYes, { data: { id: PHOTO, path, uploaded_by: ME }, error: null }, { data: null, error: null }, { data: {}, error: null });
    const res = await remove();
    expect(res.status).toBe(200);
    expect(fns()).toEqual(['getUser', 'select', 'select', 'select', 'delete', 'remove']);
    expect(h.fake.log[3]).toMatchObject({ table: 'checkin_photos', payload: 'id, path, uploaded_by', filters: [['id', PHOTO]] });
    expect(h.fake.log[4]).toMatchObject({ table: 'checkin_photos', op: 'delete', filters: [['id', PHOTO], ['path', path]] });
    expect(h.fake.log[5]).toMatchObject({ table: 'checkin-photos', payload: [path] });
  });

  it('finds for an editor no photo its owner uploaded, and touches nothing', async () => {
    h.fake.replies(signedIn, { data: null, error: null }, editorYes, { data: { id: PHOTO, path: 'p', uploaded_by: null }, error: null });
    const res = await remove();
    expect(res.status).toBe(404);
    expect(h.fake.log.some((a) => a.op === 'delete' || a.fn === 'remove')).toBe(false);
  });

  it('finds for an editor no photo that is not there, and says so when the desk’s read fails', async () => {
    h.fake.replies(signedIn, { data: null, error: null }, editorYes, { data: null, error: null });
    expect((await remove()).status).toBe(404);
    h.fake.reset();
    h.fake.replies(signedIn, { data: null, error: null }, editorYes, { data: null, error: { message: 'read failed' } });
    expect((await remove()).status).toBe(500);
    expect(h.fake.log.some((a) => a.op === 'delete')).toBe(false);
  });
});
