// The Contributors screen's arithmetic, exercised as plain functions.
// Run from dashboard/: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CITY_META, SERIES_COLORS, TOP_N,
  dayKey, windowDays, cumulativeByDay, countStats, scopeRows, buildBoard, niceMax,
} from '../src/contributors.js';

const TODAY = new Date(2026, 7, 16); // Aug 16 2026, local
const days = windowDays(30, TODAY);

const row = (added_by, city_id, day) => ({ added_by, city_id, created_at: `${day}T09:00:00+07:00` });

test('windowDays: 30 local days ending today, oldest first', () => {
  assert.equal(days.length, 30);
  assert.equal(days[0], '2026-07-18');
  assert.equal(days[29], '2026-08-16');
  // consecutive — no DST/UTC gaps or repeats
  const seen = new Set(days);
  assert.equal(seen.size, 30);
});

test('cumulativeByDay: buckets on the local day and accumulates', () => {
  const rows = [
    row('u1', 'hcmc', '2026-07-18'),
    row('u1', 'hcmc', '2026-07-18'),
    row('u1', 'hcmc', '2026-08-16'),
  ];
  const cum = cumulativeByDay(rows, days);
  assert.equal(cum[0], 2);
  assert.equal(cum[15], 2);
  assert.equal(cum[29], 3);
});

test('cumulativeByDay: out-of-window rows clamp to the edges, never vanish', () => {
  const rows = [
    { added_by: 'u1', city_id: 'hcmc', created_at: '2026-07-01T00:00:00+07:00' },
    { added_by: 'u1', city_id: 'hcmc', created_at: '2026-09-01T00:00:00+07:00' },
  ];
  const cum = cumulativeByDay(rows, days);
  assert.equal(cum[0], 1);
  assert.equal(cum[29], 2); // both counted by the end
});

test('countStats and scopeRows agree with a hand count', () => {
  const rows = [
    row('u1', 'hcmc', '2026-08-01'),
    row('u1', 'hanoi', '2026-08-02'),
    row('u2', 'hcmc', '2026-08-03'),
  ];
  assert.deepEqual(countStats(rows), { total: 3, contributors: 2 });
  assert.deepEqual(countStats(scopeRows(rows, 'hcmc')), { total: 2, contributors: 2 });
  assert.deepEqual(countStats(scopeRows(rows, 'danang')), { total: 0, contributors: 0 });
});

test('buildBoard: ranks by total desc, handle asc on ties, caps at ten', () => {
  const profiles = Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [`u${i}`, { id: `u${i}`, handle: `user${String(i).padStart(2, '0')}` }]),
  );
  // u0 gets 12 rows, u1 gets 11 … u11 gets 1; u3/u4 tied at 9 → handle order
  const rows = [];
  for (let i = 0; i < 12; i++) {
    for (let n = 0; n < 12 - i; n++) rows.push(row(`u${i}`, 'hcmc', '2026-08-10'));
  }
  rows.push(row('u4', 'hanoi', '2026-08-11')); // u4: 9 → ties u3 at 9
  const board = buildBoard(rows, profiles, days, '');
  assert.equal(board.top.length, TOP_N);
  assert.equal(board.top[0].handle, 'user00');
  const t3 = board.top.find((s) => s.id === 'u3');
  const t4 = board.top.find((s) => s.id === 'u4');
  assert.equal(t3.total, 9);
  assert.equal(t4.total, 9);
  assert.ok(board.top.indexOf(t3) < board.top.indexOf(t4), 'tie broken by handle asc');
  assert.equal(board.total, rows.length);
  assert.equal(board.contributors, 12);
  assert.equal(board.allSeries[29], rows.length);
});

test('buildBoard: city scope re-ranks and the breakdown follows the scope', () => {
  const profiles = { a: { id: 'a', handle: 'an' }, b: { id: 'b', handle: 'binh' } };
  const rows = [
    row('a', 'hcmc', '2026-08-01'), row('a', 'hcmc', '2026-08-02'), row('a', 'hanoi', '2026-08-03'),
    row('b', 'hanoi', '2026-08-01'), row('b', 'hanoi', '2026-08-02'),
  ];
  const all = buildBoard(rows, profiles, days, '');
  assert.equal(all.top[0].handle, 'an'); // 3 > 2
  assert.deepEqual(all.top[0].byCity, [{ key: 'hcm', count: 2 }, { key: 'hn', count: 1 }]);

  const hanoi = buildBoard(rows, profiles, days, 'hanoi');
  assert.equal(hanoi.top[0].handle, 'binh'); // re-ranked: 2 > 1
  assert.equal(hanoi.total, 3);
  assert.equal(hanoi.contributors, 2);
  assert.deepEqual(hanoi.top[0].byCity, [{ key: 'hn', count: 2 }]); // scoped rows only
});

test('buildBoard: a missing profile falls back to a truncated id', () => {
  const rows = [row('0a1b2c3d-ffff', 'hcmc', '2026-08-01')];
  const board = buildBoard(rows, {}, days, '');
  assert.equal(board.top[0].handle, '0a1b2c3d');
});

test('niceMax lands on round ticks: the mock axes and the awkward cases', () => {
  assert.equal(niceMax(218), 240); // 0 · 80 · 160 · 240
  assert.equal(niceMax(26), 30);   // 0 · 10 · 20 · 30
  assert.equal(niceMax(96), 120);
  assert.equal(niceMax(7), 12);
  assert.equal(niceMax(1), 3);
  assert.equal(niceMax(0), 3);
  assert.equal(niceMax(3), 3);
  assert.equal(niceMax(240), 240); // exact fit stays put
  // every result divides into whole-number thirds
  for (const v of [1, 2, 5, 7, 13, 26, 96, 218, 999]) {
    assert.equal(niceMax(v) % 3, 0, `niceMax(${v}) = ${niceMax(v)}`);
  }
});

test('palette and city metadata hold the shapes the screen leans on', () => {
  assert.equal(SERIES_COLORS.length, TOP_N);
  assert.equal(new Set(SERIES_COLORS).size, TOP_N);
  assert.deepEqual(CITY_META.map((c) => c.id), ['hcmc', 'hanoi', 'danang', 'dalat', 'hue']);
  assert.equal(dayKey(new Date(2026, 0, 5)), '2026-01-05');
});
