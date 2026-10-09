// The upload: pick, shrink, store, file the row.
//
// This was the body of `LocalGuidePanel`, and it moved here when the
// panel stopped uploading and started opening the gallery instead. The
// shape is `AvatarPicker`'s, for the same reasons: a photograph saves the
// moment it is chosen rather than waiting for a Save that could
// half-succeed. Everything decidable — who may, what the file is called,
// which limit was reached — lives in `lib/guide` under the coverage gate;
// what is left here is the parts that need a camera roll and a network.
//
// A hook rather than a component, because the thing that calls it is a
// screen with its own header, and the button belongs in that header.

import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { addPlacePhoto, fetchMyPhotoCounts, removePhotoFile, uploadPlacePhoto } from '../lib/data';
import { useIsEditor, useIsGuide } from '../lib/useGuideGrant';
import {
  canAddPhoto, photoPath, photoRoom, refusePhoto, PHOTO_PX, PHOTO_QUALITY,
  type Guidable, type PhotoRefusal,
} from '../lib/guide';
import { successHaptic } from './ui';

export function useAddPhoto({ place, placeId, count, onAdded }: {
  place: Guidable & { slug: string; city_id?: string | null };
  /** The row id, looked up by the caller — see `fetchPlaceId` for why it
   *  is not in the catalog. Null until it is known, and `add` does
   *  nothing useful before then. */
  placeId: string | null;
  /** How many photographs the place already carries, so the new one
   *  sorts after them. */
  count: number;
  /** Called after a photograph lands, so the screen can re-read. */
  onAdded: () => void;
}) {
  const { t } = useI18n();
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;
  // The place's city, not the person's: a grant that names Đà Nẵng
  // does not reach a café in Huế, and the insert policy says so too.
  const granted = useIsGuide(place.city_id);
  const editor = useIsEditor();
  // Which of the two slow steps is running. Adding took one to three
  // seconds on a phone, and the screen had one bit to show for it; the
  // two steps that take the time are the shrink (`manipulateAsync` on a
  // 12-megapixel frame) and the upload, and a screen that can name the
  // step is a screen that can show something changing. The row insert and
  // the re-read after it are fast enough to live under "uploading".
  const [stage, setStage] = useState<AddStage>('idle');
  // Which of the batch is on its way: `done` have landed, of `total`
  // picked. The tile says "2/4" from it when the batch is more than one.
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const busy = stage !== 'idle';
  const [counts, setCounts] = useState({ mineHere: 0, mineToday: 0 });

  const me = { uid, granted, editor };
  const mayOffer = canAddPhoto(place, me);

  // Counted before the picker rather than after the upload, which is the
  // only way the refusal can name a limit instead of saying "that did not
  // work". The policy still counts; this is the message in front of it.
  const recount = useCallback(async () => {
    if (!uid || !placeId) return;
    setCounts(await fetchMyPhotoCounts(placeId, uid));
  }, [uid, placeId]);

  useEffect(() => { if (mayOffer) void recount(); }, [mayOffer, recount]);

  const refusalText = (why: PhotoRefusal): string => ({
    not_a_guide: t('This is not yours to add to.', 'Bạn không thêm được vào đây.', 'ここには追加できません。'),
    not_your_place: t('This is not yours to add to.', 'Bạn không thêm được vào đây.', 'ここには追加できません。'),
    place_full: t(
      'Five photos is the most for one place.',
      'Mỗi địa điểm tối đa 5 ảnh.',
      '1つの場所につき写真は5枚までです。',
    ),
    day_full: t(
      'Ten photos a day is the limit.',
      'Mỗi ngày tối đa 10 ảnh.',
      '1日10枚までです。',
    ),
  }[why]);

  const add = async () => {
    const why = refusePhoto(place, me, counts);
    if (why) { Alert.alert(refusalText(why)); return; }

    // No permission gate: on iOS the library opens through PHPicker, which
    // runs outside the app and needs no authorisation. A pre-check would
    // only invent a wall — the same note `AvatarPicker` carries.
    //
    // Several at once (owner, 9 Oct 2026): five photographs used to be
    // five rounds of Add → roll → wait, and the roll can hand over the
    // lot in one visit. The limit is the room the caps leave, so the
    // policy's refusal of a sixth is never reached; ordered, because the
    // order picked is the order they go on the place.
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: true,
      selectionLimit: photoRoom(me, counts),
      orderedSelection: true,
    });
    if (picked.canceled || picked.assets.length === 0) return;

    // Last picked first. The cover trigger `addPlacePhoto` describes moves
    // the cover onto each new row as it lands, so the row inserted last
    // ends up as the cover — and the one the reader reached for first is
    // the one that should. Sort order still follows the order picked:
    // past everything already on the place, so the gallery — which is in
    // `sort_order` — puts them at the end rather than in front of
    // pictures that were here before them.
    const batch = picked.assets.map((asset, i) => ({ uri: asset.uri, sortOrder: count + 1 + i })).reverse();
    const stamp = Date.now();
    const failed: Error[] = [];
    let landed = 0;
    setProgress({ done: 0, total: batch.length });
    setStage('shrinking');
    try {
      if (!uid) throw new Error('not_signed_in');
      if (!placeId) throw new Error('place_not_found');
      for (const [i, item] of batch.entries()) {
        setStage('shrinking');
        try {
          const shrunk = await manipulateAsync(
            item.uri,
            [{ resize: { width: PHOTO_PX } }],
            { compress: PHOTO_QUALITY, format: SaveFormat.JPEG, base64: true },
          );
          if (!shrunk.base64) throw new Error('bad_image');

          setStage('uploading');
          // One stamp for the batch and the index on top: `Date.now()`
          // twice in one loop can be the same millisecond, and two files
          // on one path is one file.
          const path = photoPath(uid, place.slug, stamp + i);
          const publicUrl = await uploadPlacePhoto(path, decode(shrunk.base64));
          try {
            await addPlacePhoto({ placeId, uid, publicUrl, storagePath: path, sortOrder: item.sortOrder });
          } catch (e) {
            // The file landed and the row did not — the policy said no, or
            // the network went between the two writes. Take the file back
            // out before saying so, or it sits in the bucket with nothing
            // pointing at it: the third of the three leaks `prune-photos`
            // was written to sweep. Best effort, like the remove it calls.
            await removePhotoFile(path);
            throw e;
          }
          landed += 1;
        } catch (e) {
          // One failing does not stop the rest: the reader picked five and
          // four of them are fine. What failed is said once, at the end,
          // with a count, so the message matches what the grid shows.
          failed.push(e instanceof Error ? e : new Error(String(e)));
        }
        setProgress({ done: i + 1, total: batch.length });
      }
      if (landed > 0) {
        successHaptic();
        await recount();
        onAdded();
      }
      if (failed.length > 0) throw failed[0];
    } catch (e) {
      Alert.alert(
        batch.length > 1
          ? t(
            `Could not add ${failed.length} of ${batch.length} photos`,
            `Không thêm được ${failed.length}/${batch.length} ảnh`,
            `${batch.length}枚のうち${failed.length}枚を追加できませんでした`,
          )
          : t('Could not add your photo', 'Không thêm được ảnh', '写真を追加できませんでした'),
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      setStage('idle');
      setProgress({ done: 0, total: 0 });
    }
  };

  return { add, busy, stage, progress, mayOffer };
}

/** The step an add is on; `idle` between adds. */
export type AddStage = 'idle' | 'shrinking' | 'uploading';
