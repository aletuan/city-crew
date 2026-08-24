import { describe, expect, it } from 'vitest';
import { effectFor, gradeFor, isGoldenHour, rainDensity, windVector } from './weatherfx';
import type { Sky, WeatherCondition } from './weather';

const HERO = 400;

function sky(over: Partial<Sky> = {}): Sky {
  return {
    temp: 24,
    icon: 'sunny-outline',
    gold: true,
    condition: 'clear',
    precipitation: 0,
    windKph: 0,
    windDeg: 0,
    cloudPct: 0,
    isDay: true,
    ...over,
  };
}

describe('rainDensity', () => {
  // The floor is the whole reason this takes two arguments. A code that
  // says "rain" with a gauge reading 0.0mm is common — the hour has
  // turned over, or it rounds down — and a rain glyph above a dry
  // photograph is the failure this prevents.
  it('falls back to the condition floor when the gauge says nothing', () => {
    expect(rainDensity(0, 0.35)).toBe(0.35);
    expect(rainDensity(-1, 0.15)).toBe(0.15);
    expect(rainDensity(NaN, 0.6)).toBe(0.6);
  });

  it('never goes below the floor', () => {
    // A trace of rain under a heavy-rain code is still heavy rain.
    expect(rainDensity(0.2, 0.6)).toBe(0.6);
  });

  it('climbs with the millimetres', () => {
    const light = rainDensity(0.5, 0);
    const middling = rainDensity(4, 0);
    const heavy = rainDensity(12, 0);
    expect(light).toBeLessThan(middling);
    expect(middling).toBeLessThan(heavy);
    expect(light).toBeGreaterThan(0);
  });

  // Above a downpour it stops counting. The difference between 12mm and
  // 40mm is how wet you get, not what a photograph can show.
  it('stops at a downpour', () => {
    expect(rainDensity(12, 0)).toBeCloseTo(0.6, 5);
    expect(rainDensity(40, 0)).toBeCloseTo(0.6, 5);
    expect(rainDensity(400, 0)).toBeCloseTo(0.6, 5);
  });

  it('never covers the photograph', () => {
    for (const mm of [0, 1, 5, 12, 60, 999]) {
      expect(rainDensity(mm, 0.6)).toBeLessThanOrEqual(0.6);
    }
  });
});

describe('windVector', () => {
  // `toBeCloseTo`, not `toBe`: an easterly at zero km/h computes
  // `-1 * 0`, which is `-0`. That is still air by every arithmetic that
  // matters — and the claim being made here is "nothing drifts", not
  // "the zero has a positive sign".
  it('is still air at a standstill', () => {
    expect(windVector(0, 90, HERO).drift).toBeCloseTo(0, 10);
    expect(windVector(0, 90, HERO).angle).toBeCloseTo(0, 10);
  });

  // Meteorological convention: the bearing is where the wind comes
  // *from*. An easterly is 90 and pushes things left.
  it('reads the bearing as where the wind comes from', () => {
    expect(windVector(30, 90, HERO).drift).toBeLessThan(0);   // easterly → leftward
    expect(windVector(30, 270, HERO).drift).toBeGreaterThan(0); // westerly → rightward
  });

  it('barely moves anything on a northerly or southerly', () => {
    expect(Math.abs(windVector(40, 0, HERO).drift)).toBeLessThan(1e-9);
    expect(Math.abs(windVector(40, 180, HERO).drift)).toBeLessThan(1e-9);
  });

  it('drifts further as the wind gets up', () => {
    const breeze = Math.abs(windVector(8, 90, HERO).drift);
    const blowing = Math.abs(windVector(30, 90, HERO).drift);
    expect(breeze).toBeLessThan(blowing);
  });

  // The clamp is the design, not defensive programming: rain at a
  // believable angle stops being believable somewhere around 35°.
  it('clamps a typhoon to the same angle as a gale', () => {
    const gale = windVector(60, 90, HERO);
    const typhoon = windVector(140, 90, HERO);
    expect(typhoon.drift).toBeCloseTo(gale.drift, 10);
    expect(Math.abs(typhoon.angle)).toBeLessThan(20);
  });

  it('survives nonsense without producing NaN', () => {
    // NaN reaching an Animated interpolation takes the whole layer down
    // rather than one number.
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(Number.isFinite(windVector(bad, 90, HERO).drift)).toBe(true);
      expect(Number.isFinite(windVector(30, bad, HERO).drift)).toBe(true);
      expect(Number.isFinite(windVector(bad, bad, HERO).angle)).toBe(true);
    }
  });

  it('scales the drift with the hero it has to cross', () => {
    expect(Math.abs(windVector(30, 90, 800).drift))
      .toBeGreaterThan(Math.abs(windVector(30, 90, 400).drift));
  });

  it('points the streak along its own travel', () => {
    const w = windVector(40, 270, HERO);
    expect(w.angle).toBeGreaterThan(0);
    expect(windVector(40, 90, HERO).angle).toBeLessThan(0);
  });
});

describe('isGoldenHour', () => {
  it('is the two hours the light goes amber', () => {
    expect([5, 6, 7, 16, 17, 18].every(isGoldenHour)).toBe(true);
  });

  it('is not the middle of the day or the middle of the night', () => {
    expect([0, 4, 8, 12, 15, 19, 23].some(isGoldenHour)).toBe(false);
  });
});

describe('gradeFor', () => {
  const CONDITIONS: WeatherCondition[] = [
    'clear', 'partly-cloudy', 'cloudy', 'drizzle', 'rain',
    'heavy-rain', 'thunderstorm', 'fog', 'snow',
  ];

  it('has a wash for every condition', () => {
    for (const c of CONDITIONS) {
      const g = gradeFor(c, true, 12);
      // `rgb`, never `rgba`: a View's opacity multiplies the colour's
      // own alpha, so a tint carrying one would lay on the product of
      // two small numbers and read as nothing. See `gradeFor`.
      expect(g.tint).toMatch(/^rgb\(/);
      expect(g.opacity).toBeGreaterThan(0);
    }
  });

  // The bar the whole file is aiming at: ambient, not content. A wash
  // heavy enough to notice is a wash that has stopped being weather.
  it('never lays on enough to hide the photograph', () => {
    for (const c of CONDITIONS) {
      for (const day of [true, false]) {
        for (const hour of [3, 6, 12, 17, 22]) {
          expect(gradeFor(c, day, hour).opacity).toBeLessThanOrEqual(0.28);
        }
      }
    }
  });

  it('gets heavier as the sky does', () => {
    const order: WeatherCondition[] = ['partly-cloudy', 'cloudy', 'rain', 'heavy-rain', 'thunderstorm'];
    const opacities = order.map((c) => gradeFor(c, true, 12).opacity);
    for (let i = 1; i < opacities.length; i++) {
      expect(opacities[i]).toBeGreaterThan(opacities[i - 1]);
    }
  });

  it('drains colour from every sky that is not clear', () => {
    for (const c of CONDITIONS) {
      if (c === 'clear') continue;
      expect(gradeFor(c, true, 12).saturate).toBeLessThanOrEqual(1);
    }
    expect(gradeFor('clear', true, 12).saturate).toBeGreaterThan(1);
  });

  it('warms a clear evening', () => {
    const noon = gradeFor('clear', true, 12);
    const evening = gradeFor('clear', true, 17);
    expect(evening.tint).not.toBe(noon.tint);
    expect(evening.opacity).toBeGreaterThan(noon.opacity);
  });

  // Amber over a thunderstorm is a sunset that is not happening.
  it('does not warm a sky the sun cannot be seen through', () => {
    for (const c of ['cloudy', 'rain', 'thunderstorm', 'fog', 'snow'] as WeatherCondition[]) {
      expect(gradeFor(c, true, 17)).toEqual(gradeFor(c, true, 12));
    }
  });

  it('does not warm an hour after dark, whatever the clock says', () => {
    // 6am and dark: high latitude in winter, or simply an is_day of 0.
    expect(gradeFor('clear', false, 6)).toEqual(gradeFor('clear', false, 23));
  });

  it('deepens and cools a sky after dark', () => {
    for (const c of ['cloudy', 'rain', 'fog'] as WeatherCondition[]) {
      const day = gradeFor(c, true, 12);
      const night = gradeFor(c, false, 22);
      expect(night.opacity).toBeGreaterThan(day.opacity);
      expect(night.saturate).toBeLessThan(day.saturate);
    }
  });

  // A clear night's effect is the photograph's own darkness. Laying a
  // blue wash over it as well would be saying the same thing twice.
  it('leaves a clear night alone', () => {
    expect(gradeFor('clear', false, 22)).toEqual(gradeFor('clear', true, 12));
  });
});

describe('effectFor', () => {
  it('rains only when something is falling', () => {
    for (const c of ['drizzle', 'rain', 'heavy-rain', 'thunderstorm'] as WeatherCondition[]) {
      expect(effectFor(sky({ condition: c }), 12, HERO).rain).not.toBeNull();
    }
    for (const c of ['clear', 'partly-cloudy', 'cloudy', 'fog', 'snow'] as WeatherCondition[]) {
      expect(effectFor(sky({ condition: c }), 12, HERO).rain).toBeNull();
    }
  });

  it('snows only in snow', () => {
    expect(effectFor(sky({ condition: 'snow' }), 12, HERO).snow).not.toBeNull();
    expect(effectFor(sky({ condition: 'rain' }), 12, HERO).snow).toBeNull();
  });

  it('rains harder as the gauge climbs', () => {
    const light = effectFor(sky({ condition: 'rain', precipitation: 0.2 }), 12, HERO);
    const hard = effectFor(sky({ condition: 'rain', precipitation: 10 }), 12, HERO);
    expect(hard.rain!.density).toBeGreaterThan(light.rain!.density);
  });

  it('is full fog in fog and a haze under a heavy sky', () => {
    expect(effectFor(sky({ condition: 'fog' }), 12, HERO).fog).toBe(1);
    const overcast = effectFor(sky({ condition: 'cloudy', cloudPct: 100 }), 12, HERO).fog;
    const clear = effectFor(sky({ condition: 'clear', cloudPct: 0 }), 12, HERO).fog;
    expect(overcast).toBeGreaterThan(clear);
    // An overcast afternoon is not foggy — it just has less air between
    // you and the far buildings.
    expect(overcast).toBeLessThan(0.3);
  });

  it('ignores a cloud reading that cannot be true', () => {
    expect(effectFor(sky({ condition: 'cloudy', cloudPct: 400 }), 12, HERO).fog)
      .toBe(effectFor(sky({ condition: 'cloudy', cloudPct: 100 }), 12, HERO).fog);
    expect(effectFor(sky({ condition: 'cloudy', cloudPct: -20 }), 12, HERO).fog).toBe(0);
  });

  it('glows on a clear day and never at night', () => {
    expect(effectFor(sky({ condition: 'clear', isDay: true }), 12, HERO).glow).toBe(1);
    expect(effectFor(sky({ condition: 'clear', isDay: false }), 22, HERO).glow).toBe(0);
    expect(effectFor(sky({ condition: 'partly-cloudy', isDay: true }), 12, HERO).glow).toBe(0.5);
    expect(effectFor(sky({ condition: 'rain', isDay: true }), 12, HERO).glow).toBe(0);
  });

  // Mist and motes under rain would be two systems saying "there is
  // weather" at once, and the rain says it better.
  it('drifts only when nothing else is falling', () => {
    const windy = { windKph: 40, windDeg: 90 };
    expect(effectFor(sky({ condition: 'clear', ...windy }), 12, HERO).drift).toBeGreaterThan(0);
    expect(effectFor(sky({ condition: 'rain', ...windy }), 12, HERO).drift).toBe(0);
    expect(effectFor(sky({ condition: 'snow', ...windy }), 12, HERO).drift).toBe(0);
  });

  it('does not drift on a still day', () => {
    expect(effectFor(sky({ condition: 'clear', windKph: 0 }), 12, HERO).drift).toBe(0);
  });

  it('caps the drift however hard it blows', () => {
    expect(effectFor(sky({ condition: 'clear', windKph: 200, windDeg: 90 }), 12, HERO).drift)
      .toBeLessThanOrEqual(1);
  });

  it('flashes only in a thunderstorm', () => {
    expect(effectFor(sky({ condition: 'thunderstorm' }), 12, HERO).lightning).toBe(true);
    expect(effectFor(sky({ condition: 'heavy-rain' }), 12, HERO).lightning).toBe(false);
  });

  it('carries the wind and the grade through', () => {
    const e = effectFor(sky({ condition: 'rain', windKph: 30, windDeg: 270 }), 17, HERO);
    expect(e.wind.drift).toBeGreaterThan(0);
    expect(e.grade).toEqual(gradeFor('rain', true, 17));
  });

  // The clock is the caller's; this is arithmetic. Passing the hour is
  // what makes the golden-hour branch testable without faking time.
  it('takes the hour as an argument rather than reading one', () => {
    expect(effectFor(sky({ condition: 'clear' }), 17, HERO).grade)
      .not.toEqual(effectFor(sky({ condition: 'clear' }), 12, HERO).grade);
  });
});
