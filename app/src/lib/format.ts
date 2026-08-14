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
