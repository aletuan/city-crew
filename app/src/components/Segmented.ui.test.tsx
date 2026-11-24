// @vitest-environment jsdom
//
// A few answers side by side: which one reads as chosen, to the eye and
// to a screen reader, and what a press says.

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, textStyleOf } from '../uitest/render';
import { colors } from '../theme';
import Segmented from './Segmented';

afterEach(cleanup);

const ITEMS = [
  { key: 'private' as const, label: 'Only me', icon: 'lock-closed-outline' as const, testID: 'seen-private' },
  { key: 'friends' as const, label: 'Friends', icon: 'people-outline' as const, testID: 'seen-friends' },
];

describe('Segmented', () => {
  it('is a radio group that marks the chosen answer and reads its meaning after its name', () => {
    render(<Segmented items={ITEMS} chosen="friends" onPick={() => {}} label="Who can see this visit?" said="Friends see the day." testID="seen" />);
    expect(screen.getByTestId('seen').getAttribute('aria-label')).toBe('Who can see this visit?');
    expect(screen.getByTestId('seen').getAttribute('role')).toBe('radiogroup');
    const on = screen.getByTestId('seen-friends');
    const off = screen.getByTestId('seen-private');
    expect(on.getAttribute('aria-checked')).toBe('true');
    expect(off.getAttribute('aria-checked')).toBe('false');
    expect(on.getAttribute('aria-label')).toBe('Friends, Friends see the day.');
    expect(off.getAttribute('aria-label')).toBe('Only me');
    expect(textStyleOf(screen.getByText('Friends'))?.color).toBe(colors.accent);
    expect(textStyleOf(screen.getByText('Only me'))?.color).toBe(colors.textSecondary);
  });

  it('names the chosen answer alone when no meaning is given, and says which answer was pressed', () => {
    const onPick = vi.fn();
    render(<Segmented items={ITEMS} chosen="private" onPick={onPick} label="Who?" testID="seen" />);
    expect(screen.getByTestId('seen-private').getAttribute('aria-label')).toBe('Only me');
    fireEvent.click(screen.getByTestId('seen-friends'));
    expect(onPick).toHaveBeenCalledWith('friends');
  });
});
