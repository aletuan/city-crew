// What is new for the reader in comments, held once for the whole app:
// the rows, and the mark that says which of them Activity has shown.
// C7c of docs/comments-plan.md; the arithmetic is `lib/commentNews`.
//
// ── one copy, at the root ──
//
// Three places read it. The last tab wears a dot for a reply, a tag or
// a comment not yet seen; the bell on the reader's own page wears the
// same dot (docs/profile-home-plan.md, section 3: every reason for the
// tab's dot is in sight on that page); and Activity draws the rows and
// moves the mark. From three copies the tab could say "new" while the
// bell said nothing, for as long as their fetches differed. From one,
// the two dots are one number and cannot disagree.
//
// ── the mark is on the phone (owner, 19 Nov 2026) ──
//
// Kept per account in the phone's storage. A new phone therefore finds
// two weeks of rows new, once. On the server it would be a table, kept
// for one dot.
//
// Until the phone has read what it remembers, nothing is new: before
// that every row looks unseen, and the dot would light on every launch
// and go out a moment later.
//
// ── when it is asked again ──
//
// With no push (C11), the dot is only as fresh as the last ask. It is
// asked at launch, after a comment is written anywhere in the app
// (`useCommentNewsQuery`), on coming back to the app, and on a change of
// tab — the last two only once the answer is two minutes old
// (`lib/stale`), the rule the crew's and the invitations' dots keep.
// Activity asks again each time it opens, stale or not: the page that
// moves the mark should move it past what is there now.

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { AppState } from 'react-native';
import { useSession } from './auth';
import { type CommentNews, freshNews, newerThan } from './commentNews';
import { type Fetch, useCommentNewsQuery } from './data';
import { shouldRefresh } from './stale';
import { type Codec, useStored } from './stored';
import { useFlag } from './useFlag';

export type FreshNews = {
  /** The reader's comment news over Activity's window. */
  news: Fetch<CommentNews[]>;
  /** The time of the newest row Activity has shown, or null for never. */
  mark: string | null;
  /** The phone has said what it remembers: `mark` can be believed. */
  read: boolean;
  /** Replies, tags and comments later than the mark — the dot. */
  fresh: number;
  /** Activity has shown rows up to this time. */
  see: (at: string) => void;
  /** Ask again, if the answer has gone stale and is not being asked. */
  freshen: () => void;
};

const NO_NEWS: Fetch<CommentNews[]> = {
  loading: true, loaded: false, error: null, data: [], loadedAt: null, fromCache: false, reload: () => {},
};
const NOTHING: FreshNews = { news: NO_NEWS, mark: null, read: false, fresh: 0, see: () => {}, freshen: () => {} };
const Ctx = createContext<FreshNews>(NOTHING);

/** A time, stored as itself. Text that is not one is not a mark: read as
 *  a time it would be NaN, later than nothing, and no row new again. */
const MARK: Codec<string | null> = {
  parse: (raw) => (Number.isNaN(Date.parse(raw)) ? undefined : raw),
  format: (value) => value ?? '',
};

/** Per account, so the next person on this phone has their own. */
export const markKey = (me: string | null) => (me ? `activity:seen:${me}` : null);

export function FreshNewsProvider({ children }: { children: React.ReactNode }) {
  const { ready, session } = useSession();
  const me = ready ? session?.user?.id ?? null : null;
  const news = useCommentNewsQuery(me, useFlag('comments'));
  const [mark, remember, origin] = useStored<string | null>(markKey(me), null, MARK);
  // Signed out there is no key, and a read with no key never ends
  // (`useStored`): `read` says "somebody is signed in" as well.
  const read = origin !== 'reading';

  const latest = useRef(news);
  latest.current = news;
  const freshen = useCallback(() => {
    const f = latest.current;
    if (!f.loading && shouldRefresh(f.loadedAt, Date.now())) f.reload();
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => { if (next === 'active') freshen(); });
    return () => sub.remove();
  }, [freshen]);

  // Forward only: a row older than the mark, shown again, does not make
  // what came after it new.
  const see = useCallback((at: string) => { if (newerThan(at, mark)) remember(at); }, [mark, remember]);

  const fresh = read ? freshNews(news.data, mark) : 0;
  const value = useMemo<FreshNews>(() => ({ news, mark, read, fresh, see, freshen }),
    // Each field rather than the wrapper: a Fetch object is new every
    // render (`lib/invitations` has the same list, and why).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [news.data, news.loading, news.loaded, news.error, news.loadedAt, news.reload, mark, read, fresh, see, freshen]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useFreshNews = () => useContext(Ctx);

/**
 * For Activity's rows: says which are new, and moves the mark past them.
 *
 * `newest` is the time of the latest row the page is showing. New is
 * judged against the mark as it stood when the page opened, kept for
 * the visit — the mark itself moves at once, and judged against that
 * the dots would be drawn and gone in the same breath.
 *
 * The news is asked again as the page opens, and the mark waits for
 * that answer. The page's own three fetches are fresh at that moment
 * and the shared news may be minutes old: moved past a like of a second
 * ago, the mark would also pass a reply of a minute ago that this phone
 * has not been told of yet, and that reply would never be new. An ask
 * that fails moves nothing; the dot stays for the next visit.
 */
export function useSeenThrough(newest: string | null): (at: string) => boolean {
  const { news, mark, read, see } = useFreshNews();
  const [before, setBefore] = useState<{ mark: string | null } | null>(null);
  // Set during render, React's pattern for state taken once from a value
  // that arrives late: an effect would paint a frame with no row new.
  if (read && before === null) setBefore({ mark });

  const [opened] = useState(() => Date.now());
  const { loadedAt } = news;
  const ask = useRef(news.reload);
  ask.current = news.reload;
  // Once, as the page opens. Not on `reload`'s identity: that changes
  // when a comment is written, and the query asks again for itself then.
  useEffect(() => { ask.current(); }, []);
  const current = loadedAt !== null && loadedAt >= opened;
  useEffect(() => {
    if (current && read && newest !== null) see(newest);
  }, [current, read, newest, see]);

  return useCallback((at: string) => before !== null && newerThan(at, before.mark), [before]);
}
