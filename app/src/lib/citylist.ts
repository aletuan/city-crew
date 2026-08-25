// The city list, remembered between launches.
//
// The startup traces (`startup_traces`, 2026-08-25) put a number on what
// the bootstrap's first round trip costs: 718–1078 ms before the cities
// list is back, and *everything* waits on it — the stored-city fast open
// included, because a remembered id may only be committed after checking
// it against the list of cities that still exist. The slowest step of the
// launch was gating a decision that needs a handful of ids.
//
// So the list the last launch fetched is written down, and the next launch
// reads it back in a few milliseconds and commits against *that*. The
// fresh fetch still runs and still decides everything afterwards — the
// cache only moves the commit off the network's critical path.
//
// This module is the reading half: whether a stored blob is a city list
// the bootstrap may trust. It is deliberately paranoid — the blob is a
// cache, written by a previous version of this app and survivable across
// updates, so nothing about its shape may be assumed. A blob that fails
// any check answers null and the bootstrap behaves exactly as if there
// were no cache, which is exactly what launches did before this existed.

import type { City } from './city';

/**
 * The fields a cached row must carry to be renderable as a city. The
 * nullable hero columns are deliberately not checked: a cache written
 * before a hero column existed is still a perfectly good list of cities,
 * and every hero reader already handles null.
 */
function isCity(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    typeof c.name_en === 'string' &&
    typeof c.name_vi === 'string' &&
    typeof c.short_en === 'string' &&
    typeof c.short_vi === 'string' &&
    typeof c.center_lat === 'number' &&
    typeof c.center_lng === 'number' &&
    typeof c.radius_km === 'number'
  );
}

/**
 * The cached list, or null when there is nothing worth trusting: no blob,
 * a blob that does not parse, parses to something that is not a list,
 * an empty list (caching "no cities" would pin the fallback row on screen
 * faster — a cache must never make a launch worse), or any row missing
 * the fields a screen would render.
 */
export function parseCachedCities(raw: string | null): City[] | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  return parsed.every(isCity) ? (parsed as City[]) : null;
}
