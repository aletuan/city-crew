// Collections — one obvious purpose: browse curated city lists.
//
// Hierarchy per the design system: large title, a quiet guest notice,
// then the browsable list. Depth comes from the near-black ground, an
// ambient warmth that all but disappears into it, translucent charcoal
// surfaces and thin warm hairlines — not from shadows.

import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AmbientWarmth, Card, Empty, PressableScale, Screen, Skeleton, useTabBarClearance } from '../components/ui';
import { useAuth } from '../lib/auth';
import { Collection, coverOf, membersOf, useCollections, usePlaces } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { colors, font, gradAI, radius, space, type } from '../theme';
import type { Nav } from '../nav';

// The card sells signing in, so it leads with what you get rather than with
// what you are: "browsing as a guest" names a limitation and leaves the
// reader to work out the offer for themselves.
//
// The whole card is the target and the chip inside it is drawn, not pressed —
// a Pressable nested inside a Pressable gives one action two overlapping hit
// areas and two stops in VoiceOver, for no gain.
//
// Sign-in lives in the Profile tab's stack, not this one, so the jump goes
// through the tab navigator above us.
function GuestNotice({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { session } = useAuth();
  if (session) return null;
  return (
    <PressableScale
      containerStyle={s.noticeWrap}
      style={s.notice}
      onPress={() => navigation.getParent()?.navigate('Profile', { screen: 'SignIn' })}
      accessibilityRole="button"
      accessibilityLabel={t(
        'Sign in to build your own collections',
        'Đăng nhập để tạo bộ sưu tập của riêng bạn',
        'サインインして自分のコレクションを作る',
      )}
    >
      <View style={s.noticeHead}>
        {/* The Collections tab's own glyph, so the card belongs to this
            screen instead of reading as a generic account banner. */}
        <View style={s.noticeIcon}>
          <Ionicons name="bookmark" size={19} color={colors.accent} />
        </View>
        <View style={s.noticeCopy}>
          <Text style={s.noticeTitle}>
            {t('Start your own collection', 'Tạo bộ sưu tập của riêng bạn', '自分のコレクションを作る')}
          </Text>
          <Text style={s.noticeBody}>
            {t(
              'Sign in to save places you like and group them into lists.',
              'Đăng nhập để lưu địa điểm bạn thích và nhóm lại thành danh sách.',
              'サインインすると気になるスポットを保存し、リストにまとめられます。',
            )}
          </Text>
        </View>
      </View>
      {/* A rounded rectangle at chip scale, the sheet's primary button
          scaled down. Sized to its label rather than stretched: the card is
          already the target, so this names the action — it does not need to
          be the loudest object on the screen. */}
      <LinearGradient {...gradAI} style={s.noticeChip}>
        <Text style={s.noticeChipText}>{t('Sign in', 'Đăng nhập', 'サインイン')}</Text>
        <Ionicons name="arrow-forward" size={15} color={colors.accentInk} />
      </LinearGradient>
    </PressableScale>
  );
}

export default function CollectionsScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const cols = useCollections();
  const { data: places, loading: placesLoading } = usePlaces();
  const tabClearance = useTabBarClearance();
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
            <GuestNotice navigation={navigation} />
            <Text style={s.section}>{t('Public collections', 'Bộ sưu tập công khai', '公開コレクション')}</Text>
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
                <GuestNotice navigation={navigation} />
                <Text style={s.section}>{t('Public collections', 'Bộ sưu tập công khai', '公開コレクション')}</Text>
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
                      <Text style={s.title} numberOfLines={2}>{t(item.title_en, item.title_vi, item.title_ja)}</Text>
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
  // Margins stay on the Pressable; the card itself is what scales.
  noticeWrap: { marginHorizontal: space.page, marginBottom: space.titleToContent },
  notice: {
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
    borderRadius: radius.card, paddingHorizontal: space.cardPadding, paddingVertical: 17,
  },
  noticeHead: { flexDirection: 'row', gap: 13 },
  // Tinted well, not a filled disc: the filled accent shape belongs to the
  // selected tab, and two of them on one screen both claim to be the
  // thing you last touched.
  noticeIcon: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentLine,
  },
  noticeCopy: { flex: 1, gap: 4 },
  noticeTitle: { color: colors.text, ...type.cardTitle },
  // A step down from `type.body`: this is the supporting line, and at body
  // size it read as loud as the collection titles underneath it.
  noticeBody: { color: colors.textSecondary, fontSize: 14.5, lineHeight: 20 },
  noticeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start',
    // 40 + 13: the icon well and its gap, so the chip starts on the text's
    // left edge rather than under the icon.
    marginTop: 14, marginLeft: 53,
    paddingHorizontal: 18, paddingVertical: 11, borderRadius: 14,
  },
  noticeChipText: { color: colors.accentInk, fontSize: 15, fontWeight: font.semibold },

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
