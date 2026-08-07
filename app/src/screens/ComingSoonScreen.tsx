import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, useTabBarClearance } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { colors, font, gradAI } from '../theme';

export default function ComingSoonScreen({ titleEn, titleVi }: { titleEn: string; titleVi: string }) {
  const { t } = useI18n();
  const tabClearance = useTabBarClearance();
  return (
    <Screen title={t(titleEn, titleVi)}>
      <View style={[s.wrap, { paddingBottom: tabClearance }]}>
        <LinearGradient {...gradAI} style={s.badge}>
          <Text style={s.badgeText}>✨</Text>
        </LinearGradient>
        <Text style={s.title}>{t('Coming soon', 'Sắp ra mắt')}</Text>
        <Text style={s.sub}>
          {t(
            'The plan wizard and itineraries from the mockup land here next.',
            'Trình tạo kế hoạch và lịch trình từ bản mockup sẽ xuất hiện ở đây.',
          )}
        </Text>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  badge: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 28 },
  title: { color: colors.text, fontSize: 20, fontWeight: font.bold },
  sub: { color: colors.textTertiary, fontSize: 14, fontWeight: font.regular, textAlign: 'center', lineHeight: 21 },
});
