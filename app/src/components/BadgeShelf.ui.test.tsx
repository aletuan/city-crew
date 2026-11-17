// @vitest-environment jsdom
//
// The nine badges in the sheet: all of them drawn, held or not, and one
// sentence at a time about one of them — see the header of `BadgeShelf`.

import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, textStyleOf, viewStyleOf } from '../uitest/render';
import { BADGES, NO_FACTS, earnedBadges, type BadgeFacts, type BadgeId } from '../lib/badges';
import { colors } from '../theme';

const state = vi.hoisted(() => ({
  lang: 'en' as 'en' | 'vi',
  facts: null as unknown as BadgeFacts,
  unseen: [] as string[],
}));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: state.lang, t: (en: string, vi_: string) => (state.lang === 'vi' ? vi_ : en) }),
}));
vi.mock('../lib/rewards', async () => {
  const { earnedBadges: earnedOf } = await import('../lib/badges');
  return { useRewards: () => ({ facts: state.facts, earned: earnedOf(state.facts), unseen: state.unseen }) };
});

import BadgeShelf, { BADGE } from './BadgeShelf';

const cell = (id: BadgeId) => screen.getByTestId(`badge-${id}`);
const picture = (id: BadgeId) => cell(id).querySelector('img')!;
const about = () => screen.getByTestId('badge-about');
/** What the cell's press was handed — its face and whether it is the one
 *  picked — read off the component that set them: react-native-web
 *  writes neither `aria-selected` on a button nor the tint where jsdom
 *  can compute it. */
const pressOf = (id: BadgeId) => {
  // From the root's current tree, as `add.ui.test` reads: the fiber a
  // DOM node points at can be the one from before the last press.
  type Fiber = { child: Fiber | null; sibling: Fiber | null; memoizedProps: Record<string, unknown> | null };
  const host = document.body.firstElementChild as unknown as Record<string, { stateNode: { current: Fiber } }>;
  const stack: Fiber[] = [host[Object.keys(host).find((k) => k.startsWith('__reactContainer'))!].stateNode.current];
  let props: Record<string, unknown> | null = null;
  while (stack.length && !props) {
    const f = stack.pop()!;
    const p = f.memoizedProps;
    if (p && typeof p === 'object' && p.testID === `badge-${id}` && 'contentStyle' in p) props = p;
    if (f.sibling) stack.push(f.sibling);
    if (f.child) stack.push(f.child);
  }
  return {
    picked: (props!.accessibilityState as { selected: boolean }).selected,
    face: StyleSheet.flatten(props!.contentStyle as StyleProp<ViewStyle>) ?? {},
  };
};

beforeEach(() => {
  state.lang = 'en';
  state.facts = { ...NO_FACTS };
  state.unseen = [];
});

describe('the grid', () => {
  it('draws all nine, in the rules’ order, three to a row', () => {
    render(<BadgeShelf />);
    const cells = [...screen.getByTestId('badge-shelf').querySelectorAll('[data-testid^="badge-"][role="button"]')];
    expect(cells.map((c) => c.getAttribute('data-testid'))).toEqual(BADGES.map((id) => `badge-${id}`));
    // A third of the row each, and the row wraps.
    expect(viewStyleOf(cell('firstFind')).width).toBe('33.333%');
    const grid = viewStyleOf(cell('firstFind').parentElement!);
    expect([grid.flexDirection, grid.flexWrap]).toEqual(['row', 'wrap']);
  });

  it('draws a badge held in colour, and one not held in grey and dimmed', () => {
    state.facts = { ...NO_FACTS, saved: 3 };
    render(<BadgeShelf />);
    expect(picture('firstFind').getAttribute('src')).toMatch(/first-find\.webp/);
    expect(viewStyleOf(picture('firstFind')).opacity).toBeUndefined();
    expect(picture('curator').getAttribute('src')).toMatch(/curator-off\.webp/);
    expect(viewStyleOf(picture('curator')).opacity).toBe(0.6);
    // The same size either way: 56, three across a 375pt phone's card.
    expect(BADGE).toBe(56);
    for (const id of ['firstFind', 'curator'] as const) {
      expect([viewStyleOf(picture(id)).width, viewStyleOf(picture(id)).height]).toEqual([BADGE, BADGE]);
    }
  });

  it('gives each of the nine its own picture, and its own grey one', () => {
    render(<BadgeShelf />);
    const off = BADGES.map((id) => picture(id).getAttribute('src'));
    expect(new Set(off).size).toBe(9);
    expect(off.every((src) => /-off\.webp/.test(src!))).toBe(true);
  });

  it('names each under its picture, quieter while it is not held', () => {
    state.facts = { ...NO_FACTS, saved: 1 };
    render(<BadgeShelf />);
    const held = screen.getAllByText('First Find').find((e) => cell('firstFind').contains(e))!;
    const not = screen.getAllByText('Curator').find((e) => cell('curator').contains(e))!;
    expect(textStyleOf(held)?.color).toBe(colors.text);
    expect(textStyleOf(not)?.color).toBe(colors.textTertiary);
    // Two lines' room for each, taken or not, so the three rows stand
    // the same height whichever names run long.
    for (const name of [held, not]) {
      expect([textStyleOf(name)?.lineHeight, textStyleOf(name)?.minHeight]).toEqual([15, 30]);
    }
  });

  it('says to VoiceOver whether each is held', () => {
    state.facts = { ...NO_FACTS, saved: 1 };
    render(<BadgeShelf />);
    expect(screen.getByRole('button', { name: 'First Find, earned' })).toBe(cell('firstFind'));
    expect(screen.getByRole('button', { name: 'Curator, not yet earned' })).toBe(cell('curator'));
  });

  it('counts how many are held, of nine', () => {
    state.facts = { ...NO_FACTS, saved: 1, trips: 2, copies: 1 };
    render(<BadgeShelf />);
    expect(screen.getByTestId('badge-count').textContent).toBe('3 / 9');
    expect(screen.getByRole('heading', { name: 'Badges' })).toBeTruthy();
  });

  it('marks the ones earned since the sheet was last closed, and no others', () => {
    state.facts = { ...NO_FACTS, saved: 1, trips: 1 };
    state.unseen = ['onTheRoad'];
    render(<BadgeShelf />);
    expect(screen.getByTestId('badge-new-onTheRoad')).toBeTruthy();
    expect(cell('onTheRoad').contains(screen.getByTestId('badge-new-onTheRoad'))).toBe(true);
    expect(screen.queryByTestId('badge-new-firstFind')).toBeNull();
  });
});

describe('the line under the grid', () => {
  it('is about the badge the reader is nearest to, until one is pressed', () => {
    // Two of three cities: further along than anything else not held.
    state.facts = { ...NO_FACTS, saved: 4, checkins: 3, cities: 2 };
    render(<BadgeShelf />);
    expect(about().textContent).toBe('Traveller2 / 3Check in across 3 cities.');
    // How far along is quiet; "Earned" is said in the colour for done.
    expect(textStyleOf(screen.getByTestId('badge-steps'))?.color).toBe(colors.textTertiary);
    expect(pressOf('traveller').picked).toBe(true);
    expect(pressOf('firstFind').picked).toBe(false);
  });

  it('points a new account at keeping a place, with no "0 / 1" beside it', () => {
    render(<BadgeShelf />);
    expect(about().textContent).toBe('First FindSave your first place.');
    expect(screen.queryByTestId('badge-steps')).toBeNull();
  });

  it('turns to the badge that is pressed, held or not', () => {
    state.facts = { ...NO_FACTS, saved: 1 };
    render(<BadgeShelf />);
    fireEvent.click(cell('firstFind'));
    expect(about().textContent).toBe('First FindEarnedSave your first place.');
    expect(textStyleOf(screen.getByTestId('badge-steps'))?.color).toBe(colors.ok);
    expect(pressOf('firstFind').picked).toBe(true);
    fireEvent.click(cell('wellLiked'));
    expect(about().textContent).toBe('Well Liked0 / 5Get 5 likes on your collections.');
    expect(pressOf('firstFind').picked).toBe(false);
  });

  // The tint that says which one the line is about.
  it('tints the cell the line is about, and only that one', () => {
    render(<BadgeShelf />);
    const face = (id: BadgeId) => pressOf(id).face;
    expect(face('firstFind').backgroundColor).toBe(colors.accentSoft);
    expect(face('curator').backgroundColor).toBeUndefined();
    fireEvent.click(cell('curator'));
    expect(face('curator').backgroundColor).toBe(colors.accentSoft);
    expect(face('firstFind').backgroundColor).toBeUndefined();
  });

  it('says nothing under the grid once all nine are held, until one is pressed', () => {
    state.facts = { saved: 1, publicLists: 1, checkins: 3, cities: 3, friends: 1, trips: 1, submitted: 1, likes: 5, copies: 1 };
    expect(earnedBadges(state.facts)).toHaveLength(9);
    render(<BadgeShelf />);
    expect(screen.getByTestId('badge-count').textContent).toBe('9 / 9');
    expect(screen.queryByTestId('badge-about')).toBeNull();
    fireEvent.click(cell('traveller'));
    expect(about().textContent).toBe('TravellerEarnedCheck in across 3 cities.');
  });

  it('says it in Vietnamese', () => {
    state.lang = 'vi';
    state.facts = { ...NO_FACTS, saved: 1, cities: 1 };
    render(<BadgeShelf />);
    expect(screen.getByRole('heading', { name: 'Huy hiệu' })).toBeTruthy();
    expect(about().textContent).toBe('Lữ khách1 / 3Check-in ở 3 thành phố.');
    expect(screen.getByRole('button', { name: 'Khởi đầu, đã đạt' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lữ khách, chưa đạt' })).toBeTruthy();
    fireEvent.click(cell('firstFind'));
    expect(about().textContent).toBe('Khởi đầuĐã đạtLưu địa điểm đầu tiên.');
  });
});
