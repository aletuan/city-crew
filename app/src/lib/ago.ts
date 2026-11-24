// How long ago, in the reader's words.
//
// `friends.agoOf` gives the shape — a unit and a number — and until
// 17 Nov 2026 the one screen that told time this way (`ActivityScreen`)
// put the words to it itself. A person's page tells it now too, on the
// cards of what they have done, and two screens must not count back in
// two dialects: the sentence lives here, and both ask for it.
//
// The words come in through `say` — the screen's `t` — because this
// module is pure and the language is the reader's, held by a provider.

import { numericDate } from './format';
import { agoOf } from './friends';

/** The screen's `t`: one phrase in each language the app speaks. */
export type Say = (en: string, vi: string, ja?: string, zh?: string, hant?: string) => string;

/** How many days a time is told as a distance before it is told as a
 *  date. A week of "n days ago", then the date: past a week nobody counts
 *  back, they look at a calendar — Mail and Instagram turn the same
 *  corner. */
export const RELATIVE_DAYS = 7;

/**
 * "just now", "5m ago", "3h ago", "yesterday", "4 days ago" — and past a
 * week, the date as `numericDate` writes it, the check-in rows' form, so
 * a day already past is written one way across the profile stack.
 */
export function agoLabel(iso: string, now: number, lang: string, t: Say): string {
  const ago = agoOf(iso, now);
  if (ago.unit === 'now') return t('just now', 'vừa xong', 'たった今', '刚刚', '剛剛');
  if (ago.unit === 'minutes') return t(`${ago.n}m ago`, `${ago.n} phút trước`, `${ago.n}分前`, `${ago.n} 分钟前`, `${ago.n} 分鐘前`);
  if (ago.unit === 'hours') return t(`${ago.n}h ago`, `${ago.n} giờ trước`, `${ago.n}時間前`, `${ago.n} 小时前`, `${ago.n} 小時前`);
  if (ago.n === 1) return t('yesterday', 'hôm qua', '昨日', '昨天', '昨天');
  if (ago.n > RELATIVE_DAYS) return numericDate(lang, new Date(iso));
  return t(`${ago.n} days ago`, `${ago.n} ngày trước`, `${ago.n}日前`, `${ago.n} 天前`, `${ago.n} 天前`);
}

/**
 * A day told as a distance: "today", "yesterday", "4 days ago", and past
 * a week the date — `agoLabel` with nothing finer than a day, for a
 * thing whose hour is not the reader's to know (a friend's visit,
 * `PersonCheckin.day`).
 *
 * `day` is `YYYY-MM-DD` and so is today, counted on the reader's own
 * calendar: two dates a day apart are "yesterday" whatever the clocks
 * said. A day that is somehow ahead of the reader's — a visit made in
 * Melbourne's morning, read in Hà Nội the evening before — is "today",
 * not a negative distance.
 */
export function dayLabel(day: string, now: Date, lang: string, t: Say): string {
  const [y, m, d] = day.split('-').map(Number);
  // Noon, both: a difference of whole days survives a daylight-saving
  // night, where midnights 23 or 25 hours apart would round wrong.
  const then = new Date(y, m - 1, d, 12);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const n = Math.round((today.getTime() - then.getTime()) / 86_400_000);
  if (n <= 0) return t('today', 'hôm nay', '今日', '今天', '今天');
  if (n === 1) return t('yesterday', 'hôm qua', '昨日', '昨天', '昨天');
  if (n > RELATIVE_DAYS) return numericDate(lang, then);
  return t(`${n} days ago`, `${n} ngày trước`, `${n}日前`, `${n} 天前`, `${n} 天前`);
}
