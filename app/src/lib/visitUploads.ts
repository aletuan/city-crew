// The photos on their way up to a visit, held by the app rather than by
// the sheet they were chosen in (owner, 25 Nov 2026).
//
// ── why out of the sheet ──
//
// Until this, the check-in sheet's Done waited for a photo still going
// up: a sheet that closed over an upload would have left the page below
// asked again before the photo existed. On a phone in Hanoi that wait was
// 3.5–4 s on Done's spinner (the owner's recording, 25 Nov 2026), most of
// it the function's own time — 1.9 to 4.4 s for three uploads, 1.97 s for
// a removal of 49 bytes. Done now closes at once, and the upload carries
// on here, where closing the sheet cannot end it. What the sheet's wait
// did for the page is done by the end of the upload instead: an `up`
// event, on which whoever holds the reader's visits asks for them again
// (`VisitUploads`).
//
// ── one at a time, still ──
//
// One queue for the app, as there was one a sheet: three photos at once
// on a café's mobile data is how all three fail.
//
// ── who says how it went ──
//
// A sheet that is open over the visit says it, on its tiles
// (`useVisitPhotos`) — it `watch`es the visit while it is up. Nobody
// watching, the app says it, once (`VisitUploads`): a refusal in words,
// a lost network with a way to try again.
//
// ── what is lost ──
//
// The app closed outright before an upload ends. The bytes are in memory
// and nowhere else; the photo is simply not there when the sheet is next
// opened, and is chosen again. Rejected: writing the shrunk bytes to disk
// to resume — a second copy of a person's photo on their phone, kept by
// us, for a case a tap repairs.

import type { CheckinPhoto, PhotoRefusal } from './checkin';
import { PhotoError } from './checkin';
import { uploadCheckinPhoto } from './data/checkinPhotos';

export type Upload = {
  key: string;
  visitId: string;
  /** The phone's own file, drawn until the stored photo replaces it. */
  uri: string;
  /** The shrunk bytes, kept for a retry. */
  image: string;
  state: 'sending' | 'failed';
};

export type UploadEvent =
  | { kind: 'up'; key: string; visitId: string; photo: CheckinPhoto }
  | { kind: 'refused'; key: string; visitId: string; why: Exclude<PhotoRefusal, 'other'> }
  | { kind: 'failed'; key: string; visitId: string };

const held = new Map<string, Upload>();
const listeners = new Set<(e: UploadEvent) => void>();
const watching = new Map<string, number>();
let queue: Promise<void> = Promise.resolve();

const emit = (e: UploadEvent) => { for (const fn of [...listeners]) fn(e); };

function run(key: string) {
  queue = queue.then(async () => {
    const u = held.get(key);
    if (!u) return;
    try {
      const photo = await uploadCheckinPhoto(u.visitId, u.image);
      held.delete(key);
      emit({ kind: 'up', key, visitId: u.visitId, photo });
    } catch (e) {
      const why = e instanceof PhotoError ? e.why : 'other';
      if (why === 'other') {
        held.set(key, { ...u, state: 'failed' });
        emit({ kind: 'failed', key, visitId: u.visitId });
      } else {
        held.delete(key);
        emit({ kind: 'refused', key, visitId: u.visitId, why });
      }
    }
  });
}

/** Send one shrunk photo to a visit, after any already going. */
export function sendVisitPhoto(u: Omit<Upload, 'state'>): void {
  held.set(u.key, { ...u, state: 'sending' });
  run(u.key);
}

/** Send a failed one again, with the same bytes. Nothing for any other. */
export function retryVisitPhoto(key: string): void {
  const u = held.get(key);
  if (!u || u.state !== 'failed') return;
  held.set(key, { ...u, state: 'sending' });
  run(key);
}

/** Give up on a failed one. One still going is not taken back: its
 *  request is already on its way, and stopping it here would not stop it
 *  there. */
export function dropVisitPhoto(key: string): void {
  if (held.get(key)?.state === 'failed') held.delete(key);
}

/** What is still on its way to `visitId`, or failed on the way. */
export function uploadsFor(visitId: string): Upload[] {
  return [...held.values()].filter((u) => u.visitId === visitId);
}

/** How many are still going, for any visit. */
export function uploadsGoing(): number {
  return [...held.values()].filter((u) => u.state === 'sending').length;
}

export function onVisitUpload(fn: (e: UploadEvent) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** A sheet is up over `visitId` and says how its photos went. */
export function watchVisit(visitId: string): () => void {
  watching.set(visitId, (watching.get(visitId) ?? 0) + 1);
  return () => {
    const n = (watching.get(visitId) ?? 1) - 1;
    if (n > 0) watching.set(visitId, n);
    else watching.delete(visitId);
  };
}

export function isWatched(visitId: string): boolean {
  return watching.has(visitId);
}

/** Resolves once nothing is going up — for tests, which share the module. */
export function uploadsSettled(): Promise<void> {
  return queue;
}

/** Forget everything — for tests. */
export function resetVisitUploads(): void {
  held.clear();
  listeners.clear();
  watching.clear();
  queue = Promise.resolve();
}
