// @vitest-environment jsdom
//
// The 320pt window: an iPhone SE, or any iPhone with Display Zoom on. No
// test here sees a pixel — layout is not simulated under jsdom — so what
// is pinned is the other half of the contract: that the pieces which
// change shape on a small phone lose nothing a reader could reach or a
// screen reader could hear. The guide button drops its word and keeps
// its name; the tab strip keeps every tab and its control.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';

// A 320pt window, the width the fixes are for. `react-native-web` reads
// the width from jsdom (1024 by default), so this is the only way to
// stand a small phone up under it.
vi.mock('react-native', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useWindowDimensions: () => ({ width: 320, height: 693, scale: 3, fontScale: 1 }),
}));

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
vi.mock('../lib/useGuideGrant', () => ({ useIsGuide: () => true }));
vi.mock('../lib/auth', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } }, profile: { full_name: 'Nguyễn Thu Trang' } }),
}));

import LocalGuidePanel from './LocalGuidePanel';
import { NARROW_WINDOW, UnderlineTabs, useNarrowWindow } from './ui';
import type { Place } from '../lib/types';

const place = {
  slug: 'cong-caphe', name_en: 'Cong Caphe', name_vi: 'Cộng Cà Phê', name_ja: null,
  submitted_by: 'u1', place_photos: [], vibe_tags: [], categories: [],
} as unknown as Place;

function Probe() {
  return <>{useNarrowWindow() ? 'narrow' : 'wide'}</>;
}

describe('a 320pt window', () => {
  it('is narrow, and the line sits between the two real widths', () => {
    render(<Probe />);
    expect(screen.getByText('narrow')).toBeTruthy();
    // 320 (SE, any zoomed iPhone) is under it; 375 (a zoomed Max) is over.
    expect(NARROW_WINDOW).toBeGreaterThan(320);
    expect(NARROW_WINDOW).toBeLessThanOrEqual(375);
  });

  it('keeps the guide button’s name when its word goes', () => {
    const onOpen = vi.fn();
    render(<LocalGuidePanel place={place} onOpen={onOpen} />);
    const btn = screen.getByRole('button', { name: 'Gallery' });
    // The word is the accessible name now, not a text node.
    expect(screen.queryByText('Gallery')).toBeNull();
    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('keeps every tab and the strip’s control', () => {
    const onChange = vi.fn();
    render(
      <UnderlineTabs
        tabs={[
          { key: 'requests', icon: 'mail-outline', label: 'Requests', count: 3 },
          { key: 'friends', icon: 'people-outline', label: 'Your friends', tally: 12 },
        ]}
        active="requests"
        onChange={onChange}
        right={<>view</>}
      />,
    );
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Requests (3)', 'Your friends (12)']);
    expect(screen.getByText('view')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Your friends/ }));
    expect(onChange).toHaveBeenCalledWith('friends');
  });
});
