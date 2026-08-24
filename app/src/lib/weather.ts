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
  /** What the sky is doing, in words something can switch on. */
  condition: WeatherCondition;
  /** Millimetres in the last hour. What separates drizzle from a
   *  downpour when the code alone says only "rain". */
  precipitation: number;
  /** Kilometres per hour, which is what Open-Meteo returns by default. */
  windKph: number;
  /** Degrees the wind blows **from**, meteorological convention: 0 is a
   *  northerly, 90 an easterly. Anything drawing a direction has to
   *  reverse it to get the way things actually travel. */
  windDeg: number;
  /** Sky covered, 0–100. */
  cloudPct: number;
  isDay: boolean;
};

/**
 * The sky as something to render, rather than as a WMO number.
 *
 * Deliberately coarser than the code list and deliberately not the same
 * partition as `skyIcon`: that table answers "which glyph", this one
 * answers "what should the photograph feel like", and the two disagree
 * in one useful place — drizzle and a downpour share a glyph because
 * Ionicons has one rain icon, and must not share an atmosphere.
 *
 * No `wind` member, though the prompt this was built from had one. Wind
 * is not a state of the sky, it is a modifier on whichever state the sky
 * is in: it can be windy and clear, windy and raining, windy and foggy.
 * A condition called "wind" would make those mutually exclusive.
 */
export type WeatherCondition =
  | 'clear'
  | 'partly-cloudy'
  | 'cloudy'
  | 'drizzle'
  | 'rain'
  | 'heavy-rain'
  | 'thunderstorm'
  | 'fog'
  | 'snow';

/**
 * WMO weather code → a condition.
 *
 * The freezing variants fold into their wet siblings: 56 and 57 are
 * freezing drizzle, 66 and 67 freezing rain. Nothing downstream draws
 * ice, and a category that renders identically to another is a category
 * that exists only to be read in a switch statement.
 *
 * An unrecognised code lands on `partly-cloudy` for the same reason
 * `skyIcon` lands on its own middle case: the number is the part we are
 * unsure of, not the weather, and a mild sky is the safest thing to
 * assume about one we cannot name.
 */
export function conditionOf(code: number): WeatherCondition {
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly-cloudy';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code === 65 || code === 67) return 'heavy-rain';
  if (code >= 61 && code <= 67) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code === 82) return 'heavy-rain';
  if (code === 80 || code === 81) return 'rain';
  if (code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'thunderstorm';
  return 'partly-cloudy';
}

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

type Current = {
  temperature_2m?: unknown;
  weather_code?: unknown;
  is_day?: unknown;
  precipitation?: unknown;
  wind_speed_10m?: unknown;
  wind_direction_10m?: unknown;
  cloud_cover?: unknown;
};

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

/** The same guard, for a field whose absence is a value rather than a
 *  gap. See the note in `parseSky`. */
function num0(v: unknown): number {
  return num(v) ?? 0;
}

export function parseSky(json: unknown): Sky | null {
  const cur = (json as { current?: Current })?.current;
  if (!cur) return null;
  const temp = num(cur.temperature_2m);
  const code = num(cur.weather_code);
  if (temp === null || code === null) return null;
  const isDay = cur.is_day !== 0;
  return {
    temp: Math.round(temp),
    icon: skyIcon(code, isDay),
    gold: isClear(code),
    condition: conditionOf(code),
    // Zero rather than null for the four that arrived later, and the
    // asymmetry is the point: a temperature we did not get is a reading
    // to withhold, but a wind speed we did not get is a still day as far
    // as anything drawing it is concerned. Making these nullable would
    // push a branch into every consumer to say the same thing.
    precipitation: num0(cur.precipitation),
    windKph: num0(cur.wind_speed_10m),
    windDeg: num0(cur.wind_direction_10m),
    cloudPct: num0(cur.cloud_cover),
    isDay,
  };
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

/**
 * Seven fields, and one deliberately absent.
 *
 * `visibility` is what a fog effect would like to read, and Open-Meteo
 * does not offer it under `current` — only hourly. Which turns out not
 * to matter: codes 45 and 48 *are* fog, stated by the people who
 * measured it, and a metre count would only be a second opinion on the
 * same fact. Asking for an hourly block to get one is a bigger response
 * and a worse answer.
 */
export function skyUrl(lat: number, lng: number): string {
  return 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${lat}&longitude=${lng}`
    + '&current=temperature_2m,weather_code,is_day'
    + ',precipitation,wind_speed_10m,wind_direction_10m,cloud_cover';
}
