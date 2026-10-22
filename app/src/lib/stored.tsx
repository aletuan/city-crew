// A value the device remembers between launches, as a hook.
//
// ── why this exists (19 Oct 2026) ──
//
// Five screens kept a value on the phone the same way: a `useState` with
// a default, a `useEffect` that read `AsyncStorage` once and set it, and a
// setter that wrote it back. Each said "AsyncStorage", "the key", "JSON"
// for itself. The SOLID review (D) asked that a screen say "remember
// this" and leave how to one module: where the value lives can then
// change in one place, and the rule each copy kept — or did not — is
// kept once.
//
// The rule is about order. The read is asynchronous and the reader can
// tap before it lands. Explore and Collections guarded half of it — a
// `null` read on a fresh install must not land after a tap and undo it —
// but a *stored* value landing after a tap undid it all the same. Here,
// once anything has been written, the read that was already out is
// dropped, whatever it carries.
//
// The rules for what a value may be stay where they were — `parseView`,
// `parseRecents` — and arrive here as a codec. This file only ferries.

import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseRecents } from './recents';

/**
 * How a value is written as text, and read back. `parse` answers
 * `undefined` for text it does not accept, and the default stands.
 */
export type Codec<T> = {
  parse: (raw: string) => T | undefined;
  format: (value: T) => string;
};

/** A search box's remembered searches — see `lib/recents`. */
export const RECENTS: Codec<string[]> = {
  parse: (raw) => parseRecents(raw),
  format: (value) => JSON.stringify(value),
};

/** Nothing remembered yet: the one empty list, so a default is not a new array each render. */
export const NO_RECENTS: string[] = [];

/** One of a fixed set of words, stored as itself. */
export function oneOf<T extends string>(...words: readonly T[]): Codec<T> {
  return {
    parse: (raw) => (words as readonly string[]).includes(raw) ? raw as T : undefined,
    format: (value) => value,
  };
}

/**
 * Where the value in hand came from: `reading` while the read is out,
 * `stored` once the device gave one or the reader set one, `fallback`
 * once it is known that nothing usable is stored.
 *
 * For a screen that has to tell a reader's choice from the default
 * standing in for one: the collection's grid, which is the default now,
 * says so once to a reader who never chose it (owner, 22 Oct 2026), and
 * not to one who did — nor, while the read is out, to anybody.
 */
export type Origin = 'reading' | 'stored' | 'fallback';

/**
 * `[value, remember, origin]`: the stored value once it has been read,
 * `fallback` until then and whenever nothing usable is stored. `remember`
 * sets it now and writes it for the next launch; a write that fails is a
 * memory lost, not an error the screen can act on.
 */
export function useStored<T>(key: string, fallback: T, codec: Codec<T>): [T, (value: T) => void, Origin] {
  const [value, setValue] = useState<T>(fallback);
  const [origin, setOrigin] = useState<Origin>('reading');
  const written = useRef(false);
  const latest = useRef(codec);
  latest.current = codec;

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!live || written.current) return;
        const read = raw == null ? undefined : latest.current.parse(raw);
        if (read !== undefined) setValue(read);
        setOrigin(read === undefined ? 'fallback' : 'stored');
      })
      .catch(() => { if (live && !written.current) setOrigin('fallback'); });
    return () => { live = false; };
  }, [key]);

  const remember = useCallback((next: T) => {
    written.current = true;
    setValue(next);
    setOrigin('stored');
    AsyncStorage.setItem(key, latest.current.format(next)).catch(() => {});
  }, [key]);

  return [value, remember, origin];
}
