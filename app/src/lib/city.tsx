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
  useMyLocation: () => Promise<void>;
};

const KEY = 'citycrew.city';
const DEFAULT_CITY_ID = 'hcmc';
/** Bootstrap never waits on location longer than this. */
const GEO_BUDGET_MS = 1200;

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
  city: null, cities: [FALLBACK], mode: 'auto', setCity: () => {}, useMyLocation: async () => {},
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
 */
export function useMyPosition(): { lat: number; lng: number } | null {
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
  }, []);
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

  useEffect(() => {
    let live = true;
    (async () => {
      const [fetched, storedRaw] = await Promise.all([
        fetchCities(),
        AsyncStorage.getItem(KEY),
      ]);
      if (!live) return;
      const list = fetched.length ? fetched : [FALLBACK];
      setCities(list);

      let stored: { id?: string; mode?: 'auto' | 'manual' } = {};
      try { stored = storedRaw ? JSON.parse(storedRaw) : {}; } catch { /* corrupt store */ }
      const storedId = list.some((c) => c.id === stored.id) ? stored.id! : null;

      // A manual pick is the user's word — it wins, no geo involved.
      if (storedId && stored.mode === 'manual') {
        setMode('manual');
        setCityId(storedId);
        return;
      }

      // Auto: one bounded attempt at a cached fix, then commit — the city
      // never changes again on its own after this point.
      const near = await quickNearestCity(list);
      if (!live) return;
      const chosen = near?.id ?? storedId ?? DEFAULT_CITY_ID;
      setMode('auto');
      setCityId(chosen);
      AsyncStorage.setItem(KEY, JSON.stringify({ id: chosen, mode: 'auto' })).catch(() => {});
    })();
    return () => { live = false; };
  }, []);

  const setCity = useCallback((id: string) => {
    setCityId(id);
    setMode('manual');
    AsyncStorage.setItem(KEY, JSON.stringify({ id, mode: 'manual' })).catch(() => {});
  }, []);

  const useMyLocation = useCallback(async () => {
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
    useMyLocation,
  }), [cities, cityId, mode, setCity, useMyLocation]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
