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
const verdict = vi.hoisted(() => ({ canDrawMap: true }));
vi.mock('./MiniMap', () => verdict);
vi.mock('./mapsModule', async () => {
  const R = await import('react');
  // The ready signal is its own element, not a click on the map itself —
  // a click on a marker (which sits inside the map) must not bubble up
  // and be mistaken for `onMapReady`.
  const MapView = R.forwardRef((p: any, ref: any) => {
    R.useImperativeHandle(ref, () => ({ fitToCoordinates: spies.fitToCoordinates }));
    return R.createElement('div', {
      'data-stub': 'MapView', 'data-user': String(!!p.showsUserLocation),
    }, R.createElement('button', { type: 'button', 'data-stub': 'ready', onClick: p.onMapReady }), p.children);
  });
  const Marker = (p: any) => R.createElement('button', {
    type: 'button', 'data-stub': 'Marker', 'data-slug': p.identifier,
    'data-color': p.pinColor ?? '', onClick: p.onPress,
  });
  return { MapView, Marker, PROVIDER_GOOGLE: 'google' };
});

import PlacesMap from './PlacesMap';

// The spy is module-scoped and vitest clears nothing between tests here
// (no `clearMocks` in the config), so a count from an earlier render would
// leak into the one test that counts. The verdict is likewise reset, since
// one test below flips it.
beforeEach(() => {
  spies.fitToCoordinates.mockClear();
  verdict.canDrawMap = true;
});

const place = (slug: string, lat: number | null, lng: number | null, categories: string[] = []): Place =>
  ({ slug, name_en: slug, name_vi: slug, name_ja: null, lat, lng, place_photos: [], categories, vibe_tags: [] } as unknown as Place);

const markers = () => [...document.querySelectorAll('[data-stub="Marker"]')];
const mapView = () => document.querySelector('[data-stub="MapView"]')!;
const markMapReady = () => fireEvent.click(document.querySelector('[data-stub="ready"]')!);
const HANOI = { lat: 21.0285, lng: 105.8542 };

describe('PlacesMap', () => {
  it('pins every place that has coordinates, and skips the ones that do not', () => {
    render(<PlacesMap places={[place('a', 21, 105), place('b', 21.1, 105.1), place('c', null, null)]} selectedSlug={null} onSelect={() => {}} origin={null} fallback={HANOI} />);
    expect(markers().map((m) => m.getAttribute('data-slug'))).toEqual(['a', 'b']);
  });

  // The colour code is the filter row's: a café's pin is the café chip's
  // brown, a rooftop's the Views chip's blue. The chosen pin is coral
  // whatever it is, so the one the reader tapped is never lost among its
  // kind.
  it('draws the chosen pin in the accent and the rest in their category’s colour', () => {
    render(<PlacesMap places={[place('a', 21, 105, ['cafes']), place('b', 21.1, 105.1, ['cafes']), place('c', 21.2, 105.2, ['views'])]} selectedSlug="b" onSelect={() => {}} origin={null} fallback={HANOI} />);
    const [a, b, c] = markers();
    expect(b.getAttribute('data-color')).toBe('#FF6F5B');
    expect(a.getAttribute('data-color')).toBe('#D2A679');
    expect(c.getAttribute('data-color')).toBe('#6FB3C0');
  });

  it('draws a pin nothing classifies in ink, and every pin when the chosen slug matches none of them', () => {
    render(<PlacesMap places={[place('a', 21, 105), place('b', 21.1, 105.1)]} selectedSlug="zzz" onSelect={() => {}} origin={null} fallback={HANOI} />);
    const [a, b] = markers();
    expect(a.getAttribute('data-color')).toBe('#17150F');
    expect(b.getAttribute('data-color')).toBe('#17150F');
  });

  it('reports which pin was tapped', () => {
    const onSelect = vi.fn();
    render(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={onSelect} origin={null} fallback={HANOI} />);
    fireEvent.click(markers()[0]);
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('shows the reader’s own position', () => {
    render(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={() => {}} origin={null} fallback={HANOI} />);
    expect(mapView().getAttribute('data-user')).toBe('true');
  });

  // The pins are the reason to look; the first thing the map does, once it
  // is ready, is show all of them. And again whenever the set changes — a
  // filter that narrows the list to three places should not leave the
  // reader looking at an empty quarter of the city.
  it('fits the view to the pins once ready, and refits when they change', () => {
    const { rerender } = render(<PlacesMap places={[place('a', 21, 105), place('b', 21.1, 105.1)]} selectedSlug={null} onSelect={() => {}} origin={null} fallback={HANOI} />);
    expect(spies.fitToCoordinates).not.toHaveBeenCalled();

    markMapReady();
    expect(spies.fitToCoordinates).toHaveBeenCalledTimes(1);
    expect(spies.fitToCoordinates).toHaveBeenLastCalledWith(
      [{ latitude: 21, longitude: 105 }, { latitude: 21.1, longitude: 105.1 }],
      expect.objectContaining({ animated: false }),
    );

    rerender(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={() => {}} origin={null} fallback={HANOI} />);
    expect(spies.fitToCoordinates).toHaveBeenCalledTimes(2);
    expect(spies.fitToCoordinates).toHaveBeenLastCalledWith(
      [{ latitude: 21, longitude: 105 }],
      expect.objectContaining({ animated: false }),
    );
  });

  it('does not refit when the same pins reappear in a different order', () => {
    const { rerender } = render(<PlacesMap places={[place('a', 21, 105), place('b', 21.1, 105.1)]} selectedSlug={null} onSelect={() => {}} origin={null} fallback={HANOI} />);
    markMapReady();
    expect(spies.fitToCoordinates).toHaveBeenCalledTimes(1);

    rerender(<PlacesMap places={[place('b', 21.1, 105.1), place('a', 21, 105)]} selectedSlug={null} onSelect={() => {}} origin={null} fallback={HANOI} />);
    expect(spies.fitToCoordinates).toHaveBeenCalledTimes(1);
  });

  it('does not fit when there is nothing to pin', () => {
    render(<PlacesMap places={[]} selectedSlug={null} onSelect={() => {}} origin={null} fallback={HANOI} />);
    markMapReady();
    expect(spies.fitToCoordinates).not.toHaveBeenCalled();
  });

  // No Google map means no map — never Apple's, never a broken one.
  it('shows no map at all when the binary cannot draw a Google map', () => {
    verdict.canDrawMap = false;
    render(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={() => {}} origin={null} fallback={HANOI} />);
    expect(document.querySelector('[data-testid="places-map-missing"]')).toBeTruthy();
    expect(document.querySelector('[data-stub="MapView"]')).toBeNull();
  });
});
