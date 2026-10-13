// When to ask the reader for a rating on the App Store.
//
// Apple's own sheet, not ours: `SKStoreReviewController` draws it, shows
// it at most three times a year per reader whatever we ask, and may show
// nothing at all. So the rules here are not about Apple's cap — they are
// about not spending one of those three on a bad moment.
//
// A good moment is right after the reader got something out of the app,
// never in the middle of a task and never on the first visit:
//
// - the third check-in or later — somebody who has marked three places
//   they went has used the app for its purpose more than once;
// - the second saved plan or later — the first save is followed by the
//   notification permission sheet (`reminders.ts`), and two system sheets
//   in a row reads as the app wanting things.
//
// And never twice for one binary, and never twice within REVIEW_GAP_DAYS:
// a reader who closed the sheet in June has answered for the summer.
//
// Pure, so the gate holds every rule; `askReview.ts` is the half that
// reads storage and calls the native module.

/** The AsyncStorage key the memo is kept under. */
export const REVIEW_KEY = 'citycrew.review';

/** Days that must pass after one ask before the next. */
export const REVIEW_GAP_DAYS = 120;

/** Check-ins (this one included) before a check-in is a moment. */
export const CHECKINS_BEFORE_ASK = 3;

/** Saved plans (this one included) before a save is a moment. */
export const TRIPS_BEFORE_ASK = 2;

/** What this phone remembers about asking. */
export type ReviewMemo = {
  /** When the sheet was last asked for, ISO; null if never. */
  askedAt: string | null;
  /** The binary version it was asked on; null if never. */
  askedVersion: string | null;
  /** Plans saved on this phone, counted here because the trips list
   *  holds invitations accepted too, and those are not the reader's work. */
  tripsSaved: number;
};

export const EMPTY_MEMO: ReviewMemo = { askedAt: null, askedVersion: null, tripsSaved: 0 };

/** What just happened, with the reader's running total including it. */
export type Moment =
  | { kind: 'checkin'; total: number }
  | { kind: 'trip'; total: number };

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** A stored value, narrowed. Anything unreadable is a phone that has
 *  never been asked — the cost of a wrong "never" is one sheet Apple may
 *  not show anyway; the cost of a wrong "asked" is never asking. */
export function parseMemo(raw: string | null): ReviewMemo {
  if (!raw) return EMPTY_MEMO;
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return EMPTY_MEMO; }
  if (!v || typeof v !== 'object') return EMPTY_MEMO;
  const o = v as Record<string, unknown>;
  const n = typeof o.tripsSaved === 'number' && Number.isFinite(o.tripsSaved) && o.tripsSaved > 0
    ? Math.floor(o.tripsSaved)
    : 0;
  return { askedAt: str(o.askedAt), askedVersion: str(o.askedVersion), tripsSaved: n };
}

/** Whether this is the kind of moment worth spending an ask on. */
export function worthAsking(m: Moment): boolean {
  return m.kind === 'checkin' ? m.total >= CHECKINS_BEFORE_ASK : m.total >= TRIPS_BEFORE_ASK;
}

/** Whether the phone's history allows an ask now. A null version (Expo
 *  Go, a test run) never asks: there is no store listing behind it. */
export function mayAsk(memo: ReviewMemo, version: string | null, now: Date): boolean {
  if (!version) return false;
  if (memo.askedVersion === version) return false;
  if (!memo.askedAt) return true;
  const last = Date.parse(memo.askedAt);
  if (Number.isNaN(last)) return true;
  return now.getTime() - last >= REVIEW_GAP_DAYS * 86_400_000;
}

/** Both, in the order a caller wants them. */
export function shouldAsk(memo: ReviewMemo, m: Moment, version: string | null, now: Date): boolean {
  return worthAsking(m) && mayAsk(memo, version, now);
}

/** The memo after an ask. */
export function afterAsk(memo: ReviewMemo, version: string, now: Date): ReviewMemo {
  return { ...memo, askedAt: now.toISOString(), askedVersion: version };
}
