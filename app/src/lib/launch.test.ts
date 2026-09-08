import { describe, expect, it, vi } from 'vitest';
import { launchStore } from './launch';

describe('launchStore', () => {
  it('starts unsettled and settles once', () => {
    const s = launchStore();
    const f = vi.fn();
    s.subscribe(f);
    expect(s.get()).toBe(false);
    s.settle();
    expect(s.get()).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
    // Explore's effect can re-run; a second settle says nothing new.
    s.settle();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('stops telling a subscriber that left', () => {
    const s = launchStore();
    const f = vi.fn();
    const off = s.subscribe(f);
    off();
    s.settle();
    expect(f).not.toHaveBeenCalled();
  });

  it('can be put back for the next test', () => {
    const s = launchStore();
    s.settle();
    s.reset();
    expect(s.get()).toBe(false);
  });
});
