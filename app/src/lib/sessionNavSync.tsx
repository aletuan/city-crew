// The React half of `sessionNav.ts`: the one mount that watches the
// account and resets the tabs when it ends. Renders nothing.
//
// Mounted inside the container beside `GuideGrantSync`, for the same
// reason that one has no face: it needs the session and the navigator,
// and belongs to no screen. Since 19 Nov 2026 the screen that signs you
// out, Account, is pushed over your own page, so this reset is also what
// takes the last tab back to its first page, the guest's hub. Nothing
// else may: a second `popToTop` from Account itself found the stack
// already cut and raised a red screen in development.

import { useEffect, useRef } from 'react';
import { navRef } from '../nav';
import { useSession } from './auth';
import { accountEnded, stacksToRoot } from './sessionNav';

export function SessionNavSync() {
  const { userId } = useSession();
  // Who was signed in on the last render. A ref and not state: the
  // comparison is a side effect's business, and a state would re-render
  // the tree once more for nothing.
  const prev = useRef(userId);
  useEffect(() => {
    const was = prev.current;
    prev.current = userId;
    if (!accountEnded(was, userId) || !navRef.isReady()) return;
    const next = stacksToRoot(navRef.getRootState());
    if (next) navRef.resetRoot(next);
  }, [userId]);
  return null;
}
