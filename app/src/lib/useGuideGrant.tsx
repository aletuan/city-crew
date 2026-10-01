// The React half of `guideGrant.ts`, and the one mount that fills it.

import { useEffect, useSyncExternalStore } from 'react';
import { useAuth } from './auth';
import { fetchGuideCities, fetchIsEditor } from './data';
import { guideGrant } from './guideGrant';

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

/** The one launch question: both answers, side by side. */
async function askGrant() {
  const [cities, editor] = await Promise.all([fetchGuideCities(), fetchIsEditor()]);
  return { cities, editor };
}

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
 */
export function GuideGrantSync() {
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;
  useEffect(() => { void guideGrant.load(uid, askGrant); }, [uid]);
  return null;
}
