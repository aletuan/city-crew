// What a card on a person's page shows of its collection's thread, and
// the press that opens it (C3b of `docs/comments-plan.md`).
//
// One ask for every card drawn (`usePreviewsQuery`), and one answer per
// card: the props `ActivityCard` takes for comments, or none. None is
// most of the time — the `comments` switch ships off, and a collection
// that is not public has no thread (`comment_subject_visible`) — and
// then the card draws nothing about comments and nothing is asked.
//
// Here, not in `Shared`, so that the feed's function does not grow a
// branch for a feature that is a switch away from not existing.
//
// A press on a card's bubble opens that collection's thread — or, while
// nobody has commented on it, raises the field over the feed so the
// first comment is written there (`components/CommentQuick`, owner, 18
// Nov 2026). The field is the app's one, mounted above the navigator.

import { quickOrThread, useQuickComment } from '../../components/CommentQuick';
import { useSession } from '../../lib/auth';
import { usePreviewsQuery } from '../../lib/data';
import type { Preview } from '../../lib/comments';
import { useFlag } from '../../lib/useFlag';
import type { Collection } from '../../lib/types';

export type CardComments = { comments?: Preview; onComments?: () => void; commentsOff?: boolean };

export function useCardComments(
  /** The collections whose cards are drawn. */
  drawn: readonly Collection[],
  /** Whether a collection has a thread: public, as the page reads it. */
  hasThread: (c: Collection) => boolean,
  /** What a collection is called, for the line above the field. */
  nameOf: (c: Collection) => string,
  /** Opens a collection's thread; absent where the page has no way to. */
  open?: (c: Collection) => void,
): (c: Collection) => CardComments {
  const on = useFlag('comments') && !!open;
  const { session } = useSession();
  const me = session?.user?.id ?? null;
  const ids = on ? drawn.filter((c) => c.id && hasThread(c)).map((c) => c.id as string) : [];
  const previews = usePreviewsQuery(ids);
  const quick = useQuickComment();
  return (c) => {
    const id = c.id;
    if (!on || !id || !hasThread(c)) return {};
    const comments = previews.data[id];
    // A thread closed with nothing in it has no way in from a card: there
    // is nothing to read and nothing may be written. The bubble is still
    // drawn, dimmed — taken away, the card's foot shifted (owner, 19 Nov
    // 2026). (Its owner reaches the switch from the list's own page —
    // `CommentsDoor`.)
    if (comments?.off && comments.n === 0) return { comments, commentsOff: true };
    return {
      comments,
      onComments: () => (quick && quickOrThread({
        me, n: comments?.n ?? 0, loaded: previews.loaded, loading: previews.loading, off: comments?.off,
      }) === 'quick'
        ? quick({ kind: 'collection', id }, nameOf(c))
        : (open as (c: Collection) => void)(c)),
    };
  };
}
