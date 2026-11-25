// Pins that stand too close together, gathered into one that says how
// many. Pure, so the 100% gate holds it.
//
// Hanoi has 227 places and Saigon 288, all of them inside a few square
// kilometres of the same river bend, so a map fitted to all of them is a
// mound of overlapping pins: you cannot count them, and the ones
// underneath cannot be tapped at all. A cluster is the honest answer —
// one pin, one number, and a tap that takes the reader in far enough for
// the mound to come apart.
//
// The grid is cut from the region the reader is looking at rather than
// from a table of zoom levels: `latitudeDelta` *is* the zoom, so a fixed
// number of cells across the view means the clustering loosens as they
// zoom in and needs no threshold to switch itself off. Zoomed far enough
// that two places are a street apart, every cell holds one place, and
// what comes back is what went in.

/** What this needs of a place: a name to give back and a position. */
export type ClusterPoint = { slug: string; lat: number; lng: number };

/** One pin to draw: a single place when `slugs` has one, a bubble with a
 *  count when it has more. The position is the mean of its members, so a
 *  bubble sits on its own weight rather than on a cell's corner.
 *
 *  `key` is a slug where the place stands alone and a `row:column` pair
 *  where it does not. The two namespaces share a field on purpose: it is
 *  only ever a React key, and no slug looks like a pair of integers. */
export type Cluster = { key: string; lat: number; lng: number; slugs: string[] };

/** How many cells the view is cut into, each way.
 *
 * Eight, because the bubble is the thing that has to fit: at eight a cell
 * is about an eighth of the screen, comfortably wider than the widest
 * bubble, so two neighbours do not overlap even when both sit near their
 * shared edge. Twelve drew a tidier map of the data and a worse one to
 * look at. */
const CELLS = 8;

/**
 * The pins as the map should draw them at this region.
 *
 * `keep` is the chosen place, if there is one: it never joins a cluster,
 * because the strip along the bottom is already talking about it and a
 * pin that vanishes into a bubble while its card is open reads as a bug.
 *
 * A region with no width — the first frame, a bad fit — cannot be divided
 * into cells, so every place comes back on its own. Better a mound for
 * one frame than a division by zero.
 */
export function clusterPins(
  points: readonly ClusterPoint[],
  region: { latitudeDelta: number; longitudeDelta: number },
  keep?: string | null,
): Cluster[] {
  const cellLat = region.latitudeDelta / CELLS;
  const cellLng = region.longitudeDelta / CELLS;
  const alone = !(cellLat > 0) || !(cellLng > 0);

  const out: Cluster[] = [];
  const byCell = new Map<string, Cluster>();
  for (const p of points) {
    if (alone || p.slug === keep) {
      out.push({ key: p.slug, lat: p.lat, lng: p.lng, slugs: [p.slug] });
      continue;
    }
    const key = `${Math.floor(p.lat / cellLat)}:${Math.floor(p.lng / cellLng)}`;
    const cell = byCell.get(key);
    if (!cell) {
      const made = { key, lat: p.lat, lng: p.lng, slugs: [p.slug] };
      byCell.set(key, made);
      out.push(made);
      continue;
    }
    // Running mean, so the bubble ends up at the centre of gravity of
    // what it holds and not at the first member that happened to arrive.
    const n = cell.slugs.length;
    cell.lat = (cell.lat * n + p.lat) / (n + 1);
    cell.lng = (cell.lng * n + p.lng) / (n + 1);
    cell.slugs.push(p.slug);
  }
  return out;
}

/**
 * How close two places stand, in metres, before no zoom draws them apart.
 *
 * Six, measured rather than chosen. Google's deepest zoom on a phone shows
 * about 27 m across and 35 m down, so a cell there is some 3.4 by 4.4 m,
 * and two places closer than that can share one at every zoom there is: a
 * bubble that a tap zooms into and that comes back the same bubble. Hanoi
 * has five such pairs (24 Oct 2026) — three under a metre apart, two
 * doors in one building at 27 Trần Bình Trọng, 47 Hàng Bè and ngõ 148 Mai
 * Anh Tuấn, and two at 4.4 and 5.2 m. The next pair is 8.1 m apart and
 * comes apart.
 */
export const STACK_M = 6;

type At = { lat: number; lng: number };

/** Metres between two points, flat-earth: at a few metres the curve is
 *  nothing, and this runs for every pair in a bubble. */
export function metresApart(a: At, b: At): number {
  const y = (a.lat - b.lat) * 111_320;
  const x = (a.lng - b.lng) * 111_320 * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot(x, y);
}

/** Whether a bubble's places all stand on one spot, so that a tap has
 *  nothing to zoom into and should show them instead. */
export function oneSpot(points: readonly At[]): boolean {
  return points.every((a, i) => points.slice(i + 1).every((b) => metresApart(a, b) <= STACK_M));
}

/**
 * The places standing on this one's spot, itself included, in the order
 * given — what a tap on the chosen pin steps through. Pins this close are
 * drawn one over another, and the chosen one is on top, so without this
 * the place under it could never be reached. Empty for a slug that is not
 * here.
 */
export function stackAt(points: readonly ClusterPoint[], slug: string): string[] {
  const at = points.find((p) => p.slug === slug);
  if (!at) return [];
  return points.filter((p) => metresApart(p, at) <= STACK_M).map((p) => p.slug);
}

/**
 * How wide the bubble is drawn, by how much it holds.
 *
 * Three steps, not a curve: the reader is comparing bubbles at a glance,
 * and three sizes are three answers where a continuous scale is none. The
 * numbers are diameters in points.
 *
 * Small enough to sit below the pins in the eye's order: a cluster is a
 * place to go and look, a pin is a place. The two must not read as peers,
 * and the round bubble against the pin's teardrop does the rest.
 */
export function clusterSize(count: number): number {
  if (count >= 100) return 48;
  if (count >= 10) return 40;
  return 32;
}

/** A bubble's ground, and the ink of the figure standing on it. */
export type ClusterSkin = { fill: string; ink: string };

/**
 * How dense the bubble looks, by how much it holds.
 *
 * The same two steps as `clusterSize`, so colour and size tell one story
 * and not two. Filled rather than outlined: a white disc inside a hard
 * dark ring is Google's own annotation style, and a reader should be able
 * to tell our groups from the map's furniture without reading either.
 *
 * Grey, and that is the whole point of these particular numbers.
 *
 * They used to be warm earth — the app's own family, which sounded right
 * and measured wrong. All three sat inside the hue arc `cafes` and `eats`
 * live in, and once the pins stopped being pastels the hundred-bubble and
 * the Eats pin came to 1.04:1 against each other, which is to say they
 * were one colour. A reader scanning a dense map saw brown discs that
 * were sometimes a restaurant and sometimes forty places.
 *
 * Hue could not fix it. Nine categories already spend the wheel, and a
 * bubble sitting in the one wide gap left would simply read as a tenth
 * category — which is the opposite of what a bubble is. So the fix is the
 * other channel: every category pin carries at least 55% saturation and
 * every step here carries under 10, so a bubble reads as grey. Not a kind
 * of place. Ours, but furniture.
 *
 * Density still steps, in the one channel that is left — darkness — and
 * the ramp is set so the worst of the three against either map ground is
 * 1.91:1, where the earth ramp's worst was 1.24. The white ring does the
 * rest, as it does for the pins.
 *
 * The ramp never reaches the accent's coral, which belongs to the one
 * place the reader chose. Each step clears 4.5:1 against its own ink,
 * which is why the figure turns white at the top.
 */
export function clusterSkin(count: number): ClusterSkin {
  if (count >= 100) return { fill: '#545045', ink: '#FFFFFF' };
  if (count >= 10) return { fill: '#857F6F', ink: '#17150F' };
  return { fill: '#B9B5AC', ink: '#17150F' };
}

/**
 * The region a fit to `points` will land on, worked out before the map
 * gets there — so the pins can be cut into cells at the zoom they are
 * going to, rather than at the one the camera is leaving (owner's
 * recording, 23 Nov 2026).
 *
 * Without it the cells are the old view's until the glide ends and the
 * map reports where it stopped: from a street-level view out to the city,
 * a few hundred pins were drawn one by one, piled on each other, for the
 * glide's half second, and gathered into bubbles only when it ended.
 *
 * The arithmetic is the fit's own, near enough for a grid of eight: the
 * box the points span, in the screen less the padding, by whichever side
 * fills first. A degree of longitude and one of latitude are the same
 * width on screen times the cosine of the latitude, which over the few
 * kilometres of a city is one number. The map's own report at the end of
 * the glide still re-cuts the grid to the exact region, so an error here
 * costs one regrouping, which is what every glide cost before.
 *
 * Null when there is nothing to measure: no points, a view with no room
 * left inside the padding, or points on one spot, where Google zooms in
 * as far as it goes and no grid is needed.
 */
export function fitSpan(
  points: readonly { lat: number; lng: number }[],
  view: { width: number; height: number },
  pad: { top: number; right: number; bottom: number; left: number },
): { latitudeDelta: number; longitudeDelta: number } | null {
  if (!points.length) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const latBox = Math.max(...lats) - Math.min(...lats);
  const lngBox = Math.max(...lngs) - Math.min(...lngs);
  const w = view.width - pad.left - pad.right;
  const h = view.height - pad.top - pad.bottom;
  if (w <= 0 || h <= 0) return null;
  const cos = Math.cos((((Math.max(...lats) + Math.min(...lats)) / 2) * Math.PI) / 180);
  // Degrees of longitude per point, by the side that fills first.
  const perPoint = Math.max(lngBox / w, latBox / cos / h);
  if (!(perPoint > 0)) return null;
  return { latitudeDelta: perPoint * view.height * cos, longitudeDelta: perPoint * view.width };
}

/**
 * Where a map should open so that it is already on its pins: the region
 * a fit to `points` lands on, centre and all (owner's recording, 25 Nov
 * 2026).
 *
 * The map used to open on its first pin at a district's width and be
 * fitted a moment later, so every opening was a street somewhere in the
 * city, then a jump out to all of it. `fitSpan` gives the width; the
 * centre is the box's own, moved by half the difference of the paddings
 * — the fit centres the box in the room the padding leaves, which is not
 * the middle of the screen when the foot is padded more than the head.
 * The fit still runs when the map is ready and has the last word; this
 * is so that it has nothing left to move.
 *
 * Null where `fitSpan` is: nothing to measure, or one spot.
 */
export function fitRegion(
  points: readonly { lat: number; lng: number }[],
  view: { width: number; height: number },
  pad: { top: number; right: number; bottom: number; left: number },
): { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null {
  const span = fitSpan(points, view, pad);
  if (!span) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const perLng = span.longitudeDelta / view.width;
  const perLat = span.latitudeDelta / view.height;
  return {
    latitude: (Math.max(...lats) + Math.min(...lats)) / 2 + (perLat * (pad.top - pad.bottom)) / 2,
    longitude: (Math.max(...lngs) + Math.min(...lngs)) / 2 - (perLng * (pad.left - pad.right)) / 2,
    ...span,
  };
}
