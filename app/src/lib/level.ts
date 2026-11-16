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

/**
 * What the level is, said to the person whose level it is — the words
 * behind a press on the "Lv" pill (owner, 16 Nov 2026).
 *
 * Until then nothing in the app said what the pill counted. The star
 * beside it explained itself on a press; the level, on the same
 * picture, did not, and the owner asked what either meant.
 *
 * The rule, then the reader's own two numbers: how many places are
 * counted and how many more the next level takes. The count is said
 * here because it is said nowhere else since the same day, when "Saved
 * places" left the row of numbers under the hero — this is the figure
 * the level is made of, and the one place it can still be read.
 *
 * Never "0 more": the boundary belongs to the next level
 * (`levelFromSaves`), so there is always between one and `PER_LEVEL` to
 * go.
 */
export function levelWords(saved: number, t: T): { title: string; body: string } {
  const n = Math.max(0, Math.floor(saved || 0));
  const { level } = levelFromSaves(n);
  const more = PER_LEVEL - (n % PER_LEVEL);
  const next = level + 1;
  return {
    title: t(`Level ${level}`, `Level ${level}`, `レベル${level}`, `${level} 级`, `${level} 級`),
    body: t(
      `Every ${PER_LEVEL} places you save into a collection takes you up a level. You have saved ${n} so far, and ${more} more takes you to Level ${next}.`,
      `Cứ ${PER_LEVEL} địa điểm bạn lưu vào bộ sưu tập là lên một level. Bạn đã lưu ${n} địa điểm, lưu thêm ${more} địa điểm nữa để lên Level ${next}.`,
      `コレクションに場所を${PER_LEVEL}件保存するごとに、レベルが1つ上がります。これまでに${n}件保存しました。あと${more}件でレベル${next}です。`,
      `每在合集中保存 ${PER_LEVEL} 个地点就升一级。你已保存 ${n} 个地点，再保存 ${more} 个即可升到 ${next} 级。`, `每在合集中儲存 ${PER_LEVEL} 個地點就升一級。你已儲存 ${n} 個地點，再儲存 ${more} 個即可升到 ${next} 級。`,
    ),
  };
}
