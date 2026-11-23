// The one place the map is talking about, in a strip along its bottom
// edge: its photograph, its name, and the three facts a reader standing
// somewhere wants — how good, how far, how long it stays open — with the
// bookmark, and how often the reader has checked in there.
//
// Grown on 23 Nov 2026 (owner), measured against a map card from another
// app: the photograph 64 → 88, the name allowed a second line, and the
// chevron given up to the bookmark. At 64 the photograph was the one
// thing on the strip that tells two cafés apart and the smallest thing on
// it; a long name ("Tranquil Books & Coffee") lost its second half. The
// strip stands 24pt taller, which the map's bottom padding takes up.
//
// The bookmark is here and check-in is not. Saving is one tap on the
// collection picker every card already opens (`save` in `lib/save`), and
// a reader browsing a map is deciding what to keep. A check-in is a claim
// to have been there, made from wherever the reader is standing — and on
// a map they are usually somewhere else; it also carries the flag, the
// sign-in, the daily cap, the undo menu and the reward that
// `PlaceDetailScreen` holds, which a second copy here would drift from.
// So the strip only says the count, and the detail screen keeps the act.
//
// It knows nothing of the map. It takes a place and a distance somebody
// else worked out, so the same strip could sit under any picker.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Glyph, ICON } from './ui/glyph';
import { PHOTO_DISC, PHOTO_SLOP } from './ui/controls';
import { useIsSaved, useSaveActions } from '../lib/save';
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
import { splitName } from '../lib/name';
import { colors, font, radius, space } from '../theme';
import { PressableScale } from './ui';

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
 * The colours are the detail screen's hours row (`colors.open`,
 * `colors.shutInk`) and the card's amber for closing soon (`colors.soon`),
 * each on the word alone, so the hour reads in the facts' grey. Whole
 * phrases per language for the hour, as `openFragment` keeps them:
 * Japanese puts まで after it. Hours `openState` cannot read say nothing.
 */
type Hours = { word: string; tone: 'open' | 'soon' | 'shut'; rest: string | null };
const TONE = { open: colors.open, soon: colors.soon, shut: colors.shutInk };
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

export default function MapPlaceCard({ place, distanceKm, tint, now, onPress }: {
  place: Place;
  /** Null when there is no fix to measure from — the figure is then left
   *  out rather than written as zero. */
  distanceKm: number | null;
  /** The colour this place's pin is wearing on the map, or null where it
   *  is wearing the map's ink. The card repeats it so the eye can walk
   *  from the card back to the pin it is talking about — the coral pin
   *  says "this one", and the mark says which of them it was. */
  tint: string | null;
  now: Date;
  onPress: () => void;
}) {
  const { t, lang } = useI18n();
  const { save } = useSaveActions();
  const saved = useIsSaved(place.slug);
  // Read here rather than passed in, as the bookmark's state is: both are
  // the reader's own, from providers above every screen, and the map's
  // screen is at its size ceiling (`oversize.js`). Nothing to count while
  // check-in is switched off (`place_checkin`).
  const checkinOn = useFlag('place_checkin');
  const mine = useMyCheckins().data;
  const visits = checkinOn ? visitsAt(mine, place.slug).length : 0;
  const cover = coverOf(place);
  const cities = useCityList().cities;
  const state = openState(place.opening_hours, now, cityTz(cities, place.city_id));
  // The street under the name, as the detail screen prints it — street
  // and ward, without the city, postal code and country (`shortAddress`),
  // with the place's own city's names so one the module has never heard
  // of is cut too (owner, 23 Nov 2026). The pin says where on the map;
  // this says where to tell a driver, and lets two branches of one brand
  // be told apart without opening either. A place with no address falls
  // back to its ward, then to nothing.
  const home = cities.find((c) => c.id === place.city_id);
  const address = shortAddress(place.address, home ? [home.name_vi, home.name_en, home.short_vi, home.short_en].filter((n): n is string => !!n) : [])
    ?? (place.neighborhood_en ? localized(place, 'neighborhood', lang) : null);
  const hours = hoursLine(state, t);
  // The brand alone, as `PlaceCard` prints it. The suffix the catalog
  // hangs after the dash is the branch's ward, and this strip sits under
  // the pin that is standing in it, and the address line under the name
  // says it with the street besides. Spoken the same way: a listener walking
  // the pins hears one name per pin, not a name and a ward per pin.
  const name = splitName(localized(place, 'name', lang)).title;
  const ratingFact = place.rating ? `${place.rating.toFixed(1)}${place.rating_count ? ` (${fmtCount(place.rating_count)})` : ''}` : null;
  // The same figure the list's cards print under "Nearest first", from
  // the same formatter: metres to the nearest fifty while it is a walk,
  // one decimal while it is a ride. This strip used to write "0.8 km" on
  // its own, which beside a card saying "800 m" for the same place read
  // as two measurements.
  const distanceFact = distanceKm != null ? fmtDistance(distanceKm) : null;
  const facts = [distanceFact].filter((f): f is string => !!f);
  const visited = visits > 0
    ? (visits === 1
      ? t('Checked in once', 'Đã check-in 1 lần', '1回チェックイン済み', '打过卡 1 次', '打過卡 1 次')
      : t(`Checked in ${visits} times`, `Đã check-in ${visits} lần`, `${visits}回チェックイン済み`, `打过卡 ${visits} 次`, `打過卡 ${visits} 次`))
    : null;
  // The visual line carries a "★" glyph that screen readers should not
  // announce; speak the same facts as words so the listener hears name,
  // rating, distance, and hours without that confusing symbol.
  const spoken = [
    name,
    address,
    ratingFact ? t(`rated ${ratingFact}`, `đánh giá ${ratingFact}`, `評価 ${ratingFact}`, `评分 ${ratingFact}`, `評分 ${ratingFact}`) : null,
    distanceFact,
    hours ? `${hours.word}, ${hours.rest ?? ''}`.replace(/, $/, '') : null,
    visited,
  ].filter((f): f is string => !!f).join(', ');

  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={spoken} style={s.gutter} contentStyle={s.card}>
      {cover
        ? <Image source={{ uri: cover.photo_uri }} style={s.thumb} contentFit="cover" />
        : <View style={[s.thumb, { backgroundColor: colors.surfaceGlass }]} />}
      <View style={s.body}>
        <View style={s.line}>
          {tint ? <View testID="place-tint" style={[s.dot, { backgroundColor: tint }]} /> : null}
          <Text style={s.name} numberOfLines={2}>{name}</Text>
        </View>
        {address ? <Text style={s.address} numberOfLines={1} testID="place-address">{address}</Text> : null}
        {ratingFact || facts.length ? (
          <Text style={s.facts} numberOfLines={1}>
            {/* The star the detail screen this strip opens draws its
                rating with, coral on the page (`colors.accent`); the gold
                one is the photograph's (`onPhoto.star`). It was grey with
                the rest of the line, and read as one more fact rather
                than as the score. */}
            {ratingFact ? <Text testID="place-star" style={{ color: colors.accent }}>★ </Text> : null}
            {[ratingFact, ...facts].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
        {hours ? (
          <Text style={s.facts} numberOfLines={1} testID="place-hours">
            <Text style={{ color: TONE[hours.tone] }} testID="place-hours-word">{hours.word}</Text>
            {hours.rest ? ` · ${hours.rest}` : ''}
          </Text>
        ) : null}
        {visited ? (
          <View style={s.visited} testID="place-visited">
            <Glyph name="checkmark-circle-outline" size={ICON.meta} color={colors.textSecondary} />
            <Text style={s.facts} numberOfLines={1}>{visited}</Text>
          </View>
        ) : null}
      </View>
      {/* The bookmark the list's card carries in its photograph's corner,
          on the page's ground here: the same act, the same picker, the
          same fill once kept. Top-aligned with the name rather than
          centred, now that the strip can be two lines of name tall. */}
      <PressableScale
        onPress={() => save(place)}
        scaleTo={0.9}
        haptic="selection"
        accessibilityRole="button"
        accessibilityState={{ selected: saved }}
        accessibilityLabel={saved
          ? t('Saved — change collections', 'Đã lưu — đổi bộ sưu tập', '保存済み — コレクションを変更', '已保存 — 更改合集', '已儲存 — 更改合集')
          : t('Save to a collection', 'Lưu vào bộ sưu tập', 'コレクションに保存', '保存到合集', '儲存到合集')}
        hitSlop={PHOTO_SLOP}
        contentStyle={s.save}
        testID="map-card-save"
      >
        <Glyph name={saved ? 'bookmark' : 'bookmark-outline'} size={ICON.action} color={saved ? colors.accent : colors.text} />
      </PressableScale>
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
  thumb: { width: 88, height: 88, borderRadius: radius.card - 4 },
  // 2 down, so a one-line name sits on the photograph's top edge by its
  // cap height rather than its line box.
  body: { flex: 1, gap: 4, paddingTop: 2 },
  // The dot keeps to the first line of a name that wraps.
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  // The facts' size and ink: a line to read when wanted, not a second
  // heading under the name.
  address: { color: colors.textSecondary, fontSize: 13, fontWeight: font.regular },
  visited: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // The photograph disc's size and reach (`PHOTO_DISC`), on the page's
  // well rather than a scrim, since there is no photograph under it.
  save: {
    width: PHOTO_DISC, height: PHOTO_DISC, borderRadius: PHOTO_DISC / 2,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceGlass,
  },
  // Small: it is a echo of the pin, not a second heading. No border, so
  // it reads as the same ink the pin is drawn in.
  dot: { width: 9, height: 9, borderRadius: 4.5, marginTop: 6 },
  // `flexShrink: 1`, because the name now shares a row with the dot and
  // Yoga defaults shrink to 0 unlike CSS: without it a long name sizes to
  // its own content and runs under the chevron instead of truncating.
  name: { color: colors.text, fontSize: 16, lineHeight: 21, fontWeight: font.semibold, flexShrink: 1 },
  facts: { color: colors.textSecondary, fontSize: 13, fontWeight: font.regular },
});
