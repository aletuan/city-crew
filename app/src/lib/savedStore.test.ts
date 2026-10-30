// The saved set's store, without React: what a card's subscription can
// rely on — the set it reads, and being told exactly when it changes.

import { describe, expect, it, vi } from 'vitest';
import { savedStore } from './savedStore';

describe('savedStore', () => {
  it('reads back the set it was given, then the one that replaced it', () => {
    const first = new Set(['a']);
    const next = new Set(['a', 'b']);
    const store = savedStore(first);
    expect(store.get()).toBe(first);
    store.replace(next);
    expect(store.get()).toBe(next);
  });

  it('tells every subscriber when the set is replaced', () => {
    const store = savedStore(new Set());
    const one = vi.fn();
    const two = vi.fn();
    store.subscribe(one);
    store.subscribe(two);
    store.replace(new Set(['a']));
    expect(one).toHaveBeenCalledTimes(1);
    expect(two).toHaveBeenCalledTimes(1);
  });

  // The provider hands over its memoised set after every commit; the same
  // set again is no news, and telling every card would redraw them all.
  it('tells nobody when handed the set it already holds', () => {
    const set = new Set(['a']);
    const store = savedStore(set);
    const listener = vi.fn();
    store.subscribe(listener);
    store.replace(set);
    expect(listener).not.toHaveBeenCalled();
  });

  it('stops telling a subscriber once it unsubscribes', () => {
    const store = savedStore(new Set());
    const listener = vi.fn();
    const off = store.subscribe(listener);
    off();
    store.replace(new Set(['a']));
    expect(listener).not.toHaveBeenCalled();
  });
});
