// City selection: which city's catalog the whole app shows.
//
// Default is automatic — one coarse location read resolves the nearest
// supported city (e.g. you land in Hanoi, the app shows Hanoi). A manual
// pick (e.g. browsing Saigon before a trip) persists and overrides geo
// until "Use my location" re-enables auto. Permission denied / no fix →
// last stored city, else HCMC.

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
};

type CityContext = {
  city: City | null;      // null only during first bootstrap
  cities: City[];
  mode: 'auto' | 'manual';
  setCity: (id: string) => void;
  useMyLocation: () => Promise<void>;
};

const KEY = 'citycrew.city';
const DEFAULT_CITY_ID = 'hcmc';

// Offline / first-paint fallback so the UI never renders city-less.
const FALLBACK: City = {
  id: 'hcmc', name_en: 'Ho Chi Minh City', name_vi: 'TP. Hồ Chí Minh', name_ja: 'ホーチミン市',
  short_en: 'Saigon', short_vi: 'Sài Gòn', short_ja: 'サイゴン', center_lat: 10.7769, center_lng: 106.7009,
};

const Ctx = createContext<CityContext>({
  city: FALLBACK, cities: [FALLBACK], mode: 'auto', setCity: () => {}, useMyLocation: async () => {},
});

export const useCity = () => useContext(Ctx);

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Nearest supported city to the device, or null when location is unavailable. */
async function nearestCity(list: City[]): Promise<City | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  const pos = (await Location.getLastKnownPositionAsync())
    ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
  if (!pos) return null;
  let best: City | null = null;
  let bestD = Infinity;
  for (const c of list) {
    const d = distanceKm(pos.coords.latitude, pos.coords.longitude, c.center_lat, c.center_lng);
    if (d < bestD) { best = c; bestD = d; }
  }
  return best;
}

export function CityProvider({ children }: { children: React.ReactNode }) {
  const [cities, setCities] = useState<City[]>([FALLBACK]);
  const [cityId, setCityId] = useState<string>(DEFAULT_CITY_ID);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');

  useEffect(() => {
    let live = true;
    (async () => {
      const [{ data }, storedRaw] = await Promise.all([
        supabase
          .from('cities')
          .select('id, name_en, name_vi, name_ja, short_en, short_vi, short_ja, center_lat, center_lng')
          .eq('is_active', true)
          .order('sort_order'),
        AsyncStorage.getItem(KEY),
      ]);
      if (!live) return;
      const list = (data as City[] | null)?.length ? (data as City[]) : [FALLBACK];
      setCities(list);

      let stored: { id?: string; mode?: 'auto' | 'manual' } = {};
      try { stored = storedRaw ? JSON.parse(storedRaw) : {}; } catch { /* corrupt store */ }
      const storedMode = stored.mode === 'manual' ? 'manual' : 'auto';
      if (list.some((c) => c.id === stored.id)) {
        setCityId(stored.id!);
        setMode(storedMode);
      }

      if (storedMode !== 'manual') {
        try {
          const near = await nearestCity(list);
          if (near && live) {
            setCityId(near.id);
            await AsyncStorage.setItem(KEY, JSON.stringify({ id: near.id, mode: 'auto' }));
          }
        } catch { /* keep the stored/default city */ }
      }
    })();
    return () => { live = false; };
  }, []);

  const setCity = useCallback((id: string) => {
    setCityId(id);
    setMode('manual');
    AsyncStorage.setItem(KEY, JSON.stringify({ id, mode: 'manual' })).catch(() => {});
  }, []);

  const useMyLocation = useCallback(async () => {
    const near = await nearestCity(cities);
    if (!near) return;
    setCityId(near.id);
    setMode('auto');
    await AsyncStorage.setItem(KEY, JSON.stringify({ id: near.id, mode: 'auto' })).catch(() => {});
  }, [cities]);

  const value = useMemo<CityContext>(() => ({
    city: cities.find((c) => c.id === cityId) ?? cities[0] ?? null,
    cities,
    mode,
    setCity,
    useMyLocation,
  }), [cities, cityId, mode, setCity, useMyLocation]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
