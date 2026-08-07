import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Card, Empty, Screen } from '../components/ui';
import { Collection, coverOf, membersOf, useCollections, usePlaces } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { colors, font } from '../theme';
import type { Nav } from '../nav';

export default function CollectionsScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const cols = useCollections();
  const { data: places } = usePlaces();

  const coverFor = (c: Collection) => c.cover?.photo_uri ?? (membersOf(c, places)[0] && coverOf(membersOf(c, places)[0])?.photo_uri);

  return (
    <Screen title={t('Collections', 'Bộ sưu tập')}>
      {cols.loading && <ActivityIndicator color={colors.aiPink} style={{ marginTop: 48 }} />}
      {cols.error && <Empty text={t(`Couldn't load collections: ${cols.error}`, `Không tải được bộ sưu tập: ${cols.error}`)} />}
      {!cols.loading && !cols.error && (
        <FlatList
          data={cols.data}
          keyExtractor={(c) => c.slug}
          renderItem={({ item }) => {
            const count = membersOf(item, places).length || item.collection_places.length;
            const uri = coverFor(item);
            return (
              <Pressable onPress={() => navigation.navigate('CollectionDetail', { slug: item.slug })}>
                <Card style={s.card}>
                  {uri
                    ? <Image source={{ uri }} style={s.thumb} contentFit="cover" transition={200} />
                    : <View style={s.thumb} />}
                  <View style={s.body}>
                    <Text style={s.title} numberOfLines={1}>{t(item.title_en, item.title_vi)}</Text>
                    <Text style={s.meta} numberOfLines={1}>
                      {count} {t('places', 'địa điểm')}
                      {item.curator_handle ? `  ·  ${t('by', 'bởi')} ${item.curator_handle}` : ''}
                    </Text>
                    {(item.desc_en || item.desc_vi) && (
                      <Text style={s.desc} numberOfLines={2}>{t(item.desc_en, item.desc_vi)}</Text>
                    )}
                  </View>
                </Card>
              </Pressable>
            );
          }}
          ListEmptyComponent={<Empty text={t('No public collections yet.', 'Chưa có bộ sưu tập công khai.')} />}
          contentContainerStyle={{ paddingBottom: 32 }}
          onRefresh={cols.reload}
          refreshing={cols.loading}
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  card: { marginHorizontal: 20, marginBottom: 14, flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 92, height: 92, backgroundColor: colors.surfaceGlass },
  body: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  title: { color: colors.text, fontSize: 16.5, fontFamily: font.bold, letterSpacing: -0.2 },
  meta: { color: colors.textTertiary, fontSize: 12.5, fontFamily: font.medium, marginTop: 3 },
  desc: { color: colors.textSecondary, fontSize: 12.5, fontFamily: font.regular, marginTop: 5, lineHeight: 18 },
});
