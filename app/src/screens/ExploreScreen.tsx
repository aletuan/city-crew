import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, View } from 'react-native';
import PlaceCard from '../components/PlaceCard';
import { Chip, Empty, Screen } from '../components/ui';
import { usePlaces } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { colors } from '../theme';
import type { Nav } from '../nav';

const CATS = [
  { key: 'foryou', en: 'For you', vi: 'Cho bạn' },
  { key: 'food', en: 'Food & drinks', vi: 'Ăn uống' },
  { key: 'out', en: 'Outdoors & culture', vi: 'Ngoài trời & văn hóa' },
] as const;

export default function ExploreScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { loading, error, data: places, reload } = usePlaces();
  const [cat, setCat] = useState<(typeof CATS)[number]['key']>('foryou');

  const shown = useMemo(() => {
    if (cat === 'foryou') return places.filter((p) => p.is_featured);
    return places.filter((p) => p.category === cat);
  }, [places, cat]);

  return (
    <Screen title={t('Explore', 'Khám phá')}>
      <View style={{ paddingBottom: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
          {CATS.map((c) => (
            <Chip key={c.key} label={t(c.en, c.vi)} active={cat === c.key} onPress={() => setCat(c.key)} />
          ))}
        </ScrollView>
      </View>
      {loading && <ActivityIndicator color={colors.champagne} style={{ marginTop: 48 }} />}
      {error && <Empty text={t(`Couldn't load places: ${error}`, `Không tải được địa điểm: ${error}`)} />}
      {!loading && !error && (
        <FlatList
          data={shown}
          keyExtractor={(p) => p.slug}
          renderItem={({ item }) => (
            <PlaceCard place={item} onPress={() => navigation.navigate('PlaceDetail', { slug: item.slug })} />
          )}
          ListEmptyComponent={<Empty text={t('Nothing here yet.', 'Chưa có gì ở đây.')} />}
          contentContainerStyle={{ paddingBottom: 32 }}
          onRefresh={reload}
          refreshing={loading}
        />
      )}
    </Screen>
  );
}
