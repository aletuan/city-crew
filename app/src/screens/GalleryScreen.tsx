// The gallery of a place, kept by the guide who brought the place in.
//
// ── what this screen is ──
//
// The desk has always been able to do everything to a place's
// photographs. The guide could add one and take their own back, and
// asked the desk for the rest. This is the rest, under the plain rule
// `lib/gallery` states: on a place the guide brought in, the guide and
// the desk may do the same things to any photograph — cover, hide, show
// again, delete — and whoever acts last wins. Both sides write the same
// rows, so what one does the other sees on its next read; that is the
// sense in which they are in step, and the whole of it.
//
// ── two modes, one grid ──
//
// Looking at the gallery, a tile opens its photograph (`PhotoSheet`): the
// picture large, its score, and what can be done to it. Choosing several to
// delete, a tile is a tick. The draft choice is held in state until it
// is confirmed, so a change of mind costs nothing — "Cancel" throws it
// away and the rows were never touched.
//
// ── scoring (owner, 15 Oct 2026) ──
//
// The phone can read each photograph with Apple Vision and say how good
// it is, out of ten, and why — on the device, once per photograph, kept
// in `photo_scores`. The button offers only what has not been read, and
// is not drawn at all where the phone cannot do it (`photoScoreNative`
// says where that is). Nothing is decided by the score: the cover stays
// the guide's choice, and the number is there to make it quicker.
//
// ── what is not here ──
//
// No ordering, no tags, no captions, no crop. Version one is the desk's
// three verbs and nothing the desk cannot do yet.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import type { SheetAction } from '../components/ActionSheet';
import PhotoSheet from '../components/PhotoSheet';
import { AddPill } from '../components/add';
import { ScoreBadge, ScoreGlyph, ScoredCard, ScoringDialog, tenText } from '../components/PhotoScore';
import { Card, Empty, PressableScale, Screen, successHaptic, useTabBarClearance } from '../components/ui';
import { useAddPhoto } from '../components/useAddPhoto';
import { useSession } from '../lib/auth';
import { useCollections, usePlaces } from '../lib/catalog';
import { fetchGallery, fetchPlaceId, removePlacePhoto, savePhotoScore, setCover, setHidden, usePlaceBySlug } from '../lib/data';
import { canKeepGallery, galleryActions, galleryOrder, type GalleryAction, type GalleryPhoto } from '../lib/gallery';
import { MAX_PER_PLACE } from '../lib/guide';
import { useI18n } from '../lib/i18n';
import { localized } from '../lib/localized';
import { splitName } from '../lib/name';
import { SHOWN, bestOf, needsScore, scoreAll, toTen, type PhotoScorer } from '../lib/photoScore';
import { photoScorer } from '../lib/photoScoreNative';
import { useMyLists } from '../lib/save';
import { useIsEditor, useIsGuide } from '../lib/useGuideGrant';
import { colors, font, onPhoto, radius, space } from '../theme';
import type { Nav, RootRoute } from '../nav';

type Mode = 'view' | 'pick';

const nextFrame = () => new Promise<void>((r) => { requestAnimationFrame(() => r()); });

const COLS = 3;
const GAP = 6;

export default function GalleryScreen({ navigation, route }: { navigation: Nav; route: RootRoute<'Gallery'> }) {
  const { t, lang } = useI18n();
  const { slug } = route.params;
  const { session } = useSession();
  const uid = session?.user?.id ?? null;
  const { width } = useWindowDimensions();
  const tabClearance = useTabBarClearance();

  // The place, for its name and its `submitted_by`. From the catalog when
  // it is there, and by its own fetch when it is not — a place still
  // waiting at the desk is exactly where this screen is most useful, and
  // that one is not in the catalog. Same two-step `PlaceDetail` takes.
  const { loading: catalogLoading, data: places, reload: reloadPlaces } = usePlaces();
  const { reload: reloadLists } = useCollections();
  const mine = useMyLists();
  // Everything on screen that draws this place's photographs, read again
  // after a write. Not only the catalog: a collection carries its places
  // embedded whole (`withMembers`), photographs and all, so a list holding
  // this place kept its old cover until something reloaded the lists —
  // Royal Botanic Gardens' new cover showed on its own page and not in
  // the collection beside it (owner, 15 Oct 2026). Both shelves, the
  // public lists and the reader's own, since a place can be in either.
  const reloadCatalog = () => { reloadPlaces(); reloadLists(); mine.reload(); };
  const inCatalog = useMemo(() => places.find((p) => p.slug === slug), [places, slug]);
  const elsewhere = usePlaceBySlug(!catalogLoading && !inCatalog ? slug : null);
  const place = inCatalog ?? elsewhere.data ?? null;
  // Asked after the place, because the grant is per city now and the
  // city is the place's. While it is still loading this reads as "no
  // city", which only an all-cities grant answers yes to — and the
  // boundary below is closed anyway until the place arrives.
  const granted = useIsGuide(place?.city_id);
  const editor = useIsEditor();
  const me = useMemo(() => ({ uid, granted, editor }), [uid, granted, editor]);
  const mayKeep = place ? canKeepGallery(place, me) : false;

  const [placeId, setPlaceId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[] | null>(null);
  const [mode, setMode] = useState<Mode>('view');
  // The draft choice, meaningful in pick mode only.
  const [picked, setPicked] = useState<string[]>([]);
  // The photograph open in the sheet, by id, so a read-back that moves it
  // keeps it open on the same picture.
  const [openId, setOpenId] = useState<string | null>(null);
  // The photograph last opened, ringed on the grid once its sheet has
  // closed, so the guide coming back finds where they were — the last one
  // swiped to, when the guide swiped.
  const [lastOpened, setLastOpened] = useState<string | null>(null);
  const open = (p: GalleryPhoto) => { setOpenId(p.id); setLastOpened(p.id); };
  const [busy, setBusy] = useState(false);
  // A run of the scorer: how far it has got while it runs, and what it
  // came to once it has finished, until the card is closed.
  const [scoring, setScoring] = useState<{ done: number; total: number; stopping?: boolean } | null>(null);
  const [scored, setScored] = useState<{ scored: number; failed: number } | null>(null);
  const stop = useRef(false);

  const fail = useCallback((e: unknown) => {
    Alert.alert(
      t('That did not work', 'Chưa làm được', 'うまくいきませんでした', '操作未成功', '操作未成功'),
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
  // catalog and the lists (`reloadCatalog`) so the detail screen behind
  // this one, and any collection holding the place, draw the new cover on
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

  const name = place ? splitName(localized(place, 'name', lang)).title : '';
  const shown = photos ?? [];
  const openIndex = shown.findIndex((p) => p.id === openId);
  // The cell: the page's width less its margins, shared three ways with
  // two gutters between. Square, because a gallery of mixed aspect
  // ratios is a gallery whose rows never line up.
  const cell = Math.floor((width - space.page * 2 - GAP * (COLS - 1)) / COLS);

  // ── the menu on one photograph ──

  const confirmDelete = (ids: string[]) => Alert.alert(
    ids.length === 1
      ? t('Delete this photo?', 'Xoá ảnh này?', 'この写真を削除しますか？', '删除这张照片？', '刪除這張照片？')
      : t(`Delete ${ids.length} photos?`, `Xoá ${ids.length} ảnh?`, `${ids.length}枚の写真を削除しますか？`, `删除 ${ids.length} 张照片？`, `刪除 ${ids.length} 張照片？`),
    t(
      'It comes off the place for everyone. This cannot be undone.',
      'Ảnh sẽ biến mất khỏi địa điểm với mọi người. Không hoàn tác được.',
      'この場所から全員に対して消えます。元に戻せません。',
      '所有人都将看不到这张照片。此操作无法撤销。', '所有人都將看不到這張照片。此操作無法復原。',
    ),
    [
      { text: t('Cancel', 'Huỷ', 'キャンセル', '取消', '取消'), style: 'cancel' },
      {
        text: t('Delete', 'Xoá', '削除', '删除', '刪除'),
        style: 'destructive',
        onPress: () => {
          void run(async () => {
            // The path from the rows on screen, so the file goes with the
            // row — see `removePlacePhoto` for why the row goes first.
            for (const id of ids) await removePlacePhoto(id, photos?.find((p) => p.id === id)?.storage_path ?? null);
          });
          setMode('view');
          setPicked([]);
        },
      },
    ],
  );

  const actionRow = (photo: GalleryPhoto, a: GalleryAction): SheetAction => ({
    // On the cover, its own slot held: the star filled as it is beside
    // the kind, said as selected, and its tap refused by the strip — the
    // one act here would set what is already set.
    cover: {
      key: a,
      ...(photo.is_cover ? {
        icon: 'star' as const, selected: true,
        title: t('It is the cover', 'Đang là ảnh bìa', 'カバーです', '这是封面', '這是封面'),
        desc: t('The picture that stands for the place.', 'Ảnh đại diện cho địa điểm.', 'この場所を代表する写真です。', '代表这个地点的照片。', '代表這個地點的照片。'),
      } : {
        icon: 'star-outline' as const,
        title: t('Make it the cover', 'Đặt làm ảnh bìa', 'カバーにする', '设为封面', '設為封面'),
        desc: t('The picture that stands for the place, first wherever it appears.', 'Ảnh đại diện cho địa điểm, đứng đầu ở mọi nơi.', 'この場所を代表する写真になり、どこでも先頭に出ます。', '代表这个地点的照片，在任何地方都排在第一张。', '代表這個地點的照片，在任何地方都排在第一張。'),
      }),
      short: t('Cover', 'Ảnh bìa', 'カバー', '封面', '封面'),
      onPress: () => { void run(() => setCover(photo.id)); },
    },
    hide: {
      key: a, icon: 'eye-off-outline' as const,
      title: t('Hide it', 'Ẩn ảnh', '非表示にする', '隐藏', '隱藏'),
      short: t('Hide', 'Ẩn', '非表示', '隐藏', '隱藏'),
      desc: t('Readers stop seeing it. You can show it again.', 'Người xem không thấy nữa. Bạn hiện lại được.', '読者には見えなくなります。再表示できます。', '其他人将看不到它。你可以重新显示。', '其他人將看不到它。你可以重新顯示。'),
      onPress: () => { void run(() => setHidden(photo.id, true)); },
    },
    unhide: {
      key: a, icon: 'eye-outline' as const,
      title: t('Show it again', 'Hiện lại', '再表示する', '重新显示', '重新顯示'),
      short: t('Show', 'Hiện lại', '再表示', '显示', '顯示'),
      desc: t('Back on the place for everyone.', 'Trở lại địa điểm với mọi người.', 'この場所に再び表示されます。', '重新对所有人显示。', '重新對所有人顯示。'),
      onPress: () => { void run(() => setHidden(photo.id, false)); },
    },
    delete: {
      key: a, icon: 'trash-outline' as const, destructive: true,
      title: t('Delete it', 'Xoá ảnh', '削除する', '删除', '刪除'),
      short: t('Delete', 'Xoá', '削除', '删除', '刪除'),
      desc: t('Gone from the place, for good.', 'Xoá hẳn khỏi địa điểm.', 'この場所から完全に消えます。', '从这个地点永久移除。', '從這個地點永久移除。'),
      onPress: () => confirmDelete([photo.id]),
    },
  }[a]);


  // ── scoring ──

  // Only what the shown scorer has not read, or read in an older version.
  const unscored = shown.filter((p) => needsScore(p.score, SHOWN));
  const anyScored = unscored.length < shown.length;
  const best = bestOf(shown);

  const startScoring = async (scorer: PhotoScorer, me: string) => {
    stop.current = false;
    setScored(null);
    setScoring({ done: 0, total: unscored.length });
    // Two frames, so the dialog is on screen and its bars are moving
    // before the first photograph is handed over: the reading can keep
    // the JS side busy, and the bars' loops are started from there.
    await nextFrame();
    await nextFrame();
    const result = await scoreAll(unscored, {
      read: (uri) => scorer.read(uri),
      save: (id, reading) => savePhotoScore(id, scorer, reading, me),
      onStep: (done) => setScoring((was) => ({ ...was, done, total: unscored.length })),
      stopped: () => stop.current,
    });
    // Read back before the dialog goes, so the badges and the card's
    // "best" arrive with it rather than a beat after.
    await load().catch(fail);
    setScoring(null);
    setScored(result);
    if (result.scored) successHaptic();
  };

  // ── modes ──

  const startPick = () => { setPicked([]); setMode('pick'); };
  const cancel = () => { setMode('view'); setPicked([]); };
  const togglePick = (id: string) =>
    setPicked((was) => (was.includes(id) ? was.filter((x) => x !== id) : [...was, id]));

  // ── faces ──

  if ((catalogLoading || elsewhere.loading) && !place) {
    return (
      <Screen title={t('Gallery', 'Gallery', 'ギャラリー', '相册', '相簿')} onBack={() => navigation.goBack()}>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 64 }} />
      </Screen>
    );
  }
  // Nobody reaches this by accident — the door is drawn for the keeper
  // alone — but a route can be typed, and this is what it says.
  if (!place || !mayKeep) {
    return (
      <Screen title={t('Gallery', 'Gallery', 'ギャラリー', '相册', '相簿')} onBack={() => navigation.goBack()}>
        <Empty text={t('This is not yours to keep.', 'Đây không phải gallery của bạn.', 'これはあなたのギャラリーではありません。', '你无权管理这个相册。', '你無權管理這個相簿。')} />
      </Screen>
    );
  }

  return (
    <Screen
      title={t('Gallery', 'Gallery', 'ギャラリー', '相册', '相簿')}
      subtitle={name}
      onBack={() => navigation.goBack()}
      // The one invitation on the screen. Not repeated as a tile in the
      // grid: two offers to do one thing read as two different things,
      // the rule `AddPill` states.
      right={mode === 'view' ? (
        <AddPill
          tall
          label={t('Add', 'Thêm', '追加', '添加', '新增')}
          busy={adder.busy}
          accessibilityLabel={t('Add a photo', 'Thêm ảnh', '写真を追加', '添加照片', '新增照片')}
          onPress={() => { void adder.add(); }}
        />
      ) : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.page, paddingTop: 4, paddingBottom: tabClearance, gap: space.cardGap }}
        showsVerticalScrollIndicator={false}
      >
        {/* The toolbar. One quiet pill while looking; in pick mode, the
            way out and the way through, and nothing else — a mode with a
            third button is a mode you can leave by accident. */}
        {shown.length > 0 && (
          <View style={s.tools} testID="gallery-tools">
            {mode === 'view' && (
              <Tool icon="checkmark-circle-outline" label={t('Select', 'Chọn', '選択', '选择', '選擇')} onPress={startPick} testID="gallery-select" />
            )}
            {/* Drawn only where the phone can read, and only while there
                is something left to read — a button that would score
                nothing is a button that teaches the reader to doubt it. */}
            {mode === 'view' && photoScorer && uid && unscored.length > 0 && (
              <Tool
                glyph={<ScoreGlyph size={15} color={colors.text} />}
                label={anyScored
                  ? t(`Score ${unscored.length} new`, `Chấm ${unscored.length} ảnh mới`, `新しい${unscored.length}枚を採点`, `为 ${unscored.length} 张新照片评分`, `為 ${unscored.length} 張新照片評分`)
                  : t('Score photos', 'Chấm ảnh', '写真を採点', '为照片评分', '為照片評分')}
                onPress={() => { void startScoring(photoScorer!, uid); }}
                testID="gallery-score"
              />
            )}
            {mode === 'pick' && (
              <>
                <Tool icon="close" label={t('Cancel', 'Huỷ', 'キャンセル', '取消', '取消')} onPress={cancel} testID="gallery-cancel" />
                <Tool
                  icon="trash-outline"
                  label={picked.length
                    ? t(`Delete ${picked.length}`, `Xoá ${picked.length}`, `${picked.length}枚を削除`, `删除 ${picked.length} 张`, `刪除 ${picked.length} 張`)
                    : t('Delete', 'Xoá', '削除', '删除', '刪除')}
                  onPress={() => { if (picked.length) confirmDelete(picked); }}
                  destructive
                  testID="gallery-delete-picked"
                />
              </>
            )}
          </View>
        )}

        {scored && mode === 'view' && (
          <ScoredCard
            scored={scored.scored}
            failed={scored.failed}
            best={best ? { n: shown.indexOf(best.photo) + 1, ten: best.ten } : null}
            onClose={() => setScored(null)}
          />
        )}

        {photos === null ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />
        ) : shown.length === 0 && !adder.busy ? (
          <Empty text={t('No photos yet. Add the first one.', 'Chưa có ảnh nào. Thêm ảnh đầu tiên nhé.', 'まだ写真がありません。最初の1枚を追加しましょう。', '还没有照片。添加第一张吧。', '還沒有照片。新增第一張吧。')} />
        ) : (
          <View style={s.grid} testID="gallery-grid">
            {shown.map((p, i) => {
              const picks = mode === 'pick';
              return (
                <PressableScale
                  key={p.id}
                  scaleTo={0.96}
                  disabled={busy}
                  onPress={picks ? () => togglePick(p.id) : () => open(p)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('Photo', 'Ảnh', '写真', '照片', '照片')} ${i + 1}${p.is_cover ? ` · ${t('cover', 'ảnh bìa', 'カバー', '封面', '封面')}` : ''}${p.is_hidden ? ` · ${t('hidden', 'đã ẩn', '非表示', '已隐藏', '已隱藏')}` : ''}${p.score?.aesthetic != null ? ` · ${tenText(toTen(p.score.aesthetic))}/10` : ''}`}
                  accessibilityState={picks ? { selected: picked.includes(p.id) } : undefined}
                  style={{ width: cell, height: cell }}
                  contentStyle={[s.tile, !picks && lastOpened === p.id && s.tileLast]}
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
                      <Text style={s.badgeText}>{t('Cover', 'Bìa', 'カバー', '封面', '封面')}</Text>
                    </View>
                  )}

                  {p.score && <ScoreBadge score={p.score} testID={`gallery-score-${p.id}`} />}

                  {picks && (
                    <View style={[s.tick, picked.includes(p.id) && s.tickOn]} testID={`gallery-tick-${p.id}`}>
                      {picked.includes(p.id) && <Ionicons name="checkmark" size={14} color={colors.accentInk} />}
                    </View>
                  )}
                </PressableScale>
              );
            })}
            {/* Where the photograph will land, while it is on its way.
                The grid used to do nothing until the read-back after the
                insert, and the one sign of the one-to-three seconds in
                between was the header pill's word turning into "…". The
                tile takes the new photograph's cell — the end of the
                grid, the size of every other cell — and names the step
                being waited on, in the two words the two slow steps
                actually divide into. Indeterminate, because the storage
                client reports no bytes; a bar that guessed would be
                worse than a word that is true. */}
            {adder.busy && (
              <View style={[s.tile, s.waiting, { width: cell, height: cell }]} testID="gallery-uploading">
                <ActivityIndicator color={colors.accent} />
                <Text style={s.waitingText}>
                  {adder.stage === 'shrinking'
                    ? t('Compressing…', 'Đang nén…', '圧縮中…', '压缩中…', '壓縮中…')
                    : t('Uploading…', 'Đang tải lên…', 'アップロード中…', '上传中…', '上傳中…')}
                  {/* "2/4" only when there is a batch to count. */}
                  {adder.progress.total > 1 ? ` ${adder.progress.done + 1}/${adder.progress.total}` : ''}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* The rules, once, in the reader's language — the ones a menu
            cannot show because they are about what it does *not* offer. */}
        <Card style={s.tips}>
          {/* Cut to one line each with the owner (16 Oct 2026): what
              the screen shows by itself went — how to change the cover is
              the sheet's own row, which photo of several becomes it shows
              in the first tile, and which of two edits wins is the
              database's business, not the guide's.
              Rewritten with the owner before that (15 Oct 2026). "The desk" is a
              name only the team uses, so the second tip names City Crew.
              "JPG or PNG" went: the roll's HEIC is turned into JPEG on
              the way up, so the format was never the reader's to mind.
              "Pick them all at once" went too: the picker says so itself.
              The cover tip now says what adding does to the cover, which
              is the surprise the old wording only hinted at — the upload
              trigger (`20260921093000_guide_upload_becomes_cover.sql`)
              makes the newest photo the cover. */}
          <Text style={s.tipsTitle}>{t('Note', 'Chú ý', 'ご注意', '注意', '注意')}</Text>
          <Tip text={t(
            'A photo you add becomes the cover.',
            'Ảnh mới thêm sẽ thành ảnh bìa.',
            '追加した写真がカバーになります。',
            '你添加的照片会成为封面。', '你新增的照片會成為封面。',
          )} />
          <Tip text={t(
            'The City Crew team can edit these photos too.',
            'Đội ngũ City Crew cũng có thể chỉnh các ảnh này.',
            'City Crewのチームもこれらの写真を編集できます。',
            'City Crew 团队也可以编辑这些照片。', 'City Crew 團隊也可以編輯這些照片。',
          )} />
          <Tip text={t(
            `Up to ${MAX_PER_PLACE} photos per place.`,
            `Tối đa ${MAX_PER_PLACE} ảnh cho mỗi địa điểm.`,
            `1つの場所に${MAX_PER_PLACE}枚まで。`,
            `每个地点最多 ${MAX_PER_PLACE} 张照片。`, `每個地點最多 ${MAX_PER_PLACE} 張照片。`,
          )} />
        </Card>
      </ScrollView>

      <PhotoSheet
        photos={shown}
        index={openIndex >= 0 ? openIndex : null}
        onIndex={(i) => open(shown[i])}
        actionsFor={(p) => galleryActions(p).map((a) => actionRow(p, a))}
        onClose={() => setOpenId(null)}
      />

      <ScoringDialog
        visible={scoring !== null}
        done={scoring?.done ?? 0}
        total={scoring?.total ?? 0}
        stopping={scoring?.stopping ?? false}
        onCancel={() => { stop.current = true; setScoring((was) => was && { ...was, stopping: true }); }}
      />
    </Screen>
  );
}

/** A toolbar pill. Quiet by default; `destructive` for the one that
 *  deletes. */
function Tool({ icon, glyph, label, onPress, destructive, testID }: {
  icon?: keyof typeof Ionicons.glyphMap;
  /** A drawn glyph in place of an Ionicons name — the scorer's bars. */
  glyph?: React.ReactNode;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  testID?: string;
}) {
  const ink = destructive ? colors.bad : colors.text;
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityLabel={label}
      contentStyle={[s.tool, destructive && s.toolBad]}
      testID={testID}
    >
      {glyph ?? <Ionicons name={icon} size={15} color={ink} />}
      <Text style={[s.toolText, { color: ink }]}>{label}</Text>
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
  // The hairline only holds the size; a `badSoft` border would resolve to
  // the phone's side of the pair, not the app's (`bgHex` in theme.ts).
  toolBad: { backgroundColor: colors.badSoft, borderColor: 'transparent' },
  toolText: { fontSize: 14, fontWeight: font.semibold },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: {
    flex: 1, borderRadius: 12, overflow: 'hidden',
    backgroundColor: colors.surfaceGlassStrong,
  },
  // Not `flex: 1`: the waiting tile is given its cell outright, like the
  // pressables around it get theirs through their outer `style`.
  waiting: { flex: 0, alignItems: 'center', justifyContent: 'center', gap: 8 },
  waitingText: { color: colors.textTertiary, fontSize: 13, fontWeight: font.medium },
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
  badgeText: { color: onPhoto.text, fontSize: 11, fontWeight: font.semibold },
  // The ring on the tile last opened: the accent, inside the tile so the
  // grid's gutters stay even.
  tileLast: { borderWidth: 2.5, borderColor: colors.accent },


  tick: {
    position: 'absolute', top: 6, right: 6,
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: onPhoto.text,
    backgroundColor: 'rgba(6,5,8,0.35)',
  },
  tickOn: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },

  tips: { padding: space.cardPadding, gap: 10 },
  tipsTitle: { color: colors.text, fontSize: 16, fontWeight: font.semibold },
  tip: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tipDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent, marginTop: 7 },
  tipText: { flex: 1, color: colors.textSecondary, fontSize: 14, lineHeight: 19 },

});
