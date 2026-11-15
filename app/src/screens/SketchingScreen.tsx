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

import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import SketchDeck from '../components/SketchDeck';
import { CHANNEL } from '../lib/channel';
import { deckTrace, reportDeck } from '../lib/decktrace';
import { Chip, GradientCta, Screen, Skeleton, useReducedMotion, useTabBarClearance } from '../components/ui';
import { CATEGORIES, categoryLabel } from '../lib/categories';
import { useCollections, usePlaces } from '../lib/catalog';
import { useCurrentCity } from '../lib/city';
import { cityShort } from '../lib/cityName';
import { DEFAULT_TZ, instantOn } from '../lib/clock';
import { clockOf, dateline, fmtMinutes, openState } from '../lib/format';
import { fmtDistance } from '../lib/geo';
import { planGap } from '../lib/gaps';
import { useI18n } from '../lib/i18n';
import { narratableOf, NARRATION_HOLD_MS, prefetchNarration } from '../lib/assist';
import { planTrips } from '../lib/planner';
import { legsOf } from '../lib/travel';
import { useMyLists } from '../lib/save';
import { usePlanProfile } from '../lib/tasteProfile';
import {
  DECK_HOLD_MS,
  deckSpan,
  findingFeed,
  finished,
  findingsOf,
  SKETCH_STEPS,
  fitWants,
  STEP_FLOOR_MS,
  stepStates,
} from '../lib/sketch';
import { draftFrom, type TripDraft, seedMembers } from '../lib/trip';
import { clampDay, fromISO, todayISO } from '../lib/day';
import type { Nav, RootRoute } from '../nav';
import { space } from '../theme';
import { FindingFeed, Fact, StepRow } from './sketching/parts';
import { s } from './sketching/styles';

/**
 * The facts card's own padding, named because two places need it: the
 * styles that draw it, and the arithmetic that works out how much room
 * the chips inside it have left.
 */
const CARD_PAD = 14;

export default function SketchingScreen({ navigation, route }: {
  navigation: Nav;
  route: RootRoute<'Sketching'>;
}) {
  const { t, lang } = useI18n();
  const clearance = useTabBarClearance(10);
  // For the chip row's own arithmetic — see `wantsFit`. The real width,
  // so a wider phone shows one more chip rather than the same three.
  const { width } = useWindowDimensions();
  const calm = useReducedMotion();
  const p = route.params;
  const { data: places, loading, error, reload } = usePlaces();
  // The catalog did not arrive and there is nothing cached to plan from.
  // Planning over an empty array would end on "nothing matches those
  // choices", which blames the reader's answers for a network fault and
  // sends them off to change answers that were fine. Named for what it
  // is, with the one remedy that can work: asking again.
  const failed = !loading && !!error && places.length === 0;
  const { city } = useCurrentCity();
  const mine = useMyLists();
  const cols = useCollections();
  const { taste, budgetVnd } = usePlanProfile();

  // The seed is fixed for this visit rather than read at render: a new
  // draw on every re-render would mean the plans the reader is shown are
  // not the plans this screen decided existed.
  //
  // Given by Regenerate, drawn here on a first visit. `p.seed` is the
  // whole of what Regenerate asks for beyond the avoid-list, and taking
  // it as a param rather than incrementing one held on `PlanOptions` is
  // what lets that screen keep no state of its own.
  const seed = useRef(p.seed ?? Date.now()).current;
  // Everything a previous set already offered. Absent on a first visit,
  // and growing with each Regenerate, so the next set moves rather than
  // rolling the dice again and hoping — the catalogs this plans over are
  // small enough that a fresh seed alone often redraws the same evening.
  const avoid = p.avoid;

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
    return seedMembers(p.from, [...mine.data, ...cols.data], places);
  }, [p.from, mine.data, cols.data, places]);

  // Run once the catalog is in. Cheap enough to run here and again on the
  // next screen — it is array arithmetic over a few hundred rows — and
  // running it here is what lets this screen report rather than perform.
  const plans = useMemo(
    () => (loading ? [] : planTrips(draft, places, city?.id ?? null,
      { seed, startMin: p.startMin, pinned, avoid, taste, budgetVnd, tz: city?.tz ?? DEFAULT_TZ })),
    [loading, places, city?.id, city?.tz, draft, seed, p.startMin, pinned, avoid, taste, budgetVnd],
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
    const tz = city?.tz ?? DEFAULT_TZ;
    const at = instantOn(day, startMin, tz);
    const openNow = at
      ? places.filter((pl) => openState(pl.opening_hours, at, tz)?.open).length
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
  }, [places, plans, p.date, p.startMin, city?.tz, t, lang]);

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
   * Held with a cap, not forever. `NARRATION_HOLD_MS` is the point where
   * waiting longer buys less than moving on costs: past it it finishes,
   * and in the rare case the words land later the editor's reserved lines
   * absorb them. A model that is *down* never costs the cap — `narrate`
   * fails fast and settles empty, and empty is an answer.
   */
  const [wordsReady, setWordsReady] = useState(false);
  useEffect(() => {
    if (loading) return;
    if (!plans.length) { setWordsReady(true); return; }
    // New plans are new words. The saved lists and the taste profile can
    // land after the catalog and redraw the plans mid-hold, and a hold
    // already released by the first set's words would hand over a set
    // whose words nobody has waited for.
    setWordsReady(false);
    let live = true;
    const asks = plans.map((plan) => prefetchNarration(
      narratableOf(plan.stops),
      { company: p.company, categories: p.categories, when: p.when, where: p.where },
      lang,
    ));
    void Promise.allSettled(asks).then(() => { if (live) setWordsReady(true); });
    const cap = setTimeout(() => { if (live) setWordsReady(true); }, NARRATION_HOLD_MS);
    return () => { live = false; clearTimeout(cap); };
  }, [loading, plans, p.company, p.categories, p.when, p.where, lang]);

  // Step one waits on the catalog; the last step waits on the words. The
  // steps between advance on a reading floor, because the work behind them
  // finishes in under a millisecond and claims that flash past have told
  // the reader nothing.
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (loading || failed || step >= SKETCH_STEPS.length) return;
    // Hold on the final step — drawn active, honestly — until the words
    // settle. The floor still applies after they do, so even an instant
    // answer leaves the line on screen long enough to read.
    if (step === SKETCH_STEPS.length - 1 && !wordsReady) return;
    const id = setTimeout(() => setStep((n) => n + 1), STEP_FLOOR_MS);
    return () => clearTimeout(id);
  }, [loading, failed, step, wordsReady]);

  /** The feed's two slots: this step's finding over the one before it.
   *  Both null until the second step, when the first fact exists — until
   *  then the skeleton stands. */
  const feed = findingFeed(findings, step);

  /**
   * Which plan the deck is showing, on a clock of its own.
   *
   * It used to take the stage count, so that the screen could not hand
   * over mid-deck. Sharing a clock made both of them worse: three plans
   * had to fit whatever the stages took, which on a fast catalog was
   * about a second and a half each — reported as jerky and rushed, and
   * it was both.
   *
   * They are two different things being reported and they are allowed to
   * take two different lengths of time. What keeps the deck from being
   * cut off is not a shared pace but the condition below: the screen
   * leaves when the stages are done *and* the deck has been through
   * every plan. In practice the stages are the longer of the two and the
   * gate never holds anything up; it is there for the run where they are
   * not.
   *
   * Reduce Motion holds at the first plan and reports itself done at
   * once. Content that changes itself is what that setting exists to
   * stop, and slowing the change down is not the same as not changing.
   */
  /**
   * The plans the deck walks, fixed at the first set that exists.
   *
   * `planTrips` re-runs whenever the catalog, the saved lists or the
   * taste profile land, and all three arrive asynchronously — the note on
   * the narration hold above already names it. What that costs the
   * *words* is a second wait, and it is paid there. What it cost the
   * *pictures* went unnoticed until the deck was measured, and the
   * timeline is unambiguous: a set replaced 557ms into the first option,
   * with no option change to announce it, and the set it replaced turning
   * up again two seconds later as the third of three. Four sets of
   * photographs for three plans, one of them a repeat.
   *
   * So the deck holds the set it started with. This screen lives about
   * five seconds; a list that redraws itself inside that is not new
   * information to anybody looking at it, it is the same day flickering.
   *
   * Only the deck. `done`, `empty` and what leaves for `PlanOptions` go
   * on reading `plans`, because those are about what the screen *knows*
   * rather than what it is showing, and the options screen plans again
   * from the same seed regardless.
   */
  const held = useRef<typeof plans | null>(null);
  if (held.current === null && plans.length > 0) held.current = plans;
  const deckPlans = held.current ?? plans;

  const [deck, setDeck] = useState(0);
  const lastPlan = Math.max(0, deckPlans.length - 1);
  useEffect(() => {
    if (calm || deck >= lastPlan) return;
    const id = setTimeout(() => setDeck((n) => n + 1), DECK_HOLD_MS);
    return () => clearTimeout(id);
  }, [calm, deck, lastPlan]);
  const deckDone = calm || deck >= lastPlan;

  // The timeline this visit files, and the two ends of it.
  //
  // A visit starts the clock on arrival, notes each time the deck moves
  // on, and files the row on the way out. Why any of this exists, and
  // what the six kinds of event mean, is in `lib/decktrace`; the short of
  // it is that every number in this animation was chosen rather than
  // measured, because the console it would have been measured in is on a
  // phone this side cannot see.
  useEffect(() => {
    deckTrace.start();
    reportDeck.reset();
  }, []);
  useEffect(() => {
    deckTrace.log({ option: deck, slot: null, what: 'option', place: null });
  }, [deck]);

  const states = stepStates(step);
  const done = finished(step);
  const empty = !failed && done && plans.length === 0;

  // Leaving is an effect rather than something the render does, and it
  // happens once: the screen is still mounted for the length of the
  // transition, and a catalog refresh in that window takes the plans away
  // and brings them back — which re-runs this effect and, without the
  // ref, stacked a second PlanOptions.
  const left = useRef(false);
  useEffect(() => {
    if (!done || !deckDone || !plans.length || left.current) return;
    left.current = true;
    // Filed before the replace rather than after: this screen is about to
    // stop existing, and a send scheduled for later would be racing its
    // own unmount. The insert is fire-and-forget, so it costs the
    // transition nothing — see the rules in `lib/decktrace`.
    reportDeck.report(
      deckTrace.events(),
      { options: deckPlans.length, span: deckSpan(deckPlans), still: calm },
      {
        platform: Platform.OS,
        osVersion: String(Platform.Version),
        isDev: __DEV__,
        channel: CHANNEL,
      },
    );
    navigation.replace('PlanOptions', { ...p, seed, avoid });
  }, [done, deckDone, plans.length, navigation, p, seed, avoid, calm, plans, deckPlans]);

  const day = clampDay(p.date || todayISO());
  // Date first, then the half of it, then where — company nowhere, the
  // order every trip subtitle keeps.
  //
  // Two lines rather than one, and the break is chosen rather than found.
  // Centred, at 15pt, "Thứ Sáu, 25 T9 · Ban ngày · Melbourne ·
  // Gần bạn" is wider than a phone, and the wrap landed wherever the last
  // word fell — on a real screen that was "tôi", alone on its own line
  // under four segments. An orphan reads as a layout that came out wrong.
  //
  // When on top, where beneath it: the one boundary in the string that
  // means anything. `p.where` already carries its own separator when it
  // is a city rather than a district ("Melbourne · Gần bạn"), so
  // the second line is a phrase and not a fragment.
  // The two halves of the dateline, kept apart rather than joined.
  //
  // They used to be one `summaryLine` — "Thứ Bảy, 26 T9 · Ban ngày" —
  // centred at 15pt with the whole of `p.where` on a second line under it,
  // and the note this replaces recorded what that cost: the four segments
  // are wider than a phone, so the break had to be *chosen by hand*
  // because letting it wrap left "tôi" alone on a line of its own.
  //
  // The card below needs them separate anyway, and having them separate
  // is what retires the hand-chosen break: each cell sizes itself, so
  // there is no line left to overflow.
  // One `dateline` for every day the app names (9 Oct 2026); it is the
  // short form this cell asked for, so the cell still fits it.
  const dateText = dateline(lang, fromISO(day) ?? new Date());
  const halfText = p.when === 'day' ? t('Day', 'Ban ngày', '昼', '白天', '白天') : t('Evening', 'Buổi tối', '夜', '晚上', '晚上');

  // `p.where` arrives already joined, and sometimes with a separator in
  // it: a district is "Hoàn Kiếm", a dropped pin is its own name, and the
  // default is "Melbourne · Gần bạn". Splitting on the separator
  // `summaryLine` uses gives the cell the same two ranks the date has —
  // and when there is no separator the cell simply has one line, which is
  // the honest answer rather than an invented second one.
  //
  // And `where` really can be absent, which is easy to assume it cannot:
  // a plan needs a day and a mood, not a place. `canPlan` asks for
  // `company` and at least one category and nothing else, and
  // `IdeasScreen` hands over `district ?? (origin ? whereLabel : null)`
  // where `origin` is `startPoint`. Since 26 Oct 2026 that falls back to
  // the city's centre — "Hà Nội · Trung tâm" — so it is null only when
  // there is no city at all. That plan still runs: the planner picks the
  // first stop on merit from anywhere it can.
  //
  // So the cell says that rather than disappearing. The city, and the
  // truth about how wide the search was — a reader who sees the day
  // anchored nowhere should be told it was not anchored, not left with
  // half a card and no explanation.
  const whereParts = (p.where?.trim() ?? '').split(' · ');
  const cityName = city ? cityShort(city, t) : null;
  const wherePrimary = whereParts[0] || cityName;
  const whereSecondary = whereParts[0]
    ? whereParts.slice(1).join(' · ') || null
    : t('Anywhere in the city', 'Khắp thành phố', '市内どこでも', '城市任意地点', '城市任意地點');
  // What was asked for, as the chips it was asked with.
  //
  // It was a third grey line reading "Cà phê · Ăn uống", which is the one
  // part of this summary the reader chose by tapping something that had a
  // glyph and a colour — and arrived here stripped of both. The filter
  // row, the Ideas screen and a place's own detail all draw a category as
  // its glyph in its own hue beside its name; this now says it the same
  // way, so the answer on this screen and the question on the last one
  // are recognisably the same object.
  //
  // The hue stays on the glyph and off the type, which is the table's own
  // rule — `CategoryStyle.color` is a pastel solved to be read as a mark,
  // not as words. Keys the table has never heard of are dropped rather
  // than drawn grey: a chip with no glyph among chips that have one reads
  // as a chip that failed to load.
  const wants = p.categories.filter((c) => CATEGORIES[c]);
  // As many as fit on one line, then a count.
  //
  // There is no cap on the group this comes from, and there must not be
  // one — `IdeasScreen` says why: `planner.ts` sizes the outing from how
  // many categories were named, so a limit there would quietly shorten
  // somebody's day. Nine exist. Drawn in full inside a card, six of them
  // take three rows and push the findings box off the screen.
  //
  // The rule is width rather than a number, because whether three fit is
  // a question about their labels: "Cà phê · Ăn uống · Về đêm" is 311pt
  // and fits the 318 a card leaves on a 390pt phone; "Thiên nhiên ·
  // Ngắm cảnh · Giải trí" is 376 and does not. `fitWants` does that
  // arithmetic and its note says why it estimates rather than measures.
  //
  // The width is the real one, from `useWindowDimensions`, so a wider
  // phone shows more and a narrower one shows fewer — and the page's own
  // margins and the card's padding are subtracted here rather than
  // guessed there.
  //
  // The overflow pill hides the same fact from everybody: a reader who
  // sees "+2" and a reader who hears it both know two more were chosen
  // and neither is told which. That parity is why it needs no separate
  // accessibility label.
  const wantLabels = wants.map((c) => categoryLabel(c, t));
  const wantsFit = fitWants(wantLabels, width - space.page * 2 - CARD_PAD * 2);
  const shownWants = wants.slice(0, wantsFit);
  const moreWants = wants.length - shownWants.length;

  return (
    <Screen compactTitle title={t('Plan a trip', 'Lên kế hoạch', 'プランを立てる', '规划行程', '規劃行程')}>
      <ScrollView
        contentContainerStyle={[s.body, { paddingBottom: clearance }]}
        showsVerticalScrollIndicator={false}
      >
        {/* The places going in, where the ring used to be. A ring said
            the screen was working; three covers say what it is working
            on, and the reader spends the wait looking at their day
            rather than at a spinner.
            `plans[0]` rather than a pool of candidates: it is the plan
            this screen has already decided on, so the cards cannot
            disagree with the list the next screen shows. Nothing is
            tappable and nothing here is presented as settled — the
            heading still says the day is being sketched, and the list
            below still has a step running. */}
        {/* One plan's places at a time, moving through them as the
            stages tick — so the wait shows all three ways rather than
            spoiling the first one and never mentioning the others.
            `deckPlan` reads the stage count rather than a clock of its
            own; the note on it says why. Reduce Motion holds at the
            first plan: content that changes itself is the thing that
            setting exists to stop, and slowing the change down is not
            the same as not changing. */}
        <View style={s.deckRoom}>
          <SketchDeck
            span={deckSpan(deckPlans)}
            places={deckPlans[deck]?.stops.map((st) => st.place) ?? []}
            // The plan after this one, so the deck can ask for its covers
            // while this one is still standing. See the note on `next`.
            next={deckPlans[deck + 1]?.stops.map((st) => st.place)}
            still={calm}
            option={deck}
          />
        </View>

        {/* Only the two that report something.

            This heading was four states of one line, and the other two —
            "Sketching your day…", "Sketching your evening…" — said in
            27pt bold what the screen's own header already says in the
            same weight: "Plan a trip", two lines above. The one fact they
            carried that the header does not is whether this is a day or
            an evening, and the card below now says that under the date.
            Losing them was only safe once the card existed.

            These two stay because nothing else on the screen says them. A
            failed fetch and an empty catalog are not progress, and the
            step list below can only report progress. */}
        {(failed || empty) && (
          <Text style={s.title}>
            {failed
              ? t("Couldn't load places", 'Không tải được địa điểm', '場所を読み込めませんでした', '无法加载地点', '無法載入地點')
              : t('Nothing to build a day from', 'Chưa đủ chỗ để dựng một ngày', '一日を組む材料が足りません', '没有足够的地点来安排一天', '沒有足夠的地點來安排一天')}
          </Text>
        )}

        {/* What was asked, in the order it was asked.

            `IdeasScreen` puts the mood group before "Where and when…", so
            the chips lead and the pair follows — the card reads back the
            wizard rather than reordering it.

            One card rather than three loose rows, because these are three
            answers to one set of questions and they were drawn as two
            grey sentences and a floating chip row: three ranks of
            importance for facts that have one. */}
        {/* Always drawn, because the date always exists: a trip has a day
            even when the reader named no district and the catalog knew
            none of their categories. Guarding the card on the chips hid
            the date with them. */}
        <View style={s.facts}>
          {wants.length > 0 && (
            <>
              <View style={s.factChips}>
                {shownWants.map((c) => (
                  <Chip
                    key={c}
                    label={categoryLabel(c, t)}
                    icon={CATEGORIES[c].icon}
                  />
                ))}
                {moreWants > 0 && <Chip label={`+${moreWants}`} />}
              </View>
              <View style={s.factRule} />
            </>
          )}
          <View style={s.factRow}>
            <Fact icon="calendar-outline" primary={dateText} secondary={halfText} />
            {!!wherePrimary && <View style={s.factDivide} />}
            {!!wherePrimary && (
              <Fact icon="location-outline" primary={wherePrimary} secondary={whereSecondary} />
            )}
          </View>
        </View>

        <View style={s.card}>
          {SKETCH_STEPS.map((step, i) => (
            <StepRow
              key={step.key}
              label={t(step.en, step.vi, step.ja, step.zh, step.hant)}
              state={states[i]}
              still={calm}
              last={i + 1 === SKETCH_STEPS.length}
            />
          ))}
        </View>

        {/* What a plan will look like, in the shape it arrives in. Gone
            once there is nothing coming: a skeleton is a promise that
            something is on its way, and leaving it pulsing above "nothing
            matches those choices" makes the screen argue with itself. */}
        {!empty && !failed && (
          <View style={s.preview}>
            {feed.current
              ? <FindingFeed previous={feed.previous} current={feed.current} still={calm} />
              : (
                <>
                  <Skeleton style={{ height: 12, width: '46%', borderRadius: 6 }} />
                  <Skeleton style={{ height: 12, width: '88%', borderRadius: 6 }} />
                  <Skeleton style={{ height: 12, width: '72%', borderRadius: 6 }} />
                </>
              )}
          </View>
        )}

        {failed ? (
          <>
            <Text style={s.note}>
              {t(
                'Check your connection and try again. Your answers are kept.',
                'Kiểm tra kết nối mạng rồi thử lại. Lựa chọn của bạn vẫn được giữ.',
                '接続を確認してもう一度お試しください。回答はそのまま残ります。',
                '请检查网络后重试。你的选择已保留。', '請檢查網路後重試。你的選擇已保留。',
              )}
            </Text>
            <GradientCta
              icon="refresh"
              label={t('Try again', 'Thử lại', '再試行', '重试', '重試')}
              onPress={reload}
              wide
            />
          </>
        ) : empty ? (
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
                  `这个城市在那个时段没有符合条件的地点。${categoryLabel(gap.suggestion, t)}有营业的地点 — 试试加上它。`, `這個城市在那個時段沒有符合條件的地點。${categoryLabel(gap.suggestion, t)}有營業的地點 — 試試加上它。`,
                )
                : t(
                  'Nothing in this city matches those choices for that hour. Try another day or another part of it.',
                  'Không có chỗ nào ở thành phố này khớp với lựa chọn đó vào giờ ấy. Thử ngày khác hoặc buổi khác xem.',
                  'その時間帯に条件に合う店がこの街にありません。別の日か別の時間帯をお試しください。',
                  '这个城市在那个时段没有符合条件的地点。试试换一天或换个时段。', '這個城市在那個時段沒有符合條件的地點。試試換一天或換個時段。',
                )}
            </Text>
            <GradientCta
              icon="arrow-back"
              label={t('Change the answers', 'Sửa lại lựa chọn', '回答を変える', '修改选择', '修改選擇')}
              onPress={() => navigation.goBack()}
              wide
            />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
