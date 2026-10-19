// The account's face: the avatar, and the sheet that changes it.
//
// Choosing a photo saves immediately rather than waiting for a form's Save
// button. An image is not a text field — the upload can be slow or fail, and
// tying it to a shared Save means one press can half-succeed, leaving a name
// stored and a picture not, with nothing on screen to say which.
//
// The sheet leads with the eight animals (`lib/avatars`), as the owner's
// board of 19 Oct 2026 laid it out: a grid to choose from, a tick on the
// one chosen, the library and the camera side by side under it, and one
// button that commits the animal. An animal waits for that button and a
// photograph does not, because the grid is browsed — a tap there is a look,
// not a decision — while opening the camera already was one. No toast
// after: the circle the sheet uncovers is the news, already in view.

import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthActions, useProfile, useSession } from '../lib/auth';
import { AVATAR_PRESETS, presetOf, type AvatarPreset } from '../lib/avatars';
import { useI18n } from '../lib/i18n';
import { colors, display, font, onPhoto, radius, space } from '../theme';
import { GradientCta, PressableScale, successHaptic } from './ui';
import { avatarSource, PRESET_IMAGES } from './avatarImages';
import { useFailText } from './authUi';

/** Square, so the crop the person frames is the crop the circle shows. */
const EDIT = { allowsEditing: true, aspect: [1, 1] as [number, number], quality: 1 };

export default function AvatarPicker({ size = 88, showCamera = true }: {
  size?: number;
  /** The camera badge is what says the circle is a control rather than a
   *  picture. Turn it off only where something else already occupies that
   *  corner *and* the same picker is reachable elsewhere — on Profile the
   *  engagement badge takes the corner, and Edit profile still shows this
   *  control with its badge intact. */
  showCamera?: boolean;
}) {
  const { t } = useI18n();
  const failText = useFailText();
  const { email } = useSession();
  const { profile } = useProfile();
  const { setAvatar, setAvatarPreset, clearAvatar } = useAuthActions();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  // The animal ticked in the grid, which is not yet the one worn: the
  // sheet opens on the one worn, and the button stays dim until another
  // is chosen.
  const worn = presetOf(profile.avatar_url);
  const [chosen, setChosen] = useState<AvatarPreset | null>(null);
  const open = () => { setChosen(worn); setSheet(true); };
  // Four to a row across the sheet's width, at most 80pt: 76 on a 390pt
  // phone, the size the board drew them.
  const cell = Math.min(80, Math.floor((width - 2 * space.page - 3 * GRID_GAP) / 4));

  // iOS will not present a view controller while another is dismissing.
  // Closing the sheet and launching the picker in the same tick leaves the
  // camera never presented and its promise never settled — which is a
  // spinner that never stops, with no error to catch. Hold the job until
  // the sheet has actually gone.
  const pending = useRef<null | (() => Promise<void>)>(null);
  const flush = () => {
    const job = pending.current;
    pending.current = null;
    if (job) run(job);
  };
  const start = (job: () => Promise<void>) => {
    pending.current = job;
    setSheet(false);
    // Modal.onDismiss is iOS-only; elsewhere nothing would ever flush it.
    if (Platform.OS !== 'ios') setTimeout(flush, 250);
  };

  // Same fallback the name row uses, so the letter and the name agree for
  // someone who signed up without giving a name.
  const initial = (profile.full_name || (email ?? '').split('@')[0] || '?')
    .trim().charAt(0).toUpperCase();

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    try {
      await job();
      successHaptic();
    } catch (e) {
      // The names `setAvatar` throws — `too_soon`, `bad_image`, the three
      // stalls — become sentences here; anything else arrives as it was.
      Alert.alert(
        t('Could not update your photo', 'Không cập nhật được ảnh', '写真を更新できませんでした'),
        failText(e instanceof Error ? e.message : String(e)),
      );
    } finally {
      setBusy(false);
    }
  };

  // No permission gate here on purpose. On iOS the library opens through
  // PHPicker, which runs outside the app and needs no authorisation — a
  // pre-check would only invent a wall, turning away someone whose picker
  // would have worked. The camera below is the opposite: it genuinely
  // needs asking.
  const fromLibrary = () => start(async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ ...EDIT, mediaTypes: ['images'] });
    if (!res.canceled && res.assets[0]) await setAvatar(res.assets[0].uri);
  });

  const fromCamera = () => start(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error(t('Camera access is off in Settings.', 'Quyền dùng máy ảnh đang tắt trong Cài đặt.', '設定でカメラへのアクセスが無効です。'));
    const res = await ImagePicker.launchCameraAsync(EDIT);
    if (!res.canceled && res.assets[0]) await setAvatar(res.assets[0].uri);
  });

  const remove = () => start(clearAvatar);
  const wear = () => { if (chosen) start(() => setAvatarPreset(chosen)); };
  const source = avatarSource(profile.avatar_url);

  return (
    <>
      <PressableScale
        onPress={open}
        scaleTo={0.94}
        accessibilityRole="button"
        accessibilityLabel={t('Change profile photo', 'Đổi ảnh đại diện', 'プロフィール写真を変更')}
      >
        {/* Two views, because one cannot do both jobs: the ring clips its
            contents to a circle, and the badge has to hang outside that
            circle. Put the badge inside the clipping view and it is cut in
            half; turn clipping off to save it and the photo goes square. */}
        <View style={{ width: size, height: size }}>
          <View style={[s.ring, { width: size, height: size, borderRadius: size / 2 }]}>
            {source
              ? <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
              : <Text style={[s.initial, { fontSize: size * 0.39 }]}>{initial}</Text>}
            {busy && (
              <View style={[StyleSheet.absoluteFill, s.busy]}>
                <ActivityIndicator color={onPhoto.accent} />
              </View>
            )}
          </View>
          {/* Without this the circle reads as decoration, not a control.
              The gap between badge and photo is a ring of page behind it
              rather than a border on it — see `badgeRing`. */}
          {showCamera && (
            <View style={s.badgeRing}>
              <View style={s.badge}>
                <Ionicons name="camera" size={13} color={colors.badgeInk} />
              </View>
            </View>
          )}
        </View>
      </PressableScale>

      <Modal
        visible={sheet}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSheet(false)}
        onDismiss={flush}
      >
        <Pressable style={s.backdrop} onPress={() => setSheet(false)} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]} testID="avatar-sheet">
          <View style={s.grabber} />
          <View style={s.head}>
            <Text style={s.sheetTitle}>{t('Profile photo', 'Ảnh đại diện', 'プロフィール写真')}</Text>
            <PressableScale
              onPress={() => setSheet(false)}
              accessibilityRole="button"
              accessibilityLabel={t('Close', 'Đóng', '閉じる')}
              hitSlop={8}
              style={s.close}
              contentStyle={s.closeFace}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </PressableScale>
          </View>
          <View style={s.grid}>
            {AVATAR_PRESETS.map((p) => {
              const on = chosen === p.key;
              return (
                <Pressable
                  key={p.key}
                  onPress={() => setChosen(p.key)}
                  accessibilityRole="button"
                  accessibilityLabel={t(p.en, p.vi, p.ja)}
                  aria-selected={on}
                  testID={`avatar-preset-${p.key}`}
                  style={[s.cell, { width: cell, height: cell, borderRadius: cell / 2 }, on && s.cellOn]}
                >
                  <Image source={PRESET_IMAGES[p.key]} style={s.cellImage} contentFit="cover" accessible={false} />
                  {on && (
                    <View style={s.tickRing}>
                      <View style={s.tick}>
                        <Ionicons name="checkmark" size={13} color={colors.accentInk} />
                      </View>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
          <View style={s.rule} />
          <View style={s.pair}>
            <Source icon="images-outline" label={t('Library', 'Thư viện', 'ライブラリ')}
              a11y={t('Choose from library', 'Chọn từ thư viện', 'ライブラリから選ぶ')} onPress={fromLibrary} />
            <Source icon="camera-outline" label={t('Camera', 'Chụp ảnh', 'カメラ')}
              a11y={t('Take a photo', 'Chụp ảnh', '写真を撮る')} onPress={fromCamera} />
          </View>
          <View style={s.commit}>
            <GradientCta
              wide
              label={t('Use this avatar', 'Dùng avatar này', 'このアバターにする')}
              onPress={wear}
              disabled={!chosen || chosen === worn}
              testID="avatar-use"
            />
          </View>
          {/* Nothing to remove until there is something there. */}
          {profile.avatar_url ? (
            <PressableScale onPress={remove} accessibilityRole="button" contentStyle={s.remove}>
              <Text style={s.removeText}>{t('Remove photo', 'Xóa ảnh', '写真を削除')}</Text>
            </PressableScale>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

/** One of the two ways to a photograph: half the row each, the glyph
 *  and a word, and the full phrase for VoiceOver. */
function Source({ icon, label, a11y, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  a11y: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y}
      style={{ flex: 1 }} contentStyle={s.source}>
      <Ionicons name={icon} size={20} color={colors.accent} />
      <Text style={s.sourceText}>{label}</Text>
    </PressableScale>
  );
}

/** Between two animals in the grid, across and down. */
const GRID_GAP = 14;

const s = StyleSheet.create({
  ring: {
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    backgroundColor: colors.surfaceGlass, borderWidth: 1.5, borderColor: colors.borderGlass,
  },
  initial: { color: colors.accent, fontWeight: font.semibold },
  busy: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,11,10,0.55)', borderRadius: 999 },
  /**
   * The ring separating the badge from the photograph, drawn as a disc of
   * page colour behind it rather than as a border on it.
   *
   * A border was the obvious way and it was wrong. `borderColor` ends up
   * on `layer.borderColor`, which is a CGColor — a fixed value resolved
   * once — where `backgroundColor` stays a UIColor that iOS re-resolves
   * against the view's traits. Give both a `DynamicColorIOS` pair and the
   * same view can come back with the right fill and the wrong edge, which
   * is exactly what it did: a black ring on a cream page after signing
   * back in. A background cannot go stale that way.
   */
  badgeRing: {
    position: 'absolute', right: -4, bottom: -4,
    padding: 2, borderRadius: 15,
    backgroundColor: colors.bg,
  },
  badge: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    // Opaque, not the tint: this one sits on the photograph it belongs to.
    backgroundColor: colors.badgeSolid,
  },

  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,5,8,0.62)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    alignItems: 'center', gap: 4,
    paddingHorizontal: space.page, paddingTop: 10,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  grabber: { width: 38, height: 4, borderRadius: 2, backgroundColor: colors.textTertiary, marginBottom: 12 },
  // The title centred on the sheet, the × at its edge without pushing it.
  head: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  sheetTitle: { color: colors.text, fontSize: 18, fontFamily: display.bold },
  // On the outer box, so the target sits where the mark does.
  close: { position: 'absolute', right: 0 },
  closeFace: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, justifyContent: 'center' },
  // The ring is drawn by every cell, clear until chosen, so choosing one
  // does not move the picture inside it by the ring's width.
  cell: { padding: 3, borderWidth: 2.5, borderColor: 'transparent' },
  cellOn: { borderColor: colors.accent },
  cellImage: { flex: 1, borderRadius: 999 },
  // The gap between tick and picture is a disc of sheet colour behind the
  // tick, not a border on it, for the reason `badgeRing` gives.
  tickRing: { position: 'absolute', top: -3, right: -3, padding: 2, borderRadius: 13, backgroundColor: colors.bgElevated },
  tick: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  rule: {
    alignSelf: 'stretch', height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderGlassSoft, marginVertical: 16,
  },
  pair: { flexDirection: 'row', gap: 12, alignSelf: 'stretch' },
  source: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: radius.pill,
    backgroundColor: colors.surfaceGlass,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  sourceText: { color: colors.text, fontSize: 15, fontWeight: font.medium },
  commit: { alignSelf: 'stretch', marginTop: 14 },
  remove: { paddingVertical: 12, marginTop: 2 },
  removeText: { color: colors.bad, fontSize: 15, fontWeight: font.medium },
});
