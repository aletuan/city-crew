// Small format helpers pulled out of the place-detail screen so they can
// be tested in a plain Node process — the screen itself imports React
// Native, which a test runner cannot load.

const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_VI = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * A date as an editorial dateline: "Thursday, August 7" / "Thứ Năm, 7
 * tháng 8" / "8月7日（木）".
 *
 * Here rather than in a screen because a second screen wanted it, and a
 * second copy of the day names is how the app ends up saying "Thứ Bảy" in
 * one place and "T7" in another. `now` is a parameter for the same reason
 * everything else in this file takes one: a function that reads the clock
 * itself cannot be tested.
 */
export function dateline(lang: string, now: Date): string {
  if (lang === 'vi') return `${DAYS_VI[now.getDay()]}, ${now.getDate()} tháng ${now.getMonth() + 1}`;
  if (lang === 'ja') return `${now.getMonth() + 1}月${now.getDate()}日（${DAYS_JA[now.getDay()]}）`;
  return `${DAYS_EN[now.getDay()]}, ${MONTHS_EN[now.getMonth()]} ${now.getDate()}`;
}

/**
 * A count of minutes, spelled: "75 min" / "75 phút" / "75分".
 *
 * ── the collision this ends ──
 *
 * A plan card was printing three units in three consecutive lines, and
 * two of them were one letter apart meaning opposite things:
 *
 *     99/81 Coffee    Hoàn Kiếm · 75′      ← minutes, as a prime
 *       50 m · ≈ 2 min                     ← metres, then minutes
 *     The Running Bean  Hoàn Kiếm · 75′
 *
 * `m` there is **metres**, from `fmtDistance`. Beside a `min` on the same
 * line and a `′` on the lines above and below it, the card asks the
 * reader to hold three notations for two quantities — and the one that
 * looks most like "minutes" is the distance.
 *
 * So the prime goes, and this is why it goes rather than the `min`:
 *
 *   - **it does not translate.** `′` is a chess and football convention
 *     from one writing tradition. A Vietnamese reader got `75′` on one
 *     line and `2 phút` on the next; a Japanese reader got `75′` above
 *     `2分`. The word is in the language, the symbol is not.
 *   - **it was the only unspelled unit on the card.** `km`, `h` and `đ`
 *     are conventional everywhere the app ships. A prime for minutes is
 *     not, and a reader who has to learn a notation to read a duration
 *     has been charged for the designer's brevity.
 *
 * Distinct from `fmtDuration`, which is a *range* that folds into hours
 * past sixty minutes — right for "how long people spend here", wrong for
 * a dwell the editor lets you set to the quarter hour and then has to
 * print back exactly.
 */
export function fmtMinutes(n: number, lang: string): string {
  return lang === 'vi' ? `${n} phút` : lang === 'ja' ? `${n}分` : `${n} min`;
}

export function fmtDuration(min: number | null, max: number | null, lang: string): string | null {
  if (!min) return null;
  if ((max ?? min) <= 60) {
    const range = !max || min === max ? `${min}` : `${min}–${max}`;
    return lang === 'vi' ? `${range} phút` : lang === 'ja' ? `${range}分` : `${range} min`;
  }
  const h = (m: number) => Math.round(m / 30) / 2;
  const range = !max || h(min) === h(max) ? `${h(min)}` : `${h(min)}–${h(max)}`;
  return lang === 'vi' ? `${range} giờ` : lang === 'ja' ? `${range}時間` : `${range}h`;
}

/**
 * Minutes past midnight as a wall clock — "09:00", "21:30".
 *
 * The one place in the app that decides what a time of day looks like.
 * There were six copies of this before, one per screen plus `assist.ts`,
 * five of them identical and the sixth quietly different; and beside them
 * the opening hours went out in Google's own "9:00 PM", so a Vietnamese
 * card could carry `10:24` and `mở tới 9:00 PM` two lines apart.
 *
 * **Twenty-four hour, in every language.** Not a preference: Vietnamese
 * writes a scheduled hour as 21:00 and Japanese does the same, so AM/PM
 * was only ever right for one of the three, and every time this app
 * computes itself was already 24-hour. It also costs nothing to read
 * wrongly — a plan is a schedule, and this app has already shipped one bug
 * that planned an evening for 09:00, which a 12-hour display would have
 * hidden rather than exposed.
 *
 * Rounds the *instant*, not the minute. `Math.round(m) % 60` was the old
 * form and it rolls backwards across an hour: 119.6 minutes came out as
 * "01:00" rather than "02:00", because the minute rounded up to 60 and the
 * hour never heard about it. No caller passes a fraction today — dwells
 * land on quarter hours and legs are rounded — so this was latent in all
 * six copies rather than live in one.
 *
 * Wraps past midnight, because a wall clock does: a plan running from
 * 22:00 to 00:30 is a late night, not an error, and the alternative
 * ("24:30") is a Japanese broadcast convention that reads as broken
 * everywhere else. The range it sits in supplies the direction.
 */
export function clockOf(minutes: number): string {
  const at = ((Math.round(minutes) % DAY) + DAY) % DAY;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(at / 60))}:${p(at % 60)}`;
}

/** "Monday: 8:00 AM – 11:00 PM" → ["Monday", "8:00 AM – 11:00 PM"] */
export function splitHours(line: string): [string, string] {
  const i = line.indexOf(': ');
  return i > 0 ? [line.slice(0, i), line.slice(i + 2)] : [line, ''];
}

/** Indices for the page-dot row: all pages up to 7, else a window sliding
 * with the active page so the strip never gets crowded. */
export function dotWindow(count: number, active: number, max = 7): number[] {
  if (count <= max) return Array.from({ length: count }, (_, i) => i);
  const start = Math.min(Math.max(active - Math.floor(max / 2), 0), count - max);
  return Array.from({ length: max }, (_, i) => start + i);
}

/**
 * Google's weekday strings, in short form, per language.
 *
 * A map rather than `slice(0, 3)`: the day names arrive in whatever
 * language the Places API replied in, and three characters of "Thứ Năm" is
 * "Thứ" for every day of the week. The import never asks for another
 * language, so the English keys always hit — and on the day that changes,
 * an unknown name keeps its full spelling instead of collapsing into its
 * neighbours.
 *
 * Keyed by Google's English name and answering in the reader's language,
 * because those are two different questions. The table used to answer only
 * the first, so a Vietnamese reader was told their café opens "Mon–Fri".
 */
const SHORT_DAY: Record<string, { en: string; vi: string; ja: string }> = {
  Monday: { en: 'Mon', vi: 'T2', ja: '月' },
  Tuesday: { en: 'Tue', vi: 'T3', ja: '火' },
  Wednesday: { en: 'Wed', vi: 'T4', ja: '水' },
  Thursday: { en: 'Thu', vi: 'T5', ja: '木' },
  Friday: { en: 'Fri', vi: 'T6', ja: '金' },
  Saturday: { en: 'Sat', vi: 'T7', ja: '土' },
  Sunday: { en: 'Sun', vi: 'CN', ja: '日' },
};

const pick = (v: { en: string; vi: string; ja: string }, lang: string) =>
  (lang === 'vi' ? v.vi : lang === 'ja' ? v.ja : v.en);

const CLOSED = { en: 'Closed', vi: 'Đóng cửa', ja: '休業' };
const ALL_DAY = { en: 'Open 24 hours', vi: 'Mở cả ngày', ja: '24時間営業' };

/**
 * One day's hours, printed on the app's own clock.
 *
 * The rows used to be Google's string handed straight back — "8:00 AM –
 * 11:00 PM", in English, under a Vietnamese heading, beside a plan the app
 * had printed as "09:00". Rebuilt from the parse instead, so the whole
 * screen keeps one clock; see `clockOf` for why that clock is 24-hour.
 *
 * A shape the parser does not know falls back to Google's own text. That
 * is the same trade `openState` makes: the raw line is at worst awkward,
 * where a blank row or an invented guess is worse than awkward.
 */
function hoursText(raw: string, lang: string): string {
  const windows = parseDay(raw);
  if (windows === null) return raw;
  if (!windows.length) return pick(CLOSED, lang);
  if (windows.length === 1 && windows[0].to - windows[0].from >= DAY) return pick(ALL_DAY, lang);
  return windows.map((w) => `${clockOf(w.from)}–${clockOf(w.to)}`).join(', ');
}

export type HourRow = { label: string; hours: string };

/**
 * Collapse runs of days that keep the same hours.
 *
 * Seven rows saying "07:30–15:00" seven times is a wall of repetition that
 * hides the one line a reader is looking for — the day that differs.
 * Grouped, the exception is the only thing with its own row.
 *
 * Only *consecutive* days merge. Monday and Wednesday sharing hours while
 * Tuesday differs is three groups, not two: a label reading "Mon, Wed"
 * would be true, and a reader scanning for today would have to parse it.
 *
 * Days are compared on their *printed* hours rather than on Google's raw
 * text, which is a distinction with a case behind it: "5:00 – 10:00 PM"
 * and "5:00 PM – 10:00 PM" are the same afternoon written two ways, and
 * grouping on the raw strings would split them into two rows saying the
 * same thing.
 */
export function groupHours(lines: string[], lang = 'en'): HourRow[] {
  const rows: HourRow[] = [];
  for (const line of lines) {
    const [day, raw] = splitHours(line);
    const short = SHORT_DAY[day] ? pick(SHORT_DAY[day], lang) : day;
    const hours = hoursText(raw, lang);
    const last = rows[rows.length - 1];
    // Runs are tracked by rewriting the last label rather than by keeping
    // a start/end pair, so a group of two reads "Mon–Tue" and a group of
    // one never grows a dash it does not need.
    if (last && last.hours === hours) last.label = `${last.label.split('–')[0]}–${short}`;
    else rows.push({ label: short, hours });
  }
  return rows;
}

/**
 * Whether a place is open at a given moment, and until when.
 *
 * Everything here is derived from the same `weekdayDescriptions` strings
 * the rows below are drawn from, rather than from Google's structured
 * `periods`. The import already asks for `regularOpeningHours` and throws
 * the periods away, so using them would mean a column, a migration and a
 * re-import of every place before a single row could answer the question.
 * The strings are already in the database, and their grammar turns out to
 * be small: across the whole catalogue there are seven shapes, all of them
 * handled below. The trade is that a shape nobody has seen yet reads as
 * "no answer" rather than as a wrong one.
 */

/** Vietnam keeps UTC+7 all year and has run no DST since 1975, and every
 *  city in the app is in it — so the place's local time is arithmetic
 *  rather than a timezone database the runtime may not carry. */
const ICT_OFFSET_MIN = 7 * 60;
const DAY = 24 * 60;

/**
 * A single opening window, in minutes from the day's midnight. `to` runs
 * past 1440 when the window crosses into the next day.
 *
 * Minutes only. Google's own strings used to ride along so a screen could
 * print them back — which is how "9:00 PM" ended up under a Vietnamese
 * card. The parse below already resolves both ends to minutes; printing
 * from those and not from the raw text is what makes one formatter
 * possible.
 */
type Window = { from: number; to: number };

/**
 * "8:00 AM" → 480. A missing meridiem returns null for it: Google drops
 * the one on the opening time when it matches the closing time, as in
 * "4:00 – 8:50 PM", so the caller fills it in from the other end.
 */
function parseTime(s: string): { mins: number; mer: 'AM' | 'PM' | null } | null {
  const m = /^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 12 || min > 59) return null;
  const mer = m[3] ? (m[3].toUpperCase() as 'AM' | 'PM') : null;
  return { mins: (h % 12) * 60 + min, mer };
}

/** The windows in one day's description, or null if it does not parse. */
function parseDay(hours: string): Window[] | null {
  const text = hours.trim();
  if (!text) return null;
  if (/^closed$/i.test(text)) return [];
  if (/^open 24 hours$/i.test(text)) return [{ from: 0, to: DAY }];

  const out: Window[] = [];
  for (const part of text.split(',')) {
    const [rawFrom, rawTo] = part.split(/[–-]/).map((x) => x.trim());
    if (!rawTo) return null;
    const a = parseTime(rawFrom);
    const b = parseTime(rawTo);
    // The closing time always carries its own meridiem; the opening one
    // may borrow it. Neither may be missing outright.
    if (!a || !b || !b.mer) return null;
    const mer = a.mer ?? b.mer;
    let from = a.mins + (mer === 'PM' ? 12 * 60 : 0);
    let to = b.mins + (b.mer === 'PM' ? 12 * 60 : 0);
    // Closing at or before opening means the window runs past midnight —
    // a 7 PM bar closing at 1 AM, or one closing at 12 AM exactly.
    if (to <= from) to += DAY;
    out.push({ from, to });
  }
  return out;
}

/**
 * The instant at `minutes` past midnight on `day`, read on the catalog's
 * own clock.
 *
 * Exists so a planner can ask `openState` about seven in the evening next
 * Saturday. Building that Date at the call site would mean either copying
 * `ICT_OFFSET_MIN` — a constant with one right home — or going through the
 * device's offset, and the device is in New York for one of the two clocks
 * the test suite runs on.
 *
 * Null for anything that is not a real day, including "2026-02-30", which
 * `Date.UTC` would roll forward to the 2nd of March rather than refuse.
 */
export function instantOn(day: string, minutes: number): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // The day is checked at midnight and `minutes` added afterwards, in that
  // order and not the other way round. Building the instant first and
  // validating it is what the first version did, and it refused every
  // evening on the last day of a month that ran past midnight: 25:00 on
  // the 31st reads back as the 1st, which is a real hour and looked like
  // an overflow. The reader saw no error — `openAt` treats null as
  // "unknown", so those stops silently stopped being checked against
  // opening hours at all.
  const midnight = new Date(Date.UTC(y, mo - 1, d, 0, -ICT_OFFSET_MIN));
  // Read back on the clock the day was written on, undoing the shift
  // first — otherwise midnight ICT is 17:00 the day before in UTC and
  // every date in the catalog looks invalid.
  const back = new Date(midnight.getTime() + ICT_OFFSET_MIN * 60_000);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) {
    return null;
  }
  return new Date(midnight.getTime() + minutes * 60_000);
}

/**
 * Whether a place is open, and the hour that changes it — in minutes past
 * midnight, for `clockOf` to print. `untilMin` runs past 1440 for a bar
 * that closes at one in the morning, which `clockOf` wraps.
 */
export type OpenState = { open: boolean; untilMin?: number; opensAtMin?: number };

/**
 * `null` when the question cannot be answered — no hours stored, or a
 * description in a shape this does not read. Showing nothing beats showing
 * "Closed" to someone standing in the doorway of an open café.
 *
 * `now` is injected so this is a pure function of its inputs; the screen
 * passes the real clock.
 */
export function openState(lines: string[] | null | undefined, now: Date): OpenState | null {
  if (!lines?.length) return null;
  // Shift onto the place's clock, then read the shifted instant in UTC —
  // the local accessors would apply the device's offset a second time.
  const local = new Date(now.getTime() + ICT_OFFSET_MIN * 60_000);
  const mins = local.getUTCHours() * 60 + local.getUTCMinutes();
  // Google's week starts on Monday; JavaScript's on Sunday.
  const today = (local.getUTCDay() + 6) % 7;

  const dayAt = (i: number) => {
    const line = lines[((i % lines.length) + lines.length) % lines.length];
    return line === undefined ? null : parseDay(splitHours(line)[1]);
  };

  const wins = dayAt(today);
  if (!wins) return null;

  for (const w of wins) {
    if (mins >= w.from && mins < w.to) {
      // A place open around the clock has no closing time worth naming.
      return w.to - w.from >= DAY ? { open: true } : { open: true, untilMin: w.to };
    }
  }

  // Still inside a window that opened yesterday — at half past midnight
  // the bar that opened at 7 PM is open, and today's line does not say so.
  const before = dayAt(today - 1);
  for (const w of before ?? []) {
    if (w.to > DAY && mins + DAY < w.to) {
      return w.to - w.from >= DAY ? { open: true } : { open: true, untilMin: w.to };
    }
  }

  // Closed, but say when that changes if it changes today.
  const next = wins.filter((w) => w.from > mins).sort((a, b) => a.from - b.from)[0];
  return next ? { open: false, opensAtMin: next.from } : { open: false };
}
