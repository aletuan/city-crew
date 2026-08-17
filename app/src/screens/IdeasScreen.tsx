// Plan a trip — the questions, not the answer.
//
// Four of them, in the order they narrow: who the day is for, what sounds
// good, where and when, and whether to start from something you have
// already saved. Every one has a default or is optional except the first
// two, which is what `canPlan` says out loud.
//
// The chips are the app's own `Chip` and the app's own category taxonomy,
// so a plan cannot ask for something the catalog has no word for, and the
// glyph beside "Cà phê" here is the glyph beside "Cà phê" on Explore's
// filter row and on a place card's vibe dot. That is not tidiness — a
// wizard that invents its own vocabulary produces a plan the rest of the
// app cannot explain.
//
// The plan itself is not built here yet. The button hands the draft to a
// screen that has not been written, which is the honest state of it.

import React, { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import StartSheet, { Start } from '../components/StartSheet';
import {
  AmbientWarmth, Card, Chip, GradientCta, PressableScale, Screen, SelectTick, useTabBarClearance,
} from '../components/ui';
import { CATEGORIES, CATEGORY_ORDER, categoriesOf, categoryLabel } from '../lib/categories';
import { useCity } from '../lib/city';
import { usePlaces } from '../lib/catalog';
import { coverOf, membersOf } from '../lib/data';
import { dateline } from '../lib/format';
import { addDays, clampDay, fromISO, toISO, todayISO } from '../lib/day';
import { useI18n } from '../lib/i18n';
import { useSave } from '../lib/save';
import { canPlan, COMPANY, EMPTY_DRAFT, toggle, TripDraft } from '../lib/trip';
import type { Nav } from '../nav';
import { colors, font, radius, space, type } from '../theme';

/** A question and the row of answers under it. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: space.titleToContent }}>
      <Text style={s.heading}>{title}</Text>
      <View style={s.wrap}>{children}</View>
    </View>
  );
}

export default function IdeasScreen({ navigation }: { navigation: Nav }) {
  const { t, lang } = useI18n();
  const { city } = useCity();
  const { data: places } = usePlaces();
  const { mine } = useSave();
  const tabClearance = useTabBarClearance();

  const [draft, setDraft] = useState<TripDraft>(EMPTY_DRAFT);
  const [picking, setPicking] = useState(false);
  /**
   * The chosen day, resolved and never in the past.
   *
   * `EMPTY_DRAFT` carries '' rather than today, because it is a module
   * constant and today would be frozen at import — an app left open past
   * midnight would offer to plan yesterday. Resolving here also self-heals
   * that case for a draft chosen before midnight.
   */
  const day = clampDay(draft.date || todayISO());
  const [sheet, setSheet] = useState(false);

  // Only categories this city actually has, the same rule Explore's filter
  // row follows: a chip must never lead to an empty answer.
  const cats = useMemo<string[]>(() => {
    const present = new Set<string>();
    for (const p of places) for (const c of categoriesOf(p)) present.add(c);
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [places]);

  const set = <K extends keyof TripDraft>(k: K, v: TripDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const whereLabel = draft.district
    ?? (draft.at
      ? t('A pin you dropped', 'Ghim bạn đã thả', '置いたピン')
      : t(`Around ${city?.short_en ?? ''} · near me`, `Quanh ${city?.short_vi ?? ''} · gần tôi`, `${city?.short_ja ?? ''}周辺 · 現在地`));

  // The weekday and the date, always — including for today. "Today" alone
  // was tried and is worse here: the row sits beside Day/Evening with
  // about 150pt to spare, so there is no room to print both, and the word
  // that has to go is the one that says nothing a calendar could not.
  // Somebody about to open a date picker wants to see which date they are
  // opening it on.
  const dayLabel = dateline(lang, fromISO(day) ?? new Date());

  const ready = canPlan(draft);

  return (
    <Screen title={t('Plan a trip', 'Lên kế hoạch', 'プランを立てる')}>
      <AmbientWarmth />
      <ScrollView
        contentContainerStyle={{ paddingBottom: tabClearance }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.lede}>
          {t(
            'Tell us a little and we will sketch the day. You can change everything later.',
            'Cho vài gợi ý, chúng tôi phác ra một ngày. Sửa lại lúc nào cũng được.',
            '少し教えてください — 一日を下描きします。あとで全部変えられます。',
          )}
        </Text>

        <Section title={t("Who's coming?", 'Đi cùng ai?', '誰と行きますか？')}>
          {COMPANY.map((c) => (
            <Chip
              key={c.key}
              label={t(c.en, c.vi, c.ja)}
              icon={c.icon as keyof typeof Ionicons.glyphMap | undefined}
              iconColor={c.color}
              active={draft.company === c.key}
              onPress={() => set('company', draft.company === c.key ? null : c.key)}
            />
          ))}
        </Section>

        <Section title={t('What sounds good?', 'Thích kiểu gì?', '何が良さそう？')}>
          {cats.map((c) => (
            <Chip
              key={c}
              label={categoryLabel(c, t)}
              icon={CATEGORIES[c]?.icon}
              iconColor={CATEGORIES[c]?.color}
              active={draft.categories.includes(c)}
              onPress={() => set('categories', toggle(draft.categories, c))}
            />
          ))}
        </Section>

        <View style={{ marginBottom: space.titleToContent }}>
          <Text style={s.heading}>{t('Where and when?', 'Ở đâu, khi nào?', 'どこで、いつ？')}</Text>
          <Card style={s.whenCard}>
            <PressableScale onPress={() => setSheet(true)} style={s.whereRow} accessibilityRole="button">
              <Ionicons name="location-outline" size={19} color={colors.accent} />
              <Text style={s.whereText} numberOfLines={1}>{whereLabel}</Text>
              <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
            </PressableScale>
            <View style={s.divider} />
            <View style={s.whenRow}>
              {/* The date used to be a label here, printed from
                  `new Date()` and not in the draft at all — while sitting
                  in the same card, directly under a row that *is* a
                  control, with the same icon and layout. It read as
                  tappable and was not. */}
              {/* `containerStyle`, not `style`: PressableScale puts `style`
                  on its inner animated view and only `containerStyle` on
                  the Pressable itself. The row above gets away without it
                  by being a direct child of the Card, which is a column,
                  so it stretches. This one is inside a row, so without a
                  flex on the *outer* element the pressable shrank to its
                  icon and the date inside it collapsed to nothing. */}
              <PressableScale
                onPress={() => setPicking(true)}
                containerStyle={s.dayBox}
                style={s.dayHit}
                accessibilityRole="button"
              >
                <Ionicons name="calendar-outline" size={19} color={colors.accent} />
                <Text style={s.whereText} numberOfLines={1}>{dayLabel}</Text>
              </PressableScale>
              <View style={s.segment}>
                <Chip
                  label={t('Day', 'Ban ngày', '昼')}
                  active={draft.when === 'day'}
                  onPress={() => set('when', 'day')}
                />
                <Chip
                  label={t('Evening', 'Buổi tối', '夜')}
                  active={draft.when === 'evening'}
                  onPress={() => set('when', 'evening')}
                />
              </View>
            </View>
          </Card>
        </View>

        {mine.data.length > 0 && (
          <View style={{ marginBottom: space.titleToContent }}>
            <Text style={s.heading}>
              {t('Start from what you love', 'Bắt đầu từ thứ bạn thích', 'お気に入りから始める')}
            </Text>
            <Card style={{ paddingVertical: 4 }}>
              {mine.data.map((c, i) => {
                const members = membersOf(c, places);
                const cover = c.cover?.photo_uri ?? (members[0] && coverOf(members[0])?.photo_uri);
                const on = draft.from.includes(c.slug);
                return (
                  <View key={c.slug}>
                    {i > 0 ? <View style={s.divider} /> : null}
                    <PressableScale
                      onPress={() => set('from', toggle(draft.from, c.slug))}
                      style={s.fromRow}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                    >
                      {cover
                        ? <Image source={{ uri: cover }} style={s.thumb} contentFit="cover" transition={200} />
                        : <View style={[s.thumb, s.thumbEmpty]}>
                            <Ionicons name="bookmark-outline" size={18} color={colors.accentFaint} />
                          </View>}
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={s.fromTitle} numberOfLines={1}>
                          {t(c.title_en, c.title_vi, c.title_ja)}
                        </Text>
                        <Text style={s.fromMeta} numberOfLines={1}>
                          {t(
                            `Your collection · ${members.length} places`,
                            `Bộ sưu tập của bạn · ${members.length} địa điểm`,
                            `あなたのコレクション · ${members.length}件`,
                          )}
                        </Text>
                      </View>
                      <SelectTick on={on} />
                    </PressableScale>
                  </View>
                );
              })}
            </Card>
          </View>
        )}

        <View style={s.cta}>
          {/* Dimmed rather than hidden, and the line under it says why.
              A button that vanishes leaves the reader hunting for what
              they missed; one that explains itself does not. */}
          <View style={ready ? undefined : s.ctaOff} pointerEvents={ready ? 'auto' : 'none'}>
            <GradientCta
              icon="sparkles"
              wide
              label={t('Sketch the day', 'Phác một ngày', '一日を下描き')}
              // `whereLabel` rather than the raw draft: only this screen
              // knows whether the reader chose a district or dropped a
              // pin, and the next one has no business re-deciding that.
              onPress={() => navigation.navigate('Sketching', {
                company: draft.company,
                categories: draft.categories,
                where: draft.district ?? (draft.at ? whereLabel : null),
                district: draft.district,
                date: day,
                when: draft.when,
                from: draft.from,
              })}
            />
          </View>
          {!ready && (
            <Text style={s.ctaHint}>
              {t(
                'Pick who is coming and at least one thing you fancy.',
                'Chọn đi cùng ai và ít nhất một thứ bạn thích.',
                '誰と行くか、そして気になるものを1つ選んでください。',
              )}
            </Text>
          )}
        </View>
      </ScrollView>

      {/* The platform's own, so the gesture is the one the reader already
          knows. `display="inline"` is the iOS calendar rather than the
          wheel — this is a question about a day, and a month grid answers
          it in one glance. */}
      {picking && (
        <Modal transparent animationType="fade" onRequestClose={() => setPicking(false)}>
          <Pressable style={s.pickScrim} onPress={() => setPicking(false)} />
          <View style={s.pickCard}>
            <DateTimePicker
              value={fromISO(day) ?? new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              // The past is refused rather than clamped after the fact:
              // there is no plan to sketch for last Tuesday, and a picker
              // that lets you choose one and then silently moves you is
              // worse than one that never offered.
              minimumDate={fromISO(todayISO()) ?? undefined}
              maximumDate={fromISO(addDays(todayISO(), 365)) ?? undefined}
              onChange={(e, picked) => {
                // Android fires once with 'set' or 'dismissed' and closes
                // itself; iOS fires on every scrub and stays open.
                if (Platform.OS !== 'ios') setPicking(false);
                if (e.type === 'dismissed' || !picked) return;
                set('date', clampDay(toISO(picked)));
              }}
            />
            {Platform.OS === 'ios' && (
              <GradientCta
                icon="checkmark"
                label={t('Done', 'Xong', '完了')}
                onPress={() => setPicking(false)}
                wide
              />
            )}
          </View>
        </Modal>
      )}

      <StartSheet
        visible={sheet}
        places={places}
        value={{ district: draft.district, at: draft.at }}
        onClose={() => setSheet(false)}
        onDone={(next: Start) => {
          setDraft((d) => ({ ...d, district: next.district, at: next.at }));
          setSheet(false);
        }}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  lede: {
    color: colors.textTertiary, fontSize: 15, lineHeight: 22,
    paddingHorizontal: space.page, marginBottom: space.titleToContent,
  },
  heading: {
    color: colors.text, ...type.headline,
    paddingHorizontal: space.page, marginBottom: space.headingToContent,
  },
  wrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: space.page,
  },

  whenCard: { marginHorizontal: space.page, paddingVertical: 4 },
  whereRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 14 },
  whenRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 10 },
  whereText: { color: colors.text, fontSize: 15.5, fontWeight: font.medium, flex: 1 },
  segment: { flexDirection: 'row', gap: 6 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft, marginHorizontal: 14 },

  fromRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  thumb: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surfaceGlass },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  fromTitle: { color: colors.text, fontSize: 15.5, fontWeight: font.semibold },
  fromMeta: { color: colors.textTertiary, fontSize: 13 },

  cta: { paddingHorizontal: space.page, marginTop: 4, gap: 10 },
  ctaOff: { opacity: 0.4 },
  ctaHint: { color: colors.textTertiary, fontSize: 13, lineHeight: 19, textAlign: 'center' },

  // The whole left of the row is the target, not the words alone: a date
  // you have to hit exactly is a worse row than one you can tap across.
  // The box takes the room; the row inside it lays the icon and date out.
  dayBox: { flex: 1 },
  dayHit: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 2 },

  pickScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,5,8,0.32)' },
  // Centred rather than a bottom sheet: the calendar is a square of dense
  // targets, and the middle of the screen is where a thumb reaches all of
  // it. The start sheet is bottom-anchored because it is a form.
  pickCard: {
    position: 'absolute', left: space.page, right: space.page,
    top: '18%',
    backgroundColor: colors.bgElevated,
    borderRadius: 22,
    padding: 14,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
});
