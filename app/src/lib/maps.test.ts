import { describe, expect, it } from 'vitest';
import { mapsRouteUrl, mapsSearchUrl, routeMode, WAYPOINT_MAX } from './maps';
import type { Leg } from './travel';

const p = (lat: number, lng: number) => ({ lat, lng });
const NOWHERE = { lat: null, lng: null };
const named = (lat: number, lng: number, name: string, id: string) => (
  { lat, lng, name_en: name, google_place_id: id }
);

// Two real Hanoi cafés, from the catalog.
const ARTEMIS = p(21.0028, 105.8065);
const THREE_C = p(21.0354187, 105.8093521);
const MAISON = p(21.0339, 105.8524);

const params = (url: string) => new URL(url).searchParams;

const leg = (mode: 'walk' | 'ride'): Leg => ({ km: 1, mode, minutes: 10 });

describe('mapsRouteUrl', () => {
  it('sends both ends and the mode', () => {
    const r = mapsRouteUrl([ARTEMIS, THREE_C], 'driving')!;
    const q = params(r.url);
    expect(r.url.startsWith('https://www.google.com/maps/dir/?')).toBe(true);
    expect(q.get('api')).toBe('1');
    expect(q.get('origin')).toBe('21.0028,105.8065');
    expect(q.get('destination')).toBe('21.0354187,105.8093521');
    expect(q.get('travelmode')).toBe('driving');
    expect(r.dropped).toBe(0);
  });

  // Two stops is a straight line, and Google reads a missing `waypoints`
  // as exactly that. Sending an empty one is a parameter that says nothing.
  it('sends no waypoints when there is nothing in between', () => {
    expect(params(mapsRouteUrl([ARTEMIS, THREE_C])!.url).has('waypoints')).toBe(false);
  });

  it('puts the middle stops in order, in between', () => {
    const q = params(mapsRouteUrl([ARTEMIS, MAISON, THREE_C])!.url);
    expect(q.get('origin')).toBe('21.0028,105.8065');
    expect(q.get('waypoints')).toBe('21.0339,105.8524');
    expect(q.get('destination')).toBe('21.0354187,105.8093521');
  });

  // Coordinates for a stop that is only a coordinate. This catalog holds
  // three Hadu Sushi and two Artemis Pastry; a *bare* name would let
  // Google pick the wrong branch and send somebody across town with the
  // app's confidence behind it. A name may only travel beside the place
  // id that resolves it exactly — the tests below — and without one the
  // link stays numeric.
  it('never puts a bare name in the link', () => {
    const pair = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;
    const q = params(mapsRouteUrl([ARTEMIS, MAISON, THREE_C])!.url);
    expect(q.get('origin')).toMatch(pair);
    expect(q.get('destination')).toMatch(pair);
    for (const w of q.get('waypoints')!.split('|')) expect(w).toMatch(pair);
    expect(q.has('origin_place_id')).toBe(false);
    expect(q.has('destination_place_id')).toBe(false);
    expect(q.has('waypoint_place_ids')).toBe(false);
  });

  // The whole reason the sheet used to read "Dropped pin": a stop that
  // knows its Google identity now travels by name, and the id beside it
  // is what stops Google resolving the name to a same-named branch.
  it('sends name and place id together when a stop has both', () => {
    const q = params(mapsRouteUrl([
      named(21.0028, 105.8065, 'Artemis Pastry', 'ChIJartemis'),
      named(21.0354, 105.8093, '3C Roastery', 'ChIJ3c'),
    ])!.url);
    expect(q.get('origin')).toBe('Artemis Pastry');
    expect(q.get('origin_place_id')).toBe('ChIJartemis');
    expect(q.get('destination')).toBe('3C Roastery');
    expect(q.get('destination_place_id')).toBe('ChIJ3c');
  });

  it('each end decides for itself', () => {
    const q = params(mapsRouteUrl([
      named(21.0028, 105.8065, 'Artemis Pastry', 'ChIJartemis'),
      THREE_C,
    ])!.url);
    expect(q.get('origin')).toBe('Artemis Pastry');
    expect(q.get('origin_place_id')).toBe('ChIJartemis');
    expect(q.get('destination')).toBe('21.0354187,105.8093521');
    expect(q.has('destination_place_id')).toBe(false);
  });

  // Google requires waypoint_place_ids to match waypoints one for one, so
  // the middle stops decide together: all named, or all coordinates.
  it('names the waypoints only when every one carries its id', () => {
    const all = params(mapsRouteUrl([
      named(21.0, 105.8, 'A', 'idA'),
      named(21.01, 105.81, 'B', 'idB'),
      named(21.02, 105.82, 'C', 'idC'),
      named(21.03, 105.83, 'D', 'idD'),
    ])!.url);
    expect(all.get('waypoints')).toBe('B|C');
    expect(all.get('waypoint_place_ids')).toBe('idB|idC');

    const some = params(mapsRouteUrl([
      named(21.0, 105.8, 'A', 'idA'),
      named(21.01, 105.81, 'B', 'idB'),
      p(21.02, 105.82),
      named(21.03, 105.83, 'D', 'idD'),
    ])!.url);
    expect(some.get('waypoints')).toBe('21.01,105.81|21.02,105.82');
    expect(some.has('waypoint_place_ids')).toBe(false);
    // The ends still keep their names — the one-for-one rule is only
    // about the middle.
    expect(some.get('origin')).toBe('A');
    expect(some.get('destination')).toBe('D');
  });

  // A name with an id but no coordinates is still an unplaced row: the
  // route is drawn between stops the catalog can place, same as ever.
  it('still requires a coordinate even of a named stop', () => {
    expect(mapsRouteUrl([
      { name_en: 'Ghost Cafe', google_place_id: 'ChIJghost' },
      ARTEMIS,
    ])).toBeNull();
  });

  // A day longer than Google will take. The end of the day survives — a
  // route has to arrive where the reader is going — and the count of what
  // did not fit comes back so the screen can say so out loud rather than
  // opening a link that quietly visits the wrong eleven of twelve stops.
  it('keeps the destination and reports what would not fit', () => {
    const many = Array.from({ length: 14 }, (_, i) => p(21 + i / 1000, 105.8));
    const r = mapsRouteUrl(many)!;
    const q = params(r.url);
    expect(q.get('origin')).toBe('21,105.8');
    expect(q.get('destination')).toBe('21.013,105.8');
    expect(q.get('waypoints')!.split('|')).toHaveLength(WAYPOINT_MAX);
    // 14 stops: one origin, one destination, twelve in between, nine of
    // which fit.
    expect(r.dropped).toBe(12 - WAYPOINT_MAX);
  });

  it('takes eleven stops without dropping any', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => p(21 + i / 1000, 105.8));
    expect(mapsRouteUrl(eleven)!.dropped).toBe(0);
  });

  // A stop the catalog can no longer place is already drawn as "no longer
  // listed". Routing through null island is not a better answer than
  // routing between the stops that do exist.
  it('steps over a stop it cannot place', () => {
    const q = params(mapsRouteUrl([ARTEMIS, NOWHERE, THREE_C])!.url);
    expect(q.has('waypoints')).toBe(false);
    expect(q.get('destination')).toBe('21.0354187,105.8093521');
  });

  // A route through one point is not a route. The row that reads this
  // disappears rather than offering a link that will not do what it says —
  // and the place's own screen already links to exactly that one place.
  it('has no route for fewer than two placed stops', () => {
    expect(mapsRouteUrl([])).toBeNull();
    expect(mapsRouteUrl([ARTEMIS])).toBeNull();
    expect(mapsRouteUrl([ARTEMIS, NOWHERE])).toBeNull();
    expect(mapsRouteUrl([NOWHERE, NOWHERE])).toBeNull();
  });

  it('refuses a coordinate that is not a number', () => {
    expect(mapsRouteUrl([ARTEMIS, { lat: NaN, lng: 105 }])).toBeNull();
    expect(mapsRouteUrl([ARTEMIS, { lat: Infinity, lng: 105 }])).toBeNull();
    expect(mapsRouteUrl([ARTEMIS, {}])).toBeNull();
  });

  it('escapes the separator rather than sending it raw', () => {
    const r = mapsRouteUrl([ARTEMIS, MAISON, THREE_C])!;
    expect(r.url).toContain('waypoints=21.0339%2C105.8524');
    expect(r.url).not.toContain('|');
  });

  it('drives by default, because that is the mode that cannot strand you', () => {
    expect(params(mapsRouteUrl([ARTEMIS, THREE_C])!.url).get('travelmode')).toBe('driving');
  });
});

describe('routeMode', () => {
  it('walks only when every leg is a walk', () => {
    expect(routeMode([leg('walk'), leg('walk')])).toBe('walking');
  });

  // The asymmetry is the point: driving directions for a walk cost a
  // glance, walking directions for a six kilometre leg cost an hour and a
  // half and look completely sure of themselves.
  it('drives as soon as one leg is a ride', () => {
    expect(routeMode([leg('walk'), leg('ride'), leg('walk')])).toBe('driving');
  });

  it('drives when nothing could be measured', () => {
    expect(routeMode([])).toBe('driving');
    expect(routeMode([null, null])).toBe('driving');
  });

  it('ignores the legs it could not measure', () => {
    expect(routeMode([leg('walk'), null, leg('walk')])).toBe('walking');
  });
});

describe('mapsSearchUrl', () => {
  it('points at one place by its coordinates', () => {
    expect(mapsSearchUrl(ARTEMIS))
      .toBe('https://www.google.com/maps/search/?api=1&query=21.0028%2C105.8065');
  });

  it('opens by name when the place knows its Google identity', () => {
    expect(mapsSearchUrl(named(21.0028, 105.8065, 'Artemis Pastry', 'ChIJartemis')))
      .toBe('https://www.google.com/maps/search/?api=1&query=Artemis%20Pastry&query_place_id=ChIJartemis');
  });

  it('has nothing to point at for a place with no position', () => {
    expect(mapsSearchUrl(NOWHERE)).toBeNull();
    expect(mapsSearchUrl({})).toBeNull();
  });
});
