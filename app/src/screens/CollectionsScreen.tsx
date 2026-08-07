// Collections — guest welcome banner, "Public collections" section, and
// roomy cards: big rounded thumbnail, title, "n places · by @curator" meta,
// and a circular chevron button (per the reference design).
//
// Each card glows: an amber platform shadow with a wide radius. The OS
// renders the falloff, so the halo is always soft-edged and stays on the
// brand's warm tone regardless of what colours the cover photo happens to
// carry — a blurred copy of the photo can't do either (hard view bounds,
// and a green park would wash the page green).

import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Card, Empty, Screen } from '../components/ui';
import { Collection, coverOf, membersOf, useCollections, usePlaces } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { colors, font, radius } from '../theme';
import type { Nav } from '../nav';

function GuestBanner() {
  const { t } = useI18n();
  return (
    <View style={s.banner}>
      <Text style={s.bannerTitle}>
        👋 {t("You're browsing as a guest", 'Bạn đang xem với tư cách khách')}
      </Text>
      <Text style={s.bannerText}>
        {t(
          'Public collections are curated by local explorers. Sign in to create and share your own.',
          'Bộ sưu tập công khai do người bản địa tuyển chọn. Đăng nhập để tạo và chia sẻ bộ sưu tập của riêng bạn.',
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
      {cols.loading && <ActivityIndicator color={colors.aiPink} style={{ marginTop: 48 }} />}
      {cols.error && <Empty text={t(`Couldn't load collections: ${cols.error}`, `Không tải được bộ sưu tập: ${cols.error}`)} />}
      {!cols.loading && !cols.error && (
        <FlatList
          data={cols.data}
          keyExtractor={(c) => c.slug}
          ListHeaderComponent={
            <>
              <GuestBanner />
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
                  <View style={{ flex: 1 }}>
                    <Text style={s.title} numberOfLines={2}>{t(item.title_en, item.title_vi)}</Text>
                    <Text style={s.meta} numberOfLines={1}>
                      {count} {t('places', 'địa điểm')}
                      {item.curator_handle ? `  ·  ${t('by', 'bởi')} ${item.curator_handle}` : ''}
                    </Text>
                  </View>
                  <View style={s.chevron}>
                    <Ionicons name="chevron-forward" size={18} color={colors.text} />
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
  banner: {
    marginHorizontal: 20, marginBottom: 22,
    backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.card, padding: 18,
  },
  bannerTitle: { color: colors.text, fontSize: 16.5, fontFamily: font.bold, letterSpacing: -0.2 },
  bannerText: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, fontFamily: font.regular, marginTop: 7 },

  section: {
    color: colors.text, fontSize: 21, fontFamily: font.extrabold, letterSpacing: -0.4,
    paddingHorizontal: 20, marginBottom: 14,
  },

  // Carries the amber glow. Needs an opaque background and a matching
  // radius for the platform to cast the shadow from the card's shape.
  row: {
    marginHorizontal: 20, marginBottom: 22,
    borderRadius: radius.card, backgroundColor: colors.bgElevated,
    shadowColor: colors.aiAmber, shadowOpacity: 0.32, shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 }, elevation: 10,
  },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 16, padding: 14,
    borderColor: 'rgba(246,164,92,0.22)',
    // Must stay visible or iOS clips the drop shadow; the thumbnail
    // rounds its own corners, so nothing here needs clipping.
    overflow: 'visible',
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  thumb: { width: 104, height: 104, borderRadius: 22, backgroundColor: colors.surfaceGlass },
  title: { color: colors.text, fontSize: 19, fontFamily: font.bold, letterSpacing: -0.3 },
  meta: { color: colors.textTertiary, fontSize: 13.5, fontFamily: font.medium, marginTop: 6 },
  chevron: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceGlass, borderWidth: 1, borderColor: colors.borderGlassSoft,
  },
});
