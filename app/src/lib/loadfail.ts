// What went wrong with a read, named — so a screen never prints the
// server's words to somebody who did not write them.
//
// ── the two screenshots this came from ──
//
// "Không tải được địa điểm: JWT expired" and "…appears to be offline.
// (at ExpoModulesCore/Promise.swift:56)". Both are `error.message`,
// passed straight through `usePersistedFetch` and interpolated into a
// sentence. Both name a fault the reader cannot act on in words they
// cannot read, and both hid a catalog the app was already holding.
//
// So a read failure gets a name here, the way `authfail` names a sign-in
// failure, and the screens speak from the name. Three names is the whole
// list, because three is how many different things a reader should be
// told:
//
//     offline    you are not connected — check, then try again
//     expired    the session lapsed while the phone was away; the app
//                signs back in by itself, and the read is retried for
//                you (see `CatalogProvider`)
//     other      it did not work; try again
//
// Anything unrecognised is `other`, not null: a read has one remedy
// whatever the cause, and "try again" is it. That is the opposite of
// `authfail`'s rule, and rightly — there, the server's sentence tells
// two different problems apart and the reader must act differently on
// each; here, the reader's only move is the same in every case.
//
// No imports, so it runs in a plain Node test.

export type LoadFail = 'offline' | 'expired' | 'other';

/**
 * How a dropped connection reads on the platforms this ships on.
 *
 * `Network request failed` is React Native's own; `Failed to fetch` and
 * `NetworkError` are the web's, seen in the web build. The two long
 * sentences are iOS's, surfaced through Expo's fetch as the message the
 * reader saw — NSURLError's `-1009` and `-1005`, in prose. Timeouts are
 * the connection dropping slowly rather than at once, and are the same
 * thing to tell somebody.
 */
const OFFLINE = /network request failed|failed to fetch|networkerror|internet connection appears to be offline|not connected to the internet|network connection was lost|timed out|timeout/i;

/**
 * An access token that lapsed. PostgREST says `JWT expired` with code
 * `PGRST301`; auth-js says `Invalid JWT` or `token is expired`. Any of
 * them means the same thing: the read was made a moment before the
 * refresh that was already on its way.
 */
const EXPIRED = /jwt expired|pgrst301|invalid jwt|jwt is expired|token is expired/i;

/** Whether this message is a connection that was not there. Shared with
 *  `authfail`, so the two do not keep two lists. */
export function isOffline(message: string): boolean {
  return OFFLINE.test(message);
}

/** The name behind a read failure, or null for no failure. */
export function classifyLoadFail(message: string | null | undefined): LoadFail | null {
  if (!message) return null;
  // Expired first: an expired token is sometimes reported inside a longer
  // network-shaped sentence, and it is the more specific of the two.
  if (EXPIRED.test(message)) return 'expired';
  if (isOffline(message)) return 'offline';
  return 'other';
}

type T = (en: string, vi: string, ja?: string) => string;

/** What to tell the reader, in one sentence, from the name. */
export function loadFailText(kind: LoadFail, t: T): string {
  switch (kind) {
    case 'offline':
      return t('You’re offline.', 'Bạn đang offline.', 'オフラインです。');
    case 'expired':
      return t(
        'Your session lapsed — signing you back in.',
        'Phiên đăng nhập đã hết hạn — đang kết nối lại.',
        'セッションが切れました。再接続しています。',
      );
    default:
      return t('Couldn’t load right now.', 'Chưa tải được lúc này.', '読み込めませんでした。');
  }
}

/** The second half, when the screen is still showing an older answer. */
export function loadFailStale(t: T): string {
  return t('Showing what was saved.', 'Đang hiện dữ liệu đã lưu.', '保存済みのデータを表示中。');
}
