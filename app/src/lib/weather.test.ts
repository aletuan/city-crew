import { describe, expect, it } from 'vitest';
import { conditionOf, isClear, parseSky, skyIcon, skyUrl } from './weather';

/** What the four later fields read as when the response does not carry
 *  them, which every fixture below is testing around rather than for. */
const still = { precipitation: 0, windKph: 0, windDeg: 0, cloudPct: 0 };

describe('skyIcon', () => {
  // The one place day and night differ. A sun at ten at night is the
  // detail that makes everything around it look unconsidered.
  it('swaps the sun for a moon after dark', () => {
    expect(skyIcon(0, true)).toBe('sunny-outline');
    expect(skyIcon(0, false)).toBe('moon-outline');
    expect(skyIcon(2, true)).toBe('partly-sunny-outline');
    expect(skyIcon(2, false)).toBe('cloudy-night-outline');
  });

  // Overcast is overcast at midnight too.
  it('does not vary the codes where night makes no difference', () => {
    for (const code of [3, 45, 61, 71, 95]) {
      expect(skyIcon(code, true)).toBe(skyIcon(code, false));
    }
  });

  it('reads the WMO bands', () => {
    expect(skyIcon(3, true)).toBe('cloud-outline');
    expect(skyIcon(48, true)).toBe('reorder-two-outline');
    expect(skyIcon(95, true)).toBe('thunderstorm-outline');
    expect(skyIcon(99, true)).toBe('thunderstorm-outline');
  });

  // Ionicons has one rain glyph. Drizzle, rain and showers all land on
  // it rather than the table pretending to a precision it cannot draw.
  it('sends every wet code to the same glyph', () => {
    for (const code of [51, 55, 61, 65, 67, 80, 82]) {
      expect(skyIcon(code, true)).toBe('rainy-outline');
    }
  });

  it('sends every frozen code to the same glyph', () => {
    for (const code of [71, 75, 77, 85, 86]) {
      expect(skyIcon(code, true)).toBe('snow-outline');
    }
  });

  // The number is the part we are unsure of, not the weather.
  it('gives an unknown code a sky rather than a hole', () => {
    expect(skyIcon(7, true)).toBe('partly-sunny-outline');
    expect(skyIcon(-1, true)).toBe('partly-sunny-outline');
  });
});

describe('parseSky', () => {
  const ok = { current: { temperature_2m: 31.7, weather_code: 0, is_day: 1 } };

  // `num` takes numeric strings because the API has been seen sending
  // them, but a string that is not a number is not a temperature. It must
  // not become NaN and render as "NaN°".
  // The other half of the same guard: the API has been seen sending the
  // temperature as a string, and a numeric one is a temperature.
  it('accepts a numeric string', () => {
    expect(parseSky({ current: { temperature_2m: '31.7', weather_code: '0', is_day: 1 } }))
      .toEqual({ temp: 32, icon: 'sunny-outline', gold: true, condition: 'clear', isDay: true, ...still });
  });

  it('refuses a string that is not a number', () => {
    expect(parseSky({ current: { temperature_2m: 'warm', weather_code: 0, is_day: 1 } })).toBeNull();
  });

  it('rounds the temperature', () => {
    expect(parseSky(ok)).toEqual({ temp: 32, icon: 'sunny-outline', gold: true, condition: 'clear', isDay: true, ...still });
  });

  // The four that arrived with the hero effects. Absent they are zero,
  // not null: a wind speed we did not get is a still day to anything
  // drawing it, where a temperature we did not get is a reading to
  // withhold entirely.
  it('reads precipitation, wind and cloud when they are there', () => {
    expect(parseSky({
      current: {
        temperature_2m: 24, weather_code: 63, is_day: 1,
        precipitation: 2.4, wind_speed_10m: 18, wind_direction_10m: 135, cloud_cover: 92,
      },
    })).toEqual({
      temp: 24, icon: 'rainy-outline', gold: false, condition: 'rain', isDay: true,
      precipitation: 2.4, windKph: 18, windDeg: 135, cloudPct: 92,
    });
  });

  it('reads them as a still day when they are not', () => {
    expect(parseSky(ok)).toMatchObject(still);
  });

  // The same string tolerance the temperature gets, for the same reason.
  it('takes the later fields as numeric strings too', () => {
    expect(parseSky({
      current: {
        temperature_2m: 24, weather_code: 0, is_day: 1,
        precipitation: '0.4', wind_speed_10m: '9', wind_direction_10m: '270', cloud_cover: '12',
      },
    })).toMatchObject({ precipitation: 0.4, windKph: 9, windDeg: 270, cloudPct: 12 });
  });

  // A wind field that arrives as nonsense must read as no wind, never
  // as NaN — which would reach an Animated interpolation and take the
  // whole layer down rather than one number.
  it('reads a nonsense wind as no wind', () => {
    expect(parseSky({
      current: { temperature_2m: 24, weather_code: 0, is_day: 1, wind_speed_10m: 'breezy' },
    })).toMatchObject({ windKph: 0 });
  });

  it('reads is_day', () => {
    const night = parseSky({ current: { temperature_2m: 28, weather_code: 0, is_day: 0 } });
    expect(night?.icon).toBe('moon-outline');
    expect(night?.isDay).toBe(false);
  });

  // A response that changed underneath us reads as "no weather today",
  // which is a state the eyebrow is built to survive anyway.
  it('returns nothing rather than something wrong', () => {
    expect(parseSky(null)).toBeNull();
    expect(parseSky({})).toBeNull();
    expect(parseSky({ current: {} })).toBeNull();
    expect(parseSky({ current: { temperature_2m: 'warm', weather_code: 0 } })).toBeNull();
    expect(parseSky({ current: { temperature_2m: 30, weather_code: null } })).toBeNull();
  });

  // Below freezing is a real reading, and 0° is the one most likely to
  // be dropped by a truthiness check.
  it('keeps a temperature of zero', () => {
    expect(parseSky({ current: { temperature_2m: 0, weather_code: 3, is_day: 1 } }))
      .toEqual({ temp: 0, icon: 'cloud-outline', gold: false, condition: 'cloudy', isDay: true, ...still });
  });
});

describe('skyUrl', () => {
  it('asks for every field the parser reads', () => {
    const url = skyUrl(21.0285, 105.8542);
    expect(url).toContain('latitude=21.0285');
    expect(url).toContain('longitude=105.8542');
    for (const field of [
      'temperature_2m', 'weather_code', 'is_day',
      'precipitation', 'wind_speed_10m', 'wind_direction_10m', 'cloud_cover',
    ]) {
      expect(url).toContain(field);
    }
  });

  // Not an oversight. Open-Meteo has no `visibility` under `current`,
  // and codes 45 and 48 already say "fog" on the authority of whoever
  // measured it. See the note on `skyUrl`.
  it('does not ask for visibility', () => {
    expect(skyUrl(0, 0)).not.toContain('visibility');
  });

  // No key in the URL, which is the reason this provider was chosen: a
  // key in a React Native bundle is a key anyone can read.
  it('carries no secret', () => {
    expect(skyUrl(0, 0)).not.toMatch(/key|token|appid/i);
  });
});

// The empty-string case is the same trap as null: Number('') is 0, and 0
// is the code for a clear sky, so a blank field would have rendered as a
// sunny afternoon.
describe('parseSky rejects everything that is not a number', () => {
  for (const bad of [null, undefined, '', '  ', true, false, {}, [], NaN, Infinity]) {
    it(`refuses weather_code = ${JSON.stringify(bad)}`, () => {
      expect(parseSky({ current: { temperature_2m: 30, weather_code: bad, is_day: 1 } })).toBeNull();
    });
  }
});

describe('isClear', () => {
  // Only the sun gets a colour. A rain glyph in amber says nothing true.
  it('is true for the sky the sun is in', () => {
    expect([0, 1, 2].every(isClear)).toBe(true);
  });

  it('is false once the sun is behind something', () => {
    expect([3, 45, 61, 71, 80, 95].some(isClear)).toBe(false);
  });

  // The tint follows the code, so night has a gold moon rather than a
  // grey one — the sky is still clear.
  it('does not depend on the hour', () => {
    expect(parseSky({ current: { temperature_2m: 24, weather_code: 0, is_day: 0 } }))
      .toEqual({ temp: 24, icon: 'moon-outline', gold: true, condition: 'clear', isDay: false, ...still });
  });
});

describe('conditionOf', () => {
  it('reads the dry bands', () => {
    expect(conditionOf(0)).toBe('clear');
    expect(conditionOf(1)).toBe('partly-cloudy');
    expect(conditionOf(2)).toBe('partly-cloudy');
    expect(conditionOf(3)).toBe('cloudy');
    expect(conditionOf(45)).toBe('fog');
    expect(conditionOf(48)).toBe('fog');
  });

  // The one place this table is deliberately finer than `skyIcon`'s.
  // Ionicons has a single rain glyph, so drizzle and a downpour share
  // it; they must not share an atmosphere.
  it('separates what the glyph cannot', () => {
    expect(skyIcon(53, true)).toBe(skyIcon(65, true));
    expect(conditionOf(53)).toBe('drizzle');
    expect(conditionOf(65)).toBe('heavy-rain');
  });

  it('reads the wet bands by weight', () => {
    for (const code of [51, 53, 55]) expect(conditionOf(code)).toBe('drizzle');
    for (const code of [61, 63, 80, 81]) expect(conditionOf(code)).toBe('rain');
    for (const code of [65, 67, 82]) expect(conditionOf(code)).toBe('heavy-rain');
  });

  // Freezing drizzle and freezing rain fold into their wet siblings:
  // nothing downstream draws ice, and a category that renders the same
  // as another exists only to be read in a switch statement.
  it('folds the freezing variants into their wet siblings', () => {
    expect(conditionOf(56)).toBe('drizzle');
    expect(conditionOf(57)).toBe('drizzle');
    expect(conditionOf(66)).toBe('rain');
    expect(conditionOf(67)).toBe('heavy-rain');
  });

  it('reads the frozen and the loud', () => {
    for (const code of [71, 73, 75, 77, 85, 86]) expect(conditionOf(code)).toBe('snow');
    for (const code of [95, 96, 99]) expect(conditionOf(code)).toBe('thunderstorm');
  });

  // Same rule as `skyIcon`: the number is the part we are unsure of, and
  // a mild sky is the safest thing to assume about one we cannot name.
  it('gives an unknown code a mild sky', () => {
    expect(conditionOf(7)).toBe('partly-cloudy');
    expect(conditionOf(-1)).toBe('partly-cloudy');
    expect(conditionOf(50)).toBe('partly-cloudy');
    expect(conditionOf(70)).toBe('partly-cloudy');
  });

  // Every code the icon table knows must also have an atmosphere. A gap
  // here would render as a mild sky over a thunderstorm glyph.
  it('agrees with the icon table on wet, frozen and loud', () => {
    for (const code of [51, 55, 61, 65, 67, 80, 82]) {
      expect(skyIcon(code, true)).toBe('rainy-outline');
      expect(['drizzle', 'rain', 'heavy-rain']).toContain(conditionOf(code));
    }
    for (const code of [71, 75, 77, 85, 86]) {
      expect(skyIcon(code, true)).toBe('snow-outline');
      expect(conditionOf(code)).toBe('snow');
    }
    for (const code of [95, 96, 99]) {
      expect(skyIcon(code, true)).toBe('thunderstorm-outline');
      expect(conditionOf(code)).toBe('thunderstorm');
    }
  });
});
