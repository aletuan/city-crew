// Where one photograph stands among the catalog's, and how to say it.
//
// Its own file because both sides of the scorer registry need it — the
// interpreters in `photoScoreVision.ts` rank a photograph, and the sheet
// says the rank — and `photoScore.ts` imports the interpreters, so
// living there would make the two import each other.

/**
 * Where `x` stands in a distribution given as evenly spaced quantiles —
 * `q[0]` the least seen, `q[q.length - 1]` the most, the ones between at
 * equal steps — as a share from 0 to 1, read straight between the two
 * quantiles either side. Clamped at both ends: past the most seen is
 * "the top", not more than all of it.
 */
export function standingIn(x: number, q: readonly number[]): number {
  if (x <= q[0]) return 0;
  const above = q.findIndex((v) => v > x);
  if (above < 0) return 1;
  const below = above - 1;
  return (below + (x - q[below]) / (q[above] - q[below])) / (q.length - 1);
}

/**
 * A share as a reader takes it: to the nearest five, and never 0% or
 * 100%, because "sharper than 100% of the catalog" is false of the
 * sharpest photograph too — it ties itself. Two digits after a reading
 * of 277 photographs would be precision the reading does not have.
 */
export function percentText(share: number): number {
  return Math.min(95, Math.max(5, Math.round(share * 20) * 5));
}
