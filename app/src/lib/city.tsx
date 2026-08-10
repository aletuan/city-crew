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
  // Explore hero, editable from the data desk. All nullable: a missing
  // title/CTA falls back to the app's generic copy, a missing slug to the
  // automatic featured-place photo pick (see ExploreScreen).
  hero_title_en: string | null;
  hero_title_vi: string | null;
  hero_title_ja: string | null;
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
  hero_title_en: null, hero_title_vi: null, hero_title_ja: null,
  hero_cta_en: null, hero_cta_vi: null, hero_cta_ja: null, hero_place_slug: null,
};

const Ctx = createContext<CityContext>({
  city: null, cities: [FALLBACK], mode: 'auto', setCity: () => {}, useMyLocation: async () => {},
});

export const useCity = () => useContext(Ctx);

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestTo(list: City[], lat: number, lng: number): City | null {
  let best: City | null = null;
  let bestD = Infinity;
  for (const c of list) {
    const d = distanceKm(lat, lng, c.center_lat, c.center_lng);
    if (d < bestD) { best = c; bestD = d; }
  }
  return best;
}

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

export function CityProvider({ children }: { children: React.ReactNode }) {
  const [cities, setCities] = useState<City[]>([FALLBACK]);
  const [cityId, setCityId] = useState<string | null>(null);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');

  useEffect(() => {
    let live = true;
    (async () => {
      const [{ data }, storedRaw] = await Promise.all([
        supabase
          .from('cities')
          .select('id, name_en, name_vi, name_ja, short_en, short_vi, short_ja, center_lat, center_lng, hero_title_en, hero_title_vi, hero_title_ja, hero_cta_en, hero_cta_vi, hero_cta_ja, hero_place_slug')
          .eq('is_active', true)
          .order('sort_order'),
        AsyncStorage.getItem(KEY),
      ]);
      if (!live) return;
      const list = (data as City[] | null)?.length ? (data as City[]) : [FALLBACK];
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
