// Writing in a thread: whom the field's next words answer, the press
// that chooses that, and sending. Lifted out of `CommentsScreen` on 19
// Nov 2026, when the owner's side of the thread (`useThreadOwner`) put
// the page's function a line over its ceiling; this is the part of it
// that is one thing — the reasons for how it behaves are at the head of
// the page, where they were.

import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import type { Mention, Placed, Subject } from '../../lib/comments';
import { commentsChanged } from '../../lib/commentsChanged';
import { postComment } from '../../lib/data';
import { normalizeHandle } from '../../lib/handle';

export function useThreadWriting(subject: Subject, me: string | null, askIn: () => void) {
  // The comment the field's next words answer, or none.
  const [replyTo, setReplyTo] = useState<Placed | null>(null);
  const field = useRef<React.ComponentRef<typeof TextInput>>(null);
  const nameOf = (c: Placed) => (c.handle ? normalizeHandle(c.handle) : c.full_name ?? '');
  const reply = (c: Placed) => {
    if (!me) { askIn(); return; }
    setReplyTo(c);
    field.current?.focus();
  };
  const send = async (body: string, mentions: Mention[]) => {
    await postComment(subject, replyTo ? replyTo.id : null, body, mentions);
    setReplyTo(null);
    // The keyboard goes down once the words are sent (owner, on a phone,
    // 19 Nov 2026): it was left up, over the half of the page where the
    // comment just written appears, and had to be put away by hand. This
    // is a thread, not a chat — Instagram, TikTok and YouTube drop theirs
    // on a comment for the same reason, and Messages keeps its own
    // because the next line there is usually yours. Only on a comment
    // the server took: a refusal throws above, and the field keeps its
    // words and its keyboard so they can be mended.
    field.current?.blur();
    commentsChanged();
  };
  return {
    /** Whom the field says it is answering, or nobody. */
    replyTo: replyTo ? { who: nameOf(replyTo) } : null,
    field,
    reply,
    send,
    cancelReply: () => setReplyTo(null),
  };
}
