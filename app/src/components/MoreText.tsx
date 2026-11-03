// A long text, five lines of it until the reader asks for the rest.
//
// The collection's description (owner, 3 Nov 2026): a curator's sixteen
// lines on "Caffee taste in Đà Lạt" filled the screen the places are the
// point of, and one row of them showed under it. Now it stops at five, with
// "… Read more" at the end of the fifth — on the line, after the words, as
// the owner's reference draws it — and the whole paragraph is the button.
// Open, the text runs out in full and "Show less" follows its last word,
// where there is always room for it.
//
// The link is the accent, the ink "Xóa" and "Bỏ lọc" wear as words that do
// something. The reference drew it in the green of "Công khai", which is a
// state, not an action, and would be green on every look.
//
// ── how it knows ──
// The first paint is the whole text, unclamped, because `onTextLayout`
// reports the lines it drew, and a Text already held to five could never
// say there was a sixth — the address on a place's screen measures the
// same way. `clampText` (lib/moretext) takes those lines and says where
// to cut so the link fits; a text of five lines or fewer is left alone,
// with no link. It costs one frame of the whole text on the long ones.
//
// Every visit opens it closed. A text the reader opened is not a setting.

import React, { useState } from 'react';
import { LayoutAnimation, StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { clampText, type Line } from '../lib/moretext';
import { useI18n } from '../lib/i18n';
import { colors, font } from '../theme';
import { SLIDE } from './SearchField';
import { useReducedMotion } from './ui';

/** Five lines of the description's 24pt: 120pt, about a third of what
 *  sits over the places on a 390pt phone — enough for a curator's opening,
 *  not so much that the list starts below the fold. */
export const MORE_LINES = 5;

export default function MoreText({ text, style, lines = MORE_LINES, testID }: {
  text: string;
  style?: StyleProp<TextStyle>;
  lines?: number;
  testID?: string;
}) {
  const { t } = useI18n();
  const still = useReducedMotion();
  const [drawn, setDrawn] = useState<{ text: string; lines: Line[] } | null>(null);
  const [open, setOpen] = useState(false);
  // A new text is measured afresh and starts closed: the old lines say
  // nothing about it.
  const measured = drawn?.text === text ? drawn.lines : null;
  const more = t('Read more', 'Đọc thêm', '続きを読む', '展开', '展開');
  const less = t('Show less', 'Thu gọn', '閉じる', '收起', '收起');
  const cut = measured ? clampText(measured, lines, `… ${more}`) : null;
  const turn = (to: boolean) => {
    if (!still) LayoutAnimation.configureNext(SLIDE);
    setOpen(to);
  };

  if (!measured) {
    return (
      <Text
        style={style}
        testID={testID}
        onTextLayout={(e) => {
          setDrawn({ text, lines: e.nativeEvent.lines.map((l) => ({ text: l.text, width: l.width })) });
          setOpen(false);
        }}
      >
        {text}
      </Text>
    );
  }
  if (cut == null) return <Text style={style} testID={testID}>{text}</Text>;
  if (!open) {
    return (
      // The whole paragraph opens it: a target five lines tall rather
      // than two words, and VoiceOver hears all of the text, not the cut.
      <Text
        style={style}
        testID={testID}
        numberOfLines={lines}
        onPress={() => turn(true)}
        accessibilityRole="button"
        accessibilityLabel={text}
        accessibilityHint={more}
        aria-expanded={false}
      >
        {cut}
        {'… '}
        <Text style={s.link}>{more}</Text>
      </Text>
    );
  }
  return (
    <Text style={style} testID={testID} aria-expanded>
      {text}
      {' '}
      <Text
        style={s.link}
        onPress={() => turn(false)}
        accessibilityRole="button"
        testID={testID ? `${testID}-less` : undefined}
      >
        {less}
      </Text>
    </Text>
  );
}

const s = StyleSheet.create({
  link: { color: colors.accent, fontWeight: font.semibold },
});
