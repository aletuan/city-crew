// A place's gallery as its keeper works on it: the gallery's own read,
// and every write to it — make a cover, hide, show again, delete, score.
//
// Out of `GalleryScreen` on 23 Nov 2026. The screen was one of the nine
// that called the data layer's writes itself, four of them here, and the
// rule they all follow — draw the change at once, write it, read the
// gallery back after the last write — lived inside the function that
// draws the grid. It is one hook now. The screen keeps the grid, the
// sheets, the confirmation and the modes.
//
// The reasoning moved with the code unchanged.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { successHaptic } from '../../components/ui';
import { fetchGallery, fetchPlaceId, removePlacePhotos, savePhotoScore, setCover, setHidden } from '../../lib/data';
import { applyEdit, galleryOrder, type GalleryEdit, type GalleryPhoto } from '../../lib/gallery';
import type { useI18n } from '../../lib/i18n';
import { scoreAll, type PhotoScorer } from '../../lib/photoScore';
import type { Nav } from '../../nav';

const nextFrame = () => new Promise<void>((r) => { requestAnimationFrame(() => r()); });

export function useGalleryWrites({ slug, mayKeep, navigation, reloadCatalog, t }: {
  slug: string;
  /** The reader may keep this gallery; nothing is read until they may. */
  mayKeep: boolean;
  navigation: Nav;
  /** Every other copy of the place's cover, read again once on the way out. */
  reloadCatalog: () => void;
  t: ReturnType<typeof useI18n>['t'];
}) {
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[] | null>(null);
  // A run of the scorer: how far it has got while it runs, and what it
  // came to once it has finished, until the card is closed.
  const [scoring, setScoring] = useState<{ done: number; total: number; stopping?: boolean } | null>(null);
  const [scored, setScored] = useState<{ scored: number; failed: number } | null>(null);
  const stop = useRef(false);

  const fail = useCallback((e: unknown) => {
    Alert.alert(
      t('That did not work', 'Chưa làm được', 'うまくいきませんでした', '操作未成功', '操作未成功'),
      e instanceof Error ? e.message : String(e),
    );
  }, [t]);

  // Taps drawn on the grid since it was last read, counted so a read that
  // left before the latest tap does not draw over it (`load`), and the
  // writes still out, so the gallery is read back once, after the last.
  const drawn = useRef(0);
  const writing = useRef(0);

  // Its own read, hidden rows included — see `fetchGallery` for why the
  // catalog's embed will not do. The id is looked up once and kept: every
  // write after this one names the place by it. An answer to a question
  // asked before the guide's latest tap is not the gallery any more, and
  // is dropped: the read after that tap's write is on its way.
  const load = useCallback(async () => {
    const asked = drawn.current;
    const id = placeId ?? await fetchPlaceId(slug);
    if (!id) { setPhotos([]); return; }
    setPlaceId(id);
    const rows = galleryOrder(await fetchGallery(id));
    if (asked === drawn.current) setPhotos(rows);
  }, [placeId, slug]);

  // ── the catalog, once, on the way out (owner, 23 Oct 2026) ──
  //
  // Every write used to reload the city's whole catalog, its public lists
  // and the reader's own, to change one place's photographs: 1.3 MB of
  // JSON for Hanoi's 384 places and 440 kB for the owner's lists,
  // measured that day, parsed, written to the cache and drawn again on
  // every screen holding the catalog — the stall a moment after each
  // change. Nothing on this screen reads the catalog, so it waits until
  // the guide leaves, and five changes cost one reload. Leaving is a pop
  // back to the place, which unmounts this, or a tab, which blurs it.
  const dirty = useRef(false);
  const flush = useRef(() => {});
  flush.current = () => {
    if (!dirty.current) return;
    dirty.current = false;
    reloadCatalog();
  };
  useEffect(() => {
    const off = navigation.addListener('blur', () => flush.current());
    return () => { off(); flush.current(); };
  }, [navigation]);

  useEffect(() => {
    if (!mayKeep) return;
    load().catch(fail);
    // Once, when the boundary opens. `load` changes when the id lands and
    // that is not a reason to read again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mayKeep]);

  // Every write, the same way: draw it on the grid at once (`applyEdit`),
  // do it, and read the gallery back once the last write is in. Reading
  // back is what keeps this screen honest about the desk: whatever the
  // desk did in between arrives with the answer, and so does the server's
  // word on a write that failed. The grid is never locked while a write is
  // out — a second tap draws over the first and is written after it.
  const run = async (edit: GalleryEdit, job: () => Promise<void>) => {
    const before = photos;
    drawn.current += 1;
    writing.current += 1;
    setPhotos((was) => (was ? applyEdit(was, edit) : was));
    try {
      await job();
      dirty.current = true;
      successHaptic();
    } catch (e) {
      // Alone, it goes back to what was there; under other taps, the
      // read-back after them says what the server holds.
      if (writing.current === 1) setPhotos(before);
      fail(e);
    } finally {
      writing.current -= 1;
    }
    if (writing.current === 0) await load().catch(fail);
  };

  /** A photograph added from outside this hook also owes the catalog a reload. */
  const markDirty = () => { dirty.current = true; };

  const makeCover = (id: string) => { void run({ kind: 'cover', id }, () => setCover(id)); };
  const hide = (id: string, hidden: boolean) => { void run({ kind: 'hide', id, hidden }, () => setHidden(id, hidden)); };
  const removePhotos = (ids: string[]) => {
    // The paths from the rows on screen, so the files go with the
    // rows — see `removePlacePhotos` for why the rows go first.
    const gone = ids.map((id) => ({ id, storage_path: photos?.find((p) => p.id === id)?.storage_path ?? null }));
    void run({ kind: 'delete', ids }, () => removePlacePhotos(gone));
  };

  const startScoring = async (scorer: PhotoScorer, me: string, unscored: GalleryPhoto[]) => {
    stop.current = false;
    setScored(null);
    setScoring({ done: 0, total: unscored.length });
    // Two frames, so the dialog is on screen and its bars are moving
    // before the first photograph is handed over: the reading can keep
    // the JS side busy, and the bars' loops are started from there.
    await nextFrame();
    await nextFrame();
    const result = await scoreAll(unscored, {
      read: (uri) => scorer.read(uri),
      save: (id, reading) => savePhotoScore(id, scorer, reading, me),
      onStep: (done) => setScoring((was) => ({ ...was, done, total: unscored.length })),
      stopped: () => stop.current,
    });
    // Read back before the dialog goes, so the badges and the card's
    // "best" arrive with it rather than a beat after.
    await load().catch(fail);
    setScoring(null);
    setScored(result);
    if (result.scored) successHaptic();
  };
  const stopScoring = () => { stop.current = true; setScoring((was) => was && { ...was, stopping: true }); };

  return {
    placeId, photos, load, fail, markDirty, makeCover, hide, removePhotos,
    scoring, scored, setScored, startScoring, stopScoring,
  };
}
