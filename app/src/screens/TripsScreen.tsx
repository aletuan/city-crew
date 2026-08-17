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
// ── the card summarises, the detail carries ──
//
// This file used to argue there should be no detail screen, because the
// card held the whole itinerary and a tap leading to the same content one
// screen deeper buys nothing. That was true while the card printed every
// stop. It stopped being true at `CARD_STOPS`: a day out is five stops, a
// card showing three of them and saying so is a summary, and a summary
// needs somewhere to lead. Delete moved with it — a destructive glyph
// competing for taps with a card that is now itself a tap is the worse of
// the two places to keep it.
//
// ── the crew row is not drawn ──
//
// The reference design shows overlapping avatars and "5 going" on every
// card. Nothing in this app knows who else is on a trip: there is no
// membership table, no invitation, and no policy letting anybody read a
// row they do not own. Drawing initials there would be inventing people,
// which is the same mistake the plan editor's Invite button is labelled a
// mock to avoid. The footer keeps the shape and fills it with what is
// true — how many stops, what it costs.

import React, { useCallback, useRef } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AddPill } from '../components/add';
import {
  AmbientWarmth, Card, GradientCta, PressableScale, Screen, Skeleton, useTabBarClearance,
} from '../components/ui';
import { useAuth } from '../lib/auth';
import { useCity } from '../lib/city';
import { fromISO, minutesOf, toISO } from '../lib/day';
import { useMyTrips, type Trip, type TripStopRow } from '../lib/data';
import { clockOf, dateline } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { stopCount, summaryLine } from '../lib/sketch';
import { COMPANY } from '../lib/trip';
import { spendVnd, splitTrips } from '../lib/trips';
import { colors, font, radius, space, type } from '../theme';
import type { Nav } from '../nav';

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
/**
 * How many stops a card prints before it defers to the detail screen.
 *
 * Three, because an evening *is* three and a day out is five: the common
 * case shows whole and the long one shows its shape with a line saying
 * what is missing. Printing all five would make a card the length of a
 * screen and leave nothing for a tap to be for.
 */
const CARD_STOPS = 3;

/** The wizard's answer, worn as a badge. Its own glyph colour, like every
 *  other chip in this app — the hue is what ties a concept together across
 *  screens, so a state must not repaint it. */
function CompanyChip({ company }: { company: string | null }) {
  const { t } = useI18n();
  const c = COMPANY.find((x) => x.key === company);
  if (!c) return null;
  return (
    <View style={s.badge}>
      {c.icon ? (
        <Ionicons name={c.icon as keyof typeof Ionicons.glyphMap} size={13} color={c.color} />
      ) : null}
      <Text style={s.badgeText}>{t(c.en, c.vi, c.ja)}</Text>
    </View>
  );
}

/**
 * One saved trip, summarised.
 *
 * `past` only dims it. A trip you already went on is still yours and still
 * legible — greying it into the background would be the app deciding your
 * last weekend mattered less than your next one.
 */
function TripCard({ trip, cityName, past, onPress }: {
  trip: Trip;
  cityName: string | null;
  past: boolean;
  onPress: () => void;
}) {
  const { t, lang } = useI18n();
  const day = fromISO(trip.day);
  const stops = trip.trip_stops;
  const spend = spendVnd(stops.map((st: TripStopRow) => st.places));
  const shown = stops.slice(0, CARD_STOPS);
  const hidden = stops.length - shown.length;
  const start = stops[0]?.arrive_min;

  return (
    <PressableScale onPress={onPress} scaleTo={0.985} style={[s.card, past && s.cardPast]}>
      <View style={s.head}>
        <Text style={s.title} numberOfLines={1}>{trip.title}</Text>
        <CompanyChip company={trip.company} />
      </View>

      {/* The glyph earns its place by being the one thing on the card that
          says "this is a date" at a glance, in a list where every card
          starts with a name. */}
      <View style={s.metaRow}>
        <Ionicons name="calendar-outline" size={14} color={colors.accent} />
        <Text style={s.meta} numberOfLines={1}>
          {summaryLine([
            day ? dateline(lang, day) : trip.day,
            start != null ? t(`from ${clockOf(start)}`, `từ ${clockOf(start)}`, `${clockOf(start)}から`) : null,
            cityName,
          ])}
        </Text>
      </View>

      <View style={s.stops}>
        {shown.map((stop, i) => (
          <View key={`${trip.id}-${i}`} style={s.stopRow}>
            <Text style={s.stopTime}>
              {stop.arrive_min != null ? clockOf(stop.arrive_min) : '—'}
            </Text>
            {/* The rail is drawn by the stop it leaves, so the last one has
                none — a line running off the bottom of a list claims a stop
                that is not there. */}
            <View style={s.dotCol}>
              <View style={s.dot} />
              {i < shown.length - 1 ? <View style={s.rail} /> : null}
            </View>
            {stop.places
              ? (
                <>
                  <Text style={s.stopName} numberOfLines={1}>{stop.places.name_en}</Text>
                  <Text style={s.stopArea} numberOfLines={1}>{stop.places.neighborhood_en}</Text>
                </>
              )
              : (
                <Text style={s.stopGone} numberOfLines={1}>
                  {t('No longer listed', 'Không còn trong danh mục', '掲載終了')}
                </Text>
              )}
          </View>
        ))}
        {hidden > 0 && (
          <Text style={s.more}>
            {t(`+${hidden} more`, `+${hidden} điểm nữa`, `他${hidden}件`)}
          </Text>
        )}
      </View>

      <View style={s.divider} />

      <View style={s.foot}>
        <Text style={s.footFacts} numberOfLines={1}>
          {summaryLine([
            stopCount(stops.length, t),
            spend > 0 ? `~${money(spend)} / ${t('person', 'người', '人')}` : null,
          ])}
        </Text>
        <View style={s.open}>
          <Text style={s.openText}>{t('View plan', 'Xem kế hoạch', 'プランを見る')}</Text>
          <Ionicons name="chevron-forward" size={15} color={colors.accent} />
        </View>
      </View>
    </PressableScale>
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

  // One `Date` for both halves of the question, because `todayISO()` and
  // `minutesOf()` read separately can straddle midnight and produce "the
  // 17th, at 00:00" for a clock that is already on the 18th.
  //
  // Read at render rather than on a timer. The list is re-read on every
  // focus anyway, so a trip that ends while the reader is looking at this
  // exact screen moves down the next time they come back to it — which is
  // late by minutes, not by the hours the day-granular split was late by,
  // and costs no interval nobody would remember to clear.
  const now = new Date();
  const { upcoming, past } = splitTrips(trips.data, toISO(now), minutesOf(now));

  const cityName = (id: string) => {
    const c = cities.find((x) => x.id === id);
    return c ? t(c.short_en, c.short_vi, c.short_ja) : null;
  };

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
    <Screen
      title={t('Trips', 'Chuyến đi', '旅程')}
      // A header action acts on the screen it sits above, and the one thing
      // this screen cannot do for itself is make another trip. It jumps to
      // Ideas, which is where a trip comes from.
      //
      // Only once there is a list. With none, `FirstTrip` below is already
      // making the same offer and saying what a trip is for — two
      // invitations to do one thing read as two different things, which is
      // the rule Collections keeps on its own section heading and this
      // screen shipped without.
      //
      // `AddPill` rather than a pill of its own, so the word, the glyph and
      // the height are the ones every other tab uses.
      right={trips.data.length > 0 ? (
        <AddPill
          header
          label={t('New', 'Tạo mới', '新規')}
          onPress={() => navigation.getParent()?.navigate('Ideas')}
          accessibilityLabel={t('New trip', 'Chuyến đi mới', '新しい旅程')}
        />
      ) : undefined}
    >
      <AmbientWarmth />
      {!trips.loaded && (
        <View style={s.body}>
          {[0, 1].map((i) => (
            <Card key={i} style={s.pad}>
              <Skeleton style={{ height: 19, width: '60%', borderRadius: 8 }} />
              <Skeleton style={{ height: 13, width: '40%', borderRadius: 7, marginTop: 8 }} />
              <Skeleton style={{ height: 44, width: '100%', borderRadius: 10, marginTop: 14 }} />
            </Card>
          ))}
        </View>
      )}

      {trips.loaded && !!trips.error && (
        <View style={s.body}>
          <Card style={s.pad}><Text style={s.error}>
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
          contentContainerStyle={{ paddingHorizontal: space.page, paddingBottom: clearance }}
          showsVerticalScrollIndicator={false}
        >
          {!trips.data.length && (
            <FirstTrip onPress={() => navigation.getParent()?.navigate('Ideas')} />
          )}

          {!!trips.data.length && (
            <Text style={s.lede}>
              {t(
                'Your next plans, in order.',
                'Những kế hoạch sắp tới của bạn, theo thứ tự.',
                'これからの予定を順番に。',
              )}
            </Text>
          )}

          {/* The count belongs on the heading rather than under it: this is
              a list somebody scans to find one trip, and how many there are
              is the first thing that tells them how long the scan is. */}
          {!!upcoming.length && (
            <Text style={s.section}>
              {t('Upcoming', 'Sắp tới', 'これから')} · {upcoming.length}
            </Text>
          )}
          {upcoming.map((trip) => (
            <View key={trip.id} style={s.row}>
              <TripCard
                trip={trip}
                cityName={cityName(trip.city_id)}
                past={false}
                onPress={() => navigation.navigate('TripDetail', { id: trip.id })}
              />
            </View>
          ))}

          {!!past.length && (
            <Text style={[s.section, !!upcoming.length && s.sectionAfter]}>
              {t('Been there', 'Đã đi', '行った旅')} · {past.length}
            </Text>
          )}
          {past.map((trip) => (
            <View key={trip.id} style={s.row}>
              <TripCard
                trip={trip}
                cityName={cityName(trip.city_id)}
                past
                onPress={() => navigation.navigate('TripDetail', { id: trip.id })}
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
  // The gutter every screen in this app keeps and this one did not: the
  // cards ran to both edges and the card's own corner radius clipped the
  // first glyph of every title.
  body: { gap: space.cardGap, paddingHorizontal: space.page },
  error: { ...type.body, color: colors.textSecondary },
  lede: { ...type.body, color: colors.textSecondary, marginBottom: space.titleToContent },

  // Caption weight and letterspaced rather than a second title. There is
  // one title on this screen; these divide it, and at `type.section` they
  // competed with the card names underneath them.
  section: {
    ...CAPTION, color: colors.textTertiary, fontWeight: font.semibold,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: space.headingToContent,
  },
  // The second heading needs air above it that the first, sitting under the
  // screen title, already has.
  sectionAfter: { marginTop: space.titleToContent },
  row: { marginBottom: space.cardGap },

  // The card is the tap now, so it carries its own surface rather than
  // sitting inside a `Card` — `PressableScale` needs the fill on the view
  // its children live in, and nesting one inside the other would put a
  // border around a border.
  card: {
    backgroundColor: colors.surfaceCard, borderRadius: radius.card,
    borderWidth: 1, borderColor: colors.borderGlassSoft,
    padding: space.cardPadding, overflow: 'hidden',
  },
  /** For the two places that do sit inside a real `Card` — the skeleton
   *  and the error — where `s.card` would paint a second surface inside
   *  the first. */
  pad: { padding: space.cardPadding },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, color: colors.text, ...type.cardTitle },

  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.pill,
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentLine,
  },
  badgeText: { ...CAPTION, color: colors.accent, fontWeight: font.semibold },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  meta: { ...CAPTION, color: colors.textSecondary, flex: 1 },

  stops: { marginTop: 14, gap: 2 },
  // `alignItems: center` and a fixed row height, so the dot lands on the
  // middle of its line and the rail between two dots has a known length.
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 30 },
  stopTime: {
    ...CAPTION, color: colors.textSecondary, width: 46,
    fontVariant: ['tabular-nums'],
  },
  // The dot column and the rail beneath it, borrowed from the plan cards so
  // an itinerary looks like an itinerary wherever it is drawn.
  dotCol: { width: 9, alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.accentFill },
  rail: { position: 'absolute', top: 9, width: 2, height: 30, backgroundColor: colors.borderGlassSoft },
  stopName: { ...type.body, color: colors.text, flex: 1 },
  // Right-aligned and capped: it is the answer to "whereabouts", read after
  // the name, and letting it grow would push the name into an ellipsis to
  // print a district nobody was looking for yet.
  stopArea: { ...CAPTION, color: colors.textTertiary, maxWidth: 108, textAlign: 'right' },
  stopGone: { ...type.body, color: colors.textTertiary, fontStyle: 'italic', flex: 1 },
  more: { ...CAPTION, color: colors.textTertiary, marginLeft: 56, marginTop: 4 },

  divider: {
    height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft,
    marginTop: 14, marginBottom: 12,
  },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  footFacts: { ...CAPTION, color: colors.textSecondary, flex: 1 },
  open: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  openText: { ...CAPTION, color: colors.accent, fontWeight: font.semibold },

  // Dimmed, not greyed out: still legible, just no longer the thing you
  // came here for.
  cardPast: { opacity: 0.72 },


  first: {
    alignItems: 'center', gap: 10, marginHorizontal: space.page,
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
