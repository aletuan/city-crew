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
 * Google's weekday strings, in short form.
 *
 * A map rather than `slice(0, 3)`: the day names are whatever language the
 * Places API replied in, and three characters of "Thứ Năm" is "Thứ" for
 * every day of the week. Today we never ask for another language, so this
 * table always hits — and on the day we do, an unknown name keeps its full
 * spelling instead of collapsing into its neighbours.
 */
const SHORT_DAY: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
};

export type HourRow = { label: string; hours: string };

/**
 * Collapse runs of days that keep the same hours.
 *
 * Seven rows saying "7:30 AM – 3:00 PM" seven times is a wall of
 * repetition that hides the one line a reader is looking for — the day
 * that differs. Grouped, the exception is the only thing with its own row.
 *
 * Only *consecutive* days merge. Monday and Wednesday sharing hours while
 * Tuesday differs is three groups, not two: a label reading "Mon, Wed"
 * would be true, and a reader scanning for today would have to parse it.
 */
export function groupHours(lines: string[]): HourRow[] {
  const rows: HourRow[] = [];
  for (const line of lines) {
    const [day, hours] = splitHours(line);
    const short = SHORT_DAY[day] ?? day;
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

/** A single opening window, in minutes from the day's midnight. `to` runs
 *  past 1440 when the window crosses into the next day. */
type Window = { from: number; to: number; opens: string; closes: string };

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
  if (/^open 24 hours$/i.test(text)) return [{ from: 0, to: DAY, opens: '', closes: '' }];

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
    out.push({ from, to, opens: rawFrom, closes: rawTo });
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
  const out = new Date(Date.UTC(y, mo - 1, d, 0, minutes - ICT_OFFSET_MIN));
  // Read the rolled-over value back on the same clock the day was written
  // on, undoing the shift first — otherwise a morning slot before 07:00
  // ICT reports the previous day and every date looks invalid.
  const back = new Date(out.getTime() + ICT_OFFSET_MIN * 60_000);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1) return null;
  // `minutes` may legitimately run past midnight — a bar closing at 1am is
  // 1500 — so only the month and year are checked for overflow.
  return out;
}

export type OpenState = { open: boolean; until?: string; opensAt?: string };

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
      return w.to - w.from >= DAY ? { open: true } : { open: true, until: w.closes };
    }
  }

  // Still inside a window that opened yesterday — at half past midnight
  // the bar that opened at 7 PM is open, and today's line does not say so.
  const before = dayAt(today - 1);
  for (const w of before ?? []) {
    if (w.to > DAY && mins + DAY < w.to) {
      return w.to - w.from >= DAY ? { open: true } : { open: true, until: w.closes };
    }
  }

  // Closed, but say when that changes if it changes today.
  const next = wins.filter((w) => w.from > mins).sort((a, b) => a.from - b.from)[0];
  return next ? { open: false, opensAt: next.opens } : { open: false };
}
