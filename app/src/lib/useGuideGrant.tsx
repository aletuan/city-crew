// The React half of `guideGrant.ts`, and the one mount that fills it.

import { useEffect, useSyncExternalStore } from 'react';
import { useAuth } from './auth';
import { fetchIsLocalGuide } from './data';
import { guideGrant } from './guideGrant';

/**
 * Whether this account is a local guide, answered on the first render.
 *
 * `useSyncExternalStore` rather than a fetch hook, which is the whole
 * point: the panel that reads this must be right the first time it
 * draws, or it appears a round trip late and shoves the card down the
 * screen. See `guideGrant.ts`.
 */
export function useIsGuide(): boolean {
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;
  return useSyncExternalStore(guideGrant.subscribe, () => guideGrant.get(uid));
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
  useEffect(() => { void guideGrant.load(uid, fetchIsLocalGuide); }, [uid]);
  return null;
}
