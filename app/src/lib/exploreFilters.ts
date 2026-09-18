import { categoriesOf } from './categories';
import type { Place } from './data';
import { openState } from './format';
import { distanceKm } from './geo';

export type ExploreSort = 'recommended' | 'distance' | 'rating';
export type ExploreStatus = 'any' | 'open' | 'closed';

export type ExploreFilters = {
  sort: ExploreSort;
  status: ExploreStatus;
  savedOnly: boolean;
};

export type ExploreOrigin = { lat: number; lng: number };

/**
 * Apply Explore's explicit controls to an already recommendation-ranked
 * catalog. Keeping the recommended order as the input means the default is
 * exactly the feed that existed before filters, and gives every explicit
 * sort a deterministic tie-breaker.
 */
export function filterExplorePlaces(
  recommended: readonly Place[],
  options: ExploreFilters & {
    category: string;
    allCategory: string;
    origin: ExploreOrigin | null;
    isSaved: (slug: string) => boolean;
    now: Date;
  },
): Place[] {
  const indexed = recommended
    .map((place, rank) => ({ place, rank }))
    .filter(({ place }) => (
      (options.category === options.allCategory || categoriesOf(place).includes(options.category))
      && (options.status === 'any'
        || openState(place.opening_hours, options.now)?.open === (options.status === 'open'))
      && (!options.savedOnly || options.isSaved(place.slug))
    ));

  if (options.sort === 'rating') {
    // Score first, then how many people said so.
    //
    // A rating is two numbers pretending to be one: 4.8 from nine people
    // and 4.8 from nine hundred are not the same claim, and the catalog
    // is full of exact ties because a five-star place with a handful of
    // votes scores like a five-star place with a thousand. Sorting on the
    // score alone left those ties to whatever order the rows arrived in.
    //
    // No reviews counts as none of them rather than as unrated — the row
    // is already below anything with a score, and among equal scores the
    // one nobody has voted on is the weaker claim.
    const votes = (p: Place) => p.rating_count ?? 0;
    indexed.sort((a, b) => (b.place.rating ?? -Infinity) - (a.place.rating ?? -Infinity)
      || votes(b.place) - votes(a.place)
      || a.rank - b.rank);
  } else if (options.sort === 'distance' && options.origin) {
    const away = (place: Place) => place.lat == null || place.lng == null
      ? Infinity
      : distanceKm(options.origin!.lat, options.origin!.lng, place.lat, place.lng);
    indexed.sort((a, b) => away(a.place) - away(b.place) || a.rank - b.rank);
  }

  return indexed.map(({ place }) => place);
}
