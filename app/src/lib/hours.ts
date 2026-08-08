// Open-now from Google's weekdayDescriptions strings, e.g.
// "Tuesday: 8:00 AM – 11:00 PM", "Monday: Closed", "Friday: Open 24 hours",
// possibly with multiple comma-separated ranges and unicode spaces/dashes.
// Anything unparseable degrades to 'unknown' — never a wrong badge.

export type OpenState = 'open' | 'closed' | 'unknown';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type Ranges = Array<[number, number]> | 'always' | 'closed' | null;

/** Minutes-of-day pairs from the text after "Day: ". */
function parseRanges(text: string): Ranges {
  const t = text.trim();
  if (/open 24 hours/i.test(t)) return 'always';
  if (/^closed/i.test(t)) return 'closed';
  const times = [...t.matchAll(/(\d{1,2}):(\d{2})[\s   ]*(AM|PM)/gi)];
  if (times.length < 2 || times.length % 2 !== 0) return null;
  const mins = times.map((m) => {
    let h = parseInt(m[1], 10) % 12;
    if (/pm/i.test(m[3])) h += 12;
    return h * 60 + parseInt(m[2], 10);
  });
  const out: Array<[number, number]> = [];
  for (let i = 0; i < mins.length; i += 2) out.push([mins[i], mins[i + 1]]);
  return out;
}

function lineFor(hours: string[], dayIdx: number): string | undefined {
  const prefix = `${DAYS[dayIdx]}:`;
  const line = hours.find((l) => l.startsWith(prefix));
  return line?.slice(prefix.length);
}

export function openState(hours: string[] | null | undefined, now: Date = new Date()): OpenState {
  if (!hours || hours.length === 0) return 'unknown';
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const today = lineFor(hours, now.getDay());
  if (today === undefined) return 'unknown';
  const ranges = parseRanges(today);
  if (ranges === 'always') return 'open';
  if (ranges === null) return 'unknown';
  if (ranges !== 'closed') {
    for (const [start, end] of ranges) {
      // An end at/before the start means the range runs past midnight.
      if (end > start ? nowMin >= start && nowMin < end : nowMin >= start) return 'open';
    }
  }

  // Early hours can still belong to yesterday's overnight range.
  const yesterday = lineFor(hours, (now.getDay() + 6) % 7);
  if (yesterday !== undefined) {
    const yr = parseRanges(yesterday);
    if (Array.isArray(yr)) {
      for (const [start, end] of yr) {
        if (end <= start && nowMin < end) return 'open';
      }
    }
  }
  return 'closed';
}
