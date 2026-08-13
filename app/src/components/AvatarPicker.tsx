// The account's face: the avatar, and the sheet that changes it.
//
// Choosing a photo saves immediately rather than waiting for a form's Save
// button. An image is not a text field — the upload can be slow or fail, and
// tying it to a shared Save means one press can half-succeed, leaving a name
// stored and a picture not, with nothing on screen to say which.

import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { colors, display, font, radius, space } from '../theme';
import { PressableScale, successHaptic } from './ui';

/** Square, so the crop the person frames is the crop the circle shows. */
const EDIT = { allowsEditing: true, aspect: [1, 1] as [number, number], quality: 1 };

export default function AvatarPicker({ size = 88 }: { size?: number }) {
  const { t } = useI18n();
  const { profile, email, setAvatar, clearAvatar } = useAuth();
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);

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
      Alert.alert(
        t('Could not update your photo', 'Không cập nhật được ảnh', '写真を更新できませんでした'),
        e instanceof Error ? e.message : String(e),
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

  return (
    <>
      <PressableScale
        onPress={() => setSheet(true)}
        scaleTo={0.94}
        accessibilityRole="button"
        accessibilityLabel={t('Change profile photo', 'Đổi ảnh đại diện', 'プロフィール写真を変更')}
      >
        <View style={[s.ring, { width: size, height: size, borderRadius: size / 2 }]}>
          {profile.avatar_url
            ? <Image source={{ uri: profile.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
            : <Text style={[s.initial, { fontSize: size * 0.39 }]}>{initial}</Text>}
          {busy && (
            <View style={[StyleSheet.absoluteFill, s.busy]}>
              <ActivityIndicator color={colors.accent} />
            </View>
          )}
          {/* Without this the circle reads as decoration, not a control. */}
          <View style={s.badge}>
            <Ionicons name="camera" size={13} color={colors.accentInk} />
          </View>
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
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.grabber} />
          <Text style={s.sheetTitle}>{t('Profile photo', 'Ảnh đại diện', 'プロフィール写真')}</Text>
          <Row icon="images-outline" label={t('Choose from library', 'Chọn từ thư viện', 'ライブラリから選ぶ')} onPress={fromLibrary} />
          <Row icon="camera-outline" label={t('Take a photo', 'Chụp ảnh', '写真を撮る')} onPress={fromCamera} />
          {/* Nothing to remove until there is something there. */}
          {profile.avatar_url ? (
            <Row icon="trash-outline" label={t('Remove photo', 'Xóa ảnh', '写真を削除')} onPress={remove} danger />
          ) : null}
          <PressableScale onPress={() => setSheet(false)} accessibilityRole="button" style={s.cancel}>
            <Text style={s.cancelText}>{t('Cancel', 'Huỷ', 'キャンセル')}</Text>
          </PressableScale>
        </View>
      </Modal>
    </>
  );
}

function Row({ icon, label, onPress, danger }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" containerStyle={{ alignSelf: 'stretch' }} style={s.row}>
      <Ionicons name={icon} size={20} color={danger ? colors.bad : colors.accent} />
      <Text style={[s.rowText, danger && { color: colors.bad }]}>{label}</Text>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  ring: {
    alignItems: 'center', justifyContent: 'center', overflow: 'visible',
    backgroundColor: colors.surfaceGlass, borderWidth: 1.5, borderColor: colors.borderGlass,
  },
  initial: { color: colors.accent, fontWeight: font.semibold },
  busy: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,11,10,0.55)', borderRadius: 999 },
  badge: {
    position: 'absolute', right: -2, bottom: -2,
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent,
    borderWidth: 2, borderColor: colors.bg,
  },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,5,8,0.62)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    alignItems: 'center', gap: 4,
    paddingHorizontal: space.page, paddingTop: 10,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  grabber: { width: 38, height: 4, borderRadius: 2, backgroundColor: colors.textTertiary, marginBottom: 12 },
  sheetTitle: { color: colors.text, fontSize: 18, fontFamily: display.bold, marginBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 15, paddingHorizontal: 4,
  },
  rowText: { color: colors.text, fontSize: 16, fontWeight: font.medium },
  cancel: { paddingVertical: 14, marginTop: 4 },
  cancelText: { color: colors.textSecondary, fontSize: 15.5, fontWeight: font.medium },
});
