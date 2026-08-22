// What the "sketching your day" screen is doing, as plain data.
//
// Here rather than in the screen for the reason `place.ts` is: a Node
// process can reach it. What is worth getting right on that screen is not
// the animation — no test can see an animation — but the sequence: which
// step is running, when the run is over, and what the summary line says
// about the answers the reader gave. All three are arithmetic over data,
// and all three are wrong in ways nobody notices by looking.
//
// ── on the steps having stopped being fiction ──
//
// These used to run on a clock. Each step carried an `ms` and the screen
// read a stopwatch, because there was no planner to report on and the
// header said so: "There is no agent yet." There is one now — `planner.ts`
// — and the note that shipped with the fiction said what should happen
// when it arrived: the steps stop being a timer and start being reports.
// That is this file.
//
// So a step is done because the work behind it is done, and `stepStates`
// takes a count of completed stages rather than a stopwatch reading. The
// screen can no longer show a finished list in front of a plan that does
// not exist, which is the failure the old shape had to be careful about.
//
// ── on there still being a floor ──
//
// The work is arithmetic over an array the app already holds, so it
// finishes in well under a millisecond. `STEP_FLOOR_MS` is not a claim
// about how long anything takes: it is how long a line has to be on
// screen to be read. Four claims that flash past have told the reader
// nothing, and the screen would be a flicker between two others.
//
// The one thing that genuinely waits is the catalog. `CatalogProvider`
// may still be fetching when this screen opens, and step one does not
// complete until it has — which is a real report, on the one part of this
// that is really slow.

export type StepState = 'done' | 'active' | 'pending';

export type Step = {
  key: string;
  en: string;
  vi: string;
  ja: string;
};

/**
 * The four things the screen is doing, in the order it does them.
 *
 * Written as things the reader would recognise having asked for, not as
 * machine stages: "Reading your picks" is their collections, "Balancing
 * the order of the day" is the categories they chose in the order a day
 * runs. A progress list nobody can map back to their own input is a
 * spinner with extra words.
 *
 * They map onto real passes in `planner.ts` — the pool filter, the
 * opening-hours check, the scoring and draw, and the legs between stops —
 * which is what lets the screen report rather than perform.
 */
export const SKETCH_STEPS: readonly Step[] = [
  {
    key: 'picks',
    en: 'Reading your picks', vi: 'Đọc lựa chọn của bạn', ja: 'あなたの好みを読み取り中',
  },
  {
    key: 'find',
    en: 'Finding places open then', vi: 'Tìm chỗ mở cửa lúc đó', ja: 'その時間に開いている店を検索',
  },
  {
    key: 'balance',
    en: 'Balancing the order of the day', vi: 'Cân đối thứ tự trong ngày', ja: '一日の流れを調整',
  },
  {
    key: 'walk',
    en: 'Timing the walks between stops', vi: 'Tính thời gian đi bộ giữa các điểm',
    ja: '各スポット間の移動時間を計算',
  },
  // The one step that reports something genuinely slow besides the
  // catalog: the model writing its line for each stop. The screen holds
  // here until the words land (or its own cap says stop waiting), which is
  // what lets the editor open finished instead of rewriting itself — see
  // `SketchingScreen`. Everything above still finishes in a millisecond;
  // this is the step that earns the orb.
  //
  // ── the one line that names the wait instead of describing the work ──
  //
  // It has been three things. "Writing a line for each stop" was exactly
  // what happens and still the wrong sentence: the four rows above
  // describe work the reader recognises asking for and are finished
  // before they are read, while this one is the only place in the app
  // where somebody is genuinely kept waiting. Then "Almost there…",
  // which answered *how much longer* and said nothing about what for.
  //
  // This says both. "Finalizing" is a verb in progress, which is honest
  // here and nowhere else on this list — the model really is still
  // writing — and "your itinerary" is what keeps it from being the empty
  // word a progress bar uses. Bare "Finalizing" would be the Google
  // Flights register the top of this file exists to argue against; naming
  // the object is what makes it a report.
  //
  // No ellipsis. The `-ing` already says it is running, and the row is
  // the only one drawn with a turning arc besides.
  {
    key: 'words',
    en: 'Finalizing your itinerary', vi: 'Đang hoàn thiện lịch trình của bạn',
    ja: '旅程を仕上げています',
  },
];

/**
 * How long a step stays on screen before the next one starts, in ms.
 *
 * A reading speed, not a work estimate. Four of the five finish in under
 * a millisecond; what this paces is the eye, not the arithmetic. The old
 * clock-driven version made the reader wait 8.4 seconds for a screen that
 * measured nothing, and this is what replaced it.
 *
 * ── why it doubled when the findings arrived ──
 *
 * It was 420, which is about right for reading three words on a row. Each
 * row now carries a sentence underneath it — "6.2 km to the next stop,
 * about 20 min" — and 420ms is not long enough to read a sentence. The
 * findings would have flashed past unread, which is worse than not
 * showing them: it is motion in the corner of the eye with no payload.
 *
 * It costs almost nothing in practice, because the screen's length is set
 * by the model rather than by this. A healthy narration takes three to
 * eight seconds and the last step holds for it regardless; four steps at
 * 850ms is 3.4s, which lands inside that wait rather than after it. The
 * only case that gets slower is a model that answers in under three
 * seconds, and that case was never the complaint.
 */
export const STEP_FLOOR_MS = 850;

/**
 * Where each step stands when `done` of them have finished.
 *
 * Exactly one step is `active` until every one is done, after which none
 * is — a list with a spinner still turning after the work stopped is the
 * bug this shape exists to make impossible.
 *
 * Counts outside the list are clamped rather than refused. A caller that
 * has finished more stages than there are steps is not an error worth
 * throwing over; it is a list with nothing left to show as running.
 */
export function stepStates(done: number, steps: readonly Step[] = SKETCH_STEPS): StepState[] {
  const at = Math.max(0, Math.min(steps.length, Math.floor(done)));
  return steps.map((_, i) => {
    if (i < at) return 'done';
    if (i === at) return 'active';
    return 'pending';
  });
}

/** True once every step has finished. */
export function finished(done: number, steps: readonly Step[] = SKETCH_STEPS): boolean {
  return done >= steps.length;
}

/**
 * The line under the title: what the reader actually asked for.
 *
 * Empty parts are dropped rather than printed as gaps, because a draft is
 * allowed to be half-answered — only company and one category are
 * required to reach this screen at all. Nothing here is invented: if the
 * reader said nothing about where, the line says nothing about where.
 */
export function summaryLine(parts: readonly (string | null | undefined)[]): string {
  return parts.map((p) => p?.trim()).filter((p): p is string => !!p).join(' · ');
}

/**
 * "3 stops", "1 stop".
 *
 * Three screens print this figure and all three printed "1 stops", which is
 * the kind of thing nobody sees until a reader deletes their way down to one
 * — and then it is the only sentence on the card. A helper rather than the
 * same ternary three times, because the fourth screen to want it would get
 * it wrong again.
 *
 * Only English inflects here. Vietnamese "điểm" and Japanese "スポット" take
 * no plural, and forcing them through a singular/plural pair would be an
 * English grammar rule wearing their vocabulary.
 */
export function stopCount(n: number, t: (en: string, vi: string, ja?: string) => string): string {
  return `${n} ${n === 1 ? t('stop', 'điểm', 'スポット') : t('stops', 'điểm', 'スポット')}`;
}

// ── what the box under the steps says ─────────────────────────────────
//
// The box was a `Skeleton`: three grey bars standing in for "a plan is
// coming". An honest placeholder, and an empty one — it said nothing
// about the day being built.
//
// ── why this is not a ticker ──
//
// The obvious fill is a rotating status line: "Scanning 85 places…",
// "Comparing distances…". That is the pattern Google Flights uses for
// "Scanning 300 airlines", and it is exactly the fiction the top of this
// file describes removing. Four of the five steps finish in under a
// millisecond; there is no scanning to report on, and a sentence claiming
// otherwise would be a stopwatch wearing a verb.
//
// Perplexity and the reasoning summaries in chat assistants can show
// intermediate state because there genuinely is a stream — the model is
// searching and thinking while you watch. This screen has no stream. By
// the time it is waiting, `planTrips` has already returned: every stop,
// hour, distance and price is known, and the only thing outstanding is
// the model's prose.
//
// So the box reports **findings, not activity**. Each line is a true
// consequence of the step above it — a fact about the plan that already
// exists, phrased as a fact rather than as an action in progress. The
// wait becomes useful for the right reason: the answer has started
// arriving, not because something is blinking.
//
// Each finding appears once, in sequence, and is replaced by the next.
// Nothing loops. A line that comes back round is the tell of a progress
// bar with nothing behind it.

/** Everything the box can say, measured from the plan that already
 *  exists. Nulls are honest: a catalog that could not be read, a day with
 *  one stop and therefore no journey. */
export type Findings = {
  /** How many of the city's places are open at the hour the day starts,
   *  and that hour. */
  openNow: number;
  startMin: number;
  /** The opening stop's name. */
  opening: string | null;
  /** The first journey of the day. */
  hop: { km: number; minutes: number } | null;
  /** When the outing runs, minutes past midnight. */
  window: [number, number] | null;
};

/**
 * One line per step, or null where that step has nothing true to add.
 *
 * Index-aligned with `SKETCH_STEPS`, so the box under the list is always
 * talking about the row above it — the same pointing relationship the
 * trip screen's gallery has with its itinerary.
 *
 * The first step gets nothing on purpose. "Reading your picks" is
 * answered by the summary line already printed above the card, and
 * repeating the reader's own answers back at them is not a finding.
 *
 * Takes `t` rather than a language code because two of these lines are
 * sentences rather than data, and the app's other three-language helpers
 * take it too.
 */
export function findingsOf(
  f: Findings,
  t: (en: string, vi: string, ja?: string) => string,
  fmt: {
    clock: (min: number) => string;
    distance: (km: number) => string;
    minutes: (n: number) => string;
  },
): (string | null)[] {
  const open = f.openNow > 0
    ? t(
      `${f.openNow} places open at ${fmt.clock(f.startMin)}`,
      `${f.openNow} chỗ mở lúc ${fmt.clock(f.startMin)}`,
      `${fmt.clock(f.startMin)}に開いているのは${f.openNow}件`,
    )
    : null;

  const start = f.opening
    ? t(`Starting at ${f.opening}`, `Bắt đầu ở ${f.opening}`, `${f.opening}から`)
    : null;

  const hop = f.hop
    ? t(
      `${fmt.distance(f.hop.km)} to the next stop, about ${fmt.minutes(f.hop.minutes)}`,
      `${fmt.distance(f.hop.km)} tới điểm sau, khoảng ${fmt.minutes(f.hop.minutes)}`,
      `次のスポットまで${fmt.distance(f.hop.km)}、約${fmt.minutes(f.hop.minutes)}`,
    )
    : null;

  const window = f.window
    ? t(
      `Your day runs ${fmt.clock(f.window[0])}–${fmt.clock(f.window[1])}`,
      `Ngày của bạn từ ${fmt.clock(f.window[0])}–${fmt.clock(f.window[1])}`,
      `${fmt.clock(f.window[0])}–${fmt.clock(f.window[1])}の一日`,
    )
    : null;

  return [null, open, start, hop, window];
}

/**
 * The line to show while step `step` is running: that step's finding, or
 * the last one before it that had something to say.
 *
 * Falling forward rather than blanking, because the alternative is a box
 * that empties and refills — and an element that disappears reads as
 * something having gone wrong, not as a step having nothing to add. The
 * first step has no finding by design, so this returns null there and the
 * screen keeps its skeleton until there is a fact to replace it with.
 *
 * A step past the end holds the last line rather than clearing: the
 * screen finishes on that frame and hands over, and a box that goes blank
 * on the way out is a flicker.
 */
export function latestFinding(findings: readonly (string | null)[], step: number): string | null {
  for (let i = Math.min(step, findings.length - 1); i >= 0; i--) {
    if (findings[i]) return findings[i];
  }
  return null;
}
