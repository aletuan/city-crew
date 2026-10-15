// Place detail — hero carousel with a page count, floating share/save and
// the place's kinds as glyphs, the score with check-in beside it, and one
// grouped card of Address / Hours / Call / Website rows, the weekly table
// folded behind the open-now line.
//
// The hero is full-bleed: edge to edge, and up under the status bar, with
// only its bottom corners rounded. It was a 12pt-inset rounded card, which
// read as a picture *placed on* the page rather than as the place's own
// front door — the same argument Explore's hero settled, and the two
// screens now open the same way. What that costs is spelled out where it
// is paid: the safe area (the screen no longer insets its top, the hero
// swallows it), the ink under the clock (`useOwnedStatusBar`), and the
// two scrims that keep white glyphs readable over an unknown photograph.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet,
  Text, useWindowDimensions, View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFlag } from '../lib/useFlag';
import { useAuth } from '../lib/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { addCheckin, coverOf, fmtCount, isFree, photosOf, removeCheckin, usePlaceBySlug } from '../lib/data';
import { useMyCheckins } from '../lib/checkins';
import { reviewAfterCheckin } from '../lib/askReview';
import { canRepeat, latestCheckin, visitsAt } from '../lib/checkin';
import { DAILY_CAPS, isDailyLimit } from '../lib/quota';
import ActionSheet, { type SheetAction } from '../components/ActionSheet';
import { usePlaces } from '../lib/catalog';
import { shortAddress } from '../lib/address';
import { splitName, subtitleBeside } from '../lib/name';
import { useCity } from '../lib/city';
import { CATEGORIES, categoriesOf, categoryLabel } from '../lib/categories';
import MiniMap, { canDrawMap } from '../components/MiniMap';
import PhotoCarousel from '../components/PhotoCarousel';
import { PAGE_COUNT_H } from '../components/PageCount';
import { pinImage } from '../components/mapPins';
import {
  atHandle, hostOf, instagramUrl, threadsUrl, websiteRepeatsHandle,
} from '../lib/links';
import { cityTz } from '../lib/clock';
import { clockOf, dateline, groupHours, openState } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { localized, localizedLang } from '../lib/localized';
import { blurbCredit, blurbIcon, blurbLink } from '../lib/blurbSource';
import { mapsRouteUrl, mapsSearchUrl } from '../lib/maps';
import { vibeLabel } from '../lib/vibes';
import { useSave } from '../lib/save';
import { shareSafely } from '../lib/share';
import { useNoteEvent } from '../lib/tasteProfile';
import { colors, display, font, onPhoto, radius, space, type } from '../theme';
import { AmbientWarmth, Card, CountBadge, Empty, GradientCta, PressableScale, successHaptic, useOwnedStatusBar, useTabBarClearance } from '../components/ui';
import PricePill from '../components/PricePill';
import LocalGuidePanel from '../components/LocalGuidePanel';
import type { Nav, RootRoute } from '../nav';

// One row of the grouped info card: a small caps label over a value, the
// whole row the target.
//
// ── what came off it ──
//
// These were four stacked cards, each wearing a 44pt accent circle. Then
// one card, each row with a monochrome glyph on the left and an accent
// verb on the right — Route, Call, Open. Then this. The glyph and the
// label said the same thing twice, and the label is the one that
// translates; the verb named what a tap anywhere on the row already did,
// and the value is the thing you would tap. So the value carries the
// accent when the row goes somewhere — the address, the number, the site
// are the links, the way a phone number is in Contacts — and a row that
// goes nowhere stays grey. One mark per row, and it is the row's own
// content.
/**
 * A fact, with the glyph that names its kind in a gutter down the left.
 *
 * The glyph is not decoration and it is not a second copy of the label:
 * it is the thing that lets the eye find the phone number without
 * reading, and it gives the card a left edge the values line up against.
 * The hairline starts where the labels do rather than at the card's edge,
 * so the gutter reads as one column rather than as four interruptions.
 */
function InfoRow({ icon, label, first, onPress, trailing, hug, children }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** The row that opens the card draws no hairline above itself. */
  first?: boolean;
  onPress?: () => void;
  /** A control at the row's end. A row carrying one is not itself
   *  pressable: two targets in one row, the outer one swallowing taps
   *  meant for the inner, is a worse row than one honest button. */
  trailing?: React.ReactNode;
  /** The words take only the width they need, so a control after them
   *  sits beside the value rather than at the row's far end. For a row
   *  whose control belongs to its value — Directions to the address —
   *  and not to the row. */
  hug?: boolean;
  children: React.ReactNode;
}) {
  const tappable = !!onPress && !trailing;
  return (
    <>
      {!first && <View style={s.rowDivider} />}
      <Pressable
        onPress={tappable ? onPress : undefined}
        disabled={!tappable}
        style={s.infoStack}
        accessibilityRole={tappable ? 'button' : undefined}
      >
        <View style={s.infoIconSlot}>
          <Ionicons name={icon} size={19} color={colors.textTertiary} />
        </View>
        <View style={[s.infoWords, hug && s.infoWordsHug]}>
          <Text style={s.infoLabel}>{label}</Text>
          {children}
        </View>
        {trailing}
      </Pressable>
    </>
  );
}

/** The check-in sheet's history: five rows in view, the rest scroll.
 *  Five is a week of ordinary visits at a glance; 48 is the row the
 *  Trips list uses for a one-line item, and five of them are 240 of a
 *  sheet that must still leave the pill's row visible behind it. */
const HISTORY_ROWS = 5;
const HISTORY_ROW = 48;

export default function PlaceDetailScreen({ navigation, route }: { navigation: Nav; route: RootRoute<'PlaceDetail'> }) {
  const { t, lang } = useI18n();
  const { city, cities } = useCity();
  const { save, isSaved, askToSignIn } = useSave();
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
  const place = inCatalog ?? elsewhere.data ?? undefined;
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
  const coverUri = place ? coverOf(place)?.photo_uri ?? null : null;
  const [pagedFor, setPagedFor] = useState(coverUri);
  if (pagedFor !== coverUri) {
    setPagedFor(coverUri);
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
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;
  const showCheckin = useFlag('place_checkin');
  // The reader's visits — the one copy the whole app shares, so the
  // reload after a tap here is what the profile's count draws too.
  const visits = useMyCheckins();
  const [checkinMenu, setCheckinMenu] = useState(false);
  // The category icons on the cover say their names on a tap, and say
  // nothing until then — see "kinds" over the hero.
  const [kindsOpen, setKindsOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  // How many lines the address wanted before anything clamped it, and
  // whether the reader has asked for the rest. `null` is "not measured
  // yet", which is also the one paint that runs unclamped. Up here with
  // the other hooks rather than beside the row that uses them: there is a
  // `return` for the not-found face between the two places, and a hook
  // after it is a hook that some renders do not reach.
  const [measured, setMeasured] = useState<number | null>(null);
  const [addrOpen, setAddrOpen] = useState(false);
  const saved = isSaved(route.params.slug);
  const tabClearance = useTabBarClearance();
  const insets = useSafeAreaInsets();

  // Light ink for as long as a photograph is what sits under the clock,
  // and null — the scheme's own — the rest of the time: while this screen
  // is still resolving, and again once the page has scrolled up past the
  // hero, where the ground under the clock is paper and white ink would
  // be white on cream. A place reached from another city arrives a beat
  // late, which is the render that has to re-ask.
  const pastHeroRef = useRef(false);
  const heroEndRef = useRef(0);
  const applyBar = useOwnedStatusBar(() => (place && !pastHeroRef.current ? 'light' : null));
  useEffect(applyBar, [!!place, applyBar]);
  // Built once and holding its first closure, so the threshold it compares
  // against is read through a ref — the same arrangement, and the same
  // reason, as Explore's.
  const onScroll = useRef((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const past = e.nativeEvent.contentOffset.y > heroEndRef.current;
    if (past === pastHeroRef.current) return;
    pastHeroRef.current = past;
    applyBar();
  }).current;

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
    return <SafeAreaView style={s.screen}><Empty text={t('Place not found.', 'Không tìm thấy địa điểm.', 'スポットが見つかりません。')} /></SafeAreaView>;
  }

  const photos = photosOf(place);
  const reviews = fmtCount(place.rating_count);
  const cats = categoriesOf(place);
  const priceShown = showPrice && (place.price_display || place.price_vnd != null);
  // Full width, and tall enough that what shows *below* the status bar is
  // still the 4:3.4 frame the inset card had — the inset's worth of
  // picture behind the clock is added, not taken out of the composition.
  const heroW = width;
  const heroH = Math.round(width * (3.4 / 4)) + insets.top;
  // Past once the photo's last 44pt are leaving — the moment the picture
  // stops being what is under the clock.
  heroEndRef.current = heroH - insets.top - 44;
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
  // The district line under the title is only for a place with no
  // address row: the short address ends in the ward, so with one on the
  // card the line said the same word a few lines up, and a bare district
  // under a tagline reads as a second tagline. The subtitle is judged
  // against the district either way — a branch named after its ward
  // ("CTQ Texas BBQ - Hà Đông") would otherwise repeat the word the
  // address ends in, which is the same repetition the line was hidden
  // to avoid.
  const showsNeighborhood = !place.address;
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
      ? t('In English', 'Bản tiếng Anh', '英語の原文')
      : t('In Vietnamese', 'Bản tiếng Việt', 'ベトナム語の原文'))
    : null;
  // Who wrote the sentence above it. Null for most places — the desk wrote
  // its own copy, and there is nobody outside to name.
  const blurbFrom = blurbCredit(place);
  const blurbHref = blurbLink(place);
  const blurbMark = blurbFrom && blurbIcon(blurbFrom);
  // The words and the credit under them are one object to a reader: both
  // are the quote, and a reader who wants the source taps whichever their
  // thumb is nearest. So they share a handler rather than only the small
  // grey line at the bottom carrying it.
  const openBlurb = blurbHref
    ? () => open(blurbHref, t('Could not open the source', 'Không mở được nguồn', 'ソースを開けませんでした'))
    : undefined;
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

  // The dash only joins two things: a place with no address shares its
  // name alone, not a name trailing off into punctuation.
  //
  // Through `lib/share`: the tap that closes the system sheet above its
  // top edge would otherwise land on this screen's buttons underneath.
  const share = () => {
    void shareSafely({
      message: `${fullName}${place.address ? ` — ${place.address}` : ''}${mapsUrl ? `\n${mapsUrl}` : ''}`,
    });
  };
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
    t('Could not open Maps', 'Không mở được bản đồ', 'マップを開けませんでした'),
  );
  const toRoute = () => open(
    routeUrl!,
    t('Could not open Maps', 'Không mở được bản đồ', 'マップを開けませんでした'),
  );
  // Websites are typed in by hand and often arrive bare (`congcaphe.com`),
  // which `openURL` cannot route; with no scheme of its own, it is a web
  // address.
  const websiteUrl = site && !/^[a-z][a-z\d+.-]*:\/\//i.test(site)
    ? `https://${site}`
    : site;

  // What lies over the hero whether or not it has photographs: the two
  // scrims, the three floating buttons, the counter. Laid between the
  // pages and the marks by `PhotoCarousel`, so the marks stay on top of
  // the scrim they were sized against; laid over the grey fallback the
  // same way when there is nothing to page.
  const heroOverlays = (
    <>
            {/* Two scrims, and neither is a wash over the picture.
                The top one exists for the clock and the three discs and for
                nothing else: it is strongest at the very top edge and gone
                within the status bar's own height plus a little, so on most
                photographs you cannot point at where it ends.
                The bottom one is the older job — the page count, the kinds
                and the credit sit on it — and it now also gives the rounded
                corners something to end in rather than a hard cut. */}
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(10,11,10,0.36)', 'rgba(10,11,10,0.10)', 'transparent']}
              locations={[0, 0.45, 1]}
              style={[s.heroScrimTop, { height: insets.top + 78 }]}
            />
            <LinearGradient
              pointerEvents="none"
              colors={['transparent', 'rgba(10,11,10,0.34)']}
              style={s.heroScrimBottom}
            />

            <PressableScale
              onPress={() => navigation.goBack()} scaleTo={0.9}
              containerStyle={[s.fabSlot, { left: space.page, top: insets.top + 8 }]} style={s.fab} accessibilityLabel="Back"
              accessibilityRole="button"
              testID="detail-back"
            >
              <Ionicons name="chevron-back" size={22} color={onPhoto.text} />
            </PressableScale>
            <PressableScale
              onPress={share} scaleTo={0.9}
              containerStyle={[s.fabSlot, { right: space.page + 52, top: insets.top + 8 }]} style={s.fab} accessibilityLabel="Share"
              accessibilityRole="button"
            >
              <Ionicons name="share-outline" size={20} color={onPhoto.text} />
            </PressableScale>
            {/* The same control as the bookmark on the card that got you
                here — same glyph, same sheet, same rows underneath. It was a
                heart wired to component state: it filled in, it meant
                nothing, and it forgot on the way back. */}
            <PressableScale
              onPress={() => save(place)} scaleTo={0.9} haptic="selection"
              containerStyle={[s.fabSlot, { right: space.page, top: insets.top + 8 }]} style={s.fab}
              accessibilityRole="button"
              accessibilityState={{ selected: saved }}
              // Two ids for the two states, so a smoke flow can wait on the
              // save having landed without reading a trilingual label.
              testID={saved ? 'detail-saved' : 'detail-save'}
              accessibilityLabel={saved
                ? t('Saved — change collections', 'Đã lưu — đổi bộ sưu tập', '保存済み — コレクションを変更')
                : t('Save to a collection', 'Lưu vào bộ sưu tập', 'コレクションに保存')}
            >
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={saved ? onPhoto.accent : onPhoto.text} />
            </PressableScale>

            {/* ── kinds ──
                What kind of place this is, as glyphs on the picture, where
                it used to be a row of labelled pills under the rating. That
                row was the fourth band of boxes between the photograph and
                the first fact a reader acts on, and the owner's reference
                drew the kinds where the eye already is: bottom left, the
                corner the page count leaves free.

                The material is the cover's, not the page's. The back,
                share and bookmark discs are one dark glass in both themes
                because the ground under them is a photograph, not paper or
                charcoal; a paper pill here would vanish into a bright
                storefront, which is exactly what this cover has.

                Glyphs in each kind's own hue, the one its chip wears on
                Explore and its dot on the map. They shipped white first
                (#854), beside the three white discs, and that broke the
                rule `collectionBadge` on Explore records: a category glyph
                wears its colour everywhere, because a colour code is only a
                code if it holds everywhere, and the one white glyph that
                used to exist was taken out for exactly that. The hues are
                mid-tones made for dark ground, and this ground is dark
                glass in both themes.

                Words on a tap. Six of the nine glyphs say their kind on
                sight; three do not — Views is a building, Culture a
                library, Focus a book — so a tap names them, in a caption
                over the cluster, and a second tap takes it away. Over it,
                not inside it: opened in place, three names made the pill
                about 330pt wide, and on a 390pt phone the page count
                leaves it about 285 (it measured against the dots' 250
                first). VoiceOver hears the names either way. */}
            {cats.length > 0 && (
              <PressableScale
                onPress={() => setKindsOpen((o) => !o)}
                scaleTo={0.96}
                haptic="selection"
                accessibilityRole="button"
                accessibilityLabel={cats.map((c) => categoryLabel(c, t)).join(', ')}
                accessibilityState={{ expanded: kindsOpen }}
                containerStyle={[s.fabSlot, s.kindsSlot]}
                style={s.kinds}
                testID="detail-kinds"
              >
                {cats.map((c, i) => (
                  <React.Fragment key={c}>
                    {i > 0 ? <View style={s.kindsRule} /> : null}
                    <Ionicons name={CATEGORIES[c]?.icon ?? 'pricetag-outline'} size={19} color={CATEGORIES[c]?.color ?? onPhoto.text} />
                  </React.Fragment>
                ))}
              </PressableScale>
            )}
            {cats.length > 0 && kindsOpen ? (
              <View
                pointerEvents="none"
                style={[s.fabSlot, s.kindsTip, { maxWidth: heroW - 2 * space.page }]}
                testID="detail-kinds-names"
              >
                <Text style={s.kindText}>{cats.map((c) => categoryLabel(c, t)).join(' · ')}</Text>
              </View>
            ) : null}

            {/* Where the reader is in the photographs is `PageCount`'s
                "2 / 4" at the bottom right, drawn by the carousel — see
                that file for why a count and not dots. Not read aloud:
                each photograph is "Photo n of m" by itself. */}
    </>
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
        t('Could not check in', 'Không check-in được', 'チェックインできませんでした'),
        isDailyLimit(e)
          ? t(
            `You have checked in here ${DAILY_CAPS.checkinsPerPlace} times today. Come back tomorrow.`,
            `Hôm nay bạn đã check-in ở đây ${DAILY_CAPS.checkinsPerPlace} lần rồi. Mai quay lại nhé.`,
            `今日はここに${DAILY_CAPS.checkinsPerPlace}回チェックイン済みです。また明日どうぞ。`,
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
      Alert.alert(t('Could not remove it', 'Không bỏ được', '削除できませんでした'), (e as Error).message);
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
    title: t('Write a review', 'Viết đánh giá', 'レビューを書く'),
    desc: t('Coming soon — share what it was like.', 'Sắp có — chia sẻ trải nghiệm của bạn.', '近日公開 — 感想を共有できます。'),
    onPress: () => {},
  }];

  // The vibe chips, drawn in the highlights card when there is a
  // paragraph and bare when there is not — see the card's note.
  const vibes = place.vibe_tags.length ? (
    <View style={[s.vibes, desc ? null : s.vibesBare]} testID="detail-vibes">
      {place.vibe_tags.map((v) => (
        <View key={v} style={s.vibe} testID={`detail-vibe-${v}`}>
          <Text style={s.vibeText}>{vibeLabel(v, t)}</Text>
        </View>
      ))}
    </View>
  ) : null;

  return (
    // No top safe area: the photograph is what belongs against the top of
    // the glass, and insetting the screen is exactly what put a beige band
    // above it. The bottom is cleared by `tabClearance`, as before.
    <View style={s.screen}>
      <AmbientWarmth style={{ top: heroH - 60, height: 620 }} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: tabClearance }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* ── hero carousel ──
            `PhotoCarousel`'s paging, given the screen's width and the
            height this screen decides, remounted when the desk changes the
            cover under it so the strip starts again at the new first page.
            The marks sit at the page margin because this picture runs to
            the screen's edge; the credit moves to the middle, see `attr`. */}
        <View style={[s.heroWrap, { height: heroH }]}>
          {photos.length > 0 ? (
            <PhotoCarousel
              pages={photos}
              page={photoIndex}
              onPage={setPhotoIndex}
              width={heroW}
              height={heroH}
              scrollKey={coverUri ?? 'no-cover'}
              countRight={space.page}
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
          {/* ── the name, then what it scored ──
              One column, not two. The rating used to sit in a badge beside
              the title, which cost the name 109pt of the 386 it could have
              had and made it wrap far more often than it needed to: 32% of
              places on a 393pt phone, against 7% at full width. Measured
              off the catalog, that is 167 places getting a whole line of
              26pt back.
              The rating loses nothing by moving. A score and a count are
              one short line of text; a badge was a box drawn around them,
              and the box was the part that was expensive. */}
          {/* ── "City Crew pick", over the name ──
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
              Japanese, which has no case, so one style serves three. */}
          {place.is_featured ? (
            <View style={s.pick} testID="detail-pick">
              <Ionicons name="ribbon-outline" size={13} color={colors.accent} />
              <Text style={s.pickText}>{t('City Crew pick', 'City Crew chọn', 'City Crew のおすすめ')}</Text>
            </View>
          ) : null}
          <Text style={s.name} testID="detail-name">{name.title}</Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
          {showsNeighborhood ? (
            <View style={s.locRow}>
              <Ionicons name="location-outline" size={15} color={colors.textTertiary} />
              <Text style={s.loc}>{neighborhood}</Text>
            </View>
          ) : null}
          {/* ── the score, and the one thing to do about it ──
              The rating at the left, check-in at the right: one line that
              used to be two bands, the score and then a row of category
              pills with the pill at its end. The categories are on the
              cover now (see "kinds"); what was left of their row was a
              control with nothing to sit beside. */}
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
                  ? `${place.rating} — ${reviews} ${t('reviews', 'đánh giá', '件のレビュー')}`
                  : String(place.rating)}
              >
                <Ionicons name="star" size={17} color={colors.accent} />
                <Text style={s.ratingValue}>{place.rating}</Text>
                {reviews ? (
                  <>
                    <Text style={s.ratingDot}>·</Text>
                    <Text style={s.ratingCount}>{reviews} {t('reviews', 'đánh giá', '件のレビュー')}</Text>
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
                  <Ionicons name="pricetag-outline" size={15} color={colors.textSecondary} />
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
                  ? t('Visited — options', 'Đã qua — tuỳ chọn', '訪問済み — オプション')
                  : t('Check in', 'Check-in', 'チェックイン')}
                containerStyle={s.checkinSlot}
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
                style={[s.checkin, latestVisit && s.checkinOn]}
                testID={latestVisit ? 'detail-checked-in' : 'detail-checkin'}
              >
                <Ionicons name={latestVisit ? 'checkmark-circle' : 'checkmark-circle-outline'} size={15} color={latestVisit ? colors.okInk : colors.accent} />
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
                    {latestVisit ? t('Visited', 'Đã qua', '訪問済み') : t('Check in', 'Check-in', 'チェックイン')}
                  </Text>
                  <Text
                    style={[s.goText, s.checkinGhost]}
                    aria-hidden
                    importantForAccessibility="no-hide-descendants"
                    testID="detail-checkin-ghost"
                  >
                    {latestVisit ? t('Check in', 'Check-in', 'チェックイン') : t('Visited', 'Đã qua', '訪問済み')}
                  </Text>
                </View>
              </PressableScale>
            )}
          </View>
          ) : null}

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
              5% over the card's own ground. */}
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
                <Text style={s.whyLabel}>{t('Highlights', 'Điểm nổi bật', '見どころ')}</Text>
              </View>
              <View style={s.whyBody}>
                {/* Whose words those are, at the end of them. It was a line
                    of its own under the paragraph; since 12 Oct 2026 it is
                    the paragraph's last run, after two spaces — a pull
                    quote's attribution, on the owner's reading that the
                    extra line broke the paragraph's rhythm. Nested in the
                    paragraph's Text so it wraps with it, and with no press
                    handler of its own: the paragraph's handler covers the
                    run (a nested Text with its own would merely shadow it
                    — checked, not doubled), so one handler is the whole
                    truth of what a tap does. At
                    15pt against the paragraph's 16, in the link colour —
                    one step down says "attribution", two said "footnote".

                    After the blurb rather than before it because the
                    sentence is what the reader came for; the attribution
                    answers a question they only have once they have read it.

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
                    marks. An earlier draft of this argued
                    an icon at 12.5pt is a smudge — it is not, because it
                    rides inside the Text and takes its baseline, which is
                    the thing that makes a glyph beside words read as one
                    line rather than as two objects. A source with no mark
                    keeps the long wording; there is nothing else to carry
                    it. */}
                <Text style={s.desc} onPress={openBlurb} testID="detail-desc">
                  {desc}
                  {blurbFrom ? (
                    <Text
                      style={[s.credit, blurbHref ? s.creditLink : null]}
                      accessibilityRole={blurbHref ? 'link' : undefined}
                      testID="blurb-credit"
                    >
                      {'  '}
                      {blurbMark ? (
                        <Ionicons
                          name={blurbMark}
                          size={13}
                          color={blurbHref ? colors.accent : colors.textTertiary}
                        />
                      ) : null}
                      {blurbMark ? ' ' : ''}
                      {blurbFrom.kind === 'threads'
                        ? (blurbFrom.name ?? 'Threads')
                        : blurbFrom.kind === 'google'
                          ? 'Google'
                          : (blurbFrom.name
                            ? t(`${blurbFrom.name} on ${blurbFrom.source}`, `${blurbFrom.name} trên ${blurbFrom.source}`, `${blurbFrom.name}（${blurbFrom.source}）`)
                            : blurbFrom.source)}
                    </Text>
                  ) : null}
                </Text>
                {descFallback ? (
                  <Text style={s.descFallback} testID="blurb-fallback">{descFallback}</Text>
                ) : null}
              </View>
            </View>

          {/* ── vibes ──
              What the place feels like. `vibe_tags` was on every card in
              the feed and on no detail screen — a reader who opened "Yên
              tĩnh" from the feed found the word gone. Every tag here, not
              the card's one-and-a-count: the card's line had room for one,
              and this screen has the room.

              Chips, since the evening of 12 Oct 2026, and small ones. The
              first cut was the card's dot-and-word, on the argument that a
              filled pill on this screen says "press me" (the check-in
              button, the filter row on Explore). The owner's answer: what
              says "press me" is the height, not the fill. Those controls
              are 44pt; a 24pt chip with no border is a label, the way a
              category tag under an App Store listing is, and a label is
              what a vibe is — the reader learns the place is quiet, or
              good to work in, and taps nothing. No dot inside, and one fill
              for all of them, the theme's own glass (`surfaceGlass`, the
              look cards' and the info card's material): the vibe palette's
              hues sit next to the category pills' hues on the same screen,
              and two colour systems for two taxonomies is one more than a
              reader can hold. Not the accent's tint, either, which the
              heading, the pick and the credit already carry — three more
              would stop it marking anything. Drawn with or without a
              blurb: the tags are the desk's, the blurb may be Google's,
              and a place can have the one and not the other. */}
            {vibes}
          </Card>
          ) : vibes}

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
                  label={t('Address', 'Địa chỉ', '住所')}
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
                      accessibilityLabel={t('Directions', 'Chỉ đường', '経路')}
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      containerStyle={s.goSlot}
                      style={s.go}
                      testID="detail-directions"
                    >
                      <Ionicons name="navigate" size={18} color={colors.accent} />
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
                      ? t('Shows the whole address', 'Xem đầy đủ địa chỉ', '住所の全文を表示')
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
                    accessibilityLabel={t('Directions', 'Chỉ đường', '経路')}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    containerStyle={s.goOnMap}
                    style={s.goDisc}
                    testID="detail-directions"
                  >
                    <Ionicons name="navigate" size={18} color={colors.accent} />
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
                      <Ionicons name="time-outline" size={19} color={colors.textTertiary} />
                    </View>
                    <View style={s.infoWords}>
                      <Text style={s.infoLabel}>{t('Hours', 'Giờ mở cửa', '営業時間')}</Text>
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
                              )
                              : t('Open now · 24 hours', 'Đang mở cửa · 24 giờ', '営業中 · 24時間')
                            : openNow.opensAtMin != null
                              ? t(
                                `Closed · opens ${clockOf(openNow.opensAtMin)}`,
                                `Đã đóng cửa · mở lúc ${clockOf(openNow.opensAtMin)}`,
                                `閉店中 · ${clockOf(openNow.opensAtMin)}開店`,
                              )
                              : t('Closed today', 'Hôm nay đóng cửa', '本日休業')}
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
                      <Ionicons name={hoursOpen ? 'chevron-up' : 'chevron-down'} size={17} color={colors.textTertiary} />
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
                  label={t('Phone', 'Điện thoại', '電話番号')}
                  first={firstRow === 'phone'}
                  onPress={() => open(
                    `tel:${place.phone!.replace(/\s/g, '')}`,
                    t('Could not place the call', 'Không gọi được', '電話をかけられませんでした'),
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
                    t('Could not open Instagram', 'Không mở được Instagram', 'Instagramを開けませんでした'),
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
                    t('Could not open Threads', 'Không mở được Threads', 'Threadsを開けませんでした'),
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
                  label={t('Website', 'Trang web', 'ウェブサイト')}
                  first={firstRow === 'website'}
                  onPress={() => open(
                    websiteUrl!,
                    t('Could not open the website', 'Không mở được trang web', 'ウェブサイトを開けませんでした'),
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
                <Text style={s.checkinHeadTitle}>{t('Checked in here', 'Bạn đã check-in ở đây', 'ここにチェックイン済み')}</Text>
                <CountBadge n={visitsHere.length} style={s.checkinCount} />
              </View>
              <ScrollView style={s.history} bounces={false} showsVerticalScrollIndicator={visitsHere.length > HISTORY_ROWS}>
                {visitsHere.map((v, i) => {
                  const d = new Date(v.at);
                  return (
                    <View key={v.id} style={[s.historyRow, i > 0 && s.historyDivider]} testID="checkin-visit">
                      <Ionicons name="time-outline" size={17} color={colors.textTertiary} />
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
                        accessibilityLabel={t('Remove this visit', 'Bỏ lần ghé này', 'この訪問を削除')}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.bad} />
                      </PressableScale>
                    </View>
                  );
                })}
              </ScrollView>
              {canAgain && (
                <GradientCta
                  wide
                  icon="location"
                  label={t('Check in again', 'Check-in lần nữa', 'もう一度チェックイン')}
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

/** The left column the glyphs sit in, and the inset every hairline and
 *  every continuation under a row lines up against. Glyph 19, air 14. */
const GUTTER = 33;

/** Where a glyph sits down its row: level with the first line of the
 *  value, not with the label above it and not in the gap between them.
 *
 *  This is a decision about the address row, because that is the only row
 *  whose value wraps — Hours and the open-now line are short, and Website
 *  is held to one line. And it wraps almost always: of the 648 places
 *  carrying an address, 13 fit on one line. Thirteen. The rest run to two
 *  lines and thirty-five run to three, so the address row is a label over
 *  two lines of street, and the shape to design for is that one rather
 *  than the short address that happens to be on the screenshot.
 *
 *  Centred on the pair — label plus first line — the glyph lands on the
 *  top edge of the street and reads as pushed up. Centred on the whole
 *  row it drifts with the length of the address. Centred on the first
 *  line of the value it is level with the words it is a marker for, and
 *  it stays there whether the address runs to one line or four.
 *
 *  All three line heights are stated rather than left to the platform: a
 *  glyph's position derived from "what iOS thinks a 12pt line is" is a
 *  position nobody can check, and it moves the day that changes. 15 is a
 *  rounding of the 14.3 the system face gives at 12pt, so the rows keep
 *  the height they have. */
const LABEL_LINE = 15;
const LABEL_GAP = 5;
const VALUE_LINE = 24;
/** Everything above the first line of the value. */
const ABOVE_VALUE = LABEL_LINE + LABEL_GAP;
/**
 * Where a glyph sits, and how much room it is given to sit in.
 *
 * Two numbers, because the last version conflated them and clipped every
 * icon on the card. It gave the glyph a box of `LABEL_LINE` — fifteen
 * points — and a comment claiming that a 19pt glyph would simply overflow
 * it, top and bottom, because "the box is a position, not a frame".
 *
 * It is a frame. A `Text` constrained to a height shorter than its own
 * line lays out inside that height and the glyph is cut at the bottom
 * edge, which is exactly what shipped: the pin and the handset with their
 * feet sliced off. The claim was one I could not check from here and
 * should not have written as a fact.
 *
 * So the box is bigger than any 19pt line can be, and the *position* is
 * carried by a negative margin instead: centred, the box's middle lands
 * on `LABEL_LINE / 2`, which is the middle of the label's line. The glyph
 * is level with the word it names, and it has room to be drawn whole.
 *
 * Its footprint is 20.5pt against the words column's 44 or more, so
 * nothing here sets a row's height either way.
 */
const GLYPH_BOX = 26;
const GLYPH_LIFT = (LABEL_LINE - GLYPH_BOX) / 2;

/** How much of a long address the card shows before it asks. Two, because
 *  two is where the map still fits above the fold on the shortest phone
 *  this app supports; the rest is a tap away. */
const ADDRESS_LINES = 2;

/** The facts row's height — the category chips and Check in beside them.
 *  44, the height the same chips have on Search and Places. */
const FACT_HEIGHT = 44;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  // Bottom corners only. The top three edges are the screen's own now, and
  // a radius there would draw the card outline this stopped being; the
  // bottom pair is what tells the eye the picture has ended and the page
  // has begun.
  //
  // `radius.card`, the same number Explore's hero rounds to. This briefly
  // shipped at 30, on the argument that a full-width edge wants a wider
  // curve than a card — which may be true, but Explore's hero is just as
  // full-width, and two screens doing one thing at two radii is the
  // inconsistency you see rather than the softness you don't. If the
  // curve is ever revisited it moves for both, from the token.
  heroWrap: {
    borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card,
    overflow: 'hidden', backgroundColor: colors.surfaceGlass,
  },
  // Height comes from the call site — it is the safe-area inset plus the
  // frame, and only the screen knows the inset.
  hero: { backgroundColor: colors.surfaceGlass },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  heroScrimTop: { position: 'absolute', left: 0, right: 0, top: 0 },
  heroScrimBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 116 },
  fabSlot: { position: 'absolute' },
  // Everything this screen floats on a photograph is made of one material:
  // `rgba(10,11,10, …)` with an `onPhoto.line` hairline — the ground the
  // search disc on Explore, the bookmark and rating on a place card, and
  // the avatar's busy state are all made of.
  //
  // These were `rgba(10,8,13, …)` and bare. Ten-eight-thirteen is black
  // pulled towards violet where the app's is pulled towards green, which
  // nobody can name at a glance and everybody can see when the two sit a
  // screen apart; the missing hairline is what let a disc dissolve into a
  // dark photograph. The alphas are each sibling's own: a 44pt disc is
  // Explore's 0.55, a labelled pill is the rating pill's 0.58, and the
  // dot track stays lightest because it holds no type.
  fab: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(10,11,10,0.55)', alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: onPhoto.line,
  },
  // Bottom left, the page margin in, bottoms flush with the page count at
  // its right (`countBottom` 15). The labelled pill's alpha (0.58, as
  // the rating pill on a card) rather than the discs' 0.55: it carries
  // type once open. 44 tall, the target every control here has.
  kindsSlot: { left: space.page, bottom: 15 },
  kinds: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: 44, paddingHorizontal: 14, borderRadius: radius.pill,
    backgroundColor: 'rgba(10,11,10,0.58)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: onPhoto.line,
  },
  // The names, one step over the cluster: its 15 + 44, and 6 of air.
  // The credit, when its switch is on, sits at the right at 44, so the
  // two share no line.
  kindsTip: {
    left: space.page, bottom: 15 + 44 + 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill,
    backgroundColor: 'rgba(10,11,10,0.58)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: onPhoto.line,
  },
  kindText: { color: onPhoto.text, fontSize: 13, fontWeight: font.medium },
  // The divider the reference drew between glyphs: without it two glyphs
  // 12pt apart read as one mark.
  kindsRule: { width: StyleSheet.hairlineWidth, height: 18, backgroundColor: onPhoto.line },
  // Required attribution, kept quiet — see the note in PlaceCard.
  //
  // Above the page count, right-aligned to it: the line its old seat's note
  // named as "free and twice as wide". It sat centred on the bottom edge,
  // the seat the page marks left, until the kinds took the left corner — three
  // glyphs there are about 125pt, and a centred credit at 30% of a 320pt
  // window starts 112pt in, so the two would have touched on the smallest
  // phone and on a 390pt one too. The count is `PAGE_COUNT_H` tall at
  // bottom 15; this sits 6pt over it. The flag that draws it is off
  // today, by the owner's decision; the seat is kept so switching it on
  // moves nothing.
  attr: {
    position: 'absolute', right: space.page, bottom: 15 + PAGE_COUNT_H + 6, maxWidth: '50%', textAlign: 'right',
    fontSize: 9, color: '#fff', opacity: 0.55,
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3,
  },

  body: { paddingHorizontal: space.page, paddingTop: 18 },
  // 26, not the 28 this was: the display face runs wider than the system
  // one, and place names are long enough to wrap without help.
  name: { color: colors.text, ...type.titleDetail },
  // Body face, not display: the qualifier is a fact about the title, not
  // a second title, and the change of face is what says so.
  subtitle: { color: colors.textSecondary, ...type.body, marginTop: 4 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  loc: { color: colors.textTertiary, ...type.meta },

  // ── the rating, as a line rather than a badge ──
  //
  // `center`, not a baseline: the star is the tallest thing here and the
  // eye reads it against the number, not against the number's feet.
  //
  // 8 above, against the subtitle's 4. The subtitle is part of the name
  // and sits close enough to be read with it; the score is a different
  // fact and takes the wider gap that says so.
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // The rating's line, with check-in pinned to its right. Centred on the
  // pill: the line is one 24pt row of text beside a 44pt control, and a
  // top-aligned score sat 10pt high of the pill's word.
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, minHeight: 24 },
  metaFacts: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4 },
  priceLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // The score keeps the size and weight it wore inside the badge. It was
  // never the type that made the badge expensive.
  ratingValue: { color: colors.text, fontSize: 18, fontWeight: font.bold },
  // The count was 12 in the badge, where it had a box to belong to and
  // two lines of its own. On an open line that reads as fine print, so it
  // comes up to `type.meta` — the size every other secondary fact on this
  // screen already uses.
  ratingDot: { color: colors.textTertiary, fontSize: 15, fontWeight: font.regular },
  ratingCount: { color: colors.textSecondary, ...type.meta },

  // Its own column, so a score and a price that wrap do not push it.
  checkinSlot: { flexShrink: 0, marginLeft: 12 },
  // The category chip's box — padding, radius, gap — with the fill taken
  // out and the hairline recoloured, from the days it sat at the end of
  // that row; the chips are gone and the box is still this app's pill.
  checkin: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1, borderColor: colors.accentLine, borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 6, minHeight: FACT_HEIGHT,
  },
  // Worn: the one fill this row is allowed, because it is a state. The
  // hairline stays, transparent, so the pill keeps its exact size. It
  // took the fill's colour first, `okSoft`, and on a phone in Dark under
  // the app's Light that border resolved to the charcoal side and drew a
  // near-black ring round a pale green pill — see `bgHex` in theme.ts.
  //
  // Green, not the coral it wore first. Solid coral said "done" loudly,
  // but it is also the colour of every button on this screen that asks
  // for something, and the owner's reference drew a visit as the quiet
  // green the app already uses for good news (`okSoft`, the public-list
  // banner's ground). Coral now means "do this", green "you did".
  // `okInk` on it: 5.1:1 on paper, 7.2:1 on charcoal.
  checkinOn: { backgroundColor: colors.okSoft, borderColor: 'transparent' },
  checkinOnText: { color: colors.okInk },
  // The two words stacked; see "one width in both states" at the pill.
  checkinWords: { alignItems: 'center' },
  // The word not being shown: it keeps its width and gives up its height,
  // so it sizes the column and draws nothing.
  checkinGhost: { height: 0, opacity: 0, overflow: 'hidden' },
  checkinHead: { gap: 12 },
  checkinHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  checkinHeadTitle: { flex: 1, color: colors.text, fontSize: 18, fontFamily: display.semibold },
  checkinCount: { marginRight: space.cardPadding },
  // The sheet's own card surface, as its rows below wear it. Capped at
  // HISTORY_ROWS rows of HISTORY_ROW each; more scrolls inside.
  history: {
    maxHeight: HISTORY_ROWS * HISTORY_ROW,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1, borderColor: colors.borderGlassSoft, borderRadius: radius.card,
  },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: space.cardPadding, height: HISTORY_ROW,
  },
  historyDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  historyText: { flex: 1, color: colors.text, fontSize: 15 },
  // The filter row's chip, at rest: same hairline, same radius, same
  // type, so a category looks like the same thing here as there. Glass
  // fill rather than the filter's bare outline, because these are facts
  // to read, not controls to press, and the fill is what says so.

  desc: { color: colors.textSecondary, ...type.body, lineHeight: 24 },
  // The mark sits in its own disc so the label and the text share one
  // left edge: a glyph inline with the heading would put the paragraph
  // under the heading and the heading beside the glyph, which is two
  // columns pretending to be one.
  // A column since the heading took a line of its own (see the block):
  // the head row, then the paragraph at the screen's full width.
  // The card's inner spacing is the info card's (`space.cardPadding`),
  // so the paragraph's left edge is the address's. 10 between the
  // paragraph block and the chips, the gap the chips used to carry as a
  // margin, now the card's so it holds whichever of the two is first.
  whyCard: { marginTop: 14, padding: space.cardPadding, gap: 10 },
  why: { gap: 6 },
  // Baseline-aligned, not centred: the mark is a glyph beside a word and
  // sits on the word's line, its ink at cap height the way an opening
  // quote does. Centred in a 28pt box (the disc's, kept a day after the
  // disc went) it floated like a superscript, and the box's slack plus a
  // 10pt gap put ~15pt between mark and word on the owner's phone. 6pt
  // now, mark to word, with no box.
  whyHead: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  whyQuote: {
    color: colors.accent, fontSize: 22, lineHeight: 22, fontFamily: display.bold,
    includeFontPadding: false,
  },
  whyBody: { gap: 2 },
  // 16, the Local Guide panel's title, now that this is a heading row of
  // its own rather than a label tucked over the paragraph.
  whyLabel: { flex: 1, color: colors.accent, fontSize: 16, fontWeight: font.semibold },
  // An eyebrow: 6 above the name, which is the gap a kicker keeps from
  // its headline at this size. Spaced caps at 12 — the label's own size
  // from the heading row — so it reads as a mark, not a second title.
  pick: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  pickText: { color: colors.accent, fontSize: 12, fontWeight: font.semibold, letterSpacing: 0.8, textTransform: 'uppercase' },
  // A label's chip (see the block): 24pt — 16 of line and 4 of padding
  // each way — against the 44pt of anything on this screen that is
  // pressed; the theme's glass, no border, no dot.
  vibes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Bare, under the meta row: the 14 the card would have kept from it.
  vibesBare: { marginTop: 14 },
  vibe: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.surfaceGlass },
  vibeText: { color: colors.text, fontSize: 13, lineHeight: 16, fontWeight: font.semibold },

  // The paragraph's last run (see the block): one step under its size,
  // quieter than the sentence it attributes. The link colour is the only
  // thing that marks the source as reachable — an underline in this face
  // is a scar.
  credit: { color: colors.textTertiary, fontSize: 15 },
  // Two steps down from the paragraph, where the credit is one: the
  // credit is part of the quote and this is a note about it.
  descFallback: { color: colors.textTertiary, fontSize: 12 },
  creditLink: { color: colors.accent },

  // The Card supplies ground, border and radius; the horizontal inset
  // lives here so each row's hairline can run to the card's edge.
  infoGroup: { marginTop: 18, paddingHorizontal: space.cardPadding },
  // The map is the third thing in the address's column, under the label
  // and the street:
  //
  //     [icon] ADDRESS
  //            27/16 Ng. 18 Huỳnh Thúc Kháng
  //            [map]
  //
  // So it starts at `GUTTER`, where the words start and where every
  // hairline starts, and ends at the card's own padding. Full-bleed was
  // tried — it is what the reference does — and it broke that column:
  // the picture reached left past every other thing in the card and the
  // grid stopped being a grid. `overflow: hidden` because MiniMap draws
  // to its own corners.
  mapSlot: {
    marginLeft: GUTTER, marginBottom: 16,
    borderRadius: radius.card - 8, overflow: 'hidden',
  },
  // `containerStyle`, not `style`: PressableScale puts `style` on its inner
  // animated view and only `containerStyle` on the Pressable.
  //
  // The in-row position, which is now the fallback — a card with no map to
  // stand the button on. `marginLeft` is the gap the row never had: the
  // address is `flex: 1` and this is `flexShrink: 0`, so with nothing
  // between them the words ran to the pill's edge.
  goSlot: { flexShrink: 0, marginLeft: 12, marginTop: ABOVE_VALUE - 6 },
  // On the map, clear of Google's attribution in the opposite corner.
  goOnMap: { position: 'absolute', right: 10, bottom: 10 },
  // The square beside the address: 36, and 4pt of slop on each side to
  // make the 44 this app gives every control — the pill it replaces was
  // 44 tall with no slop, and 44 of tint beside a one-line address is
  // taller than the words it serves. `radius.input`, the one corner
  // between a pill's and a card's, for a square that is neither.
  go: {
    width: 36, height: 36, borderRadius: radius.input,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  // A disc over the tiles, 40 rather than `MiniMap`'s locate button's 36
  // because this is the only control on the map and the one the card
  // exists for; `hitSlop` takes the target past 44 without taking more of
  // the picture.
  //
  // Not quite opaque. The note this replaces said a glass disc could not
  // work because a Google tile is not a surface this app chooses — pale
  // beige, white roads and green parks in a different mix at every
  // address — and that is true of `surfaceGlass`, which is a wash with no
  // ground of its own. It is not true of `bgElevatedVeil`, which keeps its
  // own colour and only thins it, so the disc stops reading as a sticker
  // on a photograph without giving up the ground the glyph stands on.
  //
  // See that token for where 0.88 comes from, and for the mistake on the
  // way: this preview is always a *light* tile, `MiniMap` passing no night
  // style, so the case that decides the number is the dark theme's disc
  // over pale roads rather than anything the light theme does.
  goDisc: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bgElevatedVeil,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  goText: { color: colors.accent, fontSize: 14, fontWeight: font.semibold },
  // 17pt over a label and a 24pt line keeps every row a ≥58pt target.
  // A row is a column — label, then value. Only Hours lays itself across,
  // for the chevron at its end.
  //
  // Still `flex-start`, and the glyphs are placed by their own boxes
  // rather than by this. `center` here would centre them on the whole
  // row, and the address row's height is the length of the address: the
  // pin would sit level with the street on a short one and slide down
  // between the lines on a long one, which is a glyph whose position is
  // a property of the data.
  infoStack: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 17 },
  // The whole gutter, not the glyph: 19 of it is the glyph and the
  // remaining 14 is the air before the words. Written `GUTTER - 14` it was
  // 19 — exactly the glyph — so there was no air at all and every label
  // sat against its icon at whatever the glyph's own side bearing happened
  // to be. Measured on the phone: 4.0pt after the pin, 2.7 after the
  // clock, 2.4 after the handset. Three different gaps because three
  // different glyphs, which is what made the column look ragged.
  //
  // At `GUTTER` the words begin exactly where the hairline and the hours
  // table already began, and the three are one column.
  //
  // A box of a stated height rather than a glyph with a nudge on it, and
  // the box is the label and the first line of the value together.
  //
  // The glyph belongs to the pair, not to either line of it. Level with
  // the label it marks a word and leaves the street unmarked; level with
  // the street it leaves ADDRESS alone above an empty gutter. Centred
  // across both it holds the two as one row, which is what a row is.
  //
  // It took four tries to land here, and the first three are worth
  // keeping because each was wrong in its own way. `marginTop: 1` under
  // `alignItems: 'flex-start'` was no position at all — it pinned the
  // glyph to the top and let the icon font's line box decide the rest,
  // and had no answer for a second line of address. Then the first line
  // of the value. Then the label's line.
  //
  infoIconSlot: {
    width: GUTTER, height: GLYPH_BOX, marginTop: GLYPH_LIFT,
    justifyContent: 'center', overflow: 'visible',
  },
  infoWords: { flex: 1, minWidth: 0 },
  // See `hug` on InfoRow: content width, shrinking before the control.
  infoWordsHug: { flex: 0, flexShrink: 1 },
  // The same box at the other end of the row, so both ends stay level.
  infoChevronSlot: {
    height: GLYPH_BOX, marginTop: GLYPH_LIFT,
    justifyContent: 'center', overflow: 'visible',
  },
  // Starts where the labels start. Run to the card's edge it cut the
  // gutter into four pieces; inset, the glyphs read as one column.
  //
  // Its own element rather than a border on the box that holds the row,
  // and that is the whole of a bug this card carried: `marginLeft` on a
  // wrapper moves everything inside it, so every row after the first was
  // pushed 33pt right — icon, label and value together — while the first
  // row sat at the card's padding. Measured on the phone: the address pin
  // at 18pt from the card edge, the clock and the handset at 46. A line
  // has nothing inside it to drag along.
  rowDivider: {
    height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft,
    marginLeft: GUTTER,
  },
  infoLabel: {
    color: colors.textTertiary, fontSize: 12, fontWeight: font.semibold,
    textTransform: 'uppercase', letterSpacing: 1.2,
    lineHeight: LABEL_LINE, marginBottom: LABEL_GAP,
  },
  infoValue: { color: colors.ink, ...type.meta, lineHeight: VALUE_LINE },
  /** The value of a row that goes somewhere. Ink like the rest — the
   *  accent came off after a day on the phone, where a two-line address
   *  in red outweighed the title — and a touch of weight is what is
   *  left to say the row is a link. */
  infoLink: { fontWeight: font.medium },
  // Semibold and a size up on the table under it: this is the answer, and
  // it is the working it was derived from.
  // The same 24 the other values keep: it is the second line of its pair,
  // and the glyph beside it is centred on a box that assumes so.
  openNow: {
    color: colors.open, fontSize: 16, fontWeight: font.semibold,
    lineHeight: VALUE_LINE,
  },
  // The sash's own brick, not the grey it was. See `colors.shutInk`: the
  // grey was the label's colour and 3.41:1 on the dark card, so the one
  // fact a reader opens this screen at night to find was both quiet and
  // under AA.
  openNowShut: { color: colors.shutInk },
  hoursTable: { paddingBottom: 16, paddingLeft: GUTTER },
  hourRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  hourDay: { color: colors.ink, fontSize: 15, fontWeight: font.medium },
  hourTime: { color: colors.ink, fontSize: 15, fontWeight: font.regular },
});
