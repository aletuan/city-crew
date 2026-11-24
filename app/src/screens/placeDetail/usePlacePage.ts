// Which place this page is about, and the page of its photographs the
// reader is on.
//
// Out of PlaceDetailScreen since 24 Nov 2026. Finding the place — the
// catalog first, then the one-off fetch for a place in another city, then
// its full set of photographs — was 17 of the screen's complexity, every
// "is it in the catalog yet" a branch of the screen's one function, and
// the screen did nothing with it but wait for the answer. The lines were
// moved, not retyped; their order of hooks is their own now and the same
// on every render.
import { useEffect, useMemo, useState } from 'react';
import { usePlaces } from '../../lib/catalog';
import { coverOf, photosOf, usePlaceBySlug, usePlacePhotos, withPhotos, type Place } from '../../lib/data';
import { useNoteEvent } from '../../lib/tasteProfile';

/** The place for `slug`, `undefined` until (or unless) it is found, and
 *  whether anything is still being asked. Notes the opening once it is. */
export function usePlaceLookup(slug: string): { place: Place | undefined; loading: boolean } {
  const { loading: catalogLoading, data: places } = usePlaces();
  const inCatalog = useMemo(
    () => places.find((p) => p.slug === slug),
    [places, slug],
  );
  // A place reached through a collection can be in another city, and the
  // catalog is one city's worth. Asked for only when the catalog missed,
  // and only once the catalog has actually settled — asking while it is
  // still loading would fire a request for every place you open.
  const elsewhere = usePlaceBySlug(!catalogLoading && !inCatalog ? slug : null);
  // The catalog carries one photograph a place, and the carousel wants
  // them all — asked for on opening, while the cover is already on
  // screen. A place from elsewhere came with its own set and asks nothing.
  // The catalog's row is the stamp: when it reloads after the gallery,
  // the set is asked for again (`usePlacePhotos`, `withPhotos`).
  const allPhotos = usePlacePhotos(inCatalog ? [inCatalog.slug] : null, inCatalog);
  const place = useMemo(
    () => (inCatalog ? withPhotos(inCatalog, allPhotos.data[inCatalog.slug]) : elsewhere.data ?? undefined),
    [inCatalog, allPhotos.data, elsewhere.data],
  );
  const loading = catalogLoading || elsewhere.loading;

  // Opening a place is the one signal the app has to observe for itself:
  // everything else the reader tells us out loud. Noted once per visit and
  // only for a place that actually resolved — a screen that spent its whole
  // life on the spinner is not somebody looking at a café.
  //
  // Above the two early returns, because a hook cannot live below one. It
  // does nothing until `place` arrives, which is what the guard inside says.
  const note = useNoteEvent();
  useEffect(() => {
    if (place) note(place.slug, 'open');
  // One event per place, not per re-render: `place` is a new object whenever the catalog reloads
  // and the slug is what identifies the visit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.slug, note]);
  return { place, loading };
}

/** The photograph the carousel is on, put back to the first when the
 *  cover or the number of photographs changes under the reader; and the
 *  key that change is read from, which the carousel is keyed on too, and
 *  the cover itself, which the check-in's note sheet shows. */
export function usePhotoPage(place: Place | undefined): {
  photoIndex: number; setPhotoIndex: (i: number) => void; pageKey: string; coverUri: string | null;
} {
  const [photoIndex, setPhotoIndex] = useState(0);
  // Back to the first page when the cover changes under the reader. The
  // gallery is opened from this screen, and the way a keeper picks a new
  // cover is by swiping here first: they find the picture on page 5, set
  // it, and come back. The catalog reloads and puts it first — while the
  // carousel stays on page 5, now showing somebody else, with "5 / 6"
  // still under it. The screen looked as if the change had not taken.
  // Reset during render rather than in an effect, so the stale page is
  // never painted; the carousel below is keyed on the same value so the
  // native scroll offset starts over too.
  //
  // And when the number of photographs changes (23 Oct 2026): the owner
  // swiped to a late page, deleted photographs in the gallery, and came
  // back to a page that no longer existed — the carousel now keeps its
  // own reading in range, but the strip should start over all the same,
  // as it does for a new cover.
  const coverUri = place ? coverOf(place)?.photo_uri ?? null : null;
  const pageKey = `${coverUri ?? 'no-cover'}|${place ? photosOf(place).length : 0}`;
  const [pagedFor, setPagedFor] = useState(pageKey);
  if (pagedFor !== pageKey) {
    setPagedFor(pageKey);
    setPhotoIndex(0);
  }
  return { photoIndex, setPhotoIndex, pageKey, coverUri };
}
