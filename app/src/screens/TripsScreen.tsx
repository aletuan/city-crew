// The trips you saved — the only screen in the app that reads a table it
// cannot rebuild.
//
// Everything else the app shows is catalog: rows the desk wrote, where a
// stale copy is one refresh away from being right. A trip is a decision
// somebody made on a particular evening, so this screen renders it as it
// was saved rather than re-planning it. A place that has since left the
// catalog comes back null and is drawn as a gap, not quietly dropped —
// the reader picked five stops and a list of four with no explanation is
// the app losing something in front of them.
//
// ── two halves, not one list ──
//
// Upcoming runs soonest first, because the next trip is the one you opened
// the tab for. Past runs most recent first, because that is the order
// memory works in. The split and both sorts live in `lib/trips` where a
// test can see them; `today` counts as upcoming, so an evening you are
// currently on does not become a memory at midnight.
//
// ── no detail screen, on purpose ──
//
// The card carries the whole itinerary. A trip is three to five stops, and
// a tap that leads to the same content one screen deeper is a tap that
// bought nothing. When editing a saved trip arrives, it gets a row action
// here rather than a hidden second screen.

import React, { useCallback, useRef } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  AmbientWarmth, Card, GradientCta, PressableScale, Screen, Skeleton, useTabBarClearance,
} from '../components/ui';
import { useAuth } from '../lib/auth';
import { useCity } from '../lib/city';
import { fromISO, todayISO } from '../lib/day';
import { deleteTrip, useMyTrips, type Trip, type TripStopRow } from '../lib/data';
import { dateline } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { summaryLine } from '../lib/sketch';
import { spendVnd, splitTrips } from '../lib/trips';
import { colors, font, radius, space, type } from '../theme';
import type { Nav } from '../nav';

const clock = (minutes: number) => {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const money = (vnd: number) => (vnd >= 1_000_000
  ? `${Math.round(vnd / 100_000) / 10}M ₫`
  : `${Math.round(vnd / 1000)}k ₫`);

/**
 * One saved trip, whole.
 *
 * `past` only dims it. A trip you already went on is still yours and still
 * legible — greying it into the background would be the app deciding your
 * last weekend mattered less than your next one.
 */
function TripCard({ trip, cityName, past, onDelete }: {
  trip: Trip;
  cityName: string | null;
  past: boolean;
  onDelete: () => void;
}) {
  const { t, lang } = useI18n();
  const day = fromISO(trip.day);
  const stops = trip.trip_stops;
  const spend = spendVnd(stops.map((s: TripStopRow) => s.places));
  const first = stops[0];
  const last = stops[stops.length - 1];
  const window = first?.arrive_min != null && last?.arrive_min != null
    ? `${clock(first.arrive_min)}–${clock(last.arrive_min + (last.dwell_min ?? 0))}`
    : null;

  return (
    <Card style={past ? s.cardPast : undefined}>
      <View style={s.head}>
        <View style={s.headText}>
          <Text style={s.title} numberOfLines={2}>{trip.title}</Text>
          <Text style={s.meta} numberOfLines={1}>
            {summaryLine([
              day ? dateline(lang, day) : trip.day,
              trip.when_part === 'evening'
                ? t('Evening', 'Buổi tối', '夜')
                : t('Day out', 'Cả ngày', '終日'),
              cityName,
            ])}
          </Text>
        </View>
        <PressableScale
          onPress={onDelete}
          containerStyle={s.trash}
          accessibilityRole="button"
          accessibilityLabel={t('Delete this trip', 'Xoá chuyến đi này', 'この旅程を削除')}
        >
          <Ionicons name="trash-outline" size={17} color={colors.textTertiary} />
        </PressableScale>
      </View>

      <View style={s.stops}>
        {stops.map((stop, i) => (
          <View key={`${trip.id}-${i}`} style={s.stopRow}>
            <Text style={s.stopTime}>
              {stop.arrive_min != null ? clock(stop.arrive_min) : '—'}
            </Text>
            <View style={s.stopText}>
              {stop.places
                ? (
                  <>
                    <Text style={s.stopName} numberOfLines={1}>{stop.places.name_en}</Text>
                    {/* The line a model will write in Phase 3. Until then
                        it is null and the row simply has one line. */}
                    {!!stop.why && <Text style={s.why} numberOfLines={2}>{stop.why}</Text>}
                  </>
                )
                : (
                  <Text style={s.stopGone} numberOfLines={1}>
                    {t('No longer listed', 'Không còn trong danh mục', '掲載終了')}
                  </Text>
                )}
            </View>
          </View>
        ))}
      </View>

      <Text style={s.foot}>
        {summaryLine([
          `${stops.length} ${t('stops', 'điểm', 'スポット')}`,
          window,
          spend > 0 ? `~${money(spend)} / ${t('person', 'người', '人')}` : null,
        ])}
      </Text>
    </Card>
  );
}

/**
 * Signed in, nothing saved yet.
 *
 * Mirrors Collections' first-run card — same tinted well, same gradient
 * action — because it is the same argument aimed at a different tab. The
 * button jumps to Ideas, which is where a trip comes from; an empty state
 * that only says "empty" leaves the reader to find that out themselves.
 */
function FirstTrip({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  return (
    <View style={s.first}>
      <View style={s.firstIcon}>
        <Ionicons name="map" size={27} color={colors.accent} />
      </View>
      <Text style={s.firstTitle}>
        {t('No trips yet', 'Chưa có chuyến đi nào', '旅程はまだありません')}
      </Text>
      <Text style={s.firstBody}>
        {t(
          'Answer four questions in Ideas and keep the plan you like.',
          'Trả lời bốn câu trong Gợi ý rồi giữ lại phương án bạn thích.',
          'アイデアで4つの質問に答え、気に入ったプランを保存しましょう。',
        )}
      </Text>
      <GradientCta
        icon="sparkles"
        label={t('Plan a trip', 'Lên kế hoạch', 'プランを立てる')}
        onPress={onPress}
      />
    </View>
  );
}

export default function TripsScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { session } = useAuth();
  const { cities } = useCity();
  const clearance = useTabBarClearance();
  const trips = useMyTrips(session?.user?.id);

  // Saving happens in the Ideas stack, in another tab, so this list is
  // always out of date by the time anyone looks at it. The first focus is
  // skipped — the hook loaded on mount, and refetching there is a second
  // identical request for nothing. Same pattern as Collections.
  const firstFocus = useRef(true);
  useFocusEffect(useCallback(() => {
    if (firstFocus.current) { firstFocus.current = false; return; }
    trips.reload();
  }, [trips.reload]));

  const { upcoming, past } = splitTrips(trips.data, todayISO());

  const cityName = (id: string) => {
    const c = cities.find((x) => x.id === id);
    return c ? t(c.short_en, c.short_vi, c.short_ja) : null;
  };

  const confirmDelete = (trip: Trip) => Alert.alert(
    t('Delete this trip?', 'Xoá chuyến đi này?', 'この旅程を削除しますか？'),
    t(`"${trip.title}" will be gone for good.`, `"${trip.title}" sẽ mất hẳn.`, `「${trip.title}」は完全に削除されます。`),
    [
      { text: t('Cancel', 'Huỷ', 'キャンセル'), style: 'cancel' },
      {
        text: t('Delete', 'Xoá', '削除'),
        style: 'destructive',
        onPress: () => {
          deleteTrip(trip.id)
            .then(() => trips.reload())
            .catch((e: Error) => Alert.alert(
              t('Could not delete', 'Không xoá được', '削除できませんでした'), e.message,
            ));
        },
      },
    ],
  );

  // Signed out is not an empty list, it is a different question, so it gets
  // the whole screen rather than a banner above nothing.
  if (!session) {
    return (
      <Screen title={t('Trips', 'Chuyến đi', '旅程')}>
        <AmbientWarmth />
        <View style={s.first}>
          <View style={s.firstIcon}>
            <Ionicons name="map" size={27} color={colors.accent} />
          </View>
          <Text style={s.firstTitle}>
            {t('Sign in to keep your trips', 'Đăng nhập để lưu chuyến đi', 'サインインして旅程を保存')}
          </Text>
          <Text style={s.firstBody}>
            {t(
              'Plans you build stay on this phone until you do. Only you can see them.',
              'Kế hoạch bạn dựng chỉ nằm trên máy cho tới lúc đó. Chỉ mình bạn thấy chúng.',
              'サインインするまでプランはこの端末だけに残ります。閲覧できるのはあなただけです。',
            )}
          </Text>
          <GradientCta
            icon="log-in-outline"
            label={t('Sign in', 'Đăng nhập', 'サインイン')}
            onPress={() => navigation.getParent()?.navigate('Profile', { screen: 'SignIn' })}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title={t('Trips', 'Chuyến đi', '旅程')}>
      <AmbientWarmth />
      {!trips.loaded && (
        <View style={s.body}>
          {[0, 1].map((i) => (
            <Card key={i}>
              <Skeleton style={{ height: 19, width: '60%', borderRadius: 8 }} />
              <Skeleton style={{ height: 13, width: '40%', borderRadius: 7, marginTop: 8 }} />
              <Skeleton style={{ height: 44, width: '100%', borderRadius: 10, marginTop: 14 }} />
            </Card>
          ))}
        </View>
      )}

      {trips.loaded && !!trips.error && (
        <View style={s.body}>
          <Card><Text style={s.error}>
            {t(
              `Couldn't load your trips: ${trips.error}`,
              `Không tải được chuyến đi: ${trips.error}`,
              `旅程を読み込めませんでした: ${trips.error}`,
            )}
          </Text></Card>
        </View>
      )}

      {trips.loaded && !trips.error && (
        <ScrollView
          contentContainerStyle={{ paddingBottom: clearance }}
          showsVerticalScrollIndicator={false}
        >
          {!trips.data.length && (
            <FirstTrip onPress={() => navigation.getParent()?.navigate('Ideas')} />
          )}

          {!!upcoming.length && (
            <Text style={s.section}>{t('Upcoming', 'Sắp tới', 'これから')}</Text>
          )}
          {upcoming.map((trip) => (
            <View key={trip.id} style={s.row}>
              <TripCard
                trip={trip}
                cityName={cityName(trip.city_id)}
                past={false}
                onDelete={() => confirmDelete(trip)}
              />
            </View>
          ))}

          {!!past.length && (
            <Text style={[s.section, !!upcoming.length && s.sectionAfter]}>
              {t('Been there', 'Đã đi', '行った旅')}
            </Text>
          )}
          {past.map((trip) => (
            <View key={trip.id} style={s.row}>
              <TripCard
                trip={trip}
                cityName={cityName(trip.city_id)}
                past
                onDelete={() => confirmDelete(trip)}
              />
            </View>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const CAPTION = { fontSize: 13, fontWeight: font.regular } as const;

const s = StyleSheet.create({
  body: { gap: space.cardGap },
  error: { ...type.body, color: colors.textSecondary },

  section: { color: colors.text, ...type.section, marginBottom: space.headingToContent },
  // The second heading needs air above it that the first, sitting under the
  // screen title, already has.
  sectionAfter: { marginTop: space.titleToContent },
  row: { marginBottom: space.cardGap },

  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headText: { flex: 1, gap: 4 },
  title: { color: colors.text, ...type.cardTitle },
  meta: { ...CAPTION, color: colors.textTertiary },
  // A glyph in a hit area, not a filled button: destroying a trip is not
  // the loudest thing on this card and should not be drawn like it.
  trash: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  // A hairline above the itinerary, so the stops read as the trip's
  // contents rather than as more metadata.
  stops: {
    marginTop: 12, paddingTop: 12, gap: 9,
    borderTopWidth: 1, borderTopColor: colors.borderGlassSoft,
  },
  stopRow: { flexDirection: 'row', gap: 10 },
  stopTime: {
    ...CAPTION, color: colors.textSecondary, width: 44,
    fontVariant: ['tabular-nums'],
  },
  stopText: { flex: 1, gap: 2 },
  stopName: { ...type.body, color: colors.text },
  stopGone: { ...type.body, color: colors.textTertiary, fontStyle: 'italic' },
  why: { ...CAPTION, color: colors.textTertiary, lineHeight: 18 },

  foot: { ...CAPTION, color: colors.textSecondary, marginTop: 12 },
  // Dimmed, not greyed out: still legible, just no longer the thing you
  // came here for.
  cardPast: { opacity: 0.72 },

  first: {
    alignItems: 'center', gap: 10,
    paddingHorizontal: space.cardPadding + 6, paddingTop: 26, paddingBottom: 22,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.card, marginBottom: space.titleToContent,
  },
  firstIcon: {
    width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentLine,
    marginBottom: 2,
  },
  firstTitle: { color: colors.text, ...type.headline, textAlign: 'center' },
  firstBody: {
    color: colors.textSecondary, fontSize: 15, lineHeight: 21,
    textAlign: 'center', marginBottom: 6,
  },
});
