// Shared pieces for the auth screens: the list-row field with icon and
// label, the big champagne primary button, and the header block with
// back control, eyebrow, title and lede — the reference layout rendered
// in the cityCrew champagne language.

import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, TextInputProps, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BackButton, useTabBarClearance } from './ui';
import { colors, font, gradAI, radius, space, type } from '../theme';

export function AuthScreen({ onBack, children }: { onBack: () => void; children: React.ReactNode }) {
  const tabClearance = useTabBarClearance();
  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: space.page, paddingBottom: tabClearance, gap: space.cardGap }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignSelf: 'flex-start', marginBottom: 4 }}>
            <BackButton onPress={onBack} />
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function AuthHeader({ eyebrow, title, lede }: { eyebrow?: string; title: string; lede: string }) {
  return (
    <View style={{ gap: 8, marginBottom: 10 }}>
      {eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}
      <Text style={s.title}>{title}</Text>
      <Text style={s.lede}>{lede}</Text>
    </View>
  );
}

export function FieldRow({ icon, label, secure, ...input }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  secure?: boolean;
} & TextInputProps) {
  const [hidden, setHidden] = useState(true);
  return (
    <View style={s.field}>
      <Ionicons name={icon} size={22} color={colors.champagne} />
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
    <Pressable onPress={busy ? undefined : onPress} accessibilityRole="button">
      <LinearGradient {...gradAI} style={s.primary}>
        {busy
          ? <ActivityIndicator color="#141310" />
          : <Text style={s.primaryText}>{label}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

/** "Don't have an account?  Sign up" — quiet text with a champagne link. */
export function SwitchRow({ prompt, action, onPress }: { prompt: string; action: string; onPress: () => void }) {
  return (
    <View style={s.switchRow}>
      <Text style={s.switchPrompt}>{prompt}</Text>
      <Pressable onPress={onPress} hitSlop={8}>
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

  eyebrow: {
    color: colors.champagne, fontSize: 12.5, fontWeight: font.semibold,
    letterSpacing: 1.6, textTransform: 'uppercase',
  },
  title: { color: colors.text, ...type.title },
  lede: { color: colors.textSecondary, ...type.body, lineHeight: 24 },

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
  primaryText: { color: '#141310', fontSize: 17, fontWeight: font.semibold },

  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 10 },
  switchPrompt: { color: colors.textSecondary, ...type.meta },
  switchAction: { color: colors.champagne, fontSize: 15, fontWeight: font.semibold },

  error: { color: colors.bad, ...type.meta, lineHeight: 21 },
});
