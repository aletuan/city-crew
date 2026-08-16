// What a batch of suggestions is doing, as plain data.
//
// Split out of `lib/candidates` so a Node process can reach it: the hook
// there imports `Alert` and `Keyboard`, which is the whole reason the
// rules a row's appearance depends on could not be tested until now.

/**
 * Where one candidate is in a batch.
 *
 * `skipped` is not a failure and must not read as one: the place was
 * already in the catalog, which is the answer somebody selecting five
 * results wanted rather than an error they caused.
 *
 * `held` is the one that was missing, and its absence made the app lie.
 * When the daily cap is reached mid-run, the place the server refused was
 * marked `failed` — "Could not add this one", in red, about a place that
 * is fine and will go in tomorrow — and every place after it was quietly
 * put back to `queued`, which renders as nothing at all. Neither of those
 * is what happened. What happened is: not attempted, because the account
 * has no goes left today, and that is a state of its own.
 */
export type ItemState = 'queued' | 'running' | 'done' | 'skipped' | 'failed' | 'held';

export type Batch = {
  running: boolean;
  state: Record<string, ItemState>;
  done: number;
  total: number;
};

export const IDLE_BATCH: Batch = { running: false, state: {}, done: 0, total: 0 };

/**
 * Is this row finished with, as far as the reader is concerned?
 *
 * Locked rows cannot be selected or deselected, because the tap would
 * mean nothing: the place is in flight, in the catalog, or refused.
 *
 * `queued` and `held` are deliberately not locked. Neither has been
 * attempted — one is waiting its turn, the other never got one — so the
 * reader may still change their mind about either, which they could not
 * do before: a run stopped by the cap left rows counted by the button but
 * impossible to untick.
 */
export function locksRow(state?: ItemState): boolean {
  return state === 'running' || state === 'done' || state === 'skipped' || state === 'failed';
}

/** How many of a batch never got a turn because the day's goes ran out. */
export function heldCount(batch: Batch): number {
  return Object.values(batch.state).filter((s) => s === 'held').length;
}

/** A run that has stopped, whatever stopped it. `total` is zero before the
 *  first one, which is not the same as finished. */
export function finished(batch: Batch): boolean {
  return batch.total > 0 && !batch.running;
}
