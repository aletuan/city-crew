// How the places stand on the page and how they are moved: the cards or
// the grid, the places a chosen kind leaves, whether the order may be
// changed, and the drag that changes it.
//
// Out of `CollectionDetailScreen` on 25 Nov 2026, the fifth step of F1 in
// the 22 Nov code review. The reasoning moved with the code unchanged.

import { useCallback, useEffect, useRef } from 'react';
import { type FlatList, useWindowDimensions } from 'react-native';
import { useTabBarClearance } from '../../components/ui';
import { useEdgeSwipeBack, useListDrag } from '../../components/useListDrag';
import { narrowTo } from '../../lib/collectionKinds';
import { readerKey, COLLECTION_VIEW_KEY } from '../../lib/readerPrefs';
import { oneOf, useStored } from '../../lib/stored';
import type { Place } from '../../lib/types';
import type { Nav } from '../../nav';
import { space } from '../../theme';
import { GRID_GAP } from './styles';

/**
 * A card's pitch before it has reported its size: a 16:10 photograph the
 * width of a phone, the two lines under it, and the gap below. Only ever
 * used for the first frame, or on a platform that does not report layout.
 * After that each card's own height is used, gap included (the card's
 * `marginBottom` sits inside the view that is measured).
 */
const PITCH_GUESS = 320;

/**
 * The two ways a list is looked at: the cards, or a grid of three to a row
 * (owner, 22 Oct 2026; `PlaceTile` says what a tile keeps and drops).
 *
 * One choice for every list, kept on the phone as Collections keeps its
 * tile/row choice (`citycrew.collections.view`): how a reader likes to
 * look at a list is theirs, not the list's, and a choice made per list
 * would be forty-five choices to make.
 *
 * The grid is the default (owner, the same day, once a tile could be
 * dragged and the list scrolled under it): a list is mostly photographs,
 * and the grid shows a list of twenty at a glance. A reader who chose the
 * cards before that keeps them — the default stands in only where nobody
 * has chosen.
 *
 * Kept per reader, not per phone (`readerKey`, owner, 22 Oct 2026): a
 * second account on the same phone opened on the first one's cards.
 */
const LIST_OR_GRID = oneOf('list', 'grid');

/** Tiles to a row. Three, the reference's and every photo app's: at 393pt
 *  a tile is 111pt, which still carries a name in 12pt across most of it. */
export const GRID_COLUMNS = 3;
/** The grid's first cell on your own list, which holds "Add place" rather
 *  than a place. Not a slug: slugs never carry a "+". */
export const ADD_CELL = '+add' as const;

export function useListArrange({ owned, members, drafted, shuffle, narrowed, chosen, userId, navigation }: {
  owned: boolean;
  members: Place[];
  /** The list in the order on screen, and the one move there is (`useReorderDraft`). */
  drafted: Place[];
  shuffle: (from: number, to: number) => void;
  /** The kinds chosen on the card (`useKindFilter`). */
  narrowed: boolean;
  chosen: string[];
  userId: string | null | undefined;
  navigation: Nav;
}) {
  const [view, pickView] = useStored<'list' | 'grid'>(
    readerKey(COLLECTION_VIEW_KEY, userId), 'grid', LIST_OR_GRID,
  );
  const grid = view === 'grid';

  // The places on screen: the whole list, or the kinds chosen on the
  // card (see "the chips are the filter").
  const shown = narrowed ? narrowTo(drafted, chosen) : drafted;

  // Only your own list, and only one with an order to change: a single
  // place has none, and a card that lifts to go nowhere is a gesture
  // that seems broken. Not while narrowed: a move among the places on
  // screen would be a move among places the reader cannot see, and the
  // list's real order is the one that saves.
  const canArrange = owned && drafted.length > 1 && !narrowed;
  // A tile dragged right is not a way back — see `useEdgeSwipeBack`.
  useEdgeSwipeBack(navigation, canArrange);
  const { width: winW } = useWindowDimensions();
  const tile = Math.floor((winW - space.page * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);

  // ── the card in the finger ──
  //
  // The hold, the drag and the drop are `useListDrag`'s, shared with the
  // plan editor; landing calls `shuffle`, the same move VoiceOver's
  // actions make, and saves the same way. The pitch guess is a 16:10
  // photograph the width of a phone, the two lines under it, and the gap
  // below — only ever used for the first frame.
  //
  // On the grid the same hook drags tiles: a cell is a tile and the gap
  // after it, across and down alike, since the rows are spaced by the gap
  // the tiles are.
  //
  // Near either end of the list the list scrolls itself under the held
  // card (owner, 22 Oct 2026), so a card can reach a place off screen in
  // one drag. The foot's edge starts at the floating bar's top, which lies
  // over the list's last few points.
  //
  // On your own list the grid's first cell is "Add place" (below), so the
  // tiles stand one cell on from their place in the order: `lead`.
  const adding = owned && members.length > 0;
  const lead = grid && adding ? 1 : 0;
  const listRef = useRef<FlatList<Place | typeof ADD_CELL>>(null);
  const barCovers = useTabBarClearance(0);
  const { lift, panHandlers, onLift, onRelease, onPitch, styleOf, areaRef, onScrolled, onContentSizeChange } = useListDrag({
    keys: drafted.map((p) => p.slug),
    onMove: shuffle,
    pitchGuess: PITCH_GUESS,
    grid: grid ? { cols: GRID_COLUMNS, pitch: tile + GRID_GAP, lead } : null,
    scroll: {
      to: (offset) => listRef.current?.scrollToOffset({ offset, animated: false }),
      coveredBelow: barCovers,
    },
  });

  // ── drawn again only when it moved ──
  //
  // The screen draws again on a save anywhere (it reads your lists), on
  // every slot a held card passes, and on a chip; each card used to be
  // handed a fresh open and a fresh up and down every time, so every card
  // drew again to show what it already showed (owner, 30 Oct 2026). The
  // cards are behind `memo` now and handed these, which hold still: a
  // step reads the order through `latest`, so a card not drawn since the
  // last move still moves the place where it stands now.
  const latest = useRef(shuffle);
  useEffect(() => { latest.current = shuffle; });
  const openPlace = useCallback((slug: string) => navigation.navigate('PlaceDetail', { slug }), [navigation]);
  const step = useCallback((index: number, by: -1 | 1) => latest.current(index, index + by), []);
  return {
    view, pickView, grid, shown, canArrange, tile, adding, lead, listRef, count: drafted.length,
    lift, panHandlers, onLift, onRelease, onPitch, styleOf, areaRef, onScrolled, onContentSizeChange,
    openPlace, step,
  };
}

export type ListArrange = ReturnType<typeof useListArrange>;
