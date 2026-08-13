import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import PlaceCard from '../components/PlaceCard';
import { AmbientWarmth, BackButton, Empty, PressableScale, useTabBarClearance } from '../components/ui';
import { useAuth } from '../lib/auth';
import { membersOf } from '../lib/data';
import { useCollections, usePlaces } from '../lib/catalog';
import { useSave } from '../lib/save';
import { useI18n } from '../lib/i18n';
import { colors, font, gradAI, radius, space, type } from '../theme';
import type { Nav, RootRoute } from '../nav';

/**
 * The empty state of a list you own.
 *
 * A public collection that is empty is a mistake at the desk; one of yours
 * is just new, and the screen should hand you the way forward instead of
 * reporting the absence twice.
 */
function OwnEmpty({ onExplore }: { onExplore: () => void }) {
  const { t } = useI18n();
  return (
    <View style={s.emptyWrap}>
      <View style={s.empty}>
        <View style={s.emptyIcon}>
          <Ionicons name="bookmark-outline" size={26} color={colors.accent} />
        </View>
        {/* One line. The second sentence was telling you to go looking,
            which is what the button underneath already says — a card this
            small should not say the same thing twice, once in prose and
            once as a control. */}
        <Text style={s.emptyBody}>
          {t('Nothing here yet.', 'Chưa có gì ở đây.', 'まだ何もありません。')}
        </Text>
        <PressableScale onPress={onExplore} accessibilityRole="button">
          <LinearGradient {...gradAI} style={s.emptyCta}>
            <Ionicons name="compass-outline" size={19} color={colors.accentInk} />
            <Text style={s.emptyCtaText}>{t('Explore places', 'Khám phá địa điểm', 'スポットを見る')}</Text>
          </LinearGradient>
        </PressableScale>
      </View>
    </View>
  );
}

export default function CollectionDetailScreen({ navigation, route }: { navigation: Nav; route: RootRoute<'CollectionDetail'> }) {
  const { t } = useI18n();
  const { session } = useAuth();
  const uid = session?.user?.id;
  const cols = useCollections();
  // Both catalogs, because the public query excludes owned rows: a list of
  // your own would otherwise open on "Collection not found". The owned half
  // comes from the shared copy, so a place saved from anywhere shows here.
  const { mine } = useSave();
  const { data: places, loading: placesLoading } = usePlaces();
  const col = useMemo(
    () => [...mine.data, ...cols.data].find((c) => c.slug === route.params.slug),
    [mine.data, cols.data, route.params.slug],
  );
  const members = useMemo(() => (col ? membersOf(col, places) : []), [col, places]);
  const loading = cols.loading || mine.loading || placesLoading;
  const owned = !!col?.owner_id && col.owner_id === uid;
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
        ListEmptyComponent={!loading && col
          ? (owned
            // One message, not two. The reference stacks "No places in this
            // collection yet." above a card that says the same thing again.
            ? <OwnEmpty onExplore={() => navigation.getParent()?.navigate('Explore')} />
            : <Empty text={t(
              'No places in this collection yet.',
              'Bộ sưu tập này chưa có địa điểm nào.',
              'このコレクションにはまだスポットがありません。',
            )} />)
          : null}
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

  emptyWrap: { marginHorizontal: space.page, marginTop: 24 },
  empty: {
    alignItems: 'center', gap: 14,
    paddingHorizontal: space.cardPadding + 6, paddingTop: 26, paddingBottom: 24,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.card,
  },
  emptyIcon: {
    width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentLine,
  },
  // 16, not 15: it is one short line now rather than a paragraph, and at
  // the smaller size it read as a caption under the glyph.
  emptyBody: {
    color: colors.textSecondary, fontSize: 16, lineHeight: 22, textAlign: 'center',
  },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 22, paddingVertical: 13, borderRadius: radius.pill,
  },
  emptyCtaText: { color: colors.accentInk, fontSize: 16, fontWeight: font.semibold },
});
