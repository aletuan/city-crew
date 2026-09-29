// "About City Crew": which copy of the app this is.
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
// Share rather than copy. The clipboard is a native module this binary
// does not carry, and this ships by OTA. React Native's own share sheet
// offers Copy anyway, beside Messages and Mail, which is where the text
// is going.

import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_INFO, type AppInfo, shareText, shortUpdateId, updateDate, versionLabel } from '../lib/appinfo';
import { useI18n } from '../lib/i18n';
import { colors, font, radius, space, type } from '../theme';
import { fireHaptic, PressableScale } from './ui';

function Row({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <View style={[s.row, !first && s.rowDivider]}>
      <Text style={s.label}>{label}</Text>
      {/* Selectable, so a long press lifts one value on its own — the
          update id, say — without going through the share sheet. */}
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
    : t('Shipped with the build', 'Đi kèm bản cài', 'ビルドに同梱');

  const share = () => {
    fireHaptic('selection');
    // Dismissed and failed shares both come back here; neither is worth
    // telling the reader about, since they chose to close the sheet.
    Share.share({ message: shareText(info) }).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel={close} />
      <Animated.View
        accessibilityViewIsModal
        style={[s.sheet, {
          paddingBottom: 14 + insets.bottom,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, 320] }) }],
        }]}
      >
        <View style={s.handle} />
        <Text style={s.title} accessibilityRole="header">
          {t('About City Crew', 'Giới thiệu City Crew', 'City Crewについて')}
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
        <PressableScale onPress={share} accessibilityRole="button" style={s.share}>
          <Ionicons name="share-outline" size={18} color={colors.accent} />
          <Text style={s.shareText}>{t('Share these details', 'Chia sẻ thông tin này', 'この情報を共有')}</Text>
        </PressableScale>
        <PressableScale onPress={onClose} haptic="selection" accessibilityRole="button" style={s.done}>
          <Text style={s.doneText}>{t('Done', 'Xong', '完了')}</Text>
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
  share: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 14, paddingVertical: 13,
  },
  shareText: { color: colors.accent, ...type.body, fontWeight: font.medium },
  // The other sheets' quiet Done, word for word.
  done: { paddingVertical: 12, marginTop: 4, alignSelf: 'center' },
  doneText: { color: colors.textSecondary, fontSize: 15, fontWeight: font.medium },
});
