// @vitest-environment jsdom
//
// The pill on a place nobody else can see. What is pinned: nothing on a
// live place; the word and the look's own pair for each state; a tap that
// says who can see the place, and that does not also open it; and the
// grid's smaller size and hairline.

import React from 'react';
import { Alert, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';
import type { Place } from '../lib/data';

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import ReviewBadge from './ReviewBadge';
import PlaceTile from './PlaceTile';
import { colors, onPhoto } from '../theme';

const place = (over: Partial<Place> = {}): Place => ({
  slug: 'saigon-concept', name_en: 'Saigon Concept', name_vi: 'Saigon Concept',
  is_published: false, review_status: 'pending', place_photos: [],
  ...over,
} as unknown as Place);

let alert: ReturnType<typeof vi.spyOn>;
beforeEach(() => { alert = vi.spyOn(Alert, 'alert').mockImplementation(() => {}); });
afterEach(() => { alert.mockRestore(); });

const pill = () => screen.getByTestId('pill');
const style = () => getComputedStyle(pill());

describe('ReviewBadge', () => {
  it('draws nothing on a live place', () => {
    render(<ReviewBadge place={place({ is_published: true, review_status: 'approved' })} testID="pill" />);
    expect(screen.queryByTestId('pill')).toBeNull();
  });

  it('waits in the look’s amber pair', () => {
    render(<ReviewBadge place={place()} testID="pill" />);
    expect(pill().textContent).toBe('Pending');
    expect(pill().querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('time-outline');
    expect(style().backgroundColor).toBe(resolved(colors.warnSoft));
    expect(getComputedStyle(screen.getByText('Pending')).color).toBe(resolved(colors.warnInk));
  });

  // Flagged is the desk looking again at a place it had approved, not a
  // no (owner, 23 Oct 2026): the same amber wait, under its own glyph —
  // and not the close-and-delete cross the grid wore first.
  it('says In review in the same amber pair, under a turn of arrows', () => {
    render(<ReviewBadge place={place({ is_published: true, review_status: 'flagged' })} testID="pill" />);
    expect(pill().textContent).toBe('In review');
    expect(pill().querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('refresh');
    expect(style().backgroundColor).toBe(resolved(colors.warnSoft));
    expect(getComputedStyle(screen.getByText('In review')).color).toBe(resolved(colors.warnInk));
  });

  it('says, when tapped, that only its owner can see a place still waiting', () => {
    render(<ReviewBadge place={place()} testID="pill" />);
    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));
    expect(alert).toHaveBeenCalledWith(
      'Pending',
      'Only you can see this place for now. Once it is approved, everyone will see it here and across City Crew.',
      [{ text: 'Got it' }],
    );
  });

  it('says, when tapped, that a place in review comes back once it is done', () => {
    render(<ReviewBadge place={place({ review_status: 'flagged' })} testID="pill" />);
    fireEvent.click(screen.getByRole('button', { name: 'In review' }));
    expect(alert).toHaveBeenCalledWith(
      'In review',
      'This place is being looked at again. Until that is done only you can see it; then everyone will see it again.',
      [{ text: 'Got it' }],
    );
  });

  // 11pt on the grid, where a tile is 111pt across; the card keeps its 12.
  it('sets a smaller word on the grid, with a hairline over the photograph', () => {
    render(<ReviewBadge place={place()} compact overPhoto testID="pill" />);
    expect(word().fontSize).toBe(11);
    expect(ground().borderColor).toBe(onPhoto.line);
    expect(pill().querySelector('[data-icon]')?.getAttribute('data-size')).toBe('12');
  });

  it('sets the card’s 12pt word, with no hairline, off a photograph', () => {
    render(<ReviewBadge place={place()} testID="pill" />);
    expect(word().fontSize).toBe(12);
    expect(ground().borderWidth).toBeUndefined();
    expect(pill().querySelector('[data-icon]')?.getAttribute('data-size')).toBe('13');
  });

  // On a tile the pill is a press inside a press: the explanation, not
  // the place, is what a tap on it opens.
  it('explains rather than opening the place when tapped on a tile', () => {
    const open = vi.fn();
    render(<PlaceTile place={place()} size={111} onPress={open} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));
    expect(alert).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
  });
});

/** The committed props of the first element `pick` accepts — a style
 *  read back from the DOM keeps the colours and drops the sizes. */
function propsWhere(pick: (p: Record<string, unknown>) => boolean): Record<string, unknown> {
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
  throw new Error('nothing matched');
}
const word = () => StyleSheet.flatten(propsWhere((p) => p.children === 'Pending' && 'style' in p).style as StyleProp<TextStyle>) ?? {};
const ground = () => StyleSheet.flatten(propsWhere((p) => p.testID === 'pill' && 'style' in p).style as StyleProp<ViewStyle>) ?? {};

/** A colour as the browser resolves it, to compare against a style read
 *  back — a token may be hex, rgba or a named dynamic pair. */
function resolved(c: unknown): string {
  const el = document.createElement('div');
  el.style.backgroundColor = String(c);
  document.body.appendChild(el);
  const out = getComputedStyle(el).backgroundColor;
  el.remove();
  expect(out).not.toBe('');
  return out;
}
