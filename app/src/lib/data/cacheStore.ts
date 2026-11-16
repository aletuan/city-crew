// The catalog's remembered answers, on the phone: one read and one write,
// for an answer of any length `cache.ts` will keep.
//
// The two hooks that remember (`usePersistedFetch`, `useSharedFetch`)
// each read and wrote a single row themselves until 16 Nov 2026. An
// answer is one row or several now (`splitCache`), and what that takes
// to do safely is here, once.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CACHE_MAX_PARTS, packParts, partKey, partsOf, splitCache } from './cache';

const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);

/**
 * The blob kept under a key, whole, or null when there is none that can
 * be trusted.
 *
 * An answer in parts is trusted only complete: their length together
 * the one the head recorded. A write is several
 * rows and a phone can stop between any two of them; the head is written
 * last, so a write cut short leaves the old head over a mix of old and
 * new parts, and the length is what tells them apart from the answer.
 */
export async function readCache(key: string): Promise<string | null> {
  const raw = await AsyncStorage.getItem(key);
  const head = partsOf(raw);
  if (!head) return raw;
  const parts = await Promise.all(range(0, head.parts).map((i) => AsyncStorage.getItem(partKey(key, i))));
  // A missing part joins as nothing, so the length catches that too.
  const whole = parts.join('');
  return whole.length === head.chars ? whole : null;
}

/**
 * Keeps a blob under a key, and says in how many rows: 1, several, or 0
 * for a blob too long to keep — whose last answer is removed, since kept
 * it would go on opening the app with what every later fetch replaced.
 *
 * Rows a shorter answer no longer uses are removed each time: an answer
 * that was four parts and is one again leaves nothing behind it.
 */
export async function writeCache(key: string, blob: string): Promise<number> {
  const parts = splitCache(blob);
  if (!parts) {
    await Promise.all([AsyncStorage.removeItem(key), ...range(0, CACHE_MAX_PARTS).map((i) => AsyncStorage.removeItem(partKey(key, i)))]);
    return 0;
  }
  const kept = parts.length === 1 ? 0 : parts.length;
  // The parts, then the head — see `readCache`.
  await Promise.all(parts.slice(0, kept).map((p, i) => AsyncStorage.setItem(partKey(key, i), p)));
  await AsyncStorage.setItem(key, kept ? packParts(kept, blob.length) : blob);
  await Promise.all(range(kept, CACHE_MAX_PARTS).map((i) => AsyncStorage.removeItem(partKey(key, i))));
  return parts.length;
}
