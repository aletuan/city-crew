// Shared UI atoms: screen scaffold with header + language pill, chips,
// glass cards — the mockup's visual language in React Native.

import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { colors, font, radius } from '../theme';

export function LangPill() {
  const { lang, toggle } = useI18n();
  return (
    <Pressable onPress={toggle} style={s.langPill} accessibilityLabel="Switch language">
      <Text style={[s.langOpt, lang === 'en' && s.langOn]}>EN</Text>
      <Text style={[s.langOpt, lang === 'vi' && s.langOn]}>VI</Text>
    </Pressable>
  );
}

export function Screen({ title, children, right }: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>{title}</Text>
        <View style={{ flex: 1 }} />
        {right ?? <LangPill />}
      </View>
      {children}
    </SafeAreaView>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipOn]}>
      <Text style={[s.chipText, active && s.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12,
  },
  title: { color: colors.text, fontSize: 30, fontFamily: font.extrabold, letterSpacing: -0.5 },
  langPill: {
    flexDirection: 'row', borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.borderGlass, overflow: 'hidden',
  },
  langOpt: {
    paddingHorizontal: 12, paddingVertical: 6, fontSize: 12,
    color: colors.textTertiary, fontFamily: font.semibold,
  },
  langOn: { backgroundColor: colors.surfaceGlassStrong, color: colors.text },
  chip: {
    borderWidth: 1, borderColor: colors.borderGlassSoft, borderRadius: radius.pill,
    paddingHorizontal: 14, paddingVertical: 7, marginRight: 8,
  },
  chipOn: { backgroundColor: colors.surfaceGlassStrong, borderColor: 'transparent' },
  chipText: { color: colors.textSecondary, fontSize: 13, fontFamily: font.semibold },
  chipTextOn: { color: colors.text },
  card: {
    backgroundColor: colors.bgElevated, borderRadius: radius.card,
    borderWidth: 1, borderColor: colors.borderGlassSoft, overflow: 'hidden',
  },
  empty: { padding: 48, alignItems: 'center' },
  emptyText: { color: colors.textTertiary, fontSize: 14, fontFamily: font.regular, textAlign: 'center' },
});
