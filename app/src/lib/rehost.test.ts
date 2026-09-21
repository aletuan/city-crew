// A Google photograph copied home, exercised from the outside.
//
// `rehost.ts` lives in `supabase/functions/_shared/` because that is where
// it runs — at import time, and in the two jobs that rehost and refresh.
// It is tested from here for the reason `classify.test.ts` gives: this is
// where the runner is, and the module needs nothing of Deno's. Both of its
// dependencies were already arguments — the client, and the fetch — so a
// test hands in a Google that answers what it is told to and a Storage
// that remembers what it was given, and reads the result off both.
//
// What is pinned is the shape of the copy: which URL Google is asked for,
// under what name and type the bytes land, and the three ways the copy is
// refused — Google says no, Google says nothing, Storage says no — each
// of which has to be a loud error rather than a blank card. The blank
// card is not hypothetical: it is the TestFlight install the header of
// `rehost.ts` remembers, and the empty-body check exists because of it.

import { describe, expect, it, vi } from 'vitest';
import { BUCKET, copyPhoto, rehostPhoto } from '../../../supabase/functions/_shared/rehost';

// ── Google, as a function of the status and the bytes ──

type Answer = { status?: number; type?: string | null; body?: Uint8Array | string };
const google = (answer: Answer = {}) => {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (url: string) => {
    calls.push(url);
    const { status = 200, type = 'image/jpeg', body = new Uint8Array([1, 2, 3]) } = answer;
    const headers = new Headers();
    if (type) headers.set('content-type', type);
    return new Response(body as unknown as BodyInit, { status, headers });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
};

// ── Storage and the table, remembering what they were handed ──

type Upload = { bucket: string; path: string; bytes: Uint8Array; opts: Record<string, unknown> };
const client = (over: { uploadError?: string; updateError?: string } = {}) => {
  const uploads: Upload[] = [];
  const updates: { patch: Record<string, unknown>; id: string }[] = [];
  const admin = {
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, bytes: Uint8Array, opts: Record<string, unknown>) => {
          uploads.push({ bucket, path, bytes, opts });
          return { error: over.uploadError ? { message: over.uploadError } : null };
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.example/${bucket}/${path}` } }),
      }),
    },
    from: (table: string) => ({
      update: (patch: Record<string, unknown>) => ({
        eq: async (_col: string, id: string) => {
          updates.push({ patch, id });
          return { error: over.updateError ? { message: `${table}: ${over.updateError}`.replace(`${table}: `, '') } : null };
        },
      }),
    }),
  };
  return { admin, uploads, updates };
};

const ROW = { id: 'ph-1', photo_ref: 'places/x/photos/abc', slug: 'higher-ground' };

describe('copyPhoto', () => {
  it('asks Google for the bytes at the width the app draws, following the redirect', async () => {
    const g = google();
    await copyPhoto(client().admin, 'the-key', ROW, g.fetchImpl);
    expect(g.calls).toEqual(['https://places.googleapis.com/v1/places/x/photos/abc/media?maxWidthPx=1200&key=the-key']);
    // No `skipHttpRedirect`: that flag hands back a short-lived link, and a
    // short-lived link is the thing this whole module exists to stop
    // keeping.
    expect(g.calls[0]).not.toContain('skipHttpRedirect');
  });

  it('puts the bytes in the place-photos bucket under the slug, and hands back the path and the public link', async () => {
    const c = client();
    const out = await copyPhoto(c.admin, 'k', ROW, google({ body: new Uint8Array([9, 8, 7, 6]) }).fetchImpl);
    expect(c.uploads).toHaveLength(1);
    expect(c.uploads[0]).toMatchObject({
      bucket: BUCKET, path: 'higher-ground/ph-1.jpg',
      opts: { contentType: 'image/jpeg', upsert: true },
    });
    expect([...c.uploads[0].bytes]).toEqual([9, 8, 7, 6]);
    expect(out).toEqual({ path: 'higher-ground/ph-1.jpg', publicUrl: `https://cdn.example/${BUCKET}/higher-ground/ph-1.jpg` });
  });

  // The extension is read off what Google sent, not assumed: a PNG filed
  // as `.jpg` is a file whose name lies about its bytes.
  it.each([
    ['image/png', 'png'],
    ['image/webp', 'webp'],
    ['image/jpeg', 'jpg'],
    ['image/png; charset=binary', 'png'],
  ])('names the file by its content type — %s → .%s', async (type, ext) => {
    const c = client();
    await copyPhoto(c.admin, 'k', ROW, google({ type }).fetchImpl);
    expect(c.uploads[0].path).toBe(`higher-ground/ph-1.${ext}`);
    expect(c.uploads[0].opts.contentType).toBe(type);
  });

  it('assumes a JPEG when Google names no type', async () => {
    const c = client();
    await copyPhoto(c.admin, 'k', ROW, google({ type: null }).fetchImpl);
    expect(c.uploads[0].path).toBe('higher-ground/ph-1.jpg');
    expect(c.uploads[0].opts.contentType).toBe('image/jpeg');
  });

  // Google's refusal, with its status and enough of its body to read,
  // and nothing uploaded — an error page filed as a photograph is worse
  // than no photograph.
  it('throws Google’s refusal with its status, and uploads nothing', async () => {
    const c = client();
    await expect(copyPhoto(c.admin, 'k', ROW, google({ status: 403, body: 'PERMISSION_DENIED: key' }).fetchImpl))
      .rejects.toThrow('Google 403: PERMISSION_DENIED: key');
    expect(c.uploads).toHaveLength(0);
  });

  it('keeps only the first two hundred characters of a long refusal', async () => {
    const c = client();
    const long = 'x'.repeat(500);
    await expect(copyPhoto(c.admin, 'k', ROW, google({ status: 429, body: long }).fetchImpl))
      .rejects.toThrow(`Google 429: ${'x'.repeat(200)}`);
    await expect(copyPhoto(c.admin, 'k', ROW, google({ status: 429, body: long }).fetchImpl))
      .rejects.not.toThrow('x'.repeat(201));
  });

  // The blank card. A 200 with no bytes was once written to Storage as a
  // zero-byte "photograph" and drawn as nothing on every fresh install.
  it('refuses an empty body rather than filing a blank photograph', async () => {
    const c = client();
    await expect(copyPhoto(c.admin, 'k', ROW, google({ body: new Uint8Array(0) }).fetchImpl))
      .rejects.toThrow('empty body');
    expect(c.uploads).toHaveLength(0);
  });

  it('throws Storage’s refusal under its own name, so it cannot be mistaken for Google’s', async () => {
    const c = client({ uploadError: 'The resource already exists' });
    await expect(copyPhoto(c.admin, 'k', ROW, google().fetchImpl))
      .rejects.toThrow('Storage: The resource already exists');
  });
});

describe('rehostPhoto', () => {
  it('copies, then points the row at the copy, and hands back the path', async () => {
    const c = client();
    const path = await rehostPhoto(c.admin, 'k', ROW, google({ type: 'image/webp' }).fetchImpl);
    expect(path).toBe('higher-ground/ph-1.webp');
    expect(c.updates).toEqual([{
      id: 'ph-1',
      patch: { photo_uri: `https://cdn.example/${BUCKET}/higher-ground/ph-1.webp`, storage_path: 'higher-ground/ph-1.webp' },
    }]);
  });

  // A copy that failed leaves the row exactly as it was: still pointing
  // at Google, still with no `storage_path`, still on the rehost job's
  // list for next time.
  it('leaves the row alone when the copy fails', async () => {
    const c = client();
    await expect(rehostPhoto(c.admin, 'k', ROW, google({ status: 500, body: 'boom' }).fetchImpl))
      .rejects.toThrow('Google 500');
    expect(c.updates).toHaveLength(0);
  });

  it('throws the table’s refusal under its own name', async () => {
    const c = client({ updateError: 'permission denied' });
    await expect(rehostPhoto(c.admin, 'k', ROW, google().fetchImpl))
      .rejects.toThrow('place_photos: permission denied');
  });
});
