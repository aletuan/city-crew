// Out of `GalleryScreen` on 27 Nov 2026, so the screen's function fits the
// ceiling (`oversize.js`); the reasoning moved with the code, unchanged.

import { useMemo } from 'react';
import { useCollections, usePlaces } from '../../lib/catalog';
import { useMyCheckins } from '../../lib/checkins';
import { fetchSearchPlaces, usePlaceBySlug } from '../../lib/data';
import { canKeepGallery } from '../../lib/gallery';
import { useMyTrips } from '../../lib/mytrips';
import { useMyLists } from '../../lib/save';
import { refreshInSearchIndex } from '../../lib/searchIndex';
import { useIsEditor, useIsGuide } from '../../lib/useGuideGrant';

/** The place whose gallery this is, whether the reader may keep it, and
 *  every other copy of its cover to read again on the way out. */
export function useGalleryPlace(slug: string, uid: string | null) {
  // The place, for its name and its `submitted_by`. From the catalog when
  // it is there, and by its own fetch when it is not — a place still
  // waiting at the desk is exactly where this screen is most useful, and
  // that one is not in the catalog. Same two-step `PlaceDetail` takes.
  const { loading: catalogLoading, data: places, reload: reloadPlaces } = usePlaces();
  const { reload: reloadLists } = useCollections();
  const mine = useMyLists();
  // Everything on screen that draws this place's photographs, read again
  // once the guide leaves (see `dirty` below). Not only the catalog: a collection carries its places
  // embedded whole (`withMembers`), photographs and all, so a list holding
  // this place kept its old cover until something reloaded the lists —
  // Royal Botanic Gardens' new cover showed on its own page and not in
  // the collection beside it (owner, 15 Oct 2026). Both shelves, the
  // public lists and the reader's own, since a place can be in either.
  //
  // And every other copy of the place's cover held for the run (owner,
  // 3 Nov 2026: Hermanos café's new cover, and Search still drew the old
  // one). Search's index is kept in memory for the run, so only this place's
  // row is read again and laid over the old one — a few hundred bytes, not
  // the 420 kB index. The trips and the check-ins carry each place's cover
  // in their own lists, read once a launch; they are read again too. A
  // failed read leaves the old row: the next launch reads the index anew.
  const trips = useMyTrips();
  const visits = useMyCheckins();
  const reloadCatalog = () => {
    reloadPlaces(); reloadLists(); mine.reload(); trips.reload(); visits.reload();
    if (slug) fetchSearchPlaces([slug]).then(refreshInSearchIndex, () => {});
  };
  const inCatalog = useMemo(() => places.find((p) => p.slug === slug), [places, slug]);
  const elsewhere = usePlaceBySlug(!catalogLoading && !inCatalog ? slug : null);
  const place = inCatalog ?? elsewhere.data ?? null;
  // Asked after the place, because the grant is per city now and the
  // city is the place's. While it is still loading this reads as "no
  // city", which only an all-cities grant answers yes to — and the
  // boundary below is closed anyway until the place arrives.
  const granted = useIsGuide(place?.city_id);
  const editor = useIsEditor();
  const me = useMemo(() => ({ uid, granted, editor }), [uid, granted, editor]);
  const mayKeep = place ? canKeepGallery(place, me) : false;
  return { place, loading: catalogLoading || elsewhere.loading, mayKeep, reloadCatalog };
}
