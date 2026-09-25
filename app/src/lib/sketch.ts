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

/**
 * A finding, ready for the feed: what was worked out, and the mark that
 * says what *kind* of fact it is — a clock for opening hours, a pin for
 * the starting stop, a walker for the first leg, a calendar for the
 * day's window.
 *
 * The icon names are Ionicons keys, the same convention `vibes.ts` and
 * `categories.ts` keep: the lib decides which mark a fact wears, because
 * that pairing is part of the fact's meaning, and the screen only draws
 * it. A test walks the list and asserts every finding carries one.
 */
export type FindingLine = { icon: string; text: string };

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
): (FindingLine | null)[] {
  const open = f.openNow > 0
    ? {
      icon: 'time-outline',
      text: t(
        `${f.openNow} places open at ${fmt.clock(f.startMin)}`,
        `${f.openNow} chỗ mở lúc ${fmt.clock(f.startMin)}`,
        `${fmt.clock(f.startMin)}に開いているのは${f.openNow}件`,
      ),
    }
    : null;

  const start = f.opening
    ? {
      icon: 'location-outline',
      text: t(`Starting at ${f.opening}`, `Bắt đầu ở ${f.opening}`, `${f.opening}から`),
    }
    : null;

  const hop = f.hop
    ? {
      icon: 'walk-outline',
      text: t(
        `${fmt.distance(f.hop.km)} to the next stop, about ${fmt.minutes(f.hop.minutes)}`,
        `${fmt.distance(f.hop.km)} tới điểm sau, khoảng ${fmt.minutes(f.hop.minutes)}`,
        `次のスポットまで${fmt.distance(f.hop.km)}、約${fmt.minutes(f.hop.minutes)}`,
      ),
    }
    : null;

  const window = f.window
    ? {
      icon: 'calendar-outline',
      text: t(
        `Your day runs ${fmt.clock(f.window[0])}–${fmt.clock(f.window[1])}`,
        `Ngày của bạn từ ${fmt.clock(f.window[0])}–${fmt.clock(f.window[1])}`,
        `${fmt.clock(f.window[0])}–${fmt.clock(f.window[1])}の一日`,
      ),
    }
    : null;

  return [null, open, start, hop, window];
}

/**
 * The feed's two slots while step `step` is running: the fact being
 * worked out now, and the one just settled above it.
 *
 * `current` is this step's finding, or the last one before it that had
 * something to say — falling forward rather than blanking, because a box
 * that empties and refills reads as something having gone wrong, not as
 * a step with nothing to add. `previous` is the settled fact before
 * *that* one, found the same way, and null while the feed holds only its
 * first line — the mockup's mid-state, one bright line standing alone.
 *
 * Two slots and never more, matching the reference: a third line would
 * be history for its own sake, and the box under the steps is a report,
 * not a transcript.
 *
 * A step past the end holds the last frame rather than clearing: the
 * screen finishes on it and hands over, and a feed that goes blank on
 * the way out is a flicker.
 */
export function findingFeed(
  findings: readonly (FindingLine | null)[], step: number,
): { previous: FindingLine | null; current: FindingLine | null } {
  let current: FindingLine | null = null;
  let previous: FindingLine | null = null;
  for (let i = Math.min(step, findings.length - 1); i >= 0; i--) {
    const line = findings[i];
    if (!line) continue;
    if (!current) { current = line; continue; }
    previous = line;
    break;
  }
  return { previous, current };
}


/**
 * How many card slots the deck holds — the longest plan, capped.
 *
 * Measured across every plan rather than per plan, because the slots have
 * to stay the same width while the places inside them change. Sized to
 * whichever plan is showing, a three-stop day followed by a two-stop one
 * would make every card jump wider on the swap.
 *
 * Generic over the plan shape: this file imports nothing, and a stop's
 * own type is the planner's business.
 */
export function deckSpan(plans: readonly { stops: readonly unknown[] }[], max = 3): number {
  return Math.min(max, plans.reduce((n, p) => Math.max(n, p.stops.length), 0));
}

/**
 * How long one plan's places stay up before the next plan's replace them.
 *
 * On its own clock, not the stages': the two are different things being
 * reported and are allowed to take different lengths of time. Tied to
 * the stages, three plans had to fit whatever the stages took, which on
 * a fast catalog was about a second and a half each — and a second and a
 * half is mostly the cards still arriving.
 *
 * 2400 leaves about 1.5 seconds of stillness after a set has finished
 * changing, which at the swap's current length is 920ms of it. It was
 * 1800 while the swap was 360ms and the stagger 80; both went up when
 * the change was reported as too quick to read, and the hold went up
 * with them so that a set still stands still for longer than it moves.
 *
 * Three plans now take 4.8 seconds against the stages' floor of 4.25, so
 * the deck is the longer of the two and the screen waits for it — by
 * about half a second, on the run where the catalog is warm. That is
 * what the gate in `SketchingScreen` is for, and it is the price of the
 * deck being legible.
 */
export const DECK_HOLD_MS = 2400;

/**
 * How many category chips fit on one line, and whether the rest need a
 * count.
 *
 * ── why this is arithmetic rather than a constant ──
 *
 * The first attempt drew three and counted the rest, and three is the
 * wrong shape of answer: whether three fit is a question about their
 * labels, not their number. Measured against the nine this app ships,
 * on the 318pt a card leaves inside a 390pt phone:
 *
 *   Cà phê · Ăn uống · Về đêm          311pt   three fit
 *   Thiên nhiên · Ngắm cảnh · Giải trí  376pt   three do not
 *
 * So the rule is width, and the caller passes the width it has.
 *
 * ── why it estimates rather than measures ──
 *
 * `onLayout` would give the true width, one frame late and one render
 * later, and under the harness these tests run in it gives nothing at
 * all — so the behaviour would ship untested. An estimate is a worse
 * number and a better rule: it is pure, it is exercised by the labels
 * this catalog actually holds, and its failure mode is the one the
 * screen already had, a row that wraps.
 *
 * The constants come off `Chip`'s own style — 14pt of padding each side,
 * a 15pt glyph, a 7pt gap, an 8pt margin — and the per-character figure
 * is the one place a measurement stands in for a font metric: 13.5pt of
 * the medium weight this app ships, which is not available to arithmetic.
 * Dynamic Type scales that text and this does not know it has, so a
 * reader at the largest sizes gets a wrapped row. That is the behaviour
 * they get everywhere else in the app, and it is honest: their words are
 * bigger and fewer of them fit.
 */
const CHIP_FIXED = 50;
const CHIP_PER_CHAR = 7.2;
const CHIP_MARGIN = 8;
const MORE_FIXED = 28;

function chipWidth(label: string): number {
  return CHIP_FIXED + CHIP_PER_CHAR * label.length + CHIP_MARGIN;
}

/**
 * The number of `labels` to draw so that they and a "+n" pill for the
 * rest stay on one line of `width` points. `labels.length` when they all
 * fit; never fewer than one, because a lone "+9" says nothing at all.
 */
export function fitWants(labels: readonly string[], width: number): number {
  if (labels.length === 0) return 0;
  const widths = labels.map(chipWidth);
  const all = widths.reduce((a, b) => a + b, 0);
  if (all <= width) return labels.length;
  for (let n = labels.length - 1; n > 1; n -= 1) {
    const shown = widths.slice(0, n).reduce((a, b) => a + b, 0);
    const more = MORE_FIXED + CHIP_PER_CHAR * `+${labels.length - n}`.length + CHIP_MARGIN;
    if (shown + more <= width) return n;
  }
  return 1;
}
