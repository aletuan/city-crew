// The glyph on the Places tab: a pin standing on a folded map.
//
// Ionicons has a pin (`location`) and a map (`map`) and no mark that puts
// one on the other, which is what the tab holds — the catalog, as a list
// and as pins on Google's map. The owner looked at ten candidates from
// the set rendered at 24pt on both grounds and chose this composite over
// the bare pin (2 Oct 2026). It is drawn here rather than stacked from
// two `Ionicons` because stacking left the map's lines running through
// the pin's head, and the ring that knocks them out needs the background
// colour, which on the island is translucent glass over whatever the
// screen is showing. An SVG mask knocks the map out with no colour at
// all. `react-native-svg` is already in the binary (EngagementRing,
// welcomeArt), so nothing new has to ship through the store.
//
// ── the two pieces ──
//
// The outlines are Ionicons' own, read out of the font the app ships
// (`Ionicons.ttf`, MIT) with fontTools, so the stroke is the stroke the
// other four tabs wear — 32 units on a 512 grid — and the idle/selected
// pair is the same outline/solid pair they switch between. Re-drawing
// the two shapes by hand was the alternative, and would have matched the
// weight by eye.
//
// ── where they sit ──
//
// Measured in a headless Chromium at 22 and 44 px against the compass
// beside it, four geometries tried. The map is squashed to 0.58 of its
// height and widened to 0.96 of the cell, so it reads as a map lying on
// the ground rather than a sheet standing up, and gives the pin the upper
// half; a uniform 0.82 map left a 22px glyph that was mostly map with a
// pin perched on it. The pin is 0.7: at 0.62 its head was a dot at 22px,
// at 0.70 the ring inside the head still opens. The knock-out ring is the
// pin head's radius plus 28 units — a hairline's worth of air at 22px, a
// clear gap at 44.
//
// No halo. The other four idle glyphs wear `glassHalo`, a text shadow
// the font renderer gives them; an SVG has no text to shadow, and
// `react-native-svg`'s filters are still experimental in 15.x. The
// glyph is full-strength ink, same as theirs, and the island's scrim
// does the rest — check it over a bright photograph before trusting
// this paragraph.

import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, Mask, Path, Rect } from 'react-native-svg';

/** Ionicons `map-outline`, `map`, `location-outline`, `location`, on the
 *  font's 512 grid, y down. */
const MAP_OUTLINE = 'M264.0 80.0 322.0 117.0H328.0H333.0L383.0 85.0Q433.0 52.0 436.5 50.5Q440.0 49.0 448.0 49.0Q456.0 49.0 461.0 51.0Q477.0 59.0 480.0 76.0Q480.0 82.0 480.0 228.5Q480.0 375.0 480.0 381.0Q478.0 392.0 470.0 399.0Q468.0 401.0 410.0 439.5Q352.0 478.0 347.0 481.0Q328.0 490.0 309.0 483.0Q304.0 481.0 248.5 445.0Q193.0 409.0 190.0 407.5Q187.0 406.0 183.0 406.5Q179.0 407.0 129.5 439.0Q80.0 471.0 76.0 473.0Q72.0 475.0 64.0 475.0Q56.0 475.0 51.0 473.0Q35.0 465.0 32.0 448.0Q32.0 443.0 32.0 295.5Q32.0 148.0 32.0 143.0Q34.0 133.0 41.0 126.0Q44.0 123.0 101.5 84.0Q159.0 45.0 164.0 43.0Q167.0 41.0 171.5 39.5Q176.0 38.0 186.0 38.5Q196.0 39.0 201.0 41.0Q206.0 43.0 264.0 80.0ZM202.0 79.0 201.0 77.0V227.0V377.0L204.0 379.0Q208.0 381.0 260.0 414.5Q312.0 448.0 312.0 448.0Q312.0 448.0 312.0 298.0V148.0L309.0 146.0Q305.0 144.0 254.5 112.0Q204.0 80.0 202.0 79.0ZM168.0 228.0Q168.0 187.0 168.0 153.0Q168.0 119.0 168.0 99.0Q168.0 79.0 167.0 79.0Q167.0 79.0 115.0 113.0L64.0 148.0V295.0Q64.0 443.0 64.5 443.0Q65.0 443.0 112.5 412.0Q160.0 381.0 164.0 379.0L168.0 377.0ZM448.0 229.0Q448.0 189.0 448.0 155.0Q448.0 121.0 448.0 101.0Q448.0 81.0 447.0 81.0Q447.0 81.0 399.5 112.0Q352.0 143.0 348.0 145.0Q348.0 145.0 344.0 147.0V296.0Q344.0 301.0 344.0 307.0Q344.0 307.0 345.0 443.0Q347.0 443.0 397.0 410.0Q397.0 410.0 448.0 376.0Z';
const MAP = 'M153.0 48.0Q158.0 44.0 160.0 44.0Q165.0 44.0 167.0 49.0Q168.0 52.0 168.0 231.5Q168.0 411.0 167.0 413.0Q166.0 416.0 120.0 445.0Q87.0 467.0 79.0 471.5Q71.0 476.0 64.0 476.0Q54.0 476.0 45.0 470.0Q38.0 464.0 34.0 455.0L32.0 450.0V300.0Q32.0 149.0 32.0 143.0Q34.0 132.0 41.0 125.0Q43.0 123.0 92.0 89.0Q141.0 55.0 153.0 48.0ZM203.0 46.0Q206.0 43.0 213.0 46.5Q220.0 50.0 261.0 77.0Q310.0 109.0 311.0 112.0Q312.0 115.0 312.0 293.5Q312.0 472.0 312.0 475.0Q310.0 480.0 304.0 480.0Q301.0 480.0 251.5 448.0Q202.0 416.0 201.0 413.5Q200.0 411.0 200.0 230.0V49.0ZM442.0 48.0Q442.0 48.0 442.0 48.0Q444.0 48.0 450.0 48.0Q456.0 48.0 462.0 52.0Q477.0 59.0 480.0 76.0Q480.0 82.0 480.0 229.0Q480.0 376.0 480.0 381.0Q478.0 393.0 471.0 399.0Q468.0 402.0 411.5 440.5Q355.0 479.0 354.0 479.0Q352.0 480.0 349.0 479.0Q349.0 479.0 348.0 478.0Q345.0 478.0 344.5 459.0Q344.0 440.0 344.0 329.0Q344.0 306.0 344.0 293.0Q344.0 113.0 345.0 111.0Q346.0 108.0 391.0 79.0Q435.0 50.0 442.0 48.0Z';
const PIN_OUTLINE = 'M231.0 40.0Q255.0 36.0 279.0 40.0Q355.0 51.0 394.0 114.0Q425.0 163.0 412.0 225.0Q394.0 317.0 294.0 457.0Q278.0 479.0 270.0 483.0Q256.0 490.0 242.0 483.0Q234.0 479.0 218.0 457.0Q132.0 336.0 106.0 249.0Q88.0 191.0 104.0 144.0Q117.0 103.0 151.0 75.0Q185.0 47.0 231.0 40.0ZM268.0 71.0Q255.0 70.0 242.0 71.0Q202.0 75.0 171.0 101.0Q140.0 127.0 131.0 164.0Q123.0 200.0 140.0 250.0Q162.0 315.0 222.0 406.0Q254.0 453.0 256.0 453.0Q257.0 453.0 274.5 428.0Q292.0 403.0 302.0 387.0Q371.0 279.0 382.0 214.0Q393.0 148.0 345.0 104.0Q312.0 75.0 268.0 71.0ZM245.0 135.0Q259.0 132.0 274.0 137.0Q307.0 146.0 318.0 180.0Q323.0 198.0 318.0 216.0Q307.0 249.0 274.0 260.0Q256.0 265.0 238.0 260.0Q205.0 249.0 194.0 216.0Q189.0 198.0 194.0 180.0Q206.0 142.0 245.0 135.0ZM270.0 169.0Q270.0 169.0 270.0 169.0Q265.0 167.0 257.0 166.5Q249.0 166.0 246.0 168.0Q233.0 172.0 227.0 185.0Q225.0 189.0 225.0 198.0Q225.0 207.0 227.0 212.0Q238.0 233.0 261.0 230.0Q277.0 227.0 285.0 212.0Q287.0 207.0 287.0 198.0Q287.0 189.0 285.0 185.0Q280.0 174.0 270.0 169.0Z';
const PIN = 'M232.0 40.0Q241.0 39.0 255.5 39.0Q270.0 39.0 279.0 40.0Q352.0 50.0 392.0 111.0Q424.0 159.0 413.0 218.0Q399.0 300.0 315.0 425.0Q285.0 471.0 277.0 478.0Q268.0 486.0 256.0 486.0Q244.0 486.0 236.0 478.0Q224.0 468.0 186.0 408.0Q102.0 278.0 96.0 201.0Q92.0 142.0 131.5 95.5Q171.0 49.0 232.0 40.0ZM272.0 136.0Q259.0 132.0 245.0 135.0Q213.0 141.0 198.0 171.0Q192.0 184.0 192.0 198.0Q192.0 212.0 198.0 225.0Q209.0 249.0 233.0 258.0Q257.0 267.0 281.0 257.0Q298.0 250.0 309.0 233.5Q320.0 217.0 320.0 198.0Q320.0 168.0 296.0 148.0Q285.0 140.0 272.0 136.0ZM245.0 168.0Q245.0 168.0 245.0 168.0Q258.0 163.0 270.0 169.0Q285.0 176.0 287.5 192.5Q290.0 209.0 278.0 220.0Q265.0 234.0 246.5 228.0Q228.0 222.0 224.0 203.0Q223.0 192.0 229.0 182.0Q235.0 172.0 245.0 168.0Z';

const MAP_SX = 0.96;
const MAP_SY = 0.58;
const MAP_DX = 10.2;
const MAP_DY = 227.6;
const PIN_S = 0.7;
const PIN_DX = 75.4;
const PIN_DY = -27.3;
/** The pin head's centre and the knock-out ring around it. */
const HEAD_CX = 256;
const HEAD_CY = 112.6;
const RING_R = 144.2;

let serial = 0;

export default function PlacesGlyph({ size, color, solid, style, testID }: {
  size: number;
  color: string;
  /** The selected tab's variant, as Ionicons' solid glyphs are to its outlines. */
  solid: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  // One mask id per mounted glyph: two of these on one screen sharing an
  // id would mask each other on the web renderer.
  const [maskId] = React.useState(() => `places-knockout-${serial++}`);
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" fill={color} style={style} testID={testID} accessible={false}>
      <Defs>
        <Mask id={maskId}>
          <Rect width={512} height={512} fill="white" />
          <Circle cx={HEAD_CX} cy={HEAD_CY} r={RING_R} fill="black" />
        </Mask>
      </Defs>
      <G mask={`url(#${maskId})`}>
        <G transform={`translate(${MAP_DX} ${MAP_DY}) scale(${MAP_SX} ${MAP_SY})`}>
          <Path d={solid ? MAP : MAP_OUTLINE} testID="places-map" />
        </G>
      </G>
      <G transform={`translate(${PIN_DX} ${PIN_DY}) scale(${PIN_S})`}>
        <Path d={solid ? PIN : PIN_OUTLINE} testID="places-pin" />
      </G>
    </Svg>
  );
}
