// Whether the collection's grid notice is open for this reader.
//
// The notice is the banner under a collection's card saying lists now
// open as a grid, and where the way back is (`CollectionDetailScreen`).
// Shown to every reader looking at a list as a grid, until they close it
// with its own × (owner, 22 Oct 2026). Nothing else closes it: not
// leaving the screen, which a reader who went straight back did without
// reading it; not opening the ⋯ menu, which is not saying "I have read
// this". A reader on the cards does not see it — it is about the grid —
// and sees it again if they come to the grid before closing it.
//
// It was shown only to a reader the grid was a default for, and closed by
// opening the menu too. The owner's own phone, which had chosen the grid
// that morning, never saw it, and the rule was changed the same day: told
// to everybody, closed only by them. Hence `.v2` on the key: a phone the
// first rule marked as told — by a menu opened, not by an × — is told
// again.
//
// ── one ×, every phone (owner, the same day) ──
//
// The × was kept on the phone, then per reader on the phone. The owner
// asked that closing it once close it on every phone the account is
// signed into, so the account keeps it too: `preferences.
// grid_notice_closed_at`, the theme's road (`themeAccountSync`). Two
// memories, then, and each does what the other cannot:
//
// - The phone's, per reader (`readerKey`), answers in one storage read,
//   offline, and is the only one a reader who is not signed in has.
// - The account's carries an × from one phone to the next.
//
// Closed in either is closed. Open is said only once both have answered,
// so the notice never shows for a moment on a phone that has not yet
// heard it was closed elsewhere. When the account cannot be read —
// offline — the phone's answer stands: a notice shown once more is a
// smaller fault than one that never shows. And the two are brought into
// line once both are in: an × the account has is written to the phone,
// and one only the phone has (made offline, or before the account kept
// it) is written to the account.

import { useCallback, useEffect, useState } from 'react';
import { closeGridNotice, fetchGridNoticeClosed } from './data';
import { GRID_NOTICE_KEY, readerKey } from './readerPrefs';
import { oneOf, useStored } from './stored';

const SEEN = oneOf('unseen', 'seen');

/** `unknown` until it can be said without flashing; then `open` or `closed`. */
export type NoticeState = 'unknown' | 'open' | 'closed';

/**
 * The notice's state for `reader` (`useSession().userId`: undefined while
 * unknown, null for nobody signed in), and the × that closes it.
 */
export function useGridNotice(reader: string | null | undefined): { state: NoticeState; close: () => void } {
  const [mine, keep, from] = useStored<'unseen' | 'seen'>(readerKey(GRID_NOTICE_KEY, reader), 'unseen', SEEN);
  const account = typeof reader === 'string' ? reader : null;
  // The account's answer, for whom it was asked: true closed, false open,
  // null when it could not be read.
  const [said, setSaid] = useState<{ for: string; closed: boolean | null } | null>(null);
  useEffect(() => {
    if (!account) return undefined;
    let live = true;
    fetchGridNoticeClosed(account).then(
      (closed) => { if (live) setSaid({ for: account, closed }); },
      () => { if (live) setSaid({ for: account, closed: null }); },
    );
    return () => { live = false; };
  }, [account]);
  // Undefined while the account has not answered this reader.
  const theirs = account && said?.for === account ? said.closed : undefined;

  useEffect(() => {
    if (!account || from === 'reading' || theirs === undefined) return;
    if (theirs === true && mine === 'unseen') keep('seen');
    if (theirs === false && mine === 'seen') closeGridNotice(account).catch(() => {});
  }, [account, from, theirs, mine, keep]);

  let state: NoticeState;
  if (from === 'reading') state = 'unknown';
  else if (mine === 'seen') state = 'closed';
  else if (!account) state = 'open';
  else if (theirs === undefined) state = 'unknown';
  else state = theirs === true ? 'closed' : 'open';

  const close = useCallback(() => {
    keep('seen');
    if (!account) return;
    // Said to be closed on the account at once, so the line-up above has
    // nothing left to write a second time.
    setSaid({ for: account, closed: true });
    closeGridNotice(account).catch(() => {});
  }, [account, keep]);

  return { state, close };
}
