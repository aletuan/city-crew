// What the "sketching your day" screen is doing, as plain data.
//
// Here rather than in the screen for the reason `place.ts` is: a Node
// process can reach it. What is worth getting right on that screen is not
// the animation — no test can see an animation — but the sequence: which
// step is running at a given moment, when the run is over, and what the
// summary line says about the answers the reader gave. All three are
// arithmetic over data, and all three are wrong in ways nobody notices by
// looking.
//
// ── on the timings being fiction ──
//
// There is no agent yet. `SKETCH_STEPS` runs on a clock rather than on
// work, and that is a stopgap with a real cost: a progress display that
// is not measuring anything will eventually lie, because the work will
// take longer or shorter than the fiction. The one thing it must not do
// is *finish* on its own and hand back a plan that does not exist — see
// `finishedAt`, which is where the screen stops rather than pretends.

export type StepState = 'done' | 'active' | 'pending';

export type Step = {
  key: string;
  /** How long this step appears to take, in ms. */
  ms: number;
  en: string;
  vi: string;
  ja: string;
};

/**
 * The four things the screen claims to be doing.
 *
 * Written as things the reader would recognise having asked for, not as
 * machine stages: "Reading your picks" is their collections, "Balancing
 * dinner → views → drinks" is the categories they chose in the order a day
 * runs. A progress list nobody can map back to their own input is a
 * spinner with extra words.
 */
export const SKETCH_STEPS: readonly Step[] = [
  {
    key: 'picks', ms: 1400,
    en: 'Reading your picks', vi: 'Đọc lựa chọn của bạn', ja: 'あなたの好みを読み取り中',
  },
  {
    key: 'find', ms: 2600,
    en: 'Finding places open then', vi: 'Tìm chỗ mở cửa lúc đó', ja: 'その時間に開いている店を検索',
  },
  {
    key: 'balance', ms: 2400,
    en: 'Balancing the order of the day', vi: 'Cân đối thứ tự trong ngày', ja: '一日の流れを調整',
  },
  {
    key: 'walk', ms: 2000,
    en: 'Timing the walks between stops', vi: 'Tính thời gian đi bộ giữa các điểm',
    ja: '各スポット間の移動時間を計算',
  },
];

/** When each step ends, in ms from the start. */
export function stepEnds(steps: readonly Step[] = SKETCH_STEPS): number[] {
  const out: number[] = [];
  let at = 0;
  for (const s of steps) { at += s.ms; out.push(at); }
  return out;
}

/** How long the whole run appears to take. */
export function totalMs(steps: readonly Step[] = SKETCH_STEPS): number {
  return stepEnds(steps)[steps.length - 1] ?? 0;
}

/**
 * Where each step stands at `elapsed` ms.
 *
 * Exactly one step is `active` until the run ends, after which every step
 * is `done` and none is active — a list with a spinner still turning on it
 * after the work stopped is the bug this shape exists to make impossible.
 *
 * A step whose end has been reached is done, not active: the boundary
 * belongs to the step that follows, so `elapsed === ends[0]` shows the
 * second step working rather than the first still going.
 */
export function stepStates(elapsed: number, steps: readonly Step[] = SKETCH_STEPS): StepState[] {
  const ends = stepEnds(steps);
  // No clamp on a negative clock: every end is positive, so a negative
  // `elapsed` already fails every comparison below and lands on the same
  // first-step-active state that zero does. A `Math.max` here read as
  // defensive and was provably unobservable — a mutation removing it
  // could not be made to fail a test, which is the definition of code
  // that is not doing anything.
  const at = elapsed;
  return steps.map((_, i) => {
    if (at >= ends[i]) return 'done';
    if (i === 0 || at >= ends[i - 1]) return 'active';
    return 'pending';
  });
}

/** True once every step has finished. */
export function finished(elapsed: number, steps: readonly Step[] = SKETCH_STEPS): boolean {
  return elapsed >= totalMs(steps);
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
