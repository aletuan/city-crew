// @vitest-environment jsdom
//
// The bell on your own page (19 Nov 2026): the way to Activity, wearing
// the dot the last tab wears for what is new in comments (C7c) — read
// from the same copy, `lib/freshNews`.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../../uitest/render';
import { Bell } from './Bell';

const news = vi.hoisted(() => ({ fresh: 0 }));
vi.mock('../../lib/freshNews', () => ({ useFreshNews: () => news }));
vi.mock('../../lib/i18n', () => ({ useI18n: () => ({ t: (en: string) => en }) }));

beforeEach(() => { news.fresh = 0; });

describe('Bell', () => {
  it('is Activity, a press, and wears no dot with nothing new', () => {
    const open = vi.fn();
    render(<Bell onPress={open} />);
    const bell = screen.getByRole('button', { name: 'Activity' });
    expect(bell.querySelector('[data-icon="notifications-outline"]')).toBeTruthy();
    expect(screen.queryByTestId('person-bell-dot')).toBeNull();
    fireEvent.click(bell);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('wears the dot, and says how many, when something is new', () => {
    news.fresh = 3;
    render(<Bell onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Activity, 3 new' }).contains(screen.getByTestId('person-bell-dot'))).toBe(true);
  });
});
