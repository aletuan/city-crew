// What happened to you in comments, as the Activity screen draws it
// (docs/comments-plan.md, "Về thông báo" and C7b).
//
// The server works the rows out when they are asked for
// (`comment_news`, 20261119080000): a tag, a reply to your comment, a
// comment on your list, hearts on your comment — one row a comment and
// a reader, by the strongest reason. This file reads that answer and
// says where each row of Activity stands on the page.
//
// ── two groups, and which row is in which (owner, 19 Nov 2026) ──
//
// Activity was one timeline of everything between you and other people,
// your own acts with theirs (28 Oct 2026). It is about to be opened from
// a bell (`docs/profile-home-plan.md`), and a bell means "this is for
// you": a reply found third among nine lines of "You liked…" is a
// reply not found. So the page is two groups —
//
//   for you   what somebody else did: a like or a copy of your list, a
//             friend request of yours accepted, and the four kinds of
//             comment news
//   yours     what you did: your likes, your copies, a request you
//             accepted
//
// — each newest first, the first above the second. Weighed and not
// taken: one timeline with the new rows where their times put them (the
// reply buried, as above), and two pages or tabs (a second place to
// look, for a page that usually holds a screenful).
//
// A friendship is in the group of whoever said yes. "X accepted your
// request" is theirs to have done and news to you; "You and X are now
// friends" is the line for the request you accepted, which you did.

import type { ActivityItem } from './friends';

/** Why a comment is news to the reader. */
export type NewsKind = 'tag' | 'reply' | 'on_list' | 'heart';
const KINDS: readonly NewsKind[] = ['tag', 'reply', 'on_list', 'heart'];

/** The list a comment is on, with the columns its name is read from. */
export type NewsList = { id: string; slug: string; title_en: string | null; title_vi: string | null; title_ja: string | null };

/** One row of `comment_news`. */
export type CommentNews = {
  kind: NewsKind;
  comment_id: string;
  list: NewsList;
  /** Who did it — for hearts, the latest of them. */
  actor: string | null;
  handle: string | null;
  full_name: string | null;
  avatar_url: string | null;
  /** The comment's words: the one written, or for hearts the one liked. */
  body: string;
  at: string;
  /** Hearts only: how many more people liked it than the one named. */
  others: number;
};

const text = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/**
 * `comment_news`'s answer, read as untrusted: a row needs a kind this
 * build knows, a comment, a list with an id, and a time — one without is
 * skipped, so a kind a later server adds is not drawn as something else.
 */
export function commentNewsOf(raw: unknown): CommentNews[] {
  if (!Array.isArray(raw)) return [];
  const out: CommentNews[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    if (!r || !KINDS.includes(r.kind as NewsKind)) continue;
    const list = (r.list && typeof r.list === 'object' ? r.list : {}) as Record<string, unknown>;
    if (typeof r.comment_id !== 'string' || typeof r.at !== 'string' || typeof list.id !== 'string') continue;
    out.push({
      kind: r.kind as NewsKind,
      comment_id: r.comment_id,
      list: {
        id: list.id, slug: text(list.slug) ?? '',
        title_en: text(list.title_en), title_vi: text(list.title_vi), title_ja: text(list.title_ja),
      },
      actor: text(r.actor), handle: text(r.handle), full_name: text(r.full_name), avatar_url: text(r.avatar_url),
      body: text(r.body) ?? '',
      at: r.at,
      others: typeof r.others === 'number' && r.others > 0 ? Math.floor(r.others) : 0,
    });
  }
  return out;
}

/** A row of Activity: one of the page's own, or one of comment news. */
export type ActivityEntry =
  | { from: 'log'; at: string; item: ActivityItem }
  | { from: 'comments'; at: string; news: CommentNews };

/** Whether one of the page's own rows is somebody else's doing. */
function theirs(item: ActivityItem): boolean {
  if (item.kind === 'applause' || item.kind === 'copy') return true;
  return item.kind === 'friend' && item.asked === 'you';
}

/**
 * The page's two groups, each newest first — see the head of this file.
 *
 * Comment news from before `sinceISO` is left out, as the page's own
 * rows already are: the two are asked at different moments, and the
 * page says "the last two weeks" once.
 */
export function activityGroups(
  items: readonly ActivityItem[], news: readonly CommentNews[], sinceISO: string,
): { forYou: ActivityEntry[]; yours: ActivityEntry[] } {
  const forYou: ActivityEntry[] = [];
  const yours: ActivityEntry[] = [];
  for (const item of items) (theirs(item) ? forYou : yours).push({ from: 'log', at: item.at, item });
  for (const n of news) if (n.at >= sinceISO) forYou.push({ from: 'comments', at: n.at, news: n });
  const newest = (a: ActivityEntry, b: ActivityEntry) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);
  return { forYou: forYou.sort(newest), yours: yours.sort(newest) };
}

// ── what is new (C7c; owner, 19 Nov 2026) ──
//
// The rows are worked out when asked for, so no row has a "read" of its
// own (rule 5 of the plan). What the phone keeps instead is one mark:
// the time of the newest row Activity has shown. A row later than the
// mark is new.
//
// The mark is a row's own `at` — the server's clock — and never the
// phone's "now". Rows are compared with rows, so a phone whose clock is
// wrong, or which crossed a time zone, marks nothing new or old by it.
// Weighed and not taken: the moment Activity was opened, by the phone's
// clock. Five minutes fast, and every reply of the next five minutes
// would arrive already seen.

/** Whether a row is later than the mark. Nothing marked yet — a phone
 *  meeting the account for the first time — and every row is. */
export function newerThan(at: string, mark: string | null): boolean {
  return mark === null || Date.parse(at) > Date.parse(mark);
}

/**
 * How many rows call for the dot on the last tab and on the bell: a
 * tag, a reply, or a comment on the reader's list, later than the mark.
 *
 * Not a heart (owner, 19 Nov 2026): a heart is good news, and nothing
 * to answer. Its row is still marked new on the page; it does not send
 * anybody there.
 */
export function freshNews(news: readonly CommentNews[], mark: string | null): number {
  return news.filter((n) => n.kind !== 'heart' && newerThan(n.at, mark)).length;
}

/** The latest time among rows, or null for none: what the mark moves to. */
export function newestAt(rows: readonly { at: string }[]): string | null {
  let best: string | null = null;
  for (const r of rows) if (best === null || Date.parse(r.at) > Date.parse(best)) best = r.at;
  return best;
}
