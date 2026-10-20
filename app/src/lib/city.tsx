// City selection: which city's catalog the whole app shows.
//
// The rule that shapes this file: the app never renders one city's
// content and then switches to another. Until the city is resolved,
// `city` stays null and every screen shows its skeleton (data.ts holds
// fetches while city == null). Resolution is fast and happens once:
// a stored manual pick wins outright; otherwise a *cached* location fix
// under a hard time cap picks the nearest city; otherwise the stored
// auto city, else HCMC. After that, the city moves only on the reader's
// word — the switcher or "Use my location" — or, while the choice is
// automatic, when a fresh fix names a different city: behind a launch that
// had no cached one, and after a sign-out (see `freshNearestCity`).

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuthEvent } from './auth';
import { supabase } from './supabase';
// Pure arithmetic, kept where a test runner can reach it.
import { nearestTo } from './geo';
import { openOn, releaseChoice, settleOn, shouldCorrect, storedPick } from './citypick';
import { parseCachedCities } from './citylist';
import { shouldRefresh } from './stale';
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
  /** The city's IANA zone — `Australia/Melbourne`, `Asia/Ho_Chi_Minh` —
   *  which every question about a place's opening hours is read on. See
   *  `lib/clock`. Optional because a row hydrated from a launch cache
   *  written before the column existed has none; `cityTz` reads that as
   *  Vietnam, which is right for seven cities of eight until the next
   *  fetch fills it in. */
  tz?: string | null;
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
  /** A photograph of the city itself. Beats `hero_place_slug` when set —
   *  see `heroPhoto` in ExploreScreen. */
  hero_photo_uri: string | null;
  /** Who took it. The hero shows this whenever there is a photo; a photo
   *  without a credit is a photo we are passing off as ours. */
  hero_photo_credit: string | null;
  hero_photo_credit_uri: string | null;
};

type CityContext = {
  city: City | null;      // null until bootstrap resolves — screens skeleton
  cities: City[];
  mode: 'auto' | 'manual';
  /**
   * The reader's pick, and manual unless told otherwise.
   *
   * The second argument exists for one caller: the start sheet, which
   * switches the city the moment a pin lands so its chips and map can
   * show the pin's city, and puts it back if the sheet is closed without
   * an answer. Back means *as it was* — a city the app had chosen by
   * position (auto) must come back as auto, or a cancelled sheet would
   * leave the app deaf to the next fix. `followMyLocation` could not do
   * it: it asks the platform again, and with the permission refused it
   * would leave the wrong city standing.
   */
  setCity: (id: string, mode?: 'auto' | 'manual') => void;
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
  /** Resolves true when a nearest city was found and followed; false when
   *  it could not be — permission refused, no fix. The switcher asked for
   *  this answer: the person just tapped a row requesting their location,
   *  and silence after an explicit request reads as broken, not as
   *  respectful. Only the button reports it; the quiet bootstrap read at
   *  launch stays quiet. */
  followMyLocation: () => Promise<boolean>;
};

const KEY = 'citycrew.city';
const LIST_KEY = 'citycrew.cities';
const DEFAULT_CITY_ID = 'hcmc';
/** Bootstrap never waits on location longer than this. */
const GEO_BUDGET_MS = 1200;
/**
 * How long the background fix behind a committed city may take. Off the
 * critical path — the catalog is already loading — so it can afford what
 * a cold GPS needs, and no longer: a fix that arrives after the reader
 * has settled into a screen would move the city under them.
 */
const FRESH_FIX_MS = 8000;

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

/**
 * Commit the remembered city against last launch's city *list*, before
 * this launch's fetch of it comes back.
 *
 * `RESUME_STORED_CITY` above moved the location wait off the critical
 * path, and the startup traces then showed what was left on it: the
 * cities fetch itself, 718–1078 ms on a real phone, gating a commit that
 * needs nothing from the network but a list of ids. So the list each
 * launch fetches is written down, and the next launch reads it back in a
 * few milliseconds and commits against that — the catalog starts roughly
 * a second earlier, which the traces put at about half the launch.
 *
 * The fresh fetch still runs, still refreshes the list on screen, and
 * still decides everything it always did — including re-running the same
 * open-on decision against the fresh ids, which is what heals the one
 * lie a cache can tell: a city retired since last launch commits for a
 * beat and is then corrected, exactly the bounded cost `RESUME_STORED_CITY`
 * already accepts for a reader who moved. `false` restores the
 * wait-for-the-fetch behaviour exactly; the cache is still written, so
 * flipping it back on needs no re-seeding.
 */
export const CACHE_CITY_LIST = true;

// Offline fallback so the cities *list* is never empty; deliberately not
// used as the initial `city` — first paint must not guess a city.
const FALLBACK: City = {
  id: 'hcmc', name_en: 'Ho Chi Minh City', name_vi: 'TP. Hồ Chí Minh', name_ja: 'ホーチミン市',
  short_en: 'Saigon', short_vi: 'Sài Gòn', short_ja: 'サイゴン', center_lat: 10.7769, center_lng: 106.7009,
  radius_km: 25, tz: 'Asia/Ho_Chi_Minh',
  hero_title_en: null, hero_title_vi: null, hero_title_ja: null,
  hero_sub_en: null, hero_sub_vi: null, hero_sub_ja: null,
  hero_cta_en: null, hero_cta_vi: null, hero_cta_ja: null, hero_place_slug: null,
  hero_photo_uri: null, hero_photo_credit: null, hero_photo_credit_uri: null,
};

/**
 * ── two halves, one provider (20 Oct 2026) ──
 *
 * `useCity` had twenty-five callers, and sixteen read only `city` — the
 * data hooks, the save sheet, most screens. As one context, every one of
 * them drew again whenever the *list* changed, which is twice on an
 * ordinary launch (last launch's list, then this one's) and again on each
 * foreground refresh, for a value they never read. The SOLID review (I)
 * split it where the callers had: the city on screen, and the list with
 * the ways to move between its rows. `useCity` stays as both, for the
 * switchers and the screens that offer one.
 */
export type CurrentCity = Pick<CityContext, 'city'>;
export type CityList = Omit<CityContext, keyof CurrentCity>;

const CityCtx = createContext<CurrentCity>({ city: null });
const CityListCtx = createContext<CityList>({
  cities: [FALLBACK], mode: 'auto', setCity: () => {}, followMyLocation: async () => false,
});

/** The city on screen, or null until the bootstrap commits to one. */
export const useCurrentCity = () => useContext(CityCtx);
/** Every city, whose word the current one is, and the two ways to change it. */
export const useCityList = () => useContext(CityListCtx);
/** All of it, as one object — the shape every caller had before the split. */
export function useCity(): CityContext {
  return { ...useCurrentCity(), ...useCityList() };
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

/**
 * A fresh, low-accuracy fix, for when the platform had no cached one.
 *
 * `quickNearestCity` reads only the *last known* position, and on iOS that
 * is nil whenever nothing on the phone has asked for a location lately —
 * after a restart, say, or on a simulator. A null there meant the stored
 * city stood, and since nothing here ever asked for a fresh fix, the cache
 * never warmed and the next launch was the same: a reader in Hanoi kept
 * the Saigon an earlier launch fell back to, launch after launch.
 *
 * **Reads** the permission rather than requesting it. Launch has already
 * asked once; this runs behind a committed city and after a sign-out, and
 * neither is a moment to raise a dialog.
 */
async function freshNearestCity(list: City[]): Promise<City | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const attempt = (async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    if (!pos) return null;
    return nearestTo(list, pos.coords.latitude, pos.coords.longitude);
  })();
  const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), FRESH_FIX_MS); });
  try {
    return await Promise.race([attempt, timeout]).catch(() => null);
  } finally {
    clearTimeout(timer);
  }
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

/** `withSub` and `withPhoto` each drop the newest group of columns, so a
 *  client shipped ahead of its migration still gets a city list. */
const CITY_COLS = (withSub: boolean, withPhoto: boolean, withTz: boolean) =>
  `id, name_en, name_vi, name_ja, short_en, short_vi, short_ja, center_lat, center_lng, radius_km${withTz ? ', tz' : ''}, hero_title_en, hero_title_vi, hero_title_ja${withSub ? ', hero_sub_en, hero_sub_vi, hero_sub_ja' : ''}, hero_cta_en, hero_cta_vi, hero_cta_ja, hero_place_slug${withPhoto ? ', hero_photo_uri, hero_photo_credit, hero_photo_credit_uri' : ''}`;

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
 * Two groups can be missing, and they are dropped newest first:
 * `hero_photo_*` (the city's own cover) then `hero_sub_*`. Postgres names
 * only the first column it does not recognise, so the retries have to be
 * ordered rather than combined — a database missing both answers about
 * `hero_photo_uri`, and only once that group is gone does it mention
 * `hero_sub`.
 */
async function fetchCities(): Promise<City[]> {
  const run = (withSub: boolean, withPhoto: boolean, withTz = true) =>
    supabase
      .from('cities')
      .select(CITY_COLS(withSub, withPhoto, withTz))
      .eq('is_active', true)
      .order('sort_order');

  let { data, error } = await run(true, true);
  // Newest column first, the way the others are ordered: a database
  // without `tz` answers about it before it answers about the hero.
  if (error && /\btz\b/.test(error.message)) ({ data, error } = await run(true, true, false));
  if (error && error.message.includes('hero_photo')) ({ data, error } = await run(true, false, false));
  if (error && error.message.includes('hero_sub')) ({ data, error } = await run(false, false, false));
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
  // When a fetch last brought the list back; null until one has. Read by
  // the foreground refresh below, written by every fetch that succeeds.
  const listAt = useRef<number | null>(null);

  // What a fix that lands late has to be checked against: the city and the
  // mode *now*, not when it was asked for. A reader who picks a city while
  // the fix is out has spoken, and the fix is dropped.
  const now = useRef({ cityId, mode, cities, live: true });
  now.current = { ...now.current, cityId, mode, cities };
  useEffect(() => {
    now.current.live = true;
    return () => { now.current.live = false; };
  }, []);

  /**
   * Ask for a fresh fix and move to its city if the choice is still
   * automatic and the city differs. Never prompts, never overrides a
   * manual pick — `shouldCorrect` holds both rules, as it does for the
   * launch correction.
   */
  const followFreshFix = useCallback(async (list: City[]) => {
    const near = await freshNearestCity(list);
    const { cityId: showing, mode: showingMode, live } = now.current;
    if (!live || !showing) return;
    if (!shouldCorrect({ id: showing, mode: showingMode }, near?.id ?? null)) return;
    setCityId(near!.id);
    now.current.cityId = near!.id;
    AsyncStorage.setItem(KEY, JSON.stringify({ id: near!.id, mode: 'auto' })).catch(() => {});
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      // The reads are marked separately on purpose: the store reads are
      // local and should cost single-digit milliseconds, the cities fetch
      // is the launch's first round trip — if the gap between those lines
      // is wide, the network is the story.
      startupTrace.mark('city:bootstrap');
      const fetching = fetchCities().then((r) => { startupTrace.mark('city:cities-fetched'); return r; });
      const [storedRaw, cachedRaw] = await Promise.all([
        AsyncStorage.getItem(KEY).then((r) => { startupTrace.mark('city:store-read'); return r; }),
        CACHE_CITY_LIST ? AsyncStorage.getItem(LIST_KEY) : Promise.resolve(null),
      ]);
      if (!live) return;

      let stored: { id?: string; mode?: 'auto' | 'manual' } = {};
      try { stored = storedRaw ? JSON.parse(storedRaw) : {}; } catch { /* corrupt store */ }

      // Phase one, the cache: what last launch knew is enough to put the
      // remembered city on screen while the network answers. A blob that
      // fails any of `parseCachedCities`' checks is no cache, and the
      // launch behaves exactly as it did before caches existed.
      const cachedList = parseCachedCities(cachedRaw);
      if (cachedList) {
        setCities(cachedList);
        const opened = openOn(stored, cachedList.map((c) => c.id), RESUME_STORED_CITY);
        if (opened) {
          setMode(opened.mode);
          setCityId(opened.id);
          startupTrace.mark('city:committed(cached)');
        }
      }

      // Phase two, the network: the fetch decides everything it always
      // did, re-running the same decisions against the fresh list. Where
      // it agrees with the cache — the overwhelmingly common case — every
      // set below is an identity update React bails on: no re-render, no
      // refetch. Where it disagrees (a city retired since last launch),
      // this is what corrects the stale commit.
      const fetched = await fetching;
      if (!live) return;
      const list = fetched.length ? fetched : cachedList ?? [FALLBACK];
      setCities(list);
      setListFailed(!fetched.length);
      // Written even with the switch off, so flipping it on needs no
      // re-seeding launch — and never written on a failed fetch, which
      // would trade a stale-but-real list for nothing.
      if (fetched.length) {
        listAt.current = Date.now();
        AsyncStorage.setItem(LIST_KEY, JSON.stringify(fetched)).catch(() => {});
      }

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
        // No cached fix is no answer, not agreement: ask for a fresh one
        // behind the city already on screen. Without this the stored city
        // stood for good — see `freshNearestCity`.
        if (!near) {
          now.current = { ...now.current, cityId: opening.id, mode: opening.mode };
          void followFreshFix(list);
          return;
        }
        // The common case is that it agrees, and agreement must cost
        // nothing: no state change, so no refetch of a catalog already on
        // screen.
        if (!shouldCorrect(opening, near.id)) return;
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
      // A first launch with no cached fix committed a guess — the stored
      // city or the default. Correct it from a fresh fix once there is one.
      if (!near) {
        now.current = { ...now.current, cityId: chosen, mode: 'auto' };
        void followFreshFix(list);
      }
    })();
    return () => { live = false; };
  }, [followFreshFix]);

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
      listAt.current = Date.now();
      setCities(fetched);
      setListFailed(false);
    }, 15_000);
    return () => { live = false; clearInterval(id); };
  }, [listFailed]);

  /**
   * The list, refreshed on return.
   *
   * The bootstrap fetches the cities once and the healer only asks again
   * for a list that failed, so a list that *succeeded* was the list for
   * the life of the process — and iOS keeps a process alive for days. On
   * 14 Oct 2026 Hội An was switched on in the desk and the owner's phone,
   * an hour later, still had eight cities in the switcher and the old
   * line under the Hai Phong cover: nothing had ever asked twice.
   *
   * So the same return the catalog revalidates on (`lib/catalog`, same
   * threshold from `lib/stale`, for the same reason — `active` fires on
   * the way out of every notification shade, not only out of a real
   * absence). Only the list changes; the city stays where it is, by the
   * bootstrap's own rule that it never moves on its own after commit.
   * Two refusals keep that rule honest: a fetched list that no longer
   * holds the city on screen is not applied at all, since applying it
   * would make `city` null under every screen (the next cold start sorts
   * a retired city out, as it always has); and a list identical to the
   * one showing is not set, since a fresh array of the same rows would
   * re-render every consumer in the app for nothing.
   *
   * `listAt` is null until a fetch has succeeded — while the bootstrap is
   * out or the healer is asking, this stays out of their way.
   */
  useEffect(() => {
    let inFlight = false;
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active' || inFlight) return;
      const at = listAt.current;
      if (at == null || !shouldRefresh(at, Date.now())) return;
      inFlight = true;
      void (async () => {
        const fetched = await fetchCities();
        inFlight = false;
        if (!now.current.live || !fetched.length) return;
        listAt.current = Date.now();
        const { cities: showing, cityId: on } = now.current;
        if (on && !fetched.some((c) => c.id === on)) return;
        if (JSON.stringify(fetched) === JSON.stringify(showing)) return;
        setCities(fetched);
        AsyncStorage.setItem(LIST_KEY, JSON.stringify(fetched)).catch(() => {});
      })();
    });
    return () => sub.remove();
  }, []);

  /**
   * When the account that made a manual pick leaves, the pick stops being
   * anybody's word.
   *
   * `setCity` writes `mode: 'manual'`, and the bootstrap honours that
   * absolutely — `if (opening?.mode === 'manual') return;`, before the
   * platform is asked anything. But the pick is stored per *device*: the
   * key carries no user id and signing out never touched it. So one manual
   * choice went on silencing the location question for every account after
   * it, and a new reader in Hanoi opened on the Da Nang a previous one
   * chose, with no signal that a choice was being made for them.
   *
   * Watched through the client rather than through `useAuth`, and that is
   * not a shortcut. `auth.tsx` imports `expo-image-manipulator` for
   * avatars, and the city is reached by almost every screen — importing
   * the provider here put image manipulation into the dependency graph of
   * a place card, which a test that had nothing to do with any of this
   * found within the minute. What this needs is one fact, `supabase` is
   * already here, and `SIGNED_OUT` names it exactly: it does not fire on a
   * launch the way an `INITIAL_SESSION` does, so there is no ordinary
   * start to tell apart from a departure.
   *
   * The in-memory `mode` moves with the stored one. Signing out and
   * signing up again happens without the app restarting, which is exactly
   * the case this exists for — a storage-only fix would arrive one launch
   * too late for the reader who just met it.
   */
  //
  // Heard through `useAuthEvent` rather than from Supabase directly: the
  // auth provider is the one place that subscribes (SOLID review, D).
  useAuthEvent('SIGNED_OUT', () => {
      (async () => {
        const raw = await AsyncStorage.getItem(KEY).catch(() => null);
        let stored: { id?: string; mode?: 'auto' | 'manual' } = {};
        try { stored = raw ? JSON.parse(raw) : {}; } catch { /* corrupt store */ }
        const released = releaseChoice(stored);
        if (released) {
          setMode('auto');
          now.current.mode = 'auto';
          AsyncStorage.setItem(KEY, JSON.stringify(released)).catch(() => {});
        }
        // Releasing the pick only changed whose word the city is; the city
        // itself stayed the one the last account was looking at, and the
        // next account opened on it. Whoever signs in next — often in the
        // same minute, without a restart — gets the city they are in.
        if (now.current.mode === 'auto') void followFreshFix(now.current.cities);
      })();
  });

  const setCity = useCallback((id: string, mode: 'auto' | 'manual' = 'manual') => {
    setCityId(id);
    setMode(mode);
    // At once, not on the next render: a fix already out must see this.
    now.current = { ...now.current, cityId: id, mode };
    AsyncStorage.setItem(KEY, JSON.stringify({ id, mode })).catch(() => {});
  }, []);

  const followMyLocation = useCallback(async () => {
    const near = await preciseNearestCity(cities);
    if (!near) return false;
    setCityId(near.id);
    setMode('auto');
    await AsyncStorage.setItem(KEY, JSON.stringify({ id: near.id, mode: 'auto' })).catch(() => {});
    return true;
  }, [cities]);

  // The row on screen, kept by what it says rather than by which array it
  // came from. A fresh list is fresh objects, so the same Da Nang read
  // back from the network is a new `city` to React — and without this,
  // every city-only caller still drew on each refresh, split or no split.
  // A refresh that did change the row (a new cover, a corrected name)
  // changes the text, and that does reach them. Cost, measured: the find
  // and the stringify of a full 28-column row (795 bytes) take 1.0 µs in
  // Node 24 on an M3 Pro, once per provider render — not per caller.
  const found = cityId ? cities.find((c) => c.id === cityId) ?? null : null;
  const foundText = JSON.stringify(found);
  // `foundText` is `found`, said so that equal rows compare equal.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const city = useMemo(() => found, [foundText]);

  const current = useMemo<CurrentCity>(() => ({ city }), [city]);
  const list = useMemo<CityList>(
    () => ({ cities, mode, setCity, followMyLocation }),
    [cities, mode, setCity, followMyLocation],
  );

  return (
    <CityCtx.Provider value={current}>
      <CityListCtx.Provider value={list}>{children}</CityListCtx.Provider>
    </CityCtx.Provider>
  );
}
