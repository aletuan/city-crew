// Lists — the desk's public shelf and the reader's own — and everything a
// tap can do to one.
//
// The biggest module here, and deliberately one: a collection's reads and
// its writes share the column sets, the slug rules and the two-table
// membership join, and splitting reads from writes would leave both halves
// reaching across for the same three constants.

import { supabase } from '../supabase';
import type { Collection, Place } from '../types';
import { slugify } from '../place';
import { PLACE_COLS } from './places';

/**
 * A public list and everything in it.
 *
 * Whole place rows rather than slugs, and no city in the query — the two
 * halves of the same decision. A collection is stamped with the city it
 * was made in, but its contents are not bound by that stamp: a list made
 * in Hanoi can hold a place in Saigon, and until now that place was
 * silently dropped for everyone. `our-culture-uerras` is the live case:
 * two members, one in each city. Its owner saw both, a Hanoi reader saw
 * one and was told nothing, a Saigon reader saw no list at all.
 *
 * So the city stops deciding what a list contains and only decides
 * whether it appears — which it does in every city it has a place in.
 * That question is asked in `touchesCity`, over these embedded rows.
 *
 * It costs more than the slug embed did: every public list arrives with
 * its places and their photos, rather than one city's worth of ids. At
 * this catalog's size that is a handful of lists. If it stops being one,
 * the lever is a narrower column set for embedded members — the shelf
 * needs a name, a photo and a vibe, not opening hours — not a return to
 * truncating by city.
 */
// `id`, `created_at` and `sort_order` ride along for the shelf's ordering
// and for liking — see `lib/likes.ts`. None of them reach a screen as
// something to show; `slug` is still the key everything user-facing uses.
//
// `is_public` is selected rather than inferred, and that is a bug fixed
// rather than a preference. The public query filters on it and used not
// to fetch it, so every row it returned came back with the field
// `undefined` — true of the rows, absent from the objects. Nothing read
// it until the like button did, and then the control that only appears
// on a public list never appeared at all.
const COLLECTION_COLS = (withOwner: boolean) =>
  `id, slug, is_public, created_at, sort_order, title_en, title_vi, title_ja, desc_en, desc_vi, desc_ja, curator_handle${withOwner ? ', owner_id, city_id' : ''}, collection_places(sort_order, places(${withOwner ? PLACE_COLS(true) : 'slug'})), cover:place_photos!collections_cover_photo_id_fkey(photo_uri)`;

export async function fetchCollections(cityId: string, meId?: string | null): Promise<Collection[]> {
  const run = (withOwner: boolean) => {
    const q = supabase
      .from('collections')
      .select(COLLECTION_COLS(withOwner))
      .eq('is_public', true);
    // Editorial rows and other people's published ones. Your own are
    // excluded whether they are published or not, because they come back
    // through fetchMyCollections and a list in both sections reads as two
    // lists — publishing should change who else can see it, not make a
    // second copy appear under your own.
    //
    // Signed out there is nobody to exclude, and `owner_id.neq.null` is
    // not the same question as `is not null` in PostgREST's grammar, so
    // that branch drops the clause rather than writing one that quietly
    // matches nothing.
    // `owner_id` and `created_at` arrived in the same migration, so the
    // fallback below cannot mention either — it exists precisely for a
    // database that has neither. It keeps the city filter too: a database
    // that old has no owned lists, so every row in it is editorial and
    // stamped with the city it belongs to.
    if (!withOwner) return q.eq('city_id', cityId).order('sort_order');
    const scoped = meId ? q.or(`owner_id.is.null,owner_id.neq.${meId}`) : q;
    // Newest first, with the desk's sequence as the tie-break.
    //
    // Time leads because a list published this morning is the reason to
    // open the tab, and it used to arrive last: `sort_order` came first
    // and owned rows have none, so every published list sank beneath
    // fifteen editorial ones.
    //
    // `sort_order` second is not a hedge. Every editorial row shares one
    // timestamp — the instant `created_at` was added with a default, not
    // a date anybody chose — so ordering them by time is ordering them by
    // nothing, and Postgres is free to return that nothing differently
    // each call. The tie-break decides exactly the rows where the clock
    // has no answer, and the desk's order is the answer it has.
    return scoped.order('created_at', { ascending: false }).order('sort_order', { nullsFirst: false });
  };

  const { data, error } = await run(true);
  // A build can reach a database that has not run the user-collections
  // migration yet. Drop the column and retry rather than breaking the tab —
  // every row there is editorial until the migration lands anyway.
  if (error && error.message.includes('owner_id')) {
    const legacy = await run(false);
    if (legacy.error) throw new Error(legacy.error.message);
    // Slug embeds on that path, so these rows carry no members and
    // `membersOf` resolves them against the catalog, as it always did.
    return (legacy.data ?? []) as unknown as Collection[];
  }
  if (error) throw new Error(error.message);
  return withMembers(data);
}

/**
 * A row whose places arrived embedded, put into the shape the app reads.
 *
 * `members` is what the screens render — in order, with the rows the
 * database refused to hand over already gone. `collection_places` is kept
 * beside it in the slug-only shape, so `holds()` and the counts never
 * have to know which query produced the row.
 */
type EmbeddedRow = Omit<Collection, 'collection_places' | 'members'> & {
  collection_places: { sort_order: number; places: Place | null }[];
};

function withMembers(data: unknown): Collection[] {
  return ((data ?? []) as EmbeddedRow[]).map((row) => {
    const cps = [...(row.collection_places ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    return {
      ...row,
      members: cps.map((cp) => cp.places).filter((p): p is Place => !!p),
      collection_places: cps.map((cp) => ({
        sort_order: cp.sort_order,
        places: cp.places ? { slug: cp.places.slug } : null,
      })),
    };
  });
}

/**
 * Every list this user owns, with its places inside it.
 *
 * Not filtered by city and embedding whole place rows — so a list made in
 * Hanoi still counts, still shows a cover and still opens while the app
 * is looking at Saigon. The public query now does both of those too; the
 * only difference left is which rows it asks for, and that your own show
 * whether they are published or not.
 */
const MY_COLLECTION_COLS =
  `id, slug, title_en, title_vi, title_ja, desc_en, desc_vi, desc_ja, curator_handle, owner_id, city_id, is_public, cover:place_photos!collections_cover_photo_id_fkey(photo_uri), collection_places(sort_order, places(${PLACE_COLS(true)}))`;

export async function fetchMyCollections(ownerId: string): Promise<Collection[]> {
  const { data, error } = await supabase
    .from('collections')
    .select(MY_COLLECTION_COLS)
    // Newest first: the one you just made is the one you came back for.
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return withMembers(data);
}

/**
 * How many people liked each public collection, keyed by slug.
 *
 * Through `collection_like_counts()` rather than a select on the likes
 * table, and that is the privacy boundary rather than a convenience: the
 * table is readable only by the author of each row, so a count can only
 * come out of a function that returns totals and no user ids. Anyone may
 * learn a list has forty likes; nobody may learn who the forty are. See
 * the migration.
 *
 * Returned by slug because that is what every screen and `rankByLikes`
 * key on; the function speaks in ids, so this is where the two meet.
 *
 * Failure is an empty map, never a throw. Every count then reads as zero,
 * `rankByLikes` falls back to the order the shelf had before likes
 * existed, and no heart shows a tally — which is exactly the state the
 * feature ships in anyway.
 */
export async function fetchLikeCounts(): Promise<Record<string, number>> {
  const [counts, ids] = await Promise.all([
    supabase.rpc('collection_like_counts'),
    supabase.from('collections').select('id, slug').eq('is_public', true),
  ]);
  if (counts.error || ids.error || !counts.data || !ids.data) return {};
  const slugOf = new Map<string, string>();
  for (const row of ids.data as { id: string; slug: string }[]) slugOf.set(row.id, row.slug);
  const out: Record<string, number> = {};
  for (const row of counts.data as { collection_id: string; likes: number }[]) {
    const slug = slugOf.get(row.collection_id);
    if (slug) out[slug] = row.likes;
  }
  return out;
}

/**
 * Which public collections *you* have liked.
 *
 * Its own query rather than a flag on the count above, because the two
 * answer different questions and only one of them is public. This one
 * reads the likes table directly and RLS keeps it to your own rows —
 * signed out it comes back empty, which is the right answer for a set
 * that is defined as yours.
 */
export async function fetchMyLikes(meId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('collection_likes')
    .select('collection_id')
    .eq('user_id', meId);
  if (error || !data) return [];
  return (data as { collection_id: string }[]).map((r) => r.collection_id);
}

/**
 * Like, or take a like back.
 *
 * The insert can legitimately fail and the caller should not treat that
 * as breakage: the policy refuses a like on your own list, and the
 * primary key refuses a second one from the same person. Both are the
 * rules working. What the caller needs back is whether the state changed,
 * so it knows whether to refetch.
 */
export async function likeCollection(collectionId: string, meId: string): Promise<boolean> {
  const { error } = await supabase
    .from('collection_likes')
    .insert({ collection_id: collectionId, user_id: meId });
  return !error;
}

export async function unlikeCollection(collectionId: string, meId: string): Promise<boolean> {
  const { error } = await supabase
    .from('collection_likes')
    .delete()
    .eq('collection_id', collectionId)
    .eq('user_id', meId);
  return !error;
}

const suffix = () => Math.random().toString(36).slice(2, 8);

/**
 * Create one of the user's own lists. Private by design — the RLS policy
 * refuses an owned row with is_public true, and the app never asks for one.
 *
 * The title is written into all three language columns: this is the user's
 * own words, and we do not have a translation of them. Showing their list
 * under an empty title because the app is in Japanese would be worse than
 * showing it under the words they chose.
 */
export async function createCollection(input: {
  ownerId: string;
  cityId: string;
  title: string;
  desc?: string;
}): Promise<string> {
  const title = input.title.trim();
  const desc = input.desc?.trim() || null;

  // Two attempts: slugs carry a random suffix, so a collision means bad luck
  // rather than a name already taken, and retrying costs one round trip.
  //
  // The last collision is what the loop throws when it runs out, rather than
  // a sentence of its own. Written the other way round until the coverage
  // gate reached this file: the loop used to throw on `attempt === 1` and
  // end with an unreachable `throw` that existed only because the compiler
  // cannot see the loop always leaves. Two exits for one outcome, one of
  // which no test could ever reach.
  let collision = 'Could not create the collection';
  for (let attempt = 0; attempt < 2; attempt++) {
    const slug = `${slugify(title)}-${suffix()}`;
    const { error } = await supabase.from('collections').insert({
      slug,
      city_id: input.cityId,
      owner_id: input.ownerId,
      title_en: title, title_vi: title, title_ja: title,
      desc_en: desc, desc_vi: desc, desc_ja: desc,
      is_public: false,
    });
    if (!error) return slug;
    // 23505 = unique_violation. Anything else will happen again on the
    // retry, so spending a second round trip on it only delays the message.
    if (error.code !== '23505') throw new Error(error.message);
    collision = error.message;
  }
  throw new Error(collision);
}

/** Rename one of the user's own lists. RLS scopes this to rows they own. */
export async function updateCollection(slug: string, input: { title: string; desc?: string }): Promise<void> {
  const title = input.title.trim();
  const desc = input.desc?.trim() || null;
  // All three language columns again, for the same reason as on create.
  const { error } = await supabase
    .from('collections')
    .update({
      title_en: title, title_vi: title, title_ja: title,
      desc_en: desc, desc_vi: desc, desc_ja: desc,
    })
    .eq('slug', slug);
  if (error) throw new Error(error.message);
}

/**
 * Publish one of the user's own lists, or take it back.
 *
 * The whole of publishing, as far as the client is concerned: one boolean.
 * Everything that follows from it happens in the database — the editorial
 * read policies already select on `is_public` alone, so the list and its
 * places become visible to everyone the moment this lands, and a trigger
 * stamps the byline from the owner's profile rather than trusting a
 * handle sent from here.
 *
 * Which is why `curator_handle` is not in this update and must not be.
 * See `20260815120000_publish_collections.sql`.
 */
export async function setCollectionPublic(slug: string, isPublic: boolean): Promise<void> {
  const { error } = await supabase
    .from('collections')
    .update({ is_public: isPublic })
    .eq('slug', slug);
  if (error) throw new Error(error.message);
}

/** Remove one of the user's own lists. RLS scopes this to rows they own. */
export async function deleteCollection(slug: string): Promise<void> {
  const { error } = await supabase.from('collections').delete().eq('slug', slug);
  if (error) throw new Error(error.message);
}

/** The row ids behind two slugs. Both tables key on slug for the app and on
 *  id for the join table, so one hop is unavoidable. */
async function idsFor(collectionSlug: string, placeSlug: string) {
  const [col, place] = await Promise.all([
    supabase.from('collections').select('id').eq('slug', collectionSlug).single(),
    supabase.from('places').select('id').eq('slug', placeSlug).single(),
  ]);
  if (col.error) throw new Error(col.error.message);
  if (place.error) throw new Error(place.error.message);
  return { collectionId: (col.data as { id: string }).id, placeId: (place.data as { id: string }).id };
}

/**
 * Put a place in one of the user's lists. RLS checks the list's owner, so
 * a request naming someone else's list is refused at the database.
 *
 * `sortOrder` is where it lands in the list — the caller knows how many
 * members there already are, so new saves go on the end.
 */
export async function addPlaceToCollection(collectionSlug: string, placeSlug: string, sortOrder = 0): Promise<void> {
  const { collectionId, placeId } = await idsFor(collectionSlug, placeSlug);
  const { error } = await supabase
    .from('collection_places')
    .insert({ collection_id: collectionId, place_id: placeId, sort_order: sortOrder });
  // 23505 = unique_violation: the place is already in the list, which is
  // the state the caller wanted. Racing two taps is not an error.
  if (error && error.code !== '23505') throw new Error(error.message);
}

export async function removePlaceFromCollection(collectionSlug: string, placeSlug: string): Promise<void> {
  const { collectionId, placeId } = await idsFor(collectionSlug, placeSlug);
  const { error } = await supabase
    .from('collection_places')
    .delete()
    .eq('collection_id', collectionId)
    .eq('place_id', placeId);
  if (error) throw new Error(error.message);
}

/**
 * Take somebody else's list into your own.
 *
 * A copy, not a follow. The distinction is the whole feature: following
 * would keep one list and add a viewer to it, and the reader who asked
 * for this asked so they could *edit* — rename it, drop two places, add
 * four of their own. That needs rows they own, so this makes them.
 *
 * The copy is private, because `createCollection` cannot make anything
 * else: the insert policy refuses an owned row with `is_public` true.
 * Which is the right default anyway — republishing someone's work is a
 * decision, and it should be one the copier takes deliberately from the
 * menu rather than one this button takes for them.
 *
 * ── one insert, not one per place ──
 *
 * `addPlaceToCollection` resolves its two ids per call, so looping it
 * over a nine-place list would be twenty-seven round trips for what is
 * one write. The slugs are resolved together here — the shape
 * `reorderCollection` already uses — and the memberships go in as a
 * single insert, which also makes the order arrive whole instead of
 * settling row by row.
 *
 * A slug the catalog no longer has is skipped rather than failing the
 * copy. The source list is drawn from the same catalog, so this only
 * happens if a place is retired between the read and the tap, and losing
 * one place is a better answer than losing the list.
 *
 * ── what a half-finished copy leaves behind ──
 *
 * The collection is created before its members, so a failure on the
 * second call leaves an empty list the reader owns. That is deliberate:
 * it is visible, it is theirs, and the menu they just used has Delete in
 * it. The alternative — deleting it from here — is a second write that
 * can fail for the same reason the first one did, and a silent rollback
 * that half-works is worse than a list you can see and remove.
 */
export async function copyCollection(input: {
  ownerId: string;
  cityId: string;
  title: string;
  desc?: string;
  placeSlugs: readonly string[];
}): Promise<string> {
  const slug = await createCollection({
    ownerId: input.ownerId,
    cityId: input.cityId,
    title: input.title,
    desc: input.desc,
  });
  if (!input.placeSlugs.length) return slug;

  const [col, places] = await Promise.all([
    supabase.from('collections').select('id').eq('slug', slug).single(),
    supabase.from('places').select('id, slug').in('slug', input.placeSlugs as string[]),
  ]);
  if (col.error) throw new Error(col.error.message);
  if (places.error) throw new Error(places.error.message);

  const collectionId = (col.data as { id: string }).id;
  const idBySlug = new Map((places.data as { id: string; slug: string }[]).map((r) => [r.slug, r.id]));
  const rows = input.placeSlugs
    .map((s, i) => {
      const placeId = idBySlug.get(s);
      return placeId ? { collection_id: collectionId, place_id: placeId, sort_order: i } : null;
    })
    .filter((r): r is { collection_id: string; place_id: string; sort_order: number } => !!r);
  if (!rows.length) return slug;

  const { error } = await supabase.from('collection_places').insert(rows);
  if (error) throw new Error(error.message);
  return slug;
}

/**
 * Put the members of a collection in a new order.
 *
 * `collection_places.sort_order` has been read everywhere since the table
 * existed and written in exactly one place — `addPlaceToCollection`, with
 * the current length, which only ever appends. This is the writer that was
 * missing.
 *
 * A loop of updates rather than an upsert, following
 * `dashboard/src/api.js:reorderPhotos`. The key is (collection_id,
 * place_id), so positions may collide mid-loop without anything failing —
 * which is exactly why the position is not in the key.
 */
export async function reorderCollection(collectionSlug: string, placeSlugs: string[]): Promise<void> {
  const { data: col, error: colError } = await supabase
    .from('collections').select('id').eq('slug', collectionSlug).single();
  if (colError) throw new Error(colError.message);
  const collectionId = (col as { id: string }).id;

  const { data: rows, error: placesError } = await supabase
    .from('places').select('id, slug').in('slug', placeSlugs);
  if (placesError) throw new Error(placesError.message);
  const idBySlug = new Map((rows as { id: string; slug: string }[]).map((r) => [r.slug, r.id]));

  for (let i = 0; i < placeSlugs.length; i++) {
    const placeId = idBySlug.get(placeSlugs[i]);
    if (!placeId) continue;
    const { error } = await supabase
      .from('collection_places')
      .update({ sort_order: i })
      .eq('collection_id', collectionId)
      .eq('place_id', placeId);
    if (error) throw new Error(error.message);
  }
}
