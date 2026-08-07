import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PlaceCard from '../components/PlaceCard';
import { Empty } from '../components/ui';
import { membersOf, useCollections, usePlaces } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { colors, font } from '../theme';
import type { Nav, RootRoute } from '../nav';

export default function CollectionDetailScreen({ navigation, route }: { navigation: Nav; route: RootRoute<'CollectionDetail'> }) {
  const { t } = useI18n();
  const cols = useCollections();
  const { data: places, loading: placesLoading } = usePlaces();
  const col = useMemo(() => cols.data.find((c) => c.slug === route.params.slug), [cols.data, route.params.slug]);
  const members = useMemo(() => (col ? membersOf(col, places) : []), [col, places]);
  const loading = cols.loading || placesLoading;

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.back} accessibilityLabel="Back">
          <Text style={s.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{col ? t(col.title_en, col.title_vi) : ''}</Text>
          {col && (
            <Text style={s.meta}>
              {members.length} {t('places', 'địa điểm')}
              {col.curator_handle ? `  ·  ${t('by', 'bởi')} ${col.curator_handle}` : ''}
            </Text>
          )}
        </View>
      </View>
      {col && (col.desc_en || col.desc_vi) && (
        <Text style={s.desc}>{t(col.desc_en, col.desc_vi)}</Text>
      )}
      {loading && members.length === 0 && <ActivityIndicator color={colors.champagne} style={{ marginTop: 48 }} />}
      {!loading && !col && <Empty text={t('Collection not found.', 'Không tìm thấy bộ sưu tập.')} />}
      <FlatList
        data={members}
        keyExtractor={(p) => p.slug}
        renderItem={({ item }) => (
          <PlaceCard place={item} onPress={() => navigation.navigate('PlaceDetail', { slug: item.slug })} />
        )}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
  back: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceGlass,
    alignItems: 'center', justifyContent: 'center',
  },
  backText: { color: '#fff', fontSize: 26, lineHeight: 30, marginTop: -2 },
  title: { color: colors.text, fontSize: 21, fontWeight: font.extrabold, letterSpacing: -0.3 },
  meta: { color: colors.textTertiary, fontSize: 12.5, fontWeight: font.medium, marginTop: 1 },
  desc: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, fontWeight: font.regular, paddingHorizontal: 20, paddingBottom: 12 },
});
