// One question, asked once per account, answerable without waiting —
// and, since the grant learned about cities, answered per city.

import { describe, expect, it, vi } from 'vitest';
import { guideGrantStore } from './guideGrant';

/** A grant of every city: the shape every row had before the column. */
const everywhere = () => Promise.resolve([null]);
/** A grant of one city, and nowhere else. */
const hanoi = () => Promise.resolve(['hanoi']);
const nowhere = () => Promise.resolve([]);

describe('guideGrantStore', () => {
  it('knows nothing until it is asked, which draws no control', () => {
    const s = guideGrantStore();
    expect(s.get('u1', 'hanoi')).toBe(false);
  });

  it('holds the answer for the account it asked about', async () => {
    const s = guideGrantStore();
    await s.load('u1', everywhere);
    expect(s.get('u1', 'hanoi')).toBe(true);
  });

  // ── the line the city draws ──

  // The whole point of the column: a grant of Hanoi stops at Hanoi, and
  // the insert policy stops it in the same place.
  it('answers yes inside the city named on the grant and no outside it', async () => {
    const s = guideGrantStore();
    await s.load('u1', hanoi);
    expect(s.get('u1', 'hanoi')).toBe(true);
    expect(s.get('u1', 'danang')).toBe(false);
  });

  // A null in the list is not "no city", it is "every city" — including
  // one the catalog does not have yet, which is why it is stored as a
  // null rather than a row per city.
  it('reads an all-cities grant as covering a city it never named', async () => {
    const s = guideGrantStore();
    await s.load('u1', everywhere);
    expect(s.get('u1', 'hue')).toBe(true);
  });

  // With no place in hand nobody can say where "here" is, so only a
  // grant that covers everywhere can honestly answer yes.
  it('needs an all-cities grant when no city is named', async () => {
    const wide = guideGrantStore();
    await wide.load('u1', everywhere);
    expect(wide.get('u1')).toBe(true);

    const narrow = guideGrantStore();
    await narrow.load('u1', hanoi);
    expect(narrow.get('u1')).toBe(false);
    expect(narrow.get('u1', null)).toBe(false);
  });

  it('reads several grants as their union', async () => {
    const s = guideGrantStore();
    await s.load('u1', () => Promise.resolve(['hanoi', 'danang']));
    expect(s.get('u1', 'hanoi')).toBe(true);
    expect(s.get('u1', 'danang')).toBe(true);
    expect(s.get('u1', 'hue')).toBe(false);
  });

  it('answers no for an account the desk has granted nothing', async () => {
    const s = guideGrantStore();
    await s.load('u1', nowhere);
    expect(s.get('u1', 'hanoi')).toBe(false);
  });

  // ── whose answer it is ──

  // The uid is part of the answer, not just the question. A render
  // between one account signing out and the next being asked about must
  // not read the previous account's grant.
  it('never answers for an account it was not asked about', async () => {
    const s = guideGrantStore();
    await s.load('u1', everywhere);
    expect(s.get('u2', 'hanoi')).toBe(false);
    expect(s.get(null, 'hanoi')).toBe(false);
  });

  // Mounting a reader and the launch sync in the same frame is the
  // ordinary case, and it must cost one request.
  it('asks once per account, however many callers there are', async () => {
    const s = guideGrantStore();
    const ask = vi.fn(everywhere);
    await Promise.all([s.load('u1', ask), s.load('u1', ask), s.load('u1', ask)]);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('asks again when the account changes', async () => {
    const s = guideGrantStore();
    const ask = vi.fn(everywhere);
    await s.load('u1', ask);
    await s.load('u2', ask);
    expect(ask).toHaveBeenCalledTimes(2);
    expect(s.get('u2', 'hanoi')).toBe(true);
    expect(s.get('u1', 'hanoi')).toBe(false);
  });

  // Signing out is not a question, and it clears the last answer rather
  // than leaving it where the next account could read it.
  it('forgets on sign-out without asking anything', async () => {
    const s = guideGrantStore();
    const ask = vi.fn(everywhere);
    await s.load('u1', ask);
    await s.load(null, ask);
    expect(ask).toHaveBeenCalledTimes(1);
    expect(s.get('u1', 'hanoi')).toBe(false);
  });

  // A table that is not there yet, a network that went away. All of them
  // mean "draw no control", which is what the state already says.
  it('stays quiet when the question cannot be answered', async () => {
    const s = guideGrantStore();
    await s.load('u1', () => Promise.reject(new Error('down')));
    expect(s.get('u1', 'hanoi')).toBe(false);
  });

  it('tells its subscribers when the answer moves, and only then', async () => {
    const s = guideGrantStore();
    const saw = vi.fn();
    const off = s.subscribe(saw);

    await s.load('u1', everywhere);
    const afterFirst = saw.mock.calls.length;
    expect(afterFirst).toBeGreaterThan(0);

    // Already asked, already granted: nothing changed, nobody is told.
    // The list is rebuilt by every load, so this only holds because the
    // two are compared by value.
    await s.load('u1', everywhere);
    expect(saw.mock.calls.length).toBe(afterFirst);

    off();
    await s.load('u2', nowhere);
    expect(saw.mock.calls.length).toBe(afterFirst);
  });

  it('goes back to knowing nothing when reset', async () => {
    const s = guideGrantStore();
    await s.load('u1', everywhere);
    s.reset();
    expect(s.get('u1', 'hanoi')).toBe(false);
  });
});
