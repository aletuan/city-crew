// The shape of the file somebody takes with them.
//
// Almost every assertion here is a rule from the header of `export.ts`,
// pinned so it cannot be lost to a convenience later. Two of them are the
// ones that matter: other people are reduced to a public handle, and the
// omissions are stated rather than silent. An export that leaks a third
// party is not a smaller version of a good export — it is a different and
// worse thing, done on request, to somebody who never asked.

import { describe, expect, it } from 'vitest';
import { EXPORT_FORMAT_VERSION, buildExport, exportFilename, isoUtc, type ExportInput } from './export';
import type { Collection, Place } from './types';
import type { Trip } from './data/trips';

const NOW = new Date('2026-08-31T09:31:00.000Z');

// Only the fields the export reads. `Place` has two dozen columns, and a
// fixture carrying all of them would be asserting that this module ignores
// them, which is not a thing worth asserting.
const place = (slug: string, en: string, vi: string) => ({
  slug, name_en: en, name_vi: vi, name_ja: null,
} as unknown as Place);

const bare = (over: Partial<ExportInput> = {}): ExportInput => ({
  account: { id: 'me', email: 'me@example.com', created_at: '2026-01-01T00:00:00Z' },
  profile: { handle: 'dang', full_name: 'Tran Hai Dang', location: '', bio: '', interests: '', avatar_url: 'https://x/y.jpg' },
  preferences: { categories: ['cafes'], budget_vnd: null, history_on: true },
  collections: [], likes: [], trips: [], friendships: [], blocked: [],
  handles: {}, submitted: [], history: [],
  ...over,
});

describe('isoUtc', () => {
  it('normalises an offset to Z', () => {
    // The suite runs on Hanoi time on purpose, so a function that leaked
    // the local offset into a data file would pass anywhere else.
    expect(isoUtc('2026-08-31T16:31:00+07:00')).toBe('2026-08-31T09:31:00.000Z');
  });

  it('has nothing to say about nothing', () => {
    expect(isoUtc(null)).toBeNull();
    expect(isoUtc(undefined)).toBeNull();
    expect(isoUtc('')).toBeNull();
  });

  // A null says the app does not hold this, which is true. "Invalid Date"
  // would be a fact about a parser, written into somebody's records.
  it('answers null rather than writing down a parse failure', () => {
    expect(isoUtc('not a date')).toBeNull();
  });
});

describe('exportFilename', () => {
  it('names the account and the day', () => {
    expect(exportFilename('dang', NOW)).toBe('citycrew-dang-2026-08-31.json');
  });

  // A handle reaches here from `profiles`, where the sign-up path has
  // already normalised it — but the `handle_new_user` trigger can also
  // generate one, and this becomes a path.
  it('leaves a handle nothing a path could be built from', () => {
    expect(exportFilename('../../etc/passwd', NOW)).toBe('citycrew-etcpasswd-2026-08-31.json');
  });

  it('still produces a filename when nothing survives', () => {
    expect(exportFilename('///', NOW)).toBe('citycrew-account-2026-08-31.json');
  });
});

describe('the header', () => {
  it('says what it is, in the reader\'s language, with a version', () => {
    const en = buildExport(bare(), NOW, 'en').export;
    expect(en.service).toBe('City Crew');
    expect(en.format_version).toBe(EXPORT_FORMAT_VERSION);
    expect(en.generated_at).toBe('2026-08-31T09:31:00.000Z');
    expect(en.account).toEqual({ id: 'me', email: 'me@example.com', created_at: '2026-01-01T00:00:00.000Z' });

    for (const lang of ['en', 'vi', 'ja'] as const) {
      const h = buildExport(bare(), NOW, lang).export;
      expect(h.about.length).toBeGreaterThan(0);
      expect(h.third_parties.length).toBeGreaterThan(0);
      expect(h.omitted.length).toBeGreaterThan(0);
    }
  });

  // Rule 8. Silence would be the same decision taken dishonestly: a
  // reader cannot tell an omission from an absence unless told.
  it('states the omission rather than performing it quietly', () => {
    const b = buildExport(bare(), NOW, 'en');
    expect(b.export.omitted).toMatch(/[Rr]eport/);
    expect(b).not.toHaveProperty('reports');
    expect(b).not.toHaveProperty('moderation');
  });
});

describe('collections', () => {
  const c = (over: Partial<Collection>): Collection => ({
    slug: 'l', title_en: 'List', title_vi: 'Danh sách', title_ja: 'リスト',
    desc_en: 'why', desc_vi: 'vì sao', desc_ja: 'なぜ',
    curator_handle: null, cover: null, collection_places: [], ...over,
  } as Collection);

  it('takes the title and blurb in the reader\'s language', () => {
    const one = [c({ is_public: true, created_at: '2026-05-05T00:00:00Z', members: [place('p', 'Pho', 'Phở')] })];
    const vi = buildExport(bare({ collections: one }), NOW, 'vi').collections[0];
    expect(vi).toMatchObject({ slug: 'l', title: 'Danh sách', description: 'vì sao', is_public: true });
    expect(vi.places).toEqual([{ slug: 'p', name: 'Phở' }]);

    expect(buildExport(bare({ collections: one }), NOW, 'ja').collections[0].title).toBe('リスト');
    expect(buildExport(bare({ collections: one }), NOW, 'en').collections[0].title).toBe('List');
  });

  it('falls back through the languages it has', () => {
    const thin = [c({ title_vi: '', title_ja: null, desc_ja: null, desc_vi: '' })];
    expect(buildExport(bare({ collections: thin }), NOW, 'ja').collections[0].title).toBe('List');
    expect(buildExport(bare({ collections: thin }), NOW, 'ja').collections[0].description).toBe('');

    const viOnly = [c({ title_en: '', title_vi: 'Chỉ tiếng Việt', title_ja: null })];
    expect(buildExport(bare({ collections: viOnly }), NOW, 'en').collections[0].title).toBe('Chỉ tiếng Việt');

    const none = [c({ title_en: '', title_vi: '', title_ja: null })];
    expect(buildExport(bare({ collections: none }), NOW, 'en').collections[0].title).toBe('');
  });

  it('survives a list with no places and no publish flag', () => {
    const out = buildExport(bare({ collections: [c({})] }), NOW, 'en').collections[0];
    expect(out.places).toEqual([]);
    expect(out.is_public).toBe(false);
    expect(out.created_at).toBeNull();
  });
});

describe('likes', () => {
  it('carries the slug and the curator', () => {
    const likes = [{ created_at: '2026-04-04T00:00:00Z', collections: { slug: 'x', curator_handle: 'ha' } }];
    expect(buildExport(bare({ likes }), NOW, 'en').likes)
      .toEqual([{ collection_slug: 'x', curator_handle: 'ha', liked_at: '2026-04-04T00:00:00.000Z' }]);
  });

  // A list deleted since the like leaves the join empty. Exporting a row
  // whose every field is null would be worse than not exporting it.
  it('drops a like whose list is gone', () => {
    const likes = [{ created_at: '2026-04-04T00:00:00Z', collections: null }];
    expect(buildExport(bare({ likes }), NOW, 'en').likes).toEqual([]);
  });

  it('leaves an unparseable time empty rather than invalid', () => {
    const likes = [{ created_at: 'nonsense', collections: { slug: 'x', curator_handle: null } }];
    expect(buildExport(bare({ likes }), NOW, 'en').likes[0].liked_at).toBe('');
  });
});

describe('trips', () => {
  const trip = (over: Partial<Trip>): Trip => ({
    id: 't1', owner_id: 'me', city_id: 'hanoi', title: 'Friday', company: null,
    categories: [], district: null, day: '2026-09-01', when_part: 'evening',
    generated_by: null, created_at: '2026-06-06T00:00:00Z', trip_stops: [], ...over,
  } as Trip);

  it('says which trips are yours and which you were on', () => {
    const trips = [trip({}), trip({ id: 't2', owner_id: 'someone-else' })];
    const out = buildExport(bare({ trips }), NOW, 'en').trips;
    expect(out.map((t) => t.role)).toEqual(['owner', 'member']);
  });

  it('puts the stops back in order', () => {
    const stops = [
      { sort_order: 2, arrive_min: 1200, dwell_min: 60, why: null, why_lang: null, places: place('b', 'B', 'B') },
      { sort_order: 1, arrive_min: 1080, dwell_min: 90, why: null, why_lang: null, places: place('a', 'A', 'A') },
    ];
    const out = buildExport(bare({ trips: [trip({ trip_stops: stops as unknown as Trip['trip_stops'] })] }), NOW, 'en').trips[0];
    expect(out.stops.map((s) => s.place_slug)).toEqual(['a', 'b']);
  });

  it('keeps a stop whose place is gone', () => {
    const stops = [{ sort_order: 1, arrive_min: null, dwell_min: null, why: null, why_lang: null, places: null }];
    const out = buildExport(bare({ trips: [trip({ trip_stops: stops as unknown as Trip['trip_stops'] })] }), NOW, 'en').trips[0];
    expect(out.stops[0]).toEqual({ place_slug: null, name: null, arrive_min: null, dwell_min: null });
  });

  // Rule 6. A friendship is a symmetric fact this account created; who
  // else was on a trip is their participation, and it does not travel.
  it('lists no other members', () => {
    const out = buildExport(bare({ trips: [trip({})] }), NOW, 'en').trips[0];
    expect(out).not.toHaveProperty('members');
  });
});

// ── rule 5, which is the one that matters ──
describe('crew', () => {
  const edge = (requester: string, addressee: string) => ({
    requester, addressee, status: 'accepted' as const, created_at: '2026-07-07T00:00:00Z',
  });

  it('names the other end of an edge, whichever end it is', () => {
    const friendships = [edge('me', 'them'), edge('other', 'me')];
    const handles = { them: 'thu', other: 'minh' };
    expect(buildExport(bare({ friendships, handles }), NOW, 'en').crew.friends)
      .toEqual([
        { handle: 'thu', status: 'accepted', since: '2026-07-07T00:00:00.000Z' },
        { handle: 'minh', status: 'accepted', since: '2026-07-07T00:00:00.000Z' },
      ]);
  });

  // Nothing but the handle. Not the name, not the avatar, not the id —
  // the crew list is personal data about the people in it, and this is
  // the file the whole feature is judged on.
  it('gives a friend nothing but their public handle', () => {
    const out = buildExport(bare({ friendships: [edge('me', 'them')], handles: { them: 'thu' } }), NOW, 'en');
    expect(Object.keys(out.crew.friends[0]).sort()).toEqual(['handle', 'since', 'status']);
    // The account id itself, nowhere in the crew section. Asserted on the
    // section rather than the whole file because the header's own
    // sentence about third parties contains the word.
    expect(JSON.stringify(out.crew)).not.toContain('them');
  });

  it('drops an account it cannot name rather than writing down a uuid', () => {
    const out = buildExport(bare({ friendships: [edge('me', 'ghost')], blocked: ['ghost'] }), NOW, 'en');
    expect(out.crew.friends).toEqual([]);
    expect(out.crew.blocked).toEqual([]);
  });

  it('carries blocked accounts as handles too', () => {
    const out = buildExport(bare({ blocked: ['b1'], handles: { b1: 'nope' } }), NOW, 'en');
    expect(out.crew.blocked).toEqual([{ handle: 'nope' }]);
  });

  it('leaves an unparseable time empty rather than invalid', () => {
    const odd = [{ requester: 'me', addressee: 'them', status: 'pending' as const, created_at: 'nonsense' }];
    const out = buildExport(bare({ friendships: odd, handles: { them: 'thu' } }), NOW, 'en');
    expect(out.crew.friends[0].since).toBe('');
  });
});

describe('history and contributions', () => {
  it('passes the database\'s own verbs through untranslated', () => {
    const history = [{ kind: 'plan_drop', city_id: 'hanoi', created_at: '2026-08-08T00:00:00Z', places: { slug: 'p' } }];
    expect(buildExport(bare({ history }), NOW, 'en').history)
      .toEqual([{ place_slug: 'p', event: 'plan_drop', city_id: 'hanoi', at: '2026-08-08T00:00:00.000Z' }]);
  });

  it('keeps an event whose place is gone', () => {
    const history = [{ kind: 'open', city_id: null, created_at: 'nonsense', places: null }];
    expect(buildExport(bare({ history }), NOW, 'en').history[0])
      .toEqual({ place_slug: null, event: 'open', city_id: null, at: '' });
  });

  it('records places added as contributions that outlive the account', () => {
    const submitted = [{ slug: 'q', name_en: 'Quan', name_vi: 'Quán', created_at: null }];
    expect(buildExport(bare({ submitted }), NOW, 'vi').places_added)
      .toEqual([{ slug: 'q', name: 'Quán', submitted_at: null }]);
  });

  it('falls back when a place has a name in only one language', () => {
    const submitted = [{ slug: 'q', name_en: '', name_vi: 'Chỉ Việt', created_at: null }];
    expect(buildExport(bare({ submitted }), NOW, 'en').places_added[0].name).toBe('Chỉ Việt');

    const none = [{ slug: 'q', name_en: '', name_vi: '', created_at: null }];
    expect(buildExport(bare({ submitted: none }), NOW, 'en').places_added[0].name).toBe('');
  });
});

// The profile and the preferences travel whole: they are this account's
// own, every column of them is already on a screen it owns, and there is
// nothing in either to reduce.
describe('the account\'s own rows', () => {
  it('carries the profile and preferences unchanged', () => {
    const b = buildExport(bare(), NOW, 'en');
    expect(b.profile.handle).toBe('dang');
    expect(b.profile.avatar_url).toBe('https://x/y.jpg');
    expect(b.preferences).toEqual({ categories: ['cafes'], budget_vnd: null, history_on: true });
  });

  // Rule 7, and the header has to say so — a reader who wants the
  // photograph needs telling that this is a link and not the picture.
  it('gives the avatar as a link, and says that it did', () => {
    const b = buildExport(bare(), NOW, 'en');
    expect(b.export.about).toMatch(/link/i);
  });
});
