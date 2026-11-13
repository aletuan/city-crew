// A list's statistics, for its owner (owner, 13 Nov 2026): four figures —
// opens, likes, copies, trips started from it — each all time and over
// the last seven days, on the page "Statistics ›" opens from a list's
// Activity (`CollectionStatsScreen`).
//
// Pure, so the gate can hold it: the answer arrives as Postgres sends it
// (`collection_stats`, through `lib/data/stats`), one row of eight
// integers or no row at all, and this turns it into the four pairs the
// page draws. What "seven days" means, and who is counted, is the
// function's (`20261113160000_collection_stats.sql`): views and trips
// count everyone, the owner too; likes and copies leave out the owner's
// own and anybody the owner blocked, as the Activity page does.
//
// ── no row ──
//
// The function answers its owner with a row, zeros included, and anybody
// else with none. So no row is not "nothing yet" but "not yours to ask
// about" — a list deleted or handed over since the page was opened — and
// `statsOf` says so with null rather than with four zeros the server
// never claimed.

import type { Lang } from './lang';

/** One figure: how many, all time and in the last seven days. */
export type Figure = { total: number; week: number };

/** The four, in the order the page draws them. */
export const STAT_KINDS = ['views', 'likes', 'copies', 'trips'] as const;
export type StatKind = (typeof STAT_KINDS)[number];
export type ListStats = Record<StatKind, Figure>;

/** The row `collection_stats` returns. */
export type StatsRow = {
  views_total: number; views_7d: number;
  likes_total: number; likes_7d: number;
  copies_total: number; copies_7d: number;
  trips_total: number; trips_7d: number;
};

/** The figures, or null when the server answered no row — see the header. */
export function statsOf(rows: readonly StatsRow[]): ListStats | null {
  const r = rows[0];
  if (!r) return null;
  return {
    views: { total: r.views_total, week: r.views_7d },
    likes: { total: r.likes_total, week: r.likes_7d },
    copies: { total: r.copies_total, week: r.copies_7d },
    trips: { total: r.trips_total, week: r.trips_7d },
  };
}

/**
 * Whether nothing at all has been counted: the page then says so in a
 * sentence instead of four zeros. The totals are enough to ask — a week
 * is part of all time, so no week can hold what the total does not.
 */
export function nothingCounted(s: ListStats): boolean {
  return STAT_KINDS.every((k) => s[k].total === 0);
}

/**
 * A count as the reader’s language groups it: 1,284 in English, 1.284
 * in Vietnamese, where the comma is the decimal mark. Japanese and both
 * Chinese group by three with a comma, as English does.
 *
 * Grouped, never compacted ("12.9K"): these are one list's counts, and
 * the place a compact figure earns its keep — a tile too narrow for the
 * digits — is handled on the screen by letting the figure shrink to its
 * line. A curator reading their own list's opens wants the number.
 *
 * By hand rather than `Intl.NumberFormat`: it is three lines, and the
 * locale data behind `Intl` on a phone is the runtime's, not ours.
 */
export function groupDigits(n: number, lang: Lang): string {
  const mark = lang === 'vi' ? '.' : ',';
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, mark);
}
