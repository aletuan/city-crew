// What a pull on Explore asks again.
//
// Everything the page draws from the network: the places, the
// community's collections, the hearts those collections are ranked and
// counted by, and this week's check-ins. Until 26 Nov 2026 a pull asked
// for the places alone, and the owner pulled on a city that had just
// reached three check-ins and saw the shelf stay away — a pull is the
// reader asking "what is new on this page", and a page that refreshes a
// third of itself answers "nothing" for the rest.
//
// The hearts go with the collections because the shelf is ordered by
// them (`useListRank`): new lists under last hour's counts would be
// ranked by a tally that no longer holds.
//
// The spinner is `usePull`'s: armed by the gesture, off once every read
// it waited on has settled — not the first, the places, which would
// leave the shelves above still changing under a page that said it was
// done. The hearts are not waited on: the provider does not say when
// they are loading, and they move a number, not what is on the page.
// A read that fails keeps what it had (`useFetch`), so one shelf's
// failure costs that shelf its freshness and nothing else.

import { useCollections, useLikes } from '../../lib/catalog';
import type { HighlightCheckin } from '../../lib/data';
import { usePull, type Reloadable } from '../../lib/usePull';
import { useHighlights } from './CheckinShelf';

export function useExploreRefresh(places: Reloadable): {
  pulling: boolean;
  pull: () => void;
  highlights: readonly HighlightCheckin[];
} {
  const collections = useCollections();
  const { reloadLikes } = useLikes();
  const highlights = useHighlights();
  const hearts = { loading: false, reload: reloadLikes };
  const { pulling, pull } = usePull([places, collections, hearts, highlights]);
  return { pulling, pull, highlights: highlights.data };
}
