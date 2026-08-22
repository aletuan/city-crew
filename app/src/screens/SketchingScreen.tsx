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
import { clockOf, dateline, fmtMinutes, instantOn, openState } from '../lib/format';
import { fmtDistance } from '../lib/geo';
import { planGap } from '../lib/gaps';
import { useI18n } from '../lib/i18n';
import { narratableOf, prefetchNarration } from '../lib/assist';
import { membersOf } from '../lib/place';
import { planTrips } from '../lib/planner';
import { legsOf } from '../lib/travel';
import { useSave } from '../lib/save';
import { usePlanProfile } from '../lib/tasteProfile';
import {
  finished, findingsOf, latestFinding, SKETCH_STEPS, STEP_FLOOR_MS, stepStates,
  summaryLine, type StepState,
} from '../lib/sketch';
import { COMPANY, draftFrom, type TripDraft } from '../lib/trip';
import { clampDay, fromISO, todayISO } from '../lib/day';
import type { Nav, RootRoute } from '../nav';
import { colors, font, gradAI, radius, space } from '../theme';

/**
 * How long the last step will hold for the model before finishing anyway.
 *
 * Sized against the pipeline it waits on: the Edge Function gives the
 * model twelve seconds before falling back, and a healthy narration takes
 * three to eight. Eight here means a normal answer is always waited out,
 * while the pathological one — a call limping toward the server's own
 * timeout — is not allowed to hold a progress screen hostage. Past the
 * cap the flow continues and the editor's reserved lines absorb the rare
 * late landing.
 */
const HOLD_MS = 8000;

/**
 * One finding, arriving.
 *
 * ── the animation, and what it is allowed to imply ──
 *
 * Each line fades up and settles. It does not loop, and there is no
 * marquee: a status line that comes back round is the tell of a progress
 * bar with nothing behind it, and this screen spent its first life being
 * exactly that. Every line here is a fact about a plan that already
 * exists, shown once, and replaced when the step above it changes.
 *
 * ── why the whole box does not resize ──
 *
 * The lines are different lengths and two of them wrap. Animating a box
 * that also changes height makes the steps above it jump, so the height
 * is held at two lines' worth and the text is centred in it. A little
 * empty space under a short line is cheaper than a list that twitches
 * every time a fact lands.
 *
 * ── reduced motion ──
 *
 * `still` cuts the transition rather than shortening it. Somebody who has
 * asked the system for less movement is not asking for faster movement,
 * and this screen already honours the same flag on the orb.
 */
function Finding({ text, still }: { text: string; still: boolean }) {
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    if (still) { fade.setValue(1); rise.setValue(0); return; }
    fade.setValue(0);
    rise.setValue(6);
    const run = Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]);
    run.start();
    return () => run.stop();
    // Keyed on the text: a new fact is a new arrival, and the same fact
    // held across two steps must not blink.
  }, [text, still, fade, rise]);

  return (
    <Animated.View style={[s.finding, { opacity: fade, transform: [{ translateY: rise }] }]}>
      <Text style={s.findingText}>{text}</Text>
    </Animated.View>
  );
}

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
  const { mine } = useSave();
  const { taste, budgetVnd } = usePlanProfile();

  // The seed is fixed for this visit rather than read at render: a new
  // draw on every re-render would mean the plans the reader is shown are
  // not the plans this screen decided existed.
  const seed = useRef(Date.now()).current;

  const draft: TripDraft = useMemo(
    () => draftFrom(p, clampDay(p.date || todayISO())),
    [p],
  );

  // Resolved here the way the two screens after this resolve it, and that
  // used to not be true: this screen planned without the pinned places, so
  // a day seeded from a collection was sketched as a *different* day from
  // the one the options screen then showed. Harmless while the plans here
  // only fed the empty-check; fatal once they feed the narration prefetch,
  // because words asked about the wrong plan are a cache nobody reads.
  const pinned = useMemo(() => {
    if (!p.from?.length) return [];
    const wanted = new Set(p.from);
    return mine.data.filter((c) => wanted.has(c.slug)).flatMap((c) => membersOf(c, places));
  }, [p.from, mine.data, places]);

  // Run once the catalog is in. Cheap enough to run here and again on the
  // next screen — it is array arithmetic over a few hundred rows — and
  // running it here is what lets this screen report rather than perform.
  const plans = useMemo(
    () => (loading ? [] : planTrips(draft, places, city?.id ?? null,
      { seed, startMin: p.startMin, pinned, taste, budgetVnd })),
    [loading, places, city?.id, draft, seed, p.startMin, pinned, taste, budgetVnd],
  );
  const gap = useMemo(() => planGap(p.categories, places), [p.categories, places]);

  /**
   * What the box under the steps has to report, measured from the plan
   * that already exists.
   *
   * The count of open places is worked out here rather than taken from
   * the planner, and the phrasing is written to match what is actually
   * counted: every place in the city's catalog whose hours say it is open
   * at the starting hour. The planner's own pool is narrower — it also
   * wants the right city, a live listing and a matching category — so
   * quoting *its* number under the words "places open at 09:00" would be
   * a true number under a false description.
   *
   * `openState` returns null for a place that posts no hours, and null is
   * not "closed": those simply are not counted, which is the same thing
   * `dropReason` does with them.
   *
   * Everything else comes from the first plan, because that is the one
   * the reader is about to see recommended.
   */
  const findings = useMemo(() => {
    const day = clampDay(p.date || todayISO());
    const startMin = p.startMin ?? plans[0]?.windowMin[0] ?? 0;
    const at = instantOn(day, startMin);
    const openNow = at
      ? places.filter((pl) => openState(pl.opening_hours, at)?.open).length
      : 0;
    const best = plans[0];
    return findingsOf(
      {
        openNow,
        startMin,
        opening: best?.stops[0]?.place.name_en ?? null,
        hop: best ? legsOf(best.stops.map((st) => st.place))[0] ?? null : null,
        window: best?.windowMin ?? null,
      },
      t,
      { clock: clockOf, distance: fmtDistance, minutes: (n) => fmtMinutes(n, lang) },
    );
  }, [places, plans, p.date, p.startMin, t, lang]);


  /**
   * Whether the model's words have landed — the one thing besides the
   * catalog this screen genuinely waits for.
   *
   * The prefetch used to start on the options screen, which sounded early
   * and was not: the reader's few seconds of comparing cards ran against a
   * model that takes three to eight, so the editor still opened on facts
   * and rewrote itself. This screen is where the waiting already lives —
   * an orb, five steps, a reader braced for a pause — so the asking starts
   * the moment the plans exist, and the last step holds until every
   * card's words are settled in the cache.
   *
   * Held with a cap, not forever. `HOLD_MS` is the point where waiting
   * longer buys less than moving on costs: past it the screen finishes,
   * and in the rare case the words land later the editor's reserved lines
   * absorb them. A model that is *down* never costs the cap — `narrate`
   * fails fast and settles empty, and empty is an answer.
   */
  const [wordsReady, setWordsReady] = useState(false);
  useEffect(() => {
    if (loading) return;
    if (!plans.length) { setWordsReady(true); return; }
    let live = true;
    const asks = plans.map((plan) => prefetchNarration(
      narratableOf(plan.stops),
      { company: p.company, categories: p.categories, when: p.when, where: p.where },
      lang,
    ));
    void Promise.allSettled(asks).then(() => { if (live) setWordsReady(true); });
    const cap = setTimeout(() => { if (live) setWordsReady(true); }, HOLD_MS);
    return () => { live = false; clearTimeout(cap); };
  }, [loading, plans, p.company, p.categories, p.when, p.where, lang]);

  // Step one waits on the catalog; the last step waits on the words. The
  // steps between advance on a reading floor, because the work behind them
  // finishes in under a millisecond and claims that flash past have told
  // the reader nothing.
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (loading || step >= SKETCH_STEPS.length) return;
    // Hold on the final step — drawn active, honestly — until the words
    // settle. The floor still applies after they do, so even an instant
    // answer leaves the line on screen long enough to read.
    if (step === SKETCH_STEPS.length - 1 && !wordsReady) return;
    const id = setTimeout(() => setStep((n) => n + 1), STEP_FLOOR_MS);
    return () => clearTimeout(id);
  }, [loading, step, wordsReady]);

  /** The line in the box: this step's finding, or the last one before it
   *  that had something to say. Null until the second step, when the
   *  first fact exists — until then the skeleton stands. */
  const finding = latestFinding(findings, step);

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
            {finding
              ? <Finding text={finding} still={calm} />
              : (
                <>
                  <Skeleton style={{ height: 12, width: '46%', borderRadius: 6 }} />
                  <Skeleton style={{ height: 12, width: '88%', borderRadius: 6 }} />
                  <Skeleton style={{ height: 12, width: '72%', borderRadius: 6 }} />
                </>
              )}
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

  // A fixed height, because the box now holds sentences of different
  // lengths and a box that resizes under the step list makes the list
  // jump every time a fact lands. Two lines' worth, centred — the
  // skeleton's three bars fit the same room.
  preview: {
    alignSelf: 'stretch', gap: 10, padding: 16, marginTop: 2,
    minHeight: 96, justifyContent: 'center',
    backgroundColor: colors.surfaceCard, borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  finding: { alignSelf: 'stretch' },
  // A size up from `note` and in the reading colour, because this is
  // content rather than a footnote about the screen — it is the first
  // piece of the answer the reader gets.
  findingText: {
    color: colors.textSecondary, fontSize: 15, lineHeight: 21, textAlign: 'center',
  },
  note: { color: colors.textTertiary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 2 },
});
