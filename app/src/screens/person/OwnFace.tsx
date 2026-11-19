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
import AvatarPicker from '../../components/AvatarPicker';
import { RING_OUT } from '../../components/EngagementRing';
import { useProfile } from '../../lib/auth';
import { savedPlaces } from '../../lib/badges';
import type { FriendProfile } from '../../lib/data';
import { useMyLists } from '../../lib/save';
import { HeroFace } from '../profile/HeroFace';

// ── pressed, it changes your picture (owner, 19 Nov 2026) ──
//
// As your picture on the Account page does: the same picker (`AvatarPicker`),
// the same sheet of animals, library and camera, without its camera badge
// — the level's pill is under the picture, and Edit profile still wears
// the badge. One picker, so one way to do it from both pages.
//
// And one picture. The picker reads and writes your own profile
// (`lib/auth`), which the Account page draws too, so a picture changed on
// either page is on the other at once. The rest of your page draws you
// from its own fetch of your profile, by handle (`useProfileByHandle`),
// which would still hold the old picture — on the head of every card of
// your feed — until the page was read again. `useOwnPicture` lays your
// own profile's picture over that fetch, as `Bio` lays your bio.

export function OwnFace({ size }: { size: number }) {
  const mine = useMyLists();
  // Distinct places, as the Account page counted them: `savedPlaces`.
  const saved = useMemo(() => savedPlaces(mine.data), [mine.data]);
  return (
    <View style={{ margin: -RING_OUT }} testID="person-own-face">
      <HeroFace saved={saved} size={size}><AvatarPicker size={size} showCamera={false} /></HeroFace>
    </View>
  );
}

/**
 * The page's person, with your own profile's picture on it when the page
 * is yours — see above. Your profile is read once it has a handle: before
 * that it is the empty one auth starts with, whose picture is "none".
 */
export function useOwnPicture(person: FriendProfile | null, me: string | null): FriendProfile | null {
  const { profile } = useProfile();
  const own = !!person && !!me && person.id === me && !!profile?.handle;
  const url = own ? profile.avatar_url ?? '' : null;
  return useMemo(
    () => (person && url !== null && url !== person.avatar_url ? { ...person, avatar_url: url } : person),
    [person, url],
  );
}
