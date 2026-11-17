// @vitest-environment jsdom
//
// The four-second banner: that it comes, is heard, and goes by itself;
// that a press opens the sheet; and what it draws for one badge, for
// several, and for a level — see the header of `RewardBanner`.

import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, viewStyleOf } from '../uitest/render';
import type { Notice } from '../lib/badges';

const state = vi.hoisted(() => ({
  lang: 'en' as 'en' | 'vi',
  notice: null as unknown,
  dismiss: vi.fn(),
  want: vi.fn(),
  haptic: vi.fn(),
}));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: state.lang, t: (en: string, vi_: string) => (state.lang === 'vi' ? vi_ : en) }),
}));
vi.mock('../lib/rewards', () => ({
  useRewards: () => ({ notice: state.notice, dismiss: state.dismiss, want: state.want }),
}));
vi.mock('./ui/haptics', async (orig) => ({ ...(await orig<object>()), successHaptic: state.haptic }));

import RewardBanner, { BANNER_MS } from './RewardBanner';

const say = (notice: Notice | null) => { state.notice = notice; };
const banner = () => screen.queryByTestId('reward-banner');
const at = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

let announce: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.useFakeTimers();
  state.lang = 'en';
  state.notice = null;
  state.dismiss.mockClear();
  state.want.mockClear();
  state.haptic.mockClear();
  announce = vi.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  announce.mockRestore();
});

describe('RewardBanner', () => {
  it('draws nothing, says nothing and taps nothing until there is something to say', () => {
    render(<RewardBanner onOpen={() => {}} />);
    expect(banner()).toBeNull();
    expect(announce).not.toHaveBeenCalled();
    expect(state.haptic).not.toHaveBeenCalled();
  });

  it('shows a badge by its picture and name, says it to VoiceOver, and taps once', () => {
    say({ kind: 'badge', id: 'beenThere' });
    render(<RewardBanner onOpen={() => {}} />);
    expect(banner()!.textContent).toBe('New badgeBeen There');
    expect(banner()!.querySelector('img')!.getAttribute('src')).toMatch(/been-there\.webp/);
    expect(screen.getByRole('button', { name: 'New badge: Been There' })).toBe(banner());
    expect(announce).toHaveBeenCalledWith('New badge: Been There');
    expect(state.haptic).toHaveBeenCalledTimes(1);
  });

  it('stays four seconds and then asks to be taken down', async () => {
    say({ kind: 'badge', id: 'beenThere' });
    render(<RewardBanner onOpen={() => {}} />);
    expect(BANNER_MS).toBe(4000);
    await at(BANNER_MS - 1);
    expect(state.dismiss).not.toHaveBeenCalled();
    await at(1);
    expect(state.dismiss).toHaveBeenCalledTimes(1);
    // Left alone, it opens nothing.
    expect(state.want).not.toHaveBeenCalled();
  });

  it('opens the sheet when pressed: taken down, the sheet asked for, the reader taken there', () => {
    const onOpen = vi.fn();
    say({ kind: 'badge', id: 'curator' });
    render(<RewardBanner onOpen={onOpen} />);
    fireEvent.click(banner()!);
    expect(state.dismiss).toHaveBeenCalledTimes(1);
    expect(state.want).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  // Taken down early — pressed, or the account changed — its clock goes
  // with it, and does not take down whatever is said next.
  it('stops its clock when it is taken down early', async () => {
    say({ kind: 'badge', id: 'curator' });
    const view = render(<RewardBanner onOpen={() => {}} />);
    await at(1000);
    say(null);
    view.rerender(<RewardBanner onOpen={() => {}} />);
    expect(banner()).toBeNull();
    await at(BANNER_MS);
    expect(state.dismiss).not.toHaveBeenCalled();
  });

  it('gives a second notice its own four seconds, and says it too', async () => {
    say({ kind: 'badge', id: 'curator' });
    const view = render(<RewardBanner onOpen={() => {}} />);
    await at(3000);
    say({ kind: 'level', level: 4 });
    view.rerender(<RewardBanner onOpen={() => {}} />);
    await at(BANNER_MS - 1);
    expect(state.dismiss).not.toHaveBeenCalled();
    await at(1);
    expect(state.dismiss).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenLastCalledWith('Level up: Level 4');
    expect(state.haptic).toHaveBeenCalledTimes(2);
  });

  // No one badge to draw: a mark stands where the picture would.
  it('says several badges as their number, under a ribbon', () => {
    say({ kind: 'badges', count: 5 });
    render(<RewardBanner onOpen={() => {}} />);
    expect(banner()!.textContent).toBe('Your badgesYou hold 5 badges');
    expect(banner()!.querySelector('img')).toBeNull();
    // The ribbon that heads the sheet it opens.
    expect(banner()!.querySelector('[data-icon="ribbon-outline"]')).toBeTruthy();
    expect(banner()!.querySelector('[data-icon="trophy-outline"]')).toBeNull();
  });

  // The trophy the level's card wears in that sheet.
  it('says a level under the level’s own trophy', () => {
    say({ kind: 'level', level: 19 });
    render(<RewardBanner onOpen={() => {}} />);
    expect(banner()!.textContent).toBe('Level upLevel 19');
    expect(banner()!.querySelector('[data-icon="trophy-outline"]')).toBeTruthy();
    expect(banner()!.querySelector('[data-icon="ribbon-outline"]')).toBeNull();
  });

  it('says it in Vietnamese', () => {
    state.lang = 'vi';
    say({ kind: 'badge', id: 'onTheRoad' });
    render(<RewardBanner onOpen={() => {}} />);
    expect(banner()!.textContent).toBe('Huy hiệu mớiLên đường');
    expect(announce).toHaveBeenCalledWith('Huy hiệu mới: Lên đường');
  });

  // Over the screen and not in it: the strip takes no touches of its
  // own, and stands clear of the status bar.
  it('rides above the page, under the status bar, in the way of nothing but itself', () => {
    say({ kind: 'badge', id: 'curator' });
    render(<RewardBanner onOpen={() => {}} />);
    const strip = banner()!.parentElement!.parentElement!;
    const lay = viewStyleOf(strip);
    expect([lay.position, lay.left, lay.right]).toEqual(['absolute', 16, 16]);
    // The stand-in for the safe area reports no inset: 8 under nothing.
    expect(lay.top).toBe(8);
    expect(lay.pointerEvents).toBe('box-none');
  });
});
