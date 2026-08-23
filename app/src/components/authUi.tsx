// Shared pieces for the form screens: the list-row field with icon and
// label, the big accented primary button, and the header — a back control
// with the title on its line, then a lede each screen places for itself.

import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, TextInputProps, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BackButton, CONTROL_H, fireHaptic, PressableScale, useTabBarClearance } from './ui';
import { useI18n } from '../lib/i18n';
import { PASSWORD_MIN, passwordStrength } from '../lib/password';
import { colors, font, gradAI, radius, space, type } from '../theme';

export function AuthScreen({ children }: { children: React.ReactNode }) {
  const tabClearance = useTabBarClearance();
  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: space.page, paddingBottom: tabClearance, gap: space.cardGap }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Back control and title on one line.
 *
 * These are screens for doing something and leaving, and iOS gives that
 * shape an inline title — the large title stacked under the back button is
 * for places you stay in, which is where the tab roots still use it. On a
 * form it was costing about 60pt at the top of a screen whose lower half
 * the keyboard takes.
 *
 * `titleDetail`, not `title`: at 34pt beside a 44pt control, "Sign in"
 * fits and "Đặt tên danh sách" does not. It still wraps to two lines if a
 * translation needs it, which is why the row aligns to the top rather than
 * centring on a control whose height it cannot assume.
 *
 * The eyebrow that used to sit above the title is gone. It was a device
 * for introducing a large title; below an inline one it would be read
 * after the thing it was introducing.
 */
export function AuthHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={s.header}>
      <BackButton onPress={onBack} />
      <Text style={s.title}>{title}</Text>
    </View>
  );
}

/**
 * The sentence under the title — now placed by each screen rather than
 * bolted to the header, because it belongs immediately above the fields it
 * introduces. On the profile form that means below the avatar, which sits
 * between the two.
 */
export function Lede({ children }: { children: string }) {
  return <Text style={s.lede}>{children}</Text>;
}

/**
 * A labelled input, and the place its own error is allowed to appear.
 *
 * `error` belongs here rather than at the foot of the form because that
 * is where the eye already is. A message under the Save button leaves
 * the reader to work out which of five fields it is about — and the one
 * this was written for named a value three fields further up.
 */
export function FieldRow({ icon, label, secure, strength, error, ...input }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  secure?: boolean;
  /** Score the value as a password being invented. Sign-up and reset
   *  only — grading a password that already exists helps nobody. */
  strength?: boolean;
  error?: string | null;
} & TextInputProps) {
  const [hidden, setHidden] = useState(true);
  return (
    <View>
      <View style={[s.field, !!error && s.fieldBad]}>
        {/* The glyph turns with the border. Colour alone should never
            carry a message, which is why the sentence below exists — but
            two signals agreeing is what makes the field findable in a
            scroll. */}
        <Ionicons name={icon} size={22} color={error ? colors.bad : colors.accent} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.fieldLabel}>{label}</Text>
          <TextInput
            style={s.fieldInput}
            placeholderTextColor={colors.textTertiary}
            secureTextEntry={secure && hidden}
            {...input}
          />
        </View>
        {secure ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityLabel="Toggle password visibility">
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={21} color={colors.textTertiary} />
          </Pressable>
        ) : null}
      </View>
      {strength ? <PasswordStrengthMeter password={input.value ?? ''} /> : null}
      {error ? (
        <Text style={s.fieldError} accessibilityLiveRegion="polite">{error}</Text>
      ) : null}
    </View>
  );
}

/**
 * The verdict at Good. The ring sweep's terminal lime (see `ringSweep`),
 * literal for `gradAI`'s reason: these segments are fills, never type,
 * and the sweep already puts this exact value on both grounds.
 */
const METER_GOOD = '#A9C46A';

/**
 * Four segments and a word, under the field where a password is being
 * invented.
 *
 * Every filled segment takes the current verdict's colour rather than
 * each segment keeping its own — the count says how far along, the
 * colour says where that lands, and the two must not disagree. The ramp
 * runs bad → sun → lime → ok: red for a password that will be guessed,
 * through the sweep's own warm-to-cool, to green.
 *
 * The word is there because colour alone should never carry a message —
 * the rule the field's own error state already follows — and it stays
 * `textSecondary` rather than taking the verdict's colour: `sun` was
 * measured for glyphs at 3:1, not for 13.5pt type, and a label that
 * fails on paper is worse than a quiet one. Under the minimum it says
 * "Too short", which is an instruction, where "Weak" is only a verdict.
 *
 * Nothing renders until something is typed: a meter reading an empty
 * field is noise on a form five fields tall.
 */
export function PasswordStrengthMeter({ password }: { password: string }) {
  const { t } = useI18n();
  const level = passwordStrength(password);
  if (level === 0) return null;
  const label = password.length < PASSWORD_MIN
    ? t('Too short', 'Quá ngắn', '短すぎます')
    : [
        t('Weak', 'Yếu', '弱い'),
        t('Fair', 'Trung bình', '普通'),
        t('Good', 'Khá', '良い'),
        t('Strong', 'Mạnh', '強い'),
      ][level - 1];
  const fill = [colors.bad, colors.sun, METER_GOOD, colors.ok][level - 1];
  return (
    <View
      style={s.meter}
      accessibilityLabel={`${t('Password strength', 'Độ mạnh mật khẩu', 'パスワードの強度')}: ${label}`}
    >
      <View style={s.meterTrack} accessible={false}>
        {[1, 2, 3, 4].map((n) => (
          <View key={n} style={[s.meterSeg, n <= level && { backgroundColor: fill }]} />
        ))}
      </View>
      <Text style={s.meterLabel} accessibilityLiveRegion="polite">{label}</Text>
    </View>
  );
}

export function PrimaryButton({ label, onPress, busy }: { label: string; onPress: () => void; busy?: boolean }) {
  return (
    <PressableScale onPress={busy ? undefined : onPress} accessibilityRole="button">
      <LinearGradient {...gradAI} style={s.primary}>
        {busy
          ? <ActivityIndicator color={colors.accentInk} />
          : <Text style={s.primaryText}>{label}</Text>}
      </LinearGradient>
    </PressableScale>
  );
}

/** "Don't have an account?  Sign up" — quiet text with an accented link. */
export function SwitchRow({ prompt, action, onPress }: { prompt: string; action: string; onPress: () => void }) {
  return (
    <View style={s.switchRow}>
      <Text style={s.switchPrompt}>{prompt}</Text>
      <Pressable onPress={() => { fireHaptic('selection'); onPress(); }} hitSlop={8}>
        <Text style={s.switchAction}>{action}</Text>
      </Pressable>
    </View>
  );
}

export function ErrorText({ children }: { children: string }) {
  return <Text style={s.error}>{children}</Text>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  // Top-aligned, not centred: the title may wrap to two lines and the
  // control must stay level with the first of them.
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    marginBottom: 2,
  },
  // `paddingTop` optically centres a 26pt line against the 44pt control
  // without pinning either to the other's height.
  title: { flex: 1, color: colors.text, ...type.titleDetail, paddingTop: 7 },
  lede: { color: colors.textSecondary, ...type.body, lineHeight: 24, marginBottom: 2 },

  field: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.card, paddingHorizontal: space.cardPadding, paddingVertical: 12,
  },
  // The border carries the state; the fill stays as it was. A tinted
  // field reads as a different kind of field rather than as this field
  // with something wrong.
  fieldBad: { borderColor: colors.bad },
  fieldLabel: { color: colors.text, fontSize: 15, fontWeight: font.semibold },
  // Tucked under the field it belongs to, indented to its text column.
  fieldError: {
    color: colors.bad, fontSize: 13.5, lineHeight: 18,
    marginTop: 6, marginBottom: 2, paddingHorizontal: space.cardPadding,
  },
  fieldInput: { color: colors.text, fontSize: 15.5, paddingVertical: 2, paddingHorizontal: 0 },

  // Indented like `fieldError`: this is the same under-field zone, and
  // the two must line up on the one screen that can show both.
  meter: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 8, paddingHorizontal: space.cardPadding,
  },
  meterTrack: { flex: 1, flexDirection: 'row', gap: 5 },
  // Empty segments sit on the tinted well, not on a colour: the track is
  // what has not happened yet, and the ring already settled that it
  // stays neutral so the colour is spent on progress alone.
  meterSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.surfaceGlassStrong },
  meterLabel: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 18, fontWeight: font.medium },

  primary: {
    borderRadius: radius.pill, minHeight: CONTROL_H, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center', marginTop: 6,
  },
  primaryText: { color: colors.accentInk, fontSize: 17, fontWeight: font.semibold },

  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 10 },
  switchPrompt: { color: colors.textSecondary, ...type.meta },
  switchAction: { color: colors.accent, fontSize: 15, fontWeight: font.semibold },

  error: { color: colors.bad, ...type.meta, lineHeight: 21 },
});
