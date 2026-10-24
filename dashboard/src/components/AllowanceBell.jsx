// The Google allowance bell: a notice whenever `fetch-place`'s allowances
// are passed — an account's own, or the app's over everybody — and when
// today is close to the app's (owner, 24 Oct 2026). The words and the
// arithmetic are `allowance.js`; this is the reading, the remembering,
// and the panel.
//
// The unfiled bell's shape, on purpose: absent when there is nothing to
// say, a count while there is, and a panel naming each thing behind it.
// Two differences, both because these are events rather than work:
//
// - It forgets what it has shown. A place with no category stays a
//   problem until somebody files it, so that bell never lets go; an
//   account that ran out of searches on Tuesday is a fact, and a count
//   that kept saying it for the week the counter keeps would be a count
//   people learn to ignore. Closing the panel marks what it showed as
//   seen, in this browser. Today's total near or past the cap is never
//   marked: it is true until the day turns, and goes away by itself.
// - There is no button per row. Nothing on the desk changes an allowance;
//   the numbers are the function's, and the notice is so the owner knows.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { allowanceNotices, seenAfter, unseenCount } from '../allowance.js';
import { CategoryIcon } from '../icons.jsx';

const SEEN_KEY = 'citycrew.dashboard.allowanceSeen';

function readSeen() {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/**
 * The notices and what has been seen of them, read once per navigation —
 * the way the Reports count is, and for its reason: a count that only
 * moved on reload would lie for the length of a session.
 *
 * One reading for the shell, handed to both seats the bell has (the
 * phone's bar and the page head), so the two cannot disagree about what
 * was seen.
 */
export function useAllowance(pathname) {
  const [notices, setNotices] = useState([]);
  const [seen, setSeen] = useState(readSeen);
  useEffect(() => {
    let alive = true;
    api.fetchPlaceUsage()
      .then((usage) => { if (alive) setNotices(allowanceNotices(usage)); })
      // Silent, as the Reports count is: a database that predates the
      // counter should get a desk that works, not an error about a bell.
      .catch(() => {});
    return () => { alive = false; };
  }, [pathname]);
  const markSeen = useCallback(() => {
    const keys = seenAfter(notices);
    setSeen(keys);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(keys)); } catch { /* kept for this visit only */ }
  }, [notices]);
  return { notices, seen, markSeen };
}

export default function AllowanceBell({ notices, seen, markSeen }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const close = useCallback(() => { setOpen(false); markSeen(); }, [markSeen]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => { if (!ref.current?.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const n = unseenCount(notices, seen);
  // Open stays open: marking seen happens on the way out, and a panel
  // that vanished under the pointer the moment it was read would be the
  // bell punishing the reading.
  if (!n && !open) return null;

  return (
    <div className="moremenu" ref={ref}>
      <button
        className="syncbtn bell"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Google allowance: ${n} notice${n === 1 ? '' : 's'}`}
      >
        <CategoryIcon name="search" color="var(--warn)" />
        <span className="bellcount">{n}</span>
      </button>
      {open && (
        <div className="notifypanel" role="dialog" aria-label="Google allowance">
          <div className="notifyhead">
            <CategoryIcon name="alert" color="var(--warn)" />
            <b>Google allowance</b>
          </div>
          {/* The two facts that make the rows readable: a refused call is
              still counted, so how far past the number an account went is
              the tell; and the day is the database's, which turns at 07:00
              in Vietnam, not at midnight. */}
          <p className="notifywhy">
            Refused calls still count, so a number far past the allowance is a script, not a reader.
            Days turn at 07:00 in Vietnam.
          </p>
          {notices.map((x) => (
            <div className="notifyrow" key={x.key}>
              <div className="notifyname">
                <div className="notifytitle">{x.title}</div>
                <div className="notifymeta">{x.meta}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
