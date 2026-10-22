// What the Search screen lists, as a function of what it has.
//
// The screen gathers the parts — the remembered searches, the ranked
// sections, the catalog's hits, Google's candidates — through hooks, and
// what it shows is this: which sections appear, in what order, under
// which heading, and which never mix. That ordering is where the screen's
// decisions are (results never share a list with the zero-state; the
// synonym tier only fills a blank; Google's rows sit under their own
// heading), and none of it needs a renderer to be checked.
//
// The screen still memoises the call: unmemoised, this would walk the
// whole catalog on every render, which is the one thing that screen is
// built not to do.

import { coverUriOf, touchesCity } from './place';
import { RECENTS_SHOWN } from './recents';
import { collectionMatches, findPlaces, type TermMap } from './search';
import { byCity } from './searchCities';
import type { Candidate } from './suggest';
import type { Collection, Place } from './types';

export type SearchRow =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'collection'; key: string; collection: Collection; count: number; cover?: string }
  | { kind: 'place'; key: string; place: Place }
  | { kind: 'candidate'; key: string; candidate: Candidate }
  // The zero-state — what the screen offers before anyone has typed.
  // Small-caps section marks (`eyebrow`), the remembered searches, one
  // row of category chips, and the ranked "most popular" places.
  | { kind: 'eyebrow'; key: string; label: string; clear?: boolean }
  | { kind: 'recent'; key: string; term: string }
  | { kind: 'chips'; key: string }
  | { kind: 'popular'; key: string; place: Place }
  // Same row, different question: 'popular' answers "what is good
  // here", 'latest' answers "what just landed". A separate kind rather
  // than a reused one so a place in both sections keys twice without a
  // collision, and so the two lists can ever diverge in rendering
  // without an archaeology dig.
  | { kind: 'latest'; key: string; place: Place };

export type SearchRowsInput = {
  /** `queryTerms(query)` — empty means the zero-state. */
  terms: readonly string[];
  query: string;
  recents: readonly string[];
  /** The categories the Browse chips offer; the section is skipped when
   *  there are none. */
  cats: readonly string[];
  popular: readonly Place[];
  latest: readonly Place[];
  /** Every list with its members resolved, once per catalog. */
  colMembers: readonly { c: Collection; members: Place[] }[];
  /** The places a match is looked for in: the chosen cities' only. */
  places: Place[];
  /** The cities chosen (`lib/searchCities`), or null for every city and
   *  for none known yet. */
  cities: readonly string[] | null;
  /** The cities in the chips' order, the reader's own first: the places
   *  found are listed city by city in it (`byCity`). Null leaves the
   *  match's own ranking alone. */
  cityOrder?: readonly string[] | null;
  /** Google's candidates not already in the catalog, or null before any. */
  fresh: readonly Candidate[] | null;
  synonyms: TermMap;
};

export function buildSearchRows(
  { terms, query, recents, cats, popular, latest, colMembers, places, cities, cityOrder = null, fresh, synonyms }: SearchRowsInput,
  t: (en: string, vi: string, ja: string, zh?: string, hant?: string) => string,
): SearchRow[] {
  // Before a word is typed the list is the zero-state: the searches
  // this box remembers, the taxonomy to browse, and the places the
  // ranking calls most popular. The moment a term exists, all of it
  // yields to results — the sections below never mix with them.
  if (terms.length === 0) {
    const out: SearchRow[] = [];
    if (recents.length) {
      out.push({ kind: 'eyebrow', key: 'z-recent', label: t('Recent', 'Gần đây', '最近', '最近', '最近'), clear: true });
      for (const term of recents.slice(0, RECENTS_SHOWN)) {
        out.push({ kind: 'recent', key: `rc-${term}`, term });
      }
    }
    if (cats.length) {
      out.push({ kind: 'eyebrow', key: 'z-browse', label: t('Browse', 'Duyệt theo', 'カテゴリー', '分类', '分類') });
      out.push({ kind: 'chips', key: 'z-chips' });
    }
    // There was an "Open right now" section here, between these two,
    // the reference's question of where one can walk into this minute.
    // The owner took it out (22 Oct 2026): Explore asks the same question
    // in its filter, "Đang mở cửa", and answered it with the same ranking
    // (`bestFirst`), so the two lists were one list in two places. Search
    // is for finding a place one can name; walking the city as it is
    // right now is Explore's, where the map is.
    if (popular.length) {
      out.push({ kind: 'eyebrow', key: 'z-popular', label: t('Most popular', 'Phổ biến nhất', '人気スポット', '最受欢迎', '最受歡迎') });
      for (const pl of popular) out.push({ kind: 'popular', key: `mp-${pl.slug}`, place: pl });
    }
    if (latest.length) {
      out.push({ kind: 'eyebrow', key: 'z-latest', label: t('Recently added', 'Mới thêm gần đây', '新着スポット', '最新添加', '最新新增') });
      for (const pl of latest) out.push({ kind: 'latest', key: `la-${pl.slug}`, place: pl });
    }
    return out;
  }
  const out: SearchRow[] = [];

  // Same city test as the shelf and the tab, for each city chosen. The
  // public query is no longer scoped to a city — a list appears wherever
  // it has a place — so without this, searching in Hanoi would turn up
  // lists that are entirely in Saigon. A list with a place in any chosen
  // city answers, since the places it would show are the chosen cities'.
  const touches = (members: Place[]) => (cities ? cities.some((id) => touchesCity(members, id)) : touchesCity(members, null));
  const foundCols = colMembers
    // `collectionMatches`, so a list answers by the places inside it
    // too: "mono coffee" finds the café *and* the lists that hold it —
    // the second half of the answer this screen used to leave out.
    .filter(({ c, members }) => touches(members) && collectionMatches(c, members, terms));
  if (foundCols.length) {
    out.push({ kind: 'header', key: 'h-col', label: t('Collections', 'Bộ sưu tập', 'コレクション', '合集', '合集') });
    for (const { c, members } of foundCols) {
      out.push({
        kind: 'collection',
        key: `c-${c.slug}`,
        collection: c,
        count: members.length,
        cover: coverUriOf(c, members),
      });
    }
  }

  // Two tiers, and the second only ever appears when the first is empty:
  // a synonym is a guess about what somebody meant, so it fills a blank
  // screen rather than diluting a real answer. See `findPlaces`.
  const found = findPlaces(places, query, synonyms);
  const hits = cityOrder ? byCity(found.hits, cityOrder) : found.hits;
  const related = cityOrder ? byCity(found.related, cityOrder) : found.related;
  if (hits.length) {
    out.push({ kind: 'header', key: 'h-place', label: t('Places', 'Địa điểm', 'スポット', '地点', '地點') });
    for (const p of hits) out.push({ kind: 'place', key: `p-${p.slug}`, place: p });
  }
  // Labelled as the guess it is. "bowling" reaching a cinema is only
  // wrong when the screen calls it a match — under this heading it is
  // the app saying "not that, but this is the nearest kind we have".
  if (related.length) {
    out.push({
      kind: 'header',
      key: 'h-related',
      label: t(
        'No exact match — related places',
        'Không khớp chính xác — chỗ tương tự',
        '完全一致なし — 近いスポット',
        '没有完全匹配 — 相关地点', '沒有完全符合 — 相關地點',
      ),
    });
    for (const p of related) out.push({ kind: 'place', key: `r-${p.slug}`, place: p });
  }

  // Under its own heading, never mixed in. The rows above open a place;
  // these ones propose one that does not exist yet. Two rows that look
  // alike and do different things on tap is the confusion a heading
  // costs one line to prevent.
  if (fresh?.length) {
    out.push({
      kind: 'header',
      key: 'h-google',
      label: t('On Google Maps', 'Trên Google Maps', 'Google マップ上', 'Google 地图上', 'Google 地圖上'),
    });
    for (const c of fresh) out.push({ kind: 'candidate', key: `g-${c.place_id}`, candidate: c });
  }
  return out;
}
