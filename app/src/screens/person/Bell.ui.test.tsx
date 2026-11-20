// @vitest-environment jsdom
//
// The bell on your own page (19 Nov 2026): the way to Activity, wearing
// the figure of what is new for you — the number the last tab's dot
// reads, from the same copy, `lib/freshNews` (one bell, 20 Nov 2026).

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, viewStyleOf } from '../../uitest/render';
import { bgHex, colors } from '../../theme';
import { Bell } from './Bell';

const news = vi.hoisted(() => ({ fresh: 0 }));
vi.mock('../../lib/freshNews', () => ({ useFreshNews: () => news }));
vi.mock('../../lib/i18n', () => ({ useI18n: () => ({ t: (en: string) => en }) }));
const theme = vi.hoisted(() => ({ scheme: 'light' as 'light' | 'dark' }));
vi.mock('../../lib/theme', () => ({ useScheme: () => theme }));

beforeEach(() => { news.fresh = 0; });

describe('Bell', () => {
  it('is Activity, a press, and wears no figure with nothing new', () => {
    const open = vi.fn();
    render(<Bell onPress={open} />);
    const bell = screen.getByRole('button', { name: 'Activity' });
    expect(bell.querySelector('[data-icon="notifications-outline"]')).toBeTruthy();
    expect(screen.queryByTestId('person-bell-figure')).toBeNull();
    fireEvent.click(bell);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('wears the figure, and says how many, when something is new', () => {
    news.fresh = 3;
    render(<Bell onPress={() => {}} />);
    // Beside the press, over it, not inside: the figure takes no touch.
    const bell = screen.getByRole('button', { name: 'Activity, 3 new' });
    const figure = screen.getByTestId('person-bell-figure');
    expect(bell.contains(figure)).toBe(false);
    expect(bell.parentElement!.contains(figure)).toBe(true);
    expect(figure.textContent).toBe('3');
    // The word tabs' news pill, in its inks (`tabBadge`), ringed in the
    // page's plain hex.
    expect(viewStyleOf(figure)).toMatchObject({ backgroundColor: colors.badgeSolid, borderColor: bgHex[theme.scheme] });
  });

  // Past nine it says only that it is more; VoiceOver still hears the count.
  it('says 9+ past nine', () => {
    news.fresh = 14;
    render(<Bell onPress={() => {}} />);
    expect(screen.getByTestId('person-bell-figure').textContent).toBe('9+');
    expect(screen.getByRole('button', { name: 'Activity, 14 new' })).toBeTruthy();
  });
});
