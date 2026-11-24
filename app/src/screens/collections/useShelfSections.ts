// How the shelf is laid out, and how the reader moves through it: the
// Mosaic's city blocks, the list's sections, the city block under the
// pinned row, and the jump to another city.
//
// Out of CollectionsScreen since 24 Nov 2026. The lines were moved, not
// retyped; what they read of the screen is named in each hook's argument.
import { useMemo, useRef } from 'react';
import type React from 'react';
import type { SectionList, SectionListProps } from 'react-native';
import { pairUp } from '../../lib/collectionShelf';
import { leadingCity, mosaicGroups, mosaicRows } from '../../lib/collectionMosaic';
import { derivedKinds } from '../../lib/collectionKinds';
import { type Collection, membersOf, type Place } from '../../lib/data';
import type { ListRow, Section } from './rows';


/** What the list says is on screen — `onSeen` reads the city from it. */
type Seen = Parameters<NonNullable<SectionListProps<ListRow, Section>['onViewableItemsChanged']>>[0];

export function useShelfSections({ onYours, communityView, asked, sifted, places, rank, here, mineReady, sharedSlugs, atKey }: {
  onYours: boolean;
  communityView: 'tile' | 'mosaic';
  asked: boolean;
  sifted: Collection[];
  places: Place[];
  rank: (lists: readonly Collection[]) => Collection[];
  here: { id: string } | null | undefined;
  mineReady: boolean;
  sharedSlugs: Set<string>;
  atKey: string | null;
}) {
  // Tiles pack two to a row-item; see `ShelfRow` for why every row-item
  // carries whose it is and where it sits in the whole list.
  //
  // The Community Mosaic at rest is one block a city, each under its name
  // (owner, 5 Nov 2026); see `mosaicGroups` for the order and for what was
  // ruled out. Asked anything, it is one shelf again, in the answer's
  // order — a chip already says which city, and a search ranks by hits.
  const groups = useMemo(() => (onYours || communityView !== 'mosaic' || asked ? null : mosaicGroups(sifted, {
    cityOf: (c) => leadingCity(membersOf(c, places).map((p) => p.city_id), c.city_id),
    kindOf: (c) => derivedKinds(membersOf(c, places))[0] ?? null,
    rank,
    home: here?.id,
  })), [onYours, communityView, asked, sifted, places, rank, here?.id]);
  // Memoised: a new array here makes the list reset what it has reported
  // in view and report it again — see the freeze noted at `onSeen`.
  //
  // ── shared with you (12 Nov 2026) ──
  //
  // On Yours, after your own lists and under a heading of its own: a list
  // a friend shared is one you keep coming back to, which is what Yours
  // is for, but it is not yours — no padlock, no count, a byline instead
  // — and mixed in among your own it would read as one you made. After
  // yours, not before: your own are what the tab opens for. Not on
  // Community, which answers "what does everyone see"; a shared list is
  // private, and everyone does not. The heading only when something is
  // in the section, so a reader nobody has shared with sees the tab as
  // it was.
  const sections: Section[] = useMemo(() => {
    if (onYours) {
      if (!mineReady) return [];
      const lent = sifted.filter((c) => sharedSlugs.has(c.slug));
      const own: Section = { own: true, data: pairUp(sifted.filter((c) => !sharedSlugs.has(c.slug)), true) };
      return lent.length ? [own, { own: false, shared: { count: lent.length }, data: pairUp(lent, false) }] : [own];
    }
    return groups?.length
      ? groups.map((g) => ({ own: false, data: g.rows, city: { id: g.city, count: g.count } }))
      // The grid has no city blocks, so at rest it is one shelf and is
      // ranked as one, every city's lists measured against each other.
      // It was the catalog's order, newest first.
      : [{ own: false, data: communityView === 'mosaic' ? mosaicRows(sifted) : pairUp(asked ? sifted : rank(sifted), false) }];
  }, [onYours, mineReady, sifted, sharedSlugs, groups, communityView, asked, rank]);
  const atCity = atKey == null ? null : sections.find((x) => x.city && (x.city.id ?? '') === atKey)?.city ?? null;
  return { groups, sections, atCity };
}

export function useCityJump({ sections, setAtKey, setJumpOpen, scrollRef, pinned, tabsHRef }: {
  sections: Section[];
  setAtKey: (key: string | null) => void;
  setJumpOpen: (open: boolean) => void;
  scrollRef: React.RefObject<SectionList<ListRow, Section> | null>;
  pinned: boolean;
  tabsHRef: React.MutableRefObject<number>;
}) {
  // ── the city you are in, pinned, and a way to the others (owner,
  // 6 Nov 2026) ──
  //
  // Six blocks, the first sixteen lists long: a reader after Huế scrolled
  // past thirty cards to find it, and half-way down nothing on screen said
  // which city the cards were in. The block's heading now rides under the
  // pinned tabs once its own has gone up past them, and either heading
  // opens the list of cities to jump to.
  //
  // Rejected, from the same reference: a "preferred city" setting of this
  // tab's own. The reader's city already leads, and a third place to pick
  // a city — after the app's city and the filter's — would leave nobody
  // sure which one decides what. A jump does the job without being a
  // setting.
  //
  // Which block is under the row is read from what the list says is in
  // view: the section of the first row on screen. While that block's own
  // heading is still in view — it is the header token of the same section,
  // ahead of its rows — the pinned copy stays away, so the name is never
  // printed twice.
  //
  // ── the freeze it shipped with (6 Nov 2026) ──
  //
  // The state is the city's key, a string, which React drops when it is
  // unchanged, and the sections are memoised, so a render the list did not
  // cause hands it the same data: a list given new `data` reports what is
  // in view again (`resetViewableIndices`), and an object in state would
  // turn every report into a render. These were the first guess at the
  // 6 Nov freeze and did not cure it — the cause was `rowKey`'s, above —
  // but they keep the report from costing a render it does not need.
  //
  // The first block draws no heading of its own (see `renderSectionHeader`),
  // so its slot in view says nothing: its rows count as the first city's
  // from the top, and the pinned bar names it as soon as the tabs pin.
  const firstSection = useRef<Section | undefined>(undefined);
  firstSection.current = sections[0];
  const onSeen = useRef(({ viewableItems }: Seen) => {
    const sectionOf = (v: Seen['viewableItems'][number]) => v.section as Section | undefined;
    const row = viewableItems.find((v) => v.index != null && sectionOf(v)?.city);
    const heading = row && row.section !== firstSection.current
      && viewableItems.find((v) => v.index == null && v.section === row.section);
    setAtKey(row && !heading ? (sectionOf(row)!.city!.id ?? '') : null);
  }).current;
  // One retry per jump, never a chase: a block the list still cannot
  // reach after it has scrolled near it stays where the scroll left it.
  const jumpRetried = useRef(false);
  const jumpTo = (sectionIndex: number, again = false) => {
    jumpRetried.current = again;
    setJumpOpen(false);
    scrollRef.current?.scrollToLocation({
      sectionIndex, itemIndex: 0, viewOffset: pinned ? tabsHRef.current : 0, animated: true,
    });
  };
  return { onSeen, jumpRetried, jumpTo };
}
