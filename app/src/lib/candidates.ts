// Asking Google for places the catalog has not got, and adding several.
//
// Two screens do this now. Add a place has always been the whole of one
// screen; Search does it in a section, once its own results have come up
// short and the reader has said the word. The orchestration is identical —
// search, work out what we already know about each result, suggest them,
// move each row's state in place — and writing it twice is how this
// codebase ended up with four dashed rows and five add buttons.
//
// So it is a hook rather than a copy. What the two screens still differ on
// is presentation, which is where they should differ: one lists everything
// Google returned, the other shows only what is new.
//
// There is one path in, `addMany`. Search used to have a second, `add`,
// which submitted one candidate and said thank you — five taps and five
// round trips to add five places, waited through one at a time. Both
// screens select and commit together now, and the row's own state is the
// thank you: "Added — only you can see it", written where the reader is
// already looking.

import { useCallback, useRef, useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import { useAuth } from './auth';
import { useCity, useMyPosition } from './city';
import { usePlaces } from './catalog';
import { distanceKm, fmtDistance } from './geo';
import { useI18n } from './i18n';
import { Candidate, knownByPlaceId, Known, searchPlaces, suggestPlace } from './suggest';

/**
 * Where one candidate is in a batch.
 *
 * `skipped` is not a failure and must not read as one: the place was
 * already in the catalog, which is the answer somebody selecting five
 * results wanted rather than an error they caused.
 */
export type ItemState = 'queued' | 'running' | 'done' | 'skipped' | 'failed';

export type Batch = {
  running: boolean;
  state: Record<string, ItemState>;
  done: number;
  total: number;
};

export const IDLE_BATCH: Batch = { running: false, state: {}, done: 0, total: 0 };

export type Candidates = {
  /** null before the first search, [] when one found nothing. */
  results: Candidate[] | null;
  known: Record<string, Known>;
  searching: boolean;
  /** place_id currently being submitted, or null. */
  adding: string | null;
  batch: Batch;
  run: (query: string) => void;
  /** Submit several, one at a time. Resolves once every one has settled or
   *  the run was cancelled. */
  addMany: (list: Candidate[]) => Promise<{ done: number; skipped: number; failed: number; cancelled: boolean }>;
  cancel: () => void;
  /** Formatted distance from the reader, or '' — see `awayFrom` below. */
  awayFrom: (c: Candidate) => string;
  clear: () => void;
};

export function useCandidates(): Candidates {
  const { t } = useI18n();
  const { city } = useCity();
  const me = useMyPosition();
  const { session } = useAuth();
  const meId = session?.user?.id;
  const places = usePlaces();

  const [results, setResults] = useState<Candidate[] | null>(null);
  const [known, setKnown] = useState<Record<string, Known>>({});
  const [searching, setSearching] = useState(false);
  const [batch, setBatch] = useState<Batch>(IDLE_BATCH);
  /** Set by `cancel`, and by the daily cap — read between items, never
   *  mid-flight. */
  const stop = useRef(false);

  const clear = useCallback(() => { setResults(null); setKnown({}); setBatch(IDLE_BATCH); }, []);

  const run = useCallback((raw: string) => {
    const q = raw.trim();
    if (!q || !city || searching) return;
    // Both callers reach this from a keyboard that is still up — one from
    // the return key, one from a row tapped under the results — and in
    // both the typing is over.
    Keyboard.dismiss();
    setSearching(true);
    setResults(null);
    searchPlaces(q, city.id)
      .then(async (found) => {
        // Awaited, unlike the version this replaces, because one of the
        // two callers *hides* the rows it already has rather than
        // labelling them — and a list that renders and then loses rows
        // under the reader's eyes is worse than one that arrives a
        // round trip later, inside a spinner that is already spinning.
        //
        // A failure still leaves every row looking new, which was the
        // point of not awaiting it before: the catch resolves to nothing
        // known rather than taking the search results down with it.
        const seen = await knownByPlaceId(found.map((c) => c.place_id), meId).catch(() => ({}));
        setKnown(seen);
        setResults(found);
      })
      .catch((e: Error) => Alert.alert(t('Search failed', 'Tìm kiếm thất bại', '検索に失敗しました'), e.message))
      .finally(() => setSearching(false));
  }, [city?.id, searching, meId, t]);

  /**
   * How far a result is from the reader, or nothing at all.
   *
   * From where they are standing, not from the middle of the city: "1.2 km
   * from the centre of Hanoi" is a fact about Hanoi, and the reader is
   * deciding whether they can walk there. A number that looks like the
   * answer and is not is worse than a blank, because a blank cannot
   * mislead anyone.
   *
   * The permission is read, never asked for — see `useMyPosition`.
   *
   * The radius guard is for a reader browsing a city they are not in;
   * picking Hanoi from Saigon is one tap. Every result would then read
   * "1730 km", true and useless, and five identical numbers disambiguate
   * nothing — which was the entire job.
   */
  const inThisCity = !!city && !!me
    && distanceKm(me.lat, me.lng, city.center_lat, city.center_lng) <= city.radius_km;

  const awayFrom = useCallback((c: Candidate) => (
    inThisCity && me && c.lat != null && c.lng != null
      ? fmtDistance(distanceKm(me.lat, me.lng, c.lat, c.lng))
      : ''
  ), [inThisCity, me?.lat, me?.lng]);

  const mark = (id: string, st: ItemState) =>
    setBatch((b) => ({ ...b, state: { ...b.state, [id]: st } }));

  /**
   * Submit one, and report what became of it.
   *
   * Throws nothing. Every outcome the server can give is a state a row can
   * wear, and a batch that stopped on the first refusal would be a batch
   * that punishes selecting five results because one of them was already
   * here.
   */
  const suggestOne = useCallback(async (c: Candidate): Promise<ItemState> => {
    if (!city) return 'failed';
    const out = await suggestPlace(c.place_id, city.id).catch(() => null);
    if (!out) return 'failed';
    if (out.ok) {
      // Marked here rather than re-searched: the row changes state in
      // place, so adding several from one search does not mean starting
      // the search again after each.
      setKnown((k) => ({ ...k, [c.place_id]: { state: 'mine' } }));
      return 'done';
    }
    if (out.reason === 'already_live') {
      setKnown((k) => ({ ...k, [c.place_id]: { state: 'live', slug: out.slug } }));
      return 'skipped';
    }
    if (out.reason === 'already_known') {
      // Somebody else got there first, and whose suggestion it is is not
      // this reader's business — so the row says the place is known, and
      // stops.
      setKnown((k) => ({ ...k, [c.place_id]: { state: 'mine' } }));
      return 'skipped';
    }
    if (out.reason === 'daily_limit') {
      Alert.alert(
        t('That is enough for today', 'Hôm nay vậy là đủ', '本日はここまで'),
        t(
          `You can suggest ${out.limit} places a day. Come back tomorrow.`,
          `Mỗi ngày bạn có thể đề xuất ${out.limit} địa điểm. Mai quay lại nhé.`,
          `1日に${out.limit}件まで提案できます。また明日どうぞ。`,
        ),
      );
      // The cap is per account per day, so every remaining item in this
      // run would refuse for the same reason. Stopping is kinder than
      // five identical failures.
      stop.current = true;
      return 'failed';
    }
    Alert.alert(t('Could not add it', 'Không thêm được', '追加できませんでした'), out.message);
    return 'failed';
  }, [city?.id, t]);

  /**
   * One at a time, on purpose.
   *
   * Each import is a Google details call plus up to six photo lookups
   * inside one Edge Function invocation — `MAX_API_CALLS` in that file is
   * 20 — so five in parallel is five concurrent invocations doing thirty
   * outbound calls between them. Sequential also makes the per-row
   * progress mean something: a row that says "running" is the one the
   * server is working on, not one of five that might be.
   */
  const addMany = useCallback(async (list: Candidate[]) => {
    if (!city || !list.length) return { done: 0, skipped: 0, failed: 0, cancelled: false };
    stop.current = false;
    setBatch({
      running: true,
      total: list.length,
      done: 0,
      state: Object.fromEntries(list.map((c) => [c.place_id, 'queued' as ItemState])),
    });

    const tally = { done: 0, skipped: 0, failed: 0 };
    for (const c of list) {
      if (stop.current) { mark(c.place_id, 'queued'); continue; }
      mark(c.place_id, 'running');
      const st = await suggestOne(c);
      mark(c.place_id, st);
      tally[st === 'done' ? 'done' : st === 'skipped' ? 'skipped' : 'failed'] += 1;
      setBatch((b) => ({ ...b, done: b.done + 1 }));
    }

    setBatch((b) => ({ ...b, running: false }));
    // Once, at the end, rather than after each: the catalog is one fetch
    // and five of them would be four wasted round trips and four list
    // re-renders under the reader's finger.
    if (tally.done > 0) places.reload();
    // Cancelled is not the same as clean, and only the caller can act on
    // the difference: a run stopped halfway must not be followed by the
    // screen leaving, however few things went wrong before it stopped.
    return { ...tally, cancelled: stop.current };
  }, [city?.id, places, suggestOne]);

  /** Stop before the next one starts. The one in flight is already with
   *  the server and finishing it is cheaper than orphaning it. */
  const cancel = useCallback(() => { stop.current = true; }, []);

  const adding = Object.keys(batch.state).find((id) => batch.state[id] === 'running') ?? null;

  return { results, known, searching, adding, batch, run, addMany, cancel, awayFrom, clear };
}

/** Only the ones the catalog has never heard of. What Search shows, since
 *  everything else it could show it has already shown itself. */
export function freshOnly(results: Candidate[], known: Record<string, Known>): Candidate[] {
  return results.filter((c) => (known[c.place_id]?.state ?? 'none') === 'none');
}
