import React, { useMemo } from 'react';
import { ActivityIndicator, Alert, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import PlaceCard from '../components/PlaceCard';
import { AmbientWarmth, BackButton, Empty, PressableScale, RoundIconButton, useTabBarClearance } from '../components/ui';
import { useAuth } from '../lib/auth';
import { deleteCollection, membersOf } from '../lib/data';
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

/**
 * One of the owner's three actions.
 *
 * The first is the gradient; the rest are the glass pill the app uses for
 * a secondary control. Sized to their labels rather than stretched to
 * thirds, because "Add place" and "Edit" are not the same weight of
 * decision and equal widths would say they were.
 */
function Action({ icon, label, onPress, primary }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const body = (
    <>
      <Ionicons name={icon} size={18} color={primary ? colors.accentInk : colors.text} />
      <Text style={[s.actionText, primary && s.actionTextPrimary]} numberOfLines={1}>{label}</Text>
    </>
  );
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      {primary
        ? <LinearGradient {...gradAI} style={s.action}>{body}</LinearGradient>
        : <View style={[s.action, s.actionGlass]}>{body}</View>}
    </PressableScale>
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

  const title = col ? t(col.title_en, col.title_vi, col.title_ja) : '';

  // Explore is where places are, and saving one from there already offers
  // this list by name. A picker that wrote straight back into this
  // collection would be better, and is a screen rather than a button.
  const addPlace = () => navigation.getParent()?.navigate('Explore');

  const edit = () => col && navigation.navigate('CollectionForm', {
    slug: col.slug,
    title,
    desc: t(col.desc_en, col.desc_vi, col.desc_ja),
  });

  // Deliberately inert. A private list has no address to send anyone to,
  // so the honest placeholder says that rather than opening a share sheet
  // onto a link that would 404 for whoever received it.
  const share = () => Alert.alert(
    t('Sharing is coming', 'Sắp có chia sẻ', '共有は近日公開'),
    t(
      'Your collections are private for now. Sharing one with the crew is on the way.',
      'Bộ sưu tập của bạn hiện đang riêng tư. Tính năng chia sẻ với hội bạn sẽ sớm có.',
      'コレクションは現在非公開です。共有機能は近日公開予定です。',
    ),
  );

  const remove = () => Alert.alert(
    t('Delete this collection?', 'Xoá bộ sưu tập này?', 'このコレクションを削除しますか？'),
    t(`"${title}" will be gone for good.`, `"${title}" sẽ mất hẳn.`, `「${title}」は完全に削除されます。`),
    [
      { text: t('Cancel', 'Huỷ', 'キャンセル'), style: 'cancel' },
      {
        text: t('Delete', 'Xoá', '削除'),
        style: 'destructive',
        onPress: () => {
          if (!col) return;
          deleteCollection(col.slug)
            // Leaving first: the screen is about a row that no longer
            // exists, and the list behind it is where the outcome shows.
            .then(() => { navigation.goBack(); mine.reload(); })
            .catch((e: Error) => Alert.alert(t('Could not delete', 'Không xoá được', '削除できませんでした'), e.message));
        },
      },
    ],
  );

  // Delete is the only owner action with no other home on this screen, so
  // the overflow holds exactly it. A menu of one looks thin, but the
  // alternative is a fourth button in the row giving a destructive action
  // the same standing as "Edit".
  const more = () => Alert.alert(title, undefined, [
    { text: t('Delete collection', 'Xoá bộ sưu tập', 'コレクションを削除'), style: 'destructive', onPress: remove },
    { text: t('Cancel', 'Huỷ', 'キャンセル'), style: 'cancel' },
  ]);

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <AmbientWarmth />
      <View style={s.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          {col && (
            <View style={s.metaRow}>
              {/* The padlock the list already uses for the same fact, so a
                  private collection looks the same wherever you meet it. */}
              {owned && <Ionicons name="lock-closed-outline" size={13} color={colors.textTertiary} />}
              <Text style={s.meta} numberOfLines={1}>
                {members.length} {t('places', 'địa điểm', 'スポット')}
                {owned ? `  ·  ${t('Private', 'Riêng tư', '非公開')}` : ''}
                {col.curator_handle ? `  ·  ${t('by', 'bởi', 'by')} ${col.curator_handle}` : ''}
              </Text>
            </View>
          )}
        </View>
        {owned && (
          <RoundIconButton
            icon="ellipsis-horizontal"
            onPress={more}
            label={t('More', 'Thêm', 'その他')}
          />
        )}
      </View>
      {col && (col.desc_en || col.desc_vi) && (
        <Text style={s.desc}>{t(col.desc_en, col.desc_vi, col.desc_ja)}</Text>
      )}
      {/* Scrolls rather than wraps or squeezes. Three labels fit across a
          phone in English and do not in Vietnamese, and a row that quietly
          becomes swipeable beats one that truncates "Thêm địa điểm". */}
      {owned && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.actions}
        >
          <Action icon="add" label={t('Add place', 'Thêm địa điểm', 'スポットを追加')} onPress={addPlace} primary />
          <Action icon="create-outline" label={t('Edit', 'Sửa', '編集')} onPress={edit} />
          <Action icon="share-outline" label={t('Share', 'Chia sẻ', '共有')} onPress={share} />
        </ScrollView>
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
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  meta: { color: colors.textTertiary, ...type.meta },
  desc: {
    color: colors.textSecondary, ...type.body, lineHeight: 24,
    paddingHorizontal: space.page, paddingBottom: 12,
  },

  // Padding on the content, not the ScrollView: on the view it would clip
  // the first pill against the edge as the row scrolls.
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: space.page, paddingBottom: 14 },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.pill,
  },
  actionGlass: {
    backgroundColor: colors.surfaceGlassStrong,
    borderWidth: 1, borderColor: colors.borderGlassSoft,
  },
  actionText: { color: colors.text, fontSize: 15.5, fontWeight: font.semibold },
  actionTextPrimary: { color: colors.accentInk },

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
