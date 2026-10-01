// One question, asked once per account, answerable without waiting —
// and, since the grant learned about cities, answered per city.

import { describe, expect, it, vi } from 'vitest';
import { guideGrantStore } from './guideGrant';

const grant = (cities: (string | null)[], editor = false) => () => Promise.resolve({ cities, editor });
/** A grant of every city: the shape every row had before the column. */
const everywhere = grant([null]);
/** A grant of one city, and nowhere else. */
const hanoi = grant(['hanoi']);
const nowhere = grant([]);
/** The desk: on the editors list, and no guide grant at all. */
const desk = grant([], true);

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
    await s.load('u1', grant(['hanoi', 'danang']));
    expect(s.get('u1', 'hanoi')).toBe(true);
    expect(s.get('u1', 'danang')).toBe(true);
    expect(s.get('u1', 'hue')).toBe(false);
  });

  // The badge's question: a guide of one city is a guide, where `get`
  // with no city would say no.
  it('says whether an account is a guide anywhere, which one city is enough for', async () => {
    const s = guideGrantStore();
    expect(s.anywhere('u1')).toBe(false);
    await s.load('u1', hanoi);
    expect(s.anywhere('u1')).toBe(true);
    expect(s.get('u1')).toBe(false);
    expect(s.anywhere('u2')).toBe(false);
    expect(s.anywhere(null)).toBe(false);
    s.reset();
    await s.load('u1', everywhere);
    expect(s.anywhere('u1')).toBe(true);
    s.reset();
    await s.load('u1', desk);
    expect(s.anywhere('u1')).toBe(false);
    expect(s.isEditor('u1')).toBe(true);
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

  // ── a remembered answer, and the wait for the real one ──

  it('is unsettled while the question is out, and settled once answered', async () => {
    const s = guideGrantStore();
    let answer!: (g: { cities: (string | null)[]; editor: boolean }) => void;
    const slow = () => new Promise<{ cities: (string | null)[]; editor: boolean }>((r) => { answer = r; });
    expect(s.settled('u1')).toBe(false);
    const loading = s.load('u1', slow);
    expect(s.settled('u1')).toBe(false);
    answer({ cities: [], editor: true });
    await loading;
    expect(s.settled('u1')).toBe(true);
    // Nobody has nothing to wait for.
    expect(s.settled(null)).toBe(true);
    // Another account's question is not this one's.
    expect(s.settled('u2')).toBe(false);
  });

  it('settles when the question fails, so nothing waits on it', async () => {
    const s = guideGrantStore();
    await s.load('u1', () => Promise.reject(new Error('offline')));
    expect(s.settled('u1')).toBe(true);
    expect(s.isEditor('u1')).toBe(false);
  });

  it('takes a remembered answer while the question is out, then the real one', async () => {
    const s = guideGrantStore();
    let answer!: (g: { cities: (string | null)[]; editor: boolean }) => void;
    const slow = () => new Promise<{ cities: (string | null)[]; editor: boolean }>((r) => { answer = r; });
    const loading = s.load('u1', slow);
    s.prime('u1', { cities: ['hanoi'], editor: true });
    expect(s.isEditor('u1')).toBe(true);
    expect(s.get('u1', 'hanoi')).toBe(true);
    expect(s.settled('u1')).toBe(false);
    // The database says less than last launch did: its word wins.
    answer({ cities: [], editor: false });
    await loading;
    expect(s.isEditor('u1')).toBe(false);
    expect(s.get('u1', 'hanoi')).toBe(false);
    expect(s.settled('u1')).toBe(true);
  });

  it('keeps a remembered answer given before the question was asked', async () => {
    const s = guideGrantStore();
    s.prime('u1', { cities: [], editor: true });
    expect(s.isEditor('u1')).toBe(true);
    let answer!: (g: { cities: (string | null)[]; editor: boolean }) => void;
    const slow = () => new Promise<{ cities: (string | null)[]; editor: boolean }>((r) => { answer = r; });
    const ask = vi.fn(slow);
    const loading = s.load('u1', ask);
    // Asking did not wipe what was remembered, and still asked.
    expect(s.isEditor('u1')).toBe(true);
    expect(ask).toHaveBeenCalledTimes(1);
    answer({ cities: [], editor: true });
    await loading;
    expect(s.isEditor('u1')).toBe(true);
  });

  it('ignores a remembered answer once the real one has landed', async () => {
    const s = guideGrantStore();
    await s.load('u1', nowhere);
    s.prime('u1', { cities: [null], editor: true });
    expect(s.isEditor('u1')).toBe(false);
    expect(s.get('u1', 'hanoi')).toBe(false);
  });

  it('keeps a remembered answer when the question fails', async () => {
    const s = guideGrantStore();
    const loading = s.load('u1', () => Promise.reject(new Error('offline')));
    s.prime('u1', { cities: [], editor: true });
    await loading;
    expect(s.isEditor('u1')).toBe(true);
    expect(s.settled('u1')).toBe(true);
  });

  it('ignores a remembered answer for nobody, and tells subscribers of one that counts', () => {
    const s = guideGrantStore();
    const heard = vi.fn();
    s.subscribe(heard);
    s.prime(null, { cities: [null], editor: true });
    expect(heard).not.toHaveBeenCalled();
    expect(s.isEditor(null)).toBe(false);
    s.prime('u1', { cities: [null], editor: true });
    expect(heard).toHaveBeenCalledTimes(1);
    expect(s.anywhere('u1')).toBe(true);
  });

  it('goes back to knowing nothing when reset', async () => {
    const s = guideGrantStore();
    await s.load('u1', everywhere);
    s.reset();
    expect(s.get('u1', 'hanoi')).toBe(false);
  });

  // ── the desk ──

  // An editor is answered separately from the grant, and neither implies
  // the other: the desk without a guide grant is still the desk, and a
  // guide of every city is still not the desk.
  it('knows an editor from a guide, in both directions', async () => {
    const d = guideGrantStore();
    await d.load('u1', desk);
    expect(d.isEditor('u1')).toBe(true);
    expect(d.get('u1', 'hanoi')).toBe(false);

    const g = guideGrantStore();
    await g.load('u1', everywhere);
    expect(g.isEditor('u1')).toBe(false);
  });

  it('never says editor for an account it was not asked about, or for nobody', async () => {
    const s = guideGrantStore();
    await s.load('u1', desk);
    expect(s.isEditor('u2')).toBe(false);
    expect(s.isEditor(null)).toBe(false);
    s.reset();
    expect(s.isEditor('u1')).toBe(false);
  });

  // Same cities, different desk: that is a change, and a panel waiting
  // on it has to hear.
  it('tells its subscribers when only the editor answer moves', async () => {
    const s = guideGrantStore();
    await s.load('u1', nowhere);
    const saw = vi.fn();
    s.subscribe(saw);
    s.reset();
    saw.mockClear();
    await s.load('u1', desk);
    expect(saw).toHaveBeenCalled();
    expect(s.isEditor('u1')).toBe(true);
  });
});
