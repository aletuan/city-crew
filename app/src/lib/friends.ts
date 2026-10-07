// The crew, as data: who asked whom, what stands between two accounts,
// and what the activity screen has to say about it.
//
// Pure on purpose, like every module the gate can see. The server holds
// the edges (see the friendships migration — one row per pair, pending
// until the addressee says yes, declined rows deleted rather than
// remembered); this file only answers the questions the screens ask of
// those rows, so a Node process can prove the answers.

/** One edge, as the table stores it. Structural, because Node runs this. */
export type FriendshipRow = {
  requester: string;
  addressee: string;
  status: 'pending' | 'accepted';
  created_at: string;
};

/** Mirror of the insert policy's cap: twenty requests started per day.
 *  The server enforces it; the app knows the number so it can say
 *  "enough for today" instead of relaying a refusal it cannot explain. */
export const REQUEST_DAILY_CAP = 20;

export type Crew = {
  /** Account ids of accepted friends, newest friendship first. */
  friends: string[];
  /** Requests waiting on YOUR answer — the banner and the badge. */
  incoming: FriendshipRow[];
  /** Requests you sent that nobody has answered yet. */
  outgoing: FriendshipRow[];
};

/**
 * The reader's side of every edge they can see.
 *
 * The select policy already scopes rows to edges the reader is on, so
 * this only has to sort each row into the three piles the screens draw
 * from. A row that names neither side as `me` — impossible under RLS,
 * routine in a test — is dropped rather than mis-filed.
 */
export function splitFriendships(rows: readonly FriendshipRow[], me: string): Crew {
  const friends: { id: string; at: string }[] = [];
  const incoming: FriendshipRow[] = [];
  const outgoing: FriendshipRow[] = [];
  for (const r of rows) {
    if (r.requester !== me && r.addressee !== me) continue;
    if (r.status === 'accepted') {
      friends.push({ id: r.requester === me ? r.addressee : r.requester, at: r.created_at });
    } else if (r.addressee === me) {
      incoming.push(r);
    } else {
      outgoing.push(r);
    }
  }
  friends.sort((a, b) => b.at.localeCompare(a.at));
  incoming.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { friends: friends.map((f) => f.id), incoming, outgoing };
}

/** What stands between the reader and one other account. The add flow
 *  reads this before sending: each state is a different sentence on the
 *  screen, and only 'none' is a state a request may be sent from. */
export type Standing = 'none' | 'friends' | 'asked' | 'asks_you' | 'yourself';

export function standingWith(rows: readonly FriendshipRow[], me: string, other: string): Standing {
  if (me === other) return 'yourself';
  const { friends, incoming, outgoing } = splitFriendships(rows, me);
  if (friends.includes(other)) return 'friends';
  if (outgoing.some((r) => r.addressee === other)) return 'asked';
  if (incoming.some((r) => r.requester === other)) return 'asks_you';
  return 'none';
}

// ── the activity feed ──

/** A like on one of the reader's lists, as `likes_on_mine` returns it.
 *  Named, since the second cut of that function: the owner of a list
 *  always sees who liked it, the way every mainstream feed attributes
 *  likes on your own work. Null only when the liker's profile is gone. */
export type Applause = {
  collection_id: string;
  liked_at: string;
  liker_handle: string | null;
  liker_name: string | null;
};

/** A copy saved of one of the reader's lists, as `copies_of_mine` returns
 *  it: the original's id, when the copy was made, and who made it — null
 *  only when the copier's profile is gone. The copy itself is not named;
 *  what the curator learns is that it was made, as with a like. */
export type Copy = {
  collection_id: string;
  copied_at: string;
  copier_handle: string | null;
  copier_name: string | null;
};

export type ActivityItem =
  | { kind: 'applause'; at: string; collection_id: string; liker_handle: string | null; liker_name: string | null }
  | { kind: 'copy'; at: string; collection_id: string; copier_handle: string | null; copier_name: string | null };

/**
 * The EARLIER section, assembled and ordered: applause and copies, in one
 * timeline, newest first.
 *
 * Copies joined on 7 Oct 2026. "Save a copy" is the strongest compliment
 * one reader pays another's list — stronger than a like, since it is the
 * list they want to keep — and it had left no trace: `copyCollection`
 * made a fresh list and nothing said where it came from. The row now
 * remembers its original and `copies_of_mine` reports it under the same
 * rules as the likes. One timeline rather than two sections, because a
 * reader asking "what happened to my lists" wants the answer in the order
 * it happened.
 *
 * Trips used to lead this list, as a reminder. They went the same day:
 * by then the Trips tab's dot, the morning notification and the Trips
 * screen all said it, and this copy — one line, showing one trip when
 * there were two on the day — was the only one telling it wrong. Activity
 * is what other people did with your lists and your crew.
 */
export function buildActivity(applause: readonly Applause[], copies: readonly Copy[]): ActivityItem[] {
  const out: ActivityItem[] = [];
  for (const a of applause) {
    out.push({
      kind: 'applause', at: a.liked_at, collection_id: a.collection_id,
      liker_handle: a.liker_handle, liker_name: a.liker_name,
    });
  }
  for (const c of copies) {
    out.push({
      kind: 'copy', at: c.copied_at, collection_id: c.collection_id,
      copier_handle: c.copier_handle, copier_name: c.copier_name,
    });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

// ── the add flow's suggestions ──

/** Suggest only once two letters exist: a single letter matches half the
 *  handles there are, and a list that long is noise wearing a dropdown. */
export const MIN_SUGGEST_CHARS = 2;

/** At most this many rows under the field. Enough to pick from, few
 *  enough that the keyboard stays the main event. */
export const SUGGEST_LIMIT = 6;

/**
 * The rows worth offering, from whatever the lookup returned.
 *
 * Your own account is dropped — a suggestion you cannot befriend is a
 * dead row — and so is anyone you blocked: a block is a decision not to
 * be offered this person again, and the dropdown re-offering them would
 * be the app forgetting it on your behalf. The rest keep their order
 * and are capped. Friends and already-asked accounts deliberately stay:
 * tapping one gets the same specific sentence the send flow already
 * speaks, which teaches more than their absence would.
 */
export function suggestable<T extends { id: string }>(
  found: readonly T[], me: string, hidden: readonly string[] = [],
): T[] {
  return found.filter((p) => p.id !== me && !hidden.includes(p.id)).slice(0, SUGGEST_LIMIT);
}

// ── people worth asking ──

/** One introduction, as `suggested_friends` returns it: an account and
 *  how many places you have both saved publicly. */
export type Suggestion = { other: string; mutual: number };

/** How many introductions the crew screen offers at once. Five: enough
 *  to find somebody, few enough that the section stays an aside rather
 *  than becoming the screen. */
export const SUGGESTED_SHOWN = 5;

/**
 * The suggestions still worth showing, given what the reader has done
 * since the server answered.
 *
 * The function already excludes friends, pending edges and blocks — but
 * it answered a moment ago, and a tap on Add changes the truth without
 * asking it again. Re-checking here is what makes a row vanish the
 * instant it is acted on, rather than sitting there inviting a second
 * request the policy would refuse. `standingWith` is the same reading
 * the add flow uses, so one rule decides in both places.
 */
export function openSuggestions(
  rows: readonly Suggestion[],
  me: string,
  ships: readonly FriendshipRow[],
  blocked: readonly string[] = [],
  limit: number = SUGGESTED_SHOWN,
): Suggestion[] {
  return rows
    .filter((r) => standingWith(ships, me, r.other) === 'none' && !blocked.includes(r.other))
    .slice(0, limit);
}

/**
 * How long ago, as a unit the screen can put words to.
 *
 * The shape rather than the sentence, because the sentence is the
 * screen's job — three languages disagree about word order and this
 * module does not know any of them. Future stamps clamp to "now": a
 * clock skewed a few seconds must not produce a like from the future.
 */
export type Ago =
  | { unit: 'now' }
  | { unit: 'minutes' | 'hours' | 'days'; n: number };

export function agoOf(iso: string, now: number): Ago {
  const t = Date.parse(iso);
  const mins = Math.floor((now - t) / 60000);
  if (!isFinite(mins) || mins < 1) return { unit: 'now' };
  if (mins < 60) return { unit: 'minutes', n: mins };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { unit: 'hours', n: hours };
  return { unit: 'days', n: Math.floor(hours / 24) };
}
