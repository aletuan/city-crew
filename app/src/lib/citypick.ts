// Which city the app opens on, and when it is allowed to change its mind.
//
// The bootstrap in `lib/city` has to answer two questions in order: what to
// commit to *now*, and whether a location answer that arrives afterwards is
// worth acting on. Both are decisions over plain values, so they live here
// where a Node process can reach them — the same reason `boot.ts` exists.
//
// ── the wait this is about ──
//
// The bootstrap used to ask the platform where the phone is *before*
// committing to any city, racing that against a 1.2 s budget. Nothing could
// start until it answered: `usePlacesQuery` and `useCollectionsQuery` are
// held on a promise that never resolves while `city` is null, so the whole
// catalog sat behind a skeleton for up to 1.2 s on every launch.
//
// From the second launch onward that wait buys almost nothing. The previous
// launch already chose a city and wrote it down, and people do not usually
// change city between opening an app twice.

export type StoredPick = { id?: string; mode?: 'auto' | 'manual' };
export type Pick = { id: string; mode: 'auto' | 'manual' };

/**
 * The stored choice, if it still names a city the catalog has.
 *
 * A city can be retired between two launches, and a stored id that no
 * longer exists must not be committed — it would scope every query to
 * nothing and read as an empty catalog.
 */
export function storedPick(stored: StoredPick, knownIds: readonly string[]): Pick | null {
  if (!stored.id || !knownIds.includes(stored.id)) return null;
  return { id: stored.id, mode: stored.mode === 'manual' ? 'manual' : 'auto' };
}

/**
 * What to commit before asking the platform anything, or null to wait.
 *
 * A manual pick is the reader's own word and has never involved the
 * platform: it commits immediately either way, and no location answer may
 * override it.
 *
 * An automatic one commits immediately only when `resume` is on. Off, this
 * answers null for it and the caller waits for the location race exactly as
 * it always did.
 *
 * Null is also the honest answer on a first launch, stored or not: with
 * nothing remembered there is nothing to open on but a guess, and guessing
 * is what the wait exists to avoid.
 */
export function openOn(stored: StoredPick, knownIds: readonly string[], resume: boolean): Pick | null {
  const pick = storedPick(stored, knownIds);
  if (!pick) return null;
  if (pick.mode === 'manual') return pick;
  return resume ? pick : null;
}

/**
 * Whether a location answer should move a city that is already showing.
 *
 * Only for a city committed automatically, only when the platform actually
 * named a different one, and never over a manual pick.
 *
 * This is a knowing exception to the bootstrap's own rule that the city
 * never changes on its own after it commits. The rule was written when the
 * commit happened *after* the location answer, so there was nothing left to
 * correct; committing early is what creates the case. The cost is bounded —
 * one change, only for a reader who has genuinely moved city since their
 * last launch, and only ever from a remembered city to their real one.
 */
/**
 * The stored pick, with the choosing person's name taken off it — or null
 * when there is nothing to take off.
 *
 * `manual` means "the reader said so", and `city.tsx` honours that
 * absolutely: it returns before the platform is even asked where the phone
 * is. That is right for as long as the reader is the same person. It stops
 * being right the moment the account changes, because the pick is stored
 * per *device* and nothing about signing out clears it — so a stranger's
 * choice would go on silencing the location question for every account
 * after it, and a new reader in Hanoi opens the app on the Da Nang the
 * last one chose, with no way of knowing why or that there is a way out.
 *
 * The id is kept. It is a reasonable guess and it lets the next launch
 * paint before the network answers; `auto` is the whole of the change, and
 * it says only that nobody has claimed this choice any more.
 *
 * Null for "no write needed" rather than an unchanged copy, so the caller
 * does not touch storage to say nothing — the common case by far, since
 * most picks were never manual.
 */
export function releaseChoice(stored: StoredPick): StoredPick | null {
  if (!stored.id || stored.mode !== 'manual') return null;
  return { ...stored, mode: 'auto' };
}

export function shouldCorrect(showing: Pick | null, nearId: string | null): boolean {
  if (!showing || !nearId) return false;
  if (showing.mode === 'manual') return false;
  return nearId !== showing.id;
}

/**
 * The city to settle on when the bootstrap waited for the location answer.
 *
 * Where the platform knows, it wins; where it does not, the remembered
 * choice; failing both, the app's default. Unchanged from what the
 * bootstrap has always done — named here so it can be tested.
 */
export function settleOn(nearId: string | null, stored: Pick | null, fallbackId: string): string {
  return nearId ?? stored?.id ?? fallbackId;
}
