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
    indexed.sort((a, b) => (b.place.rating ?? -Infinity) - (a.place.rating ?? -Infinity) || a.rank - b.rank);
  } else if (options.sort === 'distance' && options.origin) {
    const away = (place: Place) => place.lat == null || place.lng == null
      ? Infinity
      : distanceKm(options.origin!.lat, options.origin!.lng, place.lat, place.lng);
    indexed.sort((a, b) => away(a.place) - away(b.place) || a.rank - b.rank);
  }

  return indexed.map(({ place }) => place);
}
