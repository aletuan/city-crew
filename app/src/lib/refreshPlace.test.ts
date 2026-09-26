// What a refresh of a Google place writes, exercised from the outside.
//
// `refresh-place.ts` lives in `supabase/functions/_shared/` because that is
// where it runs, and is tested from here for the reason `rehost.test.ts`
// gives. What is pinned is the line it draws between Google's fields and
// the desk's: Google's are replaced every time; the desk's are followed
// only while they are still Google's, and never overwritten once a hand
// has changed them.

import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  NOT_FOUND, REFRESH_MASK, refreshPatch, refreshPlace,
  type Current, type Details,
} from '../../../supabase/functions/_shared/refresh-place';

const NOW = new Date('2026-09-27T03:00:00Z');

const google: Details = {
  rating: 4.6,
  userRatingCount: 812,
  priceLevel: 'PRICE_LEVEL_MODERATE',
  regularOpeningHours: { weekdayDescriptions: ['Monday: 7:00 AM – 10:00 PM'] },
  websiteUri: 'https://new.example.vn',
  internationalPhoneNumber: '+84 28 1234 5678',
  businessStatus: 'OPERATIONAL',
  editorialSummary: { text: 'Roastery with a garden.' },
};

/** A row exactly as the import left it: every value still Google's. */
const asImported: Current = {
  website: 'https://old.example.vn',
  phone: '+84 28 0000 0000',
  google_website: 'https://old.example.vn',
  google_phone: '+84 28 0000 0000',
  desc_en: 'Old summary.',
  reviewer_source: 'google',
};

describe("Google's own fields", () => {
  it('replaces every one of them, and stamps the refresh', () => {
    const patch = refreshPatch(google, asImported, NOW);
    expect(patch).toMatchObject({
      rating: 4.6,
      rating_count: 812,
      price_level: 2,
      opening_hours: ['Monday: 7:00 AM – 10:00 PM'],
      business_status: 'OPERATIONAL',
      google_summary: 'Roastery with a garden.',
      google_website: 'https://new.example.vn',
      google_phone: '+84 28 1234 5678',
      google_refreshed_at: '2026-09-27T03:00:00.000Z',
    });
  });

  // Google leaves a field out when it no longer has it. The copy goes with
  // it: a value Google has withdrawn is not ours to keep showing.
  it('clears what Google no longer says, rather than keeping the old copy', () => {
    const patch = refreshPatch({}, asImported, NOW);
    expect(patch).toMatchObject({
      rating: null, rating_count: null, price_level: null,
      opening_hours: null, business_status: null, google_summary: null,
    });
  });

  it('reads an unknown price level as none, not as a number', () => {
    expect(refreshPatch({ priceLevel: 'PRICE_LEVEL_UNSPECIFIED' }, asImported, NOW).price_level).toBeNull();
  });

  it('falls back to the national number when there is no international one', () => {
    const patch = refreshPatch({ nationalPhoneNumber: '028 1234 5678' }, asImported, NOW);
    expect(patch.google_phone).toBe('028 1234 5678');
  });

  // The desk's price is the desk's. Google's level is refreshed beside it
  // for reuse; the number a reader sees never moves on Google's say-so.
  it('never writes the desk price', () => {
    expect(refreshPatch(google, asImported, NOW)).not.toHaveProperty('price_vnd');
  });
});

describe('website and phone', () => {
  it('follow Google while they are still what Google last said', () => {
    const patch = refreshPatch(google, asImported, NOW);
    expect(patch.website).toBe('https://new.example.vn');
    expect(patch.phone).toBe('+84 28 1234 5678');
  });

  it('follow Google when there is nothing there', () => {
    const patch = refreshPatch(google, { ...asImported, website: null, phone: '  ' }, NOW);
    expect(patch.website).toBe('https://new.example.vn');
    expect(patch.phone).toBe('+84 28 1234 5678');
  });

  // The case the two memory columns exist for.
  it('are left alone once a hand has changed them, while the memory moves on', () => {
    const edited = { ...asImported, website: 'https://instagram.com/theplace', phone: '0909 111 222' };
    const patch = refreshPatch(google, edited, NOW);
    expect(patch).not.toHaveProperty('website');
    expect(patch).not.toHaveProperty('phone');
    expect(patch.google_website).toBe('https://new.example.vn');
    expect(patch.google_phone).toBe('+84 28 1234 5678');
  });
});

describe('the description', () => {
  it("follows Google while the desk has marked it as Google's words", () => {
    const patch = refreshPatch(google, asImported, NOW);
    expect(patch.desc_en).toBe('Roastery with a garden.');
    expect(patch).not.toHaveProperty('reviewer_source');
  });

  it("goes, and its source with it, when Google drops the summary", () => {
    const patch = refreshPatch({ ...google, editorialSummary: undefined }, asImported, NOW);
    expect(patch.desc_en).toBeNull();
    expect(patch.reviewer_source).toBeNull();
  });

  it('is never touched when the desk wrote it', () => {
    for (const reviewer_source of ['editorial', 'threads']) {
      const patch = refreshPatch(google, { ...asImported, desc_en: 'Our own words.', reviewer_source }, NOW);
      expect(patch).not.toHaveProperty('desc_en');
      expect(patch).not.toHaveProperty('reviewer_source');
      // Kept for reuse all the same.
      expect(patch.google_summary).toBe('Roastery with a garden.');
    }
  });

  it('takes Google\'s summary where there is none, as the import does', () => {
    const patch = refreshPatch(google, { ...asImported, desc_en: null, reviewer_source: null }, NOW);
    expect(patch.desc_en).toBe('Roastery with a garden.');
    expect(patch.reviewer_source).toBe('google');
  });

  // Text with no source is somebody's, and an empty summary is no summary.
  it('leaves unattributed text alone, and ignores a blank summary', () => {
    expect(refreshPatch(google, { ...asImported, desc_en: 'Unsigned.', reviewer_source: null }, NOW))
      .not.toHaveProperty('desc_en');
    const blank = refreshPatch({ editorialSummary: { text: '   ' } }, { ...asImported, desc_en: null, reviewer_source: null }, NOW);
    expect(blank).not.toHaveProperty('desc_en');
    expect(blank.google_summary).toBeNull();
  });
});

// ── the call ──

const answer = (status: number, body: unknown = google) =>
  vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })) as unknown as typeof fetch;

const table = (updateError?: string) => {
  const writes: { patch: Record<string, unknown>; id: string }[] = [];
  const admin = {
    from: (name: string) => {
      expect(name).toBe('places');
      return {
        update: (patch: Record<string, unknown>) => ({
          eq: async (_col: string, id: string) => {
            writes.push({ patch, id });
            return { error: updateError ? { message: updateError } : null };
          },
        }),
      };
    },
  };
  return { admin, writes };
};

const row = { ...asImported, id: 'p1', google_place_id: 'ChIJabc' };

describe('refreshPlace', () => {
  it('asks Google for this place with the refresh mask, and writes the patch', async () => {
    const fetchImpl = answer(200);
    const { admin, writes } = table();
    await expect(refreshPlace(admin, 'key', row, NOW, fetchImpl)).resolves.toBe('refreshed');
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://places.googleapis.com/v1/places/ChIJabc');
    expect((init as RequestInit).headers).toEqual({ 'X-Goog-Api-Key': 'key', 'X-Goog-FieldMask': REFRESH_MASK });
    expect(writes).toEqual([{ id: 'p1', patch: refreshPatch(google, row, NOW) }]);
  });

  it('writes down a place Google no longer knows, and touches nothing else', async () => {
    const { admin, writes } = table();
    await expect(refreshPlace(admin, 'key', row, NOW, answer(404, 'gone'))).resolves.toBe('not_found');
    expect(writes).toEqual([{ id: 'p1', patch: { business_status: NOT_FOUND, google_refreshed_at: NOW.toISOString() } }]);
  });

  // Anything else is a failure to be retried, so the stamp must not move.
  it('throws in Google\'s words and writes nothing when Google refuses', async () => {
    const { admin, writes } = table();
    await expect(refreshPlace(admin, 'key', row, NOW, answer(403, 'API key not valid'))).rejects.toThrow('Google 403: API key not valid');
    expect(writes).toEqual([]);
  });

  it('throws in the database\'s words when the write is refused', async () => {
    const { admin } = table('permission denied');
    await expect(refreshPlace(admin, 'key', row, NOW, answer(200))).rejects.toThrow('permission denied');
  });
});

// Every field the mask asks for is paid for, and the most expensive one
// sets the price of the whole call — so nothing is asked for that the
// patch does not read.
describe('the mask', () => {
  it('asks for exactly the fields the patch reads', () => {
    expect(REFRESH_MASK.split(',').sort()).toEqual([
      'businessStatus', 'editorialSummary', 'id', 'internationalPhoneNumber', 'nationalPhoneNumber',
      'priceLevel', 'rating', 'regularOpeningHours', 'userRatingCount', 'websiteUri',
    ]);
  });
});

// The function is deployed by uploading every file it reaches, by hand
// (`CLAUDE.md`, Supabase). Reaching `import-place.ts` would drag the
// classifier, the photo copy and the city finder along — 57 KB for one
// four-line table — so the table has its own module and this holds it there.
describe('what the refresh reaches', () => {
  it('imports only the price table, not the import', () => {
    const src = readFileSync(
      new URL('../../../supabase/functions/_shared/refresh-place.ts', import.meta.url), 'utf8');
    expect([...src.matchAll(/from "(.+?)"/g)].map((m) => m[1])).toEqual(['./price-level.ts']);
  });
});
