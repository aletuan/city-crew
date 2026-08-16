import { describe, expect, it } from 'vitest';
import { isClear, parseSky, skyIcon, skyUrl } from './weather';

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
      .toEqual({ temp: 32, icon: 'sunny-outline', gold: true });
  });

  it('refuses a string that is not a number', () => {
    expect(parseSky({ current: { temperature_2m: 'warm', weather_code: 0, is_day: 1 } })).toBeNull();
  });

  it('rounds the temperature', () => {
    expect(parseSky(ok)).toEqual({ temp: 32, icon: 'sunny-outline', gold: true });
  });

  it('reads is_day', () => {
    expect(parseSky({ current: { temperature_2m: 28, weather_code: 0, is_day: 0 } })?.icon)
      .toBe('moon-outline');
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
      .toEqual({ temp: 0, icon: 'cloud-outline', gold: false });
  });
});

describe('skyUrl', () => {
  it('asks for the three fields the parser needs', () => {
    const url = skyUrl(21.0285, 105.8542);
    expect(url).toContain('latitude=21.0285');
    expect(url).toContain('longitude=105.8542');
    for (const field of ['temperature_2m', 'weather_code', 'is_day']) {
      expect(url).toContain(field);
    }
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
      .toEqual({ temp: 24, icon: 'moon-outline', gold: true });
  });
});
