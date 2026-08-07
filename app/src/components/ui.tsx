// Shared UI atoms: screen scaffold with header + language pill, chips,
// translucent charcoal cards — the cityCrew design system in React Native.

import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { colors, font, radius, space, type } from '../theme';

// ── tab bar geometry ──
// A full-width Apple-style bar over blur; position:absolute so content
// scrolls beneath it, which means screens must clear it themselves.
export const TAB_BAR_HEIGHT = 62;

/** Bottom padding that clears the translucent tab bar plus breathing room. */
export function useTabBarClearance(extra = 18): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + TAB_BAR_HEIGHT + extra;
}

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
    paddingHorizontal: space.page, paddingTop: 8, paddingBottom: 14,
  },
  title: { color: colors.text, ...type.title },
  langPill: {
    flexDirection: 'row', borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.borderGlassSoft, overflow: 'hidden',
  },
  langOpt: {
    paddingHorizontal: 12, paddingVertical: 6, fontSize: 12.5,
    color: colors.textTertiary, fontWeight: font.medium,
  },
  // Selected control: champagne, and nothing louder.
  langOn: { backgroundColor: colors.surfaceGlass, color: colors.champagne },
  chip: {
    borderWidth: 1, borderColor: colors.borderGlassSoft, borderRadius: radius.pill,
    paddingHorizontal: 14, paddingVertical: 7, marginRight: 8,
  },
  chipOn: { backgroundColor: colors.surfaceGlassStrong, borderColor: 'transparent' },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: font.semibold },
  chipTextOn: { color: colors.text },
  card: {
    backgroundColor: colors.surfaceCard, borderRadius: radius.card,
    borderWidth: 1, borderColor: colors.borderGlassSoft, overflow: 'hidden',
  },
  empty: { padding: 48, alignItems: 'center' },
  emptyText: { color: colors.textTertiary, ...type.meta, textAlign: 'center' },
});
