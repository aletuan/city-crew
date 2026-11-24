// Where the reader is on the shelf: the list's handle and "back to top",
// whether the header has pinned its tabs and whether it has come back
// down over them, whether the reader is deep enough for the dock, and the
// city block under the pinned row.
//
// Out of CollectionsScreen since 24 Nov 2026. It is the scroll's
// bookkeeping and reads nothing of the shelf. The lines were moved, not
// retyped; `R` and `S` are the screen's row and section.
import { useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, SectionList } from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import { useDuckOnScroll } from '../../components/tabBarDuck';
import { createDuckTracker } from '../../lib/duck';

export function useShelfScroll<R, S>() {
  const duckScroll = useDuckOnScroll();
  // Its tab, pressed again here, scrolls back to the top — the last step
  // of the walk back that ExploreScreen's `tabPress` note describes.
  const scrollRef = useRef<SectionList<R, S>>(null);
  // Typed through, as on Explore: React Navigation's idea of a scrollable
  // and React Native 0.88's SectionList do not meet, though the list
  // answers `getScrollResponder` as it always did.
  useScrollToTop(scrollRef as unknown as Parameters<typeof useScrollToTop>[0]);
  const toTop = () => scrollRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: true });

  // Keep the natural header's geometry. The overlay pins only tabs and
  // layouts on descent; reversing reveals the full header in place.
  // The tab bar's tracker supplies hysteresis and overscroll clamping.
  const tabsYRef = useRef(0);
  const topHRef = useRef(0);
  const [headerTracker] = useState(() => createDuckTracker({ topSlack: 0 }));
  const [pinned, setPinned] = useState(false);
  const [headerExpanded, setHeaderExpanded] = useState(false);
  // The city block under the pinned row, once its own heading has gone
  // under the row (see `onSeen`); null while a heading is in view. Its key
  // only — the city's id, '' for "elsewhere" — never the section's object:
  // see the freeze noted at `onSeen`.
  const [atKey, setAtKey] = useState<string | null>(null);
  const [jumpOpen, setJumpOpen] = useState(false);
  // How tall the pinned tabs are, so a jump lands its heading just
  // under them rather than behind them.
  const tabsHRef = useRef(0);
  const [deep, setDeep] = useState(false);
  const onShelfScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    duckScroll?.(e);
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const maxY = Math.max(0, contentSize.height - layoutMeasurement.height);
    const y = Math.min(maxY, Math.max(0, contentOffset.y));
    const direction = headerTracker.report(y, maxY);
    if (direction) setHeaderExpanded(direction === 'show');
    // Keep the revealed header until the natural one is fully at rest.
    const nowPinned = tabsYRef.current > 0 && (y >= tabsYRef.current || (pinned && y > 0));
    if (nowPinned !== pinned) setPinned(nowPinned);
    const nowDeep = topHRef.current > 0 && y >= topHRef.current;
    if (nowDeep !== deep) setDeep(nowDeep);
  };

  return {
    scrollRef, toTop, tabsYRef, topHRef, tabsHRef, pinned, headerExpanded,
    atKey, setAtKey, jumpOpen, setJumpOpen, deep, onShelfScroll,
  };
}
