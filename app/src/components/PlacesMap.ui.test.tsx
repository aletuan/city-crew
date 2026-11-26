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
import { act, fireEvent, render } from '../uitest/render';
import type { Place } from '../lib/data';
import { pinImage } from './mapPins';

const spies = vi.hoisted(() => ({ fitToCoordinates: vi.fn(), animateCamera: vi.fn(), still: false }));
// Less motion, asked for by the reader's settings — read through `./ui`.
vi.mock('./ui', async (orig) => ({ ...(await orig<typeof import('./ui')>()), useReducedMotion: () => spies.still }));

// `MiniMap` pulls in `expo-constants`, which cannot be imported in jsdom
// (see `uitest/setup.tsx` on `expo-updates` for the same failure). The
// verdict is all this component reads from it.
const verdict = vi.hoisted(() => ({ canDrawMap: true }));
vi.mock('./MiniMap', () => verdict);
const win = vi.hoisted(() => ({ width: 400, height: 800 }));
// The window is nothing in jsdom; a phone is stood up, since the map's
// opening is worked out from it (`fitRegion`).
vi.mock('react-native', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useWindowDimensions: () => ({ width: win.width, height: win.height, scale: 3, fontScale: 1 }),
}));
vi.mock('./mapsModule', async () => {
  const R = await import('react');
  // The ready signal is its own element, not a click on the map itself —
  // a click on a marker (which sits inside the map) must not bubble up
  // and be mistaken for `onMapReady`.
  const MapView = R.forwardRef((p: any, ref: any) => {
    R.useImperativeHandle(ref, () => ({ fitToCoordinates: spies.fitToCoordinates, getCamera: async () => ({ zoom: 12 }), animateCamera: spies.animateCamera }));
    return R.createElement('div', {
      'data-stub': 'MapView', 'data-user': String(!!p.showsUserLocation), 'data-opening': JSON.stringify(p.initialRegion),
      'data-poi-icons': String(!(p.customMapStyle ?? []).some((r: any) => r.featureType === 'poi' && r.elementType === 'labels.icon' && r.stylers?.[0]?.visibility === 'off')),
    },
    R.createElement('button', { type: 'button', 'data-stub': 'ready', onClick: p.onMapReady }),
    // The map laid out at a phone's size.
    R.createElement('button', { type: 'button', 'data-stub': 'layout', onClick: () => p.onLayout?.({ nativeEvent: { layout: { width: 400, height: 800 } } }) }),
    // A tap on the map's own ground, and the same tap as a provider that
    // also reports a marker's press there.
    R.createElement('button', { type: 'button', 'data-stub': 'ground', onClick: () => p.onPress?.({ nativeEvent: {} }) }),
    R.createElement('button', { type: 'button', 'data-stub': 'ground-marker', onClick: () => p.onPress?.({ nativeEvent: { action: 'marker-press' } }) }),
    // The map telling the component how wide a stretch of the world is on
    // screen — which is what the clustering is cut from. A street's width.
    R.createElement('button', {
      type: 'button',
      'data-stub': 'zoom-in',
      onClick: () => p.onRegionChangeComplete?.({ latitudeDelta: 0.0005, longitudeDelta: 0.0005 }),
    }),
    p.children);
  });
  // Children matter now: a cluster's marker carries the bubble that shows
  // the count, where a place's marker carries nothing.
  const Marker = (p: any) => R.createElement('button', {
    type: 'button', 'data-stub': 'Marker', 'data-slug': p.identifier,
    'data-color': p.pinColor ?? '', 'data-icon': p.image ?? '',
    'data-anchor': p.anchor ? `${p.anchor.x},${p.anchor.y}` : '',
    'data-label': p.accessibilityLabel ?? '',
    'data-tracks': String(!!p.tracksViewChanges), onClick: p.onPress,
    'data-opacity': String(p.opacity ?? 1), 'data-tappable': String(p.tappable ?? true),
  }, p.children);
  return { MapView, Marker, PROVIDER_GOOGLE: 'google' };
});

import PlacesMap from './PlacesMap';

// The spy is module-scoped and vitest clears nothing between tests here
// (no `clearMocks` in the config), so a count from an earlier render would
// leak into the one test that counts. The verdict is likewise reset, since
// one test below flips it.
beforeEach(() => {
  spies.fitToCoordinates.mockClear();
  spies.animateCamera.mockClear();
  spies.still = false;
  verdict.canDrawMap = true;
  Object.assign(win, { width: 400, height: 800 });
});

const place = (slug: string, lat: number | null, lng: number | null, categories: string[] = []): Place =>
  ({ slug, name_en: slug, name_vi: slug, name_ja: null, lat, lng, place_photos: [], categories, vibe_tags: [] } as unknown as Place);

const markers = () => [...document.querySelectorAll('[data-stub="Marker"]')];
const zoomIn = () => fireEvent.click(document.querySelector('[data-stub="zoom-in"]')!);
const mapView = () => document.querySelector('[data-stub="MapView"]')!;
const markMapReady = () => fireEvent.click(document.querySelector('[data-stub="ready"]')!);
const HANOI = { lat: 21.0285, lng: 105.8542 };

describe('PlacesMap', () => {
  it('pins every place that has coordinates, and skips the ones that do not', () => {
    render(<PlacesMap places={[place('a', 21, 105), place('b', 21.1, 105.1), place('c', null, null)]} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    expect(markers().map((m) => m.getAttribute('data-slug'))).toEqual(['a', 'b']);
  });

  // The colour code is the filter row's: a café's pin is the café chip's
  // A pin used to be a hue and nothing else — no glyph, no label, nine
  // categories on one channel. Now it is a picture, and the picture says
  // which kind of place it is.
  it('draws each place in its own category’s picture, and the chosen one in coral', () => {
    render(<PlacesMap places={[place('a', 21, 105, ['cafes']), place('b', 21.1, 105.1, ['cafes']), place('c', 21.2, 105.2, ['views'])]} selectedSlug="b" onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    const [a, b, c] = markers();
    expect(a.getAttribute('data-icon')).toBe(String(pinImage({ categories: ['cafes'] }, null, false)));
    expect(b.getAttribute('data-icon')).toBe(String(pinImage({ categories: ['cafes'] }, null, true)));
    expect(c.getAttribute('data-icon')).toBe(String(pinImage({ categories: ['views'] }, null, false)));
    expect(a.getAttribute('data-icon')).not.toBe(b.getAttribute('data-icon'));
  });

  it('paints every pin in the chip’s picture while a chip is selected', () => {
    render(<PlacesMap places={[place('a', 21, 105, ['cafes', 'focus']), place('b', 21.1, 105.1, ['focus']), place('c', 21.2, 105.2, ['focus'])]} selectedSlug="c" onSelect={() => {}} categories={['focus']} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    const [a, b, c] = markers();
    const focusPin = String(pinImage({ categories: ['focus'] }, null, false));
    // The café that is also a place to work stops reading as the odd one
    // out under Focus.
    expect(a.getAttribute('data-icon')).toBe(focusPin);
    expect(b.getAttribute('data-icon')).toBe(focusPin);
    // The chosen pin is coral under a chip too — it is the one thing the
    // chip does not already say.
    expect(c.getAttribute('data-icon')).toBe(String(pinImage({ categories: ['focus'] }, 'focus', true)));
  });

  it('lets each pin speak for itself under a chip the table has never heard of', () => {
    render(<PlacesMap places={[place('a', 21, 105, ['cafes']), place('b', 21.1, 105.1)]} selectedSlug={null} onSelect={() => {}} categories={['street_food']} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    const [a, b] = markers();
    expect(a.getAttribute('data-icon')).toBe(String(pinImage({ categories: ['cafes'] }, null, false)));
    expect(b.getAttribute('data-icon')).toBe(String(pinImage({}, null, false)));
  });

  it('draws a place nothing classifies in the neutral pin, and no pin as chosen when the slug matches none', () => {
    render(<PlacesMap places={[place('a', 21, 105), place('b', 21.1, 105.1)]} selectedSlug="zzz" onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    const neutralImage = String(pinImage({}, null, false));
    for (const m of markers()) expect(m.getAttribute('data-icon')).toBe(neutralImage);
  });

  // `image` and not `icon`. On iOS `didInsertInMap` rebuilds the real
  // marker and restores a fixed list of properties: the icon view is on
  // it, the icon is not, so an `icon` whose bitmap loaded before insertion
  // was lost and the pin came out as Google's default red. `image`
  // survives either order, and the library re-assigns the icon view when
  // the bitmap arrives — which is also why freezing it here is safe.
  it('never redraws a place’s pin, and stands it on the coordinate', () => {
    render(<PlacesMap places={[place('a', 21, 105, ['cafes'])]} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    expect(markers()[0].getAttribute('data-tracks')).toBe('false');
    // The teardrop's tip is what stands on the coordinate.
    expect(markers()[0].getAttribute('data-anchor')).toBe('0.5,1');
  });

  it('reports which pin was tapped', () => {
    const onSelect = vi.fn();
    render(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={onSelect} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    fireEvent.click(markers()[0]);
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  // Our places are Google's places, so its own badge for each one sat
  // beside our pin. The badge goes; the name stays.
  it('asks the map not to draw its own badge on a place of interest', () => {
    render(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    expect(mapView().getAttribute('data-poi-icons')).toBe('false');
  });

  it('shows the reader’s own position', () => {
    render(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    expect(mapView().getAttribute('data-user')).toBe('true');
  });

  // The pins are the reason to look; the first thing the map does, once it
  // is ready, is show all of them. And again whenever the set changes — a
  // filter that narrows the list to three places should not leave the
  // reader looking at an empty quarter of the city.
  it('fits the view to the pins once ready, and refits when they change', () => {
    const { rerender } = render(<PlacesMap places={[place('a', 21, 105), place('b', 21.1, 105.1)]} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    expect(spies.fitToCoordinates).not.toHaveBeenCalled();

    markMapReady();
    expect(spies.fitToCoordinates).toHaveBeenCalledTimes(1);
    expect(spies.fitToCoordinates).toHaveBeenLastCalledWith(
      [{ latitude: 21, longitude: 105 }, { latitude: 21.1, longitude: 105.1 }],
      expect.objectContaining({ animated: false }),
    );

    // A new set glides there; only the first fit lands at once.
    rerender(<PlacesMap places={[place('a', 21, 105), place('c', 21.2, 105.2)]} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    expect(spies.fitToCoordinates).toHaveBeenCalledTimes(2);
    expect(spies.fitToCoordinates).toHaveBeenLastCalledWith(
      [{ latitude: 21, longitude: 105 }, { latitude: 21.2, longitude: 105.2 }],
      expect.objectContaining({ animated: true }),
    );
  });

  // A set on one spot has no box: Google's fit of one would zoom in as far
  // as it goes — a blank street-level square in the owner's recording
  // (24 Nov 2026). The camera goes to it at a neighbourhood's width.
  it('goes to a set on one spot at a neighbourhood\'s width, not as far in as Google goes', () => {
    const { rerender } = render(<PlacesMap places={[place('a', 21, 105), place('b', 21.1, 105.1)]} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    markMapReady();
    spies.fitToCoordinates.mockClear();
    rerender(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    expect(spies.fitToCoordinates).not.toHaveBeenCalled();
    expect(spies.animateCamera).toHaveBeenLastCalledWith({ center: { latitude: 21, longitude: 105 }, zoom: 15 }, { duration: 500 });
    spies.still = true;
    rerender(<PlacesMap places={[place('b', 21.1, 105.1)]} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    expect(spies.animateCamera).toHaveBeenLastCalledWith({ center: { latitude: 21.1, longitude: 105.1 }, zoom: 15 }, { duration: 0 });
  });

  it('lands a new set at once for a reader who asked for less motion', () => {
    spies.still = true;
    const { rerender } = render(<PlacesMap places={[place('a', 21, 105), place('b', 21.1, 105.1)]} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    markMapReady();
    rerender(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    expect(spies.fitToCoordinates).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ animated: false }));
    expect(markers().map((m) => m.getAttribute('data-slug'))).toEqual(['a']);
  });

  // The pins' half of a change (`pinFade`): the one that left stays a
  // moment, fading and untappable; the one that came is held back.
  it('fades out the pins a new set lost and holds back the ones it gained', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(<PlacesMap places={[place('a', 21, 105), place('b', 21.1, 105.1)]} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
      markMapReady();
      rerender(<PlacesMap places={[place('a', 21, 105), place('c', 21.2, 105.2)]} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
      const bySlug = (slug: string) => markers().find((m) => m.getAttribute('data-slug') === slug);
      expect(bySlug('gone-b')!.getAttribute('data-tappable')).toBe('false');
      expect(bySlug('gone-b')!.getAttribute('data-opacity')).toBe('1');
      expect(bySlug('c')!.getAttribute('data-opacity')).toBe('0');
      expect(bySlug('a')!.getAttribute('data-opacity')).toBe('1');
      act(() => { vi.advanceTimersByTime(600); });
      expect(bySlug('gone-b')).toBeUndefined();
      expect(bySlug('c')!.getAttribute('data-opacity')).toBe('1');
    } finally {
      vi.useRealTimers();
    }
  });

  // Gathered for where the camera is going: from a street, out to a set
  // that spans the city, two places a few doors apart are one bubble at
  // once — not two pins piled up until the glide ends (owner's recording,
  // 23 Nov 2026).
  it('gathers a new set at the zoom its fit will land on, before the map gets there', () => {
    const { rerender } = render(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    fireEvent.click(document.querySelector('[data-stub="layout"]')!);
    markMapReady();
    zoomIn();
    const far = [place('a', 21, 105), place('b', 21.0003, 105.0003), place('z', 21.5, 105.5)];
    rerender(<PlacesMap places={far} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    expect(markers().some((m) => m.getAttribute('data-label')?.startsWith('2 places'))).toBe(true);
  });

  // Owner's recording, 25 Nov 2026: the map opened a district wide on
  // its first pin, every pin drawn alone in a heap, and was fitted and
  // gathered a moment — once, more than a second — later.
  it('opens already on its pins, and gathered for that width, before the map says anything', () => {
    // `a` and `b` are a kilometre and a half apart: two pins a district
    // wide, one bubble at the width that shows `z` as well.
    const far = [place('a', 21, 105), place('b', 21.01, 105.01), place('z', 21.5, 105.5)];
    render(<PlacesMap places={far} selectedSlug={null} onSelect={() => {}} categories={[]} origin={{ lat: 10, lng: 100 }} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    const opening = JSON.parse(mapView().getAttribute('data-opening')!);
    // Wide enough for the half-degree box, and centred on it, not on the
    // reader's fix or the first pin. (Above the box's middle, 21.25, by
    // the foot's deeper padding.)
    expect(opening.longitudeDelta).toBeGreaterThan(0.5);
    expect(opening.longitude).toBeCloseTo(105.25, 1);
    expect(opening.latitude).toBeLessThan(21.25);
    expect(opening.latitude).toBeGreaterThan(21);
    expect(markers().some((m) => m.getAttribute('data-label')?.startsWith('2 places'))).toBe(true);
  });

  it('opens a district wide where there is nothing to fit: on the one spot, the fix, or the city', () => {
    const at = (places: Place[], origin: { lat: number; lng: number } | null) => {
      const r = render(<PlacesMap places={places} selectedSlug={null} onSelect={() => {}} categories={[]} origin={origin} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
      const o = JSON.parse(mapView().getAttribute('data-opening')!);
      r.unmount();
      return o;
    };
    expect(at([place('a', 21, 105)], { lat: 10, lng: 100 })).toEqual({ latitude: 21, longitude: 105, latitudeDelta: 0.05, longitudeDelta: 0.05 });
    expect(at([], { lat: 10, lng: 100 })).toMatchObject({ latitude: 10, longitude: 100, latitudeDelta: 0.05 });
    expect(at([], null)).toMatchObject({ latitude: HANOI.lat, longitude: HANOI.lng });
  });

  it('keeps the view it has when it cannot yet say where a fit will land', () => {
    const { rerender } = render(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    markMapReady();
    zoomIn();
    rerender(<PlacesMap places={[place('a', 21, 105), place('b', 21.0003, 105.0003), place('z', 21.5, 105.5)]} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    expect(markers().some((m) => m.getAttribute('data-label')?.startsWith('2 places'))).toBe(false);
  });

  // A pin that leaves from inside a bubble has nothing of its own to
  // fade: drawing it anyway burst every bubble into its pins for the
  // fade (owner's recording, 24 Nov 2026).
  it('fades only the pins that were drawn alone, and lets a leaving bubble just go', () => {
    const { rerender } = render(<PlacesMap places={[place('a', 21, 105), place('b', 21.0001, 105.0001), place('z', 21.5, 105.5)]} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    markMapReady();
    expect(markers().some((m) => m.getAttribute('data-label')?.startsWith('2 places'))).toBe(true);
    rerender(<PlacesMap places={[place('c', 21.2, 105.2), place('d', 21.3, 105.3)]} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    const gone = markers().map((m) => m.getAttribute('data-slug')).filter((x) => x?.startsWith('gone-'));
    expect(gone).toEqual(['gone-z']);
  });

  // The colour it had, not its own: under the Heritage chip every pin is
  // a heritage pin, and on the phone a leaving pin redrawn by the next chip
  // flashed its own colour for a frame (owner's recording, 23 Nov 2026).
  it('fades a leaving pin in the picture it wore, not the one the next chip would give it', () => {
    const b = place('b', 21.1, 105.1, ['cafes', 'heritage']);
    const { rerender } = render(<PlacesMap places={[place('a', 21, 105, ['heritage']), b]} selectedSlug={null} onSelect={() => {}} categories={['heritage']} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    markMapReady();
    rerender(<PlacesMap places={[place('c', 21.2, 105.2, ['nature'])]} selectedSlug={null} onSelect={() => {}} categories={['nature']} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    const gone = markers().find((m) => m.getAttribute('data-slug') === 'gone-b')!;
    expect(String(pinImage(b, 'heritage', false))).not.toBe(String(pinImage(b, null, false)));
    expect(gone.getAttribute('data-icon')).toBe(String(pinImage(b, 'heritage', false)));
  });

  // The crosshair (owner, 27 Nov 2026) is the corner's one button: only
  // with pins on the map and something to answer it.
  it('has the crosshair when there are pins and a position to ask for, and puts the map on it', async () => {
    const onLocate = vi.fn(async () => ({ lat: 21.05, lng: 105.05 }));
    const { rerender } = render(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} onLocate={onLocate} />);
    markMapReady();
    spies.animateCamera.mockClear();
    await act(async () => { fireEvent.click(document.querySelector('[data-testid="map-locate"]')!); });
    expect(onLocate).toHaveBeenCalledOnce();
    expect(spies.animateCamera).toHaveBeenLastCalledWith({ center: { latitude: 21.05, longitude: 105.05 }, zoom: 15 }, { duration: 400 });
    rerender(<PlacesMap places={[]} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} onLocate={onLocate} />);
    expect(document.querySelector('[data-testid="map-locate"]')).toBeNull();
    rerender(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    expect(document.querySelector('[data-testid="map-locate"]')).toBeNull();
  });

  // The strip has no ✕: the map's empty ground lets the chosen place go.
  it('lets the chosen place go on a tap on the empty map, and not on a pin\'s', () => {
    const onSelect = vi.fn();
    render(<PlacesMap places={[place('a', 21, 105)]} selectedSlug="a" onSelect={onSelect} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    fireEvent.click(document.querySelector('[data-stub="ground-marker"]')!);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(document.querySelector('[data-stub="ground"]')!);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(null);
  });

  it('refits for padding measured late without gliding', () => {
    const two = [place('a', 21, 105), place('b', 21.1, 105.1)];
    const { rerender } = render(<PlacesMap places={two} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    markMapReady();
    rerender(<PlacesMap places={two} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} edgePadding={{ top: 90, right: 64, bottom: 200, left: 40 }} />);
    expect(spies.fitToCoordinates).toHaveBeenCalledTimes(2);
    expect(spies.fitToCoordinates).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ animated: false }));
  });

  it('does not refit when the same pins reappear in a different order', () => {
    const { rerender } = render(<PlacesMap places={[place('a', 21, 105), place('b', 21.1, 105.1)]} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    markMapReady();
    expect(spies.fitToCoordinates).toHaveBeenCalledTimes(1);

    rerender(<PlacesMap places={[place('b', 21.1, 105.1), place('a', 21, 105)]} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    expect(spies.fitToCoordinates).toHaveBeenCalledTimes(1);
  });

  it('does not fit when there is nothing to pin', () => {
    render(<PlacesMap places={[]} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    markMapReady();
    expect(spies.fitToCoordinates).not.toHaveBeenCalled();
  });

  // No Google map means no map — never Apple's, never a broken one.
  it('shows no map at all when the binary cannot draw a Google map', () => {
    verdict.canDrawMap = false;
    render(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    expect(document.querySelector('[data-testid="places-map-missing"]')).toBeTruthy();
    expect(document.querySelector('[data-stub="MapView"]')).toBeNull();
  });

  // 227 places inside one river bend is a mound of pins nobody can count
  // or tap through. A bubble says how many, and a tap goes in far enough
  // for it to come apart.
  describe('clustering', () => {
    const CLOSE = [place('a', 21.0001, 105.0001), place('b', 21.0002, 105.0002), place('c', 21.0003, 105.0003)];
    // A district wide, as a map opens when the window cannot be measured:
    // fitted to these three alone they would stand apart, and these are
    // about what a width does to pins that do not.
    beforeEach(() => { Object.assign(win, { width: 0, height: 0 }); });

    it('gathers pins that stand too close into one bubble with a count', () => {
      render(<PlacesMap places={CLOSE} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
      expect(markers()).toHaveLength(1);
      expect(markers()[0].textContent).toBe('3');
    });

    it('comes apart when the reader goes in, and needs no threshold to do it', () => {
      render(<PlacesMap places={CLOSE} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
      expect(markers()).toHaveLength(1);
      zoomIn();
      expect(markers().map((m) => m.getAttribute('data-slug'))).toEqual(['a', 'b', 'c']);
    });

    it('takes the reader into a bubble that is tapped', () => {
      render(<PlacesMap places={CLOSE} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
      spies.fitToCoordinates.mockClear();
      fireEvent.click(markers()[0]);
      expect(spies.fitToCoordinates).toHaveBeenCalledWith(
        [{ latitude: 21.0001, longitude: 105.0001 }, { latitude: 21.0002, longitude: 105.0002 }, { latitude: 21.0003, longitude: 105.0003 }],
        expect.objectContaining({ animated: true }),
      );
    });

    // The strip along the bottom is already talking about the chosen
    // place; its pin disappearing into a bubble would read as a bug.
    it('leaves the chosen place its own pin', () => {
      render(<PlacesMap places={CLOSE} selectedSlug="b" onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
      const slugs = markers().map((m) => m.getAttribute('data-slug'));
      expect(slugs).toContain('b');
      expect(markers()).toHaveLength(2);
    });

    // A bubble is a custom view, and a custom view frozen from its first
    // frame comes out blank on iOS. So it is drawn live until the map is
    // up and a moment has passed, and only then put to rest — which is
    // also why the countdown cannot start before the map is ready.
    it('draws a bubble live until the map is up and a moment has passed', async () => {
      vi.useFakeTimers();
      try {
        render(<PlacesMap places={CLOSE} selectedSlug={null} onSelect={() => {}} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
        expect(markers()[0].getAttribute('data-tracks')).toBe('true');

        // No map yet: the clock has not started, so waiting changes nothing.
        await act(async () => { vi.advanceTimersByTime(5000); });
        expect(markers()[0].getAttribute('data-tracks')).toBe('true');

        markMapReady();
        await act(async () => { vi.advanceTimersByTime(1000); });
        expect(markers()[0].getAttribute('data-tracks')).toBe('false');
      } finally {
        vi.useRealTimers();
      }
    });

    // Two doors of one building, half a metre apart (27 Trần Bình Trọng):
    // no zoom parts them, so a tap that zoomed landed on the same bubble
    // for ever. It shows them instead.
    const DOORS = [place('donau', 21.02455, 105.84556), place('coeur', 21.024554, 105.845562)];

    it('chooses the first of a bubble whose places stand on one spot, rather than zooming', () => {
      const onSelect = vi.fn();
      render(<PlacesMap places={DOORS} selectedSlug={null} onSelect={onSelect} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
      zoomIn();
      expect(markers()).toHaveLength(1);
      expect(markers()[0].getAttribute('data-label')).toBe('2 places at one address, show them');
      spies.fitToCoordinates.mockClear();
      fireEvent.click(markers()[0]);
      expect(onSelect).toHaveBeenCalledWith('donau');
      expect(spies.fitToCoordinates).not.toHaveBeenCalled();
    });

    // The chosen pin is drawn on top, so the place under it can only be
    // reached through it: a tap on the chosen pin steps along the spot.
    it('steps to the next place on the spot when the chosen pin is tapped, and round again', () => {
      const onSelect = vi.fn();
      const view = render(<PlacesMap places={DOORS} selectedSlug="donau" onSelect={onSelect} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
      fireEvent.click(document.querySelector('[data-slug="donau"]')!);
      expect(onSelect).toHaveBeenLastCalledWith('coeur');
      view.rerender(<PlacesMap places={DOORS} selectedSlug="coeur" onSelect={onSelect} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
      fireEvent.click(document.querySelector('[data-slug="coeur"]')!);
      expect(onSelect).toHaveBeenLastCalledWith('donau');
    });

    it('keeps a chosen pin chosen when nothing else stands on its spot', () => {
      const onSelect = vi.fn();
      render(<PlacesMap places={CLOSE} selectedSlug="b" onSelect={onSelect} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
      fireEvent.click(document.querySelector('[data-slug="b"]')!);
      expect(onSelect).toHaveBeenLastCalledWith('b');
    });

    it('says the count out loud, and does not report a bubble as a place', () => {
      const onSelect = vi.fn();
      render(<PlacesMap places={CLOSE} selectedSlug={null} onSelect={onSelect} categories={[]} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
      expect(markers()[0].getAttribute('data-label')).toBe('3 places, zoom in');
      fireEvent.click(markers()[0]);
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  // Explore reads one city at a time, so a reader who zoomed out past it
  // found an empty country. The other cities are somewhere to go.
  describe('the other cities', () => {
    const SAIGON = [{ id: 'hcmc', name: 'Sài Gòn', count: 280, lat: 10.7769, lng: 106.7009 }];

    it('names each one where it stands', () => {
      render(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={() => {}} categories={[]} cities={SAIGON} onPickCity={() => {}} origin={null} fallback={HANOI} />);
      const pill = document.querySelector('[data-slug="city-hcmc"]')!;
      expect(pill).toBeTruthy();
      // The same bubble a gathering of places wears anywhere else on this
      // map: the number alone. Google's own map writes the name.
      expect(pill.textContent).toBe('280');
      expect(pill.getAttribute('data-label')).toBe('Sài Gòn, 280 places, switch to this city');
    });

    // The bubble's whole content is its number, so until the count
    // arrives there is nothing to draw and nothing is drawn.
    it('waits for its count rather than standing there empty', () => {
      render(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={() => {}} categories={[]} cities={[{ ...SAIGON[0], count: null }]} onPickCity={() => {}} origin={null} fallback={HANOI} />);
      expect(document.querySelector('[data-slug="city-hcmc"]')).toBeNull();
    });

    it('goes there when one is tapped, and does not report it as a place', () => {
      const onPickCity = vi.fn();
      const onSelect = vi.fn();
      render(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={onSelect} categories={[]} cities={SAIGON} onPickCity={onPickCity} origin={null} fallback={HANOI} />);
      fireEvent.click(document.querySelector('[data-slug="city-hcmc"]')!);
      expect(onPickCity).toHaveBeenCalledWith('hcmc');
      expect(onSelect).not.toHaveBeenCalled();
    });

    // A city is not a place: it must not be gathered into a count, and it
    // must not drag the opening view across the country.
    it('keeps them out of the clusters and out of the fit', () => {
      // A district wide, so the two near places are one bubble to count.
      Object.assign(win, { width: 0, height: 0 });
      render(<PlacesMap places={[place('a', 21.0001, 105.0001), place('b', 21.0002, 105.0002)]} selectedSlug={null} onSelect={() => {}} categories={[]} cities={SAIGON} onPickCity={() => {}} origin={null} fallback={HANOI} />);
      // What is under test here is that Saigon is not gathered into this
      // city's bubble, and did not drag the opening view south.
      const bubble = document.querySelector('[data-stub="Marker"]:not([data-slug^="city-"])')!;
      expect(bubble.textContent).toBe('2');
      markMapReady();
      expect(spies.fitToCoordinates).toHaveBeenLastCalledWith(
        [{ latitude: 21.0001, longitude: 105.0001 }, { latitude: 21.0002, longitude: 105.0002 }],
        expect.objectContaining({ animated: false }),
      );
    });
  });

});
