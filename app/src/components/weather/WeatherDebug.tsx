// The panel that lets somebody tune the weather without waiting for it.
//
// `__DEV__` only, and the guard is at the call site as well as here: this
// file should never reach a production bundle, and if it somehow does it
// must not render.
//
// It exists because the alternative is untunable. Hanoi gets thunderstorms
// in July and fog in February, and nobody is going to hold a design review
// open until February. Every number in `weatherfx.ts` was chosen by
// reasoning, which is the weakest way to choose a number; this is how they
// get chosen by looking instead.
//
// The slider is hand-rolled on `PanResponder` rather than pulled in from a
// package. A dependency added for a development tool is a dependency in
// everybody's bundle, and this needs forty lines.

import React, { useRef } from 'react';
import {
  Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { conditionOf, type Sky, type WeatherCondition } from '../../lib/weather';
import { colors, font, radius, space } from '../../theme';

/** A representative WMO code per condition, so the panel can build a
 *  whole `Sky` — glyph and gold included — through the same table the
 *  real reading goes through. Inventing an icon here instead would let
 *  the panel show something the app never shows. */
const CODE: Record<WeatherCondition, number> = {
  clear: 0,
  'partly-cloudy': 2,
  cloudy: 3,
  fog: 45,
  drizzle: 53,
  rain: 63,
  'heavy-rain': 65,
  thunderstorm: 95,
  snow: 73,
};

const ORDER: WeatherCondition[] = [
  'clear', 'partly-cloudy', 'cloudy', 'fog',
  'drizzle', 'rain', 'heavy-rain', 'thunderstorm', 'snow',
];

export type Debug = {
  condition: WeatherCondition;
  precipitation: number;
  windKph: number;
  windDeg: number;
  cloudPct: number;
  intensity: number;
  /** Overrides the clock, so golden hour can be seen at any hour. */
  hour: number;
  isDay: boolean;
};

export const DEBUG_DEFAULT: Debug = {
  condition: 'rain',
  precipitation: 3,
  windKph: 18,
  windDeg: 90,
  cloudPct: 80,
  intensity: 1,
  hour: 12,
  isDay: true,
};

/** The `Sky` a debug state stands in for. Built through `conditionOf` and
 *  the icon table, so what the panel drives is the same shape the network
 *  returns and no code path exists only under `__DEV__`. */
export function debugSky(d: Debug, real: Sky | null): Sky {
  const code = CODE[d.condition];
  return {
    temp: real?.temp ?? 24,
    icon: real?.icon ?? 'partly-sunny-outline',
    gold: real?.gold ?? false,
    condition: conditionOf(code),
    precipitation: d.precipitation,
    windKph: d.windKph,
    windDeg: d.windDeg,
    cloudPct: d.cloudPct,
    isDay: d.isDay,
  };
}

function Slider({ label, value, min, max, step, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const width = useRef(0);
  const set = (x: number) => {
    if (!width.current) return;
    const raw = min + (Math.max(0, Math.min(x, width.current)) / width.current) * (max - min);
    onChange(Math.round(raw / step) * step);
  };
  // Created once: a PanResponder rebuilt on every render loses the touch
  // it is in the middle of, which reads as the slider sticking.
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => set(e.nativeEvent.locationX),
      onPanResponderMove: (e) => set(e.nativeEvent.locationX),
    }),
  ).current;

  const frac = (value - min) / (max - min);
  return (
    <View style={s.sliderRow}>
      <View style={s.sliderHead}>
        <Text style={s.label}>{label}</Text>
        <Text style={s.value}>{Number.isInteger(value) ? value : value.toFixed(1)}</Text>
      </View>
      <View
        style={s.track}
        onLayout={(e) => { width.current = e.nativeEvent.layout.width; }}
        {...pan.panHandlers}
      >
        <View style={s.rail}>
          <View style={[s.fill, { width: `${Math.max(0, Math.min(frac, 1)) * 100}%` }]} />
        </View>
      </View>
    </View>
  );
}

export default function WeatherDebug({ visible, state, onChange, onClose, onUseLive }: {
  visible: boolean;
  state: Debug;
  onChange: (next: Debug) => void;
  onClose: () => void;
  /** Drop the override and go back to whatever the sky is actually
   *  doing. The parent owns that switch — a second copy of it in here
   *  would be two answers to one question. */
  onUseLive: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!__DEV__) return null;

  const set = <K extends keyof Debug>(key: K, v: Debug[K]) => onChange({ ...state, [key]: v });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 14 }]}>
          <View style={s.grabber} />
          <View style={s.headRow}>
            <Text style={s.title}>Weather — dev</Text>
            <Pressable onPress={() => { onUseLive(); onClose(); }} hitSlop={12}>
              <Text style={s.link}>use live</Text>
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <View style={s.chips}>
              {ORDER.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => set('condition', c)}
                  style={[s.chip, state.condition === c && s.chipOn]}
                >
                  <Text style={[s.chipText, state.condition === c && s.chipTextOn]}>{c}</Text>
                </Pressable>
              ))}
            </View>

            <Slider label="Rain (mm/h)" value={state.precipitation} min={0} max={20} step={0.5}
              onChange={(v) => set('precipitation', v)} />
            <Slider label="Wind (km/h)" value={state.windKph} min={0} max={80} step={1}
              onChange={(v) => set('windKph', v)} />
            <Slider label="Wind from (°)" value={state.windDeg} min={0} max={360} step={5}
              onChange={(v) => set('windDeg', v)} />
            <Slider label="Cloud (%)" value={state.cloudPct} min={0} max={100} step={1}
              onChange={(v) => set('cloudPct', v)} />
            <Slider label="Effect opacity" value={state.intensity} min={0} max={1.5} step={0.05}
              onChange={(v) => set('intensity', v)} />
            <Slider label="Hour" value={state.hour} min={0} max={23} step={1}
              onChange={(v) => set('hour', v)} />

            <Pressable onPress={() => set('isDay', !state.isDay)} style={s.toggle}>
              <Text style={s.chipText}>{state.isDay ? 'day' : 'night'}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(6,5,8,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: space.page, paddingTop: 10, gap: 10,
  },
  grabber: {
    width: 38, height: 4, borderRadius: 2, alignSelf: 'center',
    backgroundColor: colors.textTertiary,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 16, fontWeight: font.semibold },
  link: { color: colors.accent, fontSize: 14, fontWeight: font.semibold },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  chip: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.pill,
    backgroundColor: colors.surfaceGlass,
  },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.textSecondary, fontSize: 12.5, fontWeight: font.medium },
  chipTextOn: { color: colors.accentInk, fontWeight: font.semibold },

  sliderRow: { gap: 5, marginBottom: 10 },
  sliderHead: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: colors.textSecondary, fontSize: 13 },
  value: { color: colors.text, fontSize: 13, fontWeight: font.semibold },
  // Tall enough to be a target on a phone, drawn thin so it reads as a
  // track: the height is the hit area, the rail is the picture.
  track: { height: 26, justifyContent: 'center' },
  rail: {
    height: 4, borderRadius: 2,
    backgroundColor: colors.surfaceGlass, overflow: 'hidden',
  },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
  toggle: {
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.pill, backgroundColor: colors.surfaceGlass, marginBottom: 8,
  },
});
