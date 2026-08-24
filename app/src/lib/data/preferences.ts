import { supabase } from '../supabase';

// ── preferences, and the history nobody has to keep ──────────────────
//
// Two tables the catalog knows nothing about. `preferences` is what a
// person told us; `place_events` is what they did, and it does not exist
// until they say it may. The opt-in is enforced in Postgres — see the
// migration — so nothing here has to be trusted to check it, and the worst
// a bug in this file can do is fail to record.

export type Preferences = {
  categories: string[];
  /** Per person, per outing, in đồng. Null is "not said", which is not the
   *  same as no budget and must not be stored as zero. */
  budget_vnd: number | null;
  /** Whether `place_events` may be written at all. */
  history_on: boolean;
};

export const NO_PREFERENCES: Preferences = {
  categories: [], budget_vnd: null, history_on: false,
};

/**
 * What this person has told us, or the empty answer.
 *
 * A missing row and a row of defaults are the same thing to every reader of
 * this — nobody has an opinion until they say so — so a 404 comes back as
 * `NO_PREFERENCES` rather than as null. That keeps the "have they opted in"
 * question a plain boolean everywhere instead of a three-way one.
 */
export async function fetchPreferences(ownerId: string): Promise<Preferences> {
  const { data, error } = await supabase
    .from('preferences')
    .select('categories, budget_vnd, history_on')
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return NO_PREFERENCES;
  const row = data as Partial<Preferences>;
  return {
    categories: row.categories ?? [],
    budget_vnd: row.budget_vnd ?? null,
    history_on: !!row.history_on,
  };
}

/** Write them, creating the row the first time. An upsert rather than an
 *  insert-then-update because there is exactly one row per person and the
 *  primary key says so — there is no state where two writers could disagree
 *  about which of two rows is current. */
export async function savePreferences(ownerId: string, p: Preferences): Promise<void> {
  const { error } = await supabase.from('preferences').upsert({
    owner_id: ownerId,
    categories: p.categories,
    budget_vnd: p.budget_vnd,
    history_on: p.history_on,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export type EventKind = 'open' | 'save' | 'unsave' | 'plan_keep' | 'plan_drop';

/**
 * Note that something happened, if the reader has allowed it.
 *
 * Never throws, and that is the whole shape of it. Recording is a side
 * effect of looking at a place; a screen that had to handle its failure
 * would be a screen where opening a café can show an error, and the failure
 * that matters most — "you have not opted in" — is not an error at all,
 * it is the database keeping the promise the toggle made.
 *
 * So a refusal is swallowed on purpose. The client checks `history_on`
 * first to save a round trip; the insert policy checks it again because a
 * client-side check is a promise and a policy is a guarantee.
 */
export async function logPlaceEvent(
  ownerId: string | null | undefined,
  placeSlug: string,
  kind: EventKind,
  cityId: string | null,
  allowed: boolean,
): Promise<void> {
  if (!ownerId || !allowed) return;
  try {
    const { data } = await supabase
      .from('places').select('id').eq('slug', placeSlug).maybeSingle();
    const placeId = (data as { id: string } | null)?.id;
    if (!placeId) return;
    await supabase.from('place_events')
      .insert({ user_id: ownerId, place_id: placeId, kind, city_id: cityId });
  } catch {
    // Nothing to do and nobody to tell. A lost event costs a slightly worse
    // ordering in a future plan; a thrown one costs the screen.
  }
}

/** Slugs this person opened and did not save — the strongest single signal
 *  `taste.ts` takes, and the only one that is about a place rather than a
 *  category.
 *
 *  Read over a window rather than over everything: a café passed over last
 *  March says nothing about this Saturday, and nothing trims the table yet.
 *  `since` is a parameter for the same reason `now` is everywhere else. */
export async function fetchPassedOver(ownerId: string, since: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('place_events')
    .select('kind, created_at, places(slug)')
    .eq('user_id', ownerId)
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  // Opened, and not saved *since*. Read in reverse order so the newest verb
  // about a place wins: somebody who opened a café, walked away, and saved
  // it a week later has not passed it over.
  const verdict = new Map<string, boolean>();
  // Through `unknown`, like every other embed in this file: PostgREST
  // returns the joined row as an object where the generated types expect an
  // array, and the shape the query actually produces is the one below.
  const rows = (data ?? []) as unknown as { kind: EventKind; places: { slug: string } | null }[];
  for (const row of rows) {
    const slug = row.places?.slug;
    if (!slug || verdict.has(slug)) continue;
    if (row.kind === 'save' || row.kind === 'plan_keep') verdict.set(slug, false);
    else if (row.kind === 'open' || row.kind === 'plan_drop') verdict.set(slug, true);
  }
  return [...verdict.entries()].filter(([, passed]) => passed).map(([slug]) => slug);
}

/** Erase everything recorded about this person. The button the opt-in is
 *  not allowed to ship without: switching recording off and being unable to
 *  remove what was already recorded is the trap the whole table has to
 *  avoid, which is why the delete policy does not consult `history_on`. */
export async function clearMyHistory(ownerId: string): Promise<void> {
  const { error } = await supabase.from('place_events').delete().eq('user_id', ownerId);
  if (error) throw new Error(error.message);
}
