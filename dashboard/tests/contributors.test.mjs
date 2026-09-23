// The Contributors screen's arithmetic, exercised as plain functions.
// Run from dashboard/: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CITY_KEY, shortKey, SERIES_COLORS, TOP_N,
  dayKey, windowDays, cumulativeByDay, countStats, scopeRows, buildBoard, niceMax, guideScope, withGuide,
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
  // The shorthand is a lookup with a fallback, not a list of the cities
  // that exist — the screens read that from the API now.
  assert.deepEqual(Object.keys(CITY_KEY), ['hcmc', 'hanoi', 'danang', 'dalat', 'hue']);
  assert.equal(shortKey('hcmc'), 'hcm');
  assert.equal(shortKey('vungtau'), 'vungtau');
  assert.equal(shortKey(undefined), '');
  assert.equal(dayKey(new Date(2026, 0, 5)), '2026-01-05');
});

// ---- guideScope / withGuide: the optimistic tick, and the rollback that
// has to be its exact opposite. Both halves live in the screen, which has
// no test of its own; the folds do, because getting the rollback backwards
// leaves a box that lies about what the database says.
//
// A grant is a city now. The map is user id → Set of city ids, and `null`
// in that Set means every city — the shape the table itself uses.

const grants = (o) => new Map(Object.entries(o).map(([k, v]) => [k, new Set(v)]));

test('guideScope answers for the city in hand', () => {
  const g = grants({ hn: ['hanoi'], all: [null], both: [null, 'hanoi'] });
  assert.deepEqual(guideScope(g, 'hn', 'hanoi'), { on: true, everywhere: false, locked: false });
  assert.deepEqual(guideScope(g, 'hn', 'danang'), { on: false, everywhere: false, locked: false });
  // Nobody at all.
  assert.deepEqual(guideScope(g, 'nobody', 'hanoi'), { on: false, everywhere: false, locked: false });
});

// An everywhere grant covers a city it never named — the whole point of
// writing it as one null row rather than one row per city.
test('guideScope counts an everywhere grant as a grant here', () => {
  const g = grants({ all: [null] });
  assert.equal(guideScope(g, 'all', 'hanoi').on, true);
  assert.equal(guideScope(g, 'all', 'danang').on, true);
  assert.equal(guideScope(g, 'all', null).on, true);
});

// With no city in hand the box speaks only for the everywhere grant: a
// guide of Hanoi alone is not "a guide" when the desk is on all cities,
// because ticking that box would grant them everywhere.
test('guideScope with no city reports only the everywhere grant', () => {
  const g = grants({ hn: ['hanoi'], all: [null] });
  assert.equal(guideScope(g, 'hn', null).on, false);
  assert.equal(guideScope(g, 'all', null).on, true);
});

// The one state the box cannot express: ticked because of a wider grant,
// on a screen scoped to one city.
test('guideScope locks the box when a wider grant is what ticked it', () => {
  const g = grants({ all: [null] });
  assert.equal(guideScope(g, 'all', 'hanoi').locked, true);
  assert.equal(guideScope(g, 'all', null).locked, false, 'nothing to lock at all cities');
  assert.equal(guideScope(grants({ hn: ['hanoi'] }), 'hn', 'hanoi').locked, false);
});

test('guideScope treats a map that has not loaded as empty', () => {
  assert.deepEqual(guideScope(null, 'a', 'hanoi'), { on: false, everywhere: false, locked: false });
});

test('withGuide adds and removes without touching the map it was given', () => {
  const before = grants({ a: ['hanoi'] });
  const added = withGuide(before, 'b', 'danang', true);
  assert.deepEqual([...added.get('b')], ['danang']);
  assert.deepEqual([...before.keys()], ['a'], 'the original map was mutated');
  assert.equal(before.get('a').size, 1, 'the original set was mutated');

  const removed = withGuide(added, 'a', 'hanoi', false);
  assert.equal(removed.has('a'), false, 'a person with no cities left should be gone');
});

// One city off leaves the others alone — the failure this shape exists to
// prevent is a click on Huế revoking Hanoi.
test('withGuide changes one city and leaves the rest', () => {
  const g = grants({ a: ['hanoi', 'danang'] });
  assert.deepEqual([...withGuide(g, 'a', 'hanoi', false).get('a')], ['danang']);
  assert.deepEqual([...withGuide(g, 'a', 'hue', true).get('a')].sort(), ['danang', 'hanoi', 'hue']);
});

// Off with no city in hand is the whole person, city grants included: the
// box was ticked because they are a guide and has just been unticked.
test('withGuide with no city revokes everything for that person', () => {
  const g = grants({ a: ['hanoi', 'danang', null], b: ['hanoi'] });
  const next = withGuide(g, 'a', null, false);
  assert.equal(next.has('a'), false);
  assert.deepEqual([...next.get('b')], ['hanoi'], 'somebody else was touched');
});

// The rollback path calls this with `!on`, so the two have to undo each
// other exactly — for a city that was there and one that was not.
test('withGuide undoes itself when called with the opposite answer', () => {
  for (const [start, id, city, on] of [
    [{ a: ['hanoi'] }, 'b', 'hanoi', true],
    [{ a: ['hanoi'], b: ['hanoi'] }, 'b', 'hanoi', false],
    [{}, 'a', 'danang', true],
    [{ a: ['danang'] }, 'a', 'danang', false],
    [{}, 'a', null, true],
  ]) {
    const from = grants(start);
    const there = withGuide(from, id, city, on);
    const back = withGuide(there, id, city, !on);
    assert.deepEqual(
      [...back].map(([k, v]) => [k, [...v].sort()]).sort(),
      [...from].map(([k, v]) => [k, [...v].sort()]).sort(),
      `${id}/${city}/${on}`,
    );
  }
});

// A click before the grants have loaded still describes what it wants.
test('withGuide treats a map that has not loaded as an empty one', () => {
  assert.deepEqual([...withGuide(null, 'a', 'hanoi', true).get('a')], ['hanoi']);
  assert.equal(withGuide(null, 'a', 'hanoi', false).has('a'), false);
});

// Ticking a box that is already on is not an error — the board can be
// clicked faster than the round trip it starts.
test('withGuide is idempotent in both directions', () => {
  assert.deepEqual([...withGuide(grants({ a: ['hanoi'] }), 'a', 'hanoi', true).get('a')], ['hanoi']);
  assert.equal(withGuide(grants({}), 'a', 'hanoi', false).has('a'), false);
});
