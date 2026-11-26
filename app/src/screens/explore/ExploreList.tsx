// The places, one card each, under the photograph and the filter row.
//
// Out of `ExploreScreen` on 25 Nov 2026, as the screens of the 22 Nov code
// review were (F1, F5): the reasoning moved with the code, unchanged.

import React, { memo, useState, type ReactElement, type RefObject } from 'react';
import { Animated, View, type SectionList } from 'react-native';
import PlaceCard from '../../components/PlaceCard';
import { Empty } from '../../components/ui';
import { chosenKind } from '../../lib/categories';
import type { Place } from '../../lib/data';
import type { ExploreFilters, ExploreOrigin } from '../../lib/exploreFilters';
import { distanceKm } from '../../lib/geo';
import type { useI18n } from '../../lib/i18n';
import type { Nav } from '../../nav';
import { ExploreSuggestRow } from './ScrollNudge';

/**
 * A card in the list, drawn again only when something it shows has moved.
 *
 * The screen redraws on every bookmark tapped — the reader's taste moves
 * with their lists, and the order is cut from it (`useBrowseTaste`) — and
 * `renderItem` used to hand every card a fresh `onPress` each time, so
 * every card on screen drew again to change one bookmark (owner, 30 Oct
 * 2026). Its props here are the place, two values and one `open` that
 * outlives renders; the press is made in here, from the slug. The
 * bookmark's own fill is the card's subscription (`useIsSaved`), not a
 * prop, so the one card that changes still draws.
 */
const ExploreCard = memo(function ExploreCard({ place, index, chip, distanceKm, open }: {
  place: Place;
  index: number;
  chip: string | null;
  distanceKm: number | null;
  open: (slug: string) => void;
}) {
  return (
    <PlaceCard
      place={place}
      testID={`place-card-${index}`}
      chip={chip}
      distanceKm={distanceKm}
      onPress={() => open(place.slug)}
    />
  );
});

export function ExploreList({
  t, navigation, listRef, shown, header, bar, picked, appliedFilters, sortOrigin, openPlace, tabClearance,
  pulling, onPull, onScroll, onViewable, viewabilityConfig,
}: {
  t: ReturnType<typeof useI18n>['t'];
  navigation: Nav;
  listRef: RefObject<SectionList<Place> | null>;
  shown: Place[];
  /** The photograph, the banner and the shelf. */
  header: ReactElement;
  /** The filter row, as the one section's header. */
  bar: ReactElement;
  picked: string[];
  appliedFilters: ExploreFilters;
  sortOrigin: ExploreOrigin | null;
  openPlace: (slug: string) => void;
  tabClearance: number;
  pulling: boolean;
  /** Everything the page shows, asked again — `useExploreRefresh`. */
  onPull: () => void;
  onScroll: (...args: unknown[]) => void;
  onViewable: (info: { viewableItems: { index: number | null | undefined }[] }) => void;
  viewabilityConfig: { itemVisiblePercentThreshold: number };
}) {
  return (
  <Animated.SectionList
    ref={listRef}
    // One section, whose only job is to give the filter row
    // something to be the header of.
    sections={[{ data: shown }]}
    testID="explore-list"
    keyExtractor={(p) => p.slug}
    ListHeaderComponent={header}
    renderSectionHeader={() => bar}
    // Nothing sticks any more: what used to pin is drawn over the
    // screen instead. See `bar`.
    stickySectionHeadersEnabled={false}
    renderItem={({ item, index }) => (
      <ExploreCard
        place={item}
        index={index}
        chip={chosenKind(item, picked)}
        // The figure goes with the sort, not with the fix: the
        // reader may well have a position from the map or from
        // an earlier sort, and a card under "Recommended" that
        // said "2.1 km" above one that said "0.4 km" would be
        // asking the reader to explain the order. Worked out here
        // rather than kept on the place: one haversine per visible
        // card is nothing, and the filter already did the same
        // sum to order them.
        distanceKm={appliedFilters.sort === 'distance' && sortOrigin && item.lat != null && item.lng != null
          ? distanceKm(sortOrigin.lat, sortOrigin.lng, item.lat, item.lng)
          : null}
        open={openPlace}
      />
    )}
    // A footer, not `ListEmptyComponent`, and the difference is not
    // a preference. A section list counts two rows per section for
    // its header and footer whether or not the section has any data
    // (`VirtualizedSectionList.js:197`), so the count is never zero
    // and the empty component would never have rendered — a filter
    // matching nothing would have shown the chips and then blank
    // page. As a footer it lands under the pinned row, which is
    // where it belongs anyway: an empty result is the one moment
    // the filter most needs to be reachable, because changing it is
    // the way out.
    //
    // The suggestion slot rides the same footer, and its placement
    // is the whole argument: scroll depth is a poor trigger —
    // scrolling twenty cards means browsing, which is what this
    // screen is for — but *reaching the end* is not a heuristic. It
    // is the moment you have seen everything there is, which is the
    // only moment "we are missing one" is a useful thing to say.
    ListFooterComponent={(
      <>
        {shown.length === 0
          ? <Empty text={t('Nothing here yet.', 'Chưa có gì ở đây.', 'まだ何もありません。', '这里还没有内容。', '這裡還沒有內容。')} />
          : null}
        <ExploreSuggestRow onPress={() => navigation.navigate('AddPlace')} />
      </>
    )}
    contentContainerStyle={{ paddingBottom: tabClearance }}
    showsVerticalScrollIndicator={false}
    onRefresh={onPull}
    refreshing={pulling}
    onScroll={onScroll}
    scrollEventThrottle={16}
    // Both stable refs: React Native refuses to have either of
    // these change between renders.
    onViewableItemsChanged={onViewable}
    viewabilityConfig={viewabilityConfig}
  />
  );
}

/**
 * The list, kept under the map once it has been drawn (owner's
 * recording, 25 Nov 2026).
 *
 * It used to be taken down for the map and built again on the way back:
 * the hero and the shelf's covers came up grey and faded in every time,
 * and the reader was returned to the top of a list they had been halfway
 * down. Kept, it comes back as it was left — its pictures, its place.
 * Under the map it takes no touches and is not read aloud.
 *
 * Not built under a map it has never been seen from behind: a reader
 * whose remembered view is the map, and whose places arrive after that
 * was read, pays for one view until they ask for the other.
 */
export function KeptUnder({ under, children }: { under: boolean; children: React.ReactNode }) {
  const [seen, setSeen] = useState(false);
  if (!seen && !under) setSeen(true);
  if (!seen) return null;
  return (
    <View
      style={{ flex: 1 }}
      pointerEvents={under ? 'none' : 'auto'}
      aria-hidden={under || undefined}
      accessibilityElementsHidden={under}
      importantForAccessibility={under ? 'no-hide-descendants' : 'auto'}
      testID="explore-list-keep"
    >
      {children}
    </View>
  );
}
