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

import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  AmbientWarmth, Card, Empty, PressableScale, Screen, useTabBarClearance,
} from '../components/ui';
import { useAuth } from '../lib/auth';
import { useCity } from '../lib/city';
import { fromISO } from '../lib/day';
import { deleteTrip, useMyTrips, type TripStopRow } from '../lib/data';
import { dateline } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { stopCount, summaryLine } from '../lib/sketch';
import { COMPANY } from '../lib/trip';
import { spendVnd } from '../lib/trips';
import { colors, font, radius, space, type } from '../theme';
import type { Nav, RootRoute } from '../nav';

const clock = (minutes: number) => {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

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
    ? `${clock(first.arrive_min)}–${clock(last.arrive_min + (last.dwell_min ?? 0))}`
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
    <Screen title={trip.title} onBack={() => navigation.goBack()}>
      <AmbientWarmth />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.page, paddingBottom: clearance }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.metaRow}>
          <Ionicons name="calendar-outline" size={14} color={colors.accent} />
          <Text style={s.meta}>
            {summaryLine([
              day ? dateline(lang, day) : trip.day,
              window,
              city ? t(city.short_en, city.short_vi, city.short_ja) : null,
              company ? t(company.en, company.vi, company.ja) : null,
            ])}
          </Text>
        </View>

        <Card style={s.card}>
          {stops.map((stop, i) => (
            <View key={`${trip.id}-${i}`}>
              {i > 0 ? <View style={s.divider} /> : null}
              <View style={s.stopRow}>
                <Text style={s.stopTime}>
                  {stop.arrive_min != null ? clock(stop.arrive_min) : '—'}
                </Text>
                <View style={s.who}>
                  {stop.places
                    ? (
                      <>
                        <Text style={s.name}>{stop.places.name_en}</Text>
                        <Text style={s.area}>
                          {summaryLine([
                            stop.places.neighborhood_en,
                            stop.dwell_min ? `${stop.dwell_min}′` : null,
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
                </View>
              </View>
            </View>
          ))}
        </Card>

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
  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: space.titleToContent,
  },
  meta: { ...CAPTION, color: colors.textSecondary, flex: 1 },

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
  who: { flex: 1, gap: 2 },
  name: { ...type.body, color: colors.text, fontWeight: font.semibold },
  area: { ...CAPTION, color: colors.textTertiary },
  gone: { ...type.body, color: colors.textTertiary, fontStyle: 'italic' },
  why: { ...CAPTION, color: colors.textSecondary, lineHeight: 18, marginTop: 4 },
  whyLang: { color: colors.textTertiary, fontWeight: font.semibold },

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
