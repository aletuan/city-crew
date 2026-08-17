// The Coverage screen's arithmetic, exercised as plain functions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  foldKey, districtOf, buildCoverage, fitView, lngToX, latToY, bubbleRadius, TILE,
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
