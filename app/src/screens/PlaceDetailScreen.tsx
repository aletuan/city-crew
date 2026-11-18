// Place detail — a bar with the way back, the place's name and its
// bookmark; under it the photographs as a rounded card with a page count;
// the score with check-in beside it, the place's kinds as the card's pills,
// and one grouped card of Address / Hours / Call / Website rows, the weekly
// table folded behind the open-now line.
//
// ── the owner's shape (12 Nov 2026) ──
//
// The hero was full-bleed, up under the clock, with back, share and the
// bookmark floating on it in dark discs and the name in 26pt under it.
// The owner sent a mock-up of this screen and chose it over that, "simpler":
// a plain bar on the paper — the chevron bare at the left, the name centred
// on one line, the bookmark bare at the right — and the photograph as a
// card under the bar. A bar on paper needs no discs, no scrim and no
// light ink under the clock, which is three things this screen no longer
// has to manage. What it costs is written where it is paid: a long name is
// cut to one line (see `s.barName`), and share is not on the screen.
//
// A day earlier the same screen tried a name bar that came in only once
// the photograph had scrolled away, the photograph staying full-bleed with
// its discs. Measured, it was defensible — 41–47% of covers leave a bare
// white glyph on the photo under 3:1, and 18% of names do not fit one
// centred line — but the owner saw it on the phone and called it not
// pretty. On paper neither number applies to the glyphs: they are ink.

import { useTourAnchor } from '../components/SignupTour';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFlag } from '../lib/useFlag';
import { useSession } from '../lib/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glyph, ICON } from '../components/ui/glyph';
import { addCheckin, coverOf, fmtCount, isFree, photosOf, removeCheckin, usePlaceBySlug, usePlacePhotos, withPhotos } from '../lib/data';
import { useMyCheckins } from '../lib/checkins';
import { reviewAfterCheckin } from '../lib/askReview';
import { canRepeat, latestCheckin, visitsAt } from '../lib/checkin';
import { DAILY_CAPS, isDailyLimit } from '../lib/quota';
import ActionSheet, { type SheetAction } from '../components/ActionSheet';
import { usePlaces } from '../lib/catalog';
import { shortAddress } from '../lib/address';
import { splitName, subtitleBeside } from '../lib/name';
import { useCity } from '../lib/city';
import { kindsInOrder } from '../lib/categories';
import MiniMap, { canDrawMap } from '../components/MiniMap';
import PhotoCarousel from '../components/PhotoCarousel';
import { pinImage } from '../components/mapPins';
import {
  atHandle, hostOf, instagramUrl, threadsUrl, websiteHref, websiteRepeatsHandle,
} from '../lib/links';
import { cityTz } from '../lib/clock';
import { clockOf, dateline, groupHours, openState } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { localized, localizedLang } from '../lib/localized';
import { blurbCredit, blurbIcon, blurbLink } from '../lib/blurbSource';
import { mapsRouteUrl, mapsSearchUrl } from '../lib/maps';
import { useIsSaved, useSaveActions } from '../lib/save';
import { useNoteEvent } from '../lib/tasteProfile';
import { colors, space } from '../theme';
import { AmbientWarmth, BackButton, Card, CountBadge, Empty, GradientCta, PressableScale, successHaptic, useTabBarClearance } from '../components/ui';
import PricePill from '../components/PricePill';
import { KindPills } from '../components/KindPill';
import LocalGuidePanel from '../components/LocalGuidePanel';
import type { Nav, RootRoute } from '../nav';
import { InfoRow } from './placeDetail/InfoRow';
import { HISTORY_ROWS, ADDRESS_LINES, MARK_INSET, BAR_NAME_MIN_SCALE, s } from './placeDetail/styles';

/**
 * The photograph card's height for its width, from the owner's mock-up:
 * a 400 x 252 card on a 440pt phone, 1.59 to 1. 5:8 is that ratio, and
 * a little shorter than the 4:3.4 the inset card had before the hero went
 * full-bleed — the bar above it now holds the name the photo used to sit
 * over, so the card does not have to carry the top of the screen.
 */
const HERO_RATIO = 5 / 8;

export default function PlaceDetailScreen({ navigation, route }: { navigation: Nav; route: RootRoute<'PlaceDetail'> }) {
  const { t, lang } = useI18n();
  const { city, cities } = useCity();
  const { save, askToSignIn } = useSaveActions();
  const { width } = useWindowDimensions();
  const { loading: catalogLoading, data: places } = usePlaces();
  const inCatalog = useMemo(
    () => places.find((p) => p.slug === route.params.slug),
    [places, route.params.slug],
  );
  // A place reached through a collection can be in another city, and the
  // catalog is one city's worth. Asked for only when the catalog missed,
  // and only once the catalog has actually settled — asking while it is
  // still loading would fire a request for every place you open.
  const elsewhere = usePlaceBySlug(!catalogLoading && !inCatalog ? route.params.slug : null);
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
  const saveAnchor = useTourAnchor('save', () => { if (place) save(place); }, () => navigation.isFocused());
  const loading = catalogLoading || elsewhere.loading;
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
  const [hoursOpen, setHoursOpen] = useState(false);
  const showPrice = useFlag('place_price');
  // The door before the room: see `place_checkin` in `lib/flags`. For
  // everyone, guests included. It was the signed-in's only, on the
  // argument that a guest has nobody to check in as and the bookmark
  // already played the door-to-sign-in part here. The owner's review
  // (15 Oct 2026): a control that appears only after signing in is one
  // a guest never learns exists, and the bookmark and the like are both
  // drawn for guests and open the sign-in sheet on a tap. So this does
  // the same — see `checkIn`.
  const { session } = useSession();
  const uid = session?.user?.id ?? null;
  const showCheckin = useFlag('place_checkin');
  // The reader's visits — the one copy the whole app shares, so the
  // reload after a tap here is what the profile's count draws too.
  const visits = useMyCheckins();
  const [checkinMenu, setCheckinMenu] = useState(false);
  const [checking, setChecking] = useState(false);
  // How many lines the address wanted before anything clamped it, and
  // whether the reader has asked for the rest. `null` is "not measured
  // yet", which is also the one paint that runs unclamped. Up here with
  // the other hooks rather than beside the row that uses them: there is a
  // `return` for the not-found face between the two places, and a hook
  // after it is a hook that some renders do not reach.
  const [measured, setMeasured] = useState<number | null>(null);
  const [addrOpen, setAddrOpen] = useState(false);
  const saved = useIsSaved(route.params.slug);
  const tabClearance = useTabBarClearance();
  const insets = useSafeAreaInsets();

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

  if (loading && !place) {
    return <SafeAreaView style={s.screen}><ActivityIndicator color={colors.accent} style={{ marginTop: 64 }} /></SafeAreaView>;
  }
  if (!place) {
    return <SafeAreaView style={s.screen}><Empty text={t('Place not found.', 'Không tìm thấy địa điểm.', 'スポットが見つかりません。', '找不到该地点。', '找不到該地點。')} /></SafeAreaView>;
  }

  const photos = photosOf(place);
  const reviews = fmtCount(place.rating_count);
  // The pin's category first, so the page leads where the card led.
  const kindOrder = kindsInOrder(place);
  const priceShown = showPrice && (place.price_display || place.price_vnd != null);
  // The page's width less its two margins, at the mock-up's ratio.
  const heroW = width - space.page * 2;
  const heroH = Math.round(heroW * HERO_RATIO);
  // Through `lib/maps` rather than spelled out here, now that the saved
  // trip links out too. It also fixes a narrower bug than it looks: the
  // old test was `place.lat && place.lng`, and a place sitting exactly on
  // the equator or the prime meridian has a legitimate coordinate of 0,
  // which is falsy. None of these three cities is near either — but the
  // check was reading "has a position" off a value that means something
  // else, and `mapsSearchUrl` asks the question it means.
  const mapsUrl = mapsSearchUrl(place);
  // What the Directions button opens, since 12 Oct 2026: a route to the
  // place from wherever the reader is, not the place on the map. The
  // button said "Directions" and opened the place's pin, which is the
  // address row's own tap and the map's; the owner tapped it on the
  // pavement and got a pin where a route was promised. `mapsRouteUrl`
  // with one stop is exactly that journey — origin left to Google, which
  // reads a missing one as the device's position (`lib/maps` says why) —
  // so nothing here asks for location. Driving, as the route does when
  // it knows nothing about the legs: the mode that is merely
  // inconvenient over the one that strands somebody, and Google lets
  // them switch once it is open.
  const routeUrl = mapsRouteUrl([place], 'driving')?.url ?? null;
  // The card shows the address a local would say — street and ward —
  // not the city, postal code and country Google wrote for a reader
  // anywhere in the world. The share sheet and the Maps link below keep
  // `place.address` whole: both leave the phone. The catalog's names for
  // the current city go along so a city `lib/address` has never heard of
  // is still cut from a short, ward-less address. See `shortAddress`.
  const cityNames = city ? [city.name_vi, city.name_en, city.short_vi, city.short_en] : [];
  const address = shortAddress(place.address, cityNames);
  // The brand as the title and the qualifier Google's listing hung off
  // it — a branch, a tagline — as a subtitle beneath, rather than three
  // lines of display type. See `lib/name` for the cut. The subtitle is
  // dropped when it only repeats what the card already prints: the
  // neighbourhood line under it, or the address row further down.
  const neighborhood = localized(place, 'neighborhood', lang);
  // The district is not printed here. Until 15 Nov 2026 it was, as a line
  // under the subtitle, for a place with no address row — and on that day
  // every one of the catalog's 1,477 places had an address, so the line
  // was drawn for none of them and would have been a third line in a head
  // that is now centred and two lines at most (owner). The subtitle is
  // still judged against the district — a branch named after its ward
  // ("CTQ Texas BBQ - Hà Đông") would otherwise repeat the word the
  // address ends in. The cost, written down: a place with no address
  // whose branch is its district says where it is nowhere on the page.
  const fullName = localized(place, 'name', lang);
  const name = splitName(fullName);
  // `address`, not `place.address`: the test is against what the reader
  // can actually see, and the short one is what the row prints.
  const subtitle = subtitleBeside(name, neighborhood, address);
  // Grouped, not one row per day: see groupHours. A place open the same
  // seven days a week becomes one line instead of seven identical ones.
  const hours = groupHours(place.opening_hours ?? [], lang);
  // Read at render rather than on a timer. The screen re-renders on every
  // visit, which is when the answer is being asked for; a ticking clock
  // would only matter to someone parked on this screen at closing time,
  // and would cost a re-render a minute on every place in the app.
  const openNow = openState(place.opening_hours, new Date(), cityTz(cities, place.city_id));
  // Asked of the string the reader will actually get, not of the columns:
  // a description written only in Japanese is one for a Japanese reader,
  // and nothing (rather than an empty paragraph) for everyone else.
  const desc = localized(place, 'desc', lang);
  // The language those words are in, when it is not the reader's. 837 of
  // 940 places had no Japanese blurb on 13 Oct 2026 and `t` fell back to
  // English on every one of them without a word, so a Japanese reader
  // could not tell a catalog written in English from a broken one. Named
  // under the paragraph, in the reader's language: a fallback that says
  // so is a choice; one that does not is a defect. Only the blurb — a
  // café's name is its name in any language, and the district falls back
  // on every card already, where a label would be noise. And not for an
  // English reader: English is the language the catalog is written in,
  // and the one case where it is missing (a Vietnamese-only blurb, 96
  // rows) is the desk's to fill, not the reader's to be told about.
  // A Vietnamese reader can only be handed English; a Japanese one,
  // English or Vietnamese — so two labels cover every fallback there is.
  const descLang = localizedLang(place, 'desc', lang);
  const descFallback = desc && lang !== 'en' && descLang && descLang !== lang
    ? (descLang === 'en'
      ? t('In English', 'Bản tiếng Anh', '英語の原文', '英文原文', '英文原文')
      : t('In Vietnamese', 'Bản tiếng Việt', 'ベトナム語の原文', '越南文原文', '越南文原文'))
    : null;
  // Who wrote the sentence above it. Null for most places — the desk wrote
  // its own copy, and there is nobody outside to name.
  const blurbFrom = blurbCredit(place);
  const blurbHref = blurbLink(place);
  const blurbMark = blurbFrom && blurbIcon(blurbFrom);
  // Only the credit opens the source (owner, 17 Oct 2026). The paragraph
  // shared the handler until then, on the reading that words and credit
  // are one quote and a thumb takes whichever is nearer; in use, a thumb
  // resting on the words while reading — or starting a scroll on them —
  // was thrown into Threads. The paragraph is for reading, and the name
  // in the link colour is the one thing that says "this goes somewhere".
  const openBlurb = blurbHref
    ? () => open(blurbHref, t('Could not open the source', 'Không mở được nguồn', 'ソースを開けませんでした', '无法打开来源', '無法開啟來源'))
    : undefined;
  // The credit's words: the handle under a mark, the platform alone for
  // Google, and the long form for a source with no mark (see the block).
  const creditWords = !blurbFrom ? '' : blurbFrom.kind === 'threads'
    ? (blurbFrom.name ?? 'Threads')
    : blurbFrom.kind === 'google'
      ? 'Google'
      : (blurbFrom.name
        ? t(`${blurbFrom.name} on ${blurbFrom.source}`, `${blurbFrom.name} trên ${blurbFrom.source}`, `${blurbFrom.name}（${blurbFrom.source}）`, `${blurbFrom.name}（${blurbFrom.source}）`, `${blurbFrom.name}（${blurbFrom.source}）`)
        : blurbFrom.source);
  // What VoiceOver says for it: the mark it cannot read, put back in words
  // where the line names a person rather than the platform itself.
  const creditLabel = blurbFrom?.kind === 'threads' && blurbFrom.name
    ? t(`${creditWords} on Threads`, `${creditWords} trên Threads`, `${creditWords}（Threads）`, `${creditWords}（Threads）`, `${creditWords}（Threads）`)
    : creditWords;
  const creditLine = blurbFrom ? (
    <Text style={[s.credit, blurbHref ? s.creditLink : null]}>
      {blurbMark ? (
        <Glyph name={blurbMark} size={ICON.meta} color={blurbHref ? colors.accent : colors.textTertiary} />
      ) : null}
      {blurbMark ? ' ' : ''}
      {creditWords}
    </Text>
  ) : null;
  // Which row opens the grouped card decides where the hairlines fall:
  // every row below the first draws one above itself, whatever subset of
  // the four a place actually has.
  // The venue's own accounts, bare and lowercase in the column; the @ and
  // the host are put back at the edges. A website that is only one of these
  // accounts said as a URL is dropped — the row above it already says the
  // same name, better.
  const ig = place.instagram_handle || null;
  const th = place.threads_handle || null;
  const site = place.website && !websiteRepeatsHandle(place.website, { instagram: ig, threads: th })
    ? place.website
    : null;

  const firstRow = place.address ? 'address'
    : hours.length ? 'hours'
    : place.phone ? 'phone'
    : ig ? 'instagram'
    : th ? 'threads'
    : site ? 'website' : null;

  // Whether there is a picture to hang the Directions button on.
  //
  // Asked once, because two things now turn on it and they must not
  // disagree: the map draws, and the button either rides on the map or
  // falls back into the address row. A build with no Google Maps SDK —
  // Expo Go on iOS, or a binary made without the key — draws no map, and
  // the one action this card exists for must not vanish with it.
  const showsMap = place.lat != null && place.lng != null && !!mapsUrl && canDrawMap;

  // A row that goes somewhere can fail to get there — a phone that cannot
  // dial, a URL no app claims — and `openURL` says so only by rejecting.
  // Unheard, the tap just did nothing; the reader is told instead.
  const open = (url: string, failed: string) => {
    Linking.openURL(url).catch(() => Alert.alert(failed));
  };
  const addrLong = measured != null && measured > ADDRESS_LINES;

  /** Named once: the address row, its button and the map all do this. */
  const toMaps = () => open(
    mapsUrl!,
    t('Could not open Maps', 'Không mở được bản đồ', 'マップを開けませんでした', '无法打开地图', '無法開啟地圖'),
  );
  const toRoute = () => open(
    routeUrl!,
    t('Could not open Maps', 'Không mở được bản đồ', 'マップを開けませんでした', '无法打开地图', '無法開啟地圖'),
  );

  // What lies over the hero whether or not it has photographs: the scrim.
  // Laid between the pages and the marks by `PhotoCarousel`, so the marks
  // stay on top of the scrim they were sized against; laid over the grey
  // fallback the same way when there is nothing to page.
  const heroOverlays = (
    <>
            {/* One scrim, for the page count, the kinds and the credit that
                sit on the bottom edge. The top one went with the controls:
                nothing rides the top of this photograph any more. */}
            <LinearGradient
              pointerEvents="none"
              colors={['transparent', 'rgba(10,11,10,0.34)']}
              style={s.heroScrimBottom}
            />

            {/* Where the reader is in the photographs is `PageCount`'s
                "2 / 4" at the bottom right, drawn by the carousel — see
                that file for why a count and not dots. Not read aloud:
                each photograph is "Photo n of m" by itself. */}
    </>
  );

  // ── the bar ──
  //
  // On the paper, so the glyphs are the page's ink and need no disc —
  // the bare control the other pushed screens wear, each hung past the
  // margin so its ink, not its empty box, stands on it: back by
  // `BACK_HANG`, the bookmark by `SAVE_HANG`. The name between them is
  // centred on the screen, which the two hangs keep within a point.
  const header = (
    <View style={[s.bar, { paddingTop: insets.top + 6 }]}>
      <BackButton onPress={() => navigation.goBack()} bare testID="detail-back" />
      <Text
        style={s.barName}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={BAR_NAME_MIN_SCALE}
        accessibilityRole="header"
        testID="detail-name"
      >
        {name.title}
      </Text>
      {/* The same control as the bookmark on the card that got you
          here — same glyph, same sheet, same rows underneath. It was a
          heart wired to component state: it filled in, it meant
          nothing, and it forgot on the way back. */}
      <PressableScale
        anchorRef={saveAnchor}
        onPress={() => save(place)} scaleTo={0.9} haptic="selection"
        style={s.saveHang} contentStyle={s.barControl}
        accessibilityRole="button"
        accessibilityState={{ selected: saved }}
        // Two ids for the two states, so a smoke flow can wait on the
        // save having landed without reading a trilingual label.
        testID={saved ? 'detail-saved' : 'detail-save'}
        accessibilityLabel={saved
          ? t('Saved — change collections', 'Đã lưu — đổi bộ sưu tập', '保存済み — コレクションを変更', '已保存 — 更改合集', '已儲存 — 更改合集')
          : t('Save to a collection', 'Lưu vào bộ sưu tập', 'コレクションに保存', '保存到合集', '儲存到合集')}
      >
        <Glyph name={saved ? 'bookmark' : 'bookmark-outline'} size={ICON.nav} color={saved ? colors.accent : colors.text} />
      </PressableScale>
    </View>
  );

  // ── check-in ──
  const latestVisit = latestCheckin(visits.data, place.slug);
  const visitsHere = visitsAt(visits.data, place.slug);
  const checkIn = async () => {
    // A guest's tap is the door, with its reason named, as the like's is.
    // Nothing resumes on the far side: signed in, the pill is the same
    // pill, and a visit written by a sign-in rather than by a tap would
    // be one the reader did not quite make.
    if (!uid) { askToSignIn('checkin'); return; }
    if (checking) return;
    setChecking(true);
    try {
      await addCheckin({ ownerId: uid, placeSlug: place.slug, cityId: place.city_id ?? city?.id ?? null });
      successHaptic();
      // The list is the one before this visit; the count includes it.
      reviewAfterCheckin(visits.data.length + 1);
      visits.reload();
    } catch (e) {
      // The cap gets its own words, as the collection form's does. Not
      // noted in the taste profile either way: `place_events` is the
      // private signal and this is the reader's own record — see
      // `lib/checkin` for why the two are kept apart.
      Alert.alert(
        t('Could not check in', 'Không check-in được', 'チェックインできませんでした', '无法打卡', '無法打卡'),
        isDailyLimit(e)
          ? t(
            `You have checked in here ${DAILY_CAPS.checkinsPerPlace} times today. Come back tomorrow.`,
            `Hôm nay bạn đã check-in ở đây ${DAILY_CAPS.checkinsPerPlace} lần rồi. Mai quay lại nhé.`,
            `今日はここに${DAILY_CAPS.checkinsPerPlace}回チェックイン済みです。また明日どうぞ。`,
            `你今天已在这里打卡 ${DAILY_CAPS.checkinsPerPlace} 次，明天再来吧。`, `你今天已在這裡打卡 ${DAILY_CAPS.checkinsPerPlace} 次，明天再來吧。`,
          )
          : (e as Error).message,
      );
    } finally {
      setChecking(false);
    }
  };
  // Any one visit, not only the newest: the sheet lists them all, each
  // with its own undo, because the one that was a slip is not always
  // the last. The sheet stays open after one goes — the reader may be
  // tidying two — and closes itself only when the last goes, since a
  // sheet about a visit that no longer exists has nothing to show. No
  // "are you sure": the sheet is already the second step after the
  // pill, as the ⋯-then-sheet on the check-ins list was. The check-ins
  // list itself no longer offers the undo for a place that opens, so
  // this is the one place a visit is taken back (#831).
  const undoCheckin = async (id: string) => {
    if (visitsHere.length <= 1) setCheckinMenu(false);
    try {
      await removeCheckin(id);
      visits.reload();
    } catch (e) {
      Alert.alert(t('Could not remove it', 'Không bỏ được', '削除できませんでした', '无法删除', '無法刪除'), (e as Error).message);
    }
  };
  // "Again" is the sheet's one commit, so it is drawn as every sheet's
  // commit is — the wide gradient CTA under the history — and not as a
  // menu row among rows (the reference mock made it a filled card of
  // its own; the CTA is this app's filled card). Offered only while the
  // rules allow another — ten minutes since the last, fewer than three
  // today — because inside those a second tap is a slip, and the undo
  // for a slip is on its row above. Hidden rather than dimmed: the
  // sheet is most often opened in the minutes after a check-in, and a
  // big dimmed button there would read as a button that is broken.
  const canAgain = canRepeat(visits.data, place.slug, new Date());
  // Below it, what else a visit might lead to. The review is a door
  // drawn before its room, as the Check-in pill itself was (#812): the
  // owner wants the reader to learn that a visit will be rateable here,
  // and a row that says "coming soon" and refuses the tap teaches that
  // without pretending.
  const checkinActions: SheetAction[] = [{
    key: 'review', icon: 'create-outline' as const, disabled: true,
    title: t('Write a review', 'Viết đánh giá', 'レビューを書く', '写评价', '寫評價'),
    desc: t('Coming soon — share what it was like.', 'Sắp có — chia sẻ trải nghiệm của bạn.', '近日公開 — 感想を共有できます。', '即将推出 — 分享你的体验。', '即將推出 — 分享你的體驗。'),
    onPress: () => {},
  }];

  return (
    // The bar takes the top inset itself, so it can sit on the paper
    // right under the clock; the bottom is cleared by `tabClearance`.
    <View style={s.screen}>
      <AmbientWarmth style={{ top: heroH, height: 620 }} />
      {header}
      <ScrollView
        testID={`detail-place-${place.slug}`}
        contentContainerStyle={{ paddingBottom: tabClearance }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── hero carousel ──
            `PhotoCarousel`'s paging, given the screen's width and the
            height this screen decides, remounted when the desk changes the
            cover under it so the strip starts again at the new first page.
            The marks sit `MARK_INSET` in from the card's edge, see `attr`. */}
        <View style={[s.heroWrap, { height: heroH }]}>
          {photos.length > 0 ? (
            <PhotoCarousel
              pages={photos}
              page={photoIndex}
              onPage={setPhotoIndex}
              width={heroW}
              height={heroH}
              scrollKey={pageKey}
              countRight={MARK_INSET}
              countBottom={15}
              attrStyle={s.attr}
              attributionOf={(ph) => ph.attribution_name}
              renderPage={(ph, i, size) => (
                <Image
                  key={ph.photo_uri}
                  source={{ uri: ph.photo_uri }}
                  style={[s.hero, size]}
                  contentFit="cover"
                  transition={200}
                  testID={i === 0 ? 'detail-photo' : undefined}
                  accessibilityLabel={t(
                    `Photo ${i + 1} of ${photos.length} of ${fullName}`,
                    `Ảnh ${i + 1}/${photos.length} của ${fullName}`,
                    `${fullName}の写真 ${i + 1}/${photos.length}`,
                    `${fullName}的照片，第 ${i + 1} 张，共 ${photos.length} 张`, `${fullName}的照片，第 ${i + 1} 張，共 ${photos.length} 張`,
                  )}
                />
              )}
            >
              {heroOverlays}
            </PhotoCarousel>
          ) : (
            <>
              <View style={[s.hero, s.heroFallback, { width: heroW, height: heroH }]}>
                <Text style={{ fontSize: 64 }}>{place.emoji ?? '📍'}</Text>
              </View>
              {heroOverlays}
            </>
          )}
        </View>

        <View style={s.body}>
          {/* ── what it scored ──
              The name is the bar's now (owner, 12 Nov 2026); what follows
              the photograph is the score. One column, not two, from when
              the name stood here. The rating used to sit in a badge beside
              the title, which cost the name 109pt of the 386 it could have
              had and made it wrap far more often than it needed to: 32% of
              places on a 393pt phone, against 7% at full width. Measured
              off the catalog, that is 167 places getting a whole line of
              26pt back.
              The rating loses nothing by moving. A score and a count are
              one short line of text; a badge was a box drawn around them,
              and the box was the part that was expensive. */}
          {/* ── "City Crew pick", the first line under the photograph ──
              Over the name until the name moved into the bar; it stays the
              first thing read on the page, for the reasons below.
              `is_featured` chose Explore's hero and was said nowhere else;
              since 12 Oct 2026 it is said here, and since 14 Oct it is said
              over the name rather than at the right of the Highlights
              heading. "Chosen" is a claim about the place, and the name is
              what the place is called; on the heading row it read as a
              claim about the paragraph, and it was lost on a featured
              place with no paragraph — 6 of the 21 featured places had
              none until 13 Oct, so that was not the empty case the old
              comment took it for. An eyebrow: the kicker above a title is
              where an editor's mark lives on a listing, read before the
              name and gone from the way of everything after it.
              A glyph and the accent on the words, small caps and spaced;
              not a tinted fill, because the accent as a surface is for
              state (`theme.ts`) and a place being featured is not
              something the reader did. The uppercase is a no-op on the
              Japanese, which has no case, so one style serves three.
              Centred, with the subtitle under it (owner, 15 Nov 2026):
              the two are said of the whole place, as the name in the bar
              above them is, and the bar's name is centred. Rejected the
              same day: both on one line with a dot between — two faces
              and two cases on a line, and a long tagline breaks mid-way. */}
          {place.is_featured ? (
            <View style={s.pick} testID="detail-pick">
              <Glyph name="ribbon-outline" size={ICON.meta} color={colors.accent} />
              <Text style={s.pickText}>{t('City Crew pick', 'City Crew chọn', 'City Crew のおすすめ', 'City Crew 精选', 'City Crew 精選')}</Text>
            </View>
          ) : null}
          {/* What `splitName` took off the name — a branch, a tagline —
              under the photograph rather than in the bar: the bar holds the
              brand on one line, and a chain's branch is the part a reader
              would lose first to the cut. */}
          {subtitle ? (
            <Text
              style={[s.subtitle, place.is_featured && s.subtitleUnderPick]}
              testID="detail-subtitle"
            >
              {subtitle}
            </Text>
          ) : null}
          {/* ── the score, and the one thing to do about it ──
              The rating at the left, check-in at the right: one line that
              used to be two bands, the score and then a row of category
              pills with the pill at its end. The categories went onto the
              cover then, and came back under this line on 15 Oct 2026 as a
              row of their own (see "what the place is"); check-in stays
              here, beside the score it answers. */}
          {(place.rating || showCheckin || priceShown) ? (
          <View style={s.metaRow} testID="detail-meta">
          <View style={s.metaFacts}>
            {place.rating ? (
              // Spoken as one phrase. Left to itself a screen reader reads
              // the star glyph, then the number, then a lone middle dot,
              // then the count — four stops for one fact.
              <View
                style={s.ratingRow}
                testID="detail-rating"
                accessibilityRole="text"
                accessibilityLabel={reviews
                  ? `${place.rating} — ${reviews} ${t('reviews', 'đánh giá', '件のレビュー', '条评价', '條評價')}`
                  : String(place.rating)}
              >
                <Glyph name="star" size={ICON.action} color={colors.accent} />
                <Text style={s.ratingValue}>{place.rating}</Text>
                {reviews ? (
                  <>
                    <Text style={s.ratingDot}>·</Text>
                    <Text style={s.ratingCount}>{reviews} {t('reviews', 'đánh giá', '件のレビュー', '条评价', '條評價')}</Text>
                  </>
                ) : null}
              </View>
            ) : null}
            {/* FREE is already a pill of its own, accented because it is
                the one price that is a state; a paid price is quiet text
                and takes a tag glyph.

                On the rating's line now, as text, since the row of pills
                it sat in moved onto the cover. It went behind its switch
                because it pushed a three-category row onto a second line
                (that row wanted 427pt of a 386pt card); it would wrap
                this line the same way on a long count, which is the
                reason to look again before the switch goes back on.

                This screen is the only place in the app that has ever
                drawn a price, so the switch hides it everywhere, on 557
                published places of 648. That is why it is a row in
                `app_flags` rather than a deletion — see `lib/flags` for
                the one line that brings it back on every phone at once. */}
            {priceShown ? (
              isFree(place) ? (
                <PricePill place={place} />
              ) : (
                <View style={s.priceLine}>
                  <Glyph name="pricetag-outline" size={ICON.text} color={colors.textSecondary} />
                  <PricePill place={place} />
                </View>
              )
            ) : null}
          </View>
            {/* ── check-in ──
                A placeholder, drawn to be judged where it will live. It
                opened as the Directions pill — glass, hairline, accent
                type — and on the phone that read as a fourth fact: same
                fill, same hairline, same "coloured glyph and a word" as
                the chips to its left, with only the colour of the word to
                say otherwise. So it is a *bordered* button now, the way
                the filter row on Explore says "press me" with a bare
                outline where that row said "read me" with a glass fill;
                the outline is the accent at hairline
                strength. Not the tinted fill the mockup wore: the
                accent as a surface is for state (`theme.ts`), and a pill
                at rest is not one. *Having* checked in is the state, and
                the state wears a fill of its own — green, see "worn" below.

                ── the glyph: a ringed tick, hollow then filled ──

                The rest glyph was a filled pin, "one solid mark in a row
                of outlines", and the worn glyph a bare tick. The owner
                found the pin indistinguishable from the pin on the
                address row just below it and from the map tab at the
                foot of the screen — three pins on one screen, one of
                which is a verb. A pin says *where*; this control says
                *I was here*, which is what a tick in a ring says, on a
                form, on a passport stamp, on the owner's own reference
                (13 Oct 2026). Hollow at rest, filled once worn: the same
                glyph in its two states, the way the bookmark on the
                cover is `bookmark-outline` and then `bookmark`, so the
                eye reads one control changing rather than one control
                replaced. Pin-then-tick was two glyphs for one button.

                It sat at the right of the category pills until those
                moved onto the cover; it hangs at the right of the score
                now, the owner's reference having put it beside the name.
                Not beside the name: at `titleDetail` a name like "Off
                street fine coffee" already wraps, and a 110pt pill beside
                it would take a third of every name's line. The score's
                line is short on every place, so the pill costs it nothing.

                44 drawn (`FACT_HEIGHT`), the height it had as one of the
                chips and the target this app gives every control.

                Behind `place_checkin`, off as shipped, so the day it
                misleads it comes down on every phone without a build. */}
            {showCheckin && (
              <PressableScale
                // Rest: the tap is the visit. Worn: the tap is the menu —
                // again, or undo — so a slip never writes a second row.
                onPress={latestVisit ? () => setCheckinMenu(true) : () => { void checkIn(); }}
                disabled={checking}
                haptic="selection"
                accessibilityRole="button"
                accessibilityState={{ selected: !!latestVisit, busy: checking }}
                accessibilityLabel={latestVisit
                  ? t('Visited — options', 'Đã qua — tuỳ chọn', '訪問済み — オプション', '已打卡 — 选项', '已打卡 — 選項')
                  : t('Check in', 'Check-in', 'チェックイン', '打卡', '打卡')}
                style={s.checkinSlot}
                // ── worn ──
                // Filled once a visit is written, bare outline until then.
                // It was `accentSoft` first, and on the phone a 10% tint
                // inside a 28% hairline read as the same pill with the light
                // on it; then solid `accentFill`, which read as one more
                // coral ask. Green now (`okSoft` / `okInk`): a different hue
                // as well as a fill, so rest and worn are two things.
                //
                // The word changes for the same reason. "Check-in" and
                // "Checked in" (VI "Check-in" / "Đã check-in") share the
                // word that carries the meaning, so a glance read both as
                // the verb. "Visited" / "Đã qua" shares nothing with it,
                // and stays true months later, where "Checked in" read as
                // "you are here now". "Đã qua", not "Đã ghé" — the first
                // draft, borrowed from the Visited screen's "Bỏ lần ghé
                // này"; the owner read "Đã qua" as the better word.
                //
                // The rest label is a verb because a button is one: "Check
                // in", not the noun. Vietnamese has no such split and keeps
                // "Check-in".
                contentStyle={[s.checkin, latestVisit && s.checkinOn]}
                testID={latestVisit ? 'detail-checked-in' : 'detail-checkin'}
              >
                <Glyph name={latestVisit ? 'checkmark-circle' : 'checkmark-circle-outline'} size={ICON.text} color={latestVisit ? colors.okInk : colors.accent} />
                {/* ── one width in both states ──
                    The pill was as wide as its word, and the two words
                    are not the same length: "Check-in" and "Đã qua" are
                    8 and 6 characters, so on the phone the pill shrank
                    by about 18pt on the tap and grew back on the undo.
                    The owner read that as the control breathing.

                    So the label is a column holding both words: the one
                    being shown, and the other at zero height, invisible
                    and hidden from VoiceOver. A column is as wide as its
                    widest child, so the pill is the width of the longer
                    word whichever is showing, and the shown word sits
                    centred in that width under the glyph. Measured, not
                    fixed: a `minWidth` would be a number for one
                    language and one type size, and the ghost word is
                    right in all three languages and at every Dynamic
                    Type step, because it is the other word itself. */}
                <View style={s.checkinWords}>
                  <Text style={[s.goText, latestVisit && s.checkinOnText]}>
                    {latestVisit ? t('Visited', 'Đã qua', '訪問済み', '已打卡', '已打卡') : t('Check in', 'Check-in', 'チェックイン', '打卡', '打卡')}
                  </Text>
                  <Text
                    style={[s.goText, s.checkinGhost]}
                    aria-hidden
                    importantForAccessibility="no-hide-descendants"
                    testID="detail-checkin-ghost"
                  >
                    {latestVisit ? t('Check in', 'Check-in', 'チェックイン', '打卡', '打卡') : t('Visited', 'Đã qua', '訪問済み', '已打卡', '已打卡')}
                  </Text>
                </View>
              </PressableScale>
            )}
          </View>
          ) : null}

          {/* ── what the place is ──
              Every category, as the pill the feed's card wears — the card
              says "● Cà phê | +1" because its line has room for one, and
              this is where the "+1" is named (owner, 15 Oct 2026). Same
              component (`KindPill`), so the two cannot drift.

              It replaces the glyphs that sat on the cover since #854. They
              said the same categories a second way — no words, a tap to
              name them — and the reader who came from "+1" did not find
              it there: three of the nine glyphs do not say their kind on
              sight, and the chips under the rating, which were the vibes,
              read as the "+1" instead. The vibes are gone from this
              screen too (the owner's call, the same day): the four
              judgements are on 123 of 976 places, so their absence read
              as a verdict it was not, and the planner, which is what
              they were for, still reads them from the row.

              In `kindsInOrder`: the pin's category first, so the pill that
              leads here is the one the card led with, then the filter
              row's order. 14 under the meta row, the step the vibes kept
              from it. */}
          <KindPills kinds={kindOrder} style={s.kindRow} testID="detail-kinds" />

          {/* ── highlights ── */}
          {/* Unlabelled, the description read as boilerplate and got
              skimmed; named, it is the paragraph a reader stops for.

              "Highlights", not "Why go?", which was the first label. A
              question waits for an opinion, and it was written when the
              desk wrote every line. It no longer does: of 103 published
              descriptions, 54 are Google's `editorialSummary`, a neutral
              line signed by nobody ("seasonal tasting menus and a robust
              wine list"), and under "Why go?" that read as an answer
              nobody gave. What Google writes and what the desk writes
              are both the place at its best, and that is what the label
              now says. Whose words they are is the credit line's job.

              Rejected, with what ruled them out:
              - "Reviews" (Đánh giá): the rating directly above already
                says "1.8k đánh giá", and this would read as those.
              - "Our take" (Nhận xét): still an opinion, so still wrong
                for Google's lines, and close to a user comment.
              - "Overview" (Thông tin cơ bản): the voice of the address
                and hours below, and it leaves the quotation mark
                beside it with nothing to mark.
              - "About" (Giới thiệu): true of every source, but flat.
              - One label per source: honest, but the same block
                changing its name from place to place is a thing to
                explain, and the credit line already tells them apart.

              No chevron. There is no fuller version to open, and an arrow
              that leads nowhere is a promise the screen cannot keep. */}
          {/* ── one card for the desk's words and the desk's tags ──
              Since 14 Oct 2026 the paragraph and the vibe chips sit in a
              `Card`, the same surface the address and hours below wear
              (`surfaceCard`), so the screen has two grounds and no more:
              the page, and the cards on it. Grouping the two was the
              owner's ask — the blurb and the chips are one unit, the
              desk's reading of the place, and the facts below are
              another. Rejected, with what ruled them out:
              - a tint of the accent, as in the mockup: `theme.ts` keeps
                the accent as a surface for state the reader made, and
                this would be the largest accent surface in the app under
                something that is not one; the check-in pill above tried
                `accentSoft` and read as "the same pill with the light on
                it".
              - the theme's glass (`surfaceGlass`): one step off the cards
                below, so three grounds on one screen where the owner
                wanted fewer colours, not more.
              Drawn only when there is a paragraph. The first cut drew it
              for a tag alone too, and on the phone a card holding one chip
              read as a box inside a box — and that is the common case,
              not the edge: 720 of 940 live places had no blurb on 14 Oct
              2026. Without a paragraph the chips stand bare, as they did
              before the card. The chips keep the glass inside the card,
              5% over the card's own ground.

              Since 15 Oct 2026 the card holds the paragraph alone: the
              vibe chips left this screen (see "what the place is"). */}
          {desc ? (
          <Card style={s.whyCard} testID="detail-why-card">
            <View style={s.why} testID="detail-why">
              {/* A quotation mark, not a speech bubble. A bubble is what
                  somebody else said — a review, a comment, a message — and
                  this is the desk's own sentence about the place. The mark
                  that means "these are words somebody chose" is the one
                  printers have used for that since before there were
                  screens.

                  A character rather than an icon because Ionicons has no
                  quote glyph; `“` is in the display face, which the
                  headings on this screen already use.

                  No nudge. Space Grotesk draws its quotes low enough that
                  centring the line box centres the ink to within 0.3pt of
                  the disc's middle — measured off the font, at 22pt in a
                  28pt disc. */}
              {/* ── the heading on a line of its own, since 12 Oct 2026 ──
                  The mark used to sit in a gutter with the label *and the
                  paragraph* beside it, so the paragraph was the one thing on
                  the screen 40pt (a 28pt disc and its gap) in from the left
                  edge the name, the info card and the map share. The owner
                  asked for the paragraph on its own line, full width. One
                  left edge for the screen, and at 16pt a line ~5 characters
                  longer: a 120-character blurb goes from four lines to
                  three or so. The mark keeps its meaning — it is still the
                  quotation mark over these words, not a section icon — but
                  not its disc: the disc was the gutter's anchor for a
                  column of text, and on a heading row a bare mark in the
                  display face reads as a magazine's opening quote, which
                  is what the owner asked for on seeing it with the disc.
                  The pick mark sat at the right of this row until 14 Oct
                  2026; it is over the name now (see "City Crew pick"). */}
              <View style={s.whyHead}>
                <Text style={s.whyQuote}>{'\u201C'}</Text>
                <Text style={s.whyLabel}>{t('Highlights', 'Điểm nổi bật', '見どころ', '亮点', '亮點')}</Text>
              </View>
              <View style={s.whyBody}>
                <Text style={s.desc} testID="detail-desc">{desc}</Text>
                {/* Whose words those are, on a line of their own under
                    them, starting at the paragraph's left edge (owner, 17
                    Oct 2026). From 12 Oct it was the paragraph's last run,
                    after two spaces — a pull quote's attribution, on the
                    reading that a line of its own broke the paragraph's
                    rhythm. On the phone the run wrapped wherever the
                    sentence happened to end, and the mark could be left at
                    the end of one line with the name alone on the next: a
                    stray glyph, and a name with no platform. On its own
                    line the two are never parted, and the press is the
                    line alone (see `openBlurb`).

                    After the blurb rather than before it because the
                    sentence is what the reader came for; the attribution
                    answers a question they only have once they have read
                    it. At 15pt against the paragraph's 16, in the link
                    colour when it goes somewhere — one step down says
                    "attribution", two said "footnote".

                    Google is credited by platform alone. The import copies
                    `editorialSummary`, which Google writes and signs with
                    nobody, so there is no author to name and naming one
                    would be an invention. Threads has a person, and that
                    person is the reason the copy is good.

                    Plain text when there is nowhere to go: a tappable line
                    that does nothing is worse than an untappable one.

                    The platform's mark leads the line, and once it is there
                    the words stop naming the platform: "gowithchinne" under
                    the Threads glyph says what "@gowithchinne on Threads"
                    said, in a third of the line. The @ goes with them — it
                    is a second marker for the thing the glyph already
                    marks. The glyph rides inside the Text and takes its
                    baseline, which is what makes a glyph beside words read
                    as one line rather than two objects. VoiceOver cannot
                    read a glyph, so the label says the platform the glyph
                    shows. A source with no mark keeps the long wording;
                    there is nothing else to carry it. */}
                {creditLine && (openBlurb ? (
                  <PressableScale
                    contentStyle={s.creditRow}
                    scaleTo={0.97}
                    // The line is 19pt tall and as wide as a handle; this
                    // makes it a 44pt target without drawing one.
                    hitSlop={{ top: 12, bottom: 12, left: 8, right: 16 }}
                    onPress={openBlurb}
                    accessibilityRole="link"
                    accessibilityLabel={creditLabel}
                    testID="blurb-credit"
                  >
                    {creditLine}
                  </PressableScale>
                ) : (
                  <View style={s.creditRow} accessibilityLabel={creditLabel} testID="blurb-credit">
                    {creditLine}
                  </View>
                ))}
                {descFallback ? (
                  <Text style={s.descFallback} testID="blurb-fallback">{descFallback}</Text>
                ) : null}
              </View>
            </View>

          </Card>
          ) : null}

          {/* The one offer this screen makes to the person who put the
              place here. Draws nothing for everybody else — see
              `LocalGuidePanel`, which asks `canAddPhoto` before it asks
              for anything else.

              Last of the four, and it moved twice to get here. It began
              between the rating and the pills, on the argument that being
              above the pills kept it from interrupting; being above the
              pills *was* the interruption, so it went below them. That
              still left it between the pills and the reason to go, which
              is the same fault one block further down: name, pills and
              highlights are one argument about the place, made to everybody,
              and this panel is a request made to one person by name. An
              argument is not interrupted halfway to be asked a favour.

              So it comes after the argument ends and before the facts
              begin — which is also where the eye is already looking for
              something to do. */}
          <LocalGuidePanel
            place={place}
            onOpen={() => navigation.navigate('Gallery', { slug: place.slug })}
            testID="guide-panel"
          />

          {/* ── info card ── */}
          {firstRow != null && (
            <Card style={s.infoGroup} testID="detail-info-card">
              {place.address && (
                <InfoRow
                  icon="location-outline"
                  label={t('Address', 'Địa chỉ', '住所', '地址', '地址')}
                  first={firstRow === 'address'}
                  onPress={mapsUrl ? toMaps : undefined}
                  hug={!!mapsUrl && !showsMap}
                  /* Only when there is no map to put the button on. It used
                     to live here always, and the row has no `gap`, so the
                     address ran straight into it: measured off a real
                     render, "The Crest Residence, 15 Đ. Trần" stopped 5pt
                     short of the pill, and five is where that line happened
                     to break rather than anything anybody chose.

                     Worse than the touching was the width. The button is
                     104.7pt of the 318.7pt the address could have, a third
                     of the row, and it cost half the catalog a second line:
                     of 671 addresses, 332–415 fit on one line beside it
                     against 582–613 without, and 6–16 needed a third line
                     and got clamped where none would. So on a card with a
                     map the button moves onto the picture and the address
                     takes the whole width; see `goOnMap`.

                     And when it does fall back here it is a square with
                     the arrow, since 12 Oct 2026, not the labelled pill:
                     36pt beside the address rather than 105 at the row's
                     end (`hug`), so the address keeps its width and the
                     control sits with the value it acts on — the owner's
                     sketch. The arrow is the same glyph the disc on the
                     map wears, and it keeps its name for VoiceOver. On the
                     accent's tint, not the glass with a hairline the pill
                     had: a glyph with no word beside it needs a ground
                     that says "control" on its own, and the tint is what
                     `MiniMap`'s own locate button stands on. */
                  trailing={mapsUrl && !showsMap ? (
                    <PressableScale
                      onPress={toRoute}
                      accessibilityRole="button"
                      accessibilityLabel={t('Directions', 'Chỉ đường', '経路', '路线', '路線')}
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      style={s.goSlot}
                      contentStyle={s.go}
                      testID="detail-directions"
                    >
                      <Glyph name="navigate" size={ICON.action} color={colors.accent} />
                    </PressableScale>
                  ) : undefined}
                >
                  {/* Two lines, then an ellipsis, and a tap opens it.
                      Of the 648 published places, 254 fit on one line
                      beside the button and 606 fit in two; 42 do not, and
                      those forty-two are the whole of this. A card that
                      grows to five lines for one address in fifteen costs
                      the other fourteen the opening hours.

                      `measured` is the first paint, deliberately
                      unclamped: `onTextLayout` reports the lines it
                      actually drew, so a Text already limited to two can
                      only ever report two and could never say whether
                      there was a third. Measuring before clamping is the
                      one way to know. It costs one frame on the long ones
                      — the full address, then the clamp — during the same
                      mount the photographs are still arriving in. */}
                  <Pressable
                    onPress={addrLong ? () => setAddrOpen((v) => !v) : undefined}
                    disabled={!addrLong}
                    accessibilityRole={addrLong ? 'button' : undefined}
                    accessibilityState={addrLong ? { expanded: addrOpen } : undefined}
                    accessibilityHint={addrLong
                      ? t('Shows the whole address', 'Xem đầy đủ địa chỉ', '住所の全文を表示', '显示完整地址', '顯示完整地址')
                      : undefined}
                    testID="detail-address-toggle"
                  >
                    <Text
                      style={s.infoValue}
                      testID="detail-address"
                      numberOfLines={measured == null || addrOpen ? undefined : ADDRESS_LINES}
                      onTextLayout={(e) => {
                        if (measured == null) setMeasured(e.nativeEvent.lines.length);
                      }}
                    >
                      {address}
                    </Text>
                  </Pressable>
                </InfoRow>
              )}

              {/* The map, under the address it answers.
                  It used to be a card of its own below this one, which asked
                  the reader to bind "where" to two separate objects — the
                  words in one box, the picture in another. Here it is the
                  address's own illustration.

                  Frozen (`interactive={false}`), because a live map inside a
                  vertical scroll is a hole the page cannot be scrolled
                  through. And drawn only where the binary has a Google Maps
                  SDK — Expo Go on iOS, or a build made without the key, get
                  no map. Being inside the card now, that absence has to be
                  quiet: the rows close over the gap and the card is simply a
                  card without a picture. */}
              {showsMap && (
                <View style={s.mapSlot}>
                  <MiniMap
                    lat={place.lat!}
                    lng={place.lng!}
                    height={150}
                    interactive={false}
                    onPick={toMaps}
                    /* The same picture this place wears on Explore's map,
                       instead of Google's default red teardrop — which
                       said only "a place", on a screen that is already
                       about one place, while the chips two rows up said
                       Focus and Cafés.

                       `chip` is null because a detail page stands in no
                       filter, and `chosen` is false on purpose: the coral
                       variant exists to win a fight with 250 other pins,
                       and there is no fight here. Plain keeps the
                       category's own colour as the fill, which is the
                       thing being said. */
                    pin={pinImage(place, null, false)}
                  />
                  {/* Bottom right, and that corner is not a taste. Google's
                      terms require their attribution stay visible, and the
                      logo sits bottom *left* — measured off a real render,
                      60 × 29pt. The map is 150pt tall, so a 40pt disc in
                      the opposite corner clears it with room to spare.

                      A disc and no word. The labelled pill was 104.7pt
                      wide and laid that much of a 320pt map under itself,
                      covering street names on a picture whose whole job is
                      street names. The arrow is the same glyph the row
                      carried and the same one `MiniMap`'s locate button
                      wears, and it keeps its name for VoiceOver — what
                      goes is the ink on the tiles, not the label.

                      Tapping the map already opened Maps; this only says
                      so. Which is the same argument that first put the
                      button on the row — an address looks like a fact, not
                      a button — now made where it costs the picture least. */}
                  <PressableScale
                    onPress={toRoute}
                    accessibilityRole="button"
                    accessibilityLabel={t('Directions', 'Chỉ đường', '経路', '路线', '路線')}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={s.goOnMap}
                    contentStyle={s.goDisc}
                    testID="detail-directions"
                  >
                    <Glyph name="navigate" size={ICON.action} color={colors.accent} />
                  </PressableScale>
                </View>
              )}

              {hours.length > 0 && (
                <View>
                  {firstRow !== 'hours' && <View style={s.rowDivider} />}
                  {/* The one line most people came for is the whole row;
                      the table it was derived from waits behind the
                      chevron instead of pushing Call and Website off the
                      screen. Green when open; closed is a fact about a
                      café, not a fault, so it stays in the quiet grey
                      rather than going red. */}
                  <Pressable
                    onPress={() => setHoursOpen((v) => !v)}
                    style={s.infoStack}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: hoursOpen }}
                  >
                    <View style={s.infoIconSlot}>
                      <Glyph name="time-outline" size={ICON.action} color={colors.textTertiary} />
                    </View>
                    <View style={s.infoWords}>
                      <Text style={s.infoLabel}>{t('Hours', 'Giờ mở cửa', '営業時間', '营业时间', '營業時間')}</Text>
                      {openNow ? (
                        <Text style={[s.openNow, !openNow.open && s.openNowShut]}>
                          {/* Whole sentences per language, not a preposition
                              glued to a time: Japanese puts "まで" after the
                              hour, so concatenating a translated "until" in
                              front of it reads backwards. */}
                          {openNow.open
                            ? openNow.untilMin != null
                              ? t(
                                `Open now · until ${clockOf(openNow.untilMin)}`,
                                `Đang mở cửa · đến ${clockOf(openNow.untilMin)}`,
                                `営業中 · ${clockOf(openNow.untilMin)}まで`,
                                `营业中 · 营业至 ${clockOf(openNow.untilMin)}`, `營業中 · 營業至 ${clockOf(openNow.untilMin)}`,
                              )
                              : t('Open now · 24 hours', 'Đang mở cửa · 24 giờ', '営業中 · 24時間', '营业中 · 24小时', '營業中 · 24小時')
                            : openNow.opensAtMin != null
                              ? t(
                                `Closed · opens ${clockOf(openNow.opensAtMin)}`,
                                `Đã đóng cửa · mở lúc ${clockOf(openNow.opensAtMin)}`,
                                `閉店中 · ${clockOf(openNow.opensAtMin)}開店`,
                                `已打烊 · ${clockOf(openNow.opensAtMin)} 开门`, `已打烊 · ${clockOf(openNow.opensAtMin)} 開門`,
                              )
                              : t('Closed today', 'Hôm nay đóng cửa', '本日休業', '今日休息', '今日休息')}
                        </Text>
                      ) : null}
                      {/* Hours in a shape openState cannot read still get
                          their table behind the chevron; the label alone
                          heads the row until it is opened. */}
                    </View>
                    {/* The same box as the clock opposite it. Left
                        top-aligned it would have stayed where the clock
                        used to be and the row would read as two glyphs at
                        two heights — the raggedness this change is about,
                        moved to the other end of the row. */}
                    <View style={s.infoChevronSlot}>
                      <Glyph name={hoursOpen ? 'chevron-up' : 'chevron-down'} size={ICON.action} color={colors.textTertiary} />
                    </View>
                  </Pressable>
                  {hoursOpen && (
                    // Indented to the gutter the values keep, so the table
                    // reads as this row's working rather than as a fifth fact.
                    <View style={s.hoursTable}>
                      {hours.map((row) => (
                        <View key={row.label} style={s.hourRow}>
                          <Text style={s.hourDay}>{row.label}</Text>
                          <Text style={s.hourTime}>{row.hours}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {place.phone && (
                <InfoRow
                  icon="call-outline"
                  label={t('Phone', 'Điện thoại', '電話番号', '电话', '電話')}
                  first={firstRow === 'phone'}
                  onPress={() => open(
                    `tel:${place.phone!.replace(/\s/g, '')}`,
                    t('Could not place the call', 'Không gọi được', '電話をかけられませんでした', '无法拨打电话', '無法撥打電話'),
                  )}
                >
                  <Text style={[s.infoValue, s.infoLink]}>{place.phone}</Text>
                </InfoRow>
              )}

              {/* The venue's own accounts, above the website, because a
                  handle is a name and a domain is an address — and because
                  for a café in this catalog the account is usually where
                  the news is. Ionicons' own `logo-` glyphs rather than the
                  brands' full-colour marks: two saturated logos in a grey
                  gutter pull the eye off the words, and the column those
                  glyphs belong to is the point of the card. */}
              {ig && (
                <InfoRow
                  icon="logo-instagram"
                  label="Instagram"
                  first={firstRow === 'instagram'}
                  onPress={() => open(
                    instagramUrl(ig),
                    t('Could not open Instagram', 'Không mở được Instagram', 'Instagramを開けませんでした', '无法打开 Instagram', '無法開啟 Instagram'),
                  )}
                >
                  <Text style={[s.infoValue, s.infoLink]} numberOfLines={1} testID="detail-instagram">
                    {atHandle(ig)}
                  </Text>
                </InfoRow>
              )}

              {th && (
                <InfoRow
                  icon="logo-threads"
                  label="Threads"
                  first={firstRow === 'threads'}
                  onPress={() => open(
                    threadsUrl(th),
                    t('Could not open Threads', 'Không mở được Threads', 'Threadsを開けませんでした', '无法打开 Threads', '無法開啟 Threads'),
                  )}
                >
                  <Text style={[s.infoValue, s.infoLink]} numberOfLines={1} testID="detail-threads">
                    {atHandle(th)}
                  </Text>
                </InfoRow>
              )}

              {site && (
                <InfoRow
                  icon="globe-outline"
                  label={t('Website', 'Trang web', 'ウェブサイト', '网站', '網站')}
                  first={firstRow === 'website'}
                  onPress={() => open(
                    websiteHref(site),
                    t('Could not open the website', 'Không mở được trang web', 'ウェブサイトを開けませんでした', '无法打开网站', '無法開啟網站'),
                  )}
                >
                  {/* The domain, not the URL. What was here trimmed the
                      scheme and the `www.` and left everything else, so 70
                      of the catalog's 413 websites ran off the end of the
                      row mid-tracking-parameter. The tap still carries the
                      whole address; only the label is short. */}
                  <Text style={[s.infoValue, s.infoLink]} numberOfLines={1} testID="detail-website">
                    {hostOf(site)}
                  </Text>
                </InfoRow>
              )}
            </Card>
          )}

        </View>
      </ScrollView>
      {/* The worn pill's sheet: the history of visits here, newest
          first, each in the reader's own date format with its own undo
          on the right, and "again" below when the rules allow it. The
          list scrolls past HISTORY_ROWS rows rather than growing the
          sheet off the top of the screen — three a day for a regular
          adds up — and the count in the header says when it does. */}
      {showCheckin && latestVisit && (
        <ActionSheet
          visible={checkinMenu}
          onClose={() => setCheckinMenu(false)}
          actions={checkinActions}
          header={(
            <View style={s.checkinHead}>
              {/* The count is the Profile's pill at the row's end, not a
                  line of words under the title: one shape for "how many"
                  across the app, and 20pt of sheet given back. Inset by
                  the history card's padding so it stands on the trash
                  column's axis below. */}
              <View style={s.checkinHeadRow} testID="checkin-head">
                <Text style={s.checkinHeadTitle}>{t('Checked in here', 'Bạn đã check-in ở đây', 'ここにチェックイン済み', '你在这里打过卡', '你在這裡打過卡')}</Text>
                <CountBadge n={visitsHere.length} style={s.checkinCount} />
              </View>
              <ScrollView style={s.history} bounces={false} showsVerticalScrollIndicator={visitsHere.length > HISTORY_ROWS}>
                {visitsHere.map((v, i) => {
                  const d = new Date(v.at);
                  return (
                    <View key={v.id} style={[s.historyRow, i > 0 && s.historyDivider]} testID="checkin-visit">
                      <Glyph name="time-outline" size={ICON.action} color={colors.textTertiary} />
                      <Text style={s.historyText} numberOfLines={1}>
                        {dateline(lang, d)} · {clockOf(d.getHours() * 60 + d.getMinutes())}
                      </Text>
                      <PressableScale
                        onPress={() => { void undoCheckin(v.id); }}
                        // One id for every row's trash: a flow tidying up
                        // taps the first until the sheet closes itself.
                        testID="checkin-visit-remove"
                        scaleTo={0.85}
                        hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                        accessibilityRole="button"
                        accessibilityLabel={t('Remove this visit', 'Bỏ lần ghé này', 'この訪問を削除', '删除这次打卡', '刪除這次打卡')}
                      >
                        <Glyph name="trash-outline" size={ICON.action} color={colors.bad} />
                      </PressableScale>
                    </View>
                  );
                })}
              </ScrollView>
              {canAgain && (
                <GradientCta
                  wide
                  icon="location"
                  label={t('Check in again', 'Check-in lần nữa', 'もう一度チェックイン', '再次打卡', '再次打卡')}
                  onPress={() => { setCheckinMenu(false); void checkIn(); }}
                  testID="detail-checkin-again"
                />
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}
