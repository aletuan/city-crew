// A visit on a person's page: the place, as a card (owner, 24 Nov 2026).
//
// ── a place card, not a line on a collection's ──
//
// `docs/collection-feed-plan.md` first had a visit as a reason a
// *collection* surfaced ("Dương checked in at a place in this list").
// The owner, designing this: a visit is something done to a place; a
// place need not be in any list and may be in five; nothing ties the two.
// So the card is the place — its picture, its name, its kind and city —
// under the same line of "who did what, when" a list's card has, and it
// is the same card (`ActivityCard`): one column of things a person did
// should not be drawn two ways.
//
// ── what a friend sees, and what you see ──
//
// A friend: the visits you answered "Friends" for, by day ("yesterday",
// never an hour — the server does not send one), with your note as the
// card's two lines, and a heart.
//
// You, on your own page: every visit, each marked with who sees it — the
// padlock or the two heads, as a list's card is — and the note as a
// control (`VisitNote`): a press edits it, and a visit without one asks
// for it in the pencil's italic. A private visit has no heart: nobody
// else can see it to give one (the server refuses one too).
//
// The newest visit at each place, not every visit (`person_checkins`).
//
// ── the heart, before the server has heard ──
//
// Flipped here on the press and written behind it, as a list's is
// (`lib/likes`): a heart that waits for a round trip reads as a missed
// tap. A refusal puts it back and says nothing — the likeliest refusal
// is a visit made private a moment ago, and the next read drops the
// card.
//
// ── a visit's own photos (K4 of `docs/checkin-photos-plan.md`) ──
//
// Behind `checkin_photos`. They wear the card's picture in place of the
// place's cover, paging across when there are more than one
// (`ActivityCard`); a press on one opens all of them full screen, on it
// (`PhotoViewer`), and the words stay the press into the place. Links
// for the whole column are asked for at once (`useSignedPhotos`); until
// they come, and for a visit with none, the card is the place's as it
// was. The viewer is a `Modal` of its own: the page has none to draw it
// in, as the photo sheet does.
//
// On somebody else's page the viewer carries a flag (K5): the photo is
// reported to the desk, as a comment or a profile is. The viewer goes
// first and the reasons follow once it has (`ActionSheet`'s 220ms, for
// its reason). Your own photos have no flag: they are yours to take off
// the visit, from its sheet.
//
// ── while the page is searched ──
//
// No visits. The search is of a person's *collections* and the places in
// them (`person/Find`), and its empty card says so; a visit matching by
// its place's name would be a second kind of answer in a list that
// explains itself as one.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal } from 'react-native';
import ActivityCard from '../../components/ActivityCard';
import CheckinSheet from '../../components/CheckinSheet';
import PhotoViewer from '../../components/PhotoViewer';
import { useReport } from '../../components/reportFlow';
import { useSignedPhotos } from '../../components/useSignedPhotos';
import VisitNote from '../../components/VisitNote';
import { fireHaptic } from '../../components/ui';
import { dayLabel } from '../../lib/ago';
import { categoryLabel } from '../../lib/categories';
import { AUDIENCE_ON, type PersonCheckin } from '../../lib/checkin';
import { useMyCheckins } from '../../lib/checkins';
import { useCityList } from '../../lib/city';
import { cityShortById } from '../../lib/cityName';
import { fetchPersonCheckins, likeCheckin, usePersistedFetch, type Fetch, type FriendProfile } from '../../lib/data';
import { CACHE_CATALOG, cacheKey } from '../../lib/data/cache';
import { atHandle } from '../../lib/handle';
import { useI18n } from '../../lib/i18n';
import { localized } from '../../lib/localized';
import { SEEN_GLYPH } from '../../lib/shares';
import { useFlag, useFlagsReady } from '../../lib/useFlag';

const NONE: PersonCheckin[] = [];

/**
 * How long the column waits for the visits before drawing without them.
 *
 * 1200ms: chosen, not measured on a phone. A cached page answers in the
 * time it takes to read storage, well inside it; the function itself
 * answered in about 300ms from this desk. Past a second a blank column
 * reads as a page that is broken rather than one that is loading.
 */
export const HOLD_MS = 1200;

/**
 * The visits on `person`'s page for the reader `me`, their cards, and
 * the sheet a note of your own is edited in.
 *
 * Nothing is asked for a guest (the read is for somebody signed in), nor
 * with check-ins switched off (`place_checkin`, the pill's own flag). The
 * page leaves them out while it is searched — see the header.
 */
export function useVisitCards({ me, person, onPlace }: {
  me: string | null;
  person: FriendProfile | null;
  onPlace: (slug: string) => void;
}): {
  /** The visits to draw — none while the page is searched. */
  visits: (searching: boolean) => PersonCheckin[];
  /** The column should wait for the visits — never while searching,
   *  which draws none. */
  holding: (searching: boolean) => boolean;
  card: (v: PersonCheckin) => React.ReactElement;
  sheet: React.ReactElement;
  /** The read itself, for the page's pull to refresh. */
  read: Fetch<PersonCheckin[]>;
} {
  const { t, lang } = useI18n();
  const { cities } = useCityList();
  const on = useFlag('place_checkin');
  const mine = useMyCheckins();
  const personId = person?.id ?? null;
  const own = !!me && personId === me;

  // Asked again when your own visits were — a check-in made, a note
  // written, on any screen — which is the one way your own page's cards
  // change under it. Somebody else's page is read as it opens.
  const stamp = own ? mine.loadedAt : null;
  const fetcher = useCallback(
    () => (on && me && personId ? fetchPersonCheckins(personId) : Promise.resolve(NONE)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [on, me, personId, stamp],
  );
  // Kept between launches, per reader and per page, as your own visits
  // are (`lib/checkins`): a page opened before draws its visits from the
  // last answer while this one is on its way.
  const asks = on && !!me && !!personId;
  const read = usePersistedFetch(
    CACHE_CATALOG && asks ? cacheKey('personvisits', personId as string, me) : null, fetcher, NONE,
  );

  // The column waits for the visits, briefly (owner, 24 Nov 2026, the
  // evening of the day the cards shipped). The lists are in memory and
  // draw on the first frame; the visits are a read, and landed a moment
  // later among them — the newest visit pushing every list down, a page
  // that looked loaded twice. So nothing of the column is drawn until
  // the visits have answered, from the cache or the network, or failed.
  //
  // `HOLD_MS` at most: past that the lists are drawn without them, and
  // the visits join when they come. A reader on a train must not be shown
  // a spinner over lists the phone already has.
  //
  // And while the switches are not known yet (owner, 25 Nov 2026): as the
  // app opens, `place_checkin` is as shipped — off — until the last
  // answer is put back or the table's arrives (`lib/flagsSync`), and a
  // column drawn then took its visits in at the top a moment later. So
  // not knowing whether to ask is waited out too, within the same
  // `HOLD_MS`, counted from the first of the two.
  const ready = useFlagsReady();
  const unsure = !ready && !!me && !!personId;
  const waits = asks || unsure;
  const [waited, setWaited] = useState<string | null>(null);
  useEffect(() => {
    if (!waits) return undefined;
    const t0 = setTimeout(() => setWaited(personId), HOLD_MS);
    return () => clearTimeout(t0);
  }, [waits, personId]);
  const holding = waits && (unsure || !read.loaded) && waited !== personId;

  // The reader's presses since the read, by visit: true set, false
  // taken back. Laid over what the server said.
  const [pressed, setPressed] = useState<Record<string, boolean>>({});
  const heart = (v: PersonCheckin) => {
    const was = pressed[v.id] ?? v.liked;
    fireHaptic('light');
    setPressed((p) => ({ ...p, [v.id]: !was }));
    likeCheckin(v.id, !was).catch(() => setPressed((p) => ({ ...p, [v.id]: was })));
  };

  const photosOn = useFlag('checkin_photos');
  const all = useMemo(() => read.data.flatMap((v) => v.photos ?? []), [read.data]);
  const linkOf = useSignedPhotos(all, photosOn);
  /** The photos of `v` that have a link to draw, in order. */
  const shown = (v: PersonCheckin) => (v.photos ?? []).flatMap((ph) => {
    const uri = linkOf(ph);
    return uri ? [{ ph, uri }] : [];
  });
  const [viewing, setViewing] = useState<{ v: PersonCheckin; at: number } | null>(null);
  const { report, canReport, node: reportSheet } = useReport();
  /** The viewer's flag, for a photo the reader may report. */
  const reportOf = (v: PersonCheckin) => (photo: { id: string }) => {
    setViewing(null);
    const who = person as FriendProfile;
    setTimeout(() => report({
      kind: 'checkin_photo', id: photo.id, ownerId: who.id, name: nameOf(v), avatarUrl: who.avatar_url || undefined,
    }), 220);
  };

  const [noteFor, setNoteFor] = useState<PersonCheckin | null>(null);
  const nameOf = (v: PersonCheckin) => localized(v.place, 'name', lang);

  const card = (v: PersonCheckin) => {
    const liked = pressed[v.id] ?? v.liked;
    const shared = !own || v.audience === 'friends';
    const kind = v.place.categories[0];
    const pics = shown(v);
    return (
      <ActivityCard
        key={v.id}
        testID="person-visit"
        // Never without a person: there are no visits to draw without one.
        face={(person as FriendProfile).avatar_url}
        who={(person as FriendProfile).full_name || atHandle((person as FriendProfile).handle)}
        did={t(' checked in', ' đã check-in', 'さんがチェックイン', ' 打卡了', ' 打卡了')}
        when={dayLabel(v.day, new Date(), lang, t)}
        mark={shared
          ? { icon: SEEN_GLYPH.friends, label: t('Friends', 'Bạn bè', '友達', '好友', '好友') }
          : { icon: SEEN_GLYPH.private, label: t('Only me', 'Chỉ mình tôi', '自分のみ', '仅自己', '僅自己') }}
        title={nameOf(v)}
        // A visit with photos of its own draws none of the place's while
        // its links are on their way — the plain ground instead: the
        // place's cover, then the reader's photo, read as the card
        // changing its mind (owner, 25 Nov 2026). Once the link is in, a
        // photo seen before comes off the phone by its id, not the network.
        uri={photosOn && (v.photos?.length ?? 0) > 0 ? undefined : v.place.cover ?? undefined}
        photo={pics.length > 0 ? {
          pages: pics.map(({ ph, uri }) => ({ uri, cacheKey: ph.id })),
          onPress: (at) => setViewing({ v, at }),
        } : undefined}
        meta={[kind ? categoryLabel(kind, t) : null, cityShortById(cities, v.city_id, t)].filter(Boolean).join(' · ')}
        desc={own ? null : v.note}
        under={own ? <VisitNote note={v.note} onEdit={() => setNoteFor(v)} /> : undefined}
        liked={liked}
        // The server's count, moved by the reader's own press and no
        // further: one heart is the most a press can change it by.
        likes={v.likes + (liked === v.liked ? 0 : liked ? 1 : -1)}
        onOpen={() => onPlace(v.place_slug)}
        onHeart={shared ? () => heart(v) : undefined}
      />
    );
  };

  const viewed = viewing ? shown(viewing.v) : [];
  const viewer = (
    <Modal visible={viewed.length > 0} transparent animationType="fade" onRequestClose={() => setViewing(null)} statusBarTranslucent>
      {viewing ? (
        <PhotoViewer
          photos={viewed.map(({ ph, uri }) => ({ id: ph.id, photo_uri: uri, cacheKey: ph.id }))}
          index={Math.min(viewing.at, viewed.length - 1)}
          onIndex={(at) => setViewing({ ...viewing, at })}
          onClose={() => setViewing(null)}
          onReport={canReport({ kind: 'checkin_photo', id: '', ownerId: personId }) ? reportOf(viewing.v) : undefined}
        />
      ) : null}
    </Modal>
  );

  const sheet = (
    <>
      <CheckinSheet
        visit={noteFor ? {
          id: noteFor.id, name: nameOf(noteFor), cover: noteFor.place.cover,
          // The day at local noon: the sheet writes a date from this, and a
          // bare `YYYY-MM-DD` is read as UTC midnight — the day before, west
          // of Greenwich.
          at: `${noteFor.day}T12:00:00`,
          note: noteFor.note, audience: noteFor.audience ?? 'private', fresh: false,
        } : null}
        withAudience={AUDIENCE_ON}
        // Saved: your visits are asked again, and this page after them.
        onClose={(saved) => { setNoteFor(null); if (saved) mine.reload(); }}
      />
      {viewer}
      {reportSheet}
    </>
  );

  return {
    visits: (searching) => (searching ? NONE : read.data),
    holding: (searching) => !searching && holding,
    card, sheet, read,
  };
}
