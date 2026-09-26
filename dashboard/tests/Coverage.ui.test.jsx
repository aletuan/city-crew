// Coverage: published places per district, on a map and in a list.
//
// coverage.js (the folds and the mercator arithmetic) is tested as
// functions. Pinned here: which of the three "nothing" sentences the
// screen picks, that all-cities draws cities and one city draws
// districts, that the list and the bubbles light each other, and the
// map — built once, framed on the data, and told the floor before the
// zoom, because a setZoom under the floor in force is clamped in silence.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { api } from '../src/api.js';
import { loadGoogleMaps } from '../src/lib/googleMaps.js';
import { renderDesk } from './_ui/desk.jsx';

vi.mock('../src/lib/googleMaps.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadGoogleMaps: vi.fn(),
}));

/** Enough of `google.maps` for the screen to build a map and be told
 *  where it is looking. */
function fakeMaps() {
  const maps = { listeners: {}, instances: [] };
  maps.Map = vi.fn(function Map(el, opts) {
    this.el = el;
    this.opts = opts;
    this.center = opts.center;
    this.zoom = opts.zoom;
    this.getCenter = () => ({ lat: () => this.center.lat, lng: () => this.center.lng });
    this.getZoom = () => this.zoom;
    this.setZoom = vi.fn((z) => { this.zoom = z; });
    this.setCenter = vi.fn((c) => { this.center = c; });
    this.setOptions = vi.fn();
    this.addListener = (event, fn) => { maps.listeners[event] = fn; };
    maps.instances.push(this);
  });
  return maps;
}

const row = (slug, city_id, address, lat, lng, extra = {}) => ({
  slug, name_en: slug, address, neighborhood_en: null, lat, lng, city_id, ...extra,
});

const ROWS = [
  row('a', 'hcmc', '12 Lê Lợi, Quận 1, Ho Chi Minh City, Vietnam', 10.77, 106.70),
  row('b', 'hcmc', '5 Nguyễn Huệ, Quận 1, Ho Chi Minh City, Vietnam', 10.78, 106.71),
  row('c', 'hcmc', '9 Xô Viết Nghệ Tĩnh, Bình Thạnh, Ho Chi Minh City, Vietnam', null, null, { name_en: 'Quiet Café' }),
  row('d', 'hcmc', 'Somewhere', 10.8, 106.7),
  row('e', 'hanoi', '1 Hàng Bạc, Hoàn Kiếm, Hanoi, Vietnam', 21.03, 105.85),
];

let widthGetter;
beforeEach(() => {
  loadGoogleMaps.mockResolvedValue(null);
  // jsdom lays nothing out; the map frame has to have a width to fit to.
  widthGetter = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
});
afterEach(() => widthGetter.mockRestore());

const boardRows = () => [...document.querySelectorAll('.covrow')];
const bubbles = () => [...document.querySelectorAll('.covbubble')];

describe('Coverage', () => {
  it('loads, then says what it could not, and Retry re-reads', async () => {
    api.coverage.mockRejectedValueOnce(new Error('offline'));
    api.coverage.mockResolvedValue(ROWS);
    renderDesk('/analytics/coverage');
    expect(screen.getByText('Loading coverage…')).toBeTruthy();
    expect(await screen.findByText(/Couldn’t load coverage: offline/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'TP. Hồ Chí Minh' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Coverage' })).toBeTruthy();
  });

  it('one city: its districts, counted, barred, and the ones the map cannot hold', async () => {
    api.coverage.mockResolvedValue(ROWS);
    renderDesk('/analytics/coverage', { city: 'hcmc' });
    await screen.findByRole('heading', { name: 'TP. Hồ Chí Minh' });
    // The counts under the picker, for every city the desk knows.
    const counts = [...document.querySelectorAll('.covcounts span')].map((s) => s.textContent);
    expect(counts).toEqual(['TP.HCM 4', 'Hà Nội 1', 'Đà Nẵng 0']);
    expect(document.querySelector('.covcounts .on').textContent).toBe('TP.HCM 4');
    expect(screen.getByText('4 places · 2 districts')).toBeTruthy();
    const rows = boardRows();
    expect(rows.map((r) => r.querySelector('.covname').textContent)).toEqual(['Quận 1', 'Bình Thạnh', 'no district on record']);
    expect(rows.map((r) => r.querySelector('.boardtotal').textContent)).toEqual(['2', '1', '1']);
    expect(rows[0].querySelector('.covbar').style.width).toBe('100%');
    expect(rows[1].querySelector('.covbar').style.width).toBe('50%');
    // Bình Thạnh has no coordinates: it is in the list and not on the map.
    expect(bubbles().map((b) => b.querySelector('.name').textContent)).toEqual(['Quận 1']);
    expect(screen.getByText(/1 place has no coordinates and isn't on the map/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Quiet Café' }).getAttribute('href')).toBe('/place/c');
    // No hint on a single city; the map's own caption says how many.
    expect(screen.queryByText(/every city at once/)).toBeNull();
    expect(document.querySelector('.covbubbles').getAttribute('aria-label')).toBe('1 districts on the map; the list beside it carries the same numbers.');
  });

  it('all cities: one bubble per city that has anything', async () => {
    api.coverage.mockResolvedValue(ROWS);
    renderDesk('/analytics/coverage', { city: 'all' });
    await screen.findByRole('heading', { name: 'All cities' });
    expect(screen.getByText(/every city at once/)).toBeTruthy();
    expect(screen.getByText('5 places · 2 cities')).toBeTruthy();
    expect(boardRows().map((r) => r.querySelector('.covname').textContent)).toEqual(['TP.HCM', 'Hà Nội']);
    expect(bubbles().map((b) => b.querySelector('.count').textContent)).toEqual(['4', '1']);
    // The one place with no coordinates still counts against the whole.
    expect(screen.getByText(/1 place has no coordinates/)).toBeTruthy();
  });

  it('the list and the bubbles light each other', async () => {
    api.coverage.mockResolvedValue(ROWS);
    renderDesk('/analytics/coverage', { city: 'hcmc' });
    await screen.findByRole('heading', { name: 'TP. Hồ Chí Minh' });
    fireEvent.mouseEnter(bubbles()[0]);
    expect(boardRows()[0].className).toContain('hot');
    expect(bubbles()[0].getAttribute('class')).toContain('hot');
    fireEvent.mouseLeave(bubbles()[0]);
    expect(boardRows()[0].className).not.toContain('hot');
    fireEvent.mouseEnter(boardRows()[0]);
    expect(bubbles()[0].getAttribute('class')).toContain('hot');
    fireEvent.mouseLeave(boardRows()[0]);
    expect(bubbles()[0].getAttribute('class')).not.toContain('hot');
  });

  it('three different nothings, each with its own sentence', async () => {
    // Nothing published in the city at all.
    api.coverage.mockResolvedValue(ROWS);
    const first = renderDesk('/analytics/coverage', { city: 'danang' });
    expect(await screen.findByText('Nothing published in Đà Nẵng yet.')).toBeTruthy();
    expect(screen.getByText('Nothing published here yet.')).toBeTruthy();
    expect(screen.getByText('0 places · 0 districts')).toBeTruthy();
    first.unmount();
    // Published, but no address names a district.
    api.coverage.mockResolvedValue([row('x', 'hanoi', '7 Somewhere', 21, 105), row('y', 'hanoi', null, 21, 105)]);
    const second = renderDesk('/analytics/coverage', { city: 'hanoi' });
    expect(await screen.findByText(/No district could be read from these 2 addresses/)).toBeTruthy();
    expect(screen.getByText('No district could be read from any of these addresses.')).toBeTruthy();
    expect(screen.getByText('2 places · 0 districts')).toBeTruthy();
    second.unmount();
    // Districts, but nothing has coordinates.
    api.coverage.mockResolvedValue([row('z', 'hanoi', '1 Hàng Bạc, Hoàn Kiếm, Hanoi, Vietnam', null, null)]);
    renderDesk('/analytics/coverage', { city: 'hanoi' });
    expect(await screen.findByText('No published place in Hà Nội has coordinates yet.')).toBeTruthy();
    expect(screen.getByText('1 place · 1 district')).toBeTruthy();
  });

  it('a long list of unlocated places is cut at six', async () => {
    api.coverage.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => row(`p${i}`, 'hanoi', '1 Hàng Bạc, Hoàn Kiếm, Hanoi, Vietnam', null, null)),
    );
    renderDesk('/analytics/coverage', { city: 'hanoi' });
    expect(await screen.findByText(/8 places have no coordinates and aren't on the map/)).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /^p\d$/ })).toHaveLength(6);
    expect(screen.getByText(/\+2 more/)).toBeTruthy();
  });

  it('with a key, the map is built on the fitted view and told the floor before the zoom', async () => {
    const maps = fakeMaps();
    // The script takes a moment to arrive, as it does; by then the frame
    // has a width and the fit is known, which is what the first frame of
    // the map is meant to open on.
    let arrive;
    loadGoogleMaps.mockReturnValue(new Promise((r) => { arrive = r; }));
    api.coverage.mockResolvedValue(ROWS);
    renderDesk('/analytics/coverage', { city: 'hcmc' });
    await screen.findByRole('heading', { name: 'TP. Hồ Chí Minh' });
    await waitFor(() => expect(bubbles()).toHaveLength(1));
    await act(async () => arrive(maps));
    await waitFor(() => expect(maps.Map).toHaveBeenCalledTimes(1));
    const map = maps.instances[0];
    expect(map.opts).toMatchObject({ minZoom: 5, maxZoom: 17, colorScheme: 'DARK', disableDefaultUI: true });
    // Opened on the fit, not on the whole world.
    expect(map.opts.zoom).toBeGreaterThanOrEqual(9);
    expect(map.opts.center.lat).toBeCloseTo(10.775, 2);
    // Framed once ready, floor first.
    await waitFor(() => expect(map.setZoom).toHaveBeenCalled());
    expect(map.setOptions).toHaveBeenCalledWith({ minZoom: 5 });
    expect(map.setOptions.mock.invocationCallOrder[0]).toBeLessThan(map.setZoom.mock.invocationCallOrder[0]);
    // When the map moves, the bubbles follow its frame rather than the fit.
    const before = bubbles()[0].querySelector('.body').getAttribute('cx');
    await act(async () => {
      map.center = { lat: 10.9, lng: 106.9 };
      maps.listeners.bounds_changed();
    });
    expect(bubbles()[0].querySelector('.body').getAttribute('cx')).not.toBe(before);
    // Switching to all cities lowers the floor under the same map.
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'all' } });
    await screen.findByRole('heading', { name: 'All cities' });
    await waitFor(() => expect(map.setOptions).toHaveBeenCalledWith({ minZoom: 2 }));
    expect(maps.Map).toHaveBeenCalledTimes(1);
  });

  it('a map that arrives after the screen has gone is not built', async () => {
    const maps = fakeMaps();
    let finish;
    loadGoogleMaps.mockReturnValue(new Promise((r) => { finish = r; }));
    api.coverage.mockResolvedValue(ROWS);
    const { unmount } = renderDesk('/analytics/coverage', { city: 'hcmc' });
    await screen.findByRole('heading', { name: 'TP. Hồ Chí Minh' });
    unmount();
    await act(async () => finish(maps));
    expect(maps.Map).not.toHaveBeenCalled();
  });
});
