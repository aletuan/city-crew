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
  'ha noi', 'hanoi', 'da nang', 'danang', 'viet nam', 'vietnam',
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
    if (CITY_WORDS.has(key) || CITY_WORDS.has(foldKey(seg))) continue;
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
      || (/[^\u0000-\u007f]/.test(b[0]) ? 1 : 0) - (/[^\u0000-\u007f]/.test(a[0]) ? 1 : 0)
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

// ── web mercator, for the static tile mosaic ──
export const TILE = 256;
export const lngToX = (lng, z) => ((lng + 180) / 360) * TILE * 2 ** z;
export const latToY = (lat, z) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** z;
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
