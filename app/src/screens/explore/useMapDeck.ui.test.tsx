// @vitest-environment jsdom
//
// The deck's life beside the map's choice: cut by a pin tap, untouched by a
// swipe, rebuilt around the open place when the set changes, and gone when
// that place is. The arithmetic is `lib/mapDeck.test.ts`; this is the rule.
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '../../uitest/render';
import type { Place } from '../../lib/data';
import { useMapDeck } from './useMapDeck';

const at = (slug: string, km: number) => ({ slug, lat: 10 + km * 0.009, lng: 106 }) as unknown as Place;
const A = at('a', 0), B = at('b', 1), C = at('c', 2);
// One array per set: a new array is a new set, as it is to the map.
const ABC = [A, B, C], BC = [B, C];
const slugs = (v: { result: { current: { deckPlaces: Place[] } } }) => v.result.current.deckPlaces.map((p) => p.slug);

const mount = (shown: Place[], selected: string | null = null) => {
  const select = vi.fn();
  const view = renderHook(({ shown, selected }) => useMapDeck(shown, selected, select), { initialProps: { shown, selected } });
  return { select, view };
};

describe('useMapDeck', () => {
  it('has no deck until a pin is tapped, then the places round it, tapped first', () => {
    const { select, view } = mount(ABC);
    expect(slugs(view)).toEqual([]);
    act(() => view.result.current.pickPin('b'));
    expect(select).toHaveBeenCalledWith('b');
    expect(slugs(view)).toEqual(['b', 'a', 'c']);
  });

  it('lets the deck go with the choice when the map is tapped on nothing', () => {
    const { select, view } = mount(ABC);
    act(() => view.result.current.pickPin('a'));
    act(() => view.result.current.pickPin(null));
    expect(select).toHaveBeenLastCalledWith(null);
    expect(slugs(view)).toEqual([]);
  });

  it('does not move the deck when the choice moves by a swipe', () => {
    const { view } = mount(ABC, 'a');
    act(() => view.result.current.pickPin('a'));
    view.rerender({ shown: ABC, selected: 'c' });
    expect(slugs(view)).toEqual(['a', 'b', 'c']);
  });

  it('rebuilds round the open place when the set changes and it is still there', () => {
    const { view } = mount(ABC, 'a');
    act(() => view.result.current.pickPin('a'));
    view.rerender({ shown: ABC, selected: 'c' });          // swiped to c
    view.rerender({ shown: BC, selected: 'c' });           // a chip took a off
    expect(slugs(view)).toEqual(['c', 'b']);
  });

  it('is empty once the anchor left the set, and the open place with it — and goes nowhere else', () => {
    const { view } = mount(ABC, 'a');
    act(() => view.result.current.pickPin('a'));
    view.rerender({ shown: BC, selected: 'a' });
    expect(slugs(view)).toEqual([]);
  });

  it('has nothing to re-anchor on when nothing is open', () => {
    const { view } = mount(ABC);
    view.rerender({ shown: BC, selected: null });
    expect(slugs(view)).toEqual([]);
  });
});
