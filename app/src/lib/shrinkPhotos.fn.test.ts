// The `shrink-photos` Edge Function, as deployed.
//
// It rewrites files other people's screens are drawing, in place, on a
// timer — an hourly `pg_cron` pass with a standing token. Everything that
// can go wrong with it goes wrong quietly: a photo encoded twice loses a
// little each hour and nobody sees it happen, a PNG renamed without its
// row moving is a blank card, and a run that stopped at its first bad
// file leaves the rest of the catalog at 1.3 GB. None of it had a test.
//
// What is pinned: who may call it (`_shared/gate.ts`, both doors), how
// many rows one call may take, the two ways a file is left alone — small
// enough already, or not made smaller by encoding, which still earns the
// `shrunk` mark — the rename of a non-JPEG together with its row, and
// that one file failing is written down and the next one still runs.
//
// Loaded unchanged, as the other `.fn.test.ts` files load theirs: `Deno`
// captures the handler, and the `npm:` Supabase client is `lib/testing`'s.
// Three more things are stood in for, each because Node has no way to run
// the real one:
//
// - `npm:@imagemagick/magick-wasm` is a fake `ImageMagick.read` whose
//   image reports the size a test sets and writes the bytes a test sets.
//   What is under test is what the handler does with the encoder's answer,
//   not the encoder; the real one is a WebAssembly build of ImageMagick.
// - `Deno.readFile`, which the module calls at load for the `.wasm`.
// - `import.meta.resolve`, for the length of the import only. The module
//   finds the `.wasm` beside the package it resolves, which Deno turns
//   into a file in its cache; Vitest's module runner gives `import.meta`
//   no `resolve` at all, and nothing in its config reaches one module's
//   `import.meta`. So the import runs with a `resolve` on
//   `Object.prototype` — which is where a property the runner's plain
//   `import.meta` object lacks is looked up — answering as Deno would,
//   and it is removed the moment the module has loaded.
//
// The fake client has no `.not`, `.gt` or `storage.download`, which only
// these batch jobs use; they are added here, recording into the same log,
// rather than into `lib/testing` for one file's sake.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Asked, fakeSupabase, Reply } from './testing';

type Img = {
  width: number; height: number; quality?: number; format?: string;
  autoOrient: () => void; resize: (w: number, h: number) => void; strip: () => void;
  write: (fn: (data: Uint8Array) => Uint8Array) => Uint8Array;
};

const h = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof fakeSupabase>,
  handler: null as unknown as (req: Request) => Promise<Response>,
  /** What the next decoded photo measures, and what encoding it gives. */
  magick: { width: 1600, height: 1200, out: new Uint8Array(100), throws: null as unknown },
  /** Every image the encoder was handed, with what was done to it. */
  images: [] as { input: Uint8Array; calls: string[]; quality?: number; format?: string }[],
  init: [] as unknown[],
  read: [] as unknown[],
}));

vi.mock('npm:@supabase/supabase-js@2', async () => {
  const { fakeSupabase } = await import('./testing');
  h.fake = fakeSupabase();
  return { createClient: () => withBatchVerbs(h.fake) };
});

vi.mock('npm:@imagemagick/magick-wasm@0.0.30', () => ({
  initializeImageMagick: async (bytes: unknown) => { h.init.push(bytes); },
  MagickFormat: { Jpeg: 'JPEG' },
  ImageMagick: {
    read: (input: Uint8Array, fn: (img: Img) => Uint8Array) => {
      if (h.magick.throws !== null) throw h.magick.throws;
      const seen: (typeof h.images)[number] = { input, calls: [] };
      h.images.push(seen);
      const img: Img = {
        width: h.magick.width, height: h.magick.height,
        autoOrient: () => { seen.calls.push('autoOrient'); },
        resize: (w, hh) => { seen.calls.push(`resize ${w}x${hh}`); },
        strip: () => { seen.calls.push('strip'); },
        write: (cb) => {
          seen.quality = img.quality;
          seen.format = img.format;
          return cb(h.magick.out);
        },
      };
      return fn(img);
    },
  },
}));

/** The fake client, with the three verbs the batch jobs use and nothing
 *  else does. `.not` and `.gt` record into the query's filters with
 *  Postgres's own operator beside the column, as `gte` already does; a
 *  download answers off the same queue as everything else. */
function withBatchVerbs(fake: ReturnType<typeof fakeSupabase>) {
  const take = (): Reply => fake.queue.shift() ?? { data: null, error: null };
  return {
    ...fake.client,
    from: (table: string) => {
      const b = fake.client.from(table) as Record<string, unknown>;
      const asked = fake.log.at(-1)!;
      b.not = (k: string, op: string, v: unknown) => { asked.filters.push([`${k} not ${op}`, v]); return b; };
      b.gt = (k: string, v: unknown) => { asked.filters.push([`${k}>`, v]); return b; };
      return b;
    },
    storage: {
      from: (bucket: string) => ({
        ...fake.client.storage.from(bucket),
        download: async (path: string) => {
          fake.log.push({ table: bucket, fn: 'download', op: 'storage', payload: path, filters: [] });
          return take();
        },
      }),
    },
  };
}

const WASM = new Uint8Array([0, 97, 115, 109]);

beforeAll(async () => {
  vi.stubGlobal('Deno', {
    serve: (fn: (req: Request) => Promise<Response>) => { h.handler = fn; },
    env: { get: (k: string) => ({ SUPABASE_URL: 'https://p.test', SUPABASE_SERVICE_ROLE_KEY: 'k' })[k] },
    readFile: async (u: URL) => { h.read.push(u); return WASM; },
  });
  // See the header: the one way to reach this module's `import.meta`.
  // Writable, because the runner assigns `require.resolve` while the
  // import is in flight, and a read-only inherited `resolve` makes that
  // assignment throw.
  // eslint-disable-next-line no-extend-native
  Object.defineProperty(Object.prototype, 'resolve', {
    configurable: true, writable: true,
    value: (spec: string) => `file:///deno/npm/registry/${spec.slice(4).replace(/@(?=[^@]*$)/, '/')}/dist/index.js`,
  });
  const fn = '../../../supabase/functions/shrink-photos/index.ts';
  try { await import(/* @vite-ignore */ fn); } finally {
    delete (Object.prototype as { resolve?: unknown }).resolve;
  }
});

afterAll(() => { vi.unstubAllGlobals(); });

beforeEach(() => {
  h.fake.reset();
  h.images.length = 0;
  h.magick = { width: 1600, height: 1200, out: new Uint8Array(100), throws: null };
});

const call = (body?: unknown, init: { method?: string; headers?: Record<string, string> } = {}) =>
  h.handler(new Request('https://p.test/functions/v1/shrink-photos', {
    method: init.method ?? 'POST',
    headers: init.headers ?? { Authorization: 'Bearer jwt' },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  }));

/** The two replies an editor's session spends at the gate. */
const editor = (): Reply[] => [
  { data: { user: { email: 'Desk@Crew.test' } }, error: null },
  { data: { email: 'desk@crew.test' }, error: null },
];
const KB = 1024;
const file = (bytes: number): Reply => ({ data: new Blob([new Uint8Array(bytes)]), error: null });
const ok: Reply = { data: null, error: null };

const query = () => h.fake.log.find((a) => a.table === 'place_photos' && a.op === 'select')!;
const uploads = () => h.fake.log.filter((a) => a.fn === 'upload') as (Asked & { payload: { path: string; opts: unknown } })[];
const body = async (res: Response) => res.json() as Promise<{
  done: number; skipped: number; failed: number; cursor: string | null;
  bytes_before: number; bytes_after: number;
  rows: { id: string; before: number; after: number; ms: number }[];
  errors: { id: string; error: string }[];
}>;

describe('loading', () => {
  it('starts the encoder once, from the .wasm beside the package', () => {
    expect(h.init).toEqual([WASM]);
    expect(String(h.read[0])).toBe('file:///deno/npm/registry/@imagemagick/magick-wasm/0.0.30/dist/magick.wasm');
  });
});

describe('who gets through the door', () => {
  it('answers the preflight and refuses anything but POST, asking nothing', async () => {
    expect((await call(undefined, { method: 'OPTIONS' })).status).toBe(200);
    expect((await call(undefined, { method: 'GET' })).status).toBe(405);
    expect(h.fake.log).toEqual([]);
  });

  it('lets an editor in, by the email the session carries, lowercased', async () => {
    h.fake.replies(...editor(), { data: [], error: null });
    expect((await call({})).status).toBe(200);
    expect(h.fake.log[0]).toMatchObject({ op: 'auth', fn: 'getUser', payload: 'jwt' });
    expect(h.fake.log[1]).toMatchObject({ table: 'editors', filters: [['email', 'desk@crew.test']] });
  });

  it('refuses a session that is not on the editors list, and reads no photos', async () => {
    h.fake.replies({ data: { user: { email: 'reader@crew.test' } }, error: null }, { data: null, error: null });
    expect((await call({})).status).toBe(403);
    expect(h.fake.log.some((a) => a.table === 'place_photos')).toBe(false);
  });

  it('refuses a caller with no session at all, without asking the editors list', async () => {
    h.fake.replies({ data: { user: null }, error: null });
    expect((await call({}, { headers: {} })).status).toBe(403);
    expect(h.fake.log[0]).toMatchObject({ fn: 'getUser', payload: '' });
    expect(h.fake.log.some((a) => a.table === 'editors')).toBe(false);
  });

  // The cron's door. The job carries no session — only the token row
  // named for it — and the gate must read *that* row, compare it exactly,
  // and refuse it once it has expired: the cron header says the job is
  // meant to go quiet on that date.
  describe('the ops token', () => {
    const ops = (token = 'tok') => ({ headers: { 'x-ops-token': token } });
    const later = new Date(Date.now() + 3600_000).toISOString();

    it('lets the job in with its own live token, without asking for a session', async () => {
      h.fake.replies({ data: { token: 'tok', expires_at: later } }, { data: [], error: null });
      expect((await call({}, ops())).status).toBe(200);
      expect(h.fake.log[0]).toMatchObject({ table: 'ops_tokens', filters: [['name', 'shrink-photos']], maybe: true });
      expect(h.fake.log.some((a) => a.fn === 'getUser')).toBe(false);
    });

    it('refuses a token that does not match', async () => {
      h.fake.replies({ data: { token: 'tok', expires_at: later } });
      expect((await call({}, ops('guess'))).status).toBe(403);
    });

    it('refuses the right token once it has expired', async () => {
      h.fake.replies({ data: { token: 'tok', expires_at: new Date(Date.now() - 1000).toISOString() } });
      expect((await call({}, ops())).status).toBe(403);
    });

    it('refuses a token when no row is minted for this job', async () => {
      h.fake.replies({ data: null });
      expect((await call({}, ops())).status).toBe(403);
    });
  });
});

describe('which rows one call takes', () => {
  // A request has two seconds of CPU and a photo costs a few hundred
  // milliseconds of it: the cap is what keeps a call inside its budget.
  it('takes three by default, in id order, only rows that have a file', async () => {
    h.fake.replies(...editor(), { data: [], error: null });
    await call();
    expect(query()).toMatchObject({
      payload: 'id, storage_path', limit: 3, order: ['id'],
      filters: [['storage_path not is', null]],
    });
  });

  it('never more than eight, never fewer than one, whatever is asked', async () => {
    for (const [asked, taken] of [[50, 8], [-4, 1], [0, 3], ['many', 3], [5, 5]] as const) {
      h.fake.reset();
      h.fake.replies(...editor(), { data: [], error: null });
      await call({ limit: asked });
      expect(query().limit, `limit ${asked}`).toBe(taken);
    }
  });

  it('walks on from the cursor it is given', async () => {
    h.fake.replies(...editor(), { data: [], error: null });
    await call({ after: 'r9' });
    expect(query().filters).toContainEqual(['id>', 'r9']);
  });

  it('takes named rows as named, eight at most, with no row cap on top', async () => {
    h.fake.replies(...editor(), { data: [], error: null });
    const ids = Array.from({ length: 10 }, (_, i) => `r${i}`);
    await call({ ids });
    expect(query().filters).toContainEqual(['id', ids.slice(0, 8)]);
    expect(query().limit).toBeUndefined();
  });

  it('says so when the table cannot be read', async () => {
    h.fake.replies(...editor(), { data: null, error: { message: 'permission denied' } });
    const res = await call({});
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'permission denied' });
  });

  it('reports an empty run with no cursor when nothing came back', async () => {
    h.fake.replies(...editor(), { data: null, error: null });
    expect(await body(await call({}))).toEqual({
      done: 0, skipped: 0, failed: 0, cursor: null, bytes_before: 0, bytes_after: 0, rows: [], errors: [],
    });
  });
});

describe('a photo', () => {
  const one = (path: string, id = 'r1') => ({ data: [{ id, storage_path: path }], error: null });

  it('is left alone, undecoded and unwritten, when it is a JPEG already small enough', async () => {
    h.fake.replies(...editor(), one('a/r1.jpg'), file(240 * KB));
    const out = await body(await call({}));
    expect(out).toMatchObject({ done: 0, skipped: 1, bytes_before: 240 * KB, bytes_after: 240 * KB, cursor: 'r1' });
    expect(h.images).toEqual([]);
    expect(uploads()).toEqual([]);
  });

  it('is fitted inside 1200px, stripped, and written back as a JPEG in place, with the mark', async () => {
    h.magick.out = new Uint8Array(90 * KB);
    h.fake.replies(...editor(), one('a/r1.jpg'), file(240 * KB + 1), ok);
    const out = await body(await call({}));
    expect(h.images[0].calls).toEqual(['autoOrient', 'resize 1200x1200', 'strip']);
    expect(h.images[0]).toMatchObject({ quality: 74, format: 'JPEG' });
    expect(uploads()).toEqual([expect.objectContaining({
      table: 'place-photos',
      payload: { path: 'a/r1.jpg', opts: { contentType: 'image/jpeg', upsert: true, metadata: { shrunk: '1' } } },
    })]);
    // A JPEG keeps its path, so its row has nothing to change.
    expect(h.fake.log.some((a) => a.table === 'place_photos' && a.op === 'update')).toBe(false);
    expect(out).toMatchObject({ done: 1, skipped: 0, bytes_before: 240 * KB + 1, bytes_after: 90 * KB });
    expect(out.rows).toEqual([{ id: 'r1', ms: expect.any(Number), before: 240 * KB + 1, after: 90 * KB }]);
  });

  it('is not enlarged when it is already inside 1200px on both sides', async () => {
    h.magick = { ...h.magick, width: 1200, height: 900 };
    h.fake.replies(...editor(), one('a/r1.jpg'), file(300 * KB), ok);
    await call({});
    expect(h.images[0].calls).toEqual(['autoOrient', 'strip']);
  });

  it('is fitted when only its height is over', async () => {
    h.magick = { ...h.magick, width: 900, height: 1600 };
    h.fake.replies(...editor(), one('a/r1.jpg'), file(300 * KB), ok);
    await call({});
    expect(h.images[0].calls).toContain('resize 1200x1200');
  });

  // The one that would otherwise be picked again every hour, re-encoded
  // each time a little worse. Its bytes go back as they were, with the mark.
  it('keeps its own bytes when encoding would not shrink it, and still gets the mark', async () => {
    h.magick.out = new Uint8Array(300 * KB);
    h.fake.replies(...editor(), one('a/r1.jpg'), file(300 * KB), ok);
    const out = await body(await call({}));
    const up = uploads()[0];
    expect(up.payload).toEqual({ path: 'a/r1.jpg', opts: { contentType: 'image/jpeg', upsert: true, metadata: { shrunk: '1' } } });
    expect(out).toMatchObject({ done: 0, skipped: 1, bytes_after: 300 * KB, rows: [] });
  });

  it('is recorded as failed when that mark cannot be written', async () => {
    h.magick.out = new Uint8Array(300 * KB);
    h.fake.replies(...editor(), one('a/r1.jpg'), file(300 * KB), { error: { message: 'quota' } });
    const out = await body(await call({}));
    expect(out).toMatchObject({ skipped: 0, failed: 1, errors: [{ id: 'r1', error: 'upload: quota' }] });
  });

  // A PNG is a photograph in the wrong container. Small or not, it is
  // re-encoded, written beside the old file as a JPEG, and the row moved
  // to it before the old file goes — a row pointing at a removed file is
  // a blank card.
  it('moves a PNG to a JPEG beside it, row first and the old file after', async () => {
    h.magick.out = new Uint8Array(80 * KB);
    h.fake.replies(...editor(), one('a/r1.PNG'), file(100 * KB), ok, ok, ok);
    const out = await body(await call({}));
    expect(uploads()[0].payload.path).toBe('a/r1.jpg');
    const after = h.fake.log.slice(h.fake.log.indexOf(uploads()[0]) + 1);
    expect(after.map((a) => [a.table, a.op, a.fn])).toEqual([
      ['place_photos', 'update', undefined],
      ['place-photos', 'storage', 'remove'],
    ]);
    expect(after[0]).toMatchObject({
      payload: { photo_uri: 'https://storage.test/place-photos/a/r1.jpg', storage_path: 'a/r1.jpg' },
      filters: [['id', 'r1']],
    });
    expect(after[1].payload).toEqual(['a/r1.PNG']);
    expect(out).toMatchObject({ done: 1, bytes_after: 80 * KB });
  });

  it('writes a non-JPEG out even when the encoding is no smaller', async () => {
    h.magick.out = new Uint8Array(120 * KB);
    h.fake.replies(...editor(), one('a/r1.webp'), file(100 * KB), ok, ok, ok);
    const out = await body(await call({}));
    expect(uploads()[0].payload.path).toBe('a/r1.jpg');
    expect(out).toMatchObject({ done: 1, skipped: 0 });
  });

  it('keeps the old file when its row could not be moved', async () => {
    h.fake.replies(...editor(), one('a/r1.png'), file(100 * KB), ok, { error: { message: 'rls' } });
    const out = await body(await call({}));
    expect(out.errors).toEqual([{ id: 'r1', error: 'place_photos: rls' }]);
    expect(h.fake.log.some((a) => a.fn === 'remove')).toBe(false);
    expect(out.done).toBe(0);
  });

  it('is recorded as failed when the new file cannot be written, and no row moves', async () => {
    h.fake.replies(...editor(), one('a/r1.png'), file(100 * KB), { error: { message: 'too large' } });
    const out = await body(await call({}));
    expect(out.errors).toEqual([{ id: 'r1', error: 'upload: too large' }]);
    expect(h.fake.log.some((a) => a.table === 'place_photos' && a.op === 'update')).toBe(false);
  });

  it('is recorded as failed when it cannot be downloaded, with Storage’s reason or the lack of one', async () => {
    h.fake.replies(...editor(), one('a/r1.jpg'), { data: null, error: { message: 'Object not found' } });
    expect((await body(await call({}))).errors).toEqual([{ id: 'r1', error: 'download: Object not found' }]);
    h.fake.reset();
    h.fake.replies(...editor(), one('a/r1.jpg'), { data: null, error: null });
    expect((await body(await call({}))).errors).toEqual([{ id: 'r1', error: 'download: no body' }]);
  });

  it('is recorded as failed when the encoder throws, whatever it throws, cut to 200 characters', async () => {
    h.magick.throws = new Error('x'.repeat(500));
    h.fake.replies(...editor(), one('a/r1.png'), file(100 * KB));
    const [err] = (await body(await call({}))).errors;
    expect(err.error).toBe('x'.repeat(200));

    h.fake.reset();
    h.magick.throws = 'corrupt image';
    h.fake.replies(...editor(), one('a/r1.png'), file(100 * KB));
    expect((await body(await call({}))).errors).toEqual([{ id: 'r1', error: 'corrupt image' }]);
  });
});

describe('a run', () => {
  // The whole reason a row's work sits inside its own try: one bad file
  // in a batch is written down, and the rest of the batch still shrinks.
  it('carries on past a file that fails, and its cursor is the last row it tried', async () => {
    h.magick.out = new Uint8Array(50 * KB);
    h.fake.replies(
      ...editor(),
      { data: [{ id: 'r1', storage_path: 'a/r1.jpg' }, { id: 'r2', storage_path: 'a/r2.jpg' }, { id: 'r3', storage_path: 'a/r3.jpg' }], error: null },
      { data: null, error: { message: 'gone' } },
      file(400 * KB), ok,
      file(100 * KB),
    );
    const out = await body(await call({}));
    expect(out).toMatchObject({
      done: 1, skipped: 1, failed: 1, cursor: 'r3',
      bytes_before: 500 * KB, bytes_after: 150 * KB,
      errors: [{ id: 'r1', error: 'download: gone' }],
    });
    expect(out.rows.map((r) => r.id)).toEqual(['r2']);
  });
});
