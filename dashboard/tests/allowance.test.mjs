import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowanceNotices, dayLabel, seenAfter, unseenCount, WARN_SHARE } from '../src/allowance.js';

const TODAY = '2026-10-24';
const usage = (over = {}) => ({ today: TODAY, days: [], over: [], ...over });
const day = (d, total, cap = 2000) => ({ day: d, total, cap });
const acct = (extra = {}) => ({
  day: TODAY, user_id: 'a1b2c3d4-0000-0000-0000-000000000000', handle: 'looper', full_name: 'Lớp Học',
  action: 'search', n: 412, cap: 60, ...extra,
});

test('nothing to say about nothing', () => {
  assert.deepEqual(allowanceNotices(null), []);
  assert.deepEqual(allowanceNotices(usage()), []);
  // A quiet week, today included, is silence too.
  assert.deepEqual(allowanceNotices(usage({ days: [day(TODAY, 41), day('2026-10-23', 1999)] })), []);
});

test('today speaks from four fifths of the cap, and not a call before', () => {
  assert.equal(WARN_SHARE, 0.8);
  assert.deepEqual(allowanceNotices(usage({ days: [day(TODAY, 1599)] })), []);
  assert.equal(allowanceNotices(usage({ days: [day(TODAY, 1600)] }))[0].title, "80% of today's Google calls used");
  assert.deepEqual(allowanceNotices(usage({ days: [day(TODAY, 1640)] })), [{
    key: `near:${TODAY}`, live: true,
    title: "82% of today's Google calls used",
    meta: '1,640 of 2,000 · past it, every reader is refused',
  }]);
  // At the cap exactly every call so far went through: still a warning.
  assert.equal(allowanceNotices(usage({ days: [day(TODAY, 2000)] }))[0].title, "100% of today's Google calls used");
});

test('past the cap today, it says every reader is refused', () => {
  assert.deepEqual(allowanceNotices(usage({ days: [day(TODAY, 2310)] })), [{
    key: `app:${TODAY}`, live: true,
    title: 'Google search is off for every reader',
    meta: '2,310 calls today against 2,000 · back when the day turns',
  }]);
});

test('a past day the app ran out is history, counted by what was refused', () => {
  assert.deepEqual(allowanceNotices(usage({ days: [day(TODAY, 3), day('2026-10-22', 2310)] })), [{
    key: 'app:2026-10-22', live: false,
    title: 'The app ran out of Google calls on 22 Oct',
    meta: '310 refused after 2,000',
  }]);
});

test('an account past its own allowance is named, with how far past', () => {
  const [n] = allowanceNotices(usage({ over: [acct()] }));
  assert.deepEqual(n, {
    key: `account:${TODAY}:a1b2c3d4-0000-0000-0000-000000000000:search`, live: false,
    title: '@looper · Lớp Học',
    meta: '412 searches of 60 · today · 352 refused',
  });
  const [r] = allowanceNotices(usage({ over: [acct({ action: 'reverse', n: 31, cap: 30, day: '2026-10-20', full_name: '' })] }));
  assert.equal(r.title, '@looper');
  assert.equal(r.meta, '31 map names of 30 · 20 Oct · 1 refused');
  // No profile: the id's head, which is enough to find the account.
  assert.equal(allowanceNotices(usage({ over: [acct({ handle: null, full_name: null })] }))[0].title, 'Account a1b2c3d4');
  // An action the desk has no word for is said as stored, not dropped.
  assert.match(allowanceNotices(usage({ over: [acct({ action: 'other' })] }))[0].meta, /^412 other of 60/);
});

test('most urgent first: today, then the days the app ran out, then accounts', () => {
  const keys = allowanceNotices(usage({
    days: [day(TODAY, 1900), day('2026-10-22', 2001)],
    over: [acct()],
  })).map((x) => x.key.split(':')[0]);
  assert.deepEqual(keys, ['near', 'app', 'account']);
});

test('dayLabel says today, else day and month', () => {
  assert.equal(dayLabel(TODAY, TODAY), 'today');
  assert.equal(dayLabel('2026-01-05', TODAY), '5 Jan');
  assert.equal(dayLabel('2026-12-31', TODAY), '31 Dec');
});

test('the bell counts live notices always, and the rest until seen', () => {
  const notices = allowanceNotices(usage({ days: [day(TODAY, 1900)], over: [acct(), acct({ action: 'reverse' })] }));
  assert.equal(unseenCount(notices, []), 3);
  const seen = seenAfter(notices);
  // Today's total is never remembered: it is true until the day turns.
  assert.deepEqual(seen, [notices[1].key, notices[2].key]);
  assert.equal(unseenCount(notices, seen), 1);
  // Today's total, gone past the cap and so a new notice, counts again
  // whatever was seen; tomorrow it is history under a key never stored.
  assert.equal(unseenCount(allowanceNotices(usage({ days: [day(TODAY, 2001)] })), seen), 1);
  // A new account past its allowance counts again.
  const more = allowanceNotices(usage({ over: [acct(), acct({ user_id: 'ffffffff-0000' })] }));
  assert.equal(unseenCount(more, seen), 1);
});
