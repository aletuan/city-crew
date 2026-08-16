// When a list the app is already holding has gone old enough to ask again.
//
// The catalog is fetched once per launch and then only when the city, the
// account, or a pull-to-refresh says so. Nothing asked again when the app
// came back from the background — so a place the desk deleted while the
// phone was in a pocket stayed on screen until the reader thought to pull
// down, which is a thing no reader thinks to do.
//
// Foreground is the right moment because it is the closest thing to "the
// reader has come back", and a threshold is what keeps it from being a
// request every time a notification shade closes: iOS sends `active` on
// its way out of every interruption, not only out of a real absence.
//
// Pure and here rather than in the provider so a Node process can reach
// it. The provider's job is subscribing to AppState; this one decides.

/** Two minutes. Long enough that glancing at the app twice costs one
 *  request, short enough that coming back to it after a coffee shows the
 *  catalog as it now is. */
export const STALE_MS = 2 * 60 * 1000;

/**
 * Should this be fetched again?
 *
 * `loadedAt` is when the last *successful* load landed, so a query that
 * has only ever failed reads as null and is retried — which is the right
 * answer for the reader who opened the app on a dead connection and has
 * now walked back into signal.
 *
 * A clock that has moved backwards since the load (a manual change, a
 * timezone-shifting flight, an NTP correction) makes the age negative.
 * That is not "fresh", it is "unknown", and one extra request is cheaper
 * than a list that can never refresh again until the app restarts.
 */
export function shouldRefresh(
  loadedAt: number | null | undefined,
  now: number,
  staleMs: number = STALE_MS,
): boolean {
  if (loadedAt == null) return true;
  const age = now - loadedAt;
  if (age < 0) return true;
  return age >= staleMs;
}
