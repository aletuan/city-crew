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
