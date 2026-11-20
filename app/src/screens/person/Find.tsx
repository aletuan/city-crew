// Search on a person page: within what this page shows this reader
// (owner, 20 Nov 2026 — docs/profile-home-plan.md §9).
//
// ── what it searches ──
//
// The lists the feed holds (`usePageLists`), so exactly what this reader
// may see — a stranger's public lists, a friend's lists shared with
// them too, all of your own on your own page — and nothing the feed
// would not draw. It answers by each list's own words (titles and
// descriptions, every language), and by the names and cities of the
// places in it: "là việt" finds the list that holds Là Việt Coffee.
//
// Not the whole app: people and a city's places are Explore's and the
// friends screen's to find. And not a new matcher: `siftCollections`
// (lib/search) is the Collections screen's, with its marks rule ("phở"
// is not answered by a "phố") and its order (a list found by its own
// words first, then by how many of its places the words reached). The
// card says why it is there in `reasonFor`'s words, the Collections
// screen's — "Là Việt Coffee · 1 of 4 places" — where it would say
// "4 places".
//
// ── where ──
//
// In the page, not on a page of its own: the box takes the head's place
// over the same feed, narrowed as it is typed, and × puts the head back.
// A screen of its own would be a fourth stack entry to register in three
// stacks, for a feed this page already draws.
//
// Weighed and not taken: the Collections screen's `cityInQuery`, which
// reads a whole query that names a city as that city chosen. Here a city
// typed is matched as words against the places' city names, which is
// the same answer on one person's few lists, without a chip to show it.

import { useDeferredValue, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import SearchField from '../../components/SearchField';
import { useCityList } from '../../lib/city';
import { cityShortById } from '../../lib/cityName';
import { reasonFor } from '../../lib/collectionShelf';
import { membersOf, type Collection, type Place } from '../../lib/data';
import { useI18n } from '../../lib/i18n';
import { siftCollections, type SiftMember } from '../../lib/search';

export type PageFind = ReturnType<typeof usePageFind>;

export function usePageFind(lists: Collection[], places: Place[]) {
  const { t } = useI18n();
  const { cities } = useCityList();
  const [on, setOn] = useState(false);
  const [query, setQuery] = useState('');
  // The feed redraws its cards on every hit list; the box keeps up with
  // the keys and the cards follow.
  const asked = useDeferredValue(query);
  const hits = useMemo(() => siftCollections(
    lists.map((c) => ({
      c,
      members: membersOf(c, places).map((p): SiftMember => ({ ...p, city_name: cityShortById(cities, p.city_id, t) })),
    })),
    { query: asked, city: null, kind: null },
  ), [lists, places, cities, t, asked]);
  const bySlug = new Map(hits.map((h) => [h.c.slug, h]));
  return {
    on,
    query,
    setQuery,
    open: () => setOn(true),
    close: () => { setOn(false); setQuery(''); },
    /** The lists the words find, best first; every list, as the feed
     *  orders them, while nothing is typed. */
    found: hits.map((h) => h.c),
    /** Why a list was found, for its card's line; null for the count. */
    reasonOf: (c: Collection) => reasonFor(bySlug.get(c.slug), [], t),
    /** Something is typed, and nothing answers it. */
    none: asked.trim() !== '' && hits.length === 0,
  };
}

/** The box, in the head's place while searching. */
export function FindField({ find, name }: { find: PageFind; name: string | null }) {
  const { t } = useI18n();
  return (
    <View style={s.row}>
      <SearchField
        value={find.query}
        onChangeText={find.setQuery}
        autoFocus
        // Whose lists, so the box says what it answers: the person's
        // name on somebody else's page, "your" on your own.
        placeholder={name
          ? t(`Search ${name}'s collections`, `Tìm trong bộ sưu tập của ${name}`, `${name}さんのコレクションを検索`, `搜索 ${name} 的合集`, `搜尋 ${name} 的合集`)
          : t('Search your collections', 'Tìm trong bộ sưu tập của bạn', '自分のコレクションを検索', '搜索你的合集', '搜尋你的合集')}
        testID={{ input: 'person-find-input', cancel: 'person-find-cancel' }}
        cancel={{ shown: true, label: t('Cancel', 'Hủy', 'キャンセル', '取消', '取消'), onPress: find.close }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  // The cover's place on the page, under the header.
  row: { marginBottom: 4 },
});
