// The check-ins table, read and written. Rules are in `lib/checkin.ts`;
// this file knows the columns.

import { supabase } from '../supabase';
import type { I18nDoc } from '../localized';
import { visitPhotosOf, type Audience, type Checkin, type CheckinPhoto, type PersonCheckin } from '../checkin';
import { DAILY_LIMIT, refusedByPolicy } from '../quota';
import { fetchPlaceId } from './guide';

type PhotoRow = { photo_uri: string; is_cover: boolean; is_hidden: boolean; sort_order: number };
type CheckinRow = {
  id: string; city_id: string | null; at: string;
  note?: string | null; audience?: Audience | null;
  /** The visit's own photos (K4 of `docs/checkin-photos-plan.md`). */
  checkin_photos?: unknown;
  places: {
    slug: string; name_en: string; name_vi: string; i18n?: I18nDoc | null;
    categories?: string[] | null;
    /** Absent on a row the launch cache kept before the embed joined. */
    place_photos?: PhotoRow[];
  } | null;
};

/** The place's cover, by the catalog's own rule (`photosOf`): a flagged
 *  cover first, else the first by sort order, hidden ones never. Written
 *  out here rather than borrowed because that rule takes a whole
 *  `Place`, and a check-in carries four columns of one. */
function coverUri(photos: PhotoRow[] | undefined): string | null {
  const shown = (photos ?? []).filter((ph) => !ph.is_hidden)
    .sort((a, b) => (b.is_cover ? 1 : 0) - (a.is_cover ? 1 : 0) || a.sort_order - b.sort_order);
  return shown[0]?.photo_uri ?? null;
}

/** Every visit this account has recorded, newest first, with the
 *  place's slug, names and cover flattened in — those because the
 *  Visited screen lists places from every city, and the catalog holds
 *  one. The photos are embedded whole and reduced to one URL here: a
 *  place has six or so, and thirty visits make a payload a list can
 *  carry, where a second query per row could not. A row
 *  whose place is gone keeps its date and an empty slug: the visit
 *  happened, whatever became of the row. */
export async function fetchMyCheckins(ownerId: string): Promise<Checkin[]> {
  const { data, error } = await supabase
    .from('checkins')
    .select('id, city_id, at, note, audience, checkin_photos(id, path, width, height, position, hidden_at), places(slug, name_en, name_vi, i18n, categories, place_photos(photo_uri, is_cover, is_hidden, sort_order))')
    .eq('user_id', ownerId)
    .order('at', { ascending: false });
  if (error) throw new Error(error.message);
  // Through `unknown`, like every embed in this directory: PostgREST
  // types a to-one embed as an array and the runtime does not.
  return ((data ?? []) as unknown as CheckinRow[]).map((r) => ({
    id: r.id, place_slug: r.places?.slug ?? '', city_id: r.city_id, at: r.at,
    note: r.note ?? null, audience: r.audience ?? null,
    photos: visitPhotosOf(r.checkin_photos),
    place: r.places
      ? {
        name_en: r.places.name_en, name_vi: r.places.name_vi, i18n: r.places.i18n ?? null,
        cover: coverUri(r.places.place_photos), categories: r.places.categories ?? [],
      }
      : null,
  }));
}

/**
 * One visit, now. The place is found by slug the way `logPlaceEvent`
 * finds it — the screens hold slugs, the table holds ids — and the
 * instant is the database's clock, not the phone's.
 *
 * A policy refusal is thrown as `daily_limit`, which is what the one
 * screen that calls this tells the reader about. The insert policy also
 * refuses a second visit inside ten minutes; the pill never offers one
 * (`canRepeat`), so reaching that refusal takes two phones, and the cap
 * sentence is a fair thing for the second to hear.
 *
 * Answers the new row's id, for the sheet that comes up over the visit
 * to write its note and who sees it to (`saveCheckin`). No note and no
 * answer go in with the row: see `lib/checkin` for why they follow it.
 */
export async function addCheckin(input: { ownerId: string; placeSlug: string; cityId: string | null }): Promise<string> {
  const placeId = await fetchPlaceId(input.placeSlug);
  if (!placeId) throw new Error('place_not_found');
  const { data, error } = await supabase
    .from('checkins')
    .insert({ user_id: input.ownerId, place_id: placeId, city_id: input.cityId })
    .select('id')
    .single();
  if (error) throw new Error(refusedByPolicy(error) ? DAILY_LIMIT : error.message);
  return (data as { id: string }).id;
}

/**
 * A visit's words, and who sees it when that was asked, written by its
 * owner — the two columns the grant allows; the place and the instant
 * are not edited.
 *
 * `audience` left out is left alone, not written as private: a note
 * added to an old visit must not answer a question its owner was never
 * asked, and null is how the table says "never asked".
 */
export async function saveCheckin(id: string, said: { note: string | null; audience?: Audience }): Promise<void> {
  const patch = said.audience ? { note: said.note, audience: said.audience } : { note: said.note };
  const { error } = await supabase.from('checkins').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Undo one visit. RLS keeps this to the caller's own rows. */
export async function removeCheckin(id: string): Promise<void> {
  const { error } = await supabase.from('checkins').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * A person's visits as this reader may see them (`person_checkins`):
 * all of your own, a friend's shared ones, nobody else's — the server
 * decides, and answers a stranger with no rows rather than a refusal.
 * The newest at each place, newest first, by day.
 *
 * Read as untrusted, as a thread's rows are (`fetchThread`): the
 * generated types call every column present, and the function answers
 * null for a note nobody wrote, a place with no picture, and — on
 * anybody's page but your own — who sees it.
 */
export async function fetchPersonCheckins(personId: string): Promise<PersonCheckin[]> {
  const { data, error } = await supabase.rpc('person_checkins', { p_person: personId });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    place_slug: r.place_slug,
    place: {
      name_en: r.name_en ?? '', name_vi: r.name_vi ?? '', cover: r.cover ?? null,
      i18n: (r.i18n as I18nDoc | null) ?? null, categories: r.categories ?? [],
    },
    city_id: r.city_id ?? null,
    day: r.day,
    note: r.note ?? null,
    audience: r.audience === 'friends' || r.audience === 'private' || r.audience === 'public' ? r.audience : null,
    likes: typeof r.likes === 'number' ? r.likes : 0,
    liked: r.liked === true,
    photos: visitPhotosOf(r.photos),
    hidden: r.hidden === true,
    note_hidden: r.note_hidden === true,
  }));
}

/** Set or take back the reader's heart on a visit they can see. The
 *  server refuses one they cannot — and a private visit, anybody's. */
export async function likeCheckin(id: string, on: boolean): Promise<void> {
  const { error } = await supabase.rpc('like_checkin', { p_id: id, p_on: on });
  if (error) throw new Error(error.message);
}

/** One guest's say about a place: a public visit with a note and photos
 *  (`20261126120000_place_guest_reviews.sql`). */
export type GuestReview = {
  id: string;
  user_id: string;
  handle: string;
  full_name: string;
  avatar_url: string | null;
  /** The visit's day where the place is, as ISO `YYYY-MM-DD`. */
  day: string;
  note: string;
  photos: CheckinPhoto[];
  likes: number;
  liked: boolean;
};

/** "Đánh giá từ khách" for one place: every check-in counted, and the
 *  reviews the reader may read. `null` for a place the server does not
 *  show (unpublished, or not there). */
export type GuestReviews = { count: number; visits: GuestReview[] };

export async function fetchGuestReviews(slug: string): Promise<GuestReviews | null> {
  const { data, error } = await supabase.rpc('place_guest_reviews', { p_slug: slug });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') return null;
  const d = data as { count?: unknown; visits?: unknown };
  const rows = Array.isArray(d.visits) ? d.visits as Record<string, unknown>[] : [];
  return {
    count: typeof d.count === 'number' ? d.count : 0,
    visits: rows.flatMap((r) => {
      const photos = visitPhotosOf(r.photos);
      // A review is a note and a photo; the server sends no other, and a
      // row that arrives without either is not one to draw.
      if (typeof r.id !== 'string' || typeof r.note !== 'string' || photos.length === 0) return [];
      return [{
        id: r.id,
        user_id: String(r.user_id ?? ''),
        handle: String(r.handle ?? ''),
        full_name: String(r.full_name ?? ''),
        avatar_url: typeof r.avatar_url === 'string' && r.avatar_url ? r.avatar_url : null,
        day: String(r.day ?? ''),
        note: r.note,
        photos,
        likes: typeof r.likes === 'number' ? r.likes : 0,
        liked: r.liked === true,
      }];
    }),
  };
}

/** One card of "Hoạt động nổi bật": a public visit this week, with its
 *  first photo (`20261126150000_explore_highlights.sql`). */
export type HighlightCheckin = {
  id: string;
  place_slug: string;
  place: { name_en: string; name_vi: string; i18n: I18nDoc | null };
  handle: string;
  full_name: string;
  avatar_url: string | null;
  note: string | null;
  likes: number;
  liked: boolean;
  photo: CheckinPhoto;
};

/** This week's public check-ins with a photo in one city, hearts then
 *  newest, one a person — signed in only, as the server answers. */
export async function fetchHighlightCheckins(cityId: string): Promise<HighlightCheckin[]> {
  const { data, error } = await supabase.rpc('featured_checkins', { p_city: cityId });
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? data as Record<string, unknown>[] : [];
  return rows.flatMap((r) => {
    const [photo] = visitPhotosOf(r.photo ? [r.photo] : []);
    // A card is its photo; a row that came without one is not a card.
    if (typeof r.id !== 'string' || typeof r.place_slug !== 'string' || !photo) return [];
    return [{
      id: r.id,
      place_slug: r.place_slug,
      place: {
        name_en: String(r.name_en ?? ''), name_vi: String(r.name_vi ?? ''),
        i18n: (r.i18n as I18nDoc | null) ?? null,
      },
      handle: String(r.handle ?? ''),
      full_name: String(r.full_name ?? ''),
      avatar_url: typeof r.avatar_url === 'string' && r.avatar_url ? r.avatar_url : null,
      note: typeof r.note === 'string' ? r.note : null,
      likes: typeof r.likes === 'number' ? r.likes : 0,
      liked: r.liked === true,
      photo,
    }];
  });
}
