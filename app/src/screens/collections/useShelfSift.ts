// What the shelf shows for what is asked: the lists of the open tab, each
// with its members, sifted by the words, the city typed whole and the
// kind, and the counts the kinds row prints.
//
// Out of CollectionsScreen since 24 Nov 2026. It is the screen's arithmetic
// and reads nothing of the screen but its inputs, which are named below.
// The lines were moved, not retyped.
import { useCallback, useMemo } from 'react';
import { categoryLabel } from '../../lib/categories';
import { reasonFor as shelfReason } from '../../lib/collectionShelf';
import { type Collection, membersOf, type Place } from '../../lib/data';
import type { City } from '../../lib/city';
import type { useI18n } from '../../lib/i18n';
import { cityInQuery, collectionKinds, siftCollections, type SiftMember } from '../../lib/search';

export function useShelfSift({ onYours, mine, shared, community, cols, me, places, cities, cityName, q, kind, t }: {
  onYours: boolean;
  mine: { data: Collection[] };
  shared: { data: Collection[] };
  community: Collection[];
  cols: { data: Collection[] };
  me: string | undefined;
  places: Place[];
  cities: City[];
  cityName: (id: string | null | undefined) => string;
  q: string;
  kind: string | null;
  t: ReturnType<typeof useI18n>['t'];
}) {
  // Every member with the words a reader types for its city — the sift
  // matches "da nang" against a member's city as it does against its
  // name. Built once per catalog, not per keystroke.
  const pairOf = useCallback((c: Collection): { c: Collection; members: SiftMember[] } => ({
    c,
    members: membersOf(c, places).map((p): SiftMember => ({ ...p, city_name: cityName(p.city_id) })),
  }), [places, cityName]);
  // Yours is your own lists and then the ones shared with you, sifted as
  // one shelf so a search and a kind reach both, and split again into
  // their two sections (`sections`). Kept whole, an empty shared list
  // included, where Community drops its empty ones: a list somebody gave
  // you is not a dead end at the desk, and one missing would read as a
  // share that never arrived.
  const shelf = useMemo(
    () => (onYours ? [...mine.data, ...shared.data] : community).map(pairOf),
    // `community` is derived from `cols.data`, `me` and `places`, all listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onYours, mine.data, shared.data, cols.data, me, places, pairOf],
  );
  const sharedSlugs = useMemo(() => new Set(shared.data.map((c) => c.slug)), [shared.data]);
  // The kinds a shelf can offer: only what its lists actually hold, so no
  // kind leads to an empty shelf.
  const kindChoices = useMemo(() => collectionKinds(shelf), [shelf]);
  const asked = !!(q || kind);
  // A city typed whole is a city chosen (owner, 7 Nov 2026): "Đà Lạt" lists
  // the lists with a place there, not every list whose words begin "da"
  // and "lat" somewhere — "After Dark … until late" came back for it. It
  // stands in for the city filter that went the same day; anything more
  // or less than a city's name stays words.
  const cityAsked = useMemo(
    () => cityInQuery(q, cities.map((c) => ({ id: c.id, names: [c.short_en, c.short_vi, c.short_ja, c.name_en, c.name_vi, c.name_ja] }))),
    [q, cities],
  );
  const words = cityAsked ? '' : q;

  const hits = useMemo(
    () => siftCollections(shelf, { query: words, city: cityAsked, kind }),
    [shelf, words, cityAsked, kind],
  );
  const hitBy = useMemo(() => new Map(hits.map((h) => [h.c.slug, h])), [hits]);
  // The chips' own labels, as the cards' reasons print them. The words themselves are `lib/collectionShelf`'s.
  const chosen = [
    kind ? categoryLabel(kind, t) : null,
    cityAsked ? cityName(cityAsked) : null,
  ].filter((x): x is string => !!x);
  // Each kind's row figure: the lists the words so far would leave with
  // that kind chosen, so a kind that would empty the shelf says 0 and is
  // drawn off rather than hidden.
  const kindCounts = useMemo(
    () => new Map(kindChoices.map((k) => [k, siftCollections(shelf, { query: words, city: cityAsked, kind: k }).length])),
    [shelf, words, cityAsked, kindChoices],
  );
  const wordsCount = useMemo(() => siftCollections(shelf, { query: words, city: cityAsked, kind: null }).length, [shelf, words, cityAsked]);
  const reasonFor = (slug: string) => shelfReason(hitBy.get(slug), chosen, t);
  // The shelf, as the sift ordered it — the catalog's own order, newest
  // first, when nothing is asked; lists found by their own words first
  // and then by hits when it is. Community at rest is not shown in this
  // order: the Mosaic ranks each city's block (`groups`) and the grid is
  // ranked whole (`sections`).
  // Memoised with `hits`: the city blocks and the sections are built from
  // it, and a new array every render rebuilt them every render — see the
  // freeze noted at `onSeen`.
  const sifted = useMemo(() => hits.map((h) => h.c), [hits]);

  return { sharedSlugs, kindChoices, asked, kindCounts, wordsCount, reasonFor, sifted };
}
