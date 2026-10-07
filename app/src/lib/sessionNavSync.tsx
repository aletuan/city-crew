// The React half of `sessionNav.ts`: the one mount that watches the
// account and resets the tabs when it ends. Renders nothing.
//
// Mounted inside the container beside `GuideGrantSync`, for the same
// reason that one has no face: it needs the session and the navigator,
// and belongs to no screen. The screen that signs you out is the Profile
// tab's root, which is exactly the one stack this never has to cut.

import { useEffect, useRef } from 'react';
import { navRef } from '../nav';
import { useAuth } from './auth';
import { accountEnded, stacksToRoot } from './sessionNav';

export function SessionNavSync() {
  const { userId } = useAuth();
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
