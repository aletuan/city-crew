// The sheet the camera on a collection's cover opens (owner, 22 Nov 2026):
// the photographs the list's places hold, to try on the cover above it.
//
// Made on the person page's cover sheet (`person/Wall`) and keeps its
// reasons: the page behind is the preview, so a tap on a photograph puts
// it on the cover at once and the scrim leaves the page undimmed; the sheet
// stands under the cover (`SHEET_MAX`) so the cover stays in sight; Save
// writes, and closing without it puts the cover back. The grid is the
// collection form's own (`CoverGrid`), which used to be where a cover was
// chosen — the form now holds a name, a note and who may see it, the same
// on a new list as on an old one.
//
// One source only. The person page offers cities, collections and an
// upload; a collection's cover is a claim about the list, and the honest
// pictures for it are its own places' (the form's note, 16 Nov 2026).
// So no rows that scroll sideways here: a grid that scrolls down.

import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { colors, display, space } from '../theme';
import { CoverGrid, type CoverChoice } from './CoverGrid';
import { Glyph, ICON } from './ui/glyph';
import { GradientCta, PressableScale } from './ui';

/** Short of the cover, as the person page's sheet is: the cover and the
 *  card's first lines end about 330pt down a 844pt phone; 60% leaves 338. */
const SHEET_MAX = '60%';

export function CollectionCoverSheet({ visible, onClose, choices, opened, picked, autoUri, onPick, onSave, busy }: {
  visible: boolean;
  onClose: () => void;
  choices: readonly CoverChoice[];
  /** The cover the list has: a photograph's id, or null for Auto. */
  opened: string | null;
  /** The cover being tried: what the tick is on. */
  picked: string | null;
  autoUri: string | undefined;
  onPick: (id: string | null) => void;
  onSave: () => void;
  busy: boolean;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      {/* Clear, like the person page's: still a press, so a tap above
          the sheet closes it. */}
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]} testID="cover-sheet">
        <View style={s.grabber} />
        <View style={s.head}>
          <Text style={s.title}>{t('Cover', 'Ảnh bìa', 'カバー', '封面', '封面')}</Text>
          <PressableScale onPress={onClose} accessibilityRole="button" accessibilityLabel={t('Close', 'Đóng', '閉じる', '关闭', '關閉')}
            hitSlop={8} style={s.close} contentStyle={s.closeFace} testID="cover-close">
            <Glyph name="close" size={ICON.nav} color={colors.textSecondary} />
          </PressableScale>
        </View>
        <ScrollView style={s.body} showsVerticalScrollIndicator={false}>
          <CoverGrid choices={choices} opened={opened} picked={picked} autoUri={autoUri} onPick={onPick} />
        </ScrollView>
        <View style={s.commit}>
          <GradientCta wide label={t('Save', 'Lưu', '保存', '保存', '儲存')} onPress={onSave}
            busy={busy} disabled={busy || picked === opened} testID="cover-save" />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: SHEET_MAX,
    paddingHorizontal: space.page, paddingTop: 10,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: colors.textTertiary, marginBottom: 12 },
  head: { alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { color: colors.text, fontSize: 18, fontFamily: display.bold },
  close: { position: 'absolute', right: 0 },
  closeFace: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  body: { flexGrow: 0 },
  commit: { marginTop: 12 },
});
