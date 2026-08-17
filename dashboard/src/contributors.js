// The arithmetic behind the Contributors screen, kept away from React so it
// can be read — and tested — as plain functions over plain rows.
//
// A row here is the thinnest possible fact: { added_by, city_id, created_at }
// for one place that came in through the mobile channel and made it all the
// way to approved *and* published. Everything on the screen — the cards, the
// cumulative lines, the leaderboard — is a different fold over the same rows,
// which is what keeps the four corners of the page agreeing with each other.

/** The three cities as the screen abbreviates them. `key` is the two-or-three
 *  letter mark the leaderboard breakdown uses (`hcm 17 · hn 6 · dn 3`) —
 *  lowercase mono shorthand, not a display name. */
export const CITY_META = [
  { id: 'hcmc', label: 'TP.HCM', key: 'hcm' },
  { id: 'hanoi', label: 'Hà Nội', key: 'hn' },
  { id: 'danang', label: 'Đà Nẵng', key: 'dn' },
];

export const TOP_N = 10;

/** One colour per leaderboard slot, top rank first. The colour belongs to the
 *  slot, so the chart line, its end dot and the board row always agree.
 *
 *  Validated with the dataviz palette checker against the desk's panel
 *  surface (#16131B): every adjacent pair clears the CVD floor (worst ΔE 8.2
 *  deutan) and the normal-vision floor (worst ΔE 15.4), all ten clear 3:1
 *  contrast. The steps sit brighter than the checker's reference lightness
 *  band on purpose — they are stepped to the desk's own neon tokens
 *  (--ai-pink and friends live at the same lightness), and every line is
 *  direct-labelled by its board row, dot and handle, never colour alone. */
export const SERIES_COLORS = [
  '#F05FC0', // 1 pink
  '#9B7BFF', // 2 violet
  '#F5AE60', // 3 amber
  '#45C8E0', // 4 teal
  '#1DBE5F', // 5 green
  '#CCE24F', // 6 lime
  '#FF8378', // 7 coral
  '#E8C06C', // 8 sand
  '#4B8BE8', // 9 blue
  '#F5AAD3', // 10 rose
];

const pad = (n) => String(n).padStart(2, '0');

/** Local calendar day, because "added on the 12th" means the editor's 12th,
 *  not UTC's. */
export const dayKey = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The last `days` local calendar days, oldest first, ending today. */
export function windowDays(days, today = new Date()) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

/** Cumulative count per window day. Rows are already query-bounded to the
 *  window, but clocks drift: anything that still lands outside is clamped to
 *  the nearest edge so every row the query returned is in the totals — a
 *  line whose end never matches its own card is worse than a day's blur. */
export function cumulativeByDay(rows, days) {
  const perDay = new Array(days.length).fill(0);
  const first = days[0];
  const last = days[days.length - 1];
  for (const r of rows) {
    const key = dayKey(new Date(r.created_at));
    let i = days.indexOf(key);
    if (i === -1) i = key < first ? 0 : days.length - 1;
    perDay[i] += 1;
  }
  let run = 0;
  return perDay.map((n) => (run += n));
}

/** Place count and distinct-contributor count for one set of rows. */
export function countStats(rows) {
  return { total: rows.length, contributors: new Set(rows.map((r) => r.added_by)).size };
}

export const scopeRows = (rows, cityId) =>
  cityId ? rows.filter((r) => r.city_id === cityId) : rows;

/**
 * Everything the chart and the leaderboard need for one scope (a city, or
 * all of them), computed together so they cannot disagree:
 *
 *   top        the top ten contributors within the scope — total desc,
 *              handle asc on ties, each with a per-city breakdown and a
 *              cumulative series aligned to `days`
 *   allSeries  the whole scope, cumulative — the dashed line
 *   total, contributors   the scope's card numbers
 *
 * The breakdown is computed on the *scoped* rows, so with a city picked the
 * row shows only that city's count — which is also then the ranking total.
 */
export function buildBoard(rows, profiles, days, cityId) {
  const scoped = scopeRows(rows, cityId);
  const byUser = new Map();
  for (const r of scoped) {
    if (!byUser.has(r.added_by)) byUser.set(r.added_by, []);
    byUser.get(r.added_by).push(r);
  }
  // The query already excludes null added_by; the String() is a belt for
  // any row that arrives without it anyway — a screen never crashes over
  // a missing caption.
  const handleOf = (id) => profiles[id]?.handle ?? String(id ?? 'unknown').slice(0, 8);
  const top = [...byUser.entries()]
    .map(([id, userRows]) => ({
      id,
      handle: handleOf(id),
      full_name: profiles[id]?.full_name ?? null,
      total: userRows.length,
      byCity: CITY_META.map(({ id: cid, key }) => ({
        key,
        count: userRows.filter((r) => r.city_id === cid).length,
      })).filter((c) => c.count > 0),
      series: cumulativeByDay(userRows, days),
    }))
    .sort((a, b) => b.total - a.total || a.handle.localeCompare(b.handle))
    .slice(0, TOP_N);
  return {
    top,
    allSeries: cumulativeByDay(scoped, days),
    ...countStats(scoped),
  };
}

/** Smallest 1/2/2.5/5×10ⁿ-stepped ceiling with `segments` divisions — so both
 *  axes land on round ticks (218 → 240 in three steps of 80, 26 → 30 in
 *  three steps of 10). Never collapses below one step of 1. */
export function niceMax(value, segments = 3) {
  if (value <= segments) return segments; // floor: whole-place steps of 1
  const raw = value / segments;
  const mag = 10 ** Math.floor(Math.log10(raw));
  // Wider than the textbook 1/2/5 set: three segments over a count like 218
  // should land on 80s (0 · 80 · 160 · 240), not leap to 100s. The 2.5×
  // step joins in only once it yields whole-number ticks — the axes count
  // places.
  const mults = mag >= 10 ? [1, 2, 2.5, 4, 5, 8, 10] : [1, 2, 4, 5, 8, 10];
  const step = mults.map((m) => m * mag).find((s) => s >= raw);
  return Math.ceil(segments * step);
}
