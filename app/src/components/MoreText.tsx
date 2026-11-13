// A long text, four lines of it until the reader asks for the rest.
//
// The collection's description (owner, 3 Nov 2026): a curator's sixteen
// lines on "Caffee taste in Đà Lạt" filled the screen the places are the
// point of, and one row of them showed under it. Now it stops at four,
// with "Read more ⌄" on a line of its own under them, and the whole
// paragraph is the button. Open, the text runs out in full and
// "Show less ⌃" stands in the same place under it.
//
// ── the link, quiet, on its own line (owner, 13 Nov 2026) ──
// It was "… Read more" at the end of the fifth line, in the accent and
// semibold: the loudest words in a grey paragraph, and the one thing on
// the card the reader had no reason to read. "Show less" followed the
// last word, so it stood wherever the text happened to end.
//
// Now it is drawn as the card's other word-and-chevron, the visibility
// control at its foot: `textSecondary`, the meta size, regular, with the
// chevron in `textTertiary`. One kind of control, one look. Lighter than
// `textSecondary` would fall under the 4.5:1 a 15pt word needs. And it
// sits in one place, open or closed, so the reader closes it where they
// opened it.
//
// Four lines and not five: the link's own row takes about the height the
// fifth gave up (32 for 24), so the card is about as tall closed as it was.
//
// Rejected with it: cutting the fourth line short to fit the link after
// its words (`clampText`, removed). It estimated the link's width from
// the text's average character, with a 1.2 margin that was a guess, and
// either cost a word or pushed the link onto a line the clamp hid. On a
// line of its own the link needs no room made for it, and the platform's
// own clamp ends the fourth line.
//
// ── how it knows ──
// The first paint is the whole text, unclamped, because `onTextLayout`
// reports the lines it drew, and a Text already held to four could never
// say there was a fifth — the address on a place's screen measures the
// same way. A text of four lines or fewer is left alone, with no link.
// It costs one frame of the whole text on the long ones.
//
// Every visit opens it closed. A text the reader opened is not a setting.

import React, { useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { useI18n } from '../lib/i18n';
import { colors, type } from '../theme';
import { Glyph } from './ui/glyph';
import { SLIDE } from './SearchField';
import { CHIP_H, CHIP_SLOP, useReducedMotion } from './ui';

/** Four lines of the description's 24pt, 96pt, and the link's 32 under
 *  them: 128, against the 120 five lines took — about a third of what
 *  sits over the places on a 390pt phone. */
export const MORE_LINES = 4;

export default function MoreText({ text, style, lines = MORE_LINES, testID }: {
  text: string;
  style?: StyleProp<TextStyle>;
  lines?: number;
  testID?: string;
}) {
  const { t } = useI18n();
  const still = useReducedMotion();
  const [drawn, setDrawn] = useState<{ text: string; lines: number } | null>(null);
  const [open, setOpen] = useState(false);
  // A new text is measured afresh and starts closed: the old count says
  // nothing about it.
  const measured = drawn?.text === text ? drawn.lines : null;
  const more = t('Read more', 'Đọc thêm', '続きを読む', '展开', '展開');
  const less = t('Show less', 'Thu gọn', '閉じる', '收起', '收起');
  const turn = (to: boolean) => {
    if (!still) LayoutAnimation.configureNext(SLIDE);
    setOpen(to);
  };
  const link = (word: string, chevron: 'chevron-down' | 'chevron-up') => (
    <View style={s.link}>
      <Text style={s.word}>{word}</Text>
      <Glyph name={chevron} size={13} color={colors.textTertiary} />
    </View>
  );

  if (measured == null) {
    return (
      <Text
        style={style}
        testID={testID}
        onTextLayout={(e) => {
          setDrawn({ text, lines: e.nativeEvent.lines.length });
          setOpen(false);
        }}
      >
        {text}
      </Text>
    );
  }
  if (measured <= lines) return <Text style={style} testID={testID}>{text}</Text>;
  if (!open) {
    return (
      // The paragraph and its link are one button: a target four lines
      // tall rather than two words, and VoiceOver hears all of the text,
      // not the clamp.
      <Pressable
        onPress={() => turn(true)}
        accessibilityRole="button"
        accessibilityLabel={text}
        accessibilityHint={more}
        aria-expanded={false}
        testID={testID ? `${testID}-more` : undefined}
      >
        <Text style={style} testID={testID} numberOfLines={lines}>{text}</Text>
        {link(more, 'chevron-down')}
      </Pressable>
    );
  }
  return (
    <View aria-expanded>
      <Text style={style} testID={testID}>{text}</Text>
      <Pressable
        onPress={() => turn(false)}
        accessibilityRole="button"
        // Its own height and no more: the paragraph above is not the way
        // back, since a tap meant to select a word would fold it away.
        style={s.lessHit}
        hitSlop={CHIP_SLOP}
        testID={testID ? `${testID}-less` : undefined}
      >
        {link(less, 'chevron-up')}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  // The visibility control's own box: the chip scale's 32, the word and
  // its chevron 5 apart. Close under the paragraph, so it reads as the
  // paragraph's and not as the next thing on the card.
  link: { flexDirection: 'row', alignItems: 'center', gap: 5, height: CHIP_H },
  word: { color: colors.textSecondary, ...type.meta },
  // The word is the target, not the card's width: `alignSelf` keeps the
  // press from running across a row nobody would aim at.
  lessHit: { alignSelf: 'flex-start' },
});
