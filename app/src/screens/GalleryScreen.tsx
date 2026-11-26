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

import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, useWindowDimensions } from 'react-native';
import PhotoSheet from '../components/PhotoSheet';
import { HeaderAdd } from '../components/add';
import { ScoredCard, ScoringDialog } from '../components/PhotoScore';
import { Empty, Screen, useTabBarClearance } from '../components/ui';
import { useAddPhoto } from '../components/useAddPhoto';
import { useSession } from '../lib/auth';
import { galleryActions, type GalleryPhoto } from '../lib/gallery';
import { useI18n } from '../lib/i18n';
import { localized } from '../lib/localized';
import { splitName } from '../lib/name';
import { SHOWN, bestOf, needsScore } from '../lib/photoScore';
import { photoScorer } from '../lib/photoScoreNative';
import { colors, space } from '../theme';
import type { Nav, RootRoute } from '../nav';
import { GalleryGrid, GalleryTips, GalleryTools, NotYours, type Mode } from './gallery/parts';
import { COLS, GAP } from './gallery/styles';
import { useGalleryPlace } from './gallery/useGalleryPlace';
import { usePhotoMenu } from './gallery/usePhotoMenu';
import { useGalleryWrites } from './gallery/useGalleryWrites';

export default function GalleryScreen({ navigation, route }: { navigation: Nav; route: RootRoute<'Gallery'> }) {
  const { t, lang } = useI18n();
  const { slug } = route.params;
  const { session } = useSession();
  const uid = session?.user?.id ?? null;
  const { width } = useWindowDimensions();
  const tabClearance = useTabBarClearance();

  // The place, whether the reader may keep its gallery, and every copy of
  // its cover read again on the way out — see `useGalleryPlace`.
  const { place, loading, mayKeep, reloadCatalog } = useGalleryPlace(slug, uid);

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
  // The gallery's own read and every write to it — cover, hide, delete,
  // score — drawn at once and read back: `useGalleryWrites` (23 Nov 2026).
  const {
    placeId, photos, load, fail, markDirty, makeCover, hide, removePhotos,
    scoring, scored, setScored, startScoring, stopScoring,
  } = useGalleryWrites({ slug, mayKeep, navigation, reloadCatalog, t });


  const adder = useAddPhoto({
    place: place ?? { slug },
    placeId,
    count: photos?.length ?? 0,
    onAdded: () => { load().catch(fail); markDirty(); },
  });

  const name = place ? splitName(localized(place, 'name', lang)).title : '';
  const shown = photos ?? [];
  const openIndex = shown.findIndex((p) => p.id === openId);
  // The cell: the page's width less its margins, shared three ways with
  // two gutters between. Square, because a gallery of mixed aspect
  // ratios is a gallery whose rows never line up.
  const cell = Math.floor((width - space.page * 2 - GAP * (COLS - 1)) / COLS);

  // ── the menu on one photograph ── see `usePhotoMenu`.
  const { confirmDelete, actionRow } = usePhotoMenu({
    removePhotos, makeCover, hide, onDeleted: () => { setMode('view'); setPicked([]); },
  });

  // ── scoring ──

  // Only what the shown scorer has not read, or read in an older version.
  const unscored = shown.filter((p) => needsScore(p.score, SHOWN));
  const anyScored = unscored.length < shown.length;
  const best = bestOf(shown);
  // The dialog's figures, zero while no run is going.
  const run = scoring ?? { done: 0, total: 0, stopping: false };


  // ── modes ──

  const startPick = () => { setPicked([]); setMode('pick'); };
  const cancel = () => { setMode('view'); setPicked([]); };
  const togglePick = (id: string) =>
    setPicked((was) => (was.includes(id) ? was.filter((x) => x !== id) : [...was, id]));

  // ── faces ──

  // Nobody reaches this by accident — the door is drawn for the keeper
  // alone — but a route can be typed, and this is what it says.
  // While the place is still on its way, a spinner where this will say so.
  if (!place || !mayKeep) {
    return <NotYours waiting={loading && !place} onBack={() => navigation.goBack()} />;
  }

  return (
    <Screen
      compactTitle
      title={t('Gallery', 'Gallery', 'ギャラリー', '相册', '相簿')}
      subtitle={name}
      onBack={() => navigation.goBack()}
      backBare
      // The one invitation on the screen. Not repeated as a tile in the
      // grid: two offers to do one thing read as two different things,
      // the rule `AddPill` states. The header's plus: `HeaderAdd`.
      right={mode === 'view' ? (
        <HeaderAdd
          label={t('Add a photo', 'Thêm ảnh', '写真を追加', '添加照片', '新增照片')}
          busy={adder.busy}
          onPress={() => { void adder.add(); }}
        />
      ) : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.page, paddingTop: 4, paddingBottom: tabClearance, gap: space.cardGap }}
        showsVerticalScrollIndicator={false}
      >
        {shown.length > 0 && (
          <GalleryTools
            mode={mode}
            canScore={!!photoScorer && !!uid}
            unscored={unscored.length}
            anyScored={anyScored}
            picked={picked.length}
            onSelect={startPick}
            onScore={() => { void startScoring(photoScorer!, uid!, unscored); }}
            onCancel={cancel}
            onDeletePicked={() => { if (picked.length) confirmDelete(picked); }}
          />
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
          <GalleryGrid
            shown={shown}
            mode={mode}
            picked={picked}
            lastOpened={lastOpened}
            cell={cell}
            adder={adder}
            onPick={togglePick}
            onOpen={open}
          />
        )}

        <GalleryTips />
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
        done={run.done}
        total={run.total}
        stopping={run.stopping ?? false}
        onCancel={stopScoring}
      />
    </Screen>
  );
}
