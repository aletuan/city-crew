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
 * 1200, and the number is `shrink-photos`' rather than this file's: that
 * job re-encodes every photo in the bucket to fit 1200px within the hour,
 * because 1200 device pixels is the widest the app ever draws one (the
 * detail hero, edge to edge on a 3× phone). Anything sent above it is
 * carried up the phone's slowest link and then thrown away.
 *
 * It was 1600 at 0.8 until 25 Oct 2026, and measured that day it was most
 * of the wait. Three uploads from the owner's phone, on Viettel, read
 * back from the edge logs: 1.55 MB in 60 s, 1.30 MB in 55 s, 705 KB in
 * 35 s — 20 to 26 KB/s up, the same rate two hours apart, with the
 * server's own part 0.3 to 0.8 s of it. The job had already rewritten
 * the first two to 302 KB and 262 KB: four bytes in five that went up
 * were discarded an hour later.
 *
 * The long edge, not the width, which is what this used to resize by: a
 * portrait photograph went up 1200 wide and 1600 tall.
 */
export const PHOTO_PX = 1200;

/** `shrink-photos`' JPEG quality, 74 on ImageMagick's scale, so the job
 *  has nothing left to take out of a file this made. */
export const PHOTO_QUALITY = 0.74;

/**
 * The resize that brings a picked photograph's long edge to `PHOTO_PX`,
 * or null when it is already within it — a resize there would only
 * enlarge it. A photograph the picker could not measure is resized by
 * width, as every one was before the picker's sizes were read.
 */
export function shrinkTo(width?: number, height?: number): { width: number } | { height: number } | null {
  if (!width || !height) return { width: PHOTO_PX };
  if (Math.max(width, height) <= PHOTO_PX) return null;
  return width >= height ? { width: PHOTO_PX } : { height: PHOTO_PX };
}

/** What the panel knows about the person looking at it. */
export type Guide = {
  /** The signed-in account, or null. */
  uid: string | null;
  /** Whether the desk has granted this account the local-guide role. */
  granted: boolean;
  /** Whether this account is an editor — the desk's hand. Optional so a
   *  caller that never learned it reads as a guide, which is the narrower
   *  answer. */
  editor?: boolean;
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
  if (!me.uid) return false;
  // The desk's hand, on any place: `editors manage photos` already lets an
  // editor do all of this in the database, and `guide_may_manage` says so
  // too since 20260927140000. Whose place it is does not come into it.
  if (me.editor) return true;
  if (!me.granted) return false;
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
/**
 * How many photographs the roll may hand over in one go.
 *
 * The room left under both caps, so the picker's own limit says what the
 * policy would otherwise say to the sixth after five uploads. An editor
 * the caps do not bind gets one batch of MAX_PER_PLACE: the picker needs
 * a number, and five is the figure this gallery already explains.
 */
export function photoRoom(me: Guide, counts: { mineHere: number; mineToday: number }): number {
  if (me.uid && me.editor) return MAX_PER_PLACE;
  return Math.max(0, Math.min(MAX_PER_PLACE - counts.mineHere, MAX_PER_DAY - counts.mineToday));
}

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
  // An editor is refused nothing here. The two caps are clauses of the
  // guides' insert policy; the editors' policy has none, as the Data Desk
  // never had — counting against a limit the database will not apply
  // would only stop the desk doing from the phone what it does anyway.
  if (me.uid && me.editor) return null;
  if (!me.uid || !me.granted) return 'not_a_guide';
  if (!canAddPhoto(place, me)) return 'not_your_place';
  if (counts.mineHere >= MAX_PER_PLACE) return 'place_full';
  if (counts.mineToday >= MAX_PER_DAY) return 'day_full';
  return null;
}
