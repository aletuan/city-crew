// A list shared with chosen friends, as arithmetic rather than as a sheet.
//
// The owner's side of `collection_shares` (13 Nov 2026). Every question
// the screens ask about it is a shape question — which of three words the
// card's foot says, who the picker lists and who it ticks, what pressing
// its button would write, how a row names four people in a phrase — and
// each is easier to get wrong in a component than to prove here. Same
// trade `lib/invites` makes: no React, no Supabase, so a Node process can
// hold it to the truth.
//
// ── three answers, two columns ──
//
// The database keeps "who can see this list" in two places: `is_public`
// on the list, and the rows of `collection_shares`. The migration leaves
// the first exactly as it was, so the two combine rather than replace:
//
//   is_public   shares   the card says
//   true        any      Public   — the shares wait, and apply again if
//                                   it goes back to private
//   false       ≥ 1      Friends  — a private list with a guest list
//   false       0        Private  — only you
//
// Public wins over the shares because that is what the policies do: a
// public list is readable by everyone, and naming three friends on it
// narrows nothing.

import type Ionicons from '@expo/vector-icons/Ionicons';

/** One share, as the owner's read returns it. Structural, because Node
 *  runs this and the data layer hands back exactly these columns. */
export type ShareRow = { collection_id: string; user_id: string; created_at: string };

export type Visibility = 'public' | 'friends' | 'private';

/** Which of the three the card's foot says — see the table above. */
export function visibilityOf(isPublic: boolean, shares: number): Visibility {
  if (isPublic) return 'public';
  return shares > 0 ? 'friends' : 'private';
}

/**
 * The mark a reader who is not the owner sees under the handle of
 * somebody's list, after its age (owner, 18 Nov 2026).
 *
 *   - `lent`: a list that is not public reached this reader through a
 *     share — two heads and "Shared with you", as since 13 Nov;
 *   - `public`: a person's public list — the globe, as a public post
 *     wears one on Facebook. Until this the globe was the owner's alone,
 *     and the reader it tells most was the one who did not see it: a
 *     like here, and a name on the list's activity page, are in front of
 *     everybody. It also left one place on the card marked for a friend's
 *     shared list and bare for a stranger's public one.
 *
 * Nothing for the owner, who has the mark that opens the who-sees-it
 * sheet in the same place; and nothing for a list of the desk's, which
 * has no person, no age and no byline to stand a mark on.
 *
 * `is_public` is read as the list's page reads it: public only when it
 * says so.
 */
export type ReaderMark = 'lent' | 'public';
export function readerMark(
  col: { is_public?: boolean | null; owner_id?: string | null } | null | undefined,
  owned: boolean,
): ReaderMark | null {
  if (!col || owned) return null;
  if (!col.is_public) return 'lent';
  return col.owner_id ? 'public' : null;
}

/**
 * Whether this reader may like the list — the app's copy of the insert
 * policy on `collection_likes` (`20261117233000_likes_in_the_group.sql`).
 *
 * A public list, anybody. A list shared with friends, the friends and
 * its owner (owner, 17 Nov 2026: a group a list is read in is a place to
 * say you like it; until then a new like needed a public list). A list
 * shared with nobody, nobody: a heart only its owner could press would
 * count its owner.
 *
 * `owned` false on a list that is not public means it was shared with
 * the reader — the only other way a private list reaches a screen
 * (`CollectionDetailScreen`, `sharedToMe`). `shares` is how many friends
 * the owner's list is shared with, and is not asked of anybody else's.
 */
export function likeable(isPublic: boolean, owned: boolean, shares: number): boolean {
  return isPublic || !owned || shares > 0;
}

/**
 * The owner's shares, by list, each list's friends in the order they were
 * named.
 *
 * One read answers every list the owner has (`fetchMyListShares`), so
 * the tab's tiles and a list's page draw from the same rows; this is
 * where they become the per-list answer both ask for. Sorted here as well
 * as in the query: the order is what the sheet's sentence names first,
 * and a cached copy from before the query ordered would otherwise name
 * them in whatever order it was stored.
 */
export function sharesByList(rows: readonly ShareRow[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const r of sorted) (out[r.collection_id] ??= []).push(r.user_id);
  return out;
}

/**
 * Who the picker lists, in order.
 *
 * The crew's accepted friends, as the trip picker lists them — the insert
 * policy refuses anybody else, so listing them would offer a tick that
 * cannot be written. Less anyone the reader has blocked: the policy
 * refuses those too (`blocked_with`), and a friendship can outlive a
 * block made by a bare insert into `blocks`.
 *
 * And anybody the list is shared with who is not in that list — a
 * blocked friend still on the list among them, so the owner can take
 * them off. That row exists for the gap between two copies of the truth: the
 * crew is fetched once for the app and can be a reload behind the shares
 * (a friend accepted on another phone, a crew still loading from cold).
 * The picker's button writes the difference between what was shared and
 * what is ticked, so a shared friend missing from its rows would be an
 * unticked friend — and pressing Share would unshare them without anyone
 * having touched their name. Drawn, they open ticked and stay shared
 * unless the owner says otherwise.
 *
 * ── the order (owner, 19 Nov 2026) ──
 *
 * The picker became a strip of faces that day, four to a screen, and a
 * strip is scanned from its left end: who stands first is most of
 * finding somebody. So:
 *
 *   1. who has this list now, in the order they were named — the sheet
 *      is where an owner checks who has it, and they open ticked in a
 *      row at the front, not scattered along a scroll;
 *   2. then the friends the owner shares with, the one who has more of
 *      the owner's lists first, and between two with as many, the one
 *      shared with more recently;
 *   3. then the rest, in the crew's order.
 *
 * `history` is every share on every list of the owner's — the read the
 * page already holds (`useMyListShares`), so the order costs no request.
 * Weighed with the owner and not taken yet: who the owner talks with in
 * comments, likes from, or went on a trip with. Each is a truer "close
 * friend" than a share count and each is a read this sheet does not
 * have; the shares are the one signal about this very act. To weigh
 * again when a crew is large enough that the second rule leaves the
 * person wanted off the first screen.
 */
export function shareRows(
  friendIds: readonly string[], shared: readonly string[], blocked: readonly string[],
  history: readonly ShareRow[] = [],
): string[] {
  const lists = new Map<string, number>();
  const latest = new Map<string, string>();
  for (const h of history) {
    lists.set(h.user_id, (lists.get(h.user_id) ?? 0) + 1);
    if ((latest.get(h.user_id) ?? '') < h.created_at) latest.set(h.user_id, h.created_at);
  }
  const rest = friendIds.filter((id) => !blocked.includes(id) && !shared.includes(id));
  const place = new Map(rest.map((id, i) => [id, i]));
  rest.sort((a, b) => (
    (lists.get(b) ?? 0) - (lists.get(a) ?? 0)
    || (latest.get(b) ?? '').localeCompare(latest.get(a) ?? '')
    || (place.get(a) as number) - (place.get(b) as number)
  ));
  return [...new Set(shared), ...rest];
}

/**
 * What pressing the picker's button has to write: the friends to add and
 * the friends to take off. Two lists, because they are two statements
 * against two policies — an insert the owner may make for a friend, a
 * delete the owner may make for anyone on their list.
 *
 * `add` in the order the ticks were made; `remove` in the order the
 * shares were.
 */
export function diffShares(
  before: readonly string[], picked: ReadonlySet<string>,
): { add: string[]; remove: string[] } {
  return {
    add: [...picked].filter((id) => !before.includes(id)),
    remove: before.filter((id) => !picked.has(id)),
  };
}

/**
 * What the picker's button says it will do, and whether it can.
 *
 * - `share`: somebody is ticked. Live when the press would change
 *   something — a different set of friends, or a public list, which
 *   sharing makes private (the sheet's subtitle says so). The same ticks
 *   on a list already shared that way would be a write of nothing.
 * - `private`: nobody is ticked on a list that was shared. The press
 *   takes everyone off, and the list is Private again — the button says
 *   that rather than "Share with 0 people".
 * - `none`: nobody ticked and nothing to take off, or a public list with
 *   nobody ticked. Dimmed. On a public list "Keep private" would be a
 *   lie (it is not private), and making a public list private is the
 *   Private row's job, one sheet back, where it says so.
 */
export type ShareCta = { kind: 'share'; n: number; live: boolean } | { kind: 'private' } | { kind: 'none' };

export function shareCta(
  before: readonly string[], picked: ReadonlySet<string>, isPublic: boolean,
): ShareCta {
  if (picked.size) {
    const { add, remove } = diffShares(before, picked);
    return { kind: 'share', n: picked.size, live: isPublic || add.length + remove.length > 0 };
  }
  if (before.length && !isPublic) return { kind: 'private' };
  return { kind: 'none' };
}

type T = (en: string, vi: string, ja: string, zh: string, hant?: string) => string;

/** The glyph each of the three answers wears, wherever one is drawn:
 *  under your handle on the list's page, on the rows of its who-sees-it
 *  sheet, and at the head of the list's form. */
export const SEEN_GLYPH: Record<Visibility, keyof typeof Ionicons.glyphMap> = {
  public: 'globe-outline',
  friends: 'people-outline',
  private: 'lock-closed-outline',
};

/** The one word for each answer — the page's, and so the form's. */
export function seenName(seen: Visibility, t: T): string {
  if (seen === 'public') return t('Public', 'Công khai', '公開', '公开', '公開');
  if (seen === 'friends') return t('Friends', 'Bạn bè', '友達', '好友', '好友');
  return t('Private', 'Riêng tư', '非公開', '私密', '私密');
}

/**
 * What each answer means, in the few words that fit after its name on
 * one line: "Public · Everyone can see it" (the list's form, owner,
 * 16 Nov 2026).
 *
 * Friends and Private are the sentences the who-sees-it sheet already
 * says under those rows, so a reader meets the same words in both
 * places. Public is not the sheet's ("Shown in Explore and in search"):
 * that one says where a public list turns up, to somebody deciding
 * whether to publish; this one says who is reading, to somebody about to
 * change the words they read. Not the friends' names, as the sheet gives
 * once some are chosen: the form is not where the owner checks who has
 * the list.
 */
export function seenGloss(seen: Visibility, t: T): string {
  if (seen === 'public') return t('Everyone can see it', 'Mọi người có thể xem', '誰でも見られます', '所有人可见', '所有人可見');
  if (seen === 'friends') {
    return t('Only the friends you choose', 'Chỉ những bạn bè bạn chọn', '選んだ友達だけが見られます', '仅你选择的好友可见', '僅你選擇的好友可見');
  }
  return t('Only you can see it', 'Chỉ mình bạn thấy', '自分だけが見られます', '仅你可见', '僅你可見');
}

/**
 * Who a list is shared with, briefly: "Minh Anh", "Minh Anh and Hà My",
 * "Minh Anh, Hà My and Lan", "Minh Anh, Hà My and 3 others".
 *
 * Three names in full, and past three the first two and a count. Not two
 * and "1 other" at three: that is a count standing in for a name of about
 * its own length, and a reader would rather have the name. Past three the
 * names grow the row without limit (twelve friends is the measured most,
 * see `ShareSheet`) while the count stays one word. The first two are the
 * first two shared with, the order `sharesByList` gives: the people the
 * owner thought of first.
 *
 * Rejected: "Shared with 5 friends" with no names. The row is where the
 * owner checks who has the list, and a number is the half of the answer
 * they already had.
 *
 * Empty for nobody; the caller says "Only the friends you choose" there,
 * which is a different sentence and not a list of no one.
 */
export function namesBriefly(names: readonly string[], t: T): string {
  const [a, b, c] = names;
  if (names.length <= 1) return a ?? '';
  if (names.length === 2) {
    return t(`${a} and ${b}`, `${a} và ${b}`, `${a}と${b}`, `${a}和${b}`, `${a}和${b}`);
  }
  if (names.length === 3) {
    return t(`${a}, ${b} and ${c}`, `${a}, ${b} và ${c}`, `${a}、${b}、${c}`, `${a}、${b}和${c}`, `${a}、${b}和${c}`);
  }
  const k = names.length - 2;
  return t(
    `${a}, ${b} and ${k} others`,
    `${a}, ${b} và ${k} người khác`,
    `${a}、${b}ほか${k}人`,
    `${a}、${b}和另外 ${k} 人`, `${a}、${b}和另外 ${k} 人`,
  );
}
