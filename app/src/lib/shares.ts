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
 * Then anybody the list is shared with who is not in that list, at the
 * end — a blocked friend still on the list among them, so the owner can
 * take them off. That row exists for the gap between two copies of the truth: the
 * crew is fetched once for the app and can be a reload behind the shares
 * (a friend accepted on another phone, a crew still loading from cold).
 * The picker's button writes the difference between what was shared and
 * what is ticked, so a shared friend missing from its rows would be an
 * unticked friend — and pressing Share would unshare them without anyone
 * having touched their name. Drawn, they open ticked and stay shared
 * unless the owner says otherwise.
 */
export function shareRows(
  friendIds: readonly string[], shared: readonly string[], blocked: readonly string[],
): string[] {
  const out = friendIds.filter((id) => !blocked.includes(id));
  for (const id of shared) if (!out.includes(id)) out.push(id);
  return out;
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
