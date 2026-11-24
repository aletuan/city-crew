// @vitest-environment jsdom
//
// `Sheet`'s own tests: the chrome every sheet now takes from it, and the
// choices a caller is left with. The sheets on it have their own tests
// for what they hold; these are for what they all share.

import React from 'react';
import { Animated, Text } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, viewStyleOf } from '../../uitest/render';

vi.mock('../../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import { Sheet } from './sheet';
import { colors } from '../../theme';

/** The grabber: the one 4pt-tall bar in the panel. */
const grabber = () => [...document.querySelectorAll<HTMLElement>('div')].find((d) => viewStyleOf(d).height === 4)!;

describe('Sheet', () => {
  // The owner's choice, 24 Nov 2026: the settings sheets' 36 in
  // `borderGlass` gave way to this one, so every sheet draws it.
  it('draws the one grabber: 38 wide, in textTertiary', () => {
    render(<Sheet visible onClose={() => {}}><Text>Body</Text></Sheet>);
    expect(viewStyleOf(grabber())).toMatchObject({ width: 38, backgroundColor: colors.textTertiary });
  });

  it('pulls from the head alone when asked, and from nowhere when not', () => {
    const { rerender } = render(
      <Sheet visible onClose={() => {}} pull="head" head={<Text>Title</Text>}><Text>List</Text></Sheet>,
    );
    const grab = screen.getByTestId('sheet-grab');
    expect(grab.contains(screen.getByText('Title'))).toBe(true);
    expect(grab.contains(grabber())).toBe(true);
    expect(grab.contains(screen.getByText('List'))).toBe(false);
    // Pulled by the whole panel, or not at all: no separate grip.
    for (const pull of ['sheet', undefined] as const) {
      rerender(<Sheet visible onClose={() => {}} pull={pull} head={<Text>Title</Text>}><Text>List</Text></Sheet>);
      expect(screen.queryByTestId('sheet-grab')).toBeNull();
      expect(screen.getByText('Title')).toBeTruthy();
    }
  });

  // The Explore filter pulls from the panel while it fits and from its
  // head once it scrolls; its head must be the same node either way.
  it('keeps the head where it was when the pull moves, under the name it is given', () => {
    const at = (pull: 'sheet' | 'head') => (
      <Sheet visible onClose={() => {}} pull={pull} grabTestID="top" head={<Text>Title</Text>}><Text>List</Text></Sheet>
    );
    const { rerender } = render(at('sheet'));
    const title = screen.getByText('Title');
    expect(screen.getByTestId('top').contains(title)).toBe(true);
    rerender(at('head'));
    expect(screen.getByText('Title')).toBe(title);
    expect(screen.getByTestId('top').contains(title)).toBe(true);
  });

  it('names the tap above it as the caller says, and closes on it', () => {
    const onClose = vi.fn();
    render(
      <Sheet visible onClose={onClose} backdropLabel="Not now" backdropTestID="above"><Text>Body</Text></Sheet>,
    );
    fireEvent.click(screen.getByLabelText('Not now'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('above')).toBeTruthy();
  });

  it('starts the spring as far under as it is told', () => {
    // Held where it starts, so the panel's place is the start's.
    vi.spyOn(Animated, 'spring').mockReturnValue({ start: () => {} } as never);
    render(<Sheet visible onClose={() => {}} riseFrom={60} testID="panel"><Text>Body</Text></Sheet>);
    expect(screen.getByTestId('panel').style.transform).toMatch(/translateY\(60px\)/);
  });
});
