// The arithmetic behind the Coverage screen, kept away from React so it can
// be read — and tested — as plain functions over plain rows.
//
// A row is { slug, name_en, address, neighborhood_en, lat, lng, city_id }
// for one published place. The screen asks two questions of it: which
// quận/huyện is this in, and where does it sit on the map.

/**
 * Which comma segment of a stored address names the district.
 *
 * The import pipeline stores Google's formattedAddress, and the
 * backfill_neighborhood migration already established its shape: the
 * district/ward is its own segment, consistently third-from-last — after
 * the street portion (whose length varies) and before "<City> <postcode?>,
 * Vietnam" (always exactly those last two). This module leans on the same
 * fact rather than re-deriving it.
 */
const districtSegment = (address) => {
  if (!address) return null;
  const segs = address.split(/\s*,\s*/).filter(Boolean);
  return segs.length >= 3 ? segs[segs.length - 3] : null;
};

/** Diacritic-insensitive grouping key: "Bình Thạnh" and "Binh Thanh" are the
 *  same district wearing two spellings, and must land in one bucket. */
export const foldKey = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase().replace(/\s+/g, ' ').trim();

// Administrative prefixes that name the *kind* of unit, not the unit — the
// grouping wants "Bình Thạnh", whether the address said "Quận Bình Thạnh",
// "Q. Bình Thạnh" or "Thành phố Thủ Đức".
const PREFIX = /^(?:quận|huyện|thị xã|thành phố|phường|q|h|tx|tp|p)\.?\s+/i;
// Numbered districts, any spelling Google has used: "Quận 1", "District 1",
// "Q.1", "Ward 4" stays a ward though — only district words match here.
const NUMBERED = /^(?:quận|district|q)\.?\s*0*(\d+)$/i;

const CITY_WORDS = new Set([
  'ho chi minh', 'ho chi minh city', 'thanh pho ho chi minh', 'tp ho chi minh',
  'sai gon', 'saigon',
  'ha noi', 'hanoi', 'da nang', 'danang', 'da lat', 'dalat', 'hue',
  'thua thien hue', 'viet nam', 'vietnam',
]);

/**
 * The district a place belongs to, as { key, label }, or null when the row
 * cannot say. Address first (the documented segment), the stored
 * neighborhood as fallback — hand-curated rows sometimes carry the district
 * only there. A segment that is clearly not a district (starts with a house
 * number, or names the city itself) falls through rather than minting a
 * bogus bucket.
 */
export function districtOf(address, neighborhood) {
  for (const raw of [districtSegment(address), neighborhood]) {
    if (!raw) continue;
    const seg = raw.trim();
    if (!seg || /^\d/.test(seg)) continue; // "12 Lê Lợi" — a street, not a district
    const numbered = seg.match(NUMBERED);
    if (numbered) return { key: `q${numbered[1]}`, label: `Quận ${numbered[1]}` };
    const name = seg.replace(PREFIX, '').trim();
    if (!name) continue;
    const key = foldKey(name);
    if (CITY_WORDS.has(key)) {
      // "Sài Gòn" bare is the city wearing its old name — never a district.
      // But "Phường Sài Gòn" is a real ward (the 2025 merger renamed the
      // Bến Nghé area after the city): the prefix is exactly what keeps it
      // from reading as the city, so that one keeps its full name.
      if (!PREFIX.test(seg)) continue;
      return { key: foldKey(seg), label: seg };
    }
    return { key, label: name };
  }
  return null;
}

const hasCoords = (r) =>
  Number.isFinite(r.lat) && Number.isFinite(r.lng) && !(r.lat === 0 && r.lng === 0);

/**
 * One city's published rows folded into what the screen shows:
 *
 *   groups     per-district — count desc, label asc on ties — each with the
 *              centroid of its located places for the map bubble
 *   unplaced   rows whose district could not be read (shown as one quiet
 *              "unknown" row so the panel total still adds up)
 *   noCoords   rows that cannot be on the map at all — the amber banner
 *   total      every published row, located or not
 *
 * Labels group diacritic-insensitively; the label shown is the most common
 * spelling in the data, diacritics preferred on ties — the desk should
 * write "Bình Thạnh" if even one row does.
 */
export function buildCoverage(rows) {
  const buckets = new Map();
  const unplaced = [];
  for (const r of rows) {
    const d = districtOf(r.address, r.neighborhood_en);
    if (!d) { unplaced.push(r); continue; }
    if (!buckets.has(d.key)) buckets.set(d.key, { labels: new Map(), rows: [] });
    const b = buckets.get(d.key);
    b.labels.set(d.label, (b.labels.get(d.label) ?? 0) + 1);
    b.rows.push(r);
  }
  const bestLabel = (labels) =>
    [...labels.entries()].sort((a, b) =>
      b[1] - a[1]
      || (/[^\p{ASCII}]/u.test(b[0]) ? 1 : 0) - (/[^\p{ASCII}]/u.test(a[0]) ? 1 : 0)
      || a[0].localeCompare(b[0]))[0][0];
  const groups = [...buckets.entries()]
    .map(([key, b]) => {
      const located = b.rows.filter(hasCoords);
      return {
        key,
        label: bestLabel(b.labels),
        count: b.rows.length,
        lat: located.length ? located.reduce((s, r) => s + r.lat, 0) / located.length : null,
        lng: located.length ? located.reduce((s, r) => s + r.lng, 0) / located.length : null,
      };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return {
    groups,
    unplaced,
    noCoords: rows.filter((r) => !hasCoords(r)),
    total: rows.length,
  };
}

/**
 * The same shape as `buildCoverage`, one rung up: a group per city rather
 * than a group per district.
 *
 * "All cities" used to have no map of its own. A map draws one city, so
 * the screen picked the busiest and said so in a caption — an answer to a
 * question nobody asked, and the one view from which you could not see
 * that Hải Phòng has nothing in it. At city level the same map works: one
 * bubble per city, placed on its own places rather than on a stored
 * centre, so a city whose catalog is all in one district sits on that
 * district and not on a point no place occupies.
 *
 * `unplaced` is empty by construction — every row already has a city, or
 * it would not be in `perCity`. `noCoords` counts the rows this view
 * cannot place, which is a city's worth rather than a place's, so it is
 * summed across the cities that have none.
 */
export function buildCityCoverage(perCity, labelOf) {
  const groups = Object.entries(perCity)
    .map(([id, rows]) => {
      const located = rows.filter(hasCoords);
      return {
        key: id,
        label: labelOf(id),
        count: rows.length,
        lat: located.length ? located.reduce((s, r) => s + r.lat, 0) / located.length : null,
        lng: located.length ? located.reduce((s, r) => s + r.lng, 0) / located.length : null,
      };
    })
    // A city with nothing published is a fact the counts beside the menu
    // already carry; an empty bubble on a map is just a dot lying about
    // where the catalog is.
    .filter((g) => g.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return {
    groups,
    unplaced: [],
    noCoords: Object.values(perCity).flat().filter((r) => !hasCoords(r)),
    total: Object.values(perCity).reduce((n, rows) => n + rows.length, 0),
  };
}

// ── web mercator, the projection the Google basemap is drawn in ──
// Same 256px world at zoom 0, so a world pixel computed here and a world
// pixel inside `google.maps.Map` are the same pixel. That is what lets the
// bubbles be plain SVG over the map instead of an OverlayView inside it.
export const TILE = 256;
export const lngToX = (lng, z) => ((lng + 180) / 360) * TILE * 2 ** z;
export const latToY = (lat, z) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** z;
};

// The way back. `fitView` answers in world pixels; a Google map is centred
// by coordinate, so the framing it picks has to be translated before the map
// can be told about it.
export const xToLng = (x, z) => (x / (TILE * 2 ** z)) * 360 - 180;
export const yToLat = (y, z) => {
  const f = y / (TILE * 2 ** z);
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * f))) * 180) / Math.PI;
};

/**
 * The view that shows every bubble: highest zoom (bounded) whose projected
 * bounding box, plus a margin for bubble radii and labels, fits the
 * viewport — centred on that box. Returns { z, x, y } with x/y the world
 * pixel of the viewport centre at zoom z.
 */
export function fitView(points, width, height, { margin = 70, minZ = 9, maxZ = 14 } = {}) {
  if (!points.length) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const box = {
    n: Math.max(...lats), s: Math.min(...lats),
    e: Math.max(...lngs), w: Math.min(...lngs),
  };
  let z = maxZ;
  for (; z > minZ; z--) {
    const bw = lngToX(box.e, z) - lngToX(box.w, z);
    const bh = latToY(box.s, z) - latToY(box.n, z);
    if (bw <= width - margin * 2 && bh <= height - margin * 2) break;
  }
  return {
    z,
    x: (lngToX(box.e, z) + lngToX(box.w, z)) / 2,
    y: (latToY(box.s, z) + latToY(box.n, z)) / 2,
  };
}

/** Bubble radius in px: area tracks count, clamped so the smallest quận is
 *  still a target and the biggest does not swallow the map. */
export const bubbleRadius = (count, maxCount) =>
  Math.round(14 + 18 * Math.sqrt(count / Math.max(1, maxCount)));
