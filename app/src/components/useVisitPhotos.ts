// The photos on one visit, as the check-in sheet holds them while it is
// up (K3 of `docs/checkin-photos-plan.md`).
//
// ── applied as they are chosen ──
//
// A photo goes up the moment it is picked, and goes away the moment its
// removal is confirmed — not when the sheet's button is pressed. The
// visit already exists (the tap wrote it; `lib/checkin` says why), so
// there is nothing for a photo to wait on, and a photo that waited for
// "Done" would turn the button into a progress bar the reader had not
// asked to watch. The note and who sees the visit keep the sheet's own
// rules (a tap outside an old visit's sheet leaves *them* as they were);
// a photo is not held back by those, and the sheet says so by reporting
// it changed the visit whichever way it is closed (`changed`).
//
// Closing while one is still going does not wait for it (owner, 25 Nov
// 2026): the upload is the app's (`lib/visitUploads`), not this sheet's,
// and goes on after it. It waited until then, Done's spinner turning for
// the 3.5–4 s an upload took; that file has the numbers. A sheet opened
// again over the same visit before it lands draws it as still going.
//
// ── one at a time ──
//
// Chosen photos go up in turn, not together (`lib/visitUploads` says
// why). Each is shrunk on the phone first, as a local guide's are
// (`lib/guide`: 1200px, 0.74 — 157 KB on average over 4,433 of them),
// and the server checks it again.
//
// ── when one does not go ──
//
// The caps and a file that is not a picture are said once and the tile
// goes: trying the same thing again would be refused the same way. Any
// other failure — the network, first — keeps the tile, marked, and a
// press on it tries again with the same bytes.

import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { PHOTOS_PER_VISIT, type CheckinPhoto, type PhotoRefusal } from '../lib/checkin';
import { fetchCheckinPhotos, removeCheckinPhoto, signCheckinPhotos } from '../lib/data';
import { keepLinks, keptLink } from './useSignedPhotos';
import { PHOTO_QUALITY, shrinkTo } from '../lib/guide';
import { useI18n } from '../lib/i18n';
import {
  dropVisitPhoto, onVisitUpload, retryVisitPhoto, sendVisitPhoto, uploadsFor, watchVisit,
} from '../lib/visitUploads';

export type Tile = {
  key: string;
  /** The picture to draw: the phone's own file while it is new, a signed
   *  link for one stored before; none for a hidden one. */
  uri: string | null;
  state: 'done' | 'sending' | 'failed' | 'hidden';
  photo?: CheckinPhoto;
};

export type VisitPhotos = {
  tiles: Tile[];
  /** How many more may be chosen. */
  room: number;
  add: () => Promise<void>;
  retry: (tile: Tile) => void;
  remove: (tile: Tile) => void;
  /** Whether a photo went up or away while the sheet was open. */
  changed: () => boolean;
};

type T = (en: string, vi: string, ja: string, zh: string, zhHant: string) => string;

/** The words for a refusal, here and where the app says it with no sheet
 *  up (`VisitUploads`). */
export const refusalText = (t: T, why: Exclude<PhotoRefusal, 'other'>): string => ({
  full: t(`A visit can have ${PHOTOS_PER_VISIT} photos.`, `Mỗi lần ghé tối đa ${PHOTOS_PER_VISIT} ảnh.`, `1回の訪問につき写真は${PHOTOS_PER_VISIT}枚までです。`, `每次打卡最多 ${PHOTOS_PER_VISIT} 张照片。`, `每次打卡最多 ${PHOTOS_PER_VISIT} 張照片。`),
  day: t('You have added 15 photos today. Add more tomorrow.', 'Hôm nay bạn đã thêm 15 ảnh. Mai thêm tiếp nhé.', '今日は15枚追加しました。また明日どうぞ。', '你今天已添加 15 张照片，明天再加吧。', '你今天已新增 15 張照片，明天再加吧。'),
  account: t('You have 300 check-in photos. Remove some old ones to add more.', 'Bạn đã có 300 ảnh check-in. Xoá bớt ảnh cũ để thêm ảnh mới.', 'チェックインの写真が300枚あります。古い写真を削除すると追加できます。', '你已有 300 张打卡照片。删除一些旧照片后才能添加。', '你已有 300 張打卡照片。刪除一些舊照片後才能新增。'),
  image: t('This photo cannot be used. Try another one.', 'Ảnh này không dùng được. Thử ảnh khác nhé.', 'この写真は使えません。別の写真を試してください。', '这张照片无法使用，换一张试试。', '這張照片無法使用，換一張試試。'),
  signed_out: t('Sign in again to add photos.', 'Đăng nhập lại để thêm ảnh.', '写真を追加するにはもう一度サインインしてください。', '请重新登录后再添加照片。', '請重新登入後再新增照片。'),
}[why]);

export const couldNotAdd = (t: T) => t('Could not add your photo', 'Không thêm được ảnh', '写真を追加できませんでした', '无法添加你的照片', '無法新增你的照片');

let made = 0;
const keyOf = () => `new-${(made += 1)}`;

/** What is still on its way to the visit, as tiles. */
const going = (visitId: string): Tile[] =>
  uploadsFor(visitId).map((u) => ({ key: u.key, uri: u.uri, state: u.state }));

/** The photos the card under the sheet was drawing, as tiles, with the
 *  links it already had — so the sheet's first frame has the pictures
 *  rather than empty tiles for half a second while it asks again (owner,
 *  26 Nov 2026, from a recording). The read below still runs: it brings
 *  the hidden ones, which a card is never sent. */
const seeded = (seed: readonly CheckinPhoto[]): Tile[] => seed.map((photo) => ({
  key: photo.id, photo, uri: keptLink(photo.path), state: 'done',
}));

export function useVisitPhotos(visitId: string, on: boolean, known: boolean, seed: readonly CheckinPhoto[] = []): VisitPhotos {
  const { t } = useI18n();
  const [tiles, setTiles] = useState<Tile[]>(() => (on ? [...seeded(seed), ...going(visitId)] : []));
  const changed = useRef(false);

  // A visit made before this sheet may have photos already: the rows,
  // then links for the ones the bucket will sign. A fresh visit has none.
  // What is still going up stays after them, as it was drawn.
  useEffect(() => {
    if (!on || !known) return undefined;
    let live = true;
    (async () => {
      const rows = await fetchCheckinPhotos(visitId);
      // Only what nothing has signed yet is asked for.
      const need = rows.filter((r) => !r.hidden && !keptLink(r.path)).map((r) => r.path);
      if (need.length > 0) keepLinks(await signCheckinPhotos(need));
      if (!live) return;
      const stored: Tile[] = rows.map((photo) => ({
        key: photo.id, photo,
        uri: photo.hidden ? null : keptLink(photo.path),
        state: photo.hidden ? 'hidden' : 'done',
      }));
      setTiles((now) => [...stored, ...now.filter((x) => x.state === 'sending' || x.state === 'failed')]);
    })().catch(() => {});
    return () => { live = false; };
  }, [on, known, visitId]);

  const patch = (key: string, to: Partial<Tile> | null) =>
    setTiles((all) => (to ? all.map((x) => (x.key === key ? { ...x, ...to } : x)) : all.filter((x) => x.key !== key)));

  // How this visit's uploads went, said on the tiles while the sheet is
  // up — and only while it is: `watchVisit` tells the app it need not.
  useEffect(() => {
    if (!on) return undefined;
    const unwatch = watchVisit(visitId);
    const off = onVisitUpload((e) => {
      if (e.visitId !== visitId) return;
      if (e.kind === 'up') { changed.current = true; patch(e.key, { state: 'done', photo: e.photo }); return; }
      if (e.kind === 'failed') { patch(e.key, { state: 'failed' }); return; }
      patch(e.key, null);
      Alert.alert(couldNotAdd(t), refusalText(t, e.why));
    });
    return () => { off(); unwatch(); };
  // `t` is new each render and reads nothing that changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, visitId]);

  const room = PHOTOS_PER_VISIT - tiles.length;

  const add = async () => {
    if (room <= 0) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 1, allowsMultipleSelection: true, selectionLimit: room, orderedSelection: true,
    });
    if (picked.canceled) return;
    for (const asset of picked.assets.slice(0, room)) {
      const key = keyOf();
      setTiles((all) => [...all, { key, uri: asset.uri, state: 'sending' }]);
      const resize = shrinkTo(asset.width, asset.height);
      const shrunk = await manipulateAsync(asset.uri, resize ? [{ resize }] : [], {
        compress: PHOTO_QUALITY, format: SaveFormat.JPEG, base64: true,
      }).catch(() => null);
      if (!shrunk?.base64) {
        patch(key, null);
        Alert.alert(couldNotAdd(t), refusalText(t, 'image'));
        continue;
      }
      sendVisitPhoto({ key, visitId, uri: asset.uri, image: shrunk.base64 });
    }
  };

  const retry = (tile: Tile) => {
    if (tile.state !== 'failed') return;
    patch(tile.key, { state: 'sending' });
    retryVisitPhoto(tile.key);
  };

  const remove = (tile: Tile) => {
    // One that never went up: dropped here and in the queue, nothing asked.
    if (!tile.photo) { dropVisitPhoto(tile.key); patch(tile.key, null); return; }
    const photo = tile.photo;
    Alert.alert(
      t('Remove this photo?', 'Bỏ ảnh này?', 'この写真を削除しますか？', '删除这张照片？', '刪除這張照片？'),
      undefined,
      [
        { text: t('Cancel', 'Huỷ', 'キャンセル', '取消', '取消'), style: 'cancel' },
        {
          text: t('Remove', 'Bỏ', '削除', '删除', '刪除'),
          style: 'destructive',
          onPress: () => {
            removeCheckinPhoto(photo.id).then(
              () => { changed.current = true; patch(tile.key, null); },
              () => Alert.alert(t('Could not remove the photo', 'Không bỏ được ảnh', '写真を削除できませんでした', '无法删除照片', '無法刪除照片')),
            );
          },
        },
      ],
    );
  };

  return { tiles, room, add, retry, remove, changed: () => changed.current };
}
