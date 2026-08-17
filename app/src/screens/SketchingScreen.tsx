// "Sketching your day" — the screen between pressing the button and
// having three plans.
//
// It used to be honest theatre: no planner existed, so the four steps ran
// on a stopwatch and the screen ended by promising an itinerary rather
// than showing one. The note that shipped with the fiction said what
// should happen when the planner arrived — the steps stop being a timer
// and start being reports — and that is what this is now.
//
// One thing genuinely waits: the catalog. `CatalogProvider` may still be
// fetching when this opens, and the first step does not complete until it
// has. The rest is arithmetic over an array and finishes instantly, so
// what paces the remaining steps is `STEP_FLOOR_MS` — how long a line has
// to be on screen to be read, not a claim about the work.
//
// The screen runs the planner to know whether there is anything to show,
// then hands the *answers* to `PlanOptions` rather than the plans
// themselves. `planTrips` is pure and seeded, so the next screen rebuilds
// the identical three from the identical inputs — cheaper than serialising
// three plans through navigation, and it keeps one source of truth for
// what the answers produce.
//
// The sequence, the finish and the summary line are in `lib/sketch`,
// where a test can reach them. What is left here is the drawing.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import SketchOrb from '../components/SketchOrb';
import {
  GradientCta, Screen, Skeleton, useLoop, useReducedMotion, useTabBarClearance,
} from '../components/ui';
import { CATEGORIES, categoryLabel } from '../lib/categories';
import { usePlaces } from '../lib/catalog';
import { useCity } from '../lib/city';
import { dateline } from '../lib/format';
import { planGap } from '../lib/gaps';
import { useI18n } from '../lib/i18n';
import { planTrips } from '../lib/planner';
import { usePlanProfile } from '../lib/tasteProfile';
import {
  finished, SKETCH_STEPS, STEP_FLOOR_MS, stepStates, summaryLine, type StepState,
} from '../lib/sketch';
import { COMPANY, type TripDraft } from '../lib/trip';
import { clampDay, fromISO, todayISO } from '../lib/day';
import type { Nav, RootRoute } from '../nav';
import { colors, font, gradAI, radius, space } from '../theme';

export default function SketchingScreen({ navigation, route }: {
  navigation: Nav;
  route: RootRoute<'Sketching'>;
}) {
  const { t, lang } = useI18n();
  const clearance = useTabBarClearance(10);
  const calm = useReducedMotion();
  const p = route.params;
  const { data: places, loading } = usePlaces();
  const { city } = useCity();
  const { taste, budgetVnd } = usePlanProfile();

  // The seed is fixed for this visit rather than read at render: a new
  // draw on every re-render would mean the plans the reader is shown are
  // not the plans this screen decided existed.
  const seed = useRef(Date.now()).current;

  const draft: TripDraft = useMemo(() => ({
    company: null, categories: p.categories, district: p.district, at: null,
    date: clampDay(p.date || todayISO()), when: p.when, from: p.from ?? [],
  }), [p.categories, p.district, p.date, p.when, p.from]);

  // Run once the catalog is in. Cheap enough to run here and again on the
  // next screen — it is array arithmetic over a few hundred rows — and
  // running it here is what lets this screen report rather than perform.
  const plans = useMemo(
    () => (loading ? [] : planTrips(draft, places, city?.id ?? null, { seed, startMin: p.startMin, taste, budgetVnd })),
    [loading, places, city?.id, draft, seed, p.startMin, taste, budgetVnd],
  );
  const gap = useMemo(() => planGap(p.categories, places), [p.categories, places]);

  // Step one waits on the catalog, which is the only part of this that is
  // really slow. The rest advance on a reading floor, because the work
  // behind them finishes in under a millisecond and four claims that flash
  // past have told the reader nothing.
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (loading || step >= SKETCH_STEPS.length) return;
    const id = setTimeout(() => setStep((n) => n + 1), STEP_FLOOR_MS);
    return () => clearTimeout(id);
  }, [loading, step]);

  const states = stepStates(step);
  const done = finished(step);
  const empty = done && plans.length === 0;

  // Leaving is an effect rather than something the render does, so a
  // re-render mid-transition cannot fire it twice.
  useEffect(() => {
    if (!done || !plans.length) return;
    navigation.replace('PlanOptions', { ...p, seed });
  }, [done, plans.length, navigation, p, seed]);

  const company = COMPANY.find((c) => c.key === p.company);
  const day = clampDay(p.date || todayISO());
  const line = summaryLine([
    company ? t(company.en, company.vi, company.ja) : null,
    p.when === 'day' ? t('Day', 'Ban ngày', '昼') : t('Evening', 'Buổi tối', '夜'),
    dateline(lang, fromISO(day) ?? new Date()),
    p.where,
  ]);
  const wants = summaryLine(p.categories.map((c) => (CATEGORIES[c] ? categoryLabel(c, t) : null)));

  return (
    <Screen title={t('Plan a trip', 'Lên kế hoạch', 'プランを立てる')}>
      <ScrollView
        contentContainerStyle={[s.body, { paddingBottom: clearance }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Still only when there is nothing coming. While the steps run the
            screen is about to hand over a plan, and an orb that settles
            first reads as the work having stopped short. */}
        <SketchOrb still={empty || calm} />

        <Text style={s.title}>
          {empty
            ? t('Nothing to build a day from', 'Chưa đủ chỗ để dựng một ngày', '一日を組む材料が足りません')
            : p.when === 'day'
              ? t('Sketching your day…', 'Đang phác ngày của bạn…', '一日を下描き中…')
              : t('Sketching your evening…', 'Đang phác buổi tối của bạn…', '夜を下描き中…')}
        </Text>
        {!!line && <Text style={s.sub}>{line}</Text>}
        {!!wants && <Text style={s.sub}>{wants}</Text>}

        <View style={s.card}>
          {SKETCH_STEPS.map((step, i) => (
            <StepRow
              key={step.key}
              label={t(step.en, step.vi, step.ja)}
              state={states[i]}
              still={calm}
            />
          ))}
        </View>

        {/* What a plan will look like, in the shape it arrives in. Gone
            once there is nothing coming: a skeleton is a promise that
            something is on its way, and leaving it pulsing above "nothing
            matches those choices" makes the screen argue with itself. */}
        {!empty && (
          <View style={s.preview}>
            <Skeleton style={{ height: 12, width: '46%', borderRadius: 6 }} />
            <Skeleton style={{ height: 12, width: '88%', borderRadius: 6 }} />
            <Skeleton style={{ height: 12, width: '72%', borderRadius: 6 }} />
          </View>
        )}

        {empty ? (
          <>
            {/* A dead end deserves more than a report that it is one — the
                same rule the empty search screen follows. The category
                named is one this city actually has, taken from the catalog
                rather than from the copy, so choosing it is a promise that
                keeps. */}
            <Text style={s.note}>
              {gap.suggestion
                ? t(
                  `Nothing in this city matches those choices for that hour. ${categoryLabel(gap.suggestion, t)} has places open — try adding it.`,
                  `Không có chỗ nào ở thành phố này khớp với lựa chọn đó vào giờ ấy. ${categoryLabel(gap.suggestion, t)} thì còn chỗ mở cửa — thử thêm vào xem.`,
                  `その時間帯に条件に合う店がこの街にありません。${categoryLabel(gap.suggestion, t)}なら開いている店があります。`,
                )
                : t(
                  'Nothing in this city matches those choices for that hour. Try another day or another part of it.',
                  'Không có chỗ nào ở thành phố này khớp với lựa chọn đó vào giờ ấy. Thử ngày khác hoặc buổi khác xem.',
                  'その時間帯に条件に合う店がこの街にありません。別の日か別の時間帯をお試しください。',
                )}
            </Text>
            <GradientCta
              icon="arrow-back"
              label={t('Change the answers', 'Sửa lại lựa chọn', '回答を変える')}
              onPress={() => navigation.goBack()}
              wide
            />
          </>
        ) : (
          <Text style={s.note}>
            {t(
              'You can edit everything afterwards.',
              'Bạn có thể sửa lại mọi thứ sau.',
              'あとから全部編集できます。',
            )}
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}

/**
 * The mark beside a step, in whichever of the three states it is in.
 *
 * The active one is a bright arc travelling over a faint full ring, and
 * both halves of that matter. The first version drew only the arc — a
 * circle with its top border transparent — which is a *hole*, not a
 * segment, and a hole in a ring that is also standing still does not read
 * as "working". It reads as broken, which is what it was reported as.
 *
 * So: the track goes back, and the arc turns again.
 *
 * It turns at the orb's own 1.6s, which answers the objection that put it
 * on hold. Two spinners at two speeds read as two separate things
 * happening; two turning in step read as one thing, in two sizes.
 */
function StepMark({ state, still }: { state: StepState; still: boolean }) {
  const spin = useLoop(1600, still || state !== 'active');

  if (state === 'done') {
    return (
      <LinearGradient {...gradAI} style={s.mark}>
        <Ionicons name="checkmark" size={14} color={colors.accentInk} />
      </LinearGradient>
    );
  }
  if (state !== 'active') return <View style={[s.mark, s.markPending]} />;

  // Held still, an arc parked at some angle is the broken-looking ring
  // this screen already shipped once. With nothing turning there is no
  // reason to draw a segment at all, so the running mark closes into a
  // solid ring — the third distinct shape, beside the gradient disc that
  // means done and the dashed outline that means waiting.
  if (still) return <View style={[s.mark, s.markStill]} />;

  return (
    <View style={s.mark}>
      {/* The track. Without it the arc is a gap rather than a segment, and
          the ring looks damaged at every angle it stops at. */}
      <View style={[StyleSheet.absoluteFill, s.markTrack]} />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          s.markArc,
          { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] },
        ]}
      />
    </View>
  );
}

function StepRow({ label, state, still }: { label: string; state: StepState; still: boolean }) {
  // The label breathes while its step is running — the `shimmer` the design
  // asked for, at 0.62 rather than 0.45 at the bottom. Text that fades most
  // of the way out is text somebody is mid-sentence with when it goes.
  const glow = useLoop(1400, still || state !== 'active', 'inOut');
  const dim = state === 'active'
    ? glow.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1] })
    : 1;

  return (
    <View style={s.step}>
      <StepMark state={state} still={still} />
      <Animated.Text
        style={[
          s.stepText,
          state === 'pending' && s.stepTextOff,
          state === 'active' && s.stepTextOn,
          { opacity: dim },
        ]}
        numberOfLines={2}
      >
        {label}
      </Animated.Text>
    </View>
  );
}

const s = StyleSheet.create({
  body: { alignItems: 'center', paddingHorizontal: space.page, paddingTop: 10, gap: 14 },

  title: { color: colors.text, fontSize: 27, fontFamily: 'SpaceGrotesk_700Bold', textAlign: 'center', marginTop: 6 },
  sub: { color: colors.textSecondary, fontSize: 15, lineHeight: 21, textAlign: 'center' },

  card: {
    alignSelf: 'stretch', marginTop: 6,
    backgroundColor: colors.surfaceCard, borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
    paddingVertical: 6,
  },
  // No tint under the running row. `accentSoft` on a full-width row
  // already means "you chose this" — see `CandidateRow.rowOn`, where a
  // ticked search result wears exactly this colour and shape. Borrowing it
  // for "this one is working" is borrowing a word that is taken, and the
  // block was heavy enough to outweigh the orb it was meant to sit under.
  //
  // The signal lives in the mark instead. See `StepMark`.
  step: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 16, paddingVertical: 11 },
  mark: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  // The faint full circle the arc rides on.
  markTrack: { borderRadius: 12, borderWidth: 2, borderColor: colors.accentLine },
  // One quadrant of colour. Every other side transparent, so what shows is
  // an arc on the track rather than a ring with a bite out of it.
  markArc: {
    borderRadius: 12, borderWidth: 2,
    borderColor: 'transparent', borderTopColor: colors.accent,
  },
  markStill: { borderWidth: 2, borderColor: colors.accent },
  markPending: { borderWidth: 1.5, borderColor: colors.borderGlass, borderStyle: 'dashed' },
  stepText: { flex: 1, color: colors.textSecondary, fontSize: 15 },
  stepTextOn: { color: colors.text, fontWeight: font.semibold },
  stepTextOff: { color: colors.textTertiary },

  preview: {
    alignSelf: 'stretch', gap: 10, padding: 16, marginTop: 2,
    backgroundColor: colors.surfaceCard, borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  note: { color: colors.textTertiary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 2 },
});
