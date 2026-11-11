// The theme follows the account (12 Oct 2026): the one mount that reads
// an account's theme when it signs in and puts it on. Renders nothing.
//
// Mounted inside the container beside `SessionNavSync`, for the reason
// that one has no face: it needs the session, the theme and the
// navigator, and belongs to no screen. `ThemeProvider` itself sits above
// `AuthProvider` — the first frame is held on the stored scheme, before
// any session is read — so the provider cannot know who is signed in,
// and this is the piece that tells it.
//
// ── the rules ──
//
// 1. The account is the source of truth for a signed-in reader. The Theme
//    sheet writes every choice to it (`saveTheme`, through `setPref`'s
//    `remember`); a guest's choice stays on the device as it always did.
// 2. Signing in — or launching already signed in — reads the account's
//    theme. A different ground is put on at once. A different look is a
//    restart, once, back to the tab the reader is on, with no sheet
//    reopened: the one moment a relaunch reads as part of arriving.
// 3. Signing out changes nothing. The device keeps the look it has, and
//    that is what the next guest, or the next account, starts from.
// 4. An account that has never chosen (null on the server) takes the
//    device's theme and keeps it, so its first sign-in never restarts.
// 5. An account's 'system' meeting a device that never chose is read as
//    never chosen too (11 Nov 2026), and rule 4 applies. Before #1281 gave
//    an unchosen install a first look, rule 4 wrote 'system' for almost
//    every account whether anyone chose it or not — and a reader who signs
//    up on the very first launch, which still runs the old bundle, still
//    gets it written. Read as a choice, it restarted the next launch out of
//    the first look into Automatic. The server cannot tell the two apart;
//    a device that kept a setting can, so only an unchosen device yields.
//
// A value this build does not know — a look from a newer build — is left
// alone both ways: not put on, and not overwritten with this build's
// idea of it. `isPref` is the question, not `parsePref`, which would
// read it as Auto.

import { useEffect, useRef } from 'react';
import { navRef } from '../nav';
import { useSession } from './auth';
import { fetchTheme, saveTheme } from './data';
import { isPref, needsRestart } from './look';
import { useScheme } from './theme';

/** The tab on screen, for the restart to come back to; undefined when the
 *  navigator cannot say, in which case the launch lands where it would. */
function currentTab(): string | undefined {
  if (!navRef.isReady()) return undefined;
  const root = navRef.getRootState();
  return root?.routes[root.index]?.name;
}

export function ThemeAccountSync() {
  const { userId } = useSession();
  const { pref, look, ready, chosen, setPref } = useScheme();
  // Read at the moment of the sign-in, not re-run on every change of
  // theme: a choice made on this device after the read is the account's
  // already, through `remember`.
  const now = useRef({ pref, look, chosen, setPref });
  now.current = { pref, look, chosen, setPref };
  // Whose theme was last read, so a re-render with the same account —
  // and a re-render while the account is still being read, which hands
  // out last launch's id — reads nothing twice.
  const synced = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || typeof userId !== 'string') { if (userId === null) synced.current = null; return; }
    if (synced.current === userId) return;
    synced.current = userId;
    let live = true;
    fetchTheme(userId).then((remote) => {
      if (!live) return;
      const { pref: mine, look: worn, chosen: kept, setPref: choose } = now.current;
      // Rule 5: an unchosen device meets 'system' as it meets null.
      const unchosen = remote == null || (remote === 'system' && !kept);
      if (unchosen) { if (remote !== mine) saveTheme(userId, mine).catch(() => {}); return; }
      if (!isPref(remote) || remote === mine) return;
      const tab = needsRestart(worn, remote) ? currentTab() : undefined;
      choose(remote, tab ? { tab } : undefined);
    }).catch(() => {});
    return () => { live = false; };
  }, [userId, ready]);

  return null;
}
