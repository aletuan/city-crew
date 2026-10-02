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
  // No origin: the Maps URLs API reads its absence as the device's own
  // position, which is where the reader is when they tap — not the first
  // stop, and not the point the plan was drawn from.
  it('sends the destination and the mode, and leaves the origin to the reader’s position', () => {
    const r = mapsRouteUrl([ARTEMIS, THREE_C], 'driving')!;
    const q = params(r.url);
    expect(r.url.startsWith('https://www.google.com/maps/dir/?')).toBe(true);
    expect(q.get('api')).toBe('1');
    expect(q.has('origin')).toBe(false);
    expect(q.has('origin_place_id')).toBe(false);
    expect(q.get('destination')).toBe('21.0354187,105.8093521');
    expect(q.get('travelmode')).toBe('driving');
    expect(r.dropped).toBe(0);
  });

  // Every stop but the last is a waypoint, the first included: from here
  // to the first, then on.
  it('routes through every stop before the last', () => {
    const q = params(mapsRouteUrl([ARTEMIS, MAISON, THREE_C])!.url);
    expect(q.get('waypoints')).toBe('21.0028,105.8065|21.0339,105.8524');
    expect(q.get('destination')).toBe('21.0354187,105.8093521');
  });

  // One stop used to be refused as "a route through one point". With the
  // reader's position as the start, one point is exactly a journey.
  it('routes to a single stop from where the reader is', () => {
    const q = params(mapsRouteUrl([ARTEMIS])!.url);
    expect(q.get('destination')).toBe('21.0028,105.8065');
    expect(q.has('waypoints')).toBe(false);
    expect(q.has('origin')).toBe(false);
  });

  it('is null with nothing to go to', () => {
    expect(mapsRouteUrl([])).toBeNull();
    expect(mapsRouteUrl([NOWHERE])).toBeNull();
  });

  it('drops the stops the catalog cannot place, and keeps the rest in order', () => {
    const q = params(mapsRouteUrl([ARTEMIS, NOWHERE, MAISON, THREE_C])!.url);
    expect(q.get('waypoints')).toBe('21.0028,105.8065|21.0339,105.8524');
    expect(q.get('destination')).toBe('21.0354187,105.8093521');
  });

  it('walks when told to', () => {
    expect(params(mapsRouteUrl([ARTEMIS, THREE_C], 'walking')!.url).get('travelmode')).toBe('walking');
  });

  // Coordinates travel as `lat,lng` with no spaces, which is the one form
  // every Maps client reads the same way.
  it('writes coordinates as lat,lng', () => {
    const pair = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;
    const q = params(mapsRouteUrl([ARTEMIS, MAISON, THREE_C])!.url);
    expect(q.get('destination')).toMatch(pair);
    for (const w of q.get('waypoints')!.split('|')) expect(w).toMatch(pair);
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
    expect(q.get('waypoints')).toBe('Artemis Pastry');
    expect(q.get('waypoint_place_ids')).toBe('ChIJartemis');
    expect(q.get('destination')).toBe('3C Roastery');
    expect(q.get('destination_place_id')).toBe('ChIJ3c');
  });

  it('the destination decides for itself', () => {
    const q = params(mapsRouteUrl([
      named(21.0028, 105.8065, 'Artemis Pastry', 'ChIJartemis'),
      THREE_C,
    ])!.url);
    expect(q.get('waypoints')).toBe('Artemis Pastry');
    expect(q.get('waypoint_place_ids')).toBe('ChIJartemis');
    expect(q.get('destination')).toBe('21.0354187,105.8093521');
    expect(q.has('destination_place_id')).toBe(false);
  });

  // Google requires waypoint_place_ids to match waypoints one for one, so
  // the stops before the last decide together: all named, or all
  // coordinates.
  it('names the waypoints only when every one carries its id', () => {
    const all = params(mapsRouteUrl([
      named(21.0, 105.8, 'A', 'idA'),
      named(21.01, 105.81, 'B', 'idB'),
      named(21.02, 105.82, 'C', 'idC'),
      named(21.03, 105.83, 'D', 'idD'),
    ])!.url);
    expect(all.get('waypoints')).toBe('A|B|C');
    expect(all.get('waypoint_place_ids')).toBe('idA|idB|idC');

    const some = params(mapsRouteUrl([
      named(21.0, 105.8, 'A', 'idA'),
      named(21.01, 105.81, 'B', 'idB'),
      p(21.02, 105.82),
      named(21.03, 105.83, 'D', 'idD'),
    ])!.url);
    expect(some.get('waypoints')).toBe('21,105.8|21.01,105.81|21.02,105.82');
    expect(some.has('waypoint_place_ids')).toBe(false);
    // The destination still keeps its name — the one-for-one rule is
    // only about the waypoints.
    expect(some.get('destination')).toBe('D');
  });

  // A name with an id but no coordinates is still an unplaced row: the
  // route is drawn to the stops the catalog can place, same as ever.
  it('still requires a coordinate even of a named stop', () => {
    expect(mapsRouteUrl([{ name_en: 'Ghost Cafe', google_place_id: 'ChIJghost' }])).toBeNull();
    const q = params(mapsRouteUrl([
      { name_en: 'Ghost Cafe', google_place_id: 'ChIJghost' },
      ARTEMIS,
    ])!.url);
    expect(q.has('waypoints')).toBe(false);
    expect(q.get('destination')).toBe('21.0028,105.8065');
  });

  // A day longer than Google will take. The end of the day survives — a
  // route has to arrive where the reader is going — and the count of what
  // did not fit comes back so the screen can say so out loud rather than
  // opening a link that quietly visits the wrong ten of eleven stops.
  it('keeps the destination and reports what would not fit', () => {
    const many = Array.from({ length: 14 }, (_, i) => p(21 + i / 1000, 105.8));
    const r = mapsRouteUrl(many)!;
    const q = params(r.url);
    expect(q.get('destination')).toBe('21.013,105.8');
    expect(q.get('waypoints')!.split('|')).toHaveLength(WAYPOINT_MAX);
    expect(q.get('waypoints')!.split('|')[0]).toBe('21,105.8');
    // 14 stops: one destination, thirteen before it, nine of which fit.
    expect(r.dropped).toBe(13 - WAYPOINT_MAX);
  });

  it('takes ten stops without dropping any, and drops the eleventh', () => {
    const ten = Array.from({ length: WAYPOINT_MAX + 1 }, (_, i) => p(21 + i / 1000, 105.8));
    expect(mapsRouteUrl(ten)!.dropped).toBe(0);
    expect(mapsRouteUrl([...ten, p(21.5, 105.8)])!.dropped).toBe(1);
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
