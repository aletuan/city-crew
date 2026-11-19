// Your face on your own page, in the level's ring, with its pill under
// it and the sheet the pill opens — `profile/HeroFace`.
//
// ── why here (owner, 19 Nov 2026) ──
//
// The ring stood round your picture on the Account page. Account is a
// page under your own page now (docs/profile-home-plan.md), and a new
// badge is a reason for the last tab's dot: the plan's rule puts every
// such reason in sight where the tab opens. The ring's pill wears the
// badge's dot, and the sheet it opens is where the badge is seen.
//
// Yours alone. The level is made of how many places you keep, which is
// a measure of what you do; a visitor sees your face as everyone's is
// drawn. That stays until there is a reason to show it.
//
// The picture stays where every face on this page stands, and the ring
// spreads out from it (`RING_OUT`): into the cover above and the page's
// margin to the left, which the card's padding leaves room for.

import { useMemo } from 'react';
import { View } from 'react-native';
import { RING_OUT } from '../../components/EngagementRing';
import { savedPlaces } from '../../lib/badges';
import { useMyLists } from '../../lib/save';
import { HeroFace } from '../profile/HeroFace';

export function OwnFace({ size, children }: { size: number; children: React.ReactNode }) {
  const mine = useMyLists();
  // Distinct places, as the Account page counted them: `savedPlaces`.
  const saved = useMemo(() => savedPlaces(mine.data), [mine.data]);
  return (
    <View style={{ margin: -RING_OUT }} testID="person-own-face">
      <HeroFace saved={saved} size={size}>{children}</HeroFace>
    </View>
  );
}
