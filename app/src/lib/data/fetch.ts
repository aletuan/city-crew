// The one React shape the data layer exposes: a request's state, and the
// hook that drives it.
//
// Split from the queries so that everything else in this directory is a
// plain async function a Node process can call. `hooks.ts` is the other
// half — see `index.ts` for the whole arrangement.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { shouldRefresh } from '../stale';
import { startupTrace } from '../trace';
import { CACHE_CATALOG, cacheKind, fitsCache, packCache, unpackCache } from './cache';

export type Fetch<T> = {
  loading: boolean;
  /**
   * True once this has settled at least once, and never false again.
   *
   * `loading` answers "is a request in flight", which flips back on for
   * every refresh. A screen that hides a section while `loading` therefore
   * tears it down on every refresh — and inferring "we have been here
   * before" from a non-empty `data` fails for anyone whose answer is
   * legitimately empty. This is the flag that actually means it.
   */
  loaded: boolean;
  error: string | null;
  data: T;
  /**
   * When the last *successful* load landed, or null if none has.
   *
   * Not `loaded`, which stays true after a failure: this is the one that
   * can say how old what we are showing actually is, which is what
   * deciding whether to ask again needs. See `lib/stale`.
   */
  loadedAt: number | null;
  /**
   * True while what `data` holds came from the launch cache rather than
   * the network — see `usePersistedFetch`. Flips false the moment a fresh
   * answer lands and never comes back. Plain `useFetch` is never true.
   */
  fromCache: boolean;
  reload: () => void;
};

export function useFetch<T>(fetcher: () => Promise<T>, empty: T): Fetch<T> {
  return usePersistedFetch(null, fetcher, empty);
}

/**
 * `useFetch`, with a memory: show what the last launch fetched while this
 * launch's fetch is in flight — stale-while-revalidate, the launch-speed
 * half of `lib/data/cache` (the envelope, the version stamp, and the
 * switch live there).
 *
 * `key` is the storage key, or null for no persistence at all — which is
 * exactly `useFetch`, and is how the switch turns this off. Four rules
 * keep the cache honest:
 *
 *   - A key is a question, and a new key never keeps showing the old
 *     question's answer. It resets to skeletons in the same render, and
 *     whatever the old question still had in flight is dropped whole
 *     when it lands — neither shown nor written. Before this, switching
 *     city left the previous city's catalog on screen until the new
 *     fetch arrived; the hero, picking its photo from that mixed state,
 *     visibly loaded one cover and then another.
 *   - A fresh answer beats hydration. The storage read applies only
 *     while nothing has landed for *this* key (`loadedAt === null`), so
 *     however slow it is, it can never overwrite the network. The reset
 *     re-arms it, which is the bonus: a city switch now hydrates from
 *     that city's last visit exactly the way a launch does.
 *   - The cache is written only from a *successful* fetch, under the key
 *     the request was asked under.
 *   - Reading it back goes through `unpackCache`, and a blob that fails
 *     any of its checks means skeletons and a plain wait — the launch the
 *     app always had.
 *
 * Hydrated data carries its original `loadedAt`, so the two-minute
 * staleness rule (`lib/stale`) sees a week-old cache for what it is.
 */
export function usePersistedFetch<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  empty: T,
): Fetch<T> {
  // Named from `Fetch` rather than written out again: the copy is how a
  // field added to the type could be left out of the state that fills it.
  const [state, setState] = useState<Omit<Fetch<T>, 'reload'>>({
    loading: true, loaded: false, error: null, data: empty, loadedAt: null, fromCache: false,
  });
  // Which question is on screen. Bumped by every load and by every key
  // change, and every answer checks it before touching anything — a late
  // answer to a question no longer being asked is dropped whole.
  const gen = useRef(0);
  // The key at request start, read by `load` when it fires.
  const keyRef = useRef(key);
  keyRef.current = key;

  // The first rule in the docstring, mechanically: reset during render —
  // React's own pattern for state derived from props — so not one frame
  // of the old key's answer is ever painted under the new one, and bump
  // the generation so the old key's in-flight fetch dies unheard.
  // `reload` goes nowhere near this: refreshing the *same* question
  // keeps showing its old answer, as every pull-to-refresh should.
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setState({ loading: true, loaded: false, error: null, data: empty, loadedAt: null, fromCache: false });
    gen.current += 1;
  }

  const load = useCallback(() => {
    gen.current += 1;
    const mine = gen.current;
    const asked = keyRef.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher()
      .then((data) => {
        if (gen.current !== mine) return;
        setState({ loading: false, loaded: true, error: null, data, loadedAt: Date.now(), fromCache: false });
        if (asked) {
          const blob = packCache(data, Date.now());
          // Too long to read back on Android (`CACHE_MAX_CHARS`): not
          // written, and the last one removed with it. Kept, the old blob
          // would go on opening the app for a week with an answer every
          // later fetch had replaced — a closed place still listed, a new
          // one missing. Without it, the next launch of this question
          // waits for the network, which is the launch the app had before
          // it cached anything. Marked, so a catalog that outgrows the
          // phone shows up in the traces rather than as a slower launch.
          if (fitsCache(blob)) {
            AsyncStorage.setItem(asked, blob).catch(() => {});
          } else {
            AsyncStorage.removeItem(asked).catch(() => {});
            startupTrace.mark(`cache:${cacheKind(asked)}:too-big`, blob.length);
          }
        }
      })
      // `loadedAt` is deliberately left where it was: a refresh that failed
      // has not made what we are showing any newer, and pretending
      // otherwise would push the next attempt out by another interval.
      .catch((err: Error) => {
        if (gen.current !== mine) return;
        setState((s) => ({ ...s, loading: false, loaded: true, error: err.message }));
      });
  }, [fetcher]);
  useEffect(load, [load]);

  useEffect(() => {
    if (!key) return;
    let live = true;
    // What reading a cache back costs, measured on the launch that pays
    // it (owner, 29 Oct 2026): how long the blob is, and how long
    // `unpackCache` — a `JSON.parse` of all of it, on the JS thread —
    // took. And a mark when the read itself fails, which is how a blob
    // past Android's 2 MB cursor window shows up: not as a slow read but
    // as no read at all (`searchIndex.tsx` declined to cache for exactly
    // that). Length in UTF-16 units, not bytes: near enough for the
    // question, and free. Marks dedupe by name, so this is the launch's
    // first read of each kind and nothing after.
    const kind = cacheKind(key);
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!live) return;
        const t0 = Date.now();
        const hit = unpackCache<T>(raw, t0);
        if (raw) {
          startupTrace.mark(`cache:${kind}:chars`, raw.length);
          startupTrace.mark(`cache:${kind}:parse-ms`, Date.now() - t0);
        }
        if (!hit) return;
        setState((s) => (s.loadedAt !== null ? s
          : { ...s, loaded: true, data: hit.data, loadedAt: hit.at, fromCache: true }));
      })
      // An unreadable cache is no cache — but a counted one.
      .catch(() => { startupTrace.mark(`cache:${kind}:unreadable`); });
    return () => { live = false; };
  }, [key]);

  return { ...state, reload: load };
}

// ── one answer, shared by every screen that asks ──
//
// `usePersistedFetch` holds its answer in the component that asked: two
// screens asking the same question hold two copies, and the second one
// starts from nothing — skeletons, a request, a wait — however recently
// the first was answered. Its launch cache does not close that gap: the
// read back from the phone is a promise, so even a hit lands a render
// after the mount, and the mount has already drawn the spinner.
//
// A list's activity (13 Nov 2026) is that case exactly. The collection
// page asks so that the activity page, one tap on, can open with the
// answer drawn; that needs the answer to outlive the page that asked and
// to be read synchronously by the next one. So this keeps one entry per
// key for the life of the app, which every hook on that key reads
// (`useSyncExternalStore`) and any of them refreshes:
//
//   - The first render of a second reader draws what the entry holds.
//     Stale-while-revalidate across screens as well as across launches.
//   - One request per key at a time. A reader that mounts, or a prefetch
//     that fires, while one is in flight joins it rather than sending a
//     second — so a tap that beats the prefetch's answer waits for that
//     answer, not for a fresh one behind it.
//   - Written to the phone after a successful fetch, under the same
//     envelope and size rule as `usePersistedFetch`, and read back once
//     per key per launch — shown only while nothing fresher has landed.
//     The `CACHE_CATALOG` switch turns the read-back off, not the write,
//     as it does there.
//   - A failed refresh keeps the last answer and says why (`error`), as
//     `usePersistedFetch` does; `loadedAt` stays where it was.
//
// What it does not do is `usePersistedFetch`'s generation dance: a key
// is its own entry here, so an answer can only ever land under the
// question it was asked for, and with one request per key in flight
// there is no older answer on the same key to drop.
//
// Rejected: a provider above the navigators, the way `crew.tsx` and
// `catalog.tsx` hold one copy. They exist because several screens draw
// from the copy at once and must change together; this one has a single
// reader and a prefetcher, and a provider would re-render every consumer
// of its context each time the owner's activity landed — the collection
// page among them, for an answer it never draws.

type Entry = {
  state: Omit<Fetch<unknown>, 'reload'>;
  inFlight: boolean;
  listeners: Set<() => void>;
};

const entries = new Map<string, Entry>();

function entryFor(key: string, empty: unknown): Entry {
  const found = entries.get(key);
  if (found) return found;
  const e: Entry = {
    state: { loading: true, loaded: false, error: null, data: empty, loadedAt: null, fromCache: false },
    inFlight: false,
    listeners: new Set(),
  };
  entries.set(key, e);
  // Once per key per launch: the entry is the memory from here on.
  if (CACHE_CATALOG) {
    AsyncStorage.getItem(key)
      .then((raw) => {
        const hit = unpackCache<unknown>(raw, Date.now());
        if (!hit || e.state.loadedAt !== null) return;
        publish(e, { ...e.state, loaded: true, data: hit.data, loadedAt: hit.at, fromCache: true });
      })
      .catch(() => { startupTrace.mark(`cache:${cacheKind(key)}:unreadable`); });
  }
  return e;
}

function publish(e: Entry, state: Entry['state']) {
  e.state = state;
  for (const l of e.listeners) l();
}

function load(key: string, fetcher: () => Promise<unknown>, empty: unknown) {
  const e = entryFor(key, empty);
  if (e.inFlight) return;
  e.inFlight = true;
  publish(e, { ...e.state, loading: true, error: null });
  fetcher()
    .then((data) => {
      e.inFlight = false;
      publish(e, { loading: false, loaded: true, error: null, data, loadedAt: Date.now(), fromCache: false });
      const blob = packCache(data, Date.now());
      if (fitsCache(blob)) AsyncStorage.setItem(key, blob).catch(() => {});
      else AsyncStorage.removeItem(key).catch(() => {});
    })
    .catch((err: Error) => {
      e.inFlight = false;
      publish(e, { ...e.state, loading: false, loaded: true, error: err.message });
    });
}

/**
 * Ask ahead for a screen that has not opened yet, without drawing the
 * answer here — and so without re-rendering the asker when it lands.
 * Skipped while the entry is younger than `lib/stale`'s two minutes: the
 * reader that opens next refreshes it anyway, and an asker opened over
 * and over (a list being edited, back and forth) should not cost a
 * request on every visit.
 */
export function prefetchShared<T>(key: string, fetcher: () => Promise<T>, empty: T): void {
  const e = entryFor(key, empty);
  if (!shouldRefresh(e.state.loadedAt, Date.now())) return;
  load(key, fetcher, empty);
}

/**
 * The shared answer to `key`, refreshed on every mount — see above.
 * `null` asks nothing and answers `empty`, settled, so a caller with
 * nobody to ask about can still call it unconditionally. `empty` should
 * be one value for the life of the caller (a module constant), as the
 * other hooks here ask.
 */
export function useSharedFetch<T>(key: string | null, fetcher: () => Promise<T>, empty: T): Fetch<T> {
  const idle = useMemo<Omit<Fetch<T>, 'reload'>>(
    () => ({ loading: false, loaded: true, error: null, data: empty, loadedAt: null, fromCache: false }),
    [empty],
  );
  const subscribe = useCallback((onChange: () => void) => {
    if (!key) return () => {};
    const e = entryFor(key, empty);
    e.listeners.add(onChange);
    return () => { e.listeners.delete(onChange); };
  }, [key, empty]);
  const state = useSyncExternalStore(
    subscribe,
    () => (key ? entryFor(key, empty).state as Omit<Fetch<T>, 'reload'> : idle),
  );
  // The latest fetcher, for a reload fired from a render that closed over
  // an older one; the key, not the function, is the question.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const reload = useCallback(() => {
    if (key) load(key, fetcherRef.current, empty);
  }, [key, empty]);
  useEffect(reload, [reload]);
  return { ...state, reload };
}

/** For tests: the entries live as long as the module, which in a test
 *  file is every test in it. */
export function forgetSharedFetches(): void {
  entries.clear();
}
