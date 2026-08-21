// A saved trip, whole.
//
// The card in the list prints three stops and says how many it left out;
// this prints all of them, with the sentence a model wrote under each and
// the money split into what it was spent on. That division is the reason
// both screens exist — a card that showed everything would make this one a
// tap that bought nothing, which is what the trips list used to argue.
//
// ── read from the list, not fetched again ──
//
// The route carries an id and nothing else. `useMyTrips` has already loaded
// every trip with its stops and its places, and reading the row out of that
// keeps one copy of a trip in the app: a second fetch here would be a
// second answer that can disagree with the first, and the screen behind
// this one would still be showing the older of the two.
//
// The cost of that is a moment of "not found" if this screen is reached
// before the list has loaded — deep-linked, or restored from a cold start.
// That is drawn honestly rather than papered over with a spinner that would
// never end.
//
// ── delete lives here ──
//
// It used to be a trash glyph on the card. Once the card became a tap of
// its own, a destructive control inside it was competing for the same
// finger, and the two are a bad pair: the cost of missing is losing a trip.
// Here it is at the bottom of the thing it destroys, after the reader has
// seen what it is.

import React, { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import {
  AmbientWarmth, Card, Empty, PressableScale, Screen, useTabBarClearance,
} from '../components/ui';
import { useAuth } from '../lib/auth';
import { useCity } from '../lib/city';
import { fromISO } from '../lib/day';
import { deleteTrip, useMyTrips, type TripStopRow } from '../lib/data';
import { clockOf, dateline, dotWindow, fmtMinutes } from '../lib/format';
import { fmtDistance } from '../lib/geo';
import { useI18n } from '../lib/i18n';
import { mapsRouteUrl, routeMode } from '../lib/maps';
import { coverOf } from '../lib/place';
import { stopCount, summaryLine } from '../lib/sketch';
import { legsOf } from '../lib/travel';
import { COMPANY } from '../lib/trip';
import { spendVnd, tripCover } from '../lib/trips';
import { colors, font, onPhoto, radius, space, type } from '../theme';
import type { Nav, RootRoute } from '../nav';

const money = (vnd: number) => (vnd >= 1_000_000
  ? `${Math.round(vnd / 100_000) / 10}M ₫`
  : `${Math.round(vnd / 1000)}k ₫`);

/** Categories whose spend is food rather than something you did. Same set
 *  the planner splits its donut on, so a saved trip and a fresh plan
 *  account for the same café the same way. */
const FOOD = new Set(['eats', 'cafes']);

export default function TripDetailScreen({ navigation, route }: {
  navigation: Nav;
  route: RootRoute<'TripDetail'>;
}) {
  const { t, lang } = useI18n();
  const { session } = useAuth();
  const { cities } = useCity();
  const clearance = useTabBarClearance();
  const trips = useMyTrips(session?.user?.id);

  /**
   * Which page of the gallery is showing, and how wide a page is.
   *
   * Above the early return, because a hook cannot live below one. This
   * screen renders "not found" while the trips list is still loading —
   * deep-linked, or restored from a cold start — and a `useState`
   * declared under that branch would be skipped on the first render and
   * present on the second. React counts hooks, so the second render
   * throws rather than misbehaving quietly.
   *
   * The width is measured rather than taken from the window, because the
   * gallery sits inside the screen's own horizontal padding.
   * `Dimensions.get` minus a constant is the version that breaks on the
   * next screen that pads differently.
   */
  const [shot, setShot] = useState(0);
  const [galleryW, setGalleryW] = useState(0);

  const trip = trips.data.find((x) => x.id === route.params.id) ?? null;

  if (!trip) {
    return (
      <Screen
        title={t('Trip', 'Chuyến đi', '旅程')}
        onBack={() => navigation.goBack()}
      >
        <Empty text={trips.loaded
          ? t('That trip is no longer here.', 'Chuyến đi đó không còn nữa.', 'その旅程はもうありません。')
          : t('Loading…', 'Đang tải…', '読み込み中…')}
        />
      </Screen>
    );
  }

  const stops = trip.trip_stops;
  const day = fromISO(trip.day);
  const city = cities.find((c) => c.id === trip.city_id);
  const company = COMPANY.find((c) => c.key === trip.company);

  const first = stops[0];
  const last = stops[stops.length - 1];
  const window = first?.arrive_min != null && last?.arrive_min != null
    ? `${clockOf(first.arrive_min)}–${clockOf(last.arrive_min + (last.dwell_min ?? 0))}`
    : null;

  // Split here rather than stored: the prices live on the places, so a
  // total worked out now is the one the catalog can currently defend. What
  // is stored is the decision — which stops, in what order, at what time.
  let food = 0;
  let doing = 0;
  for (const st of stops) {
    const v = st.places?.price_vnd ?? 0;
    if ((st.places?.categories ?? []).some((c) => FOOD.has(c))) food += v;
    else doing += v;
  }
  const spend = spendVnd(stops.map((st: TripStopRow) => st.places));

  /**
   * The journeys between the stops, derived rather than read back.
   *
   * Nothing about a leg is stored — `trip_stops` keeps the decision (which
   * places, in what order, at what time) and the distance falls out of the
   * places' own coordinates, exactly as the money above is worked out from
   * their prices rather than frozen at save time.
   *
   * A stop whose place has since left the catalog stands in as a pair of
   * nulls, which is the input `legBetween` already refuses to guess from:
   * the row either side of a delisted place simply has no leg, rather than
   * a distance measured to somewhere nobody can name.
   *
   * `legsOf` keeps unmeasurable legs in place as null so index `i` is
   * always the journey *out of* stop `i` — hence `legs[i - 1]` at the row
   * that leg arrives at.
   */
  const legs = legsOf(stops.map((st) => st.places ?? { lat: null, lng: null }));

  /**
   * The whole day as one Google Maps route.
   *
   * A link rather than a map drawn here, and that is a licence rather
   * than a preference: every place in this catalog is Google Places
   * Content, the Places terms forbid showing it on a non-Google map
   * (§5.3), and the only map that renders on iOS in Expo Go is Apple's.
   * `MiniMap` carries the long version. Opening Google's own app is the
   * one route that is not a workaround — and it hands the reader
   * turn-by-turn and live traffic, which a thumbnail never could.
   */
  const mapRoute = mapsRouteUrl(
    stops.map((st) => st.places ?? {}),
    routeMode(legs),
  );

  /**
   * Whether there is a gallery at all, and the credit its current page
   * owes.
   *
   * `tripCover` is asked only whether *any* stop has a usable picture —
   * the gallery itself pages over the stops in order, so the answer's
   * own photograph is not used. Reusing it rather than writing a second
   * `.some()` keeps one rule about what counts as usable: a photograph
   * the desk hid is excluded there and stays excluded here.
   */
  const cover = tripCover(stops);
  const shotAttr = stops[shot]?.places ? coverOf(stops[shot].places!)?.attribution_name : null;

  const confirmDelete = () => Alert.alert(
    t('Delete this trip?', 'Xoá chuyến đi này?', 'この旅程を削除しますか？'),
    t(
      `"${trip.title}" will be gone for good.`,
      `"${trip.title}" sẽ mất hẳn.`,
      `「${trip.title}」は完全に削除されます。`,
    ),
    [
      { text: t('Cancel', 'Huỷ', 'キャンセル'), style: 'cancel' },
      {
        text: t('Delete', 'Xoá', '削除'),
        style: 'destructive',
        // Back first, then reload: the list is the screen that has to
        // notice, and leaving this one standing over a row that no longer
        // exists would put it through its own "no longer here" state on
        // the way out.
        onPress: () => {
          deleteTrip(trip.id)
            .then(() => { navigation.goBack(); trips.reload(); })
            .catch((e: Error) => Alert.alert(
              t('Could not delete', 'Không xoá được', '削除できませんでした'), e.message,
            ));
        },
      },
    ],
  );

  return (
    <Screen
      title={trip.title}
      subtitle={summaryLine([
        day ? dateline(lang, day) : trip.day,
        window,
        city ? t(city.short_en, city.short_vi, city.short_ja) : null,
        company ? t(company.en, company.vi, company.ja) : null,
      ])}
      onBack={() => navigation.goBack()}
    >
      <AmbientWarmth />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.page, paddingBottom: clearance }}
        showsVerticalScrollIndicator={false}
      >
        {/* The day, one place at a time.

            ── one page per stop, not one page per photograph ──

            `PlaceDetailScreen`'s carousel pages through a place's own
            pictures, because there the subject is one place. Here the
            subject is the sequence, so page `i` is stop `i` and stays
            stop `i` — including for a stop with no picture, which draws
            its emoji on the same grey `PlaceCard` uses. Dropping those
            pages would be tidier and would break the one thing that
            makes this more than decoration: that the index means
            something to the list underneath.

            A stop whose place left the catalog keeps its page too, with
            a pin on it. The list below already draws it as a gap; a
            carousel that quietly skipped it would put the reader's
            fourth stop under the third name.

            Nothing here when no stop has a picture at all — `tripCover`
            already answers that, and a row of grey panels with pins on
            them is a control that costs a swipe and returns nothing. */}
        {cover && (
          <View style={s.gallery} onLayout={(e) => setGalleryW(e.nativeEvent.layout.width)}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setShot(Math.round(e.nativeEvent.contentOffset.x / galleryW))}
            >
              {stops.map((stop, i) => {
                const ph = stop.places ? coverOf(stop.places) : undefined;
                return ph
                  ? (
                    <Image
                      key={`${trip.id}-shot-${i}`}
                      source={{ uri: ph.photo_uri }}
                      style={[s.shot, { width: galleryW }]}
                      contentFit="cover"
                      transition={200}
                    />
                  )
                  : (
                    <View key={`${trip.id}-shot-${i}`} style={[s.shot, s.shotBare, { width: galleryW }]}>
                      <Text style={{ fontSize: 52 }}>{stop.places?.emoji ?? '📍'}</Text>
                    </View>
                  );
              })}
            </ScrollView>
            {/* The credit belongs to the picture on screen, so it is read
                from the current page rather than printed once. This is
                also why a carousel is easier to license than a strip of
                thumbnails: one photograph visible, one credit owed. */}
            {shotAttr ? <Text style={s.attr} numberOfLines={1}>{shotAttr}</Text> : null}
            {stops.length > 1 && (
              <View style={s.dots}>
                {dotWindow(stops.length, shot).map((i) => (
                  <View key={i} style={[s.dot, i === shot && s.dotOn]} />
                ))}
              </View>
            )}
          </View>
        )}

        <Card style={s.card}>
          {stops.map((stop, i) => {
            const place = stop.places;
            // Whether the gallery is currently showing this one. False
            // for every row when there is no gallery, which is what
            // keeps a trip with no photographs looking exactly as it did.
            const here = !!cover && i === shot;
            // The same band the editor makes tappable, for the same
            // reason: a saved trip names places, and a named place that
            // will not open is a dead end. Only when there is a place to
            // open — a row drawn as "no longer listed" has no detail
            // screen behind it, and a press that goes nowhere is worse
            // than no press at all.
            const Who = place ? PressableScale : View;
            const whoProps = place
              ? {
                // Split across the two halves on purpose: `flex` has to
                // land on the outer Pressable or the column collapses,
                // `gap` on the inner view or it spaces nothing. See
                // `PressableScale`, which documents this exact trap.
                containerStyle: s.whoOuter,
                style: s.whoInner,
                onPress: () => navigation.navigate('PlaceDetail', { slug: place.slug }),
                accessibilityRole: 'button' as const,
                accessibilityLabel: t(
                  `Open ${place.name_en}`,
                  `Mở ${place.name_en}`,
                  `${place.name_en}を開く`,
                ),
              }
              : { style: s.who };
            return (
            <View key={`${trip.id}-${i}`}>
              {i > 0 ? <View style={s.divider} /> : null}
              {/* How you get here from the stop before.

                  Not decoration: the options screen and the editor both
                  print this line, and saving the plan was losing it. A
                  reader chose between "6.2 km · ≈ 20 min" and "50 m · ≈ 2
                  min", saved the one they wanted, opened it again and
                  found neither — the distance that decided the choice had
                  gone. Nothing was stored to lose, and nothing needs to
                  be: `legsOf` measures it from coordinates the query
                  already carries.

                  Drawn the way the other two screens draw it, down to the
                  glyph and the separator, rather than the pill the design
                  reference uses — one journey should not have two
                  appearances depending on which screen the reader is
                  standing on.

                  Under the rule and above the stop it leads to, because
                  that is what it answers: *how you got here*. Indented to
                  the name column, so the time gutter stays a column of
                  times only. */}
              {i > 0 && legs[i - 1] && (
                <View style={s.legRow}>
                  <Ionicons
                    name={legs[i - 1]!.mode === 'walk' ? 'walk-outline' : 'car-outline'}
                    size={12}
                    color={colors.textTertiary}
                  />
                  <Text style={s.legText}>
                    {fmtDistance(legs[i - 1]!.km)} · ≈ {fmtMinutes(legs[i - 1]!.minutes, lang)}
                  </Text>
                </View>
              )}
              <View style={s.stopRow}>
                <Text style={[s.stopTime, here && s.stopTimeHere]}>
                  {stop.arrive_min != null ? clockOf(stop.arrive_min) : '—'}
                </Text>
                <Who {...whoProps}>
                  {stop.places
                    ? (
                      <>
                        {/* Which name the picture above belongs to.

                            The weight only, and nothing dimmed. Fading
                            the other four would make the itinerary
                            harder to read to say something about the
                            carousel, and the itinerary is why the screen
                            exists. Semibold to bold is a small shift on
                            purpose: it should be findable when you go
                            looking and invisible when you are not.

                            The hour beside it takes the accent, which is
                            the louder half of the pair and the one that
                            carries at a glance. Two quiet marks rather
                            than one shout. */}
                        <Text style={[s.name, here && s.nameHere]}>{stop.places.name_en}</Text>
                        <Text style={s.area}>
                          {summaryLine([
                            stop.places.neighborhood_en,
                            stop.dwell_min ? fmtMinutes(stop.dwell_min, lang) : null,
                          ])}
                        </Text>
                      </>
                    )
                    : (
                      // Drawn as a gap rather than dropped. The reader kept
                      // five stops; a list of four with no explanation is
                      // the app losing one in front of them.
                      <Text style={s.gone}>
                        {t('No longer listed', 'Không còn trong danh mục', '掲載終了')}
                      </Text>
                    )}
                  {/* Only a model's sentence is stored — the fact line the
                      editor falls back to is derived from opening hours and
                      would be last August's by now. `why_lang` says which
                      language it was written in, so a trip read after a
                      language switch can say so instead of looking broken. */}
                  {!!stop.why && (
                    <Text style={s.why}>
                      {stop.why}
                      {stop.why_lang && stop.why_lang !== lang ? (
                        <Text style={s.whyLang}>{`  · ${stop.why_lang.toUpperCase()}`}</Text>
                      ) : null}
                    </Text>
                  )}
                </Who>
              </View>
            </View>
            );
          })}
        </Card>

        {/* Between the stops and the money, which is where it belongs in
            the reading: you have just seen the day, and this is the way
            out of the app and onto the street. Below the money it would
            be past the point most readers stop.

            Drawn as the row PlaceDetail already uses for its address and
            its phone number — round icon well, label, chevron — because
            it is the same kind of thing: a fact that opens something
            outside the app. */}
        {mapRoute && (
          <PressableScale
            onPress={() => { Linking.openURL(mapRoute.url).catch(() => {}); }}
            style={s.route}
            accessibilityRole="button"
          >
            <View style={s.routeIcon}>
              <Ionicons name="navigate-outline" size={18} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.routeLabel}>
                {t('Open the route', 'Mở lộ trình', 'ルートを開く')}
              </Text>
              <Text style={s.routeSub}>
                {/* What it will actually do, not what it is called. The
                    mode is the day's, collapsed by `routeMode` — and it
                    is worth printing because Google opens on it and a
                    reader who expected the other one should find that out
                    here rather than three screens into another app. */}
                {summaryLine([
                  t('Google Maps', 'Google Maps', 'Google マップ'),
                  stopCount(stops.length, t),
                ])}
                {/* Never silent about a cap. Google takes nine stops
                    between the first and the last; a twelfth stop would
                    otherwise vanish from the route with the link still
                    looking complete. */}
                {mapRoute.dropped > 0
                  ? `  ·  ${t(
                    `first ${stops.length - mapRoute.dropped} only`,
                    `chỉ ${stops.length - mapRoute.dropped} điểm đầu`,
                    `最初の${stops.length - mapRoute.dropped}件のみ`,
                  )}`
                  : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </PressableScale>
        )}

        <Card style={[s.card, s.spend]}>
          <Text style={s.spendTitle}>{t('Roughly', 'Ước chừng', 'おおよそ')}</Text>
          <View style={s.spendRow}>
            <Text style={s.spendKey}>{t('Food and drink', 'Ăn uống', '飲食')}</Text>
            <Text style={s.spendVal}>{money(food)}</Text>
          </View>
          <View style={s.spendRow}>
            <Text style={s.spendKey}>{t('Everything else', 'Phần còn lại', 'その他')}</Text>
            <Text style={s.spendVal}>{money(doing)}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.spendRow}>
            <Text style={[s.spendKey, s.spendTotalKey]}>
              {summaryLine([stopCount(stops.length, t), t('per person', 'mỗi người', '1人あたり')])}
            </Text>
            <Text style={[s.spendVal, s.spendTotalVal]}>{`~${money(spend)}`}</Text>
          </View>
          {/* Transport is in the total and not in either line above it: the
              planner charges a ride per hop and it belongs to no stop. Said
              rather than left as a sum that does not add up. */}
          <Text style={s.spendNote}>
            {t(
              'Rides between stops are in the total.',
              'Tiền xe giữa các điểm đã tính trong tổng.',
              '移動費も合計に含まれています。',
            )}
          </Text>
        </Card>

        <PressableScale onPress={confirmDelete} style={s.delete} accessibilityRole="button">
          <Ionicons name="trash-outline" size={17} color={colors.bad} />
          <Text style={s.deleteText}>
            {t('Delete this trip', 'Xoá chuyến đi này', 'この旅程を削除')}
          </Text>
        </PressableScale>
      </ScrollView>
    </Screen>
  );
}

const CAPTION = { fontSize: 13, fontWeight: font.regular } as const;

const s = StyleSheet.create({

  card: { padding: space.cardPadding, marginBottom: space.cardGap },
  divider: {
    height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft,
    marginVertical: 12,
  },

  stopRow: { flexDirection: 'row', gap: 12 },
  stopTime: {
    ...CAPTION, color: colors.textSecondary, width: 46,
    fontVariant: ['tabular-nums'], paddingTop: 2,
  },
  // The same row the options screen and the editor draw, at the same size
  // and in the same colour. Indented past the time gutter (46 + the row's
  // 12pt gap) so the leg lines up with the names rather than with the
  // clock — the times are a column, and a distance is not a time.
  legRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginLeft: 46 + 12, marginBottom: 10,
  },
  legText: { ...CAPTION, color: colors.textTertiary },
  who: { flex: 1, gap: 2 },
  /** The same column, taken apart for the pressable branch. */
  whoOuter: { flex: 1 },
  whoInner: { gap: 2 },
  name: { ...type.body, color: colors.text, fontWeight: font.semibold },
  // The stop the gallery is on. Weight only — see the note at the call
  // site for why nothing else is dimmed to make this stand out.
  nameHere: { fontWeight: font.bold },
  stopTimeHere: { color: colors.accent, fontWeight: font.semibold },
  area: { ...CAPTION, color: colors.textTertiary },
  gone: { ...type.body, color: colors.textTertiary, fontStyle: 'italic' },
  why: { ...CAPTION, color: colors.textSecondary, lineHeight: 18, marginTop: 4 },
  whyLang: { color: colors.textTertiary, fontWeight: font.semibold },

  // The card chrome PlaceDetail gives its address and phone rows, because
  // this is the same kind of row: a fact you tap to leave the app with.
  // The type pairing inside is this screen's own — a stop's name over its
  // meta line — so the row belongs to both at once.
  // Rounded and clipping, so the pages are the card and not a filmstrip
  // running under one. Same corner radius as everything else on the page.
  gallery: {
    borderRadius: radius.card, overflow: 'hidden', marginBottom: space.cardGap,
  },
  // 16:10, `PlaceCard`'s ratio rather than the Trips card's 3:1 band. The
  // roles are reversed here: on the list the picture identifies a card
  // among cards, and here it is the thing being looked at.
  shot: { aspectRatio: 16 / 10, backgroundColor: colors.surfaceGlass },
  shotBare: { alignItems: 'center', justifyContent: 'center' },
  // Required wherever the photo is shown; read from the page on screen.
  attr: {
    position: 'absolute', right: 12, bottom: 12, maxWidth: '50%',
    fontSize: 9, color: onPhoto.text, opacity: 0.55,
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3,
  },
  // The same pill of dots `PlaceDetailScreen` floats over its hero, and
  // the same `dotWindow` behind it, so a long day gets a fixed strip
  // instead of a row that runs off the picture.
  dots: {
    position: 'absolute', bottom: 12, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(10,8,13,0.45)', borderRadius: radius.pill,
    paddingHorizontal: 11, paddingVertical: 8,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: 'rgba(255,255,255,0.38)' },
  dotOn: { width: 8, height: 8, borderRadius: 4, backgroundColor: onPhoto.text },

  route: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.card, padding: space.cardPadding, marginBottom: space.cardGap,
  },
  routeIcon: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentLine,
  },
  routeLabel: { ...type.body, color: colors.text, fontWeight: font.semibold },
  routeSub: { ...CAPTION, color: colors.textTertiary, marginTop: 2 },

  spend: { gap: 10 },
  spendTitle: { ...CAPTION, color: colors.textTertiary, fontWeight: font.semibold, letterSpacing: 0.6, textTransform: 'uppercase' },
  spendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spendKey: { ...type.body, color: colors.textSecondary, flex: 1 },
  spendVal: { ...type.body, color: colors.text, fontVariant: ['tabular-nums'] },
  spendTotalKey: { color: colors.text, fontWeight: font.semibold },
  spendTotalVal: { fontWeight: font.semibold },
  spendNote: { ...CAPTION, color: colors.textTertiary },

  // Quiet, and last. A destructive action does not need to be loud to be
  // findable — it needs to be somewhere nobody reaches by accident.
  delete: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderGlassSoft,
    paddingVertical: 14, marginTop: 4,
  },
  deleteText: { ...type.body, color: colors.bad, fontWeight: font.semibold },
});
