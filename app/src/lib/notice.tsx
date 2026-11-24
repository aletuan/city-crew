// One line said from the foot of the screen, with one thing to press.
//
// ── what it is for (owner, 24 Nov 2026) ──
//
// A check-in shared with friends becomes a card on your own page, and
// nothing on the place's screen says so. The owner asked whether the app
// should go to the page after a check-in, to show it. It should not: the
// reader is at the place, and using its screen — the hours, the address,
// a list to keep it in — and a visit kept private has nothing on the page
// worth the trip. What was missing was the *knowledge* that the page is
// where it went. So: a line, "Added to your page", and a way there for
// whoever wants it.
//
// ── why its own thing ──
//
// The map's `Toast` is a sentence about what a tap did, with nothing to
// press, gone in two seconds. `RewardBanner` is news that arrived
// unasked, a picture and two lines, from the top. This is between them —
// a sentence, but with a door — and it comes from the foot because that
// is where the sheet that caused it just went down.
//
// One copy above the navigator, as the banner's is, and for the reason
// the quick comment field is mounted there: the control that causes it
// lives inside a screen's scroll view, and a line drawn from in there
// would be positioned in the page's content, not on the screen.
//
// One at a time. A second said while the first is up takes its place.

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export type Note = {
  /** New for every note, so the same words said twice start the clock twice. */
  id: number;
  text: string;
  /** The word on the door. Where it goes is not said here: there is one
   *  door so far — the reader's own page — and it is the bar's to open
   *  (`NoticeBar`'s `onOpen`), as the reward banner's is, so that a
   *  screen saying a line need not reach for the navigator. A second
   *  door is a `to` on this type and a branch in `App`. */
  action: string;
};

type Notices = {
  note: Note | null;
  say: (said: Omit<Note, 'id'>) => void;
  dismiss: () => void;
};

/** Outside the provider — a screen rendered alone in a test — a note is
 *  said to nobody, and nothing breaks. */
const Ctx = createContext<Notices>({ note: null, say: () => {}, dismiss: () => {} });

export function NoticeProvider({ children }: { children: React.ReactNode }) {
  const [note, setNote] = useState<Note | null>(null);
  const n = useRef(0);
  const say = useCallback((said: Omit<Note, 'id'>) => {
    n.current += 1;
    setNote({ ...said, id: n.current });
  }, []);
  const dismiss = useCallback(() => setNote(null), []);
  const value = useMemo(() => ({ note, say, dismiss }), [note, say, dismiss]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useNotice = () => useContext(Ctx);
