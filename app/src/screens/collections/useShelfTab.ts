// Which tab is open — Yours or Community — and the three things that move
// it besides a tap: Explore's "See all" aiming here, an empty library
// greeted with the community shelf, and a list started from Community
// taking the reader to Yours once it exists.
//
// Out of CollectionsScreen since 24 Nov 2026. The lines were moved, not
// retyped.
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { SectionList } from 'react-native';
import { useTourAnchor } from '../../components/SignupTour';
import type { Collection } from '../../lib/data';
import type { Nav } from '../../nav';
import type { ListRow, Section } from './rows';

export function useShelfTab({ route, session, mine, shared, scrollRef, navigation }: {
  route: { params?: { tab?: 'yours' | 'community'; at?: number } };
  session: object | null;
  mine: { loaded: boolean; data: Collection[] };
  shared: { loaded: boolean; data: Collection[] };
  scrollRef: React.RefObject<SectionList<ListRow, Section> | null>;
  navigation: Nav;
}) {
  // The two halves were one scroll, and the second half lost: four owned
  // lists already pushed "Public collections" to the fold, and a library
  // that grows pushes it further every month. A tab each — the same
  // shape as the Crew screen, for the same reason: two questions, asked
  // at different moments. Guests skip the switch entirely; with no
  // library there is only the one half to show.
  //
  // "Community", not "Public": on this screen "Public" is already the
  // status word each owned row wears, and one word must not mean the tab
  // and the badge at once. It also pairs with "Yours" as an answer to
  // the same question — whose lists these are.
  const [tab, setTab] = useState<'yours' | 'community'>(route.params?.tab ?? 'yours');
  // Explore's "See all" aims here while the screen may already be
  // mounted, so a fresh param re-aims the switch. Keyed on `at` as well
  // as `tab`: the second "See all" carries the same tab as the first, and
  // a reader who had switched to Yours in between was left there, because
  // an unchanged value never re-ran this.
  //
  // And a fresh `at` starts the list from its top: the screen is the one
  // left behind when the reader went into a collection, still scrolled
  // to where they were, and a door that says "your collections" opens on
  // the first of them (UX-09).
  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
    if (route.params?.at) scrollRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: false });
  // `scrollRef` is a ref, the same object every render (`useShelfScroll`).
  }, [route.params?.tab, route.params?.at, scrollRef]);
  // An empty library greets with the community shelf instead of an empty
  // room — decided once per visit, the first time the answer lands, and
  // never re-decided under the reader's thumb (the Crew screen's rule).
  //
  // A library is not empty while a friend has shared a list with you: it
  // is on Yours (see `sections`), and greeting a reader whose friend just
  // shared one with Community would hide the one thing they came for. So
  // the greeting waits for both answers.
  const greeted = useRef(false);
  useEffect(() => {
    if (greeted.current || !session || !mine.loaded || !shared.loaded || route.params?.tab) return;
    greeted.current = true;
    if (mine.data.length === 0 && shared.data.length === 0) setTab('community');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine.loaded, shared.loaded]);
  // A list started from Community lands on Yours, where it now is: the
  // form goes back to whichever tab sent it, and on Community the new
  // list is invisible until it is made public. Keyed on the count, not on
  // the return — a cancelled form adds nothing and leaves the reader where
  // they were. The count rather than the focus because the form's
  // `mine.reload()` lands after the screen is focused again. A tab the
  // reader picks by hand in between drops the errand.
  const startedFromCommunity = useRef<number | null>(null);
  useEffect(() => {
    if (startedFromCommunity.current === null || mine.data.length <= startedFromCommunity.current) return;
    startedFromCommunity.current = null;
    setTab('yours');
  }, [mine.data.length]);
  const pickTab = (next: 'yours' | 'community') => { startedFromCommunity.current = null; setTab(next); };
  // The sign-up guide's third step rings Community (`SignupTour`).
  const communityRef = useTourAnchor('community', () => pickTab('community'));
  const startNew = () => {
    startedFromCommunity.current = onYours ? null : mine.data.length;
    navigation.navigate('CollectionForm');
  };

  // Guests have one shelf and no switch; see the tabs below.
  const onYours = !!session && tab === 'yours';

  return { tab, onYours, pickTab, communityRef, startNew };
}
