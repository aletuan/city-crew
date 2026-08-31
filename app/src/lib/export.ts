// Everything this app holds about one account, as one file.
//
// The right to a copy (GDPR Art. 15) and the right to take it elsewhere
// (Art. 20) are separate rights from the right to erasure (Art. 17), and
// the app had only ever built the third. `legal.ts` said as much: a
// section called "Deleting your data" and nothing about getting it.
//
// ── why this module is pure ──
//
// Every rule below that makes the file *correct* rather than merely
// present — the third-party reduction, the timestamps, the omissions — is
// a rule about shape, and a rule about shape can be tested without a
// network. The reads live in `data/export.ts`, the file writing and the
// share sheet live in `takeout.tsx`, and this in between is the part that
// has to be right. It takes rows and a clock and returns an object.
//
// ── the eight rules ──
//
// 1. JSON, UTF-8, one top-level key per category. "Structured, commonly
//    used and machine-readable", which is the standard Art. 20 sets.
// 2. Every timestamp ISO 8601 in UTC. An export is data, not a screen;
//    `format.ts` exists for the other case and is deliberately not used
//    here.
// 3. `format_version`, so a later change is detectable by whatever reads
//    the file. Every large exporter carries one and it costs a line.
// 4. Self-describing. Meta ships an HTML index; at this size the
//    proportionate version is three sentences in the header, in the
//    reader's own language.
// 5. OTHER PEOPLE ARE REDUCED TO THEIR PUBLIC HANDLE. This is the rule
//    home-grown exports break. A crew list is personal data about the
//    people in it; writing their names, avatars and ids into a file and
//    handing it over discloses them to a third party. A handle is already
//    public in this app — `profiles` is readable by anyone holding the
//    publishable key — so it discloses nothing that was not.
// 6. Relationships you made, yes; other people's participation, no. A
//    friendship is a symmetric fact you created and every platform
//    exports it. Who *else* was on a trip is their participation, not
//    yours, so trips carry your role and no member list.
// 7. Media by reference. `avatar_url` rather than bytes, so this stays
//    one small file — and the header says so, because a reader who wants
//    the photograph needs telling to save it separately.
// 8. Moderation records are omitted, and the omission is *stated*. A
//    report names the person reported; exporting it on request would turn
//    the export into a way of learning who reported whom. Silently
//    dropping it would be the same decision made dishonestly.

import type { Collection, Place } from './types';
import type { Trip } from './data/trips';
import type { Preferences } from './data/preferences';
import type { FriendshipRow } from './friends';
import type { HistoryEventRow, LikedCollectionRow, SubmittedPlaceRow } from './data/export';

export const EXPORT_FORMAT_VERSION = 1;

/** The profile columns `lib/auth` reads. Declared here rather than
 *  imported because `auth.tsx` pulls in React, and this file is held to
 *  the 100% gate that a renderer cannot run under. */
export type ExportProfile = {
  handle: string;
  full_name: string;
  location: string;
  bio: string;
  interests: string;
  avatar_url: string;
};

export type ExportInput = {
  account: { id: string; email: string | null; created_at: string | null };
  profile: ExportProfile;
  preferences: Preferences;
  /** Lists this account owns, with their places, from `fetchMyCollections`. */
  collections: Collection[];
  likes: LikedCollectionRow[];
  /** Everything `fetchMyTrips` returns — owned, joined and invited alike.
   *  Partitioned here on `owner_id`, because that read answers with all
   *  three and the export has to say which is which. */
  trips: Trip[];
  friendships: FriendshipRow[];
  /** Account ids, from `fetchMyBlocks`. */
  blocked: string[];
  /** Account id → public handle, for rule 5. An id with no handle here is
   *  dropped rather than exported bare: a UUID names somebody without
   *  telling the reader anything, which is the worst of both. */
  handles: Record<string, string>;
  submitted: SubmittedPlaceRow[];
  history: HistoryEventRow[];
};

export type ExportBundle = {
  export: {
    service: 'City Crew';
    format_version: number;
    generated_at: string;
    account: { id: string; email: string | null; created_at: string | null };
    about: string;
    third_parties: string;
    omitted: string;
  };
  profile: ExportProfile;
  preferences: Preferences;
  collections: {
    slug: string; title: string; description: string;
    is_public: boolean; created_at: string | null;
    places: { slug: string; name: string }[];
  }[];
  likes: { collection_slug: string; curator_handle: string | null; liked_at: string }[];
  trips: {
    id: string; title: string; day: string | null; when_part: string;
    role: 'owner' | 'member'; created_at: string | null;
    stops: { place_slug: string | null; name: string | null; arrive_min: number | null; dwell_min: number | null }[];
  }[];
  crew: {
    friends: { handle: string; status: string; since: string }[];
    blocked: { handle: string }[];
  };
  history: { place_slug: string | null; event: string; city_id: string | null; at: string }[];
  places_added: { slug: string; name: string; submitted_at: string | null }[];
};

/**
 * An ISO 8601 instant in UTC, or null.
 *
 * Rule 2, in one place. Postgres hands back `timestamptz` already in ISO,
 * but with an offset that depends on the connection — and the tests run
 * on Hanoi time precisely because this app is full of places where that
 * matters. Round-tripping through `Date` normalises the offset to `Z`.
 *
 * A value that is not a date at all comes back null rather than
 * `"Invalid Date"`: a null says the app does not hold this, which is
 * true, where the string would be a fact about a parser.
 */
export function isoUtc(value: string | null | undefined): string | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/**
 * What the export is called on the reader's disk.
 *
 * Handle first because that is what tells two exports apart, then the day
 * so a folder of them sorts by hand. Lower-cased and stripped to the
 * handle charset: this becomes a filename, and `normalizeHandle` has
 * already guaranteed the shape everywhere it came from — this is the
 * belt for the one path that has not, an account whose handle the
 * trigger generated.
 */
export function exportFilename(handle: string, now: Date): string {
  const who = handle.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'account';
  return `citycrew-${who}-${now.toISOString().slice(0, 10)}.json`;
}

/** The header's three sentences, in the reader's language. Written here
 *  rather than passed in because they describe decisions this file makes,
 *  and a header that drifted from the rules it announces would be worse
 *  than no header. */
const NOTES = {
  en: {
    about: 'Everything City Crew holds about this account. Photographs are given as links rather than as image data — save them separately if you want to keep them.',
    third_parties: 'Other people appear only by their public @handle. Nobody else\'s name, email or account id is in this file, and trips do not list who else was on them.',
    omitted: 'Reports and moderation records are not included: they name other people, and an export must not become a way of learning who reported whom.',
  },
  vi: {
    about: 'Toàn bộ những gì City Crew lưu về tài khoản này. Ảnh được ghi bằng đường dẫn chứ không phải dữ liệu ảnh — muốn giữ thì hãy lưu riêng.',
    third_parties: 'Người khác chỉ xuất hiện bằng @handle công khai. Không có tên, email hay id tài khoản của ai khác trong file này, và các chuyến đi không liệt kê những người cùng đi.',
    omitted: 'Báo cáo vi phạm và hồ sơ kiểm duyệt không nằm trong bản xuất: chúng nêu tên người khác, và một bản xuất không được trở thành cách để biết ai đã báo cáo ai.',
  },
  ja: {
    about: 'City Crew がこのアカウントについて保持しているすべてです。写真は画像データではなくリンクとして記載されます。残したい場合は別途保存してください。',
    third_parties: '他の人は公開 @handle のみで登場します。他人の名前・メールアドレス・アカウント ID はこのファイルに含まれず、旅程にも同行者は記載されません。',
    omitted: '通報および管理記録は含まれません。これらは他人の名前を含むため、エクスポートが「誰が誰を通報したか」を知る手段になってはならないからです。',
  },
} as const;

export type ExportLang = keyof typeof NOTES;

/** The place's name in the reader's language, falling back the way the
 *  rest of the app does. `place.ts` owns this for the UI; repeating the
 *  two-line version here keeps this module import-free of anything that
 *  needs a renderer. */
function placeName(p: { name_en: string; name_vi: string }, lang: ExportLang): string {
  return (lang === 'vi' ? p.name_vi : p.name_en) || p.name_en || p.name_vi || '';
}

function collectionTitle(c: Collection, lang: ExportLang): string {
  const picked = lang === 'vi' ? c.title_vi : lang === 'ja' ? c.title_ja : c.title_en;
  return (picked || c.title_en || c.title_vi || '').trim();
}

function collectionDesc(c: Collection, lang: ExportLang): string {
  const picked = lang === 'vi' ? c.desc_vi : lang === 'ja' ? c.desc_ja : c.desc_en;
  return (picked || '').trim();
}

/**
 * The bundle, from rows and a clock.
 *
 * `now` is a parameter for the reason every `now` in this codebase is:
 * a function that reads the clock cannot be asserted about.
 */
export function buildExport(input: ExportInput, now: Date, lang: ExportLang): ExportBundle {
  const notes = NOTES[lang];
  const me = input.account.id;

  return {
    export: {
      service: 'City Crew',
      format_version: EXPORT_FORMAT_VERSION,
      generated_at: now.toISOString(),
      account: {
        id: me,
        email: input.account.email,
        created_at: isoUtc(input.account.created_at),
      },
      about: notes.about,
      third_parties: notes.third_parties,
      omitted: notes.omitted,
    },

    profile: input.profile,
    preferences: input.preferences,

    collections: input.collections.map((c) => ({
      slug: c.slug,
      title: collectionTitle(c, lang),
      description: collectionDesc(c, lang),
      is_public: c.is_public ?? false,
      created_at: isoUtc(c.created_at),
      places: (c.members ?? []).map((p: Place) => ({ slug: p.slug, name: placeName(p, lang) })),
    })),

    likes: input.likes
      .filter((l) => l.collections)
      .map((l) => ({
        collection_slug: l.collections!.slug,
        curator_handle: l.collections!.curator_handle,
        liked_at: isoUtc(l.created_at) ?? '',
      })),

    // Rule 6. `fetchMyTrips` answers with everything RLS lets this account
    // see — planned, joined and invited — so the role is the export's job
    // to work out, and the member list is nobody's.
    trips: input.trips.map((tr) => ({
      id: tr.id,
      title: tr.title,
      day: tr.day,
      when_part: tr.when_part,
      role: tr.owner_id === me ? ('owner' as const) : ('member' as const),
      created_at: isoUtc(tr.created_at),
      stops: [...tr.trip_stops]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((s) => ({
          place_slug: s.places?.slug ?? null,
          name: s.places ? placeName(s.places, lang) : null,
          arrive_min: s.arrive_min,
          dwell_min: s.dwell_min,
        })),
    })),

    // Rule 5, twice. An edge whose other end has no handle in `handles` is
    // dropped: a bare UUID names somebody without telling the reader
    // anything about them, which discloses and informs in equal and
    // opposite measure.
    crew: {
      friends: input.friendships
        .map((f) => ({
          handle: input.handles[f.requester === me ? f.addressee : f.requester] ?? '',
          status: f.status,
          since: isoUtc(f.created_at) ?? '',
        }))
        .filter((f) => f.handle !== ''),
      blocked: input.blocked
        .map((id) => ({ handle: input.handles[id] ?? '' }))
        .filter((b) => b.handle !== ''),
    },

    history: input.history.map((h) => ({
      place_slug: h.places?.slug ?? null,
      event: h.kind,
      city_id: h.city_id,
      at: isoUtc(h.created_at) ?? '',
    })),

    places_added: input.submitted.map((p) => ({
      slug: p.slug,
      name: placeName(p, lang),
      submitted_at: isoUtc(p.created_at),
    })),
  };
}
