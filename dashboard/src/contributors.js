// The arithmetic behind the Contributors screen, kept away from React so it
// can be read — and tested — as plain functions over plain rows.
//
// A row here is the thinnest possible fact: { added_by, city_id, created_at }
// for one place that came in through the mobile channel and made it all the
// way to approved *and* published. Everything on the screen — the cards, the
// cumulative lines, the leaderboard — is a different fold over the same rows,
// which is what keeps the four corners of the page agreeing with each other.

/** The two-or-three letter mark the leaderboard breakdown prints
 *  (`hcm 17 · hn 6 · dn 3`) — lowercase mono shorthand, not a display name.
 *
 *  This used to be one field of a `CITY_META` list that also served as *the*
 *  list of cities, which is how the two analytics screens came to know about
 *  five cities while the rest of the desk knew about nine: a city added to
 *  the database appeared in Places and nowhere else. The list comes from the
 *  API now, the same as everywhere else, and what is left here is only the
 *  abbreviation — a typographic choice about a particular name, not a fact
 *  the database holds.
 *
 *  A city with no entry falls back to its id, which is long but true. */
export const CITY_KEY = {
  hcmc: 'hcm',
  hanoi: 'hn',
  danang: 'dn',
  dalat: 'dl',
  hue: 'hue',
};

export const shortKey = (id) => CITY_KEY[id] ?? String(id ?? '');

export const TOP_N = 10;

/* How far back the board looks. Here rather than in the screen because
   the page head now writes the sentence that quotes it, and two copies of
   a number that has to agree is how they stop agreeing. */
export const DAYS = 30;

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
      // Counted off the rows rather than walked down a list of cities, so
      // this fold needs to know nothing about which cities exist. Biggest
      // term first, because that is what a breakdown is read for.
      byCity: [...userRows.reduce(
        (m, r) => m.set(r.city_id, (m.get(r.city_id) ?? 0) + 1),
        new Map(),
      )]
        .map(([cid, count]) => ({ key: shortKey(cid), count }))
        .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
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

/**
 * What a grant covers, read for one person and one city.
 *
 * The grants arrive as a Map of user id to a Set of city ids, in which
 * `null` is a member like any other and means every city — the shape the
 * table itself uses, kept rather than flattened so the screen can tell
 * "a guide of Đà Nẵng" from "a guide everywhere" without a second query.
 *
 * `city` is null when the desk is set to all cities. That is not the same
 * question as "which cities is this person a guide of": with no city in
 * hand the box can only speak for the everywhere grant, so that is the
 * only thing it reports.
 *
 * `locked` is the case the box cannot express. Somebody granted every
 * city is a guide here too, so the box is ticked — but unticking it while
 * looking at one city would have to either revoke the lot (not what the
 * click looks like) or do nothing (a box that ignores you). It says so in
 * its title instead, and refuses the click.
 */
export function guideScope(grants, id, city) {
  const set = grants?.get(id);
  const everywhere = !!set?.has(null);
  const here = city != null && !!set?.has(city);
  return { on: everywhere || here, everywhere, locked: everywhere && city != null };
}

/**
 * The grants with one person's scope changed — a new Map, never the one
 * handed in.
 *
 * Extracted here rather than written inline in the screen for the reason
 * everything else in this file is here: it is a fold over plain values,
 * and the screen calls it twice with opposite answers — once to tick the
 * box before the write and once to put it back if the write is refused.
 * Those two calls are the whole of the optimistic update, and getting the
 * second one backwards leaves a box that lies about what the database
 * says.
 *
 * Turning it off with no city in hand clears every row for that person,
 * city grants included. It is the only reading that matches the control:
 * the box was ticked because they are a guide, and it has just been
 * unticked.
 *
 * `null` for the map covers the moment before the grants have loaded,
 * when nothing is known and a click should still be able to describe what
 * it wants.
 */
export function withGuide(grants, id, city, on) {
  const next = new Map(grants ?? []);
  const set = new Set(next.get(id) ?? []);
  if (on) set.add(city ?? null);
  else if (city == null) set.clear();
  else set.delete(city);
  if (set.size) next.set(id, set); else next.delete(id);
  return next;
}
