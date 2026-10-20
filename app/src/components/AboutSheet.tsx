// "Version info": which copy of the app this is.
//
// Titled for what it holds (owner, 21 Oct 2026). It was "About City Crew"
// ("Giới thiệu City Crew"), which promised a word about the app and
// delivered four lines of build detail. iOS's own "About" can carry that
// name because it also holds the device's name, its storage and the rest;
// this sheet holds only the version, so it says so.
//
// For the one question support always starts with — which version are you
// on — and the one a release keeps raising: did the update arrive? The
// version alone cannot answer the second. An OTA changes the code without
// changing the version, so the row that settles it is the update's date.
// A reader who reopened the app after a publish and still sees the old
// date has not taken it yet.
//
// A sheet rather than values on the Profile row. Four lines of build
// detail are noise on a screen that is otherwise about the reader. The
// row stays a destination like the two documents above it, and costs one
// line.
//
// No Share button, since 21 Oct 2026 (owner). It handed the four lines to
// the system share sheet as text; nobody used it, and each value on the
// card can still be long-pressed and copied on its own. It had cost a
// freeze to get right: raised from inside the Modal, a cancelled share
// left the Modal's window holding every touch until the app was killed.
// A share added here again has to close this sheet first.

import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_INFO, type AppInfo, shortUpdateId, updateDate, versionLabel } from '../lib/appinfo';
import { useI18n } from '../lib/i18n';
import { colors, font, radius, space, type } from '../theme';
import { PressableScale } from './ui';
import { useSheetDrag } from './sheetDrag';

function Row({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <View style={[s.row, !first && s.rowDivider]}>
      <Text style={s.label}>{label}</Text>
      {/* Selectable, so a long press lifts one value on its own — the
          update id, say. */}
      <Text style={s.value} selectable numberOfLines={1}>{value}</Text>
    </View>
  );
}

export default function AboutSheet({ visible, onClose, info = APP_INFO }: {
  visible: boolean;
  onClose: () => void;
  /** What to describe; the running app unless a test says otherwise. */
  info?: AppInfo;
}) {
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  // The house entrance, as in ThemeSwitcher: the modal fades, the sheet
  // alone rises on a native-driven spring.
  const rise = useRef(new Animated.Value(1)).current;
  const { drag, handlers } = useSheetDrag(visible, onClose);
  useEffect(() => {
    if (!visible) { rise.setValue(1); return; }
    Animated.spring(rise, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 3 }).start();
  }, [visible, rise]);

  const close = t('Close', 'Đóng', '閉じる');
  const update = info.update
    ? [info.update.at && updateDate(info.update.at, lang), shortUpdateId(info.update.id)]
      .filter(Boolean).join(' · ')
    // The build's own code: nothing published since has reached this
    // phone, or this is a build that never takes an update.
    : t('Shipped with the build', 'Có sẵn trong bản cài', 'ビルドに同梱');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel={close} />
      <Animated.View
        {...handlers}
        accessibilityViewIsModal
        style={[s.sheet, {
          paddingBottom: 14 + insets.bottom,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, 320] }) }, { translateY: drag }],
        }]}
      >
        <View style={s.handle} />
        <Text style={s.title} accessibilityRole="header">
          {t('Version info', 'Thông tin phiên bản', 'バージョン情報')}
        </Text>
        <View style={s.card}>
          <Row
            first
            label={t('Version', 'Phiên bản', 'バージョン')}
            value={versionLabel(info) ?? t('Unknown', 'Không rõ', '不明')}
          />
          {/* No channel is Expo Go or a development build — always us. */}
          <Row
            label={t('Channel', 'Kênh', 'チャンネル')}
            value={info.channel ?? t('Development', 'Bản phát triển', '開発版')}
          />
          <Row label={t('Update', 'Bản cập nhật', 'アップデート')} value={update} />
          {/* Which updates this build can take: only ones published for the
              same runtime. Worth a line because it is the answer to "why
              did this phone not get it?" */}
          <Row label="Runtime" value={info.runtime ?? '—'} />
        </View>
        {/* "Close", not "Done": nothing was being done here. It reads what
            the documents beside it say (LegalSheet): glyph and word, in
            the quieter colour. */}
        <PressableScale onPress={onClose} haptic="selection" accessibilityRole="button" contentStyle={s.done}>
          <Ionicons name="close" size={18} color={colors.textSecondary} />
          <Text style={s.doneText}>{close}</Text>
        </PressableScale>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  // The five sheets' backdrop, so this one dims the room the same way.
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,5,8,0.62)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.card + 6, borderTopRightRadius: radius.card + 6,
    paddingHorizontal: space.cardPadding, paddingTop: 8,
  },
  handle: {
    alignSelf: 'center', width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.borderGlass, marginBottom: 12,
  },
  title: {
    color: colors.text, fontSize: 18, fontWeight: font.semibold,
    marginBottom: 12, paddingHorizontal: 4,
  },
  card: {
    backgroundColor: colors.surfaceGlass, borderRadius: radius.card,
    paddingHorizontal: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlass },
  label: { color: colors.textSecondary, fontSize: 15 },
  value: { flex: 1, textAlign: 'right', color: colors.text, fontSize: 15, fontWeight: font.medium },
  done: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 14, paddingVertical: 13,
  },
  doneText: { color: colors.textSecondary, ...type.body, fontWeight: font.medium },
});
