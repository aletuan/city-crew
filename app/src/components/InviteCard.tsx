// An invitation, at the top of Trips, above the plans you already agreed
// to.
//
// It is a card and not a banner, and that is the whole argument for where
// it sits: a banner can only say "you have one", which leaves the reader
// exactly one move — go and look. This carries the cover, who asked, when
// it is and the first stops, so the common answer ("yes, obviously") can
// be given from here without opening anything.
//
// ── both answers, side by side, and neither is the quiet one ──
//
// Accept is the accent pill and Decline is the outline beside it, at the
// same size. The temptation is to make declining smaller — it is the
// answer nobody wants — but an invitation with one prominent answer and
// one grey one is a screen leaning on somebody about their own evening.
// Both are one press, and the copy under them says a refusal costs the
// planner nothing but the number.
//
// ── it is not a route to the trip screen ──
//
// A pending invitation leads to its own screen rather than to
// `TripDetail`: that screen is for a plan you are on, with a crew row and
// a delete button, and neither means anything for a day you have not
// agreed to yet.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import type { FriendProfile, Trip } from '../lib/data';
import { fromISO } from '../lib/day';
import { clockOf, dateline } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { summaryLine } from '../lib/sketch';
import { tripCover } from '../lib/trips';
import { colors, font, onPhoto, radius, space, type } from '../theme';
import { Avatar, PressableScale } from './ui';

export default function InviteCard({
  trip, from, busy, onOpen, onAnswer,
}: {
  trip: Trip;
  /** Who asked. Null while the crew copy is still loading — the card draws
   *  without the name rather than holding the whole rail back for it. */
  from: FriendProfile | null;
  busy: boolean;
  onOpen: () => void;
  onAnswer: (answer: 'accepted' | 'declined') => void;
}) {
  const { t, lang } = useI18n();
  const stops = trip.trip_stops ?? [];
  // The stop rows go in whole: `tripCover` reads `.places` off each one
  // itself. This used to unwrap the places first — and the cast that made
  // it compile also hid what it meant: every lookup inside found no
  // `.places` on a bare place, so every invitation drew the grey block,
  // photographs or not.
  const cover = tripCover(stops);
  const day = fromISO(trip.day);
  const first = stops[0];

  const when = summaryLine([
    day ? dateline(lang, day) : trip.day,
    first?.arrive_min != null ? t(
      `from ${clockOf(first.arrive_min)}`,
      `từ ${clockOf(first.arrive_min)}`,
      `${clockOf(first.arrive_min)}から`,
    ) : null,
  ]);

  // The stops by name, which is what the reader is actually deciding
  // about. Truncated by the line rather than by a count: three short
  // names fit where two long ones do not.
  const where = stops
    .map((st) => (st.places ? t(st.places.name_en, st.places.name_vi, st.places.name_ja) : null))
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={s.card}>
      <PressableScale onPress={onOpen} scaleTo={0.985} accessibilityRole="button">
        {cover?.photo_uri ? (
          <View style={s.media}>
            <Image source={{ uri: cover.photo_uri }} style={s.photo} contentFit="cover" transition={160} />
            {/* The photographer's credit, required wherever the photo
                appears — the same rule TripsScreen's own card follows.
                A licence, not a caption. */}
            {cover.attribution_name
              ? <Text style={s.attr} numberOfLines={1}>{cover.attribution_name}</Text>
              : null}
            {/* The asker rides on the photo, the way the invitation
                arrived: from a person, not from the app. */}
            <View style={s.asker}>
              <Avatar url={from?.avatar_url} size={26} />
              <Text style={s.askerText} numberOfLines={1}>
                {from?.full_name || (from?.handle ? `@${from.handle}` : t('Someone', 'Ai đó', '誰か'))}
                {' '}
                <Text style={s.askerVerb}>{t('invited you', 'đã mời bạn', 'があなたを招待しました')}</Text>
              </Text>
            </View>
          </View>
        ) : (
          // No photograph, no photo block: a grey slab wearing photo-white
          // text was the app pretending — the words disappeared into the
          // light theme. The asker leads on the card's own surface instead.
          <View style={s.askerBare}>
            <Avatar url={from?.avatar_url} size={26} />
            <Text style={s.askerBareText} numberOfLines={1}>
              {from?.full_name || (from?.handle ? `@${from.handle}` : t('Someone', 'Ai đó', '誰か'))}
              {' '}
              <Text style={s.askerBareVerb}>{t('invited you', 'đã mời bạn', 'があなたを招待しました')}</Text>
            </Text>
          </View>
        )}

        <View style={s.body}>
          <Text style={s.title} numberOfLines={2}>{trip.title}</Text>
          {/* Coral, like the calendar on the trip card this sits directly
              above in the rail. The two are peers in one scroll — the same
              glyph answering the same question — and a reader who saw them
              a card apart in two colours would be right to read the
              difference as meaning something.

              The pin below stays tertiary, and that is the rule rather
              than an oversight: the calendar is the fact the answer turns
              on, and it is the only meta glyph in the app that wears the
              accent. */}
          <View style={s.metaRow}>
            <Ionicons name="calendar-outline" size={13} color={colors.accent} />
            <Text style={s.meta} numberOfLines={1}>{when}</Text>
          </View>
          {where ? (
            <View style={s.metaRow}>
              <Ionicons name="location-outline" size={13} color={colors.textTertiary} />
              <Text style={s.meta} numberOfLines={1}>{where}</Text>
            </View>
          ) : null}
        </View>
      </PressableScale>

      <View style={s.answers}>
        <PressableScale
          onPress={() => { if (!busy) onAnswer('accepted'); }}
          accessibilityRole="button"
          containerStyle={{ flex: 1 }}
          style={[s.yes, busy && s.busy]}
        >
          <Ionicons name="checkmark" size={16} color={colors.accentInk} />
          <Text style={s.yesText}>{t('I’m in', 'Tôi tham gia', '参加する')}</Text>
        </PressableScale>
        <PressableScale
          onPress={() => { if (!busy) onAnswer('declined'); }}
          accessibilityRole="button"
          containerStyle={{ flex: 1 }}
          style={[s.no, busy && s.busy]}
        >
          <Text style={s.noText}>{t('Can’t make it', 'Không đi được', '行けません')}</Text>
        </PressableScale>
      </View>

      <PressableScale onPress={onOpen} accessibilityRole="button" style={s.more}>
        <Text style={s.moreText}>
          {t('See the whole plan', 'Xem toàn bộ kế hoạch', '予定をすべて見る')}
        </Text>
        <Ionicons name="chevron-forward" size={13} color={colors.accent} />
      </PressableScale>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: radius.card, overflow: 'hidden',
    backgroundColor: colors.surfaceCard,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.accentLine,
    marginBottom: space.cardGap,
  },
  media: { height: 132, backgroundColor: colors.surfaceGlass },
  photo: { width: '100%', height: '100%' },
  attr: {
    position: 'absolute', right: 10, top: 8,
    color: onPhoto.textSecondary, fontSize: 10,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3,
  },
  asker: {
    position: 'absolute', left: 12, bottom: 10, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  askerText: { flex: 1, color: onPhoto.text, fontSize: 14, fontWeight: font.medium },
  askerVerb: { color: onPhoto.textSecondary, fontWeight: font.regular },

  askerBare: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: space.cardPadding, paddingTop: 14,
  },
  askerBareText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: font.medium },
  askerBareVerb: { color: colors.textSecondary, fontWeight: font.regular },

  body: { paddingHorizontal: space.cardPadding, paddingTop: 12, gap: 5 },
  title: { ...type.cardTitle, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  meta: { flex: 1, color: colors.textTertiary, fontSize: 13 },

  answers: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: space.cardPadding, paddingTop: 14,
  },
  busy: { opacity: 0.6 },
  yes: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 12, borderRadius: radius.pill,
    backgroundColor: colors.accentFill,
  },
  yesText: { color: colors.accentInk, fontSize: 15, fontWeight: font.bold },
  no: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlass,
  },
  noText: { color: colors.textSecondary, fontSize: 15, fontWeight: font.medium },

  more: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 13,
  },
  moreText: { color: colors.accent, fontSize: 14, fontWeight: font.medium },
});
