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
      'data-poi-icons': String(!(p.customMapStyle ?? []).some((r: any) => r.featureType === 'poi' && r.elementType === 'labels.icon' && r.stylers?.[0]?.visibility === 'off')),
    },
    R.createElement('button', { type: 'button', 'data-stub': 'ready', onClick: p.onMapReady }),
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
    'data-color': p.pinColor ?? '', 'data-label': p.accessibilityLabel ?? '',
    'data-tracks': String(!!p.tracksViewChanges), onClick: p.onPress,
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
  verdict.canDrawMap = true;
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
    render(<PlacesMap places={[place('a', 21, 105), place('b', 21.1, 105.1), place('c', null, null)]} selectedSlug={null} onSelect={() => {}} category={null} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    expect(markers().map((m) => m.getAttribute('data-slug'))).toEqual(['a', 'b']);
  });

  // The colour code is the filter row's: a café's pin is the café chip's
  // brown, a rooftop's the Views chip's blue. The chosen pin is coral
  // whatever it is, so the one the reader tapped is never lost among its
  // kind.
  it('draws the chosen pin in the accent and the rest in their category’s colour', () => {
    render(<PlacesMap places={[place('a', 21, 105, ['cafes']), place('b', 21.1, 105.1, ['cafes']), place('c', 21.2, 105.2, ['views'])]} selectedSlug="b" onSelect={() => {}} category={null} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    const [a, b, c] = markers();
    expect(b.getAttribute('data-color')).toBe('#FF6F5B');
    expect(a.getAttribute('data-color')).toBe('#D2A679');
    expect(c.getAttribute('data-color')).toBe('#6FB3C0');
  });

  // Inside a chip every pin is that kind of place already, so the chip's
  // colour is the only one that says anything: one kind asked for, one
  // colour back. A café that is also a place to work stops reading as the
  // odd one out under Focus.
  it('paints every pin in the chip’s colour while a chip is selected', () => {
    render(<PlacesMap places={[place('a', 21, 105, ['cafes', 'focus']), place('b', 21.1, 105.1, ['focus']), place('c', 21.2, 105.2, ['focus'])]} selectedSlug="c" onSelect={() => {}} category="focus" origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    const [a, b, c] = markers();
    expect(a.getAttribute('data-color')).toBe('#989AD7');
    expect(b.getAttribute('data-color')).toBe('#989AD7');
    // The chosen pin is coral under a chip too — it is the one thing the
    // chip does not already say.
    expect(c.getAttribute('data-color')).toBe('#FF6F5B');
  });

  it('lets each pin speak for itself under a chip the table has never heard of', () => {
    render(<PlacesMap places={[place('a', 21, 105, ['cafes']), place('b', 21.1, 105.1)]} selectedSlug={null} onSelect={() => {}} category="street_food" origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    const [a, b] = markers();
    expect(a.getAttribute('data-color')).toBe('#D2A679');
    expect(b.getAttribute('data-color')).toBe('#17150F');
  });

  it('draws a pin nothing classifies in ink, and every pin when the chosen slug matches none of them', () => {
    render(<PlacesMap places={[place('a', 21, 105), place('b', 21.1, 105.1)]} selectedSlug="zzz" onSelect={() => {}} category={null} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    const [a, b] = markers();
    expect(a.getAttribute('data-color')).toBe('#17150F');
    expect(b.getAttribute('data-color')).toBe('#17150F');
  });

  it('reports which pin was tapped', () => {
    const onSelect = vi.fn();
    render(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={onSelect} category={null} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    fireEvent.click(markers()[0]);
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  // Our places are Google's places, so its own badge for each one sat
  // beside our pin. The badge goes; the name stays.
  it('asks the map not to draw its own badge on a place of interest', () => {
    render(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={() => {}} category={null} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    expect(mapView().getAttribute('data-poi-icons')).toBe('false');
  });

  it('shows the reader’s own position', () => {
    render(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={() => {}} category={null} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    expect(mapView().getAttribute('data-user')).toBe('true');
  });

  // The pins are the reason to look; the first thing the map does, once it
  // is ready, is show all of them. And again whenever the set changes — a
  // filter that narrows the list to three places should not leave the
  // reader looking at an empty quarter of the city.
  it('fits the view to the pins once ready, and refits when they change', () => {
    const { rerender } = render(<PlacesMap places={[place('a', 21, 105), place('b', 21.1, 105.1)]} selectedSlug={null} onSelect={() => {}} category={null} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    expect(spies.fitToCoordinates).not.toHaveBeenCalled();

    markMapReady();
    expect(spies.fitToCoordinates).toHaveBeenCalledTimes(1);
    expect(spies.fitToCoordinates).toHaveBeenLastCalledWith(
      [{ latitude: 21, longitude: 105 }, { latitude: 21.1, longitude: 105.1 }],
      expect.objectContaining({ animated: false }),
    );

    rerender(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={() => {}} category={null} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    expect(spies.fitToCoordinates).toHaveBeenCalledTimes(2);
    expect(spies.fitToCoordinates).toHaveBeenLastCalledWith(
      [{ latitude: 21, longitude: 105 }],
      expect.objectContaining({ animated: false }),
    );
  });

  it('does not refit when the same pins reappear in a different order', () => {
    const { rerender } = render(<PlacesMap places={[place('a', 21, 105), place('b', 21.1, 105.1)]} selectedSlug={null} onSelect={() => {}} category={null} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    markMapReady();
    expect(spies.fitToCoordinates).toHaveBeenCalledTimes(1);

    rerender(<PlacesMap places={[place('b', 21.1, 105.1), place('a', 21, 105)]} selectedSlug={null} onSelect={() => {}} category={null} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    expect(spies.fitToCoordinates).toHaveBeenCalledTimes(1);
  });

  it('does not fit when there is nothing to pin', () => {
    render(<PlacesMap places={[]} selectedSlug={null} onSelect={() => {}} category={null} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    markMapReady();
    expect(spies.fitToCoordinates).not.toHaveBeenCalled();
  });

  // No Google map means no map — never Apple's, never a broken one.
  it('shows no map at all when the binary cannot draw a Google map', () => {
    verdict.canDrawMap = false;
    render(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={() => {}} category={null} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
    expect(document.querySelector('[data-testid="places-map-missing"]')).toBeTruthy();
    expect(document.querySelector('[data-stub="MapView"]')).toBeNull();
  });

  // 227 places inside one river bend is a mound of pins nobody can count
  // or tap through. A bubble says how many, and a tap goes in far enough
  // for it to come apart.
  describe('clustering', () => {
    const CLOSE = [place('a', 21.0001, 105.0001), place('b', 21.0002, 105.0002), place('c', 21.0003, 105.0003)];

    it('gathers pins that stand too close into one bubble with a count', () => {
      render(<PlacesMap places={CLOSE} selectedSlug={null} onSelect={() => {}} category={null} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
      expect(markers()).toHaveLength(1);
      expect(markers()[0].textContent).toBe('3');
    });

    it('comes apart when the reader goes in, and needs no threshold to do it', () => {
      render(<PlacesMap places={CLOSE} selectedSlug={null} onSelect={() => {}} category={null} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
      expect(markers()).toHaveLength(1);
      zoomIn();
      expect(markers().map((m) => m.getAttribute('data-slug'))).toEqual(['a', 'b', 'c']);
    });

    it('takes the reader into a bubble that is tapped', () => {
      render(<PlacesMap places={CLOSE} selectedSlug={null} onSelect={() => {}} category={null} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
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
      render(<PlacesMap places={CLOSE} selectedSlug="b" onSelect={() => {}} category={null} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
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
        render(<PlacesMap places={CLOSE} selectedSlug={null} onSelect={() => {}} category={null} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
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

    it('says the count out loud, and does not report a bubble as a place', () => {
      const onSelect = vi.fn();
      render(<PlacesMap places={CLOSE} selectedSlug={null} onSelect={onSelect} category={null} origin={null} cities={[]} onPickCity={() => {}} fallback={HANOI} />);
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
      render(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={() => {}} category={null} cities={SAIGON} onPickCity={() => {}} origin={null} fallback={HANOI} />);
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
      render(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={() => {}} category={null} cities={[{ ...SAIGON[0], count: null }]} onPickCity={() => {}} origin={null} fallback={HANOI} />);
      expect(document.querySelector('[data-slug="city-hcmc"]')).toBeNull();
    });

    it('goes there when one is tapped, and does not report it as a place', () => {
      const onPickCity = vi.fn();
      const onSelect = vi.fn();
      render(<PlacesMap places={[place('a', 21, 105)]} selectedSlug={null} onSelect={onSelect} category={null} cities={SAIGON} onPickCity={onPickCity} origin={null} fallback={HANOI} />);
      fireEvent.click(document.querySelector('[data-slug="city-hcmc"]')!);
      expect(onPickCity).toHaveBeenCalledWith('hcmc');
      expect(onSelect).not.toHaveBeenCalled();
    });

    // A city is not a place: it must not be gathered into a count, and it
    // must not drag the opening view across the country.
    it('keeps them out of the clusters and out of the fit', () => {
      render(<PlacesMap places={[place('a', 21.0001, 105.0001), place('b', 21.0002, 105.0002)]} selectedSlug={null} onSelect={() => {}} category={null} cities={SAIGON} onPickCity={() => {}} origin={null} fallback={HANOI} />);
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
