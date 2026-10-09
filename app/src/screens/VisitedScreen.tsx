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
// under it, a chevron only where a row goes somewhere. The groups are
// months rather than Upcoming and Earlier, because a visit has no
// future half. The row's second line is the day, the clock and the city
// — the city because the list spans every city the reader has been to,
// while the catalog on the phone holds one. The names and the covers
// come with the rows for the same reason.
//
// The row leads with the place's cover, not a glyph. It opened with a
// pin in Activity's bare 44pt slot, and on a phone thirty pins in a
// column told the eye nothing — a glyph every row shares is decoration,
// where a picture is the one thing that says which row this is (Maps'
// recents, Timeline, every music app). 56pt, rounded 12, the shape a
// content thumbnail takes here as against the circle a person takes on
// Crew; a place with no picture gets the pin on a glass square of the
// same size, so the names stay in one column either way. The pictures
// are the covers the cards draw, at full size: a thumbnail endpoint is
// a later cut, and `expo-image` caches and downsizes in the meantime.
//
// Undo is a ⋯ per row and a sheet, as the request cards on Activity do
// it, not a swipe: nothing in this app swipes to delete yet, and one
// screen teaching a gesture the others do not honour is a trap.

import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import ActionSheet, { type SheetAction } from '../components/ActionSheet';
import { AuthHeader, AuthScreen } from '../components/authUi';
import { Card, Chip, Empty, PressableScale } from '../components/ui';
import { CATEGORIES, categoryLabel } from '../lib/categories';
import {
  type Checkin, filterVisits, monthTitle, visitCategories, visitCities, visitSections, visitSummary,
} from '../lib/checkin';
import { useCity } from '../lib/city';
import { useMyCheckins } from '../lib/checkins';
import { removeCheckin } from '../lib/data';
import { clockOf, numericDate } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { colors, display, font, space, type } from '../theme';
import type { Nav } from '../nav';

const LINE = 21;
/** The thumbnail's side: 56, the size a content thumbnail takes in a
 *  list that is about the content (Apple Music's lists, Spotify's).
 *  It opened at 48 and was taken to 44 to match the face on Activity;
 *  the owner's eye on the phone said both were too small, and the
 *  reason is fair — a picture of a place has a whole room in it and
 *  needs the pixels to read, where a face reads at 44. So a place's
 *  picture and a person's face are two sizes on purpose, each the size
 *  its subject needs. Radius 12 keeps the 48:10 proportion. Two lines
 *  of text stand about 41pt; the row is 80 with the padding. */
const THUMB = 56;

export default function VisitedScreen({ navigation }: { navigation: Nav }) {
  const { t, lang } = useI18n();
  const visits = useMyCheckins();
  const { cities } = useCity();
  const [menuFor, setMenuFor] = useState<Checkin | null>(null);

  // Two filters, one per row of chips, and they combine. Each row is
  // drawn only when there is a choice to make — one city is not a
  // filter, it is a fact — and each has its own "All", so the reader can
  // let one go and keep the other. The chips are Explore's, in Explore's
  // order of meaning: a kind of place wears its glyph and hue, a city
  // wears neither.
  const [city, setCity] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const cityChoices = useMemo(() => visitCities(visits.data), [visits.data]);
  const kindChoices = useMemo(() => visitCategories(visits.data), [visits.data]);
  const shown = useMemo(() => filterVisits(visits.data, city, kind), [visits.data, city, kind]);
  const sections = useMemo(() => visitSections(shown), [shown]);
  // What is left after the filters — so a city chip reads "12 places ·
  // 1 city", which is the answer to the question the tap asked.
  const summary = visitSummary(shown);
  const cityName = (id: string) => {
    const c = cities.find((x) => x.id === id);
    return c ? t(c.short_en, c.short_vi, c.short_ja ?? c.short_en) : id;
  };

  /** The place's name in the reader's language, or what to call a place
   *  that has since been taken down: the visit happened either way. */
  const nameOf = (v: Checkin) => (v.place
    ? t(v.place.name_en, v.place.name_vi, v.place.name_ja ?? v.place.name_en)
    : t('A place that was removed', 'Một địa điểm đã bị gỡ', '削除された場所'));
  /** The date, the clock, and the city when the app still knows it. No
   *  weekday — see `numericDate`: thirty rows of "Thứ 5," said nothing. */
  const metaOf = (v: Checkin) => {
    const d = new Date(v.at);
    const city = cities.find((c) => c.id === v.city_id);
    const parts = [numericDate(lang, d), clockOf(d.getHours() * 60 + d.getMinutes())];
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

  // Places and cities, not visits: "30 lần ghé · 30 địa điểm" said one
  // number twice to a reader who checks in once per place, and the city
  // count is the fact the list cannot show on its own.
  const summaryLine = t(
    `${summary.places} ${summary.places === 1 ? 'place' : 'places'} · ${summary.cities} ${summary.cities === 1 ? 'city' : 'cities'}`,
    `${summary.places} địa điểm · ${summary.cities} thành phố`,
    `${summary.places}か所 · ${summary.cities}都市`,
  );
  const filtered = !!(city || kind);

  return (
    <AuthScreen>
      <AuthHeader onBack={() => navigation.goBack()} title={t('Check-ins', 'Địa điểm check-in', 'チェックインした場所')} />

      {!visits.loaded ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
      ) : visits.data.length === 0 ? (
        <Empty text={t(
          'No visits yet. Check in at a place to start the list.',
          'Chưa có lần ghé nào. Check-in ở một địa điểm để bắt đầu.',
          'まだ訪問がありません。場所でチェックインすると、ここに並びます。',
        )} />
      ) : (
        <>
          <Text style={s.summary}>{summaryLine}</Text>
          {cityChoices.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chips} contentContainerStyle={s.chipRow}>
              <Chip label={t('All', 'Tất cả', 'すべて')} active={city === null} onPress={() => setCity(null)} />
              {cityChoices.map((id) => (
                <Chip key={id} label={cityName(id)} active={city === id} onPress={() => setCity(id)} />
              ))}
            </ScrollView>
          )}
          {kindChoices.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chips} contentContainerStyle={s.chipRow}>
              <Chip label={t('All', 'Tất cả', 'すべて')} active={kind === null} onPress={() => setKind(null)} />
              {kindChoices.map((k) => (
                <Chip
                  key={k}
                  label={categoryLabel(k, t)}
                  icon={CATEGORIES[k]?.icon}
                  iconColor={CATEGORIES[k]?.color}
                  active={kind === k}
                  onPress={() => setKind(k)}
                />
              ))}
            </ScrollView>
          )}
          {filtered && sections.length === 0 && (
            <Empty text={t(
              'No visits match both choices.',
              'Không có lần ghé nào khớp cả hai lựa chọn.',
              '両方の条件に合う訪問はありません。',
            )} />
          )}
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
                      <View style={s.thumb} testID="visit-thumb">
                        {v.place?.cover ? (
                          <Image source={{ uri: v.place.cover }} style={s.thumbImage} contentFit="cover" transition={150} aria-hidden />
                        ) : (
                          <Ionicons name="location-outline" size={19} color={colors.textTertiary} />
                        )}
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
  // Each row bleeds to the screen's edge so the last chip can scroll in
  // from under it, as Explore's does; the gap between the two rows is
  // the card gap halved, so they read as one control with two lines.
  chips: { marginHorizontal: -space.page, marginTop: -4 },
  chipRow: { paddingHorizontal: space.page, gap: 8 },
  month: { gap: 8 },
  eyebrow: {
    color: colors.textTertiary, fontSize: 12.5, fontWeight: font.semibold,
    letterSpacing: 1.1, textTransform: 'uppercase', marginTop: 6,
  },
  // Centred: a 56pt picture beside two lines of text wants its middle
  // on theirs, where a 19pt glyph wanted the first line's. 12 of
  // padding puts the 56 in an 80pt row.
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: space.cardPadding, paddingVertical: 12,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  rowEnd: { alignSelf: 'center' },
  thumb: {
    width: THUMB, height: THUMB, borderRadius: 12, overflow: 'hidden',
    backgroundColor: colors.surfaceGlassStrong, alignItems: 'center', justifyContent: 'center',
  },
  thumbImage: { width: THUMB, height: THUMB },
  name: { color: colors.text, fontSize: 15, lineHeight: LINE, fontWeight: font.medium },
  meta: { color: colors.textTertiary, ...type.meta },
  sheetTitle: { color: colors.text, fontSize: 18, fontFamily: display.semibold },
  sheetMeta: { color: colors.textTertiary, fontSize: 14 },
});
