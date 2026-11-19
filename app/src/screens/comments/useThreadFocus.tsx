// Landing on one comment (C7b of `docs/comments-plan.md`): a row of
// Activity — "replied to you" — opens the thread and hands over which
// comment it was about (`focus`); this is the thread making that comment
// the first thing the reader sees.
//
// Three things, in order:
//
//   1. It is on the page. A thread mounts ten roots and two answers a
//      branch; the comment may be the fourth answer under the twelfth
//      root. `reveal` says how many roots must be mounted and which
//      branch must be open, and the page folds that into its own two
//      counts — it never closes or unmounts on this file's say-so.
//   2. It is in view. Where it stands is known only once it is laid
//      out: its branch's offset in the scrolling page plus its own
//      offset in the branch, each reported by `onLayout`. When both are
//      in, the page scrolls there — once; a later layout (ten more roots
//      mounting, a keyboard) does not drag the reader back.
//   3. It is lit, for a beat, so the eye lands on it and not on its
//      neighbours — then not, since a row left lit reads as selected.
//
// A comment that is not in the thread — deleted since the row was drawn,
// or by somebody blocked since — does nothing at all: the thread opens
// at its top as it always has, and nothing says why. The row of Activity
// that led here is gone on its next read (`comment_news` holds only what
// still stands).
//
// Weighed and not taken: asking the server for the thread already
// positioned (a page that begins at a comment). The whole thread is in
// hand — it is one flat answer — so where a comment stands is the page's
// to work out, and no second shape of thread has to exist.

import { useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { LayoutChangeEvent, ScrollView } from 'react-native';
import type { Branch } from '../../lib/comments';

/** How long the comment stays lit. A second and a half: the scroll that
 *  brings it into view takes about a third of a second on iOS, which
 *  leaves it lit for a full second at rest — long enough to be found,
 *  short of looking chosen. Not measured on a phone; the owner's eye on
 *  a device is the test. */
export const LIT_MS = 1500;
/** The air left above the comment when the page scrolls to it, so it
 *  does not sit against the header's edge. The row's own top padding. */
const ABOVE = 12;

export function useThreadFocus(focus: string | undefined, branches: readonly Branch[]) {
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  // Where the comment is in the thread: which root, by position and id.
  const at = useMemo(() => {
    if (!focus) return null;
    const index = branches.findIndex((b) => b.root.id === focus || b.replies.some((r) => r.id === focus));
    return index < 0 ? null : { index, root: branches[index].root.id, answer: branches[index].root.id !== focus };
  }, [focus, branches]);

  const [lit, setLit] = useState<string | null>(null);
  const seen = useRef<{ branch?: number; row?: number; done: boolean }>({ done: false });
  const dim = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (dim.current) clearTimeout(dim.current); }, []);

  const land = () => {
    const { branch, row, done } = seen.current;
    if (done || branch === undefined || row === undefined) return;
    seen.current.done = true;
    scroll.current?.scrollTo({ y: Math.max(0, branch + row - ABOVE), animated: true });
    setLit(focus as string);
    dim.current = setTimeout(() => setLit(null), LIT_MS);
  };

  return {
    /** The page's `ScrollView`. */
    scroll,
    /** What must be on the page for the comment to be: how many roots
     *  mounted, and which branch open — none when the comment is itself
     *  a root, whose answers stay folded as they were. Nothing asked
     *  with no comment to land on. */
    reveal: { shown: at ? at.index + 1 : 0, open: at?.answer ? at.root : null },
    /** For a branch's own view: reports where the comment's branch is. */
    branchAt: (rootId: string) => (at && rootId === at.root
      ? (e: LayoutChangeEvent) => { seen.current.branch = e.nativeEvent.layout.y; land(); }
      : undefined),
    /** For a comment's row: whether it is lit, and — for the one to land
     *  on — the report of where it is in its branch. */
    rowProps: (id: string) => ({
      lit: id === lit,
      onLayout: at && id === focus
        ? (e: LayoutChangeEvent) => { seen.current.row = e.nativeEvent.layout.y; land(); }
        : undefined,
    }),
  };
}
