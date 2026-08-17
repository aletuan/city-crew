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
];

/**
 * How long a step stays on screen before the next one starts, in ms.
 *
 * A reading speed, not a work estimate. Short enough that four of them
 * plus the catalog fetch is under two seconds — the old clock-driven
 * version made the reader wait 8.4 seconds for a screen that measured
 * nothing.
 */
export const STEP_FLOOR_MS = 420;

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
