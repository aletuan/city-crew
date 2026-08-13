import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PlaceCard from '../components/PlaceCard';
import { AmbientWarmth, BackButton, Empty, useTabBarClearance } from '../components/ui';
import { membersOf, useCollections, usePlaces } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { colors, space, type } from '../theme';
import type { Nav, RootRoute } from '../nav';

export default function CollectionDetailScreen({ navigation, route }: { navigation: Nav; route: RootRoute<'CollectionDetail'> }) {
  const { t } = useI18n();
  const cols = useCollections();
  const { data: places, loading: placesLoading } = usePlaces();
  const col = useMemo(() => cols.data.find((c) => c.slug === route.params.slug), [cols.data, route.params.slug]);
  const members = useMemo(() => (col ? membersOf(col, places) : []), [col, places]);
  const loading = cols.loading || placesLoading;
  const tabClearance = useTabBarClearance();

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <AmbientWarmth />
      <View style={s.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{col ? t(col.title_en, col.title_vi, col.title_ja) : ''}</Text>
          {col && (
            <Text style={s.meta}>
              {members.length} {t('places', 'địa điểm', 'スポット')}
              {col.curator_handle ? `  ·  ${t('by', 'bởi', 'by')} ${col.curator_handle}` : ''}
            </Text>
          )}
        </View>
      </View>
      {col && (col.desc_en || col.desc_vi) && (
        <Text style={s.desc}>{t(col.desc_en, col.desc_vi, col.desc_ja)}</Text>
      )}
      {loading && members.length === 0 && <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />}
      {!loading && !col && <Empty text={t('Collection not found.', 'Không tìm thấy bộ sưu tập.', 'コレクションが見つかりません。')} />}
      <FlatList
        data={members}
        keyExtractor={(p) => p.slug}
        renderItem={({ item }) => (
          <PlaceCard place={item} onPress={() => navigation.navigate('PlaceDetail', { slug: item.slug })} />
        )}
        ListEmptyComponent={!loading && col ? (
          <Empty text={t(
            'No places in this collection yet.',
            'Bộ sưu tập này chưa có địa điểm nào.',
            'このコレクションにはまだスポットがありません。',
          )} />
        ) : null}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: tabClearance }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: space.page, paddingTop: 10, paddingBottom: 10,
  },
  // `headline`, not `titleDetail`: this title shares its line with the back
  // control and is clipped to one line, so it takes the smaller of the two
  // display sizes rather than truncating more collection names than before.
  title: { color: colors.text, ...type.headline },
  meta: { color: colors.textTertiary, ...type.meta, marginTop: 2 },
  desc: {
    color: colors.textSecondary, ...type.body, lineHeight: 24,
    paddingHorizontal: space.page, paddingBottom: 12,
  },
});
