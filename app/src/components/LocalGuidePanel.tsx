// The offer to add a photograph, on a place the reader themselves put here.
//
// ── who ever sees this ──
//
// Three conditions, all of them also clauses of the insert policy: signed
// in, granted the role by the desk, and looking at a place they imported.
// `canAddPhoto` states them once and this component draws nothing unless
// it says yes — which is the point. A control that appears for everybody
// and refuses most of them is worse than no control, and it would refuse
// them *after* the picker, the crop and the upload.
//
// The mockup this follows had a second, primary "Edit Place" button
// beside this one, greyed out. It is not here. A disabled primary button
// is the loudest thing on a panel promising the one thing that cannot be
// done, and it pulls the eye away from the button that works. Editing
// arrives in its own release, with its own button.
//
// ── the upload, and why it is here rather than in lib ──
//
// The shape is `AvatarPicker`'s, for the same reasons: a photograph saves
// the moment it is chosen rather than waiting for a Save that could
// half-succeed, and the picker is held until the sheet has actually gone
// because iOS will not present a view controller while another dismisses.
// Everything decidable — who may, what the file is called, which limit
// was reached — lives in `lib/guide` under the coverage gate; what is
// left here is the parts that need a camera roll and a network.

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import welcomeLogo from '../../assets/welcome-logo.png';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { addPlacePhoto, fetchMyPhotoCounts, fetchPlaceId, useIsLocalGuide } from '../lib/data';
import {
  canAddPhoto, photoPath, refusePhoto, PHOTO_PX, PHOTO_QUALITY,
  type PhotoRefusal,
} from '../lib/guide';
import type { Place } from '../lib/types';
import { colors, font, radius, space } from '../theme';
import { PressableScale, successHaptic } from './ui';

const BUCKET = 'place-photos';

export default function LocalGuidePanel({ place, onAdded, testID }: {
  place: Place;
  /** Called after a photograph lands, so the screen can re-read the place. */
  onAdded: () => void;
  testID?: string;
}) {
  const { t } = useI18n();
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;
  const { data: granted } = useIsLocalGuide(uid);
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState({ mineHere: 0, mineToday: 0 });

  const me = { uid, granted };
  const mayOffer = canAddPhoto(place, me);

  // Counted before the picker rather than after the upload, which is the
  // only way the refusal can name a limit instead of saying "that did not
  // work". The policy still counts; this is the message in front of it.
  //
  // The id has to be looked up because a place travels this app by slug —
  // see `fetchPlaceId` for why that column is not in the catalog query.
  const recount = useCallback(async () => {
    if (!uid) return;
    const id = await fetchPlaceId(place.slug);
    if (id) setCounts(await fetchMyPhotoCounts(id, uid));
  }, [uid, place.slug]);

  useEffect(() => { if (mayOffer) void recount(); }, [mayOffer, recount]);

  if (!mayOffer) return null;

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
      const placeId = await fetchPlaceId(place.slug);
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
        // Past everything already on the place, so `photosOf` — which
        // sorts the cover first and then by this — puts it at the end
        // rather than in front of pictures that were here before it.
        sortOrder: (place.place_photos?.length ?? 0) + 1,
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

  return (
    <View style={s.panel} testID={testID}>
      <View style={s.head}>
        {/* The app's own mark rather than a camera glyph.
            A camera said what the button beside it already says, twice on
            one card — and said it about the tool instead of about who is
            being asked. This panel only ever shows to the person who put
            the place here, so the mark that belongs at its head is the one
            they recognise. The artwork carries its own cut-out background,
            so it reads on either ground. */}
        <View style={s.mark}>
          <Image source={welcomeLogo} style={s.markLogo} contentFit="contain" />
        </View>
        <View style={s.words}>
          <Text style={s.title}>{t('Your place', 'Địa điểm của bạn', 'あなたの場所')}</Text>
          <Text style={s.sub}>
            {t('Keep it up to date', 'Giữ địa điểm luôn đúng', '最新に保ちましょう')}
          </Text>
        </View>
        <PressableScale
          onPress={busy ? undefined : add}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          containerStyle={s.buttonSlot}
          style={s.button}
          testID="guide-add-photo"
        >
          {busy
            ? <ActivityIndicator color={colors.accentInk} />
            : (
              <>
                <Ionicons name="camera" size={16} color={colors.accentInk} />
                <Text style={s.buttonText}>{t('Add photo', 'Thêm ảnh', '写真を追加')}</Text>
              </>
            )}
        </PressableScale>
      </View>
      {/* What the person is saying by choosing one. Full width under the
          row rather than squeezed beside the button: it is a sentence, and
          a 120pt column would break it over three ragged lines.

          Read before the picker opens rather than behind a confirm — a
          dialog between the button and the camera roll is a tap that
          teaches nobody anything. */}
      <Text style={s.note}>
        {t(
          'A photo chosen from my own Photos',
          'Ảnh lựa chọn từ Photos của tôi',
          '自分の写真から選んだ画像',
        )}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  // The accent at tint strength, the one place on this screen that takes a
  // fill: it is an offer rather than a fact, and everything around it —
  // the facts row, the info card — is glass or paper.
  panel: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.card, padding: space.cardPadding,
    marginTop: space.headingToContent,
  },
  // The mark, the words and the button on one line, where they used to
  // stack. Stacked, this card ran 183pt — a third of the first screen,
  // spent on an affordance only the person who added the place can even
  // see, and paid for by pushing the opening hours below the fold.
  head: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  mark: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  // Inside the 40pt disc with a little air: the logo is drawn to its own
  // edges, where a 22pt glyph came with padding built in.
  markLogo: { width: 26, height: 26 },
  words: { flex: 1, gap: 2 },
  // A size down from `type.cardTitle`: the words share their line with a
  // button now, and the heading of a two-line aside is not a card title.
  title: { color: colors.accent, fontSize: 15.5, fontWeight: font.semibold },
  // "Keep it up to date", not "Help keep this place up to date". The
  // longer sentence wrapped to three lines in the ~140pt the button
  // leaves, and every word it lost was already said by the title above
  // it and the button beside it.
  sub: { color: colors.textSecondary, fontSize: 13 },
  // `containerStyle`, not `style`: PressableScale puts `style` on its inner
  // animated view and only `containerStyle` on the Pressable, so a width
  // set on the wrong one leaves the button its content's size.
  buttonSlot: { flexShrink: 0 },
  // Narrower than it was — 14pt of padding and a 16pt glyph rather than
  // 18 and 17 — because it shares the line now. Still 44 high: a target
  // may lose width to its neighbours and never height.
  button: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: 44, paddingHorizontal: 14,
    borderRadius: radius.pill, backgroundColor: colors.accentFill,
  },
  buttonText: { color: colors.accentInk, fontSize: 14.5, fontWeight: font.semibold },
  note: { color: colors.textTertiary, fontSize: 12, marginTop: 10 },
});
