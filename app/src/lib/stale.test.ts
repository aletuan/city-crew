import { describe, expect, it } from 'vitest';
import { STALE_MS, shouldRefresh } from './stale';

describe('shouldRefresh', () => {
  const t = 1_700_000_000_000;

  it('leaves a list alone while it is still fresh', () => {
    expect(shouldRefresh(t, t)).toBe(false);
    expect(shouldRefresh(t, t + 1)).toBe(false);
    expect(shouldRefresh(t, t + STALE_MS - 1)).toBe(false);
  });

  it('asks again once the threshold is reached', () => {
    expect(shouldRefresh(t, t + STALE_MS)).toBe(true);
    expect(shouldRefresh(t, t + STALE_MS * 10)).toBe(true);
  });

  // The reader who opened the app on a dead connection and has walked back
  // into signal. `loaded` would be true and the data empty; only the
  // absence of a successful load says to try again.
  it('retries a load that has never succeeded', () => {
    expect(shouldRefresh(null, t)).toBe(true);
    expect(shouldRefresh(undefined, t)).toBe(true);
  });

  // A clock that moved backwards makes the age negative, which is not
  // freshness — it is a number that cannot be trusted. Without this the
  // list could never refresh again until the app restarted.
  it('treats a backwards clock as a reason to ask', () => {
    expect(shouldRefresh(t, t - 1)).toBe(true);
    expect(shouldRefresh(t, t - STALE_MS * 100)).toBe(true);
  });

  it('takes the threshold as an argument', () => {
    expect(shouldRefresh(t, t + 500, 1000)).toBe(false);
    expect(shouldRefresh(t, t + 1000, 1000)).toBe(true);
    // Zero means every check is a refresh, which is what a caller asking
    // for zero means by it.
    expect(shouldRefresh(t, t, 0)).toBe(true);
  });

  it('is two minutes by default', () => {
    expect(STALE_MS).toBe(120_000);
  });
});
