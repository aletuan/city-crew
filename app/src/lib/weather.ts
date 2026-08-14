// Current conditions for the selected city.
//
// Open-Meteo, which needs no API key. That is the whole reason for
// choosing it: a key shipped in a React Native bundle is a key anyone can
// read out of the bundle, and the usual answer — proxy it through a
// function that holds the secret — is a service to run and maintain for a
// number next to a date. No key means no secret means nothing to protect.
//
// We send the *city's* centre, never the device's position. Someone with
// the city set to "from your location" still keeps their location on
// their phone.
//
// The pure half is here so it can be tested in plain Node; see `place.ts`
// for why that boundary exists.

import type { Ionicons } from '@expo/vector-icons';

export type Sky = {
  /** Celsius, already rounded — nobody wants 31.7°. */
  temp: number;
  icon: keyof typeof Ionicons.glyphMap;
  /** Whether the glyph should be drawn in gold. See `isClear`. */
  gold: boolean;
};

/**
 * WMO weather code → a glyph.
 *
 * Open-Meteo speaks in WMO codes, which are numbers with no meaning to a
 * reader: 0 is a clear sky, 45 is fog, 95 is a thunderstorm. The table is
 * deliberately coarse. Ionicons has one rain glyph, so drizzle, rain and
 * showers all land on it, and a mapping that pretended to distinguish
 * them would be a lie told in a 14pt icon.
 *
 * `day` picks between sun and moon for the clear and near-clear codes,
 * the only ones where it shows. A sun at ten at night is the kind of
 * detail that makes everything around it look unconsidered.
 */
export function skyIcon(code: number, day: boolean): keyof typeof Ionicons.glyphMap {
  if (code === 0) return day ? 'sunny-outline' : 'moon-outline';
  if (code <= 2) return day ? 'partly-sunny-outline' : 'cloudy-night-outline';
  if (code === 3) return 'cloud-outline';
  if (code === 45 || code === 48) return 'reorder-two-outline';       // fog: flat bands
  if (code >= 51 && code <= 67) return 'rainy-outline';               // drizzle, rain
  if (code >= 71 && code <= 77) return 'snow-outline';
  if (code >= 80 && code <= 82) return 'rainy-outline';               // showers
  if (code >= 85 && code <= 86) return 'snow-outline';
  if (code >= 95) return 'thunderstorm-outline';
  // A code the table has not heard of still gets a sky rather than a
  // hole: the number is the part we are unsure of, not the weather.
  return 'partly-sunny-outline';
}

type Current = { temperature_2m?: unknown; weather_code?: unknown; is_day?: unknown };

/**
 * The shape Open-Meteo returns, or null if it is not the shape we expect.
 *
 * Separate from the fetch so the parsing — the part with branches in it —
 * can be tested without a network. A response that has changed underneath
 * us reads as "no weather today", which is what the eyebrow is built to
 * survive anyway.
 */
/**
 * A number, or null for everything that is not one.
 *
 * `Number()` alone is not enough and the difference matters: `Number(null)`
 * and `Number('')` are both `0`, and `0` is the WMO code for a clear sky.
 * A field that arrived empty would have rendered as a sunny afternoon.
 */
function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function parseSky(json: unknown): Sky | null {
  const cur = (json as { current?: Current })?.current;
  if (!cur) return null;
  const temp = num(cur.temperature_2m);
  const code = num(cur.weather_code);
  if (temp === null || code === null) return null;
  return { temp: Math.round(temp), icon: skyIcon(code, cur.is_day !== 0), gold: isClear(code) };
}

/**
 * Whether the sky is clear enough to draw in gold.
 *
 * Only the sun gets a colour. A rain glyph in amber says nothing true —
 * the tint is there because a sun is yellow, which is iconography rather
 * than decoration, and cloud, rain and snow have no colour of their own
 * worth spending a second hue on.
 */
export function isClear(code: number): boolean {
  return code >= 0 && code <= 2;
}

export function skyUrl(lat: number, lng: number): string {
  return 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${lat}&longitude=${lng}`
    + '&current=temperature_2m,weather_code,is_day';
}
