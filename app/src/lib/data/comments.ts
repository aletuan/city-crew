// Comments, on the wire: the functions of 20261118050000_comments and
// the migrations after it, and nothing else. No client reads or writes the two tables — row level
// security is on and there is not one policy — so there is no query
// here, only calls.
//
// The rules about what a flat thread draws as, where a tag begins and
// which refusal is which are `lib/comments`, where Node can hold them to
// the gate. This file turns a `Subject` into the argument its kind
// takes, and the wire's loose JSON into the shapes that module names.
//
// ── where a second kind of subject lands ──
//
// `collectionOf`. Today every subject is a collection and each function
// takes `p_collection`. A check-in is a second member of `Subject` and a
// second parameter on the same functions; the one place that chooses
// between them is here, and no screen changes.

import { supabase } from '../supabase';
import { commentNewsOf, type CommentNews } from '../commentNews';
import { taggableOf, type Taggable } from '../commentTags';
import {
  latestOf, mentionsOf,
  type CommentRow, type Mention, type Preview, type Subject,
} from '../comments';

/** The argument a subject is passed as. One kind, one parameter. */
function collectionOf(subject: Subject): string {
  return subject.id;
}

/** How a thread's roots are ordered. One value today (decision 10);
 *  "top" joins it when comments have hearts, on the server first. */
export type ThreadOrder = 'new';

/**
 * A subject's whole thread, flat, in the server's order: roots newest
 * first, each followed by what was said under it, oldest first.
 * `lib/comments.threadOf` arranges it.
 *
 * Whole, not paged. The function returns every comment on the subject
 * and the screen reveals them a page at a time (`lib/feed`), as Trang cá
 * nhân does: there is no thread yet to measure, and two hundred comments
 * at the 500-character ceiling is a few hundred kilobytes at the very
 * worst — one photograph. A cursor is a
 * parameter added to `comment_thread` when one is (issue #1406 is the
 * same question for the feed).
 *
 * A subject the reader may not see — a list gone private — is an empty
 * thread, not an error: the server answers no rows.
 */
export async function fetchThread(subject: Subject, order: ThreadOrder = 'new'): Promise<CommentRow[]> {
  const { data, error } = await supabase.rpc('comment_thread', {
    p_collection: collectionOf(subject), p_order: order,
  });
  if (error) throw new Error(error.message);
  // The generated types call every column a string; the function returns
  // null for a root's parent and root, and for a name nobody gave. Read
  // as what it is.
  //
  // The hearts are read as untrusted too: a count that is not a number
  // is none, and only `true` is the reader's — which is also what makes
  // a server from before 20261118190000 read as "no hearts" and not as
  // `undefined` drawn in a row.
  type Wire = Omit<CommentRow, 'mentions' | 'likes' | 'liked'> & { mentions: unknown; likes?: unknown; liked?: unknown };
  return ((data ?? []) as unknown as Wire[]).map((r) => ({
    ...r,
    mentions: mentionsOf(r.mentions),
    likes: typeof r.likes === 'number' ? r.likes : 0,
    liked: r.liked === true,
  }));
}

/**
 * What each card shows of its thread: a count and the two newest, for a
 * whole batch of subjects in one call, keyed by the subject's id.
 *
 * A subject with no comments is not in the answer — the server returns a
 * row only where there is something to count — so a missing key is
 * "none", and the card draws nothing about comments but the way in.
 *
 * Nothing is asked for an empty batch.
 */
export async function fetchPreviews(subjects: readonly Subject[]): Promise<Record<string, Preview>> {
  if (!subjects.length) return {};
  const { data, error } = await supabase.rpc('comment_previews', {
    p_collections: subjects.map(collectionOf),
  });
  if (error) throw new Error(error.message);
  const out: Record<string, Preview> = {};
  // `off` only on the word `true`: a server from before 20261119070000
  // sends no such column, and every thread was open then.
  for (const r of data ?? []) {
    out[r.collection_id] = { n: r.n, latest: latestOf(r.latest), off: r.off === true };
  }
  return out;
}

/**
 * Post a comment, or an answer to `parentId`, and hand back its id.
 *
 * A refusal throws the server's own word for it — `comment:cap`,
 * `comment:banned` and the rest — which `lib/comments.refusalOf` reads
 * back into a name the screen has a sentence for. It is not rewrapped
 * here: the message *is* the name, and a failure that is not a refusal
 * (no network, no function) travels the same way and reads as null
 * there.
 *
 * A tag is sent as where it is and what it points at; the handle on a
 * `Mention` is the server's to fill on the way back, and is left off.
 */
export async function postComment(
  subject: Subject, parentId: string | null, body: string, mentions: readonly Mention[] = [],
): Promise<string> {
  const { data, error } = await supabase.rpc('post_comment', {
    p_collection: collectionOf(subject),
    // The generated type says `string`; the function takes null for a
    // comment that answers nobody.
    p_parent: parentId as string,
    p_body: body,
    p_mentions: mentions.map((m) => (m.person !== null
      ? { at: m.at, len: m.len, person: m.person }
      : { at: m.at, len: m.len, place: m.place })),
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Take a comment back: yours, or one on your own list — and with it
 * everything said under it (20261118150000). Deleting one that is not
 * there is not an error on the server, so a second press here is not
 * one either.
 */
export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_comment', { p_id: id });
  if (error) throw new Error(error.message);
}

/**
 * Set the reader's heart on a comment, or take it back. The server's
 * function is idempotent both ways, so a retry lands where the reader
 * meant; a refusal — the comment was deleted a moment ago, its writer
 * and the reader are blocked — throws the server's word, as a post's
 * does.
 */
export async function likeComment(id: string, on: boolean): Promise<void> {
  const { error } = await supabase.rpc('like_comment', { p_id: id, p_on: on });
  if (error) throw new Error(error.message);
}

/**
 * Whom and what the reader may tag in a comment on this subject: the
 * people `post_comment` would accept and the list's places. Nobody and
 * nowhere for a guest, or on a subject no comment could be written on —
 * the server answers empty there, not with a refusal.
 */
export async function fetchTaggable(subject: Subject): Promise<Taggable> {
  const { data, error } = await supabase.rpc('comment_taggable', { p_collection: collectionOf(subject) });
  if (error) throw new Error(error.message);
  return taggableOf(data);
}

/**
 * Close a subject's thread to new comments, or open it again. The
 * owner's alone: the write goes to their own row, and row level security
 * makes anybody else's change nothing — which is why a write that
 * changed no row throws here, so a stranger's switch does not look
 * thrown.
 */
export async function setCommentsOff(subject: Subject, off: boolean): Promise<void> {
  const { data, error } = await supabase
    .from('collections')
    .update({ comments_off: off })
    .eq('id', collectionOf(subject))
    .select('id');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('comment:subject');
}

/**
 * What happened to the reader in comments since `sinceISO`: a tag, a
 * reply, a comment on their list, hearts on their comment — the rows
 * Activity draws (`lib/commentNews`). Nothing for a guest; the server
 * answers empty there, as it does for a reader with no news.
 */
export async function fetchCommentNews(sinceISO: string): Promise<CommentNews[]> {
  const { data, error } = await supabase.rpc('comment_news', { p_since: sinceISO });
  if (error) throw new Error(error.message);
  return commentNewsOf(data);
}
