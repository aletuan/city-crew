import { useMemo, useState } from 'react';
import { collectionKinds, narrowTo } from '../../lib/collectionKinds';
import type { Collection } from '../../lib/data';
import type { Place } from '../../lib/types';

/**
 * The kinds a list's places carry, and the one of them the reader has
 * narrowed the list to — the card's chips and what they filter.
 */
export function useKindFilter(col: Pick<Collection, 'kinds_hidden'> | null | undefined, members: Place[]) {
  // The list's chips: every kind its places carry, most places first,
  // less what the owner hid (`lib/collectionKinds`).
  const kinds = useMemo(
    () => (col ? collectionKinds(members, { hidden: col.kinds_hidden }) : []),
    [col, members],
  );

  // ── the chips are the filter (owner, 15 Oct 2026) ──
  //
  // A tap on a chip narrows the places to that kind; nothing chosen is the
  // whole list — there is no "All" chip, by the owner's ruling, and the
  // way back is the count line's "Clear" or the chip tapped off.
  //
  // One kind at a time (owner, 24 Oct 2026). Any number could be chosen
  // until then, a place staying if it carried any of them; the owner took
  // multiple choice out of every filter in the app the same day. Another
  // chip moves to its kind rather than adding it.
  //
  // It was a second row of the filter row's glyph chips under the card
  // for one build, and the owner saw the same kinds twice: in the card,
  // and again under it, one chip apart. So the card's pills are the
  // filter now, which is also why they carry every kind rather than the
  // three that cleared a third of the list — a threshold there hid the
  // nine bars among seventy-two cafés, the case a filter is for.
  //
  // Only with two kinds or more: on a list of one kind a filter has
  // nothing to narrow, and a pill that does nothing should not be a
  // button. Chosen keys a reload takes away are let go rather than kept
  // as a filter nothing can match. Not kept across visits: a filter is a
  // look at the list, and a list that opens narrowed reads as a list that
  // lost places.
  const [picked, setPicked] = useState<string[]>([]);
  const filters = kinds.length > 1;
  const chosen = filters ? picked.filter((k) => kinds.includes(k)) : [];
  const narrowed = chosen.length > 0;
  const pick = (k: string) => setPicked((p) => (p.includes(k) ? [] : [k]));
  const kept = narrowed ? narrowTo(members, chosen).length : members.length;

  return { kinds, filters, chosen, narrowed, pick, kept, setPicked };
}
