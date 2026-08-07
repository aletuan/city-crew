// Collections — one obvious purpose: browse curated city lists.
//
// Hierarchy per the design system: large title, a quiet guest notice,
// then the browsable list. Depth comes from the near-black ground, an
// ambient warmth that all but disappears into it, translucent charcoal
// surfaces and thin warm hairlines — not from shadows.

import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Card, Empty, Screen } from '../components/ui';
import { Collection, coverOf, membersOf, useCollections, usePlaces } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { colors, radius, space, type } from '../theme';
import type { Nav } from '../nav';

/** Reflected city light: heavily diffused, barely there. */
function AmbientWarmth() {
  return (
    <LinearGradient
      colors={['rgba(232,196,132,0.07)', 'rgba(232,196,132,0.022)', 'transparent']}
      locations={[0, 0.42, 1]}
      style={s.ambient}
      pointerEvents="none"
    />
  );
}

function GuestNotice() {
  const { t } = useI18n();
  return (
    <View style={s.notice}>
      <Text style={s.noticeTitle}>
        {t("You're browsing as a guest", 'Bạn đang xem với tư cách khách')}
      </Text>
      <Text style={s.noticeBody}>
        {t(
          'Public collections are curated by local explorers. Signing in adds your own lists.',
          'Bộ sưu tập công khai do người bản địa tuyển chọn. Đăng nhập để thêm danh sách của riêng bạn.',
        )}
      </Text>
    </View>
  );
}

export default function CollectionsScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const cols = useCollections();
  const { data: places } = usePlaces();

  const coverFor = (c: Collection) =>
    c.cover?.photo_uri ?? (membersOf(c, places)[0] && coverOf(membersOf(c, places)[0])?.photo_uri);

  return (
    <Screen title={t('Collections', 'Bộ sưu tập')}>
      <View style={{ flex: 1 }}>
        <AmbientWarmth />
        {cols.loading && <ActivityIndicator color={colors.champagne} style={{ marginTop: 48 }} />}
        {cols.error && <Empty text={t(`Couldn't load collections: ${cols.error}`, `Không tải được bộ sưu tập: ${cols.error}`)} />}
        {!cols.loading && !cols.error && (
          <FlatList
            data={cols.data}
            keyExtractor={(c) => c.slug}
            ListHeaderComponent={
              <>
                <GuestNotice />
                <Text style={s.section}>{t('Public collections', 'Bộ sưu tập công khai')}</Text>
              </>
            }
            renderItem={({ item }) => {
              const count = membersOf(item, places).length || item.collection_places.length;
              const uri = coverFor(item);
              return (
                <Pressable
                  style={s.row}
                  onPress={() => navigation.navigate('CollectionDetail', { slug: item.slug })}
                >
                  <Card style={s.card}>
                    {uri
                      ? <Image source={{ uri }} style={s.thumb} contentFit="cover" transition={200} />
                      : <View style={s.thumb} />}
                    <View style={s.cardText}>
                      <Text style={s.title} numberOfLines={2}>{t(item.title_en, item.title_vi)}</Text>
                      <Text style={s.meta} numberOfLines={1}>
                        {count} {t('places', 'địa điểm')}
                        {item.curator_handle ? `  ·  ${t('by', 'bởi')} ${item.curator_handle}` : ''}
                      </Text>
                    </View>
                    <View style={s.chevron}>
                      <Ionicons name="chevron-forward" size={17} color={colors.textSecondary} />
                    </View>
                  </Card>
                </Pressable>
              );
            }}
            ListEmptyComponent={<Empty text={t('No public collections yet.', 'Chưa có bộ sưu tập công khai.')} />}
            contentContainerStyle={{ paddingBottom: 28 }}
            showsVerticalScrollIndicator={false}
            onRefresh={cols.reload}
            refreshing={cols.loading}
          />
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  ambient: { position: 'absolute', left: 0, right: 0, top: 0, height: 460 },

  notice: {
    marginHorizontal: space.page, marginBottom: space.titleToContent,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.card, paddingHorizontal: space.cardPadding, paddingVertical: 17,
  },
  noticeTitle: { color: colors.text, ...type.cardTitle },
  noticeBody: { color: colors.textSecondary, ...type.body, lineHeight: 23, marginTop: 6 },

  section: {
    color: colors.text, ...type.section,
    paddingHorizontal: space.page, marginBottom: space.headingToContent,
  },

  row: { marginHorizontal: space.page, marginBottom: space.cardGap },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: space.cardPadding,
    padding: space.cardPadding,
  },
  thumb: {
    width: 92, height: 92, borderRadius: radius.image,
    backgroundColor: colors.surfaceGlass,
  },
  cardText: { flex: 1, gap: 5 },
  title: { color: colors.text, ...type.cardTitle },
  meta: { color: colors.textTertiary, ...type.meta },
  // Circular control: translucent fill, thin hairline, 44pt touch target.
  chevron: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceGlass, borderWidth: 1, borderColor: colors.borderGlassSoft,
  },
});
