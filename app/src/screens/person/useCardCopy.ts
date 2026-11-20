// The copy button on a person page's cards (owner, 20 Nov 2026) —
// `components/CopyCount` has the decision. The list's page has the same
// button (`collectionDetail/CopyDoor`); this is the feed's half: from a
// card, without opening the list.
//
// A copy from a card is the list page's copy, made from the row the feed
// already holds: its id, its city, its title and words in the reader's
// language, and its places in the curator's order. The form opens on it,
// as from the list's ⋯, and nothing is written until it is saved.
//
// Not for a guest: the feed is drawn for a signed-in reader's crew and
// strangers, and a guest who wants a list is asked to sign in on its own
// page, where the ⋯ and the button both ask. Not for a list with no city
// to file the copy under, as on the list's page (`canCopy`).

import { useCallback } from 'react';
import type { CardCopy } from '../../components/ActivityCard';
import { copyLabel, useCopyState } from '../../components/CopyCount';
import { useSession } from '../../lib/auth';
import type { Collection } from '../../lib/data';
import { useI18n } from '../../lib/i18n';
import { localized } from '../../lib/localized';
import type { Nav } from '../../nav';

/** The places of a list, in the order its curator gave them. */
export const slugsInOrder = (c: Collection): string[] =>
  [...c.collection_places]
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap((m) => (m.places ? [m.places.slug] : []));

/** A card's copy button, or none where a card has none to offer. */
export function useCardCopy(navigation: Nav): (c: Collection) => CardCopy | undefined {
  const { t, lang } = useI18n();
  const { session } = useSession();
  const me = session?.user?.id ?? null;
  const stateOf = useCopyState();
  return useCallback((c: Collection) => {
    if (!me) return undefined;
    const st = stateOf(c);
    if (st.own ? st.n === 0 : !c.city_id) return undefined;
    // The form's facts, made only for a list a copy can be made of.
    const copyFrom = c.city_id ? {
      sourceId: c.id,
      cityId: c.city_id,
      title: localized(c, 'title', lang),
      desc: localized(c, 'desc', lang)?.trim() || '',
      placeSlugs: slugsInOrder(c),
    } : null;
    const onPress = () => {
      if (st.own) navigation.navigate('CollectionActivity', { slug: c.slug });
      else if (st.copy) navigation.navigate('CollectionDetail', { slug: st.copy.slug });
      else navigation.navigate('CollectionForm', { copyFrom: copyFrom ?? undefined });
    };
    return { n: st.n, have: !!st.copy, label: copyLabel(st, t), onPress };
  }, [me, stateOf, navigation, t, lang]);
}
