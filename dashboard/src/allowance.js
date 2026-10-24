// The Google allowance, as notices for the desk.
//
// `fetch-place` counts every search and every map name per account and
// per day, and refuses past two allowances: an account's own, and the
// app's over everybody (20261024100000_fetch_place_allowance). The owner
// asked, the same day, for the desk to say when either is passed. This is
// the arithmetic, kept away from React as `reports.js` is; the bell that
// shows it is `components/AllowanceBell.jsx`.
//
// The input is what `fetch_place_usage()` returns: the week the counter
// keeps, as day totals against the cap each ran under, and the accounts
// that went past their own. Every number in a notice comes from those
// rows — the caps included, which the counter records beside each count —
// so nothing here repeats the function's constants and nothing can drift
// from them.

/**
 * Where today's total starts to be worth a word: four fifths of the cap.
 *
 * Measured against use, not chosen in the abstract. The day before the
 * allowance shipped, `fetch-place` was called 41 times; a fifth of 2,000
 * is 400 calls of warning, ten days' worth of that traffic, which is room
 * to raise the cap or find the script before real readers are refused.
 */
export const WARN_SHARE = 0.8;

const ACTION = { search: 'searches', reverse: 'map names' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmt = (n) => Number(n).toLocaleString('en-US');

/** `2026-10-24` → `24 Oct`, or `today`. The day is the database's, UTC. */
export function dayLabel(day, today) {
  if (day === today) return 'today';
  const [, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** An account as the desk can name it: the handle, else the id's head. */
function who(o) {
  if (!o.handle) return `Account ${o.user_id.slice(0, 8)}`;
  return o.full_name ? `@${o.handle} · ${o.full_name}` : `@${o.handle}`;
}

/**
 * The notices, most urgent first: today's total when it is near or past
 * the app's cap, then the days the app ran out, then each account that
 * went past its own allowance.
 *
 * Today's total is `live`: it says what is true now, and goes when the
 * day turns. Everything else is history in the counter's week, and keyed
 * so the desk can remember having shown it.
 */
export function allowanceNotices(usage) {
  if (!usage) return [];
  const { today, days = [], over = [] } = usage;
  const out = [];

  const now = days.find((d) => d.day === today);
  if (now && now.total > now.cap) {
    out.push({
      key: `app:${now.day}`, live: true,
      title: 'Google search is off for every reader',
      meta: `${fmt(now.total)} calls today against ${fmt(now.cap)} · back when the day turns`,
    });
  } else if (now && now.total >= now.cap * WARN_SHARE) {
    out.push({
      key: `near:${now.day}`, live: true,
      title: `${Math.floor((now.total / now.cap) * 100)}% of today's Google calls used`,
      meta: `${fmt(now.total)} of ${fmt(now.cap)} · past it, every reader is refused`,
    });
  }

  for (const d of days) {
    if (d.day === today || d.total <= d.cap) continue;
    out.push({
      key: `app:${d.day}`, live: false,
      title: `The app ran out of Google calls on ${dayLabel(d.day, today)}`,
      meta: `${fmt(d.total - d.cap)} refused after ${fmt(d.cap)}`,
    });
  }

  for (const o of over) {
    out.push({
      key: `account:${o.day}:${o.user_id}:${o.action}`, live: false,
      title: who(o),
      meta: `${fmt(o.n)} ${ACTION[o.action] ?? o.action} of ${fmt(o.cap)} · ${dayLabel(o.day, today)} · ${fmt(o.n - o.cap)} refused`,
    });
  }
  return out;
}

/** How many to count on the bell: those not yet seen. A live notice is
 *  never in `seen` — `seenAfter` leaves it out — so it always counts. */
export function unseenCount(notices, seen) {
  return notices.filter((n) => !seen.includes(n.key)).length;
}

/**
 * What to remember once the panel has been read: the keys of what it
 * showed, and only those — the counter keeps a week, so a key for a row
 * that has been swept is a key that will never match again.
 */
export function seenAfter(notices) {
  return notices.filter((n) => !n.live).map((n) => n.key);
}
