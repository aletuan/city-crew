// Which cities a search answers from, and how the reader chooses them.
//
// ── what the owner asked for (22 Oct 2026) ──
//
// Search answered from the city on screen and nowhere else, so a place the
// reader could name, in a city they were not looking at, was not found. Now
// every city answers, under a row of chips that says how many places each
// one found and lets the reader choose which to see:
//
// - The reader's own city comes first and is the one chosen to start with.
//   Typing "bold" in Hanoi shows Hanoi's Bold Brews, and says that Saigon
//   has four more.
// - More than one can be chosen; their places are shown together.
// - "All" chooses every one.
//
// ── the rules the owner settled (same day) ──
//
// - A chip only for a city that found something, most first, the reader's
//   own city first whatever it found: it is the one chosen, and the empty
//   screen under it says "nothing in Hanoi", which needs its chip there to
//   be read against.
// - "All" first, the reader's city after it (owner, the same evening, on
//   the phone): All is the whole of what the cities hold, and the cities
//   are its parts. It was second, beside the reader's city, on the reading
//   that the default should lead; the owner read the row as a total and
//   its parts, which wants the total first.
// - The places in the order of the chips: the reader's city's first, then
//   each other city's, most found first. A mixed list ranked by match
//   alone put a Saigon café above the Hanoi one the reader was standing
//   near.
// - The last chosen city cannot be put down. A choice of nothing would be
//   a search of nowhere; the tap does nothing and the chip stays lit.
// - A city tapped while "All" is chosen becomes the only one: from every
//   city to one is what that tap means, never "every city but this one".
// - Nothing switches by itself. When the reader's city finds nothing and
//   others do, the screen says so and the chips are there to tap; it does
//   not choose for them.
// - The row stands from the first letter to the last, whatever was found
//   (owner, the same evening). It was left out when every place found was
//   at home, on the reading that "All (6) · Hanoi (6)" says nothing; on
//   the phone it came and went between keystrokes and the list jumped a
//   row each time, which says less. It also says, while it stands, which
//   city the list is from.
// - A chosen city keeps its chip, found nothing or not, or new words could
//   strand the reader in a city with no chip left to leave it by.

/** The cities chosen: some, by id, or every one. Never an empty list. */
export type CityPick = 'all' | readonly string[];

/** How many places a search found in each city. */
export function countByCity(found: readonly { city_id?: string | null }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of found) if (p.city_id) out.set(p.city_id, (out.get(p.city_id) ?? 0) + 1);
  return out;
}

/**
 * The cities' chips in their order: `home` first, whatever it found, then
 * every other city that found something or is chosen, most first, ties by
 * id so the row holds still between keystrokes. "All" is drawn before
 * them all by the screen.
 */
export function cityChips(counts: ReadonlyMap<string, number>, home: string, pick: CityPick): { id: string; count: number }[] {
  const chosen = pick === 'all' ? [] : pick;
  const found = new Map(counts);
  for (const id of chosen) if (!found.has(id)) found.set(id, 0);
  const rest = [...found].filter(([id]) => id !== home)
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .map(([id, count]) => ({ id, count }));
  return [{ id: home, count: counts.get(home) ?? 0 }, ...rest];
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

/**
 * A city's chip, tapped. Answers `pick` itself, the same object, when the
 * tap changes nothing — the last chosen city put down — so the screen can
 * tell that tap from one that did something.
 */
export function tapCity(pick: CityPick, id: string): CityPick {
  if (pick === 'all') return [id];
  if (!pick.includes(id)) return [...pick, id];
  return pick.length === 1 ? pick : pick.filter((c) => c !== id);
}

/** Whether a place in `cityId` is among the chosen. */
export function picked(pick: CityPick, cityId: string | null | undefined): boolean {
  return pick === 'all' || (!!cityId && pick.includes(cityId));
}

/** Whether more than one city's places can be on screen, so each card
 *  says which city it is in (owner, 22 Oct 2026). */
export function namesCities(pick: CityPick): boolean {
  return pick === 'all' || pick.length > 1;
}
