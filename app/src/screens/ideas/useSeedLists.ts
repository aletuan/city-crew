// Out of `IdeasScreen` on 25 Nov 2026, so the screen's function fits the
// ceiling (`oversize.js`); the reasoning moved with the code, unchanged.

import { useMemo } from 'react';
import { useSession } from '../../lib/auth';
import { useListRank } from '../../lib/tasteProfile';
import { type Collection, membersOf, type Place } from '../../lib/data';

/** A list, with only its members in this city — or all of them while no
 *  city is chosen. The count a row prints, and the test of whether the
 *  row appears at all. */
export function inCity(c: Collection, places: Place[], cityId: string | null | undefined): { c: Collection; members: Place[] } {
  const all = membersOf(c, places);
  return { c, members: cityId ? all.filter((p) => p.city_id === cityId) : all };
}

export type Seed = { c: Collection; members: Place[] };

export function useSeedLists(mine: Collection[], cols: Collection[], places: Place[], cityId: string | null | undefined) {
  // The ranking figure, which leaves out a curator's like of their own list.
  const rank = useListRank();
  const uid = useSession().session?.user?.id;
  /**
   * The lists this plan can start from: yours, and the community's, each
   * touching this city.
   *
   * A plan is for one city — the one chosen up top — and a list is not:
   * it is stamped with the city it was made in and holds whatever was
   * saved into it, Hanoi and Saigon alike (`fetchMyCollections`). This
   * section used to offer every list you own with its whole count, so a
   * reader planning Hanoi saw "8 places" on a list with three here,
   * ticked it, and met "some places did not fit" two screens later with
   * nothing pointing back at why.
   *
   * So the shelves' rule decides what appears — one place here is enough,
   * which is `touchesCity` with the members already narrowed to here —
   * and the count is the places here. The row keeps its two short lines;
   * what changed is that both are now true of this plan. A list with
   * nothing in this city cannot seed it and is not offered, rather than
   * listed, ticked and silently dropped. Not "3 of 8", and no city under
   * the count: the city is named once, in the line under the heading.
   *
   * The community's lists came in on 12 Oct 2026, and for the reader the
   * old version had nothing for: a guest, who owns no list, and an
   * account whose lists are all in another city. Both used to see no
   * section at all. They see the city's own lists now, ranked as
   * Explore's shelf ranks them (`useListRank`), the first three shown
   * and the rest a tap away. A reader with lists of their own here
   * sees those, and the community's behind the same tap: their own are
   * what they came for, and this screen is short on purpose. Your own
   * published list is on both shelves under one slug and is shown once,
   * under Yours — the Collections tab's rule.
   *
   * With no city resolved yet nothing is narrowed, and the only question
   * left is whether the list holds anything — the shelves' answer too.
   */
  const own = useMemo(
    () => mine.map((c) => inCity(c, places, cityId)).filter((x) => x.members.length > 0),
    [mine, places, cityId],
  );
  const community = useMemo(
    // Narrowed to the city first and ranked after: every signal is
    // measured among the lists handed over, and a list from another city
    // is not one this shelf will show.
    () => rank(cols.filter((c) => !(uid && c.owner_id === uid) && inCity(c, places, cityId).members.length > 0))
      .map((c) => inCity(c, places, cityId)),
    [cols, rank, uid, places, cityId],
  );
  return { own, community };
}
