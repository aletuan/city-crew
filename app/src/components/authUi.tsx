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
import { BackButton, fireHaptic, PressableScale, useTabBarClearance } from './ui';
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

export function FieldRow({ icon, label, secure, ...input }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  secure?: boolean;
} & TextInputProps) {
  const [hidden, setHidden] = useState(true);
  return (
    <View style={s.field}>
      <Ionicons name={icon} size={22} color={colors.accent} />
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
  fieldLabel: { color: colors.text, fontSize: 15, fontWeight: font.semibold },
  fieldInput: { color: colors.text, fontSize: 15.5, paddingVertical: 2, paddingHorizontal: 0 },

  primary: {
    borderRadius: radius.pill, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 6,
  },
  primaryText: { color: colors.accentInk, fontSize: 17, fontWeight: font.semibold },

  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 10 },
  switchPrompt: { color: colors.textSecondary, ...type.meta },
  switchAction: { color: colors.accent, fontSize: 15, fontWeight: font.semibold },

  error: { color: colors.bad, ...type.meta, lineHeight: 21 },
});
