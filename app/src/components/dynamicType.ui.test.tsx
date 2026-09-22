// @vitest-environment jsdom
//
// Dynamic Type, and the three boxes that cannot grow with it.
//
// A reader's text size multiplies every `Text` in the app, and nearly
// every layout here takes that: buttons are `minHeight`, rows are padding
// around their words. Three boxes are fixed by their nature — the 64pt
// tab bar, the 20pt shut sash drawn across a photograph, the 21pt count
// badge — and the caption inside each is capped at `labelScaleCap` so it
// is smaller rather than clipped. Everything else is left to scale, and
// that half of the rule is pinned here too: a cap that crept onto body
// copy would be the app deciding how big a reader's own words may be.
//
// react-native-web has no Dynamic Type and drops `maxFontSizeMultiplier`
// on the floor, so the prop is read on its way into `Text` rather than
// off the DOM: the module is wrapped once, and every caption's cap is
// recorded against its words.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '../uitest/render';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { Place } from '../lib/data';

/** What each run of words was rendered with. */
const caps = vi.hoisted(() => new Map<string, number | null | undefined>());
vi.mock('react-native', async (orig) => {
  const rn = await orig<typeof import('react-native')>();
  const R = await import('react');
  const words = (c: unknown): string => Array.isArray(c)
    ? c.map(words).join('')
    : (typeof c === 'string' || typeof c === 'number') ? String(c) : '';
  const Text = (props: React.ComponentProps<typeof rn.Text>) => {
    const w = words(props.children);
    if (w) caps.set(w, props.maxFontSizeMultiplier);
    return R.createElement(rn.Text, props);
  };
  return { ...rn, Text };
});
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
vi.mock('../lib/save', () => ({ useSave: () => ({ save: () => {}, isSaved: () => false }) }));
vi.mock('../lib/auth', () => ({ useAuth: () => ({ session: { user: { id: 'me' } } }) }));
vi.mock('../lib/crew', () => ({ useCrew: () => ({ ships: { data: [], reload: () => {}, loadedAt: Date.now() } }) }));
vi.mock('../lib/invitations', () => ({ useInvitations: () => ({ waiting: 0 }) }));
vi.mock('../lib/theme', () => ({ useScheme: () => ({ scheme: 'dark' }) }));

import { labelScaleCap } from '../theme';
import { UnderlineTabs } from './ui';
import PlaceCard from './PlaceCard';
import FloatingTabBar from './FloatingTabBar';
import { TabBarDuckProvider } from './tabBarDuck';

beforeEach(() => { caps.clear(); });
afterEach(() => { vi.useRealTimers(); });

describe('the three boxes that cannot grow', () => {
  it('caps the tab bar captions, and only the captions', () => {
    const names = ['Ideas', 'Explore', 'Trips', 'Collections', 'Profile'];
    const props = {
      state: { index: 0, routes: names.map((name) => ({ key: `${name}-k`, name })) },
      descriptors: Object.fromEntries(names.map((name) => [`${name}-k`, { options: { title: name } }])),
      navigation: { emit: () => ({ defaultPrevented: false }), navigate: () => {} },
    } as unknown as BottomTabBarProps;
    render(<TabBarDuckProvider><FloatingTabBar {...props} /></TabBarDuckProvider>);

    for (const name of names) expect(caps.get(name)).toBe(labelScaleCap);
  });

  it('caps the shut sash, and leaves the card’s own words to scale', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-09T23:00:00Z')); // 06:00 in Hanoi, two hours before opening
    const week = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      .map((d) => `${d}: 8:00 AM – 10:00 PM`);
    render(<PlaceCard onPress={() => {}} place={{
      slug: 'cong-caphe', city_id: 'hanoi', name_en: 'Cong Caphe', name_vi: 'Cộng Cà Phê', name_ja: 'コンカフェ',
      is_published: true, review_status: 'approved', place_photos: [], vibe_tags: [], categories: [],
      neighborhood_en: 'Hoan Kiem', opening_hours: week,
    } as unknown as Place} />);

    expect(screen.getByText('Opens 08:00')).toBeTruthy();
    expect(caps.get('Opens 08:00')).toBe(labelScaleCap);
    // The name and the neighbourhood sit in a card that wraps.
    expect(caps.get('Cong Caphe')).toBeUndefined();
    expect(caps.get('Hoan Kiem')).toBeUndefined();
  });

  it('caps the number in a tab’s count badge, and not the tab’s name', () => {
    render(
      <UnderlineTabs
        tabs={[
          { key: 'a', icon: 'people-outline', label: 'Crew', count: 3 },
          { key: 'b', icon: 'mail-outline', label: 'Requests', count: 7 },
        ]}
        active="a"
        onChange={() => {}}
      />,
    );
    // The chosen tab folds its count into its name; the other wears the disc.
    expect(caps.get('7')).toBe(labelScaleCap);
    expect(caps.get('Requests')).toBeUndefined();
    expect(caps.get('Crew (3)')).toBeUndefined();
  });
});

describe('the cap itself', () => {
  // Where the Large sizes end and the accessibility sizes begin — the
  // biggest setting on the ordinary slider still reaches every caption
  // whole. A cap under it would shrink what a reader picked from the
  // slider; one over it would let AX2 clip the sash.
  it('is the last ordinary size', () => {
    expect(labelScaleCap).toBe(1.3);
  });
});
