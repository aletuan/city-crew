// The hearts on a thread's comments, as the reader's own presses have
// left them (owner, 18 Nov 2026).
//
// ── drawn before the answer ──
//
// A heart fills on the press and the figure moves with it; the server
// is told behind that (`like_comment`). A like is the one act on a
// comment that can be drawn ahead of the server — writing one cannot,
// since the server decides whether a comment exists — because nothing
// about it is the server's to decide: it is the reader's own row, by
// its key, set or not.
//
// What is drawn is the thread's answer with the reader's presses laid
// over it (`lib/comments.heartsAfter`). The presses are kept beside the
// moment the answer they were laid over arrived (`loadedAt`), and an
// answer that arrives later is drawn as it is: it already has them.
// That is a comparison in render, not an effect that clears state — the
// stale presses are simply not the ones for this answer.
//
// The thread is not asked again after a like. Nothing else on the page
// changes with one, and the card's count is of comments, not of hearts.
//
// ── when the server says no ──
//
// The press is taken back off the page and nothing is said: the comment
// was deleted a moment ago, or the connection dropped, and a heart that
// quietly empties again is the size of that. An alert for a like would
// be louder than the like.
//
// "Taken back" is the press lifted, so the row draws the thread's own
// answer again — not the hearts as they stood before the press put back
// by hand, which after two quick presses would be the first one's guess.
// And a refusal that lands after a newer answer has arrived changes
// nothing: that answer is already the truth, and the reader may have
// pressed on it since.
//
// Signed out, a press raises the sign-in sheet and draws nothing.
//
// The tap under the thumb is fired here and not by the heart
// (`LikeHeart` asks its caller to): only a press that is a like has one,
// and a guest's is a question.

import { useState } from 'react';
import { fireHaptic } from '../../components/ui';
import { heartsAfter, type Hearts, type Placed } from '../../lib/comments';
import { likeComment } from '../../lib/data';

type Laid = { over: number | null; by: Record<string, Hearts> };

export function useCommentHearts(
  /** Who is reading, or nobody. */
  me: string | null,
  /** When the thread's answer arrived — what the presses are laid over. */
  loadedAt: number | null,
  /** What a guest's press does. */
  askIn: () => void,
) {
  const [laid, setLaid] = useState<Laid>({ over: loadedAt, by: {} });
  const by = laid.over === loadedAt ? laid.by : {};

  const heartsOf = (c: Placed): Hearts => by[c.id] ?? { likes: c.likes, liked: c.liked };

  const toggle = (c: Placed) => {
    if (!me) { askIn(); return; }
    fireHaptic('light');
    const was = heartsOf(c);
    const now = heartsAfter(was, !was.liked);
    setLaid((l) => ({ over: loadedAt, by: { ...(l.over === loadedAt ? l.by : {}), [c.id]: now } }));
    likeComment(c.id, now.liked).catch(() => setLaid((l) => {
      if (l.over !== loadedAt || !(c.id in l.by)) return l;
      const rest = { ...l.by };
      delete rest[c.id];
      return { over: l.over, by: rest };
    }));
  };

  return { heartsOf, toggle };
}
