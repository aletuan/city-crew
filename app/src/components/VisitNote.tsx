// What a visit's owner said about it, or the line that asks them to.
//
// A note is the owner's own words, read back: plain, two lines, and a
// press on it opens the sheet it was written in (`CheckinSheet`).
//
// The pencil follows a note too (owner, 26 Nov 2026): a note in the
// secondary ink was taken for something to read, never for something to
// press, and the card around it opens the place. The pencil says this
// line is the one that edits.
//
// A visit with none carries the invitation the empty description of a
// list does, and the empty bio (`collectionDetail/head`, `BioInvite`):
// faint italic words and the small pencil in the app's gold (owner,
// 24 Nov 2026 — "giống collection edit"). It matters most on the visits
// made before a note could be written, every one of which has none.
// Only the owner is ever drawn this — a caller shows it on the reader's
// own visits and nowhere else; a friend is shown a note or nothing.
//
// A control of its own inside a row that is itself a press: the row
// goes to the place, this goes to the words, and React Native gives the
// press to the inner one.

import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useI18n } from '../lib/i18n';
import { colors } from '../theme';
import { PencilGlyph } from './PencilGlyph';
import { PressableScale } from './ui';

export default function VisitNote({ note, onEdit }: { note: string | null | undefined; onEdit: () => void }) {
  const { t } = useI18n();
  const ask = t('Write a few lines about this visit', 'Viết vài dòng về lần ghé này', 'この訪問についてひとこと書く', '为这次打卡写几句', '為這次打卡寫幾句');
  return (
    <PressableScale
      onPress={onEdit}
      scaleTo={0.97}
      haptic="selection"
      // 10 above and below a 20pt line: the 40 a second control in a row
      // can have without reaching into the name above it.
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel={note
        ? t(`Your note: ${note}. Edit`, `Ghi chú của bạn: ${note}. Sửa`, `メモ：${note}。編集`, `你的备注：${note}。编辑`, `你的備註：${note}。編輯`)
        : ask}
      contentStyle={s.row}
      testID={note ? 'visit-note' : 'visit-note-add'}
    >
      {note ? (
        <>
          <Text style={s.said} numberOfLines={2}>{note}</Text>
          <PencilGlyph color={colors.sun} />
        </>
      ) : (
        <>
          <Text style={s.ask} numberOfLines={1}>{ask}</Text>
          <PencilGlyph color={colors.sun} />
        </>
      )}
    </PressableScale>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 2 },
  said: { flexShrink: 1, color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  ask: { flexShrink: 1, color: colors.textTertiary, fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
});
