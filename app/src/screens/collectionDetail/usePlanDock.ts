// Planning a trip from a list, and the dock that offers it once the card
// at the head has scrolled away.
//
// Out of `CollectionDetailScreen` on 23 Nov 2026, the fourth step of F1
// in the 22 Nov code review. The dock's own reasoning stayed with it; it
// is long because the dock was argued over for a week.

import { useRef, useState } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useDockOffer } from '../../components/DockSlot';
import { type useDuckOnScroll, useTabBarDucked } from '../../components/tabBarDuck';
import type { useListDrag } from '../../components/useListDrag';
import type { Collection } from '../../lib/data';
import type { Place } from '../../lib/types';
import { goTo, type Nav } from '../../nav';

type Drag = ReturnType<typeof useListDrag>;

export function usePlanDock({ col, members, navigation, duckScroll, onScrolled, lift }: {
  col: Collection | null | undefined;
  members: Place[];
  navigation: Nav;
  /** The tab bar's ducking, which reads the same scroll. */
  duckScroll: ReturnType<typeof useDuckOnScroll>;
  /** The drag's own reading of the scroll, which it needs to follow a held card. */
  onScrolled: Drag['onScrolled'];
  /** A card in the finger: the dock waits until it is let go. */
  lift: Drag['lift'];
}) {
  /* ── the list's two actions: the dock, and the menu ──
     (owner, 16 Oct 2026). Planning a trip from the list is what a reader
     does with it once read, owner or not; adding a place is the owner's
     everyday edit. Both were out of reach: Plan at the very end of the
     list, under every photograph, and Add only in the ⋯ menu.

     For a build they also ended the intro card. The owner took them out
     again the same evening: the card introduces the list — whose it is,
     what it is, how it is doing — and a pair of buttons there made it a
     toolbar. So the two live where a reader is when they want them:

     - In the dock, once the card has scrolled away and the tab bar has
       ducked — `DockSlot`, the slot Explore lends "Not finding it?" — in
       thumb reach however deep the list goes.
     - In the ⋯ menu, always: Add place as before, and Plan a trip beside
       it. That row is not a second door for its own sake. A list of two
       or three places is too short to scroll, so the bar never ducks and
       the dock never comes; without the row, Plan would be on no screen
       at all for a short list.

     Plan only once there is a list to plan from: an empty one seeds
     nothing, and its own card is already asking for the first place.
     The planner decides the city (see IdeasScreen's `from`); `at` makes a
     second press on the same list a new ask. The paw is the planner's own
     mark. Add, until the in-place picker exists, goes to Explore, where
     saving a place already offers this list by name.

     ── the dock, as Explore's (owner, 17 Oct 2026) ──
     The two docks are one design now. Explore's says what it offers in a
     glyph and two lines, the whole island answering to that, and the
     gradient "+ Địa điểm" at its right end. Here the sentence is the
     plan — the paw, "Lên kế hoạch", and what it is for — and the pill is
     the second act: "+ Địa điểm" for the owner, "Lưu bản sao" for a
     visitor, so there is always one gradient pill, at the right,
     whoever is reading.

     It undoes a call of 16 Oct, and says why. Plan was the gradient and
     Add the quiet glass beside it, on the reading that the gradient
     belongs to what the list exists for; as a sentence that fills the
     island, Plan is no smaller than it was, and the owner wanted one
     dock to learn, not two.

     The pill's word is the noun on both docks (owner, 17 Oct 2026).
     The first cut said "Thêm", Explore's word then; beside a sentence
     about planning, "Thêm" alone read as "add to the plan", and the
     owner moved both docks to "+ Địa điểm" rather than let them differ.
     The glyph says add; the word says what. VoiceOver hears the whole
     "Thêm địa điểm", which is what the ⋯ menu's row says too.

     Explore's pill became "+ Tạo mới" on 25 Oct 2026, the word for a
     pill that makes something. This one stays the noun: it puts a place
     the catalog already has into the list, and "Tạo mới" beside "Lên kế
     hoạch" would read as "a new plan".

     A list with no city has no copy to offer (see the ⋯ menu), and a
     friend's list shared with you offers none (`sharedToMe`), so a
     visitor's dock there is the sentence alone. */
  const plan = () => {
    if (!col) return;
    goTo('Ideas', { screen: 'IdeasHome', params: { from: col.slug, at: Date.now() } });
  };
  const canPlan = !!col && members.length > 0;
  // Where the card ends in the list's content, measured, so the dock waits
  // until it has actually gone rather than guessing from a row count.
  const cardEnd = useRef(Number.POSITIVE_INFINITY);
  const [pastCard, setPastCard] = useState(false);
  const pastRef = useRef(false);
  const onListScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    duckScroll?.(e);
    onScrolled(e.nativeEvent);
    const past = e.nativeEvent.contentOffset.y > cardEnd.current;
    if (past !== pastRef.current) {
      pastRef.current = past;
      setPastCard(past);
    }
  };
  const ducked = useTabBarDucked();
  // Not while a card is held: the dock would rise under the finger.
  const dock = useDockOffer(canPlan && ducked && pastCard && !lift, navigation);

  // Measured where the card is drawn, written here: the ref is this hook's.
  const onCardLayout = (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    cardEnd.current = y + height;
  };

  return { plan, canPlan, dock, onListScroll, onCardLayout };
}
