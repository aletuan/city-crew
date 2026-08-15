import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, FlatList, Modal, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PlaceCard from '../components/PlaceCard';
import { AddSlot } from '../components/add';
import { AmbientWarmth, BackButton, Empty, GradientCta, RoundIconButton, useTabBarClearance } from '../components/ui';
import { useAuth } from '../lib/auth';
import { deleteCollection, membersOf, publishBlockers, setCollectionPublic } from '../lib/data';
import { atHandle } from '../lib/handle';
import { useCollections, usePlaces } from '../lib/catalog';
import { useSave } from '../lib/save';
import { useI18n } from '../lib/i18n';
import { colors, font, radius, space, type } from '../theme';
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
        <GradientCta
          icon="compass-outline"
          label={t('Explore places', 'Khám phá địa điểm', 'スポットを見る')}
          onPress={onExplore}
        />
      </View>
    </View>
  );
}

/**
 * A line in the overflow menu.
 *
 * Glyphs are neutral and only the destructive one is red. The sheet this
 * replaces tinted every glyph with `accent`, which on paper is `#C4402C`
 * against `bad`'s `#C2564A` — 1.15:1 apart, indistinguishable. Five red
 * rows meant Delete was not marked at all. Neutral against `bad` is
 * 4.11:1, so the red says something again.
 */
function MenuRow({ icon, label, onPress, danger, first }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  first?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.menuRow, !first && s.menuDivider, pressed && s.menuRowOn]}
    >
      <Ionicons name={icon} size={21} color={danger ? colors.bad : colors.text} />
      <Text style={[s.menuText, danger && { color: colors.bad }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/**
 * Why a list cannot be published, said in words rather than counted at
 * the reader.
 *
 * It names both kinds because they end differently. A place still under
 * review will resolve on its own; one that was not accepted never will,
 * and the list stays private forever until its owner takes it out. A
 * sentence that said only "some places are pending" would leave them
 * waiting for something that is not coming.
 */
function blockerSentence(
  { pending, flagged }: { pending: number; flagged: number },
  t: (en: string, vi: string, ja: string) => string,
): string {
  const parts: string[] = [];
  if (pending) {
    // Not public *yet* — the state the list is in, rather than the
    // procedure it is waiting on. The owner does not need to picture a
    // queue to understand why the switch will not move; they need to know
    // which places are holding it, and that this one resolves on its own.
    parts.push(t(
      `${pending} ${pending === 1 ? 'place is' : 'places are'} not public yet`,
      `${pending} địa điểm chưa công khai`,
      `${pending}件がまだ公開されていません`,
    ));
  }
  if (flagged) {
    parts.push(t(
      `${flagged} ${flagged === 1 ? 'was' : 'were'} not accepted`,
      `${flagged} địa điểm không được duyệt`,
      `${flagged}件が不採用です`,
    ));
  }
  return t(
    `Private until every place is live — ${parts.join(', and ')}.`,
    `Riêng tư cho tới khi mọi địa điểm hiển thị — ${parts.join(', và ')}.`,
    `すべてのスポットが公開されるまで非公開です — ${parts.join('、')}。`,
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
  const isPublic = !!col?.is_public;
  // Why this list cannot go out, counted rather than asserted. Derived
  // from the members every time the screen opens, so it is right after a
  // review lands without anything having to be told — and it disappears
  // by itself when the last one clears, which is a truer signal than a
  // message would be.
  //
  // Only the owner can compute this, and only because they are the one
  // person allowed to see their own unreviewed places. That is the same
  // permission the reminder exists to explain.
  const blockers = useMemo(() => publishBlockers(members), [members]);
  const blocked = blockers.pending + blockers.flagged > 0;
  const tabClearance = useTabBarClearance();

  const title = col ? t(col.title_en, col.title_vi, col.title_ja) : '';
  const insets = useSafeAreaInsets();
  const [menu, setMenu] = useState(false);
  // Where the popover hangs from. Measured off the button rather than
  // computed from paddings, because the header's height moves with the
  // title and the meta line and a menu that floats away from its control
  // stops looking like that control's menu.
  const btn = useRef<View>(null);
  const [anchor, setAnchor] = useState({ top: insets.top + 58, right: space.page });
  const openMenu = () => {
    // Opened first and positioned second: if the measure never calls back
    // the menu still appears, at the estimate above rather than not at all.
    setMenu(true);
    btn.current?.measureInWindow((x, y, w, h) => {
      if (!w) return;
      setAnchor({ top: y + h + 6, right: Dimensions.get('window').width - (x + w) });
    });
  };
  // Every action leaves this screen or opens an alert over it, and a menu
  // still standing behind either is the sort of thing you come back to and
  // have to dismiss twice.
  const act = (run: () => void) => { setMenu(false); run(); };

  // Explore is where places are, and saving one from there already offers
  // this list by name. A picker that wrote straight back into this
  // collection would be better, and is a screen rather than a button.
  const addPlace = () => navigation.getParent()?.navigate('Explore');

  const edit = () => col && navigation.navigate('CollectionForm', {
    slug: col.slug,
    title,
    desc: t(col.desc_en, col.desc_vi, col.desc_ja),
  });

  /**
   * Publish, or take it back.
   *
   * No confirmation on the way out, and a banner with Undo instead. An
   * alert asking "are you sure" before a reversible act is a toll on
   * everyone who meant it, paid so that the few who did not are stopped
   * one step earlier than the Undo would have stopped them. Publishing is
   * one boolean and unpublishing is the same boolean — the thing to
   * provide is a way back, not a gate.
   *
   * Both catalogs are reloaded because the row moves between them: it
   * leaves nothing in `mine`, which returns everything you own either
   * way, but it enters and leaves the public query, and that query is
   * what the other section is drawn from.
   */
  const [banner, setBanner] = useState<null | 'public' | 'private' | 'blocked'>(null);
  const [publishing, setPublishing] = useState(false);
  const setPublic = (next: boolean) => {
    if (!col || publishing) return;
    // The database refuses this too — that is where the rule lives. This
    // is so the answer arrives as a sentence about the list rather than
    // as `collection_has_pending_places` from Postgres.
    if (next && blocked) { setBanner('blocked'); return; }
    setPublishing(true);
    setCollectionPublic(col.slug, next)
      .then(() => {
        mine.reload();
        cols.reload();
        setBanner(next ? 'public' : 'private');
      })
      .catch((e: Error) => Alert.alert(
        next
          ? t('Could not publish', 'Không công khai được', '公開できませんでした')
          : t('Could not make private', 'Không chuyển riêng tư được', '非公開にできませんでした'),
        e.message,
      ))
      .finally(() => setPublishing(false));
  };

  // The banner stands until it is dismissed or the screen is left. It
  // holds the only Undo there is, so a timer would be a deadline on
  // changing your mind about who can see your list.
  const undo = () => setPublic(banner === 'public' ? false : true);

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
                  private collection looks the same wherever you meet it —
                  and a globe once it is not private any more.

                  Published reads first and in colour, because it is the
                  state worth checking before you leave the screen. Private
                  stays grey: it is the resting state and does not need
                  announcing. */}
              {owned && (
                <Ionicons
                  name={isPublic ? 'globe-outline' : 'lock-closed-outline'}
                  size={13}
                  color={isPublic ? colors.ok : colors.textTertiary}
                />
              )}
              {owned && isPublic && (
                <Text style={s.metaPublic}>{t('Public', 'Công khai', '公開')}</Text>
              )}
              <Text style={s.meta} numberOfLines={1}>
                {owned && isPublic ? '·  ' : ''}
                {members.length} {t('places', 'địa điểm', 'スポット')}
                {owned && !isPublic ? `  ·  ${t('Private', 'Riêng tư', '非公開')}` : ''}
                {col.curator_handle ? `  ·  ${t('by', 'bởi', 'by')} ${atHandle(col.curator_handle)}` : ''}
              </Text>
            </View>
          )}
        </View>
        {/* `collapsable={false}` keeps the wrapper as a real native view,
            which is what measureInWindow needs to have something to
            measure. */}
        {owned && (
          <View ref={btn} collapsable={false}>
            <RoundIconButton
              icon="ellipsis-horizontal"
              onPress={openMenu}
              label={t('More', 'Thêm', 'その他')}
            />
          </View>
        )}
      </View>
      {/* What just happened, and the way back out of it. Above the
          description rather than floating over the list: it is about the
          collection as a whole, and a toast that covers the first place
          card would be reporting on the list by hiding part of it.

          Dismissible by its own tick — the row is the acknowledgement, so
          tapping it is how you say you have read it. */}
      {banner && (
        <Pressable
          style={[s.banner, banner === 'private' && s.bannerQuiet]}
          onPress={() => setBanner(null)}
          accessibilityRole="button"
          accessibilityLiveRegion="polite"
        >
          <Ionicons
            name={banner === 'public' ? 'checkmark-circle' : banner === 'blocked' ? 'time-outline' : 'lock-closed'}
            size={19}
            color={banner === 'public' ? colors.ok : colors.textSecondary}
          />
          <Text style={s.bannerText} numberOfLines={3}>
            {banner === 'public'
              ? t(
                'This collection is now public',
                'Bộ sưu tập này giờ đã công khai',
                'このコレクションは公開されました',
              )
              : banner === 'blocked'
                ? blockerSentence(blockers, t)
                : t(
                  'This collection is private again',
                  'Bộ sưu tập này đã riêng tư trở lại',
                  'このコレクションは非公開に戻りました',
                )}
          </Text>
          {banner !== 'blocked' && (
            <Pressable onPress={undo} hitSlop={10} disabled={publishing}>
              <Text style={[s.bannerUndo, publishing && s.bannerUndoBusy]}>
                {t('Undo', 'Hoàn tác', '元に戻す')}
              </Text>
            </Pressable>
          )}
        </Pressable>
      )}
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
        // Only once there is a list to end. Empty, the card above is
        // already asking for the first place, and two invitations to do
        // one thing read as two different things.
        ListFooterComponent={owned && members.length > 0
          ? (
            <AddSlot
              onPress={addPlace}
              title={t('Add place', 'Thêm địa điểm', 'スポットを追加')}
              // The second line names where the places come from. Without
              // it the row is a verb with no object, and "Add place" alone
              // had already sent one reader to Explore expecting a picker.
              subtitle={t(
                'From search or your bookmarks',
                'Từ tìm kiếm hoặc mục đã lưu',
                '検索や保存済みから',
              )}
            />
          )
          : null}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: tabClearance }}
        showsVerticalScrollIndicator={false}
      />

      {/* Anchored under the control that opened it, which is the whole
          argument for a popover over a sheet: the menu is visibly this
          button's menu. No Cancel row — tapping anywhere off the card is
          the way out, and a menu that hangs off its own control does not
          need to explain that. */}
      <Modal
        visible={menu}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setMenu(false)}
      >
        <Pressable style={s.scrim} onPress={() => setMenu(false)} />
        <View style={[s.menu, { top: anchor.top, right: anchor.right }]}>
          <MenuRow
            icon="add-circle-outline"
            label={t('Add place', 'Thêm địa điểm', 'スポットを追加')}
            onPress={() => act(addPlace)}
            first
          />
          <MenuRow
            icon="create-outline"
            label={t('Edit collection', 'Sửa bộ sưu tập', 'コレクションを編集')}
            onPress={() => act(edit)}
          />
          <MenuRow
            icon="share-outline"
            label={t('Share', 'Chia sẻ', '共有')}
            onPress={() => act(share)}
          />
          {/* Above Delete, below the rest: it is the one row that changes
              who else can see this, which is a heavier thing than editing
              a title and a lighter one than destroying the list.

              The label is the action, not the state. "Public" with a tick
              would leave you working out which way the row is pointing;
              the header already says which one you are in. */}
          <MenuRow
            icon={isPublic ? 'lock-closed-outline' : 'globe-outline'}
            label={isPublic
              ? t('Make private', 'Chuyển riêng tư', '非公開にする')
              : t('Make public', 'Công khai', '公開する')}
            onPress={() => act(() => setPublic(!isPublic))}
          />
          <MenuRow
            icon="trash-outline"
            label={t('Delete collection', 'Xoá bộ sưu tập', 'コレクションを削除')}
            onPress={() => act(remove)}
            danger
          />
        </View>
      </Modal>
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
  // The one word on the line that is not grey. `ok` is the app's green and
  // measures 4.35:1 on paper, which small text needs; the padlock beside
  // it stays tertiary because a resting state does not need a colour.
  metaPublic: { color: colors.ok, ...type.meta, fontWeight: font.semibold },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: space.page, marginBottom: 12,
    paddingVertical: 11, paddingHorizontal: 14,
    borderRadius: radius.input,
    // A wash of the same green rather than a filled bar: the message is
    // good news about a small thing, and a solid green rail across the top
    // of the screen would announce it like an error.
    backgroundColor: colors.okSoft,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  bannerQuiet: { backgroundColor: colors.surfaceGlass },
  bannerText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: font.medium },
  bannerUndo: { color: colors.accent, fontSize: 15, fontWeight: font.semibold },
  bannerUndoBusy: { opacity: 0.4 },

  desc: {
    color: colors.textSecondary, ...type.body, lineHeight: 24,
    paddingHorizontal: space.page, paddingBottom: 12,
  },

  // The dashed slot at the end of the list, matching the collections
  // screen's own last row down to the well and the gap.

  // Lighter than the sheet's scrim was. A popover keeps its context —
  // you can still read the row you are acting on — where a sheet takes
  // the screen and has to dim what it covers.
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,5,8,0.22)' },
  menu: {
    position: 'absolute', minWidth: 232, maxWidth: 300,
    backgroundColor: colors.bgElevated, borderRadius: 16, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
    // The one shadow in the app. Depth everywhere else comes from the
    // ground and hairlines, but this layer genuinely floats above the
    // page and a hairline alone does not say so.
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 18 },
  menuRowOn: { backgroundColor: colors.surfaceGlass },
  menuDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  menuText: { color: colors.text, fontSize: 16.5, lineHeight: 22, fontWeight: font.medium },

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
});
