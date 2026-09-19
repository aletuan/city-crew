import { describe, expect, it } from 'vitest';
import { cycleStatus, parseView, VIEW_KEY } from './exploreView';

describe('parseView', () => {
  it('reads the two stored values and nothing else', () => {
    expect(parseView('map')).toBe('map');
    expect(parseView('list')).toBe('list');
  });
  // A value nobody wrote — a typo, an old build, a null from a fresh
  // install — is the default, not an error.
  it('falls back to the list for anything unknown', () => {
    expect(parseView(null)).toBe('list');
    expect(parseView('')).toBe('list');
    expect(parseView('tile')).toBe('list');
  });
  it("keys its storage under the app's namespace", () => {
    expect(VIEW_KEY).toBe('citycrew.explore.view');
  });
});

describe('cycleStatus', () => {
  // One button, three answers: each tap moves to the next, and from the
  // last one back to none.
  it('walks any → open → closed → any', () => {
    expect(cycleStatus('any')).toBe('open');
    expect(cycleStatus('open')).toBe('closed');
    expect(cycleStatus('closed')).toBe('any');
  });
});
