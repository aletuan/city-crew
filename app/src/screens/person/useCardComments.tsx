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

import { usePreviewsQuery } from '../../lib/data';
import type { Preview } from '../../lib/comments';
import { useFlag } from '../../lib/useFlag';
import type { Collection } from '../../lib/types';

export type CardComments = { comments?: Preview; onComments?: () => void };

export function useCardComments(
  /** The collections whose cards are drawn. */
  drawn: readonly Collection[],
  /** Whether a collection has a thread: public, as the page reads it. */
  hasThread: (c: Collection) => boolean,
  /** Opens a collection's thread; absent where the page has no way to. */
  open?: (c: Collection) => void,
): (c: Collection) => CardComments {
  const on = useFlag('comments') && !!open;
  const ids = on ? drawn.filter((c) => c.id && hasThread(c)).map((c) => c.id as string) : [];
  const previews = usePreviewsQuery(ids).data;
  return (c) => (on && c.id && hasThread(c)
    ? { comments: previews[c.id], onComments: () => (open as (c: Collection) => void)(c) }
    : {});
}
