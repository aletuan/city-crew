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

type T = (en: string, vi: string, ja?: string, zh?: string, hant?: string) => string;

/** A count as the level reads it: whole, and never under none. */
const whole = (saved: number) => Math.max(0, Math.floor(saved || 0));

/**
 * How far through the current level: `done` of `of` places.
 *
 * The ring's own reading (`levelFromSaves().progress`) as two whole
 * numbers, for the bar in the sheet that explains the level — so the bar
 * and the ring, which are drawn inches apart about one thing, say the
 * same fraction. Not places-so-far over places-at-the-next-level (74 of
 * 75): that bar is always nearly full, and beside a ring at four fifths
 * it reads as a second, different measure.
 */
export function levelSteps(saved: number): { done: number; of: number } {
  return { done: whole(saved) % PER_LEVEL, of: PER_LEVEL };
}

/**
 * What the level is, said to the person whose level it is — the words
 * of the sheet a press on the "Lv" pill opens (owner, 16 Nov 2026).
 *
 * Until then nothing in the app said what the pill counted. The role's
 * disc beside it explained itself on a press; the level, on the same
 * picture, did not, and the owner asked what either meant.
 *
 * Three lines, each its own, because the sheet sets them apart: the
 * level, what the next one takes, and the rule with the reader's count.
 * They were one paragraph in a system alert for an hour, which the owner
 * found a wall to read; the bar between the title and the sentences
 * (`levelSteps`) says most of it before a word is read.
 *
 * The count is said here because it is said nowhere else since the same
 * day, when "Saved places" left the row of numbers under the hero — it
 * is the figure the level is made of.
 *
 * Never "0 more": the boundary belongs to the next level
 * (`levelFromSaves`), so there is always between one and `PER_LEVEL` to
 * go.
 */
export function levelWords(saved: number, t: T): { title: string; next: string; rule: string } {
  const n = whole(saved);
  const { level } = levelFromSaves(n);
  const more = PER_LEVEL - (n % PER_LEVEL);
  const up = level + 1;
  // English alone counts its nouns.
  const morePlaces = more === 1 ? 'place' : 'places';
  const savedPlaces = n === 1 ? 'place' : 'places';
  return {
    title: t(`Level ${level}`, `Level ${level}`, `レベル${level}`, `${level} 级`, `${level} 級`),
    next: t(
      `Save ${more} more ${morePlaces} to reach Level ${up}.`,
      `Lưu thêm ${more} địa điểm để đạt Level ${up}.`,
      `あと${more}件保存するとレベル${up}になります。`,
      `再保存 ${more} 个地点即可升到 ${up} 级。`, `再儲存 ${more} 個地點即可升到 ${up} 級。`,
    ),
    rule: t(
      `You have saved ${n} ${savedPlaces}. Every ${PER_LEVEL} take you up a level.`,
      `Bạn đã lưu ${n} địa điểm. Cứ ${PER_LEVEL} địa điểm là lên một level.`,
      `これまでに${n}件保存しました。${PER_LEVEL}件ごとにレベルが1つ上がります。`,
      `你已保存 ${n} 个地点。每保存 ${PER_LEVEL} 个地点升一级。`, `你已儲存 ${n} 個地點。每儲存 ${PER_LEVEL} 個地點升一級。`,
    ),
  };
}
