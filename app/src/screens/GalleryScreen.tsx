// The gallery of a place, kept by the guide who brought the place in.
//
// ── what this screen is ──
//
// The desk has always been able to do everything to a place's
// photographs. The guide could add one and take their own back, and
// asked the desk for the rest. This is the rest, inside the boundary
// `lib/gallery` states: their own uploads and the importer's are theirs
// to arrange, the desk's uploads are not, and a photograph the desk hid
// stays hidden. Both sides write the same rows, so what one does the
// other sees on its next read — which is the sense in which the two are
// in step, and the whole of it.
//
// ── three modes, one grid ──
//
// A tile has three jobs and they do not fit on one tile at once. Looking
// at the gallery, a tile opens its menu. Putting it in order, a tile
// carries arrows. Choosing several to delete, a tile is a tick. So the
// grid has a mode, the toolbar under the header switches it, and a tile
// draws whichever face the mode calls for. Order and choice are held in
// state until they are confirmed, so a change of mind costs nothing —
// "Cancel" throws the draft away and the rows were never touched.
//
// Arrows rather than a drag, deliberately. A drag on a grid of
// photographs needs a long-press to begin, a lifted tile, and a rule for
// what happens over the toolbar; each is a thing to get wrong on a phone
// and none can be seen in jsdom. Two arrows on a tile are a tap each,
// are obvious in every language, and `moveId` is the whole of the logic.
//
// ── what is not here ──
//
// No tags, no captions, no crop. Version one is the desk's four verbs —
// cover, hide, order, delete — and nothing the desk cannot do yet.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import ActionSheet, { sheetHeader, type SheetAction } from '../components/ActionSheet';
import { AddPill } from '../components/add';
import { Card, Empty, PressableScale, Screen, successHaptic, useTabBarClearance } from '../components/ui';
import { useAddPhoto } from '../components/useAddPhoto';
import { useAuth } from '../lib/auth';
import { usePlaces } from '../lib/catalog';
import {
  fetchGallery, fetchPlaceId, removePlacePhoto, reorderGallery, setCover, setHidden, usePlaceBySlug,
} from '../lib/data';
import {
  canKeepGallery, galleryActions, galleryIds, galleryOrder, isOwnPhoto, moveId,
  type GalleryAction, type GalleryPhoto,
} from '../lib/gallery';
import { MAX_PER_PLACE } from '../lib/guide';
import { useI18n } from '../lib/i18n';
import { splitName } from '../lib/name';
import { useIsGuide } from '../lib/useGuideGrant';
import { colors, display, font, onPhoto, radius, space } from '../theme';
import type { Nav, RootRoute } from '../nav';

type Mode = 'view' | 'order' | 'pick';

const COLS = 3;
const GAP = 6;

export default function GalleryScreen({ navigation, route }: { navigation: Nav; route: RootRoute<'Gallery'> }) {
  const { t } = useI18n();
  const { slug } = route.params;
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;
  const granted = useIsGuide();
  const me = useMemo(() => ({ uid, granted }), [uid, granted]);
  const { width } = useWindowDimensions();
  const tabClearance = useTabBarClearance();

  // The place, for its name and its `submitted_by`. From the catalog when
  // it is there, and by its own fetch when it is not — a place still
  // waiting at the desk is exactly where this screen is most useful, and
  // that one is not in the catalog. Same two-step `PlaceDetail` takes.
  const { loading: catalogLoading, data: places, reload: reloadCatalog } = usePlaces();
  const inCatalog = useMemo(() => places.find((p) => p.slug === slug), [places, slug]);
  const elsewhere = usePlaceBySlug(!catalogLoading && !inCatalog ? slug : null);
  const place = inCatalog ?? elsewhere.data ?? null;
  const mayKeep = place ? canKeepGallery(place, me) : false;

  const [placeId, setPlaceId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[] | null>(null);
  const [mode, setMode] = useState<Mode>('view');
  // The draft order and the draft choice, each meaningful in one mode.
  const [draft, setDraft] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [menuFor, setMenuFor] = useState<GalleryPhoto | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = useCallback((e: unknown) => {
    Alert.alert(
      t('That did not work', 'Chưa làm được', 'うまくいきませんでした'),
      e instanceof Error ? e.message : String(e),
    );
  }, [t]);

  // Its own read, hidden rows included — see `fetchGallery` for why the
  // catalog's embed will not do. The id is looked up once and kept: every
  // write after this one names the place by it.
  const load = useCallback(async () => {
    const id = placeId ?? await fetchPlaceId(slug);
    if (!id) { setPhotos([]); return; }
    setPlaceId(id);
    setPhotos(galleryOrder(await fetchGallery(id)));
  }, [placeId, slug]);

  useEffect(() => {
    if (!mayKeep) return;
    load().catch(fail);
    // Once, when the boundary opens. `load` changes when the id lands and
    // that is not a reason to read again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mayKeep]);

  // Every write, the same way: do it, read the gallery back, and tell the
  // catalog so the detail screen behind this one draws the new cover on
  // the way back. Reading back rather than patching state is what keeps
  // this screen honest about the desk: whatever the desk did in between
  // arrives with the answer.
  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    try {
      await job();
      await load();
      reloadCatalog();
      successHaptic();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const adder = useAddPhoto({
    place: place ?? { slug },
    placeId,
    count: photos?.length ?? 0,
    onAdded: () => { load().catch(fail); reloadCatalog(); },
  });

  const name = place ? splitName(t(place.name_en, place.name_vi, place.name_ja)).title : '';
  const shown = photos ?? [];
  const ordered = mode === 'order'
    ? draft.map((id) => shown.find((p) => p.id === id)!).filter(Boolean)
    : shown;
  const mine = shown.filter((p) => isOwnPhoto(p, me));
  // The cell: the page's width less its margins, shared three ways with
  // two gutters between. Square, because a gallery of mixed aspect
  // ratios is a gallery whose rows never line up.
  const cell = Math.floor((width - space.page * 2 - GAP * (COLS - 1)) / COLS);

  // ── the menu on one photograph ──

  const confirmDelete = (ids: string[]) => Alert.alert(
    ids.length === 1
      ? t('Delete this photo?', 'Xoá ảnh này?', 'この写真を削除しますか？')
      : t(`Delete ${ids.length} photos?`, `Xoá ${ids.length} ảnh?`, `${ids.length}枚の写真を削除しますか？`),
    t(
      'It comes off the place for everyone. This cannot be undone.',
      'Ảnh sẽ biến mất khỏi địa điểm với mọi người. Không hoàn tác được.',
      'この場所から全員に対して消えます。元に戻せません。',
    ),
    [
      { text: t('Cancel', 'Huỷ', 'キャンセル'), style: 'cancel' },
      {
        text: t('Delete', 'Xoá', '削除'),
        style: 'destructive',
        onPress: () => {
          void run(async () => { for (const id of ids) await removePlacePhoto(id); });
          setMode('view');
          setPicked([]);
        },
      },
    ],
  );

  const actionRow = (photo: GalleryPhoto, a: GalleryAction): SheetAction => ({
    cover: {
      key: a, icon: 'star-outline' as const,
      title: t('Make it the cover', 'Đặt làm ảnh bìa', 'カバーにする'),
      desc: t('The picture that stands for the place, first wherever it appears.', 'Ảnh đại diện cho địa điểm, đứng đầu ở mọi nơi.', 'この場所を代表する写真になり、どこでも先頭に出ます。'),
      onPress: () => { void run(() => setCover(photo.id)); },
    },
    hide: {
      key: a, icon: 'eye-off-outline' as const,
      title: t('Hide it', 'Ẩn ảnh', '非表示にする'),
      desc: t('Readers stop seeing it. You can show it again.', 'Người xem không thấy nữa. Bạn hiện lại được.', '読者には見えなくなります。再表示できます。'),
      onPress: () => { void run(() => setHidden(photo.id, true)); },
    },
    unhide: {
      key: a, icon: 'eye-outline' as const,
      title: t('Show it again', 'Hiện lại', '再表示する'),
      desc: t('Back on the place for everyone.', 'Trở lại địa điểm với mọi người.', 'この場所に再び表示されます。'),
      onPress: () => { void run(() => setHidden(photo.id, false)); },
    },
    delete: {
      key: a, icon: 'trash-outline' as const, destructive: true,
      title: t('Delete it', 'Xoá ảnh', '削除する'),
      desc: t('Gone from the place, for good.', 'Xoá hẳn khỏi địa điểm.', 'この場所から完全に消えます。'),
      onPress: () => confirmDelete([photo.id]),
    },
  }[a]);

  // Where a photograph came from, for the sheet's header — the one fact
  // that explains why a menu is short. The desk's upload never opens a
  // menu, so "the desk" is never printed here; it is printed on the tile.
  const provenance = (p: GalleryPhoto) => [
    p.source === 'google'
      ? t('From Google', 'Từ Google', 'Googleから')
      : t('Your upload', 'Bạn đã tải lên', 'あなたがアップロード'),
    p.is_cover ? t('Cover', 'Ảnh bìa', 'カバー') : null,
    p.is_hidden ? t('Hidden', 'Đã ẩn', '非表示') : null,
  ].filter(Boolean).join(' · ');

  // ── modes ──

  const startOrder = () => { setDraft(galleryIds(shown)); setMode('order'); };
  const startPick = () => { setPicked([]); setMode('pick'); };
  const cancel = () => { setMode('view'); setPicked([]); };
  const saveOrder = () => {
    setMode('view');
    if (!placeId || draft.join() === galleryIds(shown).join()) return;
    void run(() => reorderGallery(placeId, draft));
  };
  const togglePick = (id: string) =>
    setPicked((was) => (was.includes(id) ? was.filter((x) => x !== id) : [...was, id]));

  // ── faces ──

  if ((catalogLoading || elsewhere.loading) && !place) {
    return (
      <Screen title={t('Gallery', 'Gallery', 'ギャラリー')} onBack={() => navigation.goBack()}>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 64 }} />
      </Screen>
    );
  }
  // Nobody reaches this by accident — the door is drawn for the keeper
  // alone — but a route can be typed, and this is what it says.
  if (!place || !mayKeep) {
    return (
      <Screen title={t('Gallery', 'Gallery', 'ギャラリー')} onBack={() => navigation.goBack()}>
        <Empty text={t('This is not yours to keep.', 'Đây không phải gallery của bạn.', 'これはあなたのギャラリーではありません。')} />
      </Screen>
    );
  }

  return (
    <Screen
      title={t('Gallery', 'Gallery', 'ギャラリー')}
      subtitle={name}
      onBack={() => navigation.goBack()}
      // The one invitation on the screen. Not repeated as a tile in the
      // grid: two offers to do one thing read as two different things,
      // the rule `AddPill` states.
      right={mode === 'view' ? (
        <AddPill
          header
          label={adder.busy ? '…' : t('Add', 'Thêm', '追加')}
          accessibilityLabel={t('Add a photo', 'Thêm ảnh', '写真を追加')}
          onPress={() => { if (!adder.busy) void adder.add(); }}
        />
      ) : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.page, paddingTop: 4, paddingBottom: tabClearance, gap: space.cardGap }}
        showsVerticalScrollIndicator={false}
      >
        {/* The toolbar. Two quiet pills while looking; while in a mode,
            the way out and the way through, and nothing else — a mode
            with a third button is a mode you can leave by accident. */}
        {shown.length > 0 && (
          <View style={s.tools} testID="gallery-tools">
            {mode === 'view' && (
              <>
                {shown.length > 1 && (
                  <Tool icon="swap-vertical-outline" label={t('Reorder', 'Sắp xếp', '並べ替え')} onPress={startOrder} testID="gallery-reorder" />
                )}
                {mine.length > 0 && (
                  <Tool icon="checkmark-circle-outline" label={t('Select', 'Chọn', '選択')} onPress={startPick} testID="gallery-select" />
                )}
              </>
            )}
            {mode === 'order' && (
              <>
                <Tool icon="close" label={t('Cancel', 'Huỷ', 'キャンセル')} onPress={cancel} testID="gallery-cancel" />
                <Tool icon="checkmark" label={t('Save order', 'Lưu thứ tự', '順番を保存')} onPress={saveOrder} primary testID="gallery-save-order" />
              </>
            )}
            {mode === 'pick' && (
              <>
                <Tool icon="close" label={t('Cancel', 'Huỷ', 'キャンセル')} onPress={cancel} testID="gallery-cancel" />
                <Tool
                  icon="trash-outline"
                  label={picked.length
                    ? t(`Delete ${picked.length}`, `Xoá ${picked.length}`, `${picked.length}枚を削除`)
                    : t('Delete', 'Xoá', '削除')}
                  onPress={() => { if (picked.length) confirmDelete(picked); }}
                  destructive
                  testID="gallery-delete-picked"
                />
              </>
            )}
          </View>
        )}

        {photos === null ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />
        ) : shown.length === 0 ? (
          <Empty text={t('No photos yet. Add the first one.', 'Chưa có ảnh nào. Thêm ảnh đầu tiên nhé.', 'まだ写真がありません。最初の1枚を追加しましょう。')} />
        ) : (
          <View style={s.grid} testID="gallery-grid">
            {ordered.map((p, i) => {
              const actions = galleryActions(p, me);
              const own = isOwnPhoto(p, me);
              const opens = mode === 'view' && actions.length > 0;
              const picks = mode === 'pick' && own;
              return (
                <PressableScale
                  key={p.id}
                  scaleTo={0.96}
                  disabled={busy || (!opens && !picks)}
                  onPress={picks ? () => togglePick(p.id) : opens ? () => setMenuFor(p) : undefined}
                  accessibilityRole={opens || picks ? 'button' : 'image'}
                  accessibilityLabel={`${t('Photo', 'Ảnh', '写真')} ${i + 1}${p.is_cover ? ` · ${t('cover', 'ảnh bìa', 'カバー')}` : ''}${p.is_hidden ? ` · ${t('hidden', 'đã ẩn', '非表示')}` : ''}`}
                  accessibilityState={picks ? { selected: picked.includes(p.id) } : undefined}
                  containerStyle={{ width: cell, height: cell }}
                  style={s.tile}
                  testID={`gallery-tile-${p.id}`}
                >
                  <Image source={{ uri: p.photo_uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />

                  {/* A hidden photograph is dimmed rather than removed:
                      this is the one screen where hidden rows are the
                      point, and the dimming says what the row says. */}
                  {p.is_hidden && (
                    <View style={[StyleSheet.absoluteFill, s.hiddenVeil]} testID="gallery-hidden">
                      <Ionicons name="eye-off" size={22} color={onPhoto.text} />
                    </View>
                  )}

                  {p.is_cover && (
                    <View style={s.badge} testID="gallery-cover">
                      <Ionicons name="star" size={10} color={onPhoto.accent} />
                      <Text style={s.badgeText}>{t('Cover', 'Bìa', 'カバー')}</Text>
                    </View>
                  )}

                  {/* The desk's upload, said on the tile, so a tile with
                      no menu is not a tile that is broken. */}
                  {mode === 'view' && actions.length === 0 && !p.is_hidden && (
                    <View style={[s.badge, s.badgeLow]}>
                      <Text style={s.badgeText}>{t('Desk', 'Data desk', 'デスク')}</Text>
                    </View>
                  )}

                  {opens && (
                    <View style={s.more} testID={`gallery-more-${p.id}`}>
                      <Ionicons name="ellipsis-horizontal" size={16} color={onPhoto.text} />
                    </View>
                  )}

                  {mode === 'order' && (
                    <View style={s.arrows}>
                      <Arrow
                        icon="chevron-back"
                        label={t('Move earlier', 'Lên trước', '前へ')}
                        disabled={i === 0}
                        onPress={() => setDraft((d) => moveId(d, i, i - 1))}
                        testID={`gallery-earlier-${p.id}`}
                      />
                      <Text style={s.ordinal}>{i + 1}</Text>
                      <Arrow
                        icon="chevron-forward"
                        label={t('Move later', 'Xuống sau', '後へ')}
                        disabled={i === ordered.length - 1}
                        onPress={() => setDraft((d) => moveId(d, i, i + 1))}
                        testID={`gallery-later-${p.id}`}
                      />
                    </View>
                  )}

                  {mode === 'pick' && (
                    <View style={[StyleSheet.absoluteFill, !own && s.notMine]}>
                      {own && (
                        <View style={[s.tick, picked.includes(p.id) && s.tickOn]} testID={`gallery-tick-${p.id}`}>
                          {picked.includes(p.id) && <Ionicons name="checkmark" size={14} color={colors.accentInk} />}
                        </View>
                      )}
                    </View>
                  )}
                </PressableScale>
              );
            })}
          </View>
        )}

        {/* The rules, once, in the reader's language — the ones a menu
            cannot show because they are about what it does *not* offer. */}
        <Card style={s.tips}>
          <Text style={s.tipsTitle}>{t('How it works', 'Lưu ý', '使い方')}</Text>
          <Tip text={t(
            'The cover is the picture that stands for the place. A photo you add becomes the cover.',
            'Ảnh bìa là ảnh đại diện cho địa điểm. Ảnh bạn vừa thêm sẽ thành ảnh bìa.',
            'カバーはこの場所を代表する写真です。追加した写真がカバーになります。',
          )} />
          <Tip text={t(
            'You can arrange your own photos and the ones from Google. The desk’s photos are theirs.',
            'Bạn sắp xếp được ảnh của mình và ảnh từ Google. Ảnh của data desk thì để desk lo.',
            '自分の写真とGoogleの写真は並べ替えられます。デスクの写真はデスクのものです。',
          )} />
          <Tip text={t(
            'A photo the desk hid stays hidden. One you hid, you can show again.',
            'Ảnh data desk đã ẩn thì giữ nguyên. Ảnh bạn tự ẩn thì bạn hiện lại được.',
            'デスクが非表示にした写真はそのままです。自分で非表示にしたものは再表示できます。',
          )} />
          <Tip text={t(
            `JPG or PNG, up to ${MAX_PER_PLACE} of yours per place.`,
            `JPG hoặc PNG, tối đa ${MAX_PER_PLACE} ảnh của bạn mỗi địa điểm.`,
            `JPGまたはPNG、1つの場所につきあなたの写真は${MAX_PER_PLACE}枚まで。`,
          )} />
        </Card>
      </ScrollView>

      <ActionSheet
        visible={menuFor !== null}
        onClose={() => setMenuFor(null)}
        actions={menuFor ? galleryActions(menuFor, me).map((a) => actionRow(menuFor, a)) : []}
        header={menuFor ? (
          <View style={s.who}>
            <Image source={{ uri: menuFor.photo_uri }} style={s.thumb} contentFit="cover" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.whoName} numberOfLines={1}>
                {t('Photo', 'Ảnh', '写真')} {shown.indexOf(menuFor) + 1}/{shown.length}
              </Text>
              <Text style={s.whoMeta} numberOfLines={1}>{provenance(menuFor)}</Text>
            </View>
          </View>
        ) : null}
      />
    </Screen>
  );
}

/** A toolbar pill. Quiet by default; `primary` for the way through a
 *  mode, `destructive` for the one that deletes. */
function Tool({ icon, label, onPress, primary, destructive, testID }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
  destructive?: boolean;
  testID?: string;
}) {
  const ink = primary ? colors.accentInk : destructive ? colors.bad : colors.text;
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[s.tool, primary && s.toolPrimary, destructive && s.toolBad]}
      testID={testID}
    >
      <Ionicons name={icon} size={15} color={ink} />
      <Text style={[s.toolText, { color: ink }]}>{label}</Text>
    </PressableScale>
  );
}

function Arrow({ icon, label, disabled, onPress, testID }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  disabled: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <PressableScale
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[s.arrow, disabled && s.arrowOff]}
      testID={testID}
    >
      <Ionicons name={icon} size={18} color={onPhoto.text} />
    </PressableScale>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <View style={s.tip}>
      <View style={s.tipDot} />
      <Text style={s.tipText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  tools: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tool: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: 36, paddingHorizontal: 13,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1, borderColor: colors.borderGlassSoft,
  },
  toolPrimary: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },
  toolBad: { backgroundColor: colors.badSoft, borderColor: colors.badSoft },
  toolText: { fontSize: 14, fontWeight: font.semibold },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: {
    flex: 1, borderRadius: 12, overflow: 'hidden',
    backgroundColor: colors.surfaceGlassStrong,
  },
  hiddenVeil: {
    backgroundColor: 'rgba(6,5,8,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  // Top-left, on the scrim idiom the cards use over photography.
  badge: {
    position: 'absolute', top: 6, left: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: radius.pill,
    backgroundColor: 'rgba(6,5,8,0.62)',
  },
  badgeLow: { top: undefined, bottom: 6 },
  badgeText: { color: onPhoto.text, fontSize: 10.5, fontWeight: font.semibold },
  more: {
    position: 'absolute', top: 6, right: 6,
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(6,5,8,0.62)',
  },

  arrows: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4,
    backgroundColor: 'rgba(6,5,8,0.28)',
  },
  arrow: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(6,5,8,0.62)',
  },
  arrowOff: { opacity: 0.3 },
  ordinal: { color: onPhoto.text, fontSize: 15, fontFamily: display.bold },

  notMine: { backgroundColor: 'rgba(6,5,8,0.55)' },
  tick: {
    position: 'absolute', top: 6, right: 6,
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: onPhoto.text,
    backgroundColor: 'rgba(6,5,8,0.35)',
  },
  tickOn: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },

  tips: { padding: space.cardPadding, gap: 10 },
  tipsTitle: { color: colors.text, fontSize: 15.5, fontWeight: font.semibold },
  tip: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tipDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent, marginTop: 7 },
  tipText: { flex: 1, color: colors.textSecondary, fontSize: 13.5, lineHeight: 19 },

  who: sheetHeader,
  thumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.surfaceGlassStrong },
  whoName: { color: colors.text, fontSize: 18, fontFamily: display.semibold },
  whoMeta: { color: colors.textTertiary, fontSize: 14 },
});
