// Collections — one obvious purpose: browse curated city lists.
//
// Hierarchy per the design system: large title, a quiet guest notice,
// then the browsable list. Depth comes from the near-black ground, an
// ambient warmth that all but disappears into it, translucent charcoal
// surfaces and thin warm hairlines — not from shadows.

import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AmbientWarmth, Card, Empty, PressableScale, Screen, Skeleton, useSerif, useTabBarClearance } from '../components/ui';
import { useAuth } from '../lib/auth';
import { Collection, coverOf, membersOf, useCollections, usePlaces } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { colors, radius, space, type } from '../theme';
import type { Nav } from '../nav';

function GuestNotice() {
  const { t } = useI18n();
  const { session } = useAuth();
  if (session) return null;
  return (
    <View style={s.notice}>
      <Text style={s.noticeTitle}>
        👋 {t("You're browsing as a guest", 'Bạn đang xem với tư cách khách', 'ゲストとして閲覧中です')}
      </Text>
      <Text style={s.noticeBody}>
        {t(
          'Public collections are curated by local explorers. Signing in adds your own lists.',
          'Bộ sưu tập công khai do người bản địa tuyển chọn. Đăng nhập để thêm danh sách của riêng bạn.',
          '公開コレクションは地元の案内人が厳選。サインインすると自分のリストも作れます。',
        )}
      </Text>
    </View>
  );
}

export default function CollectionsScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const cols = useCollections();
  const { data: places, loading: placesLoading } = usePlaces();
  const tabClearance = useTabBarClearance();
  const serif = useSerif();
  // Counting and filtering need the places catalog — until it's in, hold
  // the skeleton rather than showing raw DB membership numbers.
  const loading = cols.loading || placesLoading;
  const visible = cols.data.filter((c) => membersOf(c, places).length > 0);

  const coverFor = (c: Collection) =>
    c.cover?.photo_uri ?? (membersOf(c, places)[0] && coverOf(membersOf(c, places)[0])?.photo_uri);

  return (
    <Screen title={t('Collections', 'Bộ sưu tập', 'コレクション')}>
      <View style={{ flex: 1 }}>
        <AmbientWarmth />
        {loading && (
          <View>
            <GuestNotice />
            <Text style={[s.section, serif]}>{t('Public collections', 'Bộ sưu tập công khai', '公開コレクション')}</Text>
            {[0, 1, 2].map((i) => (
              <View key={i} style={s.row}>
                <Card style={s.card}>
                  <Skeleton style={s.thumb} />
                  <View style={s.cardText}>
                    <Skeleton style={{ height: 18, width: '70%', borderRadius: 8 }} />
                    <Skeleton style={{ height: 13, width: '45%', borderRadius: 7 }} />
                  </View>
                </Card>
              </View>
            ))}
          </View>
        )}
        {!loading && cols.error && <Empty text={t(`Couldn't load collections: ${cols.error}`, `Không tải được bộ sưu tập: ${cols.error}`, `読み込みに失敗しました: ${cols.error}`)} />}
        {!loading && !cols.error && (
          <FlatList
            data={visible}
            keyExtractor={(c) => c.slug}
            ListHeaderComponent={
              <>
                <GuestNotice />
                <Text style={[s.section, serif]}>{t('Public collections', 'Bộ sưu tập công khai', '公開コレクション')}</Text>
              </>
            }
            renderItem={({ item }) => {
              const count = membersOf(item, places).length;
              const uri = coverFor(item);
              return (
                <PressableScale
                  style={s.row}
                  onPress={() => navigation.navigate('CollectionDetail', { slug: item.slug })}
                >
                  <Card style={s.card}>
                    {uri
                      ? <Image source={{ uri }} style={s.thumb} contentFit="cover" transition={200} />
                      : <View style={s.thumb} />}
                    <View style={s.cardText}>
                      <Text style={[s.title, serif]} numberOfLines={2}>{t(item.title_en, item.title_vi, item.title_ja)}</Text>
                      <Text style={s.meta} numberOfLines={1}>
                        {count} {t('places', 'địa điểm', 'スポット')}
                        {item.curator_handle ? `  ·  ${t('by', 'bởi', 'by')} ${item.curator_handle}` : ''}
                      </Text>
                    </View>
                    <View style={s.chevron}>
                      <Ionicons name="chevron-forward" size={17} color={colors.textSecondary} />
                    </View>
                  </Card>
                </PressableScale>
              );
            }}
            ListEmptyComponent={<Empty text={t('No public collections yet.', 'Chưa có bộ sưu tập công khai.', '公開コレクションはまだありません。')} />}
            contentContainerStyle={{ paddingBottom: tabClearance }}
            showsVerticalScrollIndicator={false}
            onRefresh={cols.reload}
            refreshing={loading}
          />
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
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
  title: { color: colors.text, ...type.cardTitleSerif },
  meta: { color: colors.textTertiary, ...type.meta },
  // Circular control: translucent fill, thin hairline, 44pt touch target.
  chevron: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceGlass, borderWidth: 1, borderColor: colors.borderGlassSoft,
  },
});
