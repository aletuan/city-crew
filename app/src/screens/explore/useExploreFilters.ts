// What Explore shows: the kind chosen, the filters applied, the order,
// the reader's position, the place picked on the map, and the map's
// quick filters with what they just did.
//
// Out of `ExploreScreen` on 25 Nov 2026, as the screens of the 22 Nov code
// review were (F1, F5): the reasoning moved with the code, unchanged.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import type { ToastNote } from '../../components/Toast';
import { categoriesOf, presentCategories } from '../../lib/categories';
import type { useCity } from '../../lib/city';
import { cityTz } from '../../lib/clock';
import { countsByCity } from '../../lib/cityCounts';
import type { Place, PlaceIndexRow } from '../../lib/data';
import { filterExplorePlaces, type ExploreFilters, type ExploreOrigin } from '../../lib/exploreFilters';
import { cycleStatus } from '../../lib/exploreView';
import { distanceKm } from '../../lib/geo';
import type { useI18n } from '../../lib/i18n';
import { useMyCheckins } from '../../lib/checkins';
import { bestFirst } from '../../lib/rank';
import { useSavedSlugs, type useSaveActions } from '../../lib/save';
import { useBrowseTaste } from '../../lib/tasteProfile';
import { useMapDeck } from './useMapDeck';

export function useExploreFilters({ t, places, city, cities, signedIn, askToSignIn }: {
  t: ReturnType<typeof useI18n>['t'];
  places: Place[];
  city: ReturnType<typeof useCity>['city'];
  cities: ReturnType<typeof useCity>['cities'];
  signedIn: boolean;
  askToSignIn: ReturnType<typeof useSaveActions>['askToSignIn'];
}) {
  // ── the kinds: one at a time, and none is everything ──
  //
  // With none chosen the list is the whole city; a kind tapped narrows to
  // it, another moves to that one, and the chosen one tapped again lets
  // go. There was an "All" chip until 15 Oct 2026: it meant "no chip", and
  // a tap on it was the only way to leave a choice. From then until 24 Oct
  // any number could be chosen, a place showing if it carried any of
  // them; the owner took multiple choice out of every filter in the app
  // that day. A list rather than one key because the map, the cards and
  // the city switch below all read a list of chosen kinds.
  const [picked, setPicked] = useState<string[]>([]);
  // Null is "All" (owner, 25 Oct 2026: back, now that the row has room).
  const pick = (c: string | null) => setPicked((p) => (c === null || p.includes(c) ? [] : [c]));
  const [filterOpen, setFilterOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<ExploreFilters>({
    sort: 'recommended', status: 'any', savedOnly: false, visitedOnly: false,
  });
  // The reader's visits, for the fourth filter. A set of slugs rather
  // than the rows: the rule asks "was I here" per place, and a guest's
  // list is empty, which is the right answer for a guest.
  const visits = useMyCheckins();
  const visitedSlugs = useMemo(() => new Set(visits.data.map((v) => v.place_slug)), [visits.data]);
  const isVisited = useCallback((slug: string) => visitedSlugs.has(slug), [visitedSlugs]);
  // The saved set only while something here asks it: the saved-only filter
  // applied, or the filter sheet open and counting it. Otherwise an empty
  // set that never moves, so a bookmark tapped on a card does not refilter
  // the city (owner, 30 Oct 2026) — the card redraws its own fill alone.
  const savedSlugs = useSavedSlugs(appliedFilters.savedOnly || filterOpen);
  const isSaved = useCallback((slug: string) => savedSlugs.has(slug), [savedSlugs]);
  const [sortOrigin, setSortOrigin] = useState<ExploreOrigin | null>(null);

  // Every city's places, in the four columns the filters read.
  //
  // A name alone says a city exists; the number is what makes going there
  // a decision. And the number has to be under the same filters as the
  // one here, or the picture lies: "Cafés" narrowing this city to 89
  // beside another city's untouched total of 280 invites exactly the
  // comparison the reader should not make. Asked once, on entering the
  // map; a call that never answers leaves the markers with their names
  // and no numbers.
  const [cityIndex, setCityIndex] = useState<PlaceIndexRow[]>([]);

  // The cities this reader is not in. Named in their language and placed
  // at their centre; the map draws them only where the view is wide
  // enough to reach them, which is exactly when they are worth drawing.
  const elsewhere = useMemo(() => {
    // The same rule the list is filtered by, over every city's rows — so
    // the figure on a marker there and the figure on the marker here are
    // the same kind of thing.
    const counts = cityIndex.length
      ? countsByCity(cityIndex, {
        categories: picked,
        status: appliedFilters.status,
        window: appliedFilters.window,
        savedOnly: appliedFilters.savedOnly,
        isSaved,
        visitedOnly: appliedFilters.visitedOnly,
        isVisited,
        now: new Date(),
        // Every city's rows are counted, each on its own clock.
        tz: (id) => cityTz(cities, id),
      })
      : null;
    return cities
      .filter((c) => c.id !== city?.id)
      .map((c) => ({
        id: c.id,
        name: t(c.short_en, c.short_vi, c.short_ja),
        // Absent while the index has not arrived; zero once it has and
        // nothing there survives the filters, which is worth saying.
        count: counts ? counts[c.id] ?? 0 : null,
        lat: c.center_lat,
        lng: c.center_lng,
      }));
  }, [cities, city?.id, cityIndex, picked, appliedFilters.status, appliedFilters.window, appliedFilters.savedOnly, isSaved, appliedFilters.visitedOnly, isVisited, t]);
  // Only categories this city actually has, so a chip never leads to an
  // empty list. Order comes from the taxonomy, not from the data.
  const cats = useMemo(() => presentCategories(places), [places]);

  // Switching city can retire a chosen chip — let go of it, keep the rest,
  // rather than leave the screen narrowed by a kind no chip can show.
  useEffect(() => {
    if (places.length > 0 && picked.some((c) => !cats.includes(c))) setPicked((p) => p.filter((c) => cats.includes(c)));
  }, [cats, picked, places.length]);

  /**
   * What this reader leans towards, or null — the same hook Search uses,
   * and deliberately not the planner's. See `useBrowseTaste`.
   */
  const taste = useBrowseTaste();

  /**
   * The list, in an order for the first time.
   *
   * It had none. The query asks for `sort_order` and every published row
   * in every city has that column null, so Postgres was free to return
   * them however the plan happened to — an order nobody chose and nothing
   * promises to repeat. The desk's sequence this was thought to be does
   * not exist, which is why replacing it costs nothing.
   *
   * `bestFirst` is what Search's open-now list used, until that list went
   * as a copy of this one (22 Oct 2026): rating down the column, taste
   * worth one standard deviation of it, and `slug` as the final tie so
   * two renders of the same screen agree.
   * Signed out, `taste` is null and this is the plain rating order — a
   * deterministic list where there was an arbitrary one.
   *
   * The category filter runs first. Ranking either side of it gives the
   * same order within a chip; filtering first just ranks fewer places.
   */
  const recommended = useMemo(() => {
    const inCat = picked.length ? places.filter((p) => categoriesOf(p).some((c) => picked.includes(c))) : places;
    return bestFirst(inCat, taste);
  }, [places, picked, taste]);

  const filteredFor = useCallback((next: ExploreFilters) => filterExplorePlaces(recommended, {
    ...next,
    // Category already ran before recommendation ranking, preserving the
    // feed's existing order exactly when the new controls are untouched.
    categories: [],
    origin: sortOrigin,
    isSaved,
    isVisited,
    now: new Date(),
    tz: (id) => cityTz(cities, id),
  }), [recommended, sortOrigin, isSaved, isVisited, cities]);

  const shown = useMemo(() => filteredFor(appliedFilters), [filteredFor, appliedFilters]);

  // The map's own selection — the pin the reader has tapped, and the
  // strip that stands for it. If a chip or a sort takes the selected place
  // out of `shown`, `find` below returns null and the strip sinks away;
  // as it goes it clears the choice too (`MapStrip` › `onGone`), so the
  // place does not come back with "All" once the reader has moved on.
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const selected = useMemo(() => shown.find((p) => p.slug === selectedSlug) ?? null, [shown, selectedSlug]);
  const { pickPin, deckPlaces } = useMapDeck(shown, selectedSlug, setSelectedSlug);
  const selectedKm = selected && sortOrigin && selected.lat != null && selected.lng != null
    ? distanceKm(sortOrigin.lat, sortOrigin.lng, selected.lat, selected.lng)
    : null;

  /**
   * The reader's position, or the reason there is none.
   *
   * One function for the two callers that want a fix — the distance sort
   * and the map — so the permission dance is asked once, in one place,
   * and a refusal is one string rather than two.
   */
  const locate = useCallback(async (): Promise<{ origin: ExploreOrigin } | { refused: string }> => {
    const held = await Location.getForegroundPermissionsAsync();
    const permission = held.status === 'granted'
      ? held
      : await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      return { refused: t(
        'Allow location access to sort places by distance.',
        'Hãy cho phép truy cập vị trí để sắp xếp địa điểm theo khoảng cách.',
        '距離順に並べるには位置情報を許可してください。',
        '允许访问位置信息后，才能按距离排序。', '允許存取位置資訊後，才能按距離排序。',
      ) };
    }
    const position = await Location.getLastKnownPositionAsync()
      ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }).catch(() => null);
    if (!position) {
      return { refused: t(
        "Couldn't read your location. Try again in a moment.",
        'Không thể xác định vị trí của bạn. Hãy thử lại sau giây lát.',
        '位置情報を取得できませんでした。しばらくしてからもう一度お試しください。',
        '无法获取你的位置，请稍后再试。', '無法取得你的位置，請稍後再試。',
      ) };
    }
    const origin = { lat: position.coords.latitude, lng: position.coords.longitude };
    setSortOrigin(origin);
    return { origin };
  }, [t]);

  const applyFilters = useCallback(async (next: ExploreFilters): Promise<string | null> => {
    if (next.sort === 'distance' && !sortOrigin) {
      const fix = await locate();
      if ('refused' in fix) return fix.refused;
    }
    setAppliedFilters(next);
    setFilterOpen(false);
    return null;
  }, [sortOrigin, locate]);

  const filterCount = (appliedFilters.sort === 'recommended' ? 0 : 1)
    + (appliedFilters.status === 'any' ? 0 : 1)
    + (appliedFilters.savedOnly ? 1 : 0)
    + (appliedFilters.visitedOnly ? 1 : 0);

  /**
   * What a quick filter on the map just did, said for two seconds.
   *
   * The discs change only their glyph's colour when they switch, and on
   * a busy map that is not enough to tell on from off — the owner could
   * not, from two screenshots side by side. The toast answers the
   * question at the moment it is asked. See `Toast` for why it is a
   * report and not a state.
   *
   * One plain sentence, and no count. It said "Open now · 12 places",
   * which is two answers where the question was one, and the owner asked
   * for the plainer "only showing places open now". Switching off is said
   * as the filter going, not as "all places": the other disc, and the
   * category chips, may well still be narrowing the map.
   */
  const [note, setNote] = useState<ToastNote | null>(null);
  const say = (text: string) => setNote((prev) => ({ id: (prev?.id ?? 0) + 1, text }));
  const pickStatus = () => {
    const next = cycleStatus(appliedFilters.status);
    setAppliedFilters({ ...appliedFilters, status: next });
    say(next === 'open'
      ? t('Showing only places open now.', 'Chỉ hiện những điểm đang mở.', '営業中のスポットのみ表示します。', '仅显示正在营业的地点。', '僅顯示正在營業的地點。')
      : next === 'closed'
        ? t('Showing only places closed now.', 'Chỉ hiện những điểm đã đóng cửa.', '営業時間外のスポットのみ表示します。', '仅显示当前已打烊的地点。', '僅顯示目前已打烊的地點。')
        : t('Opening-hours filter off.', 'Bỏ lọc theo giờ mở cửa.', '営業時間の絞り込みを解除しました。', '已取消营业时间筛选。', '已取消營業時間篩選。'));
  };
  const pickSavedRef = useRef<() => void>(() => {});
  const pickSaved = () => {
    // A guest's filter is off, so the act finished on their return can
    // only turn it on. Through the ref, for the render that knows they
    // are signed in — see `lib/resume`.
    if (!signedIn) { askToSignIn('saved', () => pickSavedRef.current()); return; }
    const on = !appliedFilters.savedOnly;
    setAppliedFilters({ ...appliedFilters, savedOnly: on });
    say(on
      ? t('Showing only places you saved.', 'Chỉ hiện những điểm lưu lại.', '保存したスポットのみ表示します。', '仅显示你保存的地点。', '僅顯示你儲存的地點。')
      : t('Saved-places filter off.', 'Bỏ lọc theo điểm đã lưu.', '保存済みの絞り込みを解除しました。', '已取消已保存筛选。', '已取消已儲存篩選。'));
  };
  pickSavedRef.current = pickSaved;
  // The sheet's Visited row, as a cell: same door for a guest, same
  // reason ('saved' — see the sheet's `onNeedSignIn`), same resume.
  const pickVisitedRef = useRef<() => void>(() => {});
  const pickVisited = () => {
    if (!signedIn) { askToSignIn('saved', () => pickVisitedRef.current()); return; }
    const on = !appliedFilters.visitedOnly;
    setAppliedFilters({ ...appliedFilters, visitedOnly: on });
    say(on
      ? t('Showing only places you checked in at.', 'Chỉ hiện những điểm đã check-in.', 'チェックインしたスポットのみ表示します。', '仅显示你打过卡的地点。', '僅顯示你打過卡的地點。')
      : t('Visited-places filter off.', 'Bỏ lọc theo điểm đã check-in.', '訪問済みの絞り込みを解除しました。', '已取消已打卡筛选。', '已取消已打卡篩選。'));
  };
  pickVisitedRef.current = pickVisited;

  return {
    picked, pick, filterOpen, setFilterOpen, appliedFilters, sortOrigin, setCityIndex, elsewhere, cats,
    filteredFor, shown, selectedSlug, setSelectedSlug, pickPin, deckPlaces, selected, selectedKm, locate, applyFilters, filterCount,
    note, say, pickStatus, pickSaved, pickVisited,
  };
}

export type ExploreFiltering = ReturnType<typeof useExploreFilters>;
