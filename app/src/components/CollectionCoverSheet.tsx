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
import { ScrollView, StyleSheet, View } from 'react-native';
import { useI18n } from '../lib/i18n';
import { CoverGrid, type CoverChoice } from './CoverGrid';
import { GradientCta, Sheet } from './ui';

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
  return (
    // `ui/Sheet`, clear: the page behind is the preview, so it is not
    // dimmed, and a tap above the sheet still closes it. The fade alone,
    // no spring, as it came.
    <Sheet visible={visible} onClose={onClose} scrim={false} rise={false} maxHeight={SHEET_MAX}
      title={t('Cover', 'Ảnh bìa', 'カバー', '封面', '封面')} closeTestID="cover-close" testID="cover-sheet">
        <ScrollView style={s.body} showsVerticalScrollIndicator={false}>
          <CoverGrid choices={choices} opened={opened} picked={picked} autoUri={autoUri} onPick={onPick} />
        </ScrollView>
        <View style={s.commit}>
          <GradientCta wide label={t('Save', 'Lưu', '保存', '保存', '儲存')} onPress={onSave}
            busy={busy} disabled={busy || picked === opened} testID="cover-save" />
        </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  body: { flexGrow: 0 },
  commit: { marginTop: 12 },
});
