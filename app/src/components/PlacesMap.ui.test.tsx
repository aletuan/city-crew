// @vitest-environment jsdom
//
// `react-native-maps` is native; in jsdom it is stood in for by two plain
// views that record their props, so what is pinned here is what the map
// is *asked* to draw — which markers, which one is chosen, whether the
// reader's dot is on — not how Google draws it. The stand-in goes in at
// `./mapsModule`, the one file that requires the real thing.
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
// No `screen`: every query here goes through `document` and an unused
// import is an eslint *error* in this repo.
import { fireEvent, render } from '../uitest/render';
import type { Place } from '../lib/data';

const spies = vi.hoisted(() => ({ fitToCoordinates: vi.fn() }));

// `MiniMap` pulls in `expo-constants`, which cannot be imported in jsdom
// (see `uitest/setup.tsx` on `expo-updates` for the same failure). The
// verdict is all this component reads from it.
vi.mock('./MiniMap', () => ({ canDrawMap: true }));
vi.mock('./mapsModule', async () => {
  const R = await import('react');
  const MapView = R.forwardRef((p: any, ref: any) => {
    R.useImperativeHandle(ref, () => ({ fitToCoordinates: spies.fitToCoordinates }));
    return R.createElement('div', { 'data-stub': 'MapView', 'data-user': String(!!p.showsUserLocation) }, p.children);
  });
  const Marker = (p: any) => R.createElement('button', {
    type: 'button', 'data-stub': 'Marker', 'data-slug': p.identifier,
    'data-color': p.pinColor ?? '', onClick: p.onPress,
  });
  return { MapView, Marker, PROVIDER_GOOGLE: 'google' };
});
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import PlacesMap from './PlacesMap';

// The spy is module-scoped and vitest clears nothing between tests here
// (no `clearMocks` in the config), so a count from an earlier render would
// leak into the one test that counts.
beforeEach(() => { spies.fitToCoordinates.mockClear(); });

const place = (slug: string, lat: number | null, lng: number | null): Place =>
  ({ slug, name_en: slug, name_vi: slug, name_ja: null, lat, lng, place_photos: [], categories: [], vibe_tags: [] } as unknown as Place);

const markers = () => [...document.querySelectorAll('[data-stub="Marker"]')];

describe('PlacesMap', () => {
  it('pins every place that has coordinates, and skips the ones that do not', () => {
    render(<PlacesMap places={[place('a', 21, 105), place('b', 21.1, 105.1), place('c', null, null)]} selectedSlug={null} onSelect={() => {}} origin={null} />);
    expect(markers().map((m) => m.getAttribute('data-slug'))).toEqual(['a', 'b']);
  });

  it('draws the chosen pin in the accent and the rest in ink', () => {
    render(<PlacesMap places={[place('a', 21, 105), place('b', 21.1, 105.1)]} selectedSlug="b" onSelect={() => {}} origin={null} />);
    const [a, b] = markers();
    expect(b.getAttribute('data-color')).not.toBe(a.getAttribute('data-color'));
  });

  it('reports which pin was tapped', () => {
    const onSelect = vi.fn();
    render(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={onSelect} origin={null} />);
    fireEvent.click(markers()[0]);
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('shows the reader’s own position', () => {
    render(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={() => {}} origin={null} />);
    expect(document.querySelector('[data-stub="MapView"]')?.getAttribute('data-user')).toBe('true');
  });

  // The pins are the reason to look; the first thing the map does is show
  // all of them. And again whenever the set changes — a filter that
  // narrows the list to three places should not leave the reader looking
  // at an empty quarter of the city.
  it('fits the view to the pins, and refits when they change', () => {
    const { rerender } = render(<PlacesMap places={[place('a', 21, 105), place('b', 21.1, 105.1)]} selectedSlug={null} onSelect={() => {}} origin={null} />);
    expect(spies.fitToCoordinates).toHaveBeenCalledTimes(1);
    rerender(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={() => {}} origin={null} />);
    expect(spies.fitToCoordinates).toHaveBeenCalledTimes(2);
  });
});
