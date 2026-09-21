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
import { supabase } from '../lib/supabase';
import { addPlacePhoto, fetchMyPhotoCounts } from '../lib/data';
import { useIsGuide } from '../lib/useGuideGrant';
import {
  canAddPhoto, photoPath, refusePhoto, PHOTO_PX, PHOTO_QUALITY,
  type Guidable, type PhotoRefusal,
} from '../lib/guide';
import { successHaptic } from './ui';

const BUCKET = 'place-photos';

export function useAddPhoto({ place, placeId, count, onAdded }: {
  place: Guidable & { slug: string };
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
  const granted = useIsGuide();
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState({ mineHere: 0, mineToday: 0 });

  const me = { uid, granted };
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
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (picked.canceled || !picked.assets[0]) return;

    setBusy(true);
    try {
      if (!uid) throw new Error('not_signed_in');
      if (!placeId) throw new Error('place_not_found');
      const shrunk = await manipulateAsync(
        picked.assets[0].uri,
        [{ resize: { width: PHOTO_PX } }],
        { compress: PHOTO_QUALITY, format: SaveFormat.JPEG, base64: true },
      );
      if (!shrunk.base64) throw new Error('bad_image');

      const path = photoPath(uid, place.slug, Date.now());
      const up = await supabase.storage
        .from(BUCKET)
        .upload(path, decode(shrunk.base64), { contentType: 'image/jpeg' });
      if (up.error) throw new Error(up.error.message);

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      await addPlacePhoto({
        placeId,
        uid,
        publicUrl: data.publicUrl,
        storagePath: path,
        // Past everything already on the place, so the gallery — which is
        // in `sort_order` — puts it at the end rather than in front of
        // pictures that were here before it. The cover moves onto it
        // anyway, by the trigger `addPlacePhoto` describes.
        sortOrder: count + 1,
      });
      successHaptic();
      await recount();
      onAdded();
    } catch (e) {
      Alert.alert(
        t('Could not add your photo', 'Không thêm được ảnh', '写真を追加できませんでした'),
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      setBusy(false);
    }
  };

  return { add, busy, mayOffer };
}
