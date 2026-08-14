// The engagement level behind the profile ring.
//
// Here rather than beside the component so it can be tested in a plain
// Node process — see `place.ts` for why that boundary exists. No imports,
// deliberately.

/**
 * Places per level. Small, so a new account sees the ring move at all:
 * at twenty a first save would turn it by a sliver and read as broken.
 */
export const PER_LEVEL = 5;

/**
 * Level and progress from the number of distinct places saved.
 *
 * The design calls for saves + trips + reviews. Two of those do not
 * exist — there is no trips feature and no reviews table — so a formula
 * spanning all three would be two-thirds invention. Saves are real and
 * countable today; this widens when the rest arrives.
 *
 * Level 1 is where everyone starts, including at zero saves, because a
 * profile reading "Lv 0" says the account is broken rather than new.
 */
export function levelFromSaves(saved: number): { level: number; progress: number } {
  const n = Math.max(0, Math.floor(saved || 0));
  return { level: Math.floor(n / PER_LEVEL) + 1, progress: (n % PER_LEVEL) / PER_LEVEL };
}
