// Search's index of every city's places, once it is wanted.
//
// The index is about 420 kB on the wire (`fetchSearchIndex`), so it is
// not asked for by a screen that has not been typed into: the zero-state
// answers from the reader's own city, which is already loaded. The first
// letter asks; the answer is kept for the rest of the run, and every later
// search, on this screen or the next one opened, starts from it.
//
// Kept in memory, not on the phone. The catalog's own cache is on the
// phone, but this is about 1.5 MB of text, and Android reads a stored
// value back through a 2 MB window; a cache that fails on one platform as
// the catalog grows is a cache to leave out. A run is long enough: the
// desk adds places by the day, not by the minute.
//
// One answer per reader, because their own suggestions are in it. A
// failed read is forgotten, so the next search asks again rather than
// living with the failure for the rest of the run.

import { useEffect, useState } from 'react';
import { fetchSearchIndex, type Place } from './data';

const asked = new Map<string, Promise<Place[]>>();

/** Forget every answer: a test's fresh start. */
export function forgetSearchIndex(): void {
  asked.clear();
}

/**
 * Every city's places for `reader` (`useSession().userId`: undefined while
 * unknown, null for nobody), once `wanted`; null until then, and until the
 * answer is in.
 */
export function useSearchIndex(wanted: boolean, reader: string | null | undefined): Place[] | null {
  const key = reader === undefined ? null : reader ?? '';
  const [got, setGot] = useState<{ for: string; places: Place[] } | null>(null);
  useEffect(() => {
    if (!wanted || key === null) return undefined;
    let answer = asked.get(key);
    if (!answer) {
      answer = fetchSearchIndex(key || null);
      asked.set(key, answer);
      answer.catch(() => asked.delete(key));
    }
    let live = true;
    answer.then((places) => { if (live) setGot({ for: key, places }); }, () => {});
    return () => { live = false; };
  }, [wanted, key]);
  return got && got.for === key ? got.places : null;
}
