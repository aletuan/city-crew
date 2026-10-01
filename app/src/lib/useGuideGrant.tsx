// The React half of `guideGrant.ts`, and the one mount that fills it.

import { useEffect, useSyncExternalStore } from 'react';
import { useAuth } from './auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchGuideCities, fetchIsEditor } from './data';
import { cacheKey, packCache, unpackCache } from './data/cache';
import { guideGrant, type Grant } from './guideGrant';

/**
 * Whether this account is a local guide *in this city*, answered on the
 * first render.
 *
 * The city is the place's, not the person's: a guide of Đà Nẵng looking
 * at something they imported in Huế is, for that place, a reader. That
 * is the line `is_local_guide(p.city_id)` draws in the insert policy, and
 * this is the app saying the same thing before it draws the control.
 *
 * Called with nothing — a screen whose place has not loaded yet — only an
 * all-cities grant answers yes, which is the honest reading and also the
 * safe one.
 *
 * `useSyncExternalStore` rather than a fetch hook, which is the whole
 * point: the panel that reads this must be right the first time it
 * draws, or it appears a round trip late and shoves the card down the
 * screen. See `guideGrant.ts`.
 */
export function useIsGuide(cityId?: string | null): boolean {
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;
  return useSyncExternalStore(guideGrant.subscribe, () => guideGrant.get(uid, cityId));
}

/**
 * Whether this account is an editor, answered on the first render — the
 * desk's hand, which keeps every gallery rather than only the ones it
 * imported. Read from the same store, loaded by the same one request.
 */
export function useIsEditor(): boolean {
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;
  return useSyncExternalStore(guideGrant.subscribe, () => guideGrant.isEditor(uid));
}

/** Whether the reader is a local guide of any city — the profile's badge
 *  question, not a place's. See `anywhere` on the store. */
export function useIsGuideAnywhere(): boolean {
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;
  return useSyncExternalStore(guideGrant.subscribe, () => guideGrant.anywhere(uid));
}

/** Whether this launch's question about the reader has been answered.
 *  Until it has, the profile holds the room its badge would take. */
export function useGrantSettled(): boolean {
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;
  return useSyncExternalStore(guideGrant.subscribe, () => guideGrant.settled(uid));
}

/** The one launch question: both answers, side by side. */
async function askGrant(): Promise<Grant> {
  const [cities, editor] = await Promise.all([fetchGuideCities(), fetchIsEditor()]);
  return { cities, editor };
}

/**
 * The grant, stashed per account the way `auth.tsx` stashes the profile
 * row: the same key scheme, the same pack, the same seven-day age. Keyed
 * by uid, so another account is a miss, never a wrong hit; a cache is a
 * convenience, so its failures are swallowed. Packed as a one-row list
 * because `unpackCache` trusts lists only.
 */
const stash = (uid: string) => cacheKey('grant', 'all', uid);
async function recall(uid: string) {
  try {
    const hit = unpackCache<Grant[]>(await AsyncStorage.getItem(stash(uid)), Date.now());
    const kept = hit?.data[0];
    if (kept) guideGrant.prime(uid, kept);
  } catch { /* nothing worth surfacing: the ask is the truth */ }
}
const remember = (uid: string) => async () => {
  const grant = await askGrant();
  AsyncStorage.setItem(stash(uid), packCache([grant], Date.now())).catch(() => {});
  return grant;
};

/**
 * Asks once, at launch, and renders nothing.
 *
 * Mounted beside `ReminderSync`, inside the auth provider, for the same
 * reason that one is: it needs a session and it has no face. The request
 * settles while the reader is still on the city list, so by the time any
 * place can be opened the answer is already in the store and the panel
 * draws correctly on its first frame.
 *
 * `load` is idempotent per account, so this being mounted at the same
 * time as any other reader costs one request, not two.
 *
 * And it remembers: last launch's answer is primed from AsyncStorage
 * while this launch's request is out, so a badge the reader had
 * yesterday is on the first frame today. See `prime` in the store for
 * why a remembered yes can never outlive the database's no.
 */
export function GuideGrantSync() {
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;
  useEffect(() => {
    if (!uid) { void guideGrant.load(uid, askGrant); return; }
    // The ask first — it marks the account asked about, so the recall
    // below primes into this launch's question and not before it.
    void guideGrant.load(uid, remember(uid));
    void recall(uid);
  }, [uid]);
  return null;
}
