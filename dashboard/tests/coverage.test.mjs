// The Coverage screen's arithmetic, exercised as plain functions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  foldKey, districtOf, buildCoverage, buildCityCoverage, fitView, lngToX, latToY,
  xToLng, yToLat, bubbleRadius, TILE,
} from '../src/coverage.js';

const row = (over = {}) => ({
  slug: 's', name_en: 'n', address: null, neighborhood_en: null,
  lat: 10.77, lng: 106.7, city_id: 'hcmc', ...over,
});

test('districtOf reads the documented third-from-last address segment', () => {
  assert.deepEqual(
    districtOf('72 Lê Thánh Tôn, Bến Nghé, Quận 1, Thành phố Hồ Chí Minh 700000, Việt Nam', null),
    { key: 'q1', label: 'Quận 1' },
  );
  assert.deepEqual(
    districtOf('7 Công xã Paris, Bến Nghé, District 1, Ho Chi Minh City 700000, Vietnam', null),
    { key: 'q1', label: 'Quận 1' },
  );
  assert.deepEqual(
    districtOf('Chùa Linh Ứng, Hoàng Sa, Thọ Quang, Sơn Trà, Đà Nẵng 550000, Việt Nam', null),
    { key: 'son tra', label: 'Sơn Trà' },
  );
});

test('districtOf strips the unit word, keeps the unit', () => {
  assert.equal(districtOf(null, 'Thành phố Thủ Đức').label, 'Thủ Đức');
  assert.equal(districtOf(null, 'Quận Bình Thạnh').label, 'Bình Thạnh');
  assert.equal(districtOf(null, 'Huyện Nhà Bè').label, 'Nhà Bè');
  assert.equal(districtOf(null, 'Q. 10').label, 'Quận 10');
});

test('the city wearing its old name is never a district; the ward named after it is', () => {
  // Post-2025-merger addresses: the central ward is literally "Phường Sài
  // Gòn". It keeps its full name — stripped to "Sài Gòn" it reads as the
  // city, which is the bug this guards.
  assert.deepEqual(
    districtOf('74 Hai Bà Trưng, Phường Sài Gòn, Thành phố Hồ Chí Minh 700000, Việt Nam', null),
    { key: 'phuong sai gon', label: 'Phường Sài Gòn' },
  );
  // Bare, with no unit word, it is the city alias — fall through.
  assert.equal(districtOf(null, 'Sài Gòn'), null);
  assert.equal(districtOf(null, 'Saigon'), null);
  assert.deepEqual(districtOf('12 Lê Lợi, Sài Gòn, Thành phố Hồ Chí Minh, Việt Nam', 'Quận 1'),
    { key: 'q1', label: 'Quận 1' });
});

test('districtOf falls through junk to the neighborhood, then to null', () => {
  // 3 segments — third-from-last is the street, which starts with a number
  assert.deepEqual(
    districtOf('12 Lê Lợi, Thành phố Hồ Chí Minh 700000, Việt Nam', 'District 3'),
    { key: 'q3', label: 'Quận 3' },
  );
  // the city itself is never a district
  assert.equal(districtOf(null, 'Hà Nội'), null);
  assert.equal(districtOf(null, null), null);
  assert.equal(districtOf('', ''), null);
});

test('spellings with and without diacritics share a bucket; the label keeps them', () => {
  assert.equal(foldKey('Bình Thạnh'), foldKey('Binh Thanh'));
  assert.equal(foldKey('Thủ Đức'), 'thu duc');
  const { groups } = buildCoverage([
    row({ neighborhood_en: 'Binh Thanh' }),
    row({ neighborhood_en: 'Bình Thạnh' }),
    row({ neighborhood_en: 'Bình Thạnh' }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].count, 3);
  assert.equal(groups[0].label, 'Bình Thạnh');
});

test('buildCoverage: counts desc, centroid of located rows, banner list, total', () => {
  const rows = [
    row({ slug: 'a', neighborhood_en: 'Quận 1', lat: 10.0, lng: 106.0 }),
    row({ slug: 'b', neighborhood_en: 'Quận 1', lat: 12.0, lng: 108.0 }),
    row({ slug: 'c', neighborhood_en: 'Quận 1', lat: null, lng: null }), // counted, not mapped
    row({ slug: 'd', neighborhood_en: 'Quận 3' }),
    row({ slug: 'e' }), // no district at all
  ];
  const cov = buildCoverage(rows);
  assert.equal(cov.total, 5);
  assert.deepEqual(cov.groups.map((g) => [g.label, g.count]), [['Quận 1', 3], ['Quận 3', 1]]);
  assert.equal(cov.groups[0].lat, 11.0);
  assert.equal(cov.groups[0].lng, 107.0);
  assert.deepEqual(cov.noCoords.map((r) => r.slug), ['c']);
  assert.deepEqual(cov.unplaced.map((r) => r.slug), ['e']);
});

test('fitView picks the deepest zoom that fits and centres the box', () => {
  const pts = [{ lat: 10.72, lng: 106.62 }, { lat: 10.85, lng: 106.75 }];
  const v = fitView(pts, 700, 700);
  assert.ok(v.z >= 9 && v.z <= 14);
  const bw = lngToX(106.75, v.z) - lngToX(106.62, v.z);
  const bh = latToY(10.72, v.z) - latToY(10.85, v.z);
  assert.ok(bw <= 700 - 140 && bh <= 700 - 140, `box ${bw}x${bh} fits inside margins`);
  // one zoom deeper must NOT fit (else fitView under-zoomed)
  if (v.z < 14) {
    const bw2 = lngToX(106.75, v.z + 1) - lngToX(106.62, v.z + 1);
    const bh2 = latToY(10.72, v.z + 1) - latToY(10.85, v.z + 1);
    assert.ok(bw2 > 700 - 140 || bh2 > 700 - 140);
  }
  assert.equal(v.x, (lngToX(106.62, v.z) + lngToX(106.75, v.z)) / 2);
  assert.equal(fitView([], 700, 700), null);
});

// The Google map is centred by lat/lng, but `fitView` answers in world
// pixels — so the inverse has to be exact enough that the basemap and the
// bubbles drawn on top of it agree about where a coordinate is.
test('the inverse projection returns the coordinate it was given', () => {
  for (const z of [9, 12, 14]) {
    for (const [lat, lng] of [[10.7769, 106.7009], [16.0544, 108.2022], [0, 0], [-33.87, 151.21]]) {
      assert.ok(Math.abs(xToLng(lngToX(lng, z), z) - lng) < 1e-9, `lng ${lng} at z${z}`);
      assert.ok(Math.abs(yToLat(latToY(lat, z), z) - lat) < 1e-9, `lat ${lat} at z${z}`);
    }
  }
});

test('the inverse projection agrees with the round numbers', () => {
  assert.equal(xToLng(0, 0), -180);
  assert.equal(xToLng(TILE, 0), 180);
  assert.ok(Math.abs(yToLat(TILE / 2, 0)) < 1e-9);
});

test('mercator round numbers hold', () => {
  assert.equal(lngToX(-180, 0), 0);
  assert.equal(lngToX(180, 0), TILE);
  assert.equal(Math.round(latToY(0, 0)), TILE / 2);
});

test('bubbleRadius grows with count and stays clamped', () => {
  const max = 34;
  assert.equal(bubbleRadius(max, max), 32);
  assert.ok(bubbleRadius(1, max) >= 14);
  assert.ok(bubbleRadius(9, max) > bubbleRadius(2, max));
});

// The three ways the Coverage screen can have no map to draw. They are not
// the same news, and the screen used to report the same one for all of them:
// it gated its "Nothing published here yet." on `groups.length`, which counts
// only the districts that parsed. A city whose addresses all failed to parse
// therefore claimed to be empty directly above a row counting its places, and
// under a heading that had already said "N places · 0 districts".
//
// These assert the shape the screen branches on, so the three states stay
// distinguishable from the data alone.
test('buildCoverage keeps "empty" and "unreadable" apart', () => {
  const at = (address, lat = 10.77) => ({ slug: address, address, neighborhood_en: null, lat, lng: 106.7 });

  const empty = buildCoverage([]);
  assert.equal(empty.total, 0);
  assert.equal(empty.groups.length, 0);
  assert.equal(empty.unplaced.length, 0);

  // Published, located, and filed nowhere: a street number is not a district.
  const unreadable = buildCoverage([at('12 Lê Lợi, Vietnam'), at('9 Ngô Đức Kế, Vietnam')]);
  assert.equal(unreadable.total, 2);
  assert.equal(unreadable.groups.length, 0);
  assert.equal(unreadable.unplaced.length, 2, 'every unparsed row must still be counted somewhere');
  assert.equal(unreadable.noCoords.length, 0, 'these have coordinates — the district is what is missing');

  // Filed, but nothing to put on the map.
  const nowhere = buildCoverage([at('1 X, Quận 1, Ho Chi Minh City, Vietnam', null)]);
  assert.equal(nowhere.total, 1);
  assert.equal(nowhere.groups.length, 1);
  assert.equal(nowhere.groups[0].lat, null);
  assert.equal(nowhere.noCoords.length, 1);
});


// ---- buildCityCoverage: the same fold one rung up, for the view that used
// to have no map of its own. "All cities" picked the busiest city and drew
// that, which is the one view from which you could not see which cities the
// catalog is thin in.

const at = (lat, lng) => row({ lat, lng });
const LABELS = { hcmc: 'TP.HCM', hanoi: 'Hà Nội', danang: 'Đà Nẵng' };
const labelOf = (id) => LABELS[id] ?? id;

test('buildCityCoverage: one group per city, biggest first, centroid of its own rows', () => {
  const cov = buildCityCoverage({
    hanoi: [at(21.0, 105.8), at(21.2, 106.0)],
    hcmc: [at(10.7, 106.6), at(10.8, 106.7), at(10.9, 106.8)],
  }, labelOf);

  assert.deepEqual(cov.groups.map((g) => g.key), ['hcmc', 'hanoi']);
  assert.deepEqual(cov.groups.map((g) => g.label), ['TP.HCM', 'Hà Nội']);
  assert.deepEqual(cov.groups.map((g) => g.count), [3, 2]);
  // Placed on its own places, not on a stored centre — a city whose catalog
  // sits in one district belongs on that district.
  assert.equal(cov.groups[1].lat, 21.1);
  assert.equal(cov.groups[1].lng, 105.9);
  assert.equal(cov.total, 5);
  // Every row already has a city, or it would not be in `perCity`.
  assert.deepEqual(cov.unplaced, []);
});

// A dot on a map is a claim that something is there. A city with nothing
// published has nothing there, and the counts beside the menu already say so.
test('buildCityCoverage leaves an empty city off the map', () => {
  const cov = buildCityCoverage({ hanoi: [at(21, 105)], haiphong: [] }, labelOf);
  assert.deepEqual(cov.groups.map((g) => g.key), ['hanoi']);
  assert.equal(cov.total, 1);
});

// A city whose rows have no coordinates is counted but cannot be drawn —
// the same distinction buildCoverage draws for a district.
test('buildCityCoverage counts a city it cannot place, and says which rows', () => {
  const nowhere = () => row({ lat: null, lng: null });
  const cov = buildCityCoverage({ hue: [nowhere(), nowhere()] }, labelOf);
  assert.equal(cov.groups.length, 1);
  assert.equal(cov.groups[0].count, 2);
  assert.equal(cov.groups[0].lat, null);
  assert.equal(cov.noCoords.length, 2);
});

// Ties break on the label, so the order does not wobble between renders.
test('buildCityCoverage breaks a tie on the name', () => {
  const cov = buildCityCoverage({ hcmc: [at(10, 106)], hanoi: [at(21, 105)] }, labelOf);
  assert.deepEqual(cov.groups.map((g) => g.label), ['Hà Nội', 'TP.HCM']);
});

test('buildCityCoverage on nothing at all', () => {
  const cov = buildCityCoverage({}, labelOf);
  assert.deepEqual(cov.groups, []);
  assert.equal(cov.total, 0);
});
