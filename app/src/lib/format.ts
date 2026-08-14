// Small format helpers pulled out of the place-detail screen so they can
// be tested in a plain Node process — the screen itself imports React
// Native, which a test runner cannot load.

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
