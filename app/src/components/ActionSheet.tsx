// The sheet that opens on a ⋯ — a thing named at the top, then what you
// can do about it.
//
// This is the chrome `PersonSheet` was built with, lifted out so a sheet
// about a photograph can wear it too. The reasoning that put it there
// still holds and is repeated here because it decides the shape: an
// alert menu gives every choice the same voice — bare verbs, no faces,
// no consequences, and on iOS the destructive ones turn red together so
// two different acts look like one. A row here carries an icon, a title
// and a sentence saying what will actually happen, and the thing the
// menu is about is drawn above the rows so nobody has to trust they
// opened it on the right one.
//
// What is generic is the backdrop, the spring, the grabber and the rows.
// What is not is the header: a person is a face and a handle, a
// photograph is a thumbnail and where it came from, and the sheet takes
// that as a node rather than guessing at a shape that fits both.
//
// The confirmation that follows a destructive choice stays a system
// dialog, raised from the row's own `onPress` once this sheet has gone —
// see the timing note on the row.
//
// ── the glyph, and the name that is not repeated ──
//
// Each row led with a 44pt well around its glyph — neutral, or a wash of
// the warning red for a destructive act — until 6 Oct 2026, when the
// owner took the wells off Profile's rows and asked for this sheet to
// follow. The glyph is bare now, 19pt, in the text ink or the warning
// red, level with the title the way Profile's and the detail screen's
// glyphs sit on their first line (the same 26pt box and the same lift;
// `RowGlyph` on Profile has the arithmetic). The red on a destructive
// row is carried by the glyph and the title together, which is what the
// well was adding a third time.
//
// And the rows no longer name the person. "Unfriend @anh", "Block
// @anh", "Report @anh" under a header that already shows @anh said the
// handle four times on one sheet; the verb alone is the row, and the
// header is who. The confirmation dialog that follows keeps the handle,
// because by then the sheet — and the name — is gone.

import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from './ui';
import { useI18n } from '../lib/i18n';
import { colors, font, radius, space } from '../theme';

/** The title's stated line (16pt, the system face gives 19.1) and the
 *  glyph's box — Profile's `RowGlyph` numbers, so the two screens' glyphs
 *  land on the same line for the same reasons. */
const TITLE_LINE = 19;
const GLYPH_BOX = 26;

export type SheetAction = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  /** The title in a word or two, for `SheetStrip`, where three share a
   *  row; the full title is still what VoiceOver says. */
  short?: string;
  /** What it will actually do, in a sentence. The half an alert menu
   *  cannot carry, and the half that tells two red rows apart. */
  desc: string;
  /** Draws the row in the warning colour. Cosmetic only — whether a
   *  choice asks again is the caller's business, and the callers that
   *  do ask raise their dialog from inside `onPress`, once this sheet
   *  has closed. */
  destructive?: boolean;
  /** A row that is not yet a thing to do — a door drawn before the room
   *  behind it is built, so the reader learns the room is coming. Dimmed
   *  and said as dimmed, and the tap is refused rather than closing the
   *  sheet over nothing: a row that looks live and does nothing teaches
   *  the reader not to trust rows. Its `desc` should say when. */
  disabled?: boolean;
  /** The row that is already true — for a sheet that is a choice
   *  between states rather than a list of acts (who can see a list:
   *  Public or Private). A tick at the row's end, and said as selected,
   *  so the reader sees where they are before choosing where to go. */
  selected?: boolean;
  onPress: () => void;
};

export default function ActionSheet({ visible, header, actions, onClose }: {
  visible: boolean;
  /** What the menu is about, drawn above the rows. */
  header: React.ReactNode;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const rise = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!visible) { rise.setValue(1); return; }
    Animated.spring(rise, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 3 }).start();
  }, [visible, rise]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel={t('Close', 'Đóng', '閉じる')} />
      <Animated.View
        style={[s.sheet, {
          paddingBottom: insets.bottom + 16,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, 360] }) }],
        }]}
      >
        <View style={s.grabber} />

        {header}

        <SheetRows actions={actions} onClose={onClose} />
      </Animated.View>
    </Modal>
  );
}

/**
 * The rows, on their card: what `ActionSheet` draws under its header.
 *
 * It took a `titlesOnly` for the photo sheet, whose picture made each
 * row's sentence redundant (16 Oct 2026); the photo sheet docks its
 * actions in a `SheetStrip` now (17 Oct), and every sheet left keeps its
 * sentences — the menus about a person, where two red rows had to be
 * told apart.
 */
export function SheetRows({ actions, onClose }: {
  actions: SheetAction[];
  onClose: () => void;
}) {
  // No card when there is nothing to put in it. The check-in sheet's
  // rows are all in its header once the day's cap is reached, and an
  // empty bordered card under them read as a row that failed to load.
  if (!actions.length) return null;
  return (
    <View style={s.group}>
      {actions.map((a, i) => (
        <PressableScale
          key={a.key}
          testID={`sheet-action-${a.key}`}
          style={[s.row, i > 0 && s.rowDivider, a.disabled && s.rowOff]}
          scaleTo={a.disabled ? 1 : 0.985}
          // The sheet goes first, always. A dialog raised over a sheet
          // that is still animating out is the stacked-modal bug every
          // platform has its own version of.
          onPress={() => { onClose(); setTimeout(a.onPress, 220); }}
          // `disabled` alone: the Pressable then drops the press and says
          // "dimmed" to VoiceOver itself; a guard on `onPress` and a
          // separate `aria-disabled` were two more copies of the same
          // fact, each one a thing to forget.
          disabled={a.disabled}
          accessibilityRole="button"
          accessibilityLabel={a.title}
          accessibilityHint={a.desc}
          // `aria-selected`, which react-native-web keeps and
          // `accessibilityState` it drops — see `Chip` in `ui`.
          aria-selected={a.selected}
        >
          <View style={s.glyph} testID="sheet-glyph">
            <Ionicons
              name={a.icon}
              size={19}
              color={a.destructive ? colors.bad : colors.text}
            />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[s.rowTitle, a.destructive && s.rowTitleBad]}>{a.title}</Text>
            <Text style={s.rowDesc}>{a.desc}</Text>
          </View>
          {a.selected && (
            <View style={s.glyph} testID="sheet-selected">
              <Ionicons name="checkmark" size={19} color={colors.accent} />
            </View>
          )}
        </PressableScale>
      ))}
    </View>
  );
}

/**
 * The same actions as `SheetRows`, side by side in one card: a glyph over
 * a word or two each — a dock, for a sheet whose actions should stay in
 * reach under something being read. The photo sheet's (owner, 17 Oct
 * 2026), pinned under the photograph and its analysis: the analysis is
 * what tells a guide to hide a photograph or make it the cover, and three
 * full rows at the foot of the scroll put that a screen away. About a
 * third of the rows' height. The caller draws it only with something in
 * it.
 */
export function SheetStrip({ actions, onClose }: {
  actions: SheetAction[];
  onClose: () => void;
}) {
  return (
    <View style={[s.group, s.strip]} testID="sheet-strip">
      {actions.map((a, i) => (
        <PressableScale
          key={a.key}
          testID={`sheet-action-${a.key}`}
          containerStyle={s.stripCell}
          style={[s.stripItem, i > 0 && s.stripDivider]}
          scaleTo={0.96}
          // The sheet first, as in `SheetRows`.
          onPress={() => { onClose(); setTimeout(a.onPress, 220); }}
          accessibilityRole="button"
          accessibilityLabel={a.title}
          accessibilityHint={a.desc}
        >
          <Ionicons name={a.icon} size={19} color={a.destructive ? colors.bad : colors.text} />
          <Text style={[s.stripLabel, a.destructive && s.rowTitleBad]} numberOfLines={1}>{a.short ?? a.title}</Text>
        </PressableScale>
      ))}
    </View>
  );
}

/** The card a sheet's header is drawn on, shared so the two headers
 *  that exist sit on the same surface as the rows beneath them. */
export const sheetHeader = {
  flexDirection: 'row', alignItems: 'center', gap: 14,
  padding: space.cardPadding,
  backgroundColor: colors.surfaceCard,
  borderWidth: 1, borderColor: colors.borderGlassSoft, borderRadius: radius.card,
} as const;

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,5,8,0.62)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: space.page, paddingTop: 10,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
    gap: 12,
  },
  grabber: {
    width: 38, height: 4, borderRadius: 2, alignSelf: 'center',
    backgroundColor: colors.textTertiary, marginBottom: 2,
  },

  group: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1, borderColor: colors.borderGlassSoft, borderRadius: radius.card,
    overflow: 'hidden',
  },
  // `flex-start`, so the glyph can sit on the title's line rather than
  // the middle of title-plus-sentence — see the header.
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    paddingHorizontal: space.cardPadding, paddingVertical: 14,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  // 0.45, the figure the dimmed CTAs already use, so "not yet" reads the
  // same on a row as on a button.
  rowOff: { opacity: 0.45 },
  // The old well's 44pt footprint, a 26pt box with room for a 19pt
  // glyph's whole line, lifted so its middle is the 19pt title line's.
  glyph: {
    width: 44, height: GLYPH_BOX, marginTop: (TITLE_LINE - GLYPH_BOX) / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: font.semibold, lineHeight: TITLE_LINE },
  rowTitleBad: { color: colors.bad },
  rowDesc: { color: colors.textTertiary, fontSize: 14, lineHeight: 18 },

  strip: { flexDirection: 'row' },
  stripCell: { flex: 1 },
  stripItem: { alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 6 },
  stripDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.borderGlassSoft },
  stripLabel: { color: colors.text, fontSize: 13, fontWeight: font.semibold },
});
