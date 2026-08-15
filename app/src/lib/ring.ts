// The colour and the geometry of a swept arc.
//
// Here rather than beside the component so it can be tested in a plain
// Node process — see `place.ts` for why that boundary exists. No imports,
// deliberately: colours are strings and angles are numbers.
//
// SVG has no conic gradient. A linear one laid across the circle's box
// only works for an arc long enough to cross it — at a fifth of a turn
// the arc samples a narrow slice and comes out one flat colour, which is
// how a four-colour ring spent most of its life looking like a single
// crayon. So the arc is drawn as a run of short segments, each a solid
// colour, and the sweep is real at every length.

/** A colour and where it sits along the sweep, 0 to 1. */
export type Stop = { at: number; hex: string };

function byte(h: string, i: number): number {
  return parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
}

/** Channel-wise blend. `t` outside 0–1 is clamped rather than extrapolated:
 *  a colour past the end of the ramp is not a colour anyone asked for. */
export function mixHex(a: string, b: string, t: number): string {
  const u = Math.max(0, Math.min(1, t));
  let out = '#';
  for (let i = 0; i < 3; i++) {
    const v = Math.round(byte(a, i) + (byte(b, i) - byte(a, i)) * u);
    out += v.toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * The colour at `t` along the ramp.
 *
 * Interpolating in RGB rather than in a perceptual space is fine *here*
 * because the stops are placed close enough together that no single
 * blend crosses much hue — the muddiness RGB is blamed for comes from
 * long jumps, and the jumps are what the stops exist to shorten.
 */
export function sampleSweep(stops: readonly Stop[], t: number): string {
  const u = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (u <= b.at) {
      const span = b.at - a.at;
      return span <= 0 ? b.hex : mixHex(a.hex, b.hex, (u - a.at) / span);
    }
  }
  return stops[stops.length - 1].hex;
}

/** One piece of the arc: the angles it spans, and where along the sweep
 *  its colour should be taken from. Degrees, clockwise from twelve. */
export type Segment = { a0: number; a1: number; t: number };

/**
 * Chop `pct` of a turn into segments no wider than `stepDeg`.
 *
 * `t` runs 0 to 1 across whatever is drawn, not across the whole circle.
 * That is the choice worth naming: mapping colour to absolute angle would
 * make the tip's colour a second reading of progress, but it also means a
 * ring at a fifth of a turn only ever shows the first fifth of the
 * palette — one flat colour again, for exactly the accounts that see it
 * most. Progress is already told by the arc's length. The palette's job
 * is to be a sweep, so it gets spent in full at every length.
 */
export function arcSweep(pct: number, stepDeg = 6): Segment[] {
  const total = Math.max(0, Math.min(1, pct)) * 360;
  if (total <= 0) return [];
  const n = Math.max(1, Math.ceil(total / stepDeg));
  const step = total / n;
  const out: Segment[] = [];
  for (let i = 0; i < n; i++) {
    // Midpoint, so the first segment is not painted in the ramp's very
    // first colour and the last not in its very last — the run of
    // segments is a sampling of the ramp, and sampling happens at
    // centres.
    out.push({ a0: i * step, a1: (i + 1) * step, t: (i + 0.5) / n });
  }
  return out;
}
