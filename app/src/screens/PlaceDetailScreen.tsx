// Place detail — hero carousel with photo counter, floating share/save,
// rating badge, icon fact row, and one grouped card of Address / Hours /
// Call / Website rows, the weekly table folded behind the open-now line.
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
  ActivityIndicator, Alert, Linking, Pressable, ScrollView, Share, StyleSheet,
  Text, useWindowDimensions, View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFlag } from '../lib/useFlag';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fmtCount, isFree, photosOf, usePlaceBySlug } from '../lib/data';
import { usePlaces } from '../lib/catalog';
import { shortAddress } from '../lib/address';
import { splitName, subtitleBeside } from '../lib/name';
import { useCity } from '../lib/city';
import { CATEGORIES, categoriesOf, categoryLabel } from '../lib/categories';
import MiniMap, { canDrawMap } from '../components/MiniMap';
import { pinImage } from '../components/mapPins';
import {
  atHandle, hostOf, instagramUrl, threadsUrl, websiteRepeatsHandle,
} from '../lib/links';
import { clockOf, dotWindow, groupHours, openState } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { mapsSearchUrl } from '../lib/maps';
import { useSave } from '../lib/save';
import { useNoteEvent } from '../lib/tasteProfile';
import { colors, display, font, onPhoto, radius, space, type } from '../theme';
import { AmbientWarmth, Card, Empty, PressableScale, useOwnedStatusBar, useTabBarClearance } from '../components/ui';
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
function InfoRow({ icon, label, first, onPress, trailing, children }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** The row that opens the card draws no hairline above itself. */
  first?: boolean;
  onPress?: () => void;
  /** A control at the row's end. A row carrying one is not itself
   *  pressable: two targets in one row, the outer one swallowing taps
   *  meant for the inner, is a worse row than one honest button. */
  trailing?: React.ReactNode;
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
        <View style={s.infoWords}>
          <Text style={s.infoLabel}>{label}</Text>
          {children}
        </View>
        {trailing}
      </Pressable>
    </>
  );
}

export default function PlaceDetailScreen({ navigation, route }: { navigation: Nav; route: RootRoute<'PlaceDetail'> }) {
  const { t, lang } = useI18n();
  const { city } = useCity();
  const { save, isSaved } = useSave();
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
  const credit = useFlag('photo_attribution');
  const [hoursOpen, setHoursOpen] = useState(false);
  const showPrice = useFlag('place_price');
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
  const neighborhood = t(place.neighborhood_en, place.neighborhood_vi, place.neighborhood_ja);
  // The district line under the title is only for a place with no
  // address row: the short address ends in the ward, so with one on the
  // card the line said the same word a few lines up, and a bare district
  // under a tagline reads as a second tagline. The subtitle is judged
  // against the district either way — a branch named after its ward
  // ("CTQ Texas BBQ - Hà Đông") would otherwise repeat the word the
  // address ends in, which is the same repetition the line was hidden
  // to avoid.
  const showsNeighborhood = !place.address;
  const fullName = t(place.name_en, place.name_vi, place.name_ja);
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
  const openNow = openState(place.opening_hours, new Date());
  // Asked of the string the reader will actually get, not of the columns:
  // a description written only in Japanese is one for a Japanese reader,
  // and nothing (rather than an empty paragraph) for everyone else.
  const desc = t(place.desc_en, place.desc_vi, place.desc_ja);
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
  const share = () => {
    Share.share({
      message: `${fullName}${place.address ? ` — ${place.address}` : ''}${mapsUrl ? `\n${mapsUrl}` : ''}`,
    }).catch(() => {});
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
  // Websites are typed in by hand and often arrive bare (`congcaphe.com`),
  // which `openURL` cannot route; with no scheme of its own, it is a web
  // address.
  const websiteUrl = site && !/^[a-z][a-z\d+.-]*:\/\//i.test(site)
    ? `https://${site}`
    : site;

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
        {/* ── hero carousel ── */}
        <View style={[s.heroWrap, { height: heroH }]}>
          {photos.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / heroW))}
            >
              {photos.map((ph, i) => (
                <Image
                  key={ph.photo_uri}
                  source={{ uri: ph.photo_uri }}
                  style={[s.hero, { width: heroW, height: heroH }]}
                  contentFit="cover"
                  transition={200}
                  testID={i === 0 ? 'detail-photo' : undefined}
                  accessibilityLabel={t(
                    `Photo ${i + 1} of ${photos.length} of ${fullName}`,
                    `Ảnh ${i + 1}/${photos.length} của ${fullName}`,
                    `${fullName}の写真 ${i + 1}/${photos.length}`,
                  )}
                />
              ))}
            </ScrollView>
          ) : (
            <View style={[s.hero, s.heroFallback, { width: heroW, height: heroH }]}>
              <Text style={{ fontSize: 64 }}>{place.emoji ?? '📍'}</Text>
            </View>
          )}

          {/* Two scrims, and neither is a wash over the picture.
              The top one exists for the clock and the three discs and for
              nothing else: it is strongest at the very top edge and gone
              within the status bar's own height plus a little, so on most
              photographs you cannot point at where it ends.
              The bottom one is the older job — the counter, the dots and
              the credit sit on it — and it now also gives the rounded
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

          {photos.length > 0 && (
            <View style={s.counter}>
              <Ionicons name="images-outline" size={13} color={onPhoto.text} />
              <Text style={s.counterText}>{photoIndex + 1} / {photos.length}</Text>
            </View>
          )}
          {photos.length > 1 && (
            <View style={s.dots}>
              {dotWindow(photos.length, photoIndex).map((i) => (
                <View key={i} style={[s.dot, i === photoIndex && s.dotOn]} />
              ))}
            </View>
          )}
          {credit && photos[photoIndex]?.attribution_name ? (
            <Text style={s.attr} numberOfLines={1}>{photos[photoIndex].attribution_name}</Text>
          ) : null}
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
          <Text style={s.name} testID="detail-name">{name.title}</Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
          {showsNeighborhood ? (
            <View style={s.locRow}>
              <Ionicons name="location-outline" size={15} color={colors.textTertiary} />
              <Text style={s.loc}>{neighborhood}</Text>
            </View>
          ) : null}
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

          {/* ── fact row ── */}
          {/* ── facts: what kind of place, what it costs, how long ──
              A row of pills, in the shape the filter row and the cards
              already use for the same concepts, rather than four bits of
              grey text with glyphs that read as one run-on sentence. Kind
              first: it is the answer to "what is this", and the glyph
              carries the category's hue — the same hue its chip wears on
              Explore and its dot wears on a card — while the pill stays
              glass. Never a tinted fill: that is the rule in
              `lib/categories`, and a row of pastel pills is the one
              thing this app's colour discipline does not do. */}
          <View style={s.facts} testID="detail-facts">
            {/* What this place is, on the functional axis — the same
                `categories` the filter row, the planner and search read.
                This row used to say something else entirely: the label was
                `vibe_tags[0]` capitalised and the icon was the legacy
                two-value `category` column, so a bookstore filed as
                'food' under the old axis showed a coffee cup beside the
                word "Culture" — a label from one taxonomy, a glyph from
                another, and neither of them the place's actual category.
                It also never translated, because a raw vibe key has no
                Vietnamese. `categoriesOf` keeps the legacy fallback for
                rows written before the column existed, so nothing that
                used to say something now says nothing. */}
            {cats.map((c) => (
              <View key={c} style={s.fact}>
                <Ionicons
                  name={CATEGORIES[c]?.icon ?? 'pricetag-outline'}
                  size={15}
                  color={CATEGORIES[c]?.color ?? colors.textSecondary}
                />
                <Text style={s.factText}>{categoryLabel(c, t)}</Text>
              </View>
            ))}
            {/* FREE is already a pill of its own, accented because it is
                the one price that is a state; a paid price is quiet text
                and takes the glass pill and a tag like its neighbours.

                Behind a switch, and off: the price is what pushes a
                three-category place onto a second line — twelve of the
                eighteen that have three are café + eats + nightlife, and
                that row wants 427pt of a 386pt card. Without it every one
                of them fits, the heaviest by a single point.

                This screen is the only place in the app that has ever
                drawn a price, so the switch hides it everywhere, on 557
                published places of 648. That is why it is a row in
                `app_flags` rather than a deletion — see `lib/flags` for
                the one line that brings it back on every phone at once. */}
            {showPrice && (place.price_display || place.price_vnd != null) ? (
              isFree(place) ? (
                <PricePill place={place} />
              ) : (
                <View style={s.fact}>
                  <Ionicons name="pricetag-outline" size={15} color={colors.textSecondary} />
                  <PricePill place={place} />
                </View>
              )
            ) : null}
            {/* No dwell here. "1–1.5h" is the planner's estimate of how
                long people stay, and the planner still reads it where a
                schedule needs it; on this screen it was a guess dressed
                as a fact, and the pill that pushed a two-category row
                onto a second line. */}
          </View>

          {/* ── why go ── */}
          {/* The desk writes these, and they have a voice: "exactly what
              some nights need" is a person, not a summary. Unlabelled it
              read as boilerplate and got skimmed; named, it is the one
              opinion on a screen otherwise made of facts, which is the
              thing this app actually sells.
              
              The label is earned rather than decorative — `desc_*` is in
              the dashboard's editable set, so it is the desk's own words
              and not a machine's, and every published place has one.
              
              No chevron. There is no fuller version to open, and an arrow
              that leads nowhere is a promise the screen cannot keep. */}
          {desc ? (
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
              <View style={s.whyMark}>
                <Text style={s.whyQuote}>{'\u201C'}</Text>
              </View>
              <View style={s.whyBody}>
                <Text style={s.whyLabel}>{t('Why go?', 'Vì sao nên ghé?', 'なぜ行く？')}</Text>
                <Text style={s.desc}>{desc}</Text>
              </View>
            </View>
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
              "why go" are one argument about the place, made to everybody,
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
            <Card style={s.infoGroup}>
              {place.address && (
                <InfoRow
                  icon="location-outline"
                  label={t('Address', 'Địa chỉ', '住所')}
                  first={firstRow === 'address'}
                  onPress={mapsUrl ? toMaps : undefined}
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
                     takes the whole width; see `goOnMap`. */
                  trailing={mapsUrl && !showsMap ? (
                    <PressableScale
                      onPress={toMaps}
                      accessibilityRole="button"
                      accessibilityLabel={t('Directions', 'Chỉ đường', '経路')}
                      containerStyle={s.goSlot}
                      style={s.go}
                      testID="detail-directions"
                    >
                      <Ionicons name="navigate" size={15} color={colors.accent} />
                      <Text style={s.goText}>{t('Directions', 'Chỉ đường', '経路')}</Text>
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
                    onPress={toMaps}
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
  counter: {
    position: 'absolute', left: space.page, bottom: 14, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(10,11,10,0.58)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: onPhoto.line,
  },
  counterText: { color: onPhoto.text, fontSize: 12.5, fontWeight: font.semibold },
  // Right, not centre. The bottom edge of a photograph then carries two
  // objects instead of three-with-a-hole, and the middle — where a
  // photographer puts the subject — is given back to the picture.
  dots: {
    position: 'absolute', bottom: 15, right: space.page,
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(10,11,10,0.45)', borderRadius: radius.pill,
    paddingHorizontal: 11, paddingVertical: 8,
  },
  // The one in hand is a bar, not a bigger dot. Six photographs is six
  // marks 7pt across, and telling which of them was a point wider meant
  // looking rather than glancing — the thing a page indicator exists to
  // spare you. Length reads at a distance where diameter does not.
  //
  // Same height as the others, so the row keeps one baseline; and since
  // exactly one is ever in hand, the strip's total width never changes
  // as the reader pages, which is what would have made it twitch.
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: 'rgba(255,255,255,0.38)' },
  dotOn: { width: 17, height: 7, borderRadius: 3.5, backgroundColor: onPhoto.text },
  // Required attribution, kept quiet — see the note in PlaceCard.
  //
  // Centre, which is the seat the dots left. It is the only one free:
  // this line and the dots cannot share the right-hand corner, and 94.5%
  // of the catalog's photographs carry a name to print. The flag that
  // draws it is off today and that is a decision of the owner's, not an
  // accident — this seat is kept so the day it is switched on nothing
  // has to be moved.
  //
  // Narrower than it was, because a middle between two objects is
  // narrower than a corner: about 134pt of gap on a 402pt phone once the
  // counter and a full seven-mark strip have taken theirs. If names
  // start truncating, the line above this one is free and twice as wide.
  attr: {
    position: 'absolute', alignSelf: 'center', bottom: 16, maxWidth: '30%', textAlign: 'center',
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
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  // The score keeps the size and weight it wore inside the badge. It was
  // never the type that made the badge expensive.
  ratingValue: { color: colors.text, fontSize: 18, fontWeight: font.bold },
  // The count was 12 in the badge, where it had a box to belong to and
  // two lines of its own. On an open line that reads as fine print, so it
  // comes up to `type.meta` — the size every other secondary fact on this
  // screen already uses.
  ratingDot: { color: colors.textTertiary, fontSize: 15, fontWeight: font.regular },
  ratingCount: { color: colors.textSecondary, ...type.meta },

  facts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 16 },
  // The filter row's chip, at rest: same hairline, same radius, same
  // type, so a category looks like the same thing here as there. Glass
  // fill rather than the filter's bare outline, because these are facts
  // to read, not controls to press, and the fill is what says so.
  fact: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1, borderColor: colors.borderGlassSoft, borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  factText: { color: colors.textSecondary, fontSize: 13.5, fontWeight: font.medium },

  desc: { color: colors.textSecondary, ...type.body, lineHeight: 24 },
  // The mark sits in its own disc so the label and the text share one
  // left edge: a glyph inline with the heading would put the paragraph
  // under the heading and the heading beside the glyph, which is two
  // columns pretending to be one.
  why: { flexDirection: 'row', gap: 10, marginTop: 14 },
  whyMark: {
    width: 28, height: 28, borderRadius: 14, marginTop: 1,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  whyQuote: {
    color: colors.accent, fontSize: 22, fontFamily: display.bold,
    includeFontPadding: false,
  },
  whyBody: { flex: 1, gap: 2 },
  whyLabel: { color: colors.accent, fontSize: 15, fontWeight: font.semibold },

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
  go: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    minHeight: 36, paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.borderGlassSoft,
    backgroundColor: colors.surfaceGlass,
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
  goText: { color: colors.accent, fontSize: 13.5, fontWeight: font.semibold },
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
    color: colors.open, fontSize: 15.5, fontWeight: font.semibold,
    lineHeight: VALUE_LINE,
  },
  // The sash's own brick, not the grey it was. See `colors.shutInk`: the
  // grey was the label's colour and 3.41:1 on the dark card, so the one
  // fact a reader opens this screen at night to find was both quiet and
  // under AA.
  openNowShut: { color: colors.shutInk },
  hoursTable: { paddingBottom: 16, paddingLeft: GUTTER },
  hourRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  hourDay: { color: colors.ink, fontSize: 14.5, fontWeight: font.medium },
  hourTime: { color: colors.ink, fontSize: 14.5, fontWeight: font.regular },
});
