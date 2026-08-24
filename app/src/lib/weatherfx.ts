// What the weather does to a photograph, as numbers.
//
// Every value a designer will want to argue about lives here rather than
// in the components that draw them, and the reason is the coverage gate:
// `src/lib/*.ts` is held at 100%, so tuning that lands in this file
// arrives with a test saying what it is supposed to be. Tuning that lands
// in a component arrives with nothing. That is the whole argument for the
// split — the same one `place.ts` makes at the top of itself.
//
// ── the bar these numbers are aiming at ──
//
// Ambient, not content. If the animation is the first thing seen — before
// the photograph, before the headline — it is too strong, and the fix is
// always a smaller number here rather than a cleverer component.
//
// Which is why almost everything below is clamped. A typhoon is 120 km/h
// and a monsoon afternoon is 40mm of rain, and neither should look like a
// disaster film over a picture of a café. The clamps are not defensive
// programming; they are the design.

import type { Sky, WeatherCondition } from './weather';

/** How hard it is raining, 0–1, as the drop layers read it. */
export type Rain = {
  /** Drives which drops are switched on. See `RainSystem`. */
  density: number;
  /** Streak length in points at the middle depth; the layers scale it. */
  length: number;
};

export type Effect = {
  rain: Rain | null;
  snow: { density: number } | null;
  /** 0–1. Fog, and the haze a heavy sky carries even without it. */
  fog: number;
  /** 0–1. The warm bloom on a clear day. */
  glow: number;
  /** Slow motes and mist, for wind with nothing falling in it. */
  drift: number;
  lightning: boolean;
  grade: Grade;
  wind: Wind;
};

export type Grade = {
  /** The wash laid over the photograph. */
  tint: string;
  /** How much of it, 0–1. */
  opacity: number;
  /** For `filter: [{ saturate }]` where the platform honours it. 1 is
   *  untouched. The one grade a tint cannot fake, and the one that is
   *  dropped rather than faked badly if a device will not do it. */
  saturate: number;
};

/**
 * The furthest a drop is ever pushed sideways, as a fraction of the
 * hero's height.
 *
 * Exported because `Rain` has to map the same cap onto a rotation, and
 * two copies of this number would let the streaks point somewhere the
 * drops are not going — a discrepancy nobody would name and everybody
 * would feel.
 */
export const MAX_DRIFT = 0.34;

/** The angle that cap corresponds to, in degrees. About 19°. */
export const MAX_ANGLE = (Math.atan(MAX_DRIFT) * 180) / Math.PI;

export type Wind = {
  /** Points of horizontal travel over the hero's full height. Signed:
   *  negative blows left. */
  drift: number;
  /** Degrees to rotate a streak so it points along its own travel. */
  angle: number;
};

// ── rain ──

/**
 * Millimetres in the last hour → how much of the pool is switched on.
 *
 * The bands are the brief's: drizzle around 0.15, ordinary rain 0.35,
 * heavy 0.60. What the brief did not say is where the millimetres sit,
 * so: 0.5mm/h is a drizzle you would not open an umbrella for, 4mm/h is
 * proper rain, and 12mm/h is the wall of water a Hanoi afternoon
 * actually produces. Above that it stops counting, because the
 * difference between 12mm and 40mm is a difference in how wet you get,
 * not in what a photograph can show.
 *
 * The floor matters as much as the ceiling. A code that says "rain" with
 * a reading of 0.0mm is common — the hour has turned over, or the gauge
 * rounds down — and drawing nothing there would leave a rain glyph above
 * a dry picture. So the condition sets a floor and the millimetres can
 * only raise it.
 */
export function rainDensity(mm: number, floor: number): number {
  if (!Number.isFinite(mm) || mm <= 0) return floor;
  // 0 → 0, 0.5 → ~0.15, 4 → ~0.38, 12 → 0.6, and flat after that.
  const scaled = Math.min(0.6, 0.6 * Math.sqrt(Math.min(mm, 12) / 12));
  return Math.max(floor, scaled);
}

// ── wind ──

/**
 * Speed and bearing → the drift a drop takes and the angle it wears.
 *
 * `windDeg` is meteorological: the direction the wind blows **from**. A
 * northerly is 0 and moves things south; an easterly is 90 and moves
 * things west. The horizontal component of travel is therefore
 * `-sin(deg)` — negative for an easterly, which is leftward on screen.
 *
 * Clamped hard, and this is the number most likely to be turned up by
 * somebody who has not seen it on a device. At 40 km/h the drift is
 * already most of what it will ever be; the last stretch to 120 buys
 * almost nothing, because rain at a believable angle stops being
 * believable somewhere around 35°. Wind you can feel beats wind you can
 * measure.
 */
export function windVector(kph: number, deg: number, height: number): Wind {
  const speed = Number.isFinite(kph) ? Math.max(0, Math.min(kph, 60)) : 0;
  const bearing = Number.isFinite(deg) ? deg : 0;
  // 0 at a standstill, 1 at 60 km/h, easing off through the middle so a
  // breeze reads as a breeze rather than as half a gale.
  const strength = Math.sqrt(speed / 60);
  const across = -Math.sin((bearing * Math.PI) / 180);
  // A third of the hero's height at the very top of the range, which is
  // about 18° on a 400pt hero. Enough to read as slanting rain; not
  // enough to read as a special effect.
  const drift = across * strength * height * MAX_DRIFT;
  return { drift, angle: (Math.atan2(drift, height) * 180) / Math.PI };
}

// ── colour ──

/**
 * The hours a photograph goes warm.
 *
 * Not a sun-position calculation. The app knows the city's latitude and
 * could compute a real solar elevation, and the answer would be more
 * correct and no more useful: this decides whether to add a few percent
 * of amber, and no reader has ever been able to tell whether golden hour
 * started at 17:04 or 17:20. Two windows, wide enough to be right most
 * of the year in the tropics, which is where every city in this app is.
 */
export function isGoldenHour(hour: number): boolean {
  return (hour >= 5 && hour < 8) || (hour >= 16 && hour < 19);
}

const GRADES: Record<WeatherCondition, Grade> = {
  // Warm, and barely there. The brief's +3% brightness and +4% saturation
  // become a thin amber wash, because a `View` can only add light, never
  // subtract it — and adding warm light is what a clear day does anyway.
  clear: { tint: 'rgb(255,214,170)', opacity: 0.05, saturate: 1.04 },
  'partly-cloudy': { tint: 'rgb(150,160,175)', opacity: 0.04, saturate: 0.98 },
  cloudy: { tint: 'rgb(96,104,116)', opacity: 0.10, saturate: 0.92 },
  // Fog lifts brightness while it kills contrast, which is the one grade
  // here that goes lighter rather than darker: a white veil.
  fog: { tint: 'rgb(226,228,230)', opacity: 0.16, saturate: 0.88 },
  drizzle: { tint: 'rgb(84,96,112)', opacity: 0.10, saturate: 0.94 },
  rain: { tint: 'rgb(72,84,102)', opacity: 0.14, saturate: 0.90 },
  'heavy-rain': { tint: 'rgb(58,70,90)', opacity: 0.19, saturate: 0.88 },
  thunderstorm: { tint: 'rgb(44,52,72)', opacity: 0.24, saturate: 0.86 },
  snow: { tint: 'rgb(206,216,232)', opacity: 0.12, saturate: 0.90 },
};

/** The amber a golden hour adds, and the blue a night takes. */
const GOLDEN: Grade = { tint: 'rgb(255,176,102)', opacity: 0.10, saturate: 1.02 };
const NIGHT: Grade = { tint: 'rgb(30,38,66)', opacity: 0.10, saturate: 0.94 };

/**
 * The wash for a sky at an hour.
 *
 * Golden hour only counts under a sky you could see the sun through —
 * amber over a thunderstorm is a sunset that is not happening. Night
 * only deepens what is already there, and never on a clear night, where
 * the photograph's own darkness is the effect.
 *
 * The tints are `rgb`, with no alpha of their own, and that is load
 * bearing rather than tidy: a View's `opacity` *multiplies* whatever
 * alpha its `backgroundColor` already carries, so a tint written
 * `rgba(…, 0.05)` under an opacity of 0.05 lays on 0.0025 of colour and
 * reads as nothing at all. One dial, named `opacity`, and one animated
 * value can then cross-fade two grades without the component knowing
 * what either of them is.
 */
export function gradeFor(condition: WeatherCondition, isDay: boolean, hour: number): Grade {
  if (isDay && isGoldenHour(hour) && (condition === 'clear' || condition === 'partly-cloudy')) {
    return GOLDEN;
  }
  const base = GRADES[condition];
  if (isDay || condition === 'clear') return base;
  // Deeper and cooler after dark, but never past the point where the
  // photograph stops being visible under it.
  return {
    tint: NIGHT.tint,
    opacity: Math.min(0.28, base.opacity + NIGHT.opacity),
    saturate: base.saturate * NIGHT.saturate,
  };
}

// ── the whole thing ──

/** The conditions with something falling in them. */
type Wet = 'drizzle' | 'rain' | 'heavy-rain' | 'thunderstorm';

/**
 * Rain floors by condition, so a wet code with a dry gauge still rains.
 * See `rainDensity`.
 *
 * A total `Record` over `Wet` rather than a `Partial` over every
 * condition, and `isWet` reads its keys rather than repeating them. The
 * partial version needed a `?? 0.35` fallback for a case the guard above
 * it had already made impossible — an unreachable branch, which the
 * coverage gate is right to refuse. One list, and the type carries it.
 */
const FLOOR: Record<Wet, number> = {
  drizzle: 0.15,
  rain: 0.35,
  'heavy-rain': 0.60,
  thunderstorm: 0.55,
};

const isWet = (c: WeatherCondition): c is Wet => c in FLOOR;

/**
 * Everything the hero needs to draw, from one reading.
 *
 * `hour` is passed rather than read, so this stays a pure function of
 * its arguments and the golden-hour branch is testable without faking a
 * clock. The caller has a clock; this has arithmetic.
 *
 * Cloud cover only reaches the fog term. It is tempting to let it drive
 * the grade too — 100% cover really is darker than 20% — but the
 * condition already encodes that, and two inputs moving the same output
 * is how a dial ends up doing nothing at one end of its travel.
 */
export function effectFor(sky: Sky, hour: number, height: number): Effect {
  const c = sky.condition;
  const wet = isWet(c);
  const cloud = Math.max(0, Math.min(sky.cloudPct, 100)) / 100;
  const wind = windVector(sky.windKph, sky.windDeg, height);

  return {
    rain: isWet(c) ? { density: rainDensity(sky.precipitation, FLOOR[c]), length: 15 } : null,
    snow: c === 'snow' ? { density: 0.3 } : null,
    // Fog is its own condition and also the haze a heavy sky carries.
    // The second term is small on purpose: an overcast afternoon is not
    // foggy, it just has less air between you and the far buildings.
    fog: c === 'fog' ? 1 : cloud * 0.22,
    glow: c === 'clear' && sky.isDay ? 1 : c === 'partly-cloudy' && sky.isDay ? 0.5 : 0,
    // Only when nothing else is moving. Mist and motes under rain would
    // be two systems saying "there is weather" at once, and the rain is
    // the one that says it better.
    drift: !wet && c !== 'snow' ? Math.min(1, Math.abs(wind.drift) / (height * 0.12)) : 0,
    lightning: c === 'thunderstorm',
    grade: gradeFor(c, sky.isDay, hour),
    wind,
  };
}
