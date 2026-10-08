// Where you have been: every check-in, filed by month, newest first.
//
// ── what this is, and is not ──
//
// The reader's own record, from the `checkins` table — the row the pill
// on a place's screen writes. Not the taste profile's `place_events`,
// which is private by promise and never drawn; and not Activity, which
// is news *from* other people about your things. The three hold three
// kinds of fact and this screen shows the one the reader made on
// purpose. See `lib/checkin.ts`.
//
// ── the shape ──
//
// Activity's shape, deliberately: an eyebrow per group, a card of rows
// under it, bare 19pt glyphs in the 44pt slot, a chevron only where a
// row goes somewhere. The groups are months rather than Upcoming and
// Earlier, because a visit has no future half. The row's second line is
// the day, the clock and the city — the city because the list spans
// every city the reader has been to, while the catalog on the phone
// holds one. The names come with the rows for the same reason.
//
// Undo is a ⋯ per row and a sheet, as the request cards on Activity do
// it, not a swipe: nothing in this app swipes to delete yet, and one
// screen teaching a gesture the others do not honour is a trap.

import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import ActionSheet, { type SheetAction } from '../components/ActionSheet';
import { AuthHeader, AuthScreen } from '../components/authUi';
import { Card, Empty, PressableScale } from '../components/ui';
import { useAuth } from '../lib/auth';
import { type Checkin, monthTitle, visitSections, visitSummary } from '../lib/checkin';
import { useCity } from '../lib/city';
import { removeCheckin, useMyCheckins } from '../lib/data';
import { clockOf, shortDateline } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { colors, display, font, space, type } from '../theme';
import type { Nav } from '../nav';

// Activity's figures, for the same mark: a 19pt glyph's whole line in a
// 26pt box, set on the middle of a 21pt first line of text.
const LINE = 21;
const MARK_BOX = 26;

export default function VisitedScreen({ navigation }: { navigation: Nav }) {
  const { t, lang } = useI18n();
  const { session } = useAuth();
  const me = session?.user?.id ?? null;
  const visits = useMyCheckins(me);
  const { cities } = useCity();
  const [menuFor, setMenuFor] = useState<Checkin | null>(null);

  const sections = useMemo(() => visitSections(visits.data), [visits.data]);
  const summary = visitSummary(visits.data);

  /** The place's name in the reader's language, or what to call a place
   *  that has since been taken down: the visit happened either way. */
  const nameOf = (v: Checkin) => (v.place
    ? t(v.place.name_en, v.place.name_vi, v.place.name_ja ?? v.place.name_en)
    : t('A place that was removed', 'Một địa điểm đã bị gỡ', '削除された場所'));
  /** The day, the clock, and the city when the app still knows it. */
  const metaOf = (v: Checkin) => {
    const d = new Date(v.at);
    const city = cities.find((c) => c.id === v.city_id);
    const parts = [shortDateline(lang, d), clockOf(d.getHours() * 60 + d.getMinutes())];
    if (city) parts.push(t(city.short_en, city.short_vi, city.short_ja ?? city.short_en));
    return parts.join(' · ');
  };

  const remove = async (v: Checkin) => {
    try {
      await removeCheckin(v.id);
      visits.reload();
    } catch (e) {
      Alert.alert(t('Could not remove it', 'Không bỏ được', '削除できませんでした'), (e as Error).message);
    }
  };
  const actions: SheetAction[] = [{
    key: 'remove', icon: 'trash-outline', destructive: true,
    title: t('Remove this visit', 'Bỏ lần ghé này', 'この訪問を削除'),
    desc: t('Only this one; your other visits stay.', 'Chỉ lần này; các lần khác vẫn giữ.', 'この1件だけ。他の訪問は残ります。'),
    onPress: () => { const v = menuFor; setMenuFor(null); if (v) void remove(v); },
  }];

  const summaryLine = t(
    `${summary.visits} ${summary.visits === 1 ? 'visit' : 'visits'} · ${summary.places} ${summary.places === 1 ? 'place' : 'places'}`,
    `${summary.visits} lần ghé · ${summary.places} địa điểm`,
    `${summary.visits}回 · ${summary.places}か所`,
  );

  return (
    <AuthScreen>
      <AuthHeader onBack={() => navigation.goBack()} title={t('Check-ins', 'Địa điểm check-in', 'チェックインした場所')} />

      {!visits.loaded ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
      ) : sections.length === 0 ? (
        <Empty text={t(
          'No visits yet. Check in at a place to start the list.',
          'Chưa có lần ghé nào. Check-in ở một địa điểm để bắt đầu.',
          'まだ訪問がありません。場所でチェックインすると、ここに並びます。',
        )} />
      ) : (
        <>
          <Text style={s.summary}>{summaryLine}</Text>
          {sections.map((sec) => (
            <View key={sec.key} style={s.month}>
              <Text style={s.eyebrow} testID="visit-month">{monthTitle(lang, sec.year, sec.month)}</Text>
              <Card>
                {sec.data.map((v, i) => {
                  const opens = !!v.place_slug;
                  return (
                    <PressableScale
                      key={v.id}
                      style={[s.row, i > 0 && s.rowDivider]}
                      onPress={opens ? () => navigation.navigate('PlaceDetail', { slug: v.place_slug }) : undefined}
                      // A button only when it goes somewhere — the same
                      // condition as the chevron, so what VoiceOver hears
                      // and what the eye sees agree.
                      accessibilityRole={opens ? 'button' : undefined}
                      testID="visit-row"
                    >
                      <View style={s.mark}>
                        <Ionicons name="location-outline" size={19} color={colors.textTertiary} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={s.name} numberOfLines={2} testID="visit-name">{nameOf(v)}</Text>
                        <Text style={s.meta} testID="visit-meta">{metaOf(v)}</Text>
                      </View>
                      <PressableScale
                        onPress={() => setMenuFor(v)}
                        scaleTo={0.85}
                        hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
                        containerStyle={s.rowEnd}
                        accessibilityRole="button"
                        accessibilityLabel={t('Options', 'Tuỳ chọn', 'オプション')}
                      >
                        <Ionicons name="ellipsis-horizontal" size={20} color={colors.textTertiary} />
                      </PressableScale>
                      {opens ? <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} style={s.rowEnd} /> : null}
                    </PressableScale>
                  );
                })}
              </Card>
            </View>
          ))}
        </>
      )}

      <ActionSheet
        visible={menuFor !== null}
        onClose={() => setMenuFor(null)}
        actions={actions}
        header={menuFor ? (
          <View style={{ gap: 2 }}>
            <Text style={s.sheetTitle} numberOfLines={2}>{nameOf(menuFor)}</Text>
            <Text style={s.sheetMeta}>{metaOf(menuFor)}</Text>
          </View>
        ) : null}
      />
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  summary: { color: colors.textSecondary, ...type.meta, marginTop: -4 },
  month: { gap: 8 },
  eyebrow: {
    color: colors.textTertiary, fontSize: 12.5, fontWeight: font.semibold,
    letterSpacing: 1.1, textTransform: 'uppercase', marginTop: 6,
  },
  // Activity's row, to the figure — see the note there for the mark's
  // arithmetic and why the row aligns its top.
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 13,
    paddingHorizontal: space.cardPadding, paddingVertical: 13,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  rowEnd: { alignSelf: 'center' },
  mark: {
    width: 44, height: MARK_BOX, marginTop: (LINE - MARK_BOX) / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { color: colors.text, fontSize: 15, lineHeight: LINE, fontWeight: font.medium },
  meta: { color: colors.textTertiary, ...type.meta },
  sheetTitle: { color: colors.text, fontSize: 18, fontFamily: display.semibold },
  sheetMeta: { color: colors.textTertiary, fontSize: 14 },
});
