// Reads that mean "every row", past the server's cap on one answer.
//
// Within the data layer only: a screen asks for a thing, never for a page.

/**
 * The most rows this project's PostgREST answers to one request
 * (`max-rows`), whatever the request asked for. Measured 22 Oct 2026: a
 * read of the 1,109 live places came back with 1,000 and
 * `content-range: 0-999/1109`, and so did one that asked for 2,000. It
 * is not an error, and nothing says so but that header.
 *
 * The catalog crossed it unnoticed. The map's index asked for every place
 * in one request and was handed the first thousand: Melbourne was counted
 * at 61 of its 83 places, Saigon at 373 of 408, and the city switcher's
 * counts with them. One reader's history had passed it too, at 1,991
 * events, so the export of what we hold about them stopped at a thousand.
 * A read that means "every row" goes through `everyPage` now.
 */
export const PAGE_ROWS = 1000;

/**
 * Every row of a read, a page of `PAGE_ROWS` at a time, until a page
 * comes back short. `page` asks for rows `from` to `to`, both ends in,
 * and must order them by something unique, or a row can fall between two
 * pages or be on both.
 */
export async function everyPage<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  let rows: T[];
  do {
    // Each page before this one was full, so what has been read is where
    // the next page starts.
    const { data, error } = await page(out.length, out.length + PAGE_ROWS - 1);
    if (error) throw new Error(error.message);
    rows = (data ?? []) as T[];
    out.push(...rows);
  } while (rows.length === PAGE_ROWS);
  return out;
}
