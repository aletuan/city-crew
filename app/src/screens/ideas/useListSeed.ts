// Out of `IdeasScreen` on 25 Nov 2026, so the screen's function fits the
// ceiling (`oversize.js`); the reasoning moved with the code, unchanged.

import React, { useEffect, useRef, useState } from 'react';
import { type SheetAction } from '../../components/ActionSheet';
import { cityShort } from '../../lib/cityName';
import { type City, useCity } from '../../lib/city';
import { type Collection, membersOf, type Place } from '../../lib/data';
import { useI18n } from '../../lib/i18n';
import type { TripDraft } from '../../lib/trip';

export function useListSeed({ from, at, mine, cols, places, setDraft, setMore }: {
  from: string | undefined;
  at: number;
  mine: Collection[];
  cols: Collection[];
  places: Place[];
  setDraft: React.Dispatch<React.SetStateAction<TripDraft>>;
  setMore: (on: boolean) => void;
}) {
  const { t } = useI18n();
  const { city, cities, setCity } = useCity();
  /**
   * A collection sent here to start from — the detail screen's "Plan a
   * trip" (`IdeasHome.from`).
   *
   * Ticked on arrival, and the lists opened so the tick is in view. The
   * city is the question: the seeds only count places in the app's city
   * (`inCity`), so a list from elsewhere would arrive ticked and seed
   * nothing. Three cases, the start sheet's rule applied to a list. A
   * list with a place here is ticked and nothing moves. A list whose
   * places are all in one other catalog city switches the app there —
   * the reader just chose that list, and a plan of it is what they asked
   * for — and the well under the heading says so. A list across several
   * catalog cities with none here is asked about, one row per city with
   * its count, since choosing for the reader would be guessing which
   * half of their list they meant.
   *
   * Keyed on `at`, so the same list sent twice is applied twice and a
   * re-render is not; waits for the catalog, since a list read from the
   * launch cache may arrive before its places do.
   */
  const [asking, setAsking] = useState<{ slug: string; choices: { id: string; n: number }[] } | null>(null);
  const [moved, setMoved] = useState<City | null>(null);
  const applied = useRef<number | null>(null);
  const cityName = (c: City) => cityShort(c, t);
  const tick = (slug: string) => {
    setDraft((d) => (d.from.includes(slug) ? d : { ...d, from: [...d.from, slug] }));
    setMore(true);
  };
  const follow = (slug: string, to: City) => {
    setCity(to.id);
    setMoved(to);
    tick(slug);
  };
  useEffect(() => {
    if (!from || applied.current === at) return;
    const c = [...mine, ...cols].find((x) => x.slug === from);
    if (!c || places.length === 0) return;
    applied.current = at;
    const all = membersOf(c, places);
    if (!city || all.some((p) => p.city_id === city.id)) { tick(from); return; }
    const count = new Map<string, number>();
    all.forEach((p) => {
      const id = p.city_id;
      if (id && cities.some((x) => x.id === id)) count.set(id, (count.get(id) ?? 0) + 1);
    });
    const choices = [...count].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n);
    if (choices.length === 0) return;
    if (choices.length === 1) {
      const to = cities.find((x) => x.id === choices[0].id);
      if (to) follow(from, to);
      return;
    }
    setAsking({ slug: from, choices });
  // `tick`, `follow` and `cityName` close over state that is listed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, at, mine, cols, places, city?.id, cities]);
  const askActions: SheetAction[] = asking
    ? asking.choices.flatMap(({ id, n }) => {
      const to = cities.find((x) => x.id === id);
      return to ? [{
        key: id,
        icon: 'location-outline' as const,
        title: cityName(to),
        desc: t(
          `${n} ${n === 1 ? 'place' : 'places'} from this collection will be included`,
          `${n} địa điểm của bộ sưu tập sẽ được đưa vào`,
          `このコレクションから${n}件が含まれます`,
          `将包含这个合集中的 ${n} 个地点`, `將包含這個合集中的 ${n} 個地點`,
        ),
        onPress: () => { setAsking(null); follow(asking.slug, to); },
      }] : [];
    })
    : [];
  return { asking, close: () => setAsking(null), askActions, moved, cityName };
}
