// Distance to the user, opportunistically: reuse whatever location fix
// the city auto-detect already earned. Never prompts — if permission
// isn't granted or no fix exists, distances simply don't render.

import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

export type Coords = { lat: number; lng: number };

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function fmtKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : km < 10 ? `${Math.round(km * 10) / 10} km` : `${Math.round(km)} km`;
}

let cached: Coords | null | undefined; // undefined = not asked yet
let inflight: Promise<Coords | null> | null = null;

async function fetchCoords(): Promise<Coords | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getLastKnownPositionAsync();
    if (!pos) return null;
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

export function useUserCoords(): Coords | null {
  const [coords, setCoords] = useState<Coords | null>(cached ?? null);
  useEffect(() => {
    if (cached !== undefined) return;
    inflight = inflight ?? fetchCoords().then((c) => { cached = c; return c; });
    let live = true;
    inflight.then((c) => { if (live) setCoords(c); });
    return () => { live = false; };
  }, []);
  return coords;
}
