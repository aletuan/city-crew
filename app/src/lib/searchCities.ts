// Which cities a search answers from, and how the reader chooses them.
//
// ── what the owner asked for (22 Oct 2026) ──
//
// Search answered from the city on screen and nowhere else, so a place the
// reader could name, in a city they were not looking at, was not found. Now
// every city answers, under a row of chips that says how many places each
// one found and lets the reader choose which to see:
//
// - The reader's own city comes first.
// - "All" chooses every one.
//
// ── one city at a time, and All to start (owner, 24 Oct 2026) ──
//
// It started on the reader's own city, and more than one city could be
// chosen at once. The owner took both back two days later, with the
// multiple choice on every filter in the app: a search starts on All,
// whatever city the reader is in, and a city chip is one city — tapping
// another moves to it, tapping the chosen one goes back to All. A place
// typed by name is the place wanted, wherever it is; narrowing to a city
// is something the reader does, not something done for them.
//
// ── the rules the owner settled (22 Oct, and still standing) ──
//
// - A chip only for a city that found something, most first, the reader's
//   own city first when it found anything. Until 24 Oct the reader's city
//   kept its chip whatever it found, because it was the one chosen and
//   "nothing in Hanoi" needed its chip to be read against; nothing is
//   chosen for the reader now, so an empty chip would only offer an
//   empty screen.
// - "All" first, the reader's city after it (owner, the same evening, on
//   the phone): All is the whole of what the cities hold, and the cities
//   are its parts.
// - The places in the order of the chips: the reader's city's first, then
//   each other city's, most found first. A mixed list ranked by match
//   alone put a Saigon café above the Hanoi one the reader was standing
//   near.
// - Nothing switches by itself. When the chosen city finds nothing and
//   others do, the screen says so and the chips are there to tap; it does
//   not choose for them.
// - The row stands from the first letter to the last, whatever was found
//   (owner, the same evening): on the phone a row that came and went
//   between keystrokes made the list jump.
// - A chosen city keeps its chip, found nothing or not, or new words could
//   strand the reader in a city with no chip left to leave it by.

/** The city chosen, as a list of one, or every one. Never an empty list.
 *  A list rather than an id because the rows ask "which cities", and one
 *  city at a time is a rule about the chips, not about the rows. */
export type CityPick = 'all' | readonly string[];

/** How many places a search found in each city. */
export function countByCity(found: readonly { city_id?: string | null }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of found) if (p.city_id) out.set(p.city_id, (out.get(p.city_id) ?? 0) + 1);
  return out;
}

/**
 * The cities' chips in their order: every city that found something or is
 * chosen, `home` first among them, the rest most first, ties by id so the
 * row holds still between keystrokes. "All" is drawn before them all by
 * the screen.
 */
export function cityChips(counts: ReadonlyMap<string, number>, home: string, pick: CityPick): { id: string; count: number }[] {
  const chosen = pick === 'all' ? [] : pick;
  const found = new Map(counts);
  for (const id of chosen) if (!found.has(id)) found.set(id, 0);
  const rest = [...found].filter(([id]) => id !== home)
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .map(([id, count]) => ({ id, count }));
  return found.has(home) ? [{ id: home, count: found.get(home)! }, ...rest] : rest;
}

/**
 * `places` in the chips' order of their cities, each city's in the order
 * they came: a stable sort, so the match's own ranking holds within a
 * city. A city not in `order` goes last.
 */
export function byCity<T extends { city_id?: string | null }>(places: readonly T[], order: readonly string[]): T[] {
  const rank = (p: T) => {
    const i = p.city_id ? order.indexOf(p.city_id) : -1;
    return i < 0 ? order.length : i;
  };
  return [...places].sort((a, b) => rank(a) - rank(b));
}

/** Every place the cities found, all chips together: "All"'s figure. */
export function totalFound(counts: ReadonlyMap<string, number>): number {
  let n = 0;
  for (const c of counts.values()) n += c;
  return n;
}

/** A city's chip, tapped: that city alone, or All again when it was the
 *  one chosen — the chip lets go, as every filter chip in the app does. */
export function tapCity(pick: CityPick, id: string): CityPick {
  return pick !== 'all' && pick[0] === id ? 'all' : [id];
}

/** Whether a place in `cityId` is among the chosen. */
export function picked(pick: CityPick, cityId: string | null | undefined): boolean {
  return pick === 'all' || (!!cityId && pick.includes(cityId));
}

/** Whether more than one city's places can be on screen, so each card
 *  says which city it is in (owner, 22 Oct 2026): under All. */
export function namesCities(pick: CityPick): boolean {
  return pick === 'all';
}
