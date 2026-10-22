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
// - "All" second, not first and not last: beside the reader's city, so the
//   default and the way out of it are both on screen without a swipe.
// - The last chosen city cannot be put down. A choice of nothing would be
//   a search of nowhere; the tap does nothing and the chip stays lit.
// - A city tapped while "All" is chosen becomes the only one: from every
//   city to one is what that tap means, never "every city but this one".
// - Nothing switches by itself. When the reader's city finds nothing and
//   others do, the screen says so and the chips are there to tap; it does
//   not choose for them.
// - No row at all when every place found is in the reader's own city. A
//   row of "Hanoi 6 · All 6" says nothing — unless the reader has chosen
//   elsewhere: a chosen city keeps its chip, found nothing or not, or new
//   words could strand them in a city with no chip left to leave it by.

/** The cities chosen: some, by id, or every one. Never an empty list. */
export type CityPick = 'all' | readonly string[];

/** How many places a search found in each city. */
export function countByCity(found: readonly { city_id?: string | null }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of found) if (p.city_id) out.set(p.city_id, (out.get(p.city_id) ?? 0) + 1);
  return out;
}

/** Whether the row of chips is worth a line: something found beyond
 *  `home`, or a choice beyond home to be undone. */
export function chipsWorthShowing(counts: ReadonlyMap<string, number>, home: string, pick: CityPick): boolean {
  if (pick === 'all' || pick.some((id) => id !== home)) return true;
  for (const id of counts.keys()) if (id !== home) return true;
  return false;
}

/**
 * The cities' chips in their order: `home` first, whatever it found, then
 * every other city that found something or is chosen, most first, ties by
 * id so the row holds still between keystrokes. "All" is drawn between the
 * first and the rest by the screen.
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
