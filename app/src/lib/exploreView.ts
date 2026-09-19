// The Explore list's two ways of being looked at, and the one control on
// the map that cycles rather than toggles. Pure, so the 100% gate holds it.

import type { ExploreStatus } from './exploreFilters';

export type ExploreView = 'list' | 'map';

/** Same shape as Collections' `citycrew.collections.view`: one key, one
 *  word, remembered across launches. */
export const VIEW_KEY = 'citycrew.explore.view';

/** What the store said, or the list — a fresh install, an old build and a
 *  typo all land on the default rather than on an error. */
export function parseView(raw: string | null | undefined): ExploreView {
  return raw === 'map' ? 'map' : 'list';
}

/** The map's status button has three answers and one tap: any → open →
 *  closed → any. */
export function cycleStatus(status: ExploreStatus): ExploreStatus {
  if (status === 'any') return 'open';
  if (status === 'open') return 'closed';
  return 'any';
}
