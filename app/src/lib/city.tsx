// City selection: which city's catalog the whole app shows.
//
// The rule that shapes this file: the app never renders one city's
// content and then switches to another. Until the city is resolved,
// `city` stays null and every screen shows its skeleton (data.ts holds
// fetches while city == null). Resolution is fast and happens once:
// a stored manual pick wins outright; otherwise a *cached* location fix
// under a hard time cap picks the nearest city; otherwise the stored
// auto city, else HCMC. After that, only the user can change city —
// via the switcher or "Use my location".

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
// Pure arithmetic, kept where a test runner can reach it.
import { nearestTo } from './geo';
import { openOn, settleOn, shouldCorrect, storedPick } from './citypick';
import { startupTrace } from './trace';

export type City = {
  id: string;
  name_en: string;
  name_vi: string;
  name_ja: string | null;
  short_en: string;
  short_vi: string;
  short_ja: string | null;
  center_lat: number;
  center_lng: number;
  /** How far out the city still counts as itself, in km. The desk sets it
   *  per city (20–25 today) and the import pipeline biases searches by it;
   *  `useMyPosition`'s callers use it to decide whether the reader is
   *  standing in this city at all. */
  radius_km: number;
  // Explore hero, editable from the data desk. All nullable: a missing
  // title/CTA falls back to the app's generic copy, a missing slug to the
  // automatic featured-place photo pick (see ExploreScreen).
  hero_title_en: string | null;
  hero_title_vi: string | null;
  hero_title_ja: string | null;
  hero_sub_en: string | null;
  hero_sub_vi: string | null;
  hero_sub_ja: string | null;
  hero_cta_en: string | null;
  hero_cta_vi: string | null;
  hero_cta_ja: string | null;
  hero_place_slug: string | null;
};

type CityContext = {
  city: City | null;      // null until bootstrap resolves — screens skeleton
  cities: City[];
  mode: 'auto' | 'manual';
  setCity: (id: string) => void;
  /**
   * Locate the reader, switch to the nearest city, and go back to auto.
   *
   * Named `useMyLocation` until the lint gate landed, which is what
   * `rules-of-hooks` caught: a `use`-prefixed function is a hook by React's
   * only convention for saying so, and this one is an async action called
   * from inside an event handler. The rule read the call site as a hook in a
   * callback — a real fault, had it been one — and the honest fix is the
   * name, not a disable comment. The button still reads "Use my location".
   */
  followMyLocation: () => Promise<void>;
};

const KEY = 'citycrew.city';
const DEFAULT_CITY_ID = 'hcmc';
/** Bootstrap never waits on location longer than this. */
const GEO_BUDGET_MS = 1200;

/**
 * Open on the city the last launch chose, instead of waiting to be told
 * where the phone is.
 *
 * The bootstrap below asks the platform for a position before it commits to
 * any city, racing it against `GEO_BUDGET_MS`. Nothing can start until it
 * answers: `usePlacesQuery` and `useCollectionsQuery` hold on a promise that
 * never resolves while `city` is null, so the catalog sits behind a skeleton
 * for up to 1.2 s — every launch, not just the first.
 *
 * On, a remembered choice commits immediately and the location work moves
 * behind it: the catalog starts at once, and the answer only does anything
 * if it names a *different* city. A first launch still waits, because with
 * nothing remembered there is nothing to open on but a guess.
 *
 * ── what it costs, and why it is a switch ──
 *
 * The bootstrap's own rule is that the city never changes on its own after
 * it commits, and this knowingly breaks it in one case: a reader who has
 * moved city since their last launch sees the remembered catalog for a beat
 * and then sees it change. That rule was written when the commit happened
 * *after* the location answer, so there was nothing left to correct.
 *
 * Which of those is worse is a judgement about readers, not about code, so
 * it is a constant rather than an argument. `false` restores the old
 * behaviour exactly — the decisions live in `lib/citypick`, which is tested
 * both ways.
 */
export const RESUME_STORED_CITY = true;

// Offline fallback so the cities *list* is never empty; deliberately not
// used as the initial `city` — first paint must not guess a city.
const FALLBACK: City = {
  id: 'hcmc', name_en: 'Ho Chi Minh City', name_vi: 'TP. Hồ Chí Minh', name_ja: 'ホーチミン市',
  short_en: 'Saigon', short_vi: 'Sài Gòn', short_ja: 'サイゴン', center_lat: 10.7769, center_lng: 106.7009,
  radius_km: 25,
  hero_title_en: null, hero_title_vi: null, hero_title_ja: null,
  hero_sub_en: null, hero_sub_vi: null, hero_sub_ja: null,
  hero_cta_en: null, hero_cta_vi: null, hero_cta_ja: null, hero_place_slug: null,
};

const Ctx = createContext<CityContext>({
  city: null, cities: [FALLBACK], mode: 'auto', setCity: () => {}, followMyLocation: async () => {},
});

export const useCity = () => useContext(Ctx);


/**
 * Fast, bounded location read for bootstrap: cached fix only, no fresh
 * GPS wait, and the whole thing races a hard timeout. Any failure —
 * denied permission, no cached fix, slow bridge — resolves to null.
 */
async function quickNearestCity(list: City[]): Promise<City | null> {
  const attempt = (async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getLastKnownPositionAsync();
    if (!pos) return null;
    return nearestTo(list, pos.coords.latitude, pos.coords.longitude);
  })();
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), GEO_BUDGET_MS));
  return Promise.race([attempt, timeout]).catch(() => null);
}

/** Full-accuracy variant for the explicit "Use my location" action. */
async function preciseNearestCity(list: City[]): Promise<City | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  const pos = (await Location.getLastKnownPositionAsync())
    ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
  if (!pos) return null;
  return nearestTo(list, pos.coords.latitude, pos.coords.longitude);
}

/**
 * Where the reader is, if they have already said we may know.
 *
 * `getForegroundPermissionsAsync` **reads** the permission; it never
 * prompts. That distinction is the whole hook. Bootstrap has already
 * asked once, at launch, so by the time any screen calls this the answer
 * exists — and a screen that only wants to sharpen a label has no
 * business raising the dialog a second time. Denied stays denied and the
 * caller shows nothing rather than something approximate.
 *
 * Cached fix first, then one low-accuracy read for a phone whose cache is
 * cold. Nothing here blocks a render: the position arrives when it
 * arrives, and until then the caller draws what it drew before.
 *
 * `nonce` is for the one caller that may change the answer while it is on
 * screen: the start sheet's locate button, which is allowed to raise the
 * permission dialog. Granting it does nothing on its own — this effect has
 * already run and returned nothing — so that caller bumps the number and
 * the read happens again. Everyone else leaves it alone.
 */
export function useMyPosition(nonce = 0): { lat: number; lng: number } | null {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const p = (await Location.getLastKnownPositionAsync())
          ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
        if (live && p) setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
      } catch { /* no position is a legitimate answer */ }
    })();
    return () => { live = false; };
  }, [nonce]);
  return pos;
}

const CITY_COLS = (withSub: boolean) =>
  `id, name_en, name_vi, name_ja, short_en, short_vi, short_ja, center_lat, center_lng, radius_km, hero_title_en, hero_title_vi, hero_title_ja${withSub ? ', hero_sub_en, hero_sub_vi, hero_sub_ja' : ''}, hero_cta_en, hero_cta_vi, hero_cta_ja, hero_place_slug`;

/**
 * The city list, and a way back when the database is older than the app.
 *
 * Everywhere else in this app a query that names a column the database
 * has not got yet retries without it. This one never did, and it is the
 * worst place to be missing it: a failed select here does not degrade a
 * section, it leaves `cities` as the single hardcoded Saigon row and the
 * switcher with nothing to switch to. The whole app would look like it
 * had one city.
 *
 * `hero_sub_*` is the newest of these columns, so it is the one a client
 * shipping ahead of a migration would trip on.
 */
async function fetchCities(): Promise<City[]> {
  const run = (withSub: boolean) =>
    supabase
      .from('cities')
      .select(CITY_COLS(withSub))
      .eq('is_active', true)
      .order('sort_order');

  let { data, error } = await run(true);
  if (error && error.message.includes('hero_sub')) ({ data, error } = await run(false));
  return (data as City[] | null) ?? [];
}

export function CityProvider({ children }: { children: React.ReactNode }) {
  const [cities, setCities] = useState<City[]>([FALLBACK]);
  const [cityId, setCityId] = useState<string | null>(null);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  // True once the bootstrap fetch came back empty — a phone that opened
  // the app in a tunnel, not a database with one city. Drives the healer
  // below and nothing else.
  const [listFailed, setListFailed] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      // The two arrivals are marked separately on purpose: the store read
      // is local and should cost single-digit milliseconds, the cities
      // fetch is the launch's first round trip — if the gap between these
      // two lines is wide, the network is the story.
      startupTrace.mark('city:bootstrap');
      const [fetched, storedRaw] = await Promise.all([
        fetchCities().then((r) => { startupTrace.mark('city:cities-fetched'); return r; }),
        AsyncStorage.getItem(KEY).then((r) => { startupTrace.mark('city:store-read'); return r; }),
      ]);
      if (!live) return;
      const list = fetched.length ? fetched : [FALLBACK];
      setCities(list);
      setListFailed(!fetched.length);

      let stored: { id?: string; mode?: 'auto' | 'manual' } = {};
      try { stored = storedRaw ? JSON.parse(storedRaw) : {}; } catch { /* corrupt store */ }
      const remembered = storedPick(stored, list.map((c) => c.id));

      // What can be shown before the platform is asked anything. A manual
      // pick always; a remembered automatic one only behind the switch; a
      // first launch never. See `RESUME_STORED_CITY`.
      const opening = openOn(stored, list.map((c) => c.id), RESUME_STORED_CITY);
      if (opening) {
        setMode(opening.mode);
        setCityId(opening.id);
        // The moment the catalog is allowed to start on a remembered city.
        startupTrace.mark('city:committed(stored)');
      }

      // A manual pick is the reader's own word and no position may override
      // it, so there is nothing left to ask.
      if (opening?.mode === 'manual') return;

      // One bounded attempt at a cached fix. Behind an opening city this is
      // no longer on anybody's critical path; without one it still is.
      const near = await quickNearestCity(list);
      // How much of `GEO_BUDGET_MS` this launch actually spent. Behind a
      // stored commit the gap is off the critical path; on a first launch
      // it is the critical path.
      startupTrace.mark('city:geo-answered');
      if (!live) return;

      if (opening) {
        // The common case is that it agrees, and agreement must cost
        // nothing: no state change, so no refetch of a catalog already on
        // screen.
        if (!shouldCorrect(opening, near?.id ?? null)) return;
        setCityId(near!.id);
        AsyncStorage.setItem(KEY, JSON.stringify({ id: near!.id, mode: 'auto' })).catch(() => {});
        return;
      }

      const chosen = settleOn(near?.id ?? null, remembered, DEFAULT_CITY_ID);
      setMode('auto');
      setCityId(chosen);
      // The first-launch commit — everything the screens show waits on this.
      startupTrace.mark('city:committed');
      AsyncStorage.setItem(KEY, JSON.stringify({ id: chosen, mode: 'auto' })).catch(() => {});
    })();
    return () => { live = false; };
  }, []);

  /**
   * The list, healed.
   *
   * The bootstrap fetch runs once, and the comment on `fetchCities` names
   * the stakes: a select that fails here does not degrade a section, it
   * leaves the whole app looking like it has one city. The column-drift
   * case was handled; the ordinary one — no network at cold start — was
   * not, and a reader who opened the app in a lift kept the one-row
   * fallback list for the entire session. Their switcher held a single
   * city, with two more sitting active in the database.
   *
   * So a failed bootstrap keeps asking, quietly, until it is answered.
   * Only the *list* heals: the city already chosen stays chosen, because
   * the bootstrap's own rule is that the city never changes on its own
   * after commit — the reader gets their three rows back and taps if they
   * meant somewhere else. Fifteen seconds is slow enough to cost nothing
   * and fast enough that the list is usually whole before anyone opens
   * the switcher to look.
   */
  useEffect(() => {
    if (!listFailed) return;
    let live = true;
    const id = setInterval(async () => {
      const fetched = await fetchCities();
      if (!live || !fetched.length) return;
      setCities(fetched);
      setListFailed(false);
    }, 15_000);
    return () => { live = false; clearInterval(id); };
  }, [listFailed]);

  const setCity = useCallback((id: string) => {
    setCityId(id);
    setMode('manual');
    AsyncStorage.setItem(KEY, JSON.stringify({ id, mode: 'manual' })).catch(() => {});
  }, []);

  const followMyLocation = useCallback(async () => {
    const near = await preciseNearestCity(cities);
    if (!near) return;
    setCityId(near.id);
    setMode('auto');
    await AsyncStorage.setItem(KEY, JSON.stringify({ id: near.id, mode: 'auto' })).catch(() => {});
  }, [cities]);

  const value = useMemo<CityContext>(() => ({
    city: cityId ? cities.find((c) => c.id === cityId) ?? null : null,
    cities,
    mode,
    setCity,
    followMyLocation,
  }), [cities, cityId, mode, setCity, followMyLocation]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
