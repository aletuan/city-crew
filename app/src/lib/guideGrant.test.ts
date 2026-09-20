// One question, asked once per account, answerable without waiting.

import { describe, expect, it, vi } from 'vitest';
import { guideGrantStore } from './guideGrant';

const yes = () => Promise.resolve(true);
const no = () => Promise.resolve(false);

describe('guideGrantStore', () => {
  it('knows nothing until it is asked, which draws no control', () => {
    const s = guideGrantStore();
    expect(s.get('u1')).toBe(false);
  });

  it('holds the answer for the account it asked about', async () => {
    const s = guideGrantStore();
    await s.load('u1', yes);
    expect(s.get('u1')).toBe(true);
  });

  // The uid is part of the answer, not just the question. A render
  // between one account signing out and the next being asked about must
  // not read the previous account's grant.
  it('never answers for an account it was not asked about', async () => {
    const s = guideGrantStore();
    await s.load('u1', yes);
    expect(s.get('u2')).toBe(false);
    expect(s.get(null)).toBe(false);
  });

  // Mounting a reader and the launch sync in the same frame is the
  // ordinary case, and it must cost one request.
  it('asks once per account, however many callers there are', async () => {
    const s = guideGrantStore();
    const ask = vi.fn(yes);
    await Promise.all([s.load('u1', ask), s.load('u1', ask), s.load('u1', ask)]);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('asks again when the account changes', async () => {
    const s = guideGrantStore();
    const ask = vi.fn(yes);
    await s.load('u1', ask);
    await s.load('u2', ask);
    expect(ask).toHaveBeenCalledTimes(2);
    expect(s.get('u2')).toBe(true);
    expect(s.get('u1')).toBe(false);
  });

  // Signing out is not a question, and it clears the last answer rather
  // than leaving it where the next account could read it.
  it('forgets on sign-out without asking anything', async () => {
    const s = guideGrantStore();
    const ask = vi.fn(yes);
    await s.load('u1', ask);
    await s.load(null, ask);
    expect(ask).toHaveBeenCalledTimes(1);
    expect(s.get('u1')).toBe(false);
  });

  // A table that is not there yet, a network that went away. All of them
  // mean "draw no control", which is what the state already says.
  it('stays quiet when the question cannot be answered', async () => {
    const s = guideGrantStore();
    await s.load('u1', () => Promise.reject(new Error('down')));
    expect(s.get('u1')).toBe(false);
  });

  it('tells its subscribers when the answer moves, and only then', async () => {
    const s = guideGrantStore();
    const saw = vi.fn();
    const off = s.subscribe(saw);

    await s.load('u1', yes);
    const afterFirst = saw.mock.calls.length;
    expect(afterFirst).toBeGreaterThan(0);

    // Already asked, already true: nothing changed, nobody is told.
    await s.load('u1', yes);
    expect(saw.mock.calls.length).toBe(afterFirst);

    off();
    await s.load('u2', no);
    expect(saw.mock.calls.length).toBe(afterFirst);
  });

  it('goes back to knowing nothing when reset', async () => {
    const s = guideGrantStore();
    await s.load('u1', yes);
    s.reset();
    expect(s.get('u1')).toBe(false);
  });
});
