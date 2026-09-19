// Who may add a photograph to a place, and what the file is called.
//
// The rule lives in two places on purpose. The database enforces it —
// `20260919080000_local_guide_photos.sql`, and that policy is the one
// that decides — and this module states the same rule in the app, so a
// control that would be refused is never drawn in the first place. A
// button that exists and then fails is worse than a button that was
// never offered: the person has already chosen a photograph by then.
//
// Keeping the two in step is a real cost, and the reason it is worth
// paying is that the panel is the only thing on the screen that can tell
// somebody they are a guide. If the app guessed loosely and let the
// database refuse, the refusal would arrive after the picker, the crop
// and the upload.

/** How many a person may add to one place. The policy counts the same. */
export const MAX_PER_PLACE = 5;

/** And in a day, across every place. */
export const MAX_PER_DAY = 10;

/**
 * The long edge, in pixels, a photograph is reduced to before upload.
 *
 * 1600 rather than the avatar's 512: this one is looked at, not worn at
 * 88pt in a circle. It is also the width the cards already draw at on a
 * 3× phone — a 349pt card is 1047 device pixels — with room left for the
 * detail screen's full-bleed hero, and it keeps a JPEG comfortably under
 * the bucket's 10MB ceiling without asking the phone to upload a 4000px
 * original over hotel wifi.
 */
export const PHOTO_PX = 1600;

/** Matching the avatar's. Past 0.8 a JPEG pays in bytes for detail that
 *  a phone screen does not resolve. */
export const PHOTO_QUALITY = 0.8;

/** What the panel knows about the person looking at it. */
export type Guide = {
  /** The signed-in account, or null. */
  uid: string | null;
  /** Whether the desk has granted this account the local-guide role. */
  granted: boolean;
};

/** The part of a place this rule reads. */
export type Guidable = { submitted_by?: string | null };

/**
 * May this person add a photograph to this place?
 *
 * Three conditions, and each is a clause of the insert policy:
 *
 *   signed in          — `auth.uid()` has to be somebody
 *   granted            — `is_local_guide()`; the desk opens this by hand
 *   they imported it   — `places.submitted_by = auth.uid()`
 *
 * Deliberately says nothing about whether the place is published. A place
 * still waiting at the desk is exactly where this is most useful: the
 * person who has just imported a café is the one holding the better
 * photograph of it, and telling them to come back after approval is
 * telling them to forget.
 */
export function canAddPhoto(place: Guidable, me: Guide): boolean {
  if (!me.uid || !me.granted) return false;
  return !!place.submitted_by && place.submitted_by === me.uid;
}

/**
 * Where the file goes in the bucket.
 *
 * Under the uploader's own id, like an avatar, so one person's uploads
 * can never collide with another's and the storage policy can be written
 * against the first path segment without consulting a table.
 *
 * Unlike an avatar it is never overwritten — a gallery keeps what it is
 * given — so the name carries the place and a stamp. The stamp is the
 * caller's, not `Date.now()` read in here: a function that reads the
 * clock cannot be tested for what it returns, and this one is worth
 * testing because a bad path is a file nobody can find again.
 */
export function photoPath(uid: string, placeSlug: string, stamp: number): string {
  return `${uid}/${placeSlug}-${stamp}.jpg`;
}

/**
 * What went wrong, as something a screen can say.
 *
 * The caps are enforced in the insert policy, so hitting one arrives as
 * the same RLS refusal any other policy gives — there is no distinct
 * error to read. The app counts what it can see and names the limit
 * before the upload rather than after it, which is the only way the
 * message can be specific. `lib/quota` does the same for the caps it
 * knows about.
 */
export type PhotoRefusal = 'not_a_guide' | 'not_your_place' | 'place_full' | 'day_full';

/**
 * The refusal to show, or null when the upload may go ahead.
 *
 * `mineHere` and `mineToday` are counts the caller already holds; this
 * function does no reading of its own so that it stays worth testing.
 * Order matters: a person who is not a guide is told that, not told the
 * place is full.
 */
export function refusePhoto(
  place: Guidable,
  me: Guide,
  counts: { mineHere: number; mineToday: number },
): PhotoRefusal | null {
  if (!me.uid || !me.granted) return 'not_a_guide';
  if (!canAddPhoto(place, me)) return 'not_your_place';
  if (counts.mineHere >= MAX_PER_PLACE) return 'place_full';
  if (counts.mineToday >= MAX_PER_DAY) return 'day_full';
  return null;
}
