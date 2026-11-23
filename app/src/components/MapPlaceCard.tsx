// The one place the map is talking about, in a strip along its bottom
// edge, laid out after a reference the owner chose on 23 Nov 2026:
//
//     [photo      ]  [open · until 22:00]  1.2 km  ✓         (➤)
//     [           ]  Name
//     [   kind    ]  Street, ward
//                    ★ 4.6 (920)
//
// The kind rides the foot of the photograph, centred, in its pin's
// colour, where the dot before the name used to stand for it: the same
// echo of the pin, now one that says which kind it is in words. Centred
// and low (owner, 24 Nov 2026) rather than in the top corner, where it
// stood level with the hours pill and the route's disc — three coloured
// things on one line; at the foot it reads as the photograph's caption. The hours lead, in a pill
// of their state's colour, because "can I go now" is the question a map
// is asked; the distance beside them is the other half of it. The rating
// has the last row to itself. The route to the place — the detail
// screen's Directions (`mapsRouteUrl`, one stop, driving) — is a disc in
// the top-right corner with the arrow alone (owner, 24 Nov 2026): it was
// a chip with its word at the end of the rating's row, and the arrow is
// the mark every map app uses for the act, so the word bought nothing
// the label read aloud does not still say.
//
// Neither a bookmark nor a check-in. The bookmark was here for an
// afternoon and went that evening (owner, 23 Nov 2026): the map is for
// finding where a place is and whether to go, and keeping it is a
// decision made on the place's own page, a tap away. A check-in is a
// claim to have been there, made from wherever the reader is standing —
// and on a map they are usually somewhere else; it also carries the
// flag, the sign-in, the daily cap, the undo menu and the reward that
// `PlaceDetailScreen` holds, which a second copy here would drift from.
// So the strip only says it has happened: a tick after the hours, with
// the count spoken. It had a line of its own until the layout above had
// four, and a fifth for a fact the reader already knows was one too many.
//
// No ✕, though the reference had one: a tap on the map's empty ground
// closes the strip, as it does on every map the reader already uses
// (`PlacesMap` › `onPress`). Two of the reference's colours were not
// taken either: its gold star (gold is the photograph's, `onPhoto.star`;
// on paper the star is coral, as the detail screen draws it) and its
// violet button (coral is this app's one accent).
//
// It knows nothing of the map. It takes a place, the chip its pin answers
// to and a distance somebody else worked out, so the same strip could sit
// under any picker.

import React from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Glyph, ICON } from './ui/glyph';
import { useMyCheckins } from '../lib/checkins';
import { visitsAt } from '../lib/checkin';
import { useFlag } from '../lib/useFlag';
import { coverOf, fmtCount, type Place } from '../lib/data';
import { useCityList } from '../lib/city';
import { cityTz } from '../lib/clock';
import { CLOSING_SOON_MIN, clockOf, openState, type OpenState } from '../lib/format';
import { fmtDistance } from '../lib/geo';
import { shortAddress } from '../lib/address';
import { useI18n } from '../lib/i18n';
import { localized } from '../lib/localized';
import { mapsRouteUrl } from '../lib/maps';
import { CATEGORIES, categoryLabel, pinCategory } from '../lib/categories';
import { splitName } from '../lib/name';
import { colors, font, radius, space } from '../theme';
import { PressableScale } from './ui';
import { PHOTO_DISC, PHOTO_SLOP } from './ui/controls';

/**
 * The hours, on a line of their own and always (owner, 23 Nov 2026): the
 * state as a word in its colour, then the hour that changes it — "Open ·
 * until 22:00", "Closing soon · until 23:00", "Closed · opens 10:00".
 *
 * The list's cards keep the other rule — an open place says nothing
 * until `CLOSING_SOON_MIN` before closing (`openFragment`) — and it is
 * right there: a column of cards each saying "until 22:00" is a mark
 * every row wears. A map shows one place at a time, and the question a
 * reader standing somewhere is asking of it is "can I go now". Silence
 * answered that only by inference. It also rode the end of the facts
 * line, where a shut place's "Closed · opens 10:00" was cut to
 * "Closed · o…" behind the rating and the distance, in the space the
 * 88pt photograph leaves beside the text.
 *
 * Since the reference layout (same day) the whole of it sits in a pill
 * of its state's colour (`TONE`), where it was a coloured word on a grey
 * line. Whole phrases per language for the hour, as `openFragment` keeps
 * them: Japanese puts まで after it. Hours `openState` cannot read say
 * nothing.
 */
type Hours = { word: string; tone: 'open' | 'soon' | 'shut'; rest: string | null };
// A well and its ink for each state, the theme's own pairs, so the pill
// passes on every look: the visited pill's green (`okSoft`/`okInk`), the
// warning well (`warnSoft`/`warnInk`), and the delete well with its red
// (`badSoft`/`bad`, 5.2:1 at its darkest).
const TONE = {
  open: { backgroundColor: colors.okSoft, color: colors.okInk },
  soon: { backgroundColor: colors.warnSoft, color: colors.warnInk },
  shut: { backgroundColor: colors.badSoft, color: colors.bad },
};
type T = (en: string, vi: string, ja?: string, zh?: string, hant?: string) => string;
function hoursLine(state: OpenState | null, t: T): Hours | null {
  if (!state) return null;
  if (!state.open) {
    const at = state.opensAtMin != null ? clockOf(state.opensAtMin) : null;
    return {
      word: t('Closed', 'Đóng cửa', '閉店', '已打烊', '已打烊'),
      tone: 'shut',
      rest: at ? t(`opens ${at}`, `mở ${at}`, `${at}開店`, `${at} 开门`, `${at} 開門`) : null,
    };
  }
  if (state.untilMin == null) {
    return { word: t('Open', 'Đang mở', '営業中', '营业中', '營業中'), tone: 'open', rest: t('24 hours', '24 giờ', '24時間', '24小时', '24小時') };
  }
  const at = clockOf(state.untilMin);
  const until = t(`until ${at}`, `đến ${at}`, `${at}まで`, `营业至 ${at}`, `營業至 ${at}`);
  return (state.closesInMin as number) <= CLOSING_SOON_MIN
    ? { word: t('Closing soon', 'Sắp đóng', 'まもなく閉店', '即将打烊', '即將打烊'), tone: 'soon', rest: until }
    : { word: t('Open', 'Đang mở', '営業中', '营业中', '營業中'), tone: 'open', rest: until };
}

/** The route to the place, opened in Maps; told when nothing opens it. */
function Directions({ place, t }: { place: Place; t: T }) {
  const url = mapsRouteUrl([place], 'driving')?.url;
  if (!url) return null;
  const label = t('Directions', 'Chỉ đường', '経路', '路线', '路線');
  return (
    <PressableScale
      onPress={() => { Linking.openURL(url).catch(() => Alert.alert(t('Could not open Maps', 'Không mở được bản đồ', 'マップを開けませんでした', '无法打开地图', '無法開啟地圖'))); }}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={PHOTO_SLOP}
      style={s.routeSlot}
      contentStyle={s.route}
      testID="map-card-route"
    >
      <Glyph name="navigate-outline" size={ICON.action} color={colors.accent} />
    </PressableScale>
  );
}

export default function MapPlaceCard({ place, distanceKm, kind, now, onPress }: {
  place: Place;
  /** Null when there is no fix to measure from — the figure is then left
   *  out rather than written as zero. */
  distanceKm: number | null;
  /** The chip this place's pin answers to, or null for its own kind —
   *  what `PlacesMap` paints the pin with (`pinCategory`), so the label on
   *  the photograph and the pin on the map cannot disagree. A place no
   *  category claims has no label, as its pin is grey. */
  kind: string | null;
  now: Date;
  onPress: () => void;
}) {
  const { t, lang } = useI18n();
  // Read here rather than passed in: the reader's own, from a provider
  // above every screen, and the map's screen is at its size ceiling
  // (`oversize.js`). Nothing to count while check-in is switched off
  // (`place_checkin`).
  const checkinOn = useFlag('place_checkin');
  const mine = useMyCheckins().data;
  const visits = checkinOn ? visitsAt(mine, place.slug).length : 0;
  const cover = coverOf(place);
  const cities = useCityList().cities;
  const state = openState(place.opening_hours, now, cityTz(cities, place.city_id));
  const key = pinCategory(place, kind);
  // The street under the name, as the detail screen prints it — street
  // and ward, without the city, postal code and country (`shortAddress`),
  // with the place's own city's names so one the module has never heard
  // of is cut too. It lets two branches of one brand be told apart
  // without opening either. No address falls back to the ward.
  const home = cities.find((c) => c.id === place.city_id);
  const address = shortAddress(place.address, home ? [home.name_vi, home.name_en, home.short_vi, home.short_en].filter((n): n is string => !!n) : [])
    ?? (place.neighborhood_en ? localized(place, 'neighborhood', lang) : null);
  const hours = hoursLine(state, t);
  // The brand alone, as `PlaceCard` prints it: the suffix after the dash
  // is the branch's ward, which the address line says with the street.
  const name = splitName(localized(place, 'name', lang)).title;
  const ratingFact = place.rating ? `${place.rating.toFixed(1)}${place.rating_count ? ` (${fmtCount(place.rating_count)})` : ''}` : null;
  // The list's own formatter: metres to the nearest fifty while it is a
  // walk, one decimal while it is a ride.
  const distanceFact = distanceKm != null ? fmtDistance(distanceKm) : null;
  const visited = visits > 0
    ? (visits === 1
      ? t('Checked in once', 'Đã check-in 1 lần', '1回チェックイン済み', '打过卡 1 次', '打過卡 1 次')
      : t(`Checked in ${visits} times`, `Đã check-in ${visits} lần`, `${visits}回チェックイン済み`, `打过卡 ${visits} 次`, `打過卡 ${visits} 次`))
    : null;
  const hoursText = hours ? [hours.word, hours.rest].filter(Boolean).join(' · ') : null;
  // The "★" is drawn, not read: a listener hears the facts as words, in
  // the order the eye meets them.
  const spoken = [
    key ? categoryLabel(key, t) : null,
    hours ? [hours.word, hours.rest].filter(Boolean).join(', ') : null,
    distanceFact,
    name,
    address,
    ratingFact ? t(`rated ${ratingFact}`, `đánh giá ${ratingFact}`, `評価 ${ratingFact}`, `评分 ${ratingFact}`, `評分 ${ratingFact}`) : null,
    visited,
  ].filter((f): f is string => !!f).join(', ');

  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={spoken} style={s.gutter} contentStyle={s.card}>
      <View style={s.thumb}>
        {cover
          ? <Image source={{ uri: cover.photo_uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          : null}
        {key ? (
          <View style={s.kindRow}>
            <Text testID="place-kind" style={[s.kind, { backgroundColor: CATEGORIES[key].color }]} numberOfLines={1}>
              {categoryLabel(key, t)}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={s.body}>
        <View style={s.status}>
          {hoursText ? (
            <Text testID="place-hours" style={[s.pill, TONE[hours!.tone]]} numberOfLines={1}>{hoursText}</Text>
          ) : null}
          {distanceFact ? <Text style={s.facts} numberOfLines={1}>{distanceFact}</Text> : null}
          {visited ? <View testID="place-visited"><Glyph name="checkmark-circle-outline" size={ICON.meta} color={colors.textSecondary} /></View> : null}
        </View>
        <Text style={s.name} numberOfLines={1}>{name}</Text>
        {address ? <Text style={s.facts} numberOfLines={1} testID="place-address">{address}</Text> : null}
        {ratingFact ? (
          <Text style={s.rating} numberOfLines={1}>
            <Text testID="place-star" style={{ color: colors.accent }}>★ </Text>
            {place.rating!.toFixed(1)}
            {place.rating_count ? <Text style={s.facts}>{` (${fmtCount(place.rating_count)})`}</Text> : null}
          </Text>
        ) : null}
      </View>
      <Directions place={place} t={t} />
    </PressableScale>
  );
}

const s = StyleSheet.create({
  // The inset lives on the outer Pressable (`style`), not the
  // animated inner view: that keeps the page gutters outside the tap
  // target, so a press beside the strip does not open the place.
  gutter: { marginHorizontal: space.page },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 10,
    backgroundColor: colors.bgElevated, borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  // 88 square, as since the morning: the reference's 80 lost the label
  // half its photograph. Overflow clipped so the label's corner follows
  // the photograph's.
  thumb: { width: 88, height: 88, borderRadius: radius.card - 4, overflow: 'hidden', backgroundColor: colors.surfaceGlass },
  // On the photograph, in the pin's own colour: every category colour
  // carries a white glyph on the pin, so white words on it read as well.
  // A row across the photograph's foot that centres what it holds; the
  // label inside keeps its own width.
  kindRow: { position: 'absolute', left: 6, right: 6, bottom: 6, alignItems: 'center' },
  kind: {
    maxWidth: 76,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden',
    color: '#FFFFFF', fontSize: 11, fontWeight: font.semibold,
  },
  body: { flex: 1, gap: 3, minWidth: 0 },
  // Clear of the route's disc in the top-right corner (36 and a 4pt gap).
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 22, paddingRight: 40 },
  pill: {
    flexShrink: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden',
    fontSize: 12, fontWeight: font.semibold,
  },
  name: { color: colors.text, fontSize: 16, lineHeight: 21, fontWeight: font.semibold },
  facts: { color: colors.textSecondary, fontSize: 13, fontWeight: font.regular },
  rating: { color: colors.text, fontSize: 13, fontWeight: font.semibold, marginTop: 2 },
  // The photograph disc's size and reach (`PHOTO_DISC`, `PHOTO_SLOP`),
  // in the accent's own wash and ink as an on-chip wears them: the one
  // act on the strip besides opening it.
  routeSlot: { position: 'absolute', top: 10, right: 10 },
  route: {
    width: PHOTO_DISC, height: PHOTO_DISC, borderRadius: PHOTO_DISC / 2,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft,
  },
});
