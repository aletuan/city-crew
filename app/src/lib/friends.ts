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

export type ActivityItem =
  | { kind: 'applause'; at: string; collection_id: string; liker_handle: string | null; liker_name: string | null }
  | { kind: 'trip'; at: string; tripId: string; title: string; inDays: number };

/** How far ahead a trip may be and still be worth a reminder. A week: any
 *  further and the reminder arrives before the anticipation does. */
export const TRIP_REMINDER_DAYS = 7;

/**
 * The EARLIER section, assembled and ordered.
 *
 * Applause newest first, with the single nearest upcoming trip (within
 * the reminder window, today included) placed by its own date at the top
 * — a plan about to happen outranks a like that already did. Trips
 * further out, and trips already past, say nothing.
 */
export function buildActivity(
  applause: readonly Applause[],
  trips: readonly { id: string; title: string; day: string }[],
  todayISO: string,
): ActivityItem[] {
  const out: ActivityItem[] = [];
  const soon = trips
    .map((t) => ({ t, inDays: dayDiff(todayISO, t.day) }))
    .filter((x): x is { t: { id: string; title: string; day: string }; inDays: number } =>
      x.inDays != null && x.inDays >= 0 && x.inDays <= TRIP_REMINDER_DAYS)
    .sort((a, b) => a.inDays - b.inDays);
  if (soon.length) {
    const { t, inDays } = soon[0];
    out.push({ kind: 'trip', at: t.day, tripId: t.id, title: t.title, inDays });
  }
  const likes = [...applause].sort((a, b) => b.liked_at.localeCompare(a.liked_at));
  for (const a of likes) {
    out.push({
      kind: 'applause', at: a.liked_at, collection_id: a.collection_id,
      liker_handle: a.liker_handle, liker_name: a.liker_name,
    });
  }
  return out;
}

/** Whole days from one ISO day to another, or null when either does not
 *  parse. Local arithmetic on the date halves only, so a timezone can
 *  never make "tomorrow" read as today. */
function dayDiff(fromISO: string, toISO: string): number | null {
  const f = Date.UTC(...isoParts(fromISO) ?? [NaN, NaN, NaN]);
  const t = Date.UTC(...isoParts(toISO) ?? [NaN, NaN, NaN]);
  if (!isFinite(f) || !isFinite(t)) return null;
  return Math.round((t - f) / 86400000);
}

function isoParts(s: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
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
 * dead row — and the rest keep their order and are capped. Friends and
 * already-asked accounts deliberately stay: tapping one gets the same
 * specific sentence the send flow already speaks, which teaches more
 * than their absence would.
 */
export function suggestable<T extends { id: string }>(found: readonly T[], me: string): T[] {
  return found.filter((p) => p.id !== me).slice(0, SUGGEST_LIMIT);
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
