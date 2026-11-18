// Comments, as arithmetic rather than as a screen (C2 of
// `docs/comments-plan.md`).
//
// The server hands a thread back flat — every comment on a subject, in
// one list (`comment_thread`, 20261118050000). Everything a screen needs
// to draw that list is a shape question: which comment sits under which,
// how far in, which rows are a "deleted" line and which are nothing at
// all, where in a body a tag begins. Each is easier to get wrong in a
// component than to prove here. Same trade `lib/shares` makes: no React,
// no Supabase, so a Node process can hold it to the truth.
//
// ── a comment does not know what a collection is ──
//
// It hangs on a `Subject`. Today there is one kind. The next (a
// check-in, step 3 of the feed plan) is a member added to that union and
// a branch in `lib/data/comments.ts`; nothing in this file, and nothing
// that draws a thread, names a collection.
//
// ── three levels, however deep the talk goes ──
//
// The database keeps the true depth. The screen draws three levels —
// a comment, an answer to it, an answer to that — and anything deeper
// stays on the third, carrying the name of who it answers (decision 2).
// Each level costs the column an indent, and a phone has few to give:
// Facebook stops at the same three for the same reason. The indent
// itself is the screen's number (C3), not this file's.
//
// ── characters, not UTF-16 units ──
//
// Postgres counts a body in characters (`char_length`) and stores a tag
// as a character offset. A JavaScript string indexes UTF-16 code units,
// so "🍜 @trang" has its `@` at character 2 and at index 3. Every length
// and offset in this file is in characters, by way of `Array.from`; a
// tag cut with `slice` on the string itself would be one letter off
// after every emoji before it.

/** What a comment is about. One kind today; see the head of this file. */
export type Subject = { kind: 'collection'; id: string };

/** The longest a comment may be, in characters. The server's number
 *  (`post_comment`, decision 7); here so the composer counts to the same
 *  one and refuses before the network does. */
export const BODY_MAX = 500;

/** The most tags one comment may carry. The server's number. */
export const MENTIONS_MAX = 10;

/** The deepest level drawn: 0 a comment, 1 an answer, 2 everything under. */
export const LEVEL_MAX = 2;

/** A tag: a stretch of the body that is a person or a place. */
export type Mention = {
  /** Where it starts, in characters. */
  at: number;
  /** How many characters. */
  len: number;
  person: string | null;
  /** The person's handle as it is today, which may not be the text tagged. */
  handle: string | null;
  place: string | null;
};

/** One comment, as `comment_thread` returns it. */
export type CommentRow = {
  id: string;
  parent_id: string | null;
  root_id: string | null;
  depth: number;
  /** Null when `gone`. */
  body: string | null;
  created_at: string;
  /** Deleted, or by somebody blocked from the reader — the server does
   *  not say which, on purpose. */
  gone: boolean;
  author: string | null;
  handle: string | null;
  full_name: string | null;
  avatar_url: string | null;
  mentions: Mention[];
};

/** A comment placed for drawing. */
export type Placed = CommentRow & {
  /** 0, 1 or 2 — how far in it is drawn. */
  level: number;
  /** The handle of who it answers, when the indent alone no longer says:
   *  a comment deeper than the last level drawn. Null otherwise — and
   *  null when that comment is gone, since a gone row has no handle. */
  to: string | null;
};

/** A comment on the subject itself, and everything said under it. */
export type Branch = { root: Placed; replies: Placed[] };

/** How long a body is as the server will count it. */
export function bodyLength(body: string): number {
  return Array.from(body).length;
}

/**
 * The tags of a row, from whatever the wire carried.
 *
 * `mentions` crosses as JSON, which the generated types call `Json` and
 * which is whatever the function built — so it is read as untrusted
 * shape: not a list is no tags, and an entry without two numbers and
 * exactly one target is dropped rather than drawn as a link to nowhere.
 */
export function mentionsOf(raw: unknown): Mention[] {
  if (!Array.isArray(raw)) return [];
  const out: Mention[] = [];
  for (const m of raw as Record<string, unknown>[]) {
    if (!m || typeof m.at !== 'number' || typeof m.len !== 'number') continue;
    const person = typeof m.person === 'string' ? m.person : null;
    const place = typeof m.place === 'string' ? m.place : null;
    if ((person === null) === (place === null)) continue;
    out.push({ at: m.at, len: m.len, person, place, handle: typeof m.handle === 'string' ? m.handle : null });
  }
  return out;
}

/**
 * A flat thread, arranged for drawing.
 *
 * Roots keep the order they came in — the server's, newest first
 * (decision 10); a second order is a second value of its parameter, not
 * a sort here. Under a root:
 *
 *   - its direct answers, in the order they came (oldest first);
 *   - after each, everything said beneath that answer, oldest first, at
 *     the last level — the flattening the head of this file describes.
 *
 * ── what is not drawn ──
 *
 * A `gone` comment with nothing living under it. The server already
 * deletes a deleted comment nobody answered; what still arrives here is
 * the comment of somebody blocked, which comes back gone *with* or
 * without answers, and a branch whose every answer is also gone. Either
 * would draw as a "deleted" line answering to nothing. Gone and
 * answered by somebody living, it stays, as the line the answers hang
 * from.
 *
 * A comment whose parent is not in the list is dropped with it: there is
 * no honest place to draw an answer to nothing. That is a thread read
 * while it was being pruned, and the next read is whole.
 */
export function threadOf(rows: readonly CommentRow[]): Branch[] {
  const kids = new Map<string, CommentRow[]>();
  const byId = new Map<string, CommentRow>();
  for (const r of rows) {
    byId.set(r.id, r);
    if (r.parent_id === null) continue;
    const list = kids.get(r.parent_id);
    if (list) list.push(r); else kids.set(r.parent_id, [r]);
  }

  // Whether anything living is at or under a comment. Remembered, since
  // every ancestor asks about the same subtree.
  const living = new Map<string, boolean>();
  const lives = (r: CommentRow): boolean => {
    const known = living.get(r.id);
    if (known !== undefined) return known;
    const yes = !r.gone || (kids.get(r.id) ?? []).some(lives);
    living.set(r.id, yes);
    return yes;
  };

  const place = (r: CommentRow, level: number): Placed => {
    const parent = r.depth > LEVEL_MAX && r.parent_id ? byId.get(r.parent_id) : undefined;
    return { ...r, level, to: parent ? parent.handle : null };
  };

  // Everything under a comment, oldest first whatever it answers.
  const under = (r: CommentRow, into: CommentRow[]): CommentRow[] => {
    for (const k of kids.get(r.id) ?? []) {
      if (!lives(k)) continue;
      into.push(k);
      under(k, into);
    }
    return into;
  };

  const out: Branch[] = [];
  for (const r of rows) {
    if (r.parent_id !== null || !lives(r)) continue;
    const replies: Placed[] = [];
    for (const a of kids.get(r.id) ?? []) {
      if (!lives(a)) continue;
      replies.push(place(a, 1));
      const deeper = under(a, []).sort((x, y) => (x.created_at < y.created_at ? -1 : x.created_at > y.created_at ? 1 : 0));
      for (const d of deeper) replies.push(place(d, LEVEL_MAX));
    }
    out.push({ root: place(r, 0), replies });
  }
  return out;
}

/** How many comments a thread holds, as the card counts them: the living
 *  ones. A "deleted" line is drawn and is not a comment. */
export function livingCount(rows: readonly CommentRow[]): number {
  return rows.reduce((n, r) => n + (r.gone ? 0 : 1), 0);
}

/** A stretch of a body: plain words, or a tag to press. */
export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'person'; text: string; id: string; handle: string | null }
  | { kind: 'place'; text: string; id: string };

/**
 * A body cut into words and tags, in reading order.
 *
 * Offsets are characters (see the head of this file). A tag that runs
 * past the end, or begins inside the one before it, is skipped and its
 * text stays plain: the server refuses both (`post_comment`), so one
 * arriving is a body and its tags out of step, and plain words are the
 * honest drawing of that.
 */
export function segmentsOf(body: string, mentions: readonly Mention[]): Segment[] {
  const chars = Array.from(body);
  const out: Segment[] = [];
  let at = 0;
  const words = (to: number) => {
    if (to > at) out.push({ kind: 'text', text: chars.slice(at, to).join('') });
  };
  for (const m of [...mentions].sort((a, b) => a.at - b.at)) {
    if (m.at < at || m.len < 1 || m.at + m.len > chars.length) continue;
    words(m.at);
    const text = chars.slice(m.at, m.at + m.len).join('');
    // `mentionsOf` lets through exactly one of the two; a tag built by
    // hand with neither is words.
    if (m.person !== null) out.push({ kind: 'person', text, id: m.person, handle: m.handle });
    else if (m.place !== null) out.push({ kind: 'place', text, id: m.place });
    else out.push({ kind: 'text', text });
    at = m.at + m.len;
  }
  words(chars.length);
  return out;
}

/**
 * Why the server would not take a comment — the word after `comment:` in
 * what `post_comment` and `delete_comment` raise. A name, not a
 * sentence, as `DAILY_LIMIT` is; the screen has the words.
 *
 *   signed_out  nobody is signed in
 *   subject     the list is gone, or private, or its owner and you are blocked
 *   off         the owner has turned comments off
 *   empty       nothing but spaces
 *   long        over `BODY_MAX`
 *   banned      a word the desk keeps out
 *   cap         thirty today already
 *   parent      the comment answered is gone, or its writer and you are blocked
 *   mention     a tag the rules do not allow
 *   not_yours   deleting a comment that is neither yours nor on your list
 */
export const REFUSALS = [
  'signed_out', 'subject', 'off', 'empty', 'long', 'banned', 'cap', 'parent', 'mention', 'not_yours',
] as const;
export type Refusal = (typeof REFUSALS)[number];

/** The refusal a thrown error names, or null when it is a failure — a
 *  dropped connection, a function that is not there — and not the rules
 *  working. */
export function refusalOf(e: unknown): Refusal | null {
  if (!(e instanceof Error) || !e.message.startsWith('comment:')) return null;
  const word = e.message.slice('comment:'.length) as Refusal;
  return REFUSALS.includes(word) ? word : null;
}

/** What a card shows of a thread without opening it. */
export type Preview = {
  /** How many living comments the reader may see. */
  n: number;
  /** The two newest, newest first. */
  latest: PreviewComment[];
};

export type PreviewComment = {
  id: string;
  body: string;
  created_at: string;
  author: string | null;
  handle: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

/** The previews of a card from the wire's JSON; anything without an id
 *  and a body is not a comment to draw. */
export function latestOf(raw: unknown): PreviewComment[] {
  if (!Array.isArray(raw)) return [];
  const text = (v: unknown) => (typeof v === 'string' ? v : null);
  const out: PreviewComment[] = [];
  for (const c of raw as Record<string, unknown>[]) {
    if (!c || typeof c.id !== 'string' || typeof c.body !== 'string') continue;
    out.push({
      id: c.id, body: c.body, created_at: text(c.created_at) ?? '',
      author: text(c.author), handle: text(c.handle),
      full_name: text(c.full_name), avatar_url: text(c.avatar_url),
    });
  }
  return out;
}
