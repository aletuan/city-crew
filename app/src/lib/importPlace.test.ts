// The import, from Google's answer to the rows it writes.
//
// `import-place.ts` lives in `supabase/functions/_shared/` because that is
// where it runs — inside two Edge Functions. It is tested from here for the
// reason `classify.test.ts` gives: this is where the runner is, and the
// module needs nothing of Deno's. Its dependencies are all injected — the
// Supabase client, the Google fetch, the API key — except `copyPhoto`,
// which talks to Storage and is stood in for at the module boundary.
//
// What is pinned is the *row*: which Google field lands in which column,
// and by which rule. This is the one function through which every place
// the desk did not type by hand enters the catalog, and until now nothing
// held it — a regex moved in `ward.ts` was tested, the line that decides
// whether `ward.ts` is even consulted was not. The five siblings it calls
// have their own tests; this one asks whether it calls them right.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { classify } from '../../../supabase/functions/_shared/classify';
import { MAX_CITY_KM } from '../../../supabase/functions/_shared/nearest-city';

const rehost = vi.hoisted(() => ({
  // Which photo refs the copy fails for; the rest copy cleanly.
  failing: new Set<string>(),
  copyPhoto: vi.fn(async (_admin: unknown, _key: string, row: { id: string; photo_ref: string; slug: string }) => {
    if (rehost.failing.has(row.photo_ref)) throw new Error('Google 403');
    return { path: `${row.slug}/${row.id}.jpg`, publicUrl: `https://cdn/${row.slug}/${row.id}.jpg` };
  }),
}));
vi.mock('../../../supabase/functions/_shared/rehost', () => ({ copyPhoto: rehost.copyPhoto }));

import {
  importPlace, PRICE_LEVEL_VND, PRICE_LEVELS, SCAN_CATEGORIES,
} from '../../../supabase/functions/_shared/import-place';

// ── a Supabase client that answers from a small world and remembers ──
//
// Every chain is a thenable that resolves from the table and the verb, so
// the code under test can be read as it is written. What it wrote is kept
// in `inserted`, by table.

type World = {
  cities: { id: string; center_lat: number; center_lng: number }[];
  taken: string[];
  placesInsertError?: string;
  photosInsertError?: string;
};
type Call = { table: string; method: string; args: unknown[] };

function fakeAdmin(world: World) {
  const calls: Call[] = [];
  const inserted: Record<string, unknown[]> = {};
  const from = (table: string) => {
    let verb: 'select' | 'insert' = 'select';
    let payload: unknown;
    let likePrefix: string | null = null;
    const answer = () => {
      if (verb === 'insert') {
        if (table === 'places') {
          return world.placesInsertError
            ? { data: null, error: { message: world.placesInsertError } }
            : { data: { id: 'place-row-1', slug: (payload as { slug: string }).slug }, error: null };
        }
        return { data: null, error: world.photosInsertError ? { message: world.photosInsertError } : null };
      }
      if (table === 'cities') return { data: world.cities, error: null };
      if (table === 'places') {
        const rows = world.taken
          .filter((s) => likePrefix === null || s.startsWith(likePrefix))
          .map((slug) => ({ slug }));
        return { data: rows, error: null };
      }
      return { data: null, error: null };
    };
    const q: Record<string, unknown> = {
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(answer()).then(res, rej),
    };
    for (const m of ['select', 'eq', 'order', 'maybeSingle', 'single']) {
      q[m] = (...args: unknown[]) => { calls.push({ table, method: m, args }); return q; };
    }
    q.like = (col: string, pattern: string) => {
      calls.push({ table, method: 'like', args: [col, pattern] });
      likePrefix = pattern.replace(/%$/, '');
      return q;
    };
    q.insert = (rows: unknown) => {
      verb = 'insert';
      payload = rows;
      (inserted[table] ??= []).push(rows);
      calls.push({ table, method: 'insert', args: [rows] });
      return q;
    };
    return q;
  };
  return { admin: { from }, calls, inserted };
}

// ── Google's answer, as the details endpoint shapes it ──

const HANOI = { id: 'hanoi', center_lat: 21.0285, center_lng: 105.8542 };
const SAIGON = { id: 'saigon', center_lat: 10.7769, center_lng: 106.7009 };
const DANANG = { id: 'danang', center_lat: 16.0544, center_lng: 108.2022 };
const CITIES = [DANANG, HANOI, SAIGON];

const DETAILS = {
  id: 'ChIJ-higher-ground',
  displayName: { text: 'Higher Ground' },
  formattedAddress: '12 P. Hàng Bông, Hoàn Kiếm, Hà Nội 100000, Vietnam',
  addressComponents: [
    { longText: '12', types: ['street_number'] },
    { longText: 'Phố Hàng Bông', types: ['route'] },
    { longText: 'Hoàn Kiếm', types: ['administrative_area_level_2', 'political'] },
    { longText: 'Hà Nội', types: ['administrative_area_level_1', 'political'] },
  ],
  location: { latitude: 21.0312, longitude: 105.8478 },
  rating: 4.6,
  userRatingCount: 1234,
  priceLevel: 'PRICE_LEVEL_MODERATE',
  regularOpeningHours: { weekdayDescriptions: ['Monday: 7:00 AM – 10:00 PM', 'Tuesday: 7:00 AM – 10:00 PM'] },
  websiteUri: 'https://higherground.example',
  internationalPhoneNumber: '+84 24 3923 2233',
  nationalPhoneNumber: '024 3923 2233',
  editorialSummary: { text: 'Cosy roastery in a French villa.' },
  types: ['coffee_shop', 'cafe', 'food', 'point_of_interest'],
  primaryType: 'coffee_shop',
  photos: [
    { name: 'places/x/photos/a', authorAttributions: [{ displayName: 'Ann', uri: 'https://maps.google.com/ann' }] },
    { name: 'places/x/photos/b' },
    { name: 'places/x/photos/c' },
  ],
};

/** Google, stood in for: details for the place, a short-lived link for a
 *  photo's media. Records every request. */
const google = (details: Record<string, unknown> = DETAILS) => {
  const gapi = vi.fn(async (url: string) => (
    url.includes('/media')
      ? { photoUri: `https://lh3.googleusercontent.com/${url.split('/photos/')[1].split('/')[0]}` }
      : details
  ));
  return gapi;
};

type Args = Parameters<typeof importPlace>[0];
const run = async (over: Partial<Args> & { world?: Partial<World>; details?: Record<string, unknown> } = {}) => {
  const { world: w, details, ...rest } = over;
  const fake = fakeAdmin({ cities: CITIES, taken: [], ...w });
  const gapi = google(details);
  const out = await importPlace({
    admin: fake.admin, gapi, apiKey: 'test-key', placeId: DETAILS.id,
    category: 'food', cityId: 'hanoi', channel: 'mobile', ...rest,
  });
  const place = fake.inserted.places?.[0] as Record<string, unknown> | undefined;
  const photos = (fake.inserted.place_photos?.[0] ?? []) as Record<string, unknown>[];
  return { out, place, photos, calls: fake.calls, gapi };
};

let uuid = 0;
beforeEach(() => {
  uuid = 0;
  rehost.failing.clear();
  rehost.copyPhoto.mockClear();
  // Stable ids, so a photo row can be matched to its copy by name.
  vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => `00000000-0000-4000-8000-00000000000${++uuid}` as `${string}-${string}-${string}-${string}-${string}`);
});
afterEach(() => vi.restoreAllMocks());

describe('what it asks Google for', () => {
  it('fetches the place by id with the field mask the row is built from', async () => {
    const { gapi } = await run();
    const [url, init] = gapi.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(url).toBe(`https://places.googleapis.com/v1/places/${DETAILS.id}`);
    expect(init.headers['X-Goog-Api-Key']).toBe('test-key');
    // Two words that decide what a place *is*, and one that writes its
    // description. Drop any of them from the mask and the column goes
    // quietly null on every import.
    for (const field of ['editorialSummary', 'types', 'primaryType', 'addressComponents', 'photos', 'regularOpeningHours']) {
      expect(init.headers['X-Goog-FieldMask']).toContain(field);
    }
  });
});

describe('the row', () => {
  it('is written pending and unpublished, stamped with who and which door', async () => {
    const { place } = await run({ submittedBy: 'u1', addedBy: 'u1', channel: 'mobile' });
    expect(place).toMatchObject({
      google_place_id: DETAILS.id,
      submitted_by: 'u1', added_by: 'u1', channel: 'mobile',
      is_published: false, review_status: 'pending', is_featured: false,
      saved_count: 0, emoji: '📍',
    });
  });

  it('carries the name in both languages, the slug cut from it, and no Japanese for a Latin sign', async () => {
    const { out, place } = await run();
    expect(place).toMatchObject({ name_en: 'Higher Ground', name_vi: 'Higher Ground', name_ja: null, slug: 'higher-ground' });
    expect(out.slug).toBe('higher-ground');
  });

  // The Vietnamese description is the desk's work; only the English one
  // arrives, and it is Google's editorial line verbatim. This is the fact
  // behind "Vì sao nên ghé?" showing an English sentence on a Vietnamese
  // screen for a place a reader imported — see the detail screen.
  it('takes Google’s editorial summary as the English description and leaves the Vietnamese to the desk', async () => {
    const { place } = await run();
    expect(place?.desc_en).toBe('Cosy roastery in a French villa.');
    expect(place).not.toHaveProperty('desc_vi');
    const { place: bare } = await run({ details: { ...DETAILS, editorialSummary: undefined } });
    expect(bare?.desc_en).toBeNull();
  });

  it('reads the neighbourhood off the address components when they name one', async () => {
    const { place } = await run();
    expect(place).toMatchObject({ neighborhood_en: 'Hoàn Kiếm', neighborhood_vi: 'Hoàn Kiếm' });
  });

  // Saigon's components stopped naming this tier after the 2025 ward
  // mergers; the formatted address still does. Without the fallback every
  // Saigon import landed with no 📍 line.
  it('falls back to the ward in the formatted address when the components are silent', async () => {
    const { place } = await run({
      details: {
        ...DETAILS,
        formattedAddress: '74 Hai Bà Trưng, Sài Gòn, Hồ Chí Minh 700000, Vietnam',
        addressComponents: [
          { longText: '74', types: ['street_number'] },
          { longText: 'Hồ Chí Minh', types: ['administrative_area_level_1', 'political'] },
        ],
        location: { latitude: 10.7769, longitude: 106.7009 },
      },
    });
    expect(place).toMatchObject({ neighborhood_en: 'Sài Gòn', neighborhood_vi: 'Sài Gòn' });
  });

  it('prefers the tier Google actually filled, in priority order', async () => {
    const { place } = await run({
      details: {
        ...DETAILS,
        addressComponents: [
          { longText: 'Thảo Điền', types: ['sublocality_level_1', 'sublocality', 'political'] },
          { longText: 'Thủ Đức', types: ['administrative_area_level_2', 'political'] },
        ],
      },
    });
    // Level 2 comes before sublocality in the list, whatever order Google
    // sent them in.
    expect(place?.neighborhood_en).toBe('Thủ Đức');
  });

  it('translates Google’s price level into the app’s VND language', async () => {
    const { place } = await run();
    expect(place).toMatchObject({ price_level: 2, price_vnd: 150000, price_display: '150k₫' });
    const { place: none } = await run({ details: { ...DETAILS, priceLevel: undefined } });
    expect(none).toMatchObject({ price_level: null, price_vnd: null, price_display: null });
    // The two tables agree with each other, level for level.
    for (const [, level] of Object.entries(PRICE_LEVELS)) {
      expect(PRICE_LEVEL_VND[level]).toBeGreaterThan(0);
    }
  });

  it('keeps the international phone over the national one, and the rest as Google gave it', async () => {
    const { place } = await run();
    expect(place).toMatchObject({
      phone: '+84 24 3923 2233',
      website: 'https://higherground.example',
      address: DETAILS.formattedAddress,
      lat: 21.0312, lng: 105.8478,
      rating: 4.6, rating_count: 1234,
      opening_hours: DETAILS.regularOpeningHours.weekdayDescriptions,
      primary_type: 'coffee_shop',
    });
    const { place: national } = await run({ details: { ...DETAILS, internationalPhoneNumber: undefined } });
    expect(national?.phone).toBe('024 3923 2233');
  });

  it('is honest about what Google did not say', async () => {
    const { place } = await run({
      details: {
        id: 'ChIJ-bare', displayName: { text: 'Bare' },
      },
    });
    expect(place).toMatchObject({
      address: null, lat: null, lng: null, rating: null, rating_count: null,
      opening_hours: null, website: null, phone: null, desc_en: null,
      neighborhood_en: null, primary_type: null,
    });
  });

  it('names an unnameable place rather than writing an empty one', async () => {
    const { place } = await run({ details: { ...DETAILS, displayName: undefined } });
    expect(place?.name_en).toBe('Unnamed place');
  });
});

describe('what kind of place it is', () => {
  // The scan knows what it went looking for; that beats a type list.
  it('lets the caller’s categories and vibes win over Google’s types', async () => {
    const { place } = await run({ categories: ['views', 'nightlife'], vibeTags: ['views'] });
    expect(place).toMatchObject({ categories: ['views', 'nightlife'], vibe_tags: ['views'] });
  });

  it('falls back to what the types say when the caller says nothing', async () => {
    const auto = classify(DETAILS.primaryType, DETAILS.types);
    expect(auto.categories.length).toBeGreaterThan(0);
    const { place } = await run();
    expect(place).toMatchObject({ categories: auto.categories, vibe_tags: auto.vibes });
  });

  // An empty array is the parameter's default, so it has to read as "said
  // nothing" — a caller that never mentions vibes must not silence the
  // classifier.
  it('reads an empty vibe list as silence, not as none', async () => {
    const { place } = await run({ vibeTags: [] });
    expect(place?.vibe_tags).toEqual(classify(DETAILS.primaryType, DETAILS.types).vibes);
  });

  it('keeps the caller’s coarse category as given', async () => {
    const { place } = await run({ category: 'out' });
    expect(place?.category).toBe('out');
  });
});

describe('which city', () => {
  // The caller's city is what it was showing, not where the place is.
  it('files the place under the city its coordinates are nearest, not the one the caller was showing', async () => {
    const { place, calls } = await run({
      cityId: 'hanoi',
      details: { ...DETAILS, location: { latitude: 10.78, longitude: 106.70 } },
    });
    expect(place?.city_id).toBe('saigon');
    expect(calls.some((c) => c.table === 'cities' && c.method === 'select')).toBe(true);
  });

  it('refuses a place further than any city reaches, and writes nothing', async () => {
    const fake = fakeAdmin({ cities: CITIES, taken: [] });
    await expect(importPlace({
      admin: fake.admin, gapi: google({ ...DETAILS, location: { latitude: 13.7563, longitude: 100.5018 } }),
      apiKey: 'k', placeId: 'x', category: 'food', cityId: 'hanoi', channel: 'desk',
    })).rejects.toThrow(/outside every city/);
    expect(fake.inserted.places).toBeUndefined();
    expect(MAX_CITY_KM).toBeLessThan(600); // Bangkok is well past it
  });

  it('keeps the caller’s city when Google gave no coordinates, without asking for the cities', async () => {
    const { place, calls } = await run({ cityId: 'danang', details: { ...DETAILS, location: undefined } });
    expect(place?.city_id).toBe('danang');
    expect(calls.some((c) => c.table === 'cities')).toBe(false);
  });

  it('does not treat a half-given or non-numeric location as a point', async () => {
    const { place } = await run({ cityId: 'danang', details: { ...DETAILS, location: { latitude: '21.0' as unknown as number } } });
    expect(place?.city_id).toBe('danang');
  });
});

describe('the slug', () => {
  it('asks which slugs are already taken under the same stem', async () => {
    const { calls } = await run();
    const like = calls.find((c) => c.table === 'places' && c.method === 'like');
    expect(like?.args).toEqual(['slug', 'higher-ground%']);
  });

  it('adds the city when the plain slug is taken', async () => {
    const { out } = await run({ world: { taken: ['higher-ground'] } });
    expect(out.slug).toBe('higher-ground-hanoi');
  });

  it('numbers it when the city form is taken too', async () => {
    const { out } = await run({ world: { taken: ['higher-ground', 'higher-ground-hanoi'] } });
    expect(out.slug).toBe('higher-ground-3');
  });

  it('leaves a free slug alone even when a longer one shares its stem', async () => {
    const { out } = await run({ world: { taken: ['higher-ground-roastery'] } });
    expect(out.slug).toBe('higher-ground');
  });
});

describe('the photographs', () => {
  it('copies each one into Storage and files the rows already pointing at the copies', async () => {
    const { out, photos } = await run();
    expect(out.photos).toBe(3);
    expect(rehost.copyPhoto).toHaveBeenCalledTimes(3);
    expect(photos.map((p) => p.photo_ref)).toEqual(['places/x/photos/a', 'places/x/photos/b', 'places/x/photos/c']);
    expect(photos[0]).toMatchObject({
      place_id: 'place-row-1', source: 'google', sort_order: 0, is_cover: true, is_hidden: false,
      attribution_name: 'Ann', attribution_uri: 'https://maps.google.com/ann',
      photo_uri: 'https://cdn/higher-ground/00000000-0000-4000-8000-000000000001.jpg',
      storage_path: 'higher-ground/00000000-0000-4000-8000-000000000001.jpg',
    });
    expect(photos[1]).toMatchObject({ sort_order: 1, is_cover: false, attribution_name: null, attribution_uri: null });
  });

  it('takes only as many as asked, in Google’s order', async () => {
    const { out, photos } = await run({ maxPhotos: 2 });
    expect(out.photos).toBe(2);
    expect(photos.map((p) => p.photo_ref)).toEqual(['places/x/photos/a', 'places/x/photos/b']);
  });

  // A copy that fails never fails the import. The row keeps Google's
  // short-lived link so there is something to show, and no storage path
  // so `rehost-photos` knows to finish the job.
  it('falls back to Google’s own link when a copy fails, leaving the path empty for the rehost job', async () => {
    rehost.failing.add('places/x/photos/b');
    const { out, photos, gapi } = await run();
    expect(out.photos).toBe(3);
    expect(photos[1]).toMatchObject({ photo_uri: 'https://lh3.googleusercontent.com/b', storage_path: null });
    const media = gapi.mock.calls.map((c) => c[0] as string).filter((u) => u.includes('/media'));
    expect(media).toHaveLength(1);
    expect(media[0]).toContain('places/x/photos/b/media');
    expect(media[0]).toContain('skipHttpRedirect=true');
  });

  it('skips a photograph that can be had neither way, and counts only what landed', async () => {
    rehost.failing.add('places/x/photos/b');
    const fake = fakeAdmin({ cities: CITIES, taken: [] });
    const gapi = vi.fn(async (url: string) => {
      if (url.includes('/media')) throw new Error('Google 429');
      return DETAILS;
    });
    const out = await importPlace({
      admin: fake.admin, gapi, apiKey: 'k', placeId: 'x', category: 'food', cityId: 'hanoi', channel: 'desk',
    });
    expect(out.photos).toBe(2);
    const rows = fake.inserted.place_photos[0] as { photo_ref: string; is_cover: boolean }[];
    expect(rows.map((r) => r.photo_ref)).toEqual(['places/x/photos/a', 'places/x/photos/c']);
    // The cover flag was decided by position before the failure, so the
    // first surviving row still carries it.
    expect(rows[0].is_cover).toBe(true);
  });

  it('writes no photo rows at all for a place with no photographs', async () => {
    const { out, calls } = await run({ details: { ...DETAILS, photos: undefined } });
    expect(out.photos).toBe(0);
    expect(calls.some((c) => c.table === 'place_photos')).toBe(false);
  });
});

describe('when the database refuses', () => {
  it('throws the place insert’s message and never touches the photos', async () => {
    const fake = fakeAdmin({ cities: CITIES, taken: [], placesInsertError: 'duplicate key value violates unique constraint' });
    await expect(importPlace({
      admin: fake.admin, gapi: google(), apiKey: 'k', placeId: 'x', category: 'food', cityId: 'hanoi', channel: 'desk',
    })).rejects.toThrow('duplicate key');
    expect(rehost.copyPhoto).not.toHaveBeenCalled();
  });

  it('throws the photo insert’s message', async () => {
    await expect(run({ world: { photosInsertError: 'place_photos_place_id_fkey' } })).rejects.toThrow('place_photos_place_id_fkey');
  });
});

describe('the scan’s catalogue of questions', () => {
  // The queries know what they went looking for, and what they write down
  // has to be a category the database will accept.
  it('names only categories the classifier knows, one coarse bucket each', async () => {
    const { CATEGORY_KEYS, VIBE_KEYS } = await import('../../../supabase/functions/_shared/classify');
    for (const q of SCAN_CATEGORIES) {
      expect(['food', 'out']).toContain(q.category);
      for (const c of q.categories) expect(CATEGORY_KEYS).toContain(c);
      for (const v of q.vibes) expect(VIBE_KEYS).toContain(v);
      expect(q.q).toMatch(/\{en\}|\{vi\}/);
    }
    expect(new Set(SCAN_CATEGORIES.map((q) => q.key)).size).toBe(SCAN_CATEGORIES.length);
  });
});
