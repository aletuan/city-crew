// One write per person at a time, and a word when it fails.
//
// The crew screens answer requests, block, unblock and unfriend with a
// single tap and no spinner, and every one of those writes used to end in
// `.catch(() => {})`: a dropped connection left the row exactly as it was,
// with nothing to say whether the tap had missed, the app had hung, or the
// write had landed and the list was slow. For a block — the one a reader
// is counting on — that silence is the worst possible answer.
//
// So each write runs through `run`: keyed by the person it is about, it
// refuses a second tap on the same key while the first is in flight (the
// state behind `pending` updates a render late; the ref does not), and it
// hands the failure to the caller to say out loud.

import { useCallback, useRef, useState } from 'react';

export function usePending() {
  const inFlight = useRef(new Set<string>());
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());

  const run = useCallback((
    key: string,
    work: () => Promise<unknown>,
    onDone: () => void,
    onFail: (error: unknown) => void,
  ) => {
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    setPending(new Set(inFlight.current));
    work()
      .then(onDone, onFail)
      .finally(() => {
        inFlight.current.delete(key);
        setPending(new Set(inFlight.current));
      });
  }, []);

  return { pending, run };
}

/** The server's reason, when there is one worth showing. */
export const reasonOf = (error: unknown): string | undefined =>
  error instanceof Error && error.message ? error.message : undefined;
