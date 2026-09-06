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
  ActivityIndicator, Linking, Pressable, ScrollView, Share, StyleSheet,
  Text, useWindowDimensions, View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fmtCount, isFree, photosOf, usePlaceBySlug } from '../lib/data';
import { usePlaces } from '../lib/catalog';
import { shortAddress } from '../lib/address';
import { splitName, subtitleBeside } from '../lib/name';
import { useCity } from '../lib/city';
import { CATEGORIES, categoriesOf, categoryLabel } from '../lib/categories';
import { clockOf, dotWindow, fmtDuration, groupHours, openState } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { mapsSearchUrl } from '../lib/maps';
import { useSave } from '../lib/save';
import { useNoteEvent } from '../lib/tasteProfile';
import { colors, font, onPhoto, radius, space, type } from '../theme';
import { AmbientWarmth, Card, Empty, PressableScale, useOwnedStatusBar, useTabBarClearance } from '../components/ui';
import PricePill from '../components/PricePill';
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
function InfoRow({ label, first, onPress, children }: {
  label: string;
  /** The row that opens the card draws no hairline above itself. */
  first?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[s.infoStack, !first && s.rowDivider]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <Text style={s.infoLabel}>{label}</Text>
      {children}
    </Pressable>
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
  const [hoursOpen, setHoursOpen] = useState(false);
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
  const dur = fmtDuration(place.duration_min, place.duration_max, lang);
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
  // dropped when it only repeats the neighbourhood line under it.
  const neighborhood = t(place.neighborhood_en, place.neighborhood_vi, place.neighborhood_ja);
  // The district line under the title is only for a place with no
  // address row: the short address ends in the ward, so with one on the
  // card the line said the same word a few lines up, and a bare district
  // under a tagline reads as a second tagline. The subtitle is judged
  // against the line that is actually there.
  const showsNeighborhood = !place.address;
  const name = splitName(t(place.name_en, place.name_vi, place.name_ja));
  const subtitle = subtitleBeside(name, showsNeighborhood ? neighborhood : null);
  // Grouped, not one row per day: see groupHours. A place open the same
  // seven days a week becomes one line instead of seven identical ones.
  const hours = groupHours(place.opening_hours ?? [], lang);
  // Read at render rather than on a timer. The screen re-renders on every
  // visit, which is when the answer is being asked for; a ticking clock
  // would only matter to someone parked on this screen at closing time,
  // and would cost a re-render a minute on every place in the app.
  const openNow = openState(place.opening_hours, new Date());
  // Which row opens the grouped card decides where the hairlines fall:
  // every row below the first draws one above itself, whatever subset of
  // the four a place actually has.
  const firstRow = place.address ? 'address'
    : hours.length ? 'hours'
    : place.phone ? 'phone'
    : place.website ? 'website' : null;

  const share = () => {
    Share.share({
      message: `${t(place.name_en, place.name_vi, place.name_ja)} — ${place.address ?? ''}${mapsUrl ? `\n${mapsUrl}` : ''}`,
    }).catch(() => {});
  };

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
              {photos.map((ph) => (
                <Image key={ph.photo_uri} source={{ uri: ph.photo_uri }} style={[s.hero, { width: heroW, height: heroH }]} contentFit="cover" transition={200} />
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
          >
            <Ionicons name="chevron-back" size={22} color={onPhoto.text} />
          </PressableScale>
          <PressableScale
            onPress={share} scaleTo={0.9}
            containerStyle={[s.fabSlot, { right: space.page + 52, top: insets.top + 8 }]} style={s.fab} accessibilityLabel="Share"
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
          {photos[photoIndex]?.attribution_name ? (
            <Text style={s.attr} numberOfLines={1}>{photos[photoIndex].attribution_name}</Text>
          ) : null}
        </View>

        <View style={s.body}>
          {/* ── title + rating badge ── */}
          <View style={s.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{name.title}</Text>
              {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
              {showsNeighborhood ? (
                <View style={s.locRow}>
                  <Ionicons name="location-outline" size={15} color={colors.textTertiary} />
                  <Text style={s.loc}>{neighborhood}</Text>
                </View>
              ) : null}
            </View>
            {place.rating ? (
              <View style={s.ratingBadge}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="star" size={16} color={colors.accent} />
                  <Text style={s.ratingValue}>{place.rating}</Text>
                </View>
                {reviews ? <Text style={s.ratingCount}>{reviews} {t('reviews', 'đánh giá', '件のレビュー')}</Text> : null}
              </View>
            ) : null}
          </View>

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
          <View style={s.facts}>
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
                and takes the glass pill and a tag like its neighbours. */}
            {place.price_display || place.price_vnd != null ? (
              isFree(place) ? (
                <PricePill place={place} />
              ) : (
                <View style={s.fact}>
                  <Ionicons name="pricetag-outline" size={15} color={colors.textSecondary} />
                  <PricePill place={place} />
                </View>
              )
            ) : null}
            {dur ? (
              <View style={s.fact}>
                <Ionicons name="time-outline" size={15} color={colors.textSecondary} />
                <Text style={s.factText}>{dur}</Text>
              </View>
            ) : null}
          </View>

          {(place.desc_en || place.desc_vi) && <Text style={s.desc}>{t(place.desc_en, place.desc_vi, place.desc_ja)}</Text>}

          {/* ── info card ── */}
          {firstRow != null && (
            <Card style={s.infoGroup}>
              {place.address && (
                <InfoRow
                  label={t('Address', 'Địa chỉ', '住所')}
                  first={firstRow === 'address'}
                  onPress={mapsUrl ? () => Linking.openURL(mapsUrl) : undefined}
                >
                  <Text style={[s.infoValue, mapsUrl && s.infoLink]}>{address}</Text>
                </InfoRow>
              )}

              {hours.length > 0 && (
                <View style={firstRow !== 'hours' && s.rowDivider}>
                  {/* The one line most people came for is the whole row;
                      the table it was derived from waits behind the
                      chevron instead of pushing Call and Website off the
                      screen. Green when open; closed is a fact about a
                      café, not a fault, so it stays in the quiet grey
                      rather than going red. */}
                  <Pressable
                    onPress={() => setHoursOpen((v) => !v)}
                    style={s.infoRow}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: hoursOpen }}
                  >
                    <View style={{ flex: 1 }}>
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
                    <Ionicons name={hoursOpen ? 'chevron-up' : 'chevron-down'} size={17} color={colors.textTertiary} />
                  </Pressable>
                  {hoursOpen && (
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
                  label={t('Phone', 'Điện thoại', '電話番号')}
                  first={firstRow === 'phone'}
                  onPress={() => Linking.openURL(`tel:${place.phone!.replace(/\s/g, '')}`)}
                >
                  <Text style={[s.infoValue, s.infoLink]}>{place.phone}</Text>
                </InfoRow>
              )}

              {place.website && (
                <InfoRow
                  label={t('Website', 'Trang web', 'ウェブサイト')}
                  first={firstRow === 'website'}
                  onPress={() => Linking.openURL(place.website!)}
                >
                  <Text style={[s.infoValue, s.infoLink]} numberOfLines={1}>
                    {place.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
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
  dots: {
    position: 'absolute', bottom: 15, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(10,11,10,0.45)', borderRadius: radius.pill,
    paddingHorizontal: 11, paddingVertical: 8,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: 'rgba(255,255,255,0.38)' },
  dotOn: { width: 8, height: 8, borderRadius: 4, backgroundColor: onPhoto.text },
  // Required attribution, kept quiet — see the note in PlaceCard.
  attr: {
    position: 'absolute', right: space.page, bottom: 16, maxWidth: '55%',
    fontSize: 9, color: '#fff', opacity: 0.55,
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3,
  },

  body: { paddingHorizontal: space.page, paddingTop: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  // 26, not the 28 this was: the display face runs wider than the system
  // one, and place names are long enough to wrap without help.
  name: { color: colors.text, ...type.titleDetail },
  // Body face, not display: the qualifier is a fact about the title, not
  // a second title, and the change of face is what says so.
  subtitle: { color: colors.textSecondary, ...type.body, marginTop: 4 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  loc: { color: colors.textTertiary, ...type.meta },
  ratingBadge: {
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', gap: 3,
  },
  ratingValue: { color: colors.text, fontSize: 18, fontWeight: font.bold },
  ratingCount: { color: colors.textTertiary, fontSize: 12, fontWeight: font.regular },

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

  desc: { color: colors.textSecondary, ...type.body, lineHeight: 24, marginTop: 14 },

  // The Card supplies ground, border and radius; the horizontal inset
  // lives here so each row's hairline can run to the card's edge.
  infoGroup: { marginTop: 18, paddingHorizontal: space.cardPadding },
  // 17pt over a label and a 24pt line keeps every row a ≥58pt target.
  // A row is a column — label, then value. Only Hours lays itself across,
  // for the chevron at its end.
  infoStack: { paddingVertical: 17 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 17 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  infoLabel: {
    color: colors.textTertiary, fontSize: 12, fontWeight: font.semibold,
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 5,
  },
  infoValue: { color: colors.ink, ...type.meta, lineHeight: 24 },
  /** The value of a row that goes somewhere. Ink like the rest — the
   *  accent came off after a day on the phone, where a two-line address
   *  in red outweighed the title — and a touch of weight is what is
   *  left to say the row is a link. */
  infoLink: { fontWeight: font.medium },
  // Semibold and a size up on the table under it: this is the answer, and
  // it is the working it was derived from.
  openNow: { color: colors.open, fontSize: 15.5, fontWeight: font.semibold },
  openNowShut: { color: colors.textTertiary },
  hoursTable: { paddingBottom: 16 },
  hourRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  hourDay: { color: colors.ink, fontSize: 14.5, fontWeight: font.medium },
  hourTime: { color: colors.ink, fontSize: 14.5, fontWeight: font.regular },
});
