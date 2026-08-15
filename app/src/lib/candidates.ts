// Asking Google for places the catalog has not got, and adding one.
//
// Two screens do this now. Add a place has always been the whole of one
// screen; Search does it in a section, once its own results have come up
// short and the reader has said the word. The orchestration is identical —
// search, work out what we already know about each result, suggest one,
// move that row's state in place — and writing it twice is how this
// codebase ended up with four dashed rows and five add buttons.
//
// So it is a hook rather than a copy. What the two screens still differ on
// is presentation, which is where they should differ: one lists everything
// Google returned, the other shows only what is new.

import { useCallback, useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import { useAuth } from './auth';
import { useCity, useMyPosition } from './city';
import { usePlaces } from './catalog';
import { distanceKm, fmtDistance } from './geo';
import { useI18n } from './i18n';
import { Candidate, knownByPlaceId, Known, searchPlaces, suggestPlace } from './suggest';

export type Candidates = {
  /** null before the first search, [] when one found nothing. */
  results: Candidate[] | null;
  known: Record<string, Known>;
  searching: boolean;
  /** place_id currently being submitted, or null. */
  adding: string | null;
  run: (query: string) => void;
  add: (c: Candidate) => void;
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
  const [adding, setAdding] = useState<string | null>(null);

  const clear = useCallback(() => { setResults(null); setKnown({}); }, []);

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

  const add = useCallback((c: Candidate) => {
    if (!city || adding) return;
    setAdding(c.place_id);
    suggestPlace(c.place_id, city.id)
      .then((out) => {
        if (out.ok) {
          // Marked here rather than re-searched: the row changes state in
          // place, so adding several from one search does not mean
          // starting the search again after each.
          setKnown((k) => ({ ...k, [c.place_id]: { state: 'mine' } }));
          places.reload();
          // What is true, in the order it matters: it worked, it is
          // yours, and here is why a friend cannot see it yet.
          //
          // No mention of review. Being told at that exact moment that
          // your contribution must first pass an inspection is a strange
          // way to say thank you, and the only part of it anyone needs is
          // why nobody else sees the place — a fact about now, not a
          // process to explain.
          Alert.alert(
            t('Thanks — it is in', 'Cảm ơn — đã thêm', 'ありがとうございます'),
            t(
              `${c.name} is on your Explore now. Only you can see it for the moment — we will open it up to everyone shortly.`,
              `${c.name} đã có trong mục Khám phá của bạn. Hiện chỉ mình bạn thấy — chúng tôi sẽ mở cho mọi người sớm thôi.`,
              `${c.name} はあなたの探索に追加されました。今はあなただけに表示され、まもなく全員に公開されます。`,
            ),
          );
          return;
        }
        if (out.reason === 'already_live') {
          setKnown((k) => ({ ...k, [c.place_id]: { state: 'live', slug: out.slug } }));
          return;
        }
        if (out.reason === 'already_known') {
          // Somebody else got there first, and whose suggestion it is is
          // not this reader's business — so the row says the place is
          // known, and stops.
          setKnown((k) => ({ ...k, [c.place_id]: { state: 'mine' } }));
          return;
        }
        Alert.alert(
          out.reason === 'daily_limit'
            ? t('That is enough for today', 'Hôm nay vậy là đủ', '本日はここまで')
            : t('Could not add it', 'Không thêm được', '追加できませんでした'),
          out.reason === 'daily_limit'
            ? t(
              `You can suggest ${out.limit} places a day. Come back tomorrow.`,
              `Mỗi ngày bạn có thể đề xuất ${out.limit} địa điểm. Mai quay lại nhé.`,
              `1日に${out.limit}件まで提案できます。また明日どうぞ。`,
            )
            : out.message,
        );
      })
      .finally(() => setAdding(null));
  }, [city?.id, adding, places, t]);

  return { results, known, searching, adding, run, add, awayFrom, clear };
}

/** Only the ones the catalog has never heard of. What Search shows, since
 *  everything else it could show it has already shown itself. */
export function freshOnly(results: Candidate[], known: Record<string, Known>): Candidate[] {
  return results.filter((c) => (known[c.place_id]?.state ?? 'none') === 'none');
}
