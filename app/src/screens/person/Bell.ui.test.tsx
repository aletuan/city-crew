// @vitest-environment jsdom
//
// The bell on your own page (19 Nov 2026): its dot waits for the comments'
// reading of what is new (C7c) and is drawn when that hands it `fresh`.

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../../uitest/render';
import { Bell } from './Bell';

vi.mock('../../lib/i18n', () => ({ useI18n: () => ({ t: (en: string) => en }) }));

describe('Bell', () => {
  it('is Activity, a press, and wears the dot only when something is new', () => {
    const open = vi.fn();
    const { unmount } = render(<Bell onPress={open} />);
    const bell = screen.getByRole('button', { name: 'Activity' });
    expect(bell.querySelector('[data-icon="notifications-outline"]')).toBeTruthy();
    expect(screen.queryByTestId('person-bell-dot')).toBeNull();
    fireEvent.click(bell);
    expect(open).toHaveBeenCalledTimes(1);
    unmount();
    render(<Bell onPress={open} fresh />);
    expect(screen.getByTestId('person-bell-dot')).toBeTruthy();
  });
});
