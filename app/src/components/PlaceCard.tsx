import React from 'react';
import {
  type AccessibilityActionEvent, type AccessibilityActionInfo, type GestureResponderEvent, Text, View,
} from 'react-native';
import { categoriesOf, pinCategory } from '../lib/categories';
import { coverOf, isLive, Place } from '../lib/data';
import { useCityList } from '../lib/city';
import { cityTz } from '../lib/clock';
import { openFragment, openState, sashLabel, shutLabel } from '../lib/format';
import { fmtDistance } from '../lib/geo';
import { useI18n } from '../lib/i18n';
import { localized } from '../lib/localized';
import { splitName } from '../lib/name';
import { PressableScale } from './ui';
import ReviewBadge from './ReviewBadge';
import { PlaceCardMeta } from './PlaceCardMeta';
import { PlaceCardPhoto } from './PlaceCardPhoto';
import { s } from './placeCardStyles';

export default function PlaceCard({
  place, onPress, testID, distanceKm, chip, city, onLongPress, delayLongPress, onPressOut,
  accessibilityHint, accessibilityActions, onAccessibilityAction, inList,
}: {
  place: Place;
  /** Search opened from a list to add to it: the bookmark's corner holds
   *  that list's ⊕ / ✓ instead — see `ListToggle`. */
  inList?: { on: boolean; title: string; onPress: () => void };
  /** The place's city, said before its district — "Hà Nội · Giảng Võ" —
   *  where cards from more than one city share a list (Search, owner,
   *  22 Oct 2026). Left off everywhere a list is one city's: there it
   *  would say the same word on every card. */
  city?: string | null;
  /** The category the list is filtered to, if any (Explore's chip row).
   *  The pill then names it, as the map's pin does — see `pinCategory`. */
  chip?: string | null;
  onPress: () => void;
  testID?: string;
  /** How far from the reader, when the list is in the order that figure
   *  decides (Explore's "Nearest first") — null otherwise, and the line
   *  under the name says nothing about it. See the meta row for why the
   *  figure comes with the sort and not with the fix. */
  distanceKm?: number | null;
  /** For a card that does more than open its place: the collection screen's,
   *  which lifts on a hold so it can be dragged, and offers VoiceOver the
   *  same moves as actions. */
  onLongPress?: (e: GestureResponderEvent) => void;
  delayLongPress?: number;
  onPressOut?: (e: GestureResponderEvent) => void;
  accessibilityHint?: string;
  accessibilityActions?: AccessibilityActionInfo[];
  onAccessibilityAction?: (e: AccessibilityActionEvent) => void;
}) {
  const { t, lang } = useI18n();
  const cover = coverOf(place);
  // The clock is read per render, not memoised, for the reason the Search
  // zero-state gives: a list left open across a closing time should not
  // keep insisting the door is open.
  const district = place.neighborhood_en
    ? localized(place, 'neighborhood', lang)
    : null;
  const where = city ? (district ? `${city} · ${district}` : city) : district;
  const at = new Date();
  // On the place's own clock: a list can hold places from more than one
  // city (see `membersOf`), so the zone is the card's to look up.
  const tz = cityTz(useCityList().cities, place.city_id);
  const hours = openState(place.opening_hours, at, tz);
  const shut = shutLabel(hours, t);
  // What the sash shows and what it says are two lines about one fact:
  // the eye gets "Opens 08:00" on a red ground, a screen reader gets
  // "Closed · opens 08:00" — see `sashLabel` for why the state is left to
  // the colour, and why that is only safe with the full sentence beside it.
  const sash = sashLabel(hours, t);
  // Only the closing hour reaches the meta line. `openFragment` would
  // also hand back "opens 08:00" for a shut place, and this card says
  // that on the photograph instead — printing both would be the same
  // fact twice, once in grey and once in amber. So whenever `when` is
  // set here it means one thing, which is why its style can be amber
  // unconditionally rather than behind a second test.
  const when = hours?.open ? openFragment(hours, t) : null;
  // "850 m", "1.2 km", "12 km": `fmtDistance` sets the precision, and its
  // own note says why metres round to fifty and why the decimal is a full
  // stop beside a "4.7" rating even in Vietnamese.
  const far = distanceKm != null ? fmtDistance(distanceKm) : null;
  // The pill names what the place is, in the rule the map's pin follows,
  // so a card and its pin cannot disagree; the rest of its kinds are a
  // count. A place nothing classifies, or classifies only in keys the
  // table has not learned, gets its first key spelled out and no dot: a
  // colour is a category's, and an unknown one has none to give.
  const kinds = categoriesOf(place);
  const kind = pinCategory(place, chip) ?? kinds[0] ?? null;
  const more = kinds.filter((k) => k !== kind).length;
  return (
    <PressableScale
      onPress={onPress}
      testID={testID}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      onPressOut={onPressOut}
      accessibilityHint={accessibilityHint}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
    >
      <View style={s.card} testID={testID && `${testID}-card`}>
        <PlaceCardPhoto place={place} cover={cover} testID={testID} inList={inList} sash={sash} shut={shut} />
        <View style={s.body} testID={testID && `${testID}-body`}>
          {/* The whole line is the name's now that the bookmark rides the
              photograph — a 40pt disc used to sit beside it, and the
              names this catalog actually holds are long enough that the
              disc's width was the difference between reading one and
              reading "Bún chả Hàng Quạt – quán g…".

              And only the brand: what the catalog hangs after the dash
              is the branch's ward or its building (`docs/place-naming.md`,
              rule 4), and the ward is what the line under this one
              prints, with a pin. "Comfy Coffee & Bakes – Thủ Đức" over
              "⌖ Thủ Đức" said the one fact twice, in 169 rows. Two
              branches of one brand in one ward is the case that would
              need the suffix here, and the owner ruled it rare enough to
              leave to the detail screen, which prints the full name and
              the street address (2 Oct 2026). `splitName` cuts at the
              first spaced dash and leaves a name without one whole. */}
          <Text style={s.name} numberOfLines={1}>{splitName(localized(place, 'name', lang)).title}</Text>
          {/* Where, how far, open till when, and what kind — the notes on
              each, and on their order, are `PlaceCardMeta`'s. */}
          <PlaceCardMeta where={where} far={far} when={when} kind={kind} more={more} testID={testID} />
          {/* Only its owner sees this card's place, so the marker is not a
              warning — it is the answer to "why can nobody else see the
              place I added". Without it the card looks live, they show a
              friend, the friend sees nothing, and the app reads as broken.

              The grid's pill and this are one thing (`ReviewBadge`, owner,
              23 Oct 2026), in the look's own colours. It read "Only you can
              see this" until then, chosen over "Awaiting review" because a
              place can be approved and not yet published; the owner's
              reference put the state itself on the pill, and what it means
              for who sees the place moved into the tap.

              A flagged place says "In review", not "Not accepted": flagged
              is the desk looking again at a place it had approved, not a
              no — `ReviewBadge` has the count. */}
          {!isLive(place) && (
            <View style={s.status}>
              <ReviewBadge place={place} testID={testID ? `${testID}-status` : undefined} />
            </View>
          )}
        </View>
      </View>
    </PressableScale>
  );
}
