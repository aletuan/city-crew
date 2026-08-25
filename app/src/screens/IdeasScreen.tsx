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
import {
  Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import StartSheet, { Start } from '../components/StartSheet';
import {
  AmbientWarmth, Card, Chip, GradientCta, PressableScale, Screen, SelectTick, useTabBarClearance,
} from '../components/ui';
import { useDuckOnScroll } from '../components/tabBarDuck';
import { CATEGORIES, CATEGORY_ORDER, categoriesOf, categoryLabel } from '../lib/categories';
import { useCity, useMyPosition } from '../lib/city';
import { usePlaces } from '../lib/catalog';
import { coverOf, membersOf } from '../lib/data';
import { clockOf, dateline } from '../lib/format';
import { addDays, clampDay, fromISO, toISO } from '../lib/day';
import { useI18n } from '../lib/i18n';
import { partGone, startMinFor, START_MIN } from '../lib/planner';
import { useSave } from '../lib/save';
import { canPlan, COMPANY, EMPTY_DRAFT, startPoint, toggle, TripDraft } from '../lib/trip';
import type { Nav } from '../nav';
import { colors, font, space, type } from '../theme';

/** The last instant of a calendar day, for a picker bound. `fromISO` gives
 *  local noon — right for a day, half a day short of a ceiling. */
const endOfDay = (iso: string): Date | undefined => {
  const d = fromISO(iso);
  if (!d) return undefined;
  d.setHours(23, 59, 59, 999);
  return d;
};

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
  const duckScroll = useDuckOnScroll();

  const [draft, setDraft] = useState<TripDraft>(EMPTY_DRAFT);
  const [picking, setPicking] = useState(false);
  /**
   * The chosen day, resolved and never in the past — and, when nobody has
   * chosen one, never a day whose outing has already happened.
   *
   * `EMPTY_DRAFT` carries '' rather than today, because it is a module
   * constant and today would be frozen at import — an app left open past
   * midnight would offer to plan yesterday. Resolving here also self-heals
   * that case for a draft chosen before midnight.
   *
   * The default is today only while today can still hold the outing. At
   * five in the afternoon, "Day" defaulted to today and produced a plan
   * starting at 09:00 — a morning that had been over for eight hours, with
   * its places picked against their 09:00 opening hours. Tomorrow is what
   * that reader meant, and the date box says so before they tap anything,
   * which is the part that makes this a default rather than a trick.
   *
   * Only the default moves. A reader who opens the picker and chooses today
   * at ten in the evening gets today, and `startMinFor` starts their plan
   * from ten rather than from six — an odd request, honestly answered,
   * instead of a silent correction.
   */
  const now = new Date();
  /** Today at 00:00 — the picker's floor. Not `fromISO(todayISO())`, which
   *  is noon; see the picker below. */
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = clampDay(draft.date || (partGone(draft.when, toISO(now), now)
    ? addDays(toISO(now), 1)
    : toISO(now)));
  /** The hour this plan really starts, which is not the shape's hour when
   *  the reader has insisted on a day already under way. */
  const startMin = startMinFor(draft.when, day, now);
  const late = startMin > START_MIN[draft.when];
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

  /**
   * Where the reader is, for the default the label has always claimed.
   *
   * "Around Hanoi · near me" is the state where neither a district nor a
   * pin has been chosen — which is to say, the empty one. It read as a
   * promise and was not one: the draft carried no coordinate, `originOf`
   * therefore had no origin, and the first stop was chosen on merit from
   * anywhere in the city. The label said "near me" and the planner had
   * never been told where that was.
   *
   * Read here rather than written into the draft, and that is the whole
   * of why this is small. `draft.at` means *the point the reader chose*,
   * and the label two lines up distinguishes it from this one; filling it
   * with a position nobody pointed at would make "A pin you dropped"
   * appear over a pin nobody dropped. The two facts stay separate and
   * meet once, below, in the coordinate handed to the next screen.
   *
   * Never prompts — `useMyPosition` reads the permission and does not ask.
   * Denied means null means the old behaviour, which is the honest floor:
   * no origin rather than an invented one.
   */
  const me = useMyPosition();

  /**
   * The point the day starts from — pin, else district-suppresses, else
   * where they are. The rule and its reasoning live in `startPoint`.
   *
   * Frozen into the route params at the tap rather than re-read
   * downstream. Three screens after this one rebuild the plan from these
   * params, and a position that arrived between two of them would be two
   * different plans for one draft — the same hazard `startMin` is
   * carried to avoid.
   */
  const origin = startPoint(draft, me);

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
        onScroll={duckScroll}
        scrollEventThrottle={16}
      >
        {/* "the plan", not "the day". Both this and the button below used
            to name the day, on a screen whose own Day/Evening control sits
            between them — so picking Evening left the reader being offered
            a day, twice, while the two screens after this one correctly
            said evening.

            Generic rather than switched on `when`, which is the other way
            to make it true. A call to action that rewrites itself while the
            reader is still tapping the chips above it is the screen
            fidgeting under their hand, and this app has just spent a change
            teaching a row not to do that. The word the reader picked is
            already on screen, in the control they picked it with; the
            button does not need to repeat it back. */}
        <Text style={s.lede}>
          {t(
            'Tell us a little and we will sketch the plan. You can change everything later.',
            'Cho vài gợi ý, chúng tôi phác ra kế hoạch. Sửa lại lúc nào cũng được.',
            '少し教えてください — プランを下描きします。あとで全部変えられます。',
          )}
        </Text>

        {/* The three headers below open a sentence and the chips finish
            it — "Going with… ✓ Friends". They used to be questions
            ("Who's coming?"), which read as a form to fill in; a copy
            edit here should keep them as openers the chip labels can
            complete, ellipsis and all. */}
        <Section title={t('Going with…', 'Bạn muốn đi cùng…', '一緒に行くのは…')}>
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

        <Section title={t('In the mood for…', 'Hôm nay bạn thích…', '今日の気分は…')}>
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
          <Text style={s.heading}>{t('Where and when…', 'Chỗ nào, lúc nào…', '場所と時間は…')}</Text>
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
          {/* Only when the clock has moved the start, which is only ever
              on today. Said here rather than left for the reader to notice
              on the plan: a day out that begins at 17:15 is a surprise
              worth having before the sketching starts, not after. */}
          {late && (
            <Text style={s.whenNote}>
              {t(
                `It is already ${clockOf(startMin)} — this plan starts from there.`,
                `Bây giờ đã ${clockOf(startMin)} — kế hoạch sẽ bắt đầu từ đó.`,
                `もう${clockOf(startMin)}です — ここから始めるプランにします。`,
              )}
            </Text>
          )}
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
              // Generic, and it stays generic — see the lede's note.
              label={t('Sketch the plan', 'Phác kế hoạch', 'プランを下描き')}
              // `whereLabel` rather than the raw draft: only this screen
              // knows which of the three the reader ended up with — a
              // district, a pin, or the position behind "near me" — and
              // the next one has no business re-deciding that.
              onPress={() => navigation.navigate('Sketching', {
                company: draft.company,
                categories: draft.categories,
                // `origin`, so the near-me case gets its words too. It
                // used to fall to null here, and a plan that really did
                // start where the reader was standing arrived with no
                // answer to "starting from where".
                where: draft.district ?? (origin ? whereLabel : null),
                district: draft.district,
                // The coordinate behind that label. `where` is words and
                // has always been words; sending it without these is how
                // a pin came out as a plan across town, with the header
                // still claiming the pin had been read.
                //
                // `origin`, not `draft.at`: the default is the reader's
                // own position, and it travels the same wire the pin
                // does. See the note on `origin` for why a district
                // suppresses it rather than losing to it.
                atLat: origin?.lat,
                atLng: origin?.lng,
                date: day,
                when: draft.when,
                // Resolved once, here, and carried. See `PlanAsk.startMin`:
                // the three screens after this one each rebuild the plan,
                // and each reading the clock for itself is how one card
                // opens as a different evening.
                startMin,
                from: draft.from,
              })}
            />
          </View>
          {!ready && (
            <Text style={s.ctaHint}>
              {t(
                "Just pick who's going and one thing you fancy.",
                'Chỉ cần đi cùng ai và một thứ bạn thích là được.',
                '誰と行くかと、気になるもの1つだけで大丈夫です。',
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
              //
              // The bounds are instants, not days, which is why they are
              // built here rather than with `fromISO` — that returns local
              // *noon*, deliberately, so a calendar day survives every
              // timezone. Handed to a picker as a minimum it means
              // something else entirely: "today, from 12:00", and every
              // reader opening this before lunch found today greyed out on
              // the day they were most likely to want it.
              minimumDate={startOfToday}
              maximumDate={endOfDay(addDays(toISO(startOfToday), 365))}
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

  // No heading above it, unlike every question below. A heading would make
  // it a fifth question; without one it reads as an alternative to the four,
  // which is what it is.

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

  // Under the card, not inside it: the card is the control and this is a
  // consequence of it, the same relation `ctaHint` has to the button.
  //
  // `space.page`, like every other top-level element here. This screen has
  // no container padding — the scroll view runs edge to edge and the lede,
  // the headings, the card and the CTA each declare their own inset. A `4`
  // slipped in here instead, borrowed from a card's interior, and left the
  // line starting 18pt to the left of everything it belongs under.
  whenNote: {
    color: colors.textTertiary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    paddingHorizontal: space.page,
  },

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
