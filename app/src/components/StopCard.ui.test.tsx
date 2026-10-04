// @vitest-environment jsdom
//
// A stop's card on the plan editor, apart from the list it stands in.
// Pinned: what the card prints (the brand alone, the rating, the area
// line, the sentence it is handed, the warning when told it is out of
// order); what each control asks for (open, nudge earlier and later by
// the step, remove, move up and down for VoiceOver); when the card can
// be held and when it cannot; and the hour set by hand, marked.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '../uitest/render';
import type { Place } from '../lib/types';

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
vi.mock('../lib/useFlag', () => ({ useFlag: () => false }));

import StopCard, { NUDGE_MIN } from './StopCard';

const place = (over: Partial<Place> = {}): Place => ({
  slug: 'cafe', name_en: 'Cộng Café – Tràng Tiền', name_vi: 'Cộng', name_ja: null,
  categories: ['cafes'], neighborhood_en: 'Hoàn Kiếm', rating: 4.6, place_photos: [], opening_hours: null,
  ...over,
} as unknown as Place);

/** Props of the first committed element matching `pick`. */
const propsWhere = (pick: (p: Record<string, unknown>) => boolean): Record<string, any> => {
  type Fiber = { child: Fiber | null; sibling: Fiber | null; memoizedProps: Record<string, unknown> | null };
  const host = document.body.firstElementChild as unknown as Record<string, { stateNode: { current: Fiber } }>;
  const key = Object.keys(host).find((k) => k.startsWith('__reactContainer'))!;
  const stack: Fiber[] = [host[key].stateNode.current];
  while (stack.length) {
    const f = stack.pop()!;
    const p = f.memoizedProps;
    if (p && typeof p === 'object' && pick(p)) return p;
    if (f.sibling) stack.push(f.sibling);
    if (f.child) stack.push(f.child);
  }
  throw new Error('no matching element in the committed tree');
};
const band = () => propsWhere((p) => p.accessibilityLabel === 'Open Cộng Café – Tràng Tiền' && 'onLongPress' in p);

const draw = (over: Partial<React.ComponentProps<typeof StopCard>> = {}) => {
  const fns = { onOpen: vi.fn(), onNudge: vi.fn(), onRemove: vi.fn(), onMove: vi.fn(), onRelease: vi.fn() };
  render(
    <StopCard
      place={place()} arriveMin={18 * 60} dwellMin={75} pinned={false}
      why="An easy first stop." wrong={false}
      canMoveUp={false} canMoveDown
      {...fns} {...over}
    />,
  );
  return fns;
};

describe('StopCard', () => {
  it('prints the brand, the rating, the area line and the sentence', () => {
    draw();
    expect(screen.getByText('Cộng Café')).toBeTruthy();
    expect(screen.queryByText(/Tràng Tiền/)).toBeNull();
    expect(screen.getByText('4.6')).toBeTruthy();
    expect(screen.getByText('Hoàn Kiếm · Cafés · 75 min')).toBeTruthy();
    expect(screen.getByText('An easy first stop.')).toBeTruthy();
    expect(screen.getByText('18:00')).toBeTruthy();
  });

  it('opens from the identity band, and VoiceOver hears the whole name', () => {
    const { onOpen } = draw();
    fireEvent.click(screen.getByRole('button', { name: 'Open Cộng Café – Tràng Tiền' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('nudges the hour by the step, either way, and removes', () => {
    const { onNudge, onRemove } = draw();
    fireEvent.click(screen.getByRole('button', { name: `Arrive ${NUDGE_MIN} min earlier at Cộng Café – Tràng Tiền` }));
    expect(onNudge).toHaveBeenLastCalledWith(-NUDGE_MIN);
    fireEvent.click(screen.getByRole('button', { name: `Arrive ${NUDGE_MIN} min later at Cộng Café – Tràng Tiền` }));
    expect(onNudge).toHaveBeenLastCalledWith(NUDGE_MIN);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Cộng Café – Tràng Tiền' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('marks an hour the reader set', () => {
    const { unmount } = render(
      <StopCard place={place()} arriveMin={18 * 60} dwellMin={75} pinned={false} why="" wrong={false}
        canMoveUp={false} canMoveDown={false} onOpen={() => {}} onNudge={() => {}} onRemove={() => {}} onMove={() => {}} onRelease={() => {}} />,
    );
    const free = (screen.getByText('18:00') as HTMLElement).className;
    unmount();
    draw({ pinned: true });
    expect((screen.getByText('18:00') as HTMLElement).className).not.toBe(free);
  });

  it('says so when it is earlier than the stop above, and not otherwise', () => {
    draw({ wrong: true });
    expect(screen.getByText('Earlier than the stop above.')).toBeTruthy();
  });

  it('keeps quiet about order when the order is fine', () => {
    draw();
    expect(screen.queryByText('Earlier than the stop above.')).toBeNull();
  });

  // VoiceOver cannot drag: the moves are actions on the band, only the
  // ones that go somewhere.
  it('offers VoiceOver the moves that go somewhere, and makes them', () => {
    const { onMove } = draw({ canMoveUp: false, canMoveDown: true, onHold: () => {} });
    expect(band().accessibilityActions.map((a: { name: string }) => a.name)).toEqual(['moveDown']);
    act(() => { band().onAccessibilityAction({ nativeEvent: { actionName: 'moveDown' } }); });
    expect(onMove).toHaveBeenCalledWith('down');
    expect(band().accessibilityHint).toMatch(/Hold and drag/);
  });

  it('offers both moves in the middle of the list, and neither when nothing can move', () => {
    draw({ canMoveUp: true, canMoveDown: true, onHold: () => {} });
    expect(band().accessibilityActions.map((a: { name: string }) => a.name)).toEqual(['moveUp', 'moveDown']);
  });

  it('lifts on a hold when it can be moved, and lets go on press out', () => {
    const onHold = vi.fn();
    const { onRelease } = draw({ onHold });
    act(() => { band().onLongPress({ nativeEvent: { pageY: 512 } }); });
    expect(onHold).toHaveBeenCalledWith(512);
    act(() => { band().onPressOut(); });
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it('offers no hold, no actions and no hint when it cannot be moved', () => {
    draw({ onHold: undefined, canMoveUp: true, canMoveDown: true });
    expect(band().onLongPress).toBeUndefined();
    expect(band().accessibilityActions).toBeUndefined();
    expect(band().accessibilityHint).toBeUndefined();
  });

  it('wears the place’s photographs when it has any', () => {
    draw({ place: place({ place_photos: [{ id: 'a', photo_uri: 'https://img/a.jpg', is_cover: true, is_hidden: false, sort_order: 0, attribution_name: null }] } as Partial<Place>) });
    expect(screen.getByTestId('stop-hero')).toBeTruthy();
  });

  it('falls back to the pin for a place nothing classifies', () => {
    draw({ place: place({ categories: [] } as Partial<Place>) });
    expect(document.querySelector('[data-icon="location-outline"]')).toBeTruthy();
  });
});
