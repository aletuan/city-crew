// A sheet of one-choice sections, for a list with more than one way to
// narrow it.
//
// ── why a sheet and not chips ──
//
// One dimension fits in a row of chips, which is what Explore does with
// its categories. The check-ins list has two — the city and the kind of
// place — and two rows of chips took a hundred points of header for a
// list of forty rows, and would take more with every city. Apple Maps,
// the App Store and this app's own Explore all turn the same corner at
// two dimensions: a door in the header, and a sheet with a section per
// question. The cost is a tap to open; the gain is a header that stays
// the same height whatever the data does.
//
// ── the shape, which is `ExploreFilterSheet`'s ──
//
// The Explore sheet is the model, row for row: the handle, the title and
// its close, a heading per section, a card of divided rows with a radio
// each, Reset only while there is something to undo, and the app's own
// `GradientCta` committing the sheet with a count that follows the draft.
// That sheet knows its three questions by name; this one takes its
// sections as data, so it has nothing to say about what is being chosen.
// The two should become one when the Explore sheet next changes; the
// styles here are copied from it to the figure so that merge is a move,
// not a redesign.
//
// One choice per section, with an "all" row first. A sheet of ticks is
// where several-per-section would be natural (Mail's filters), and the
// shape leaves room for it; it is single for now so the check-ins and
// Explore mean the same thing by a chosen row.

import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { colors, display, font, radius, space } from '../theme';
import { Card, fireHaptic, GradientCta, PressableScale } from './ui';

export type FilterOption = {
  id: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** The glyph keeps its own hue in both states, as a chip's does: the
   *  hue is what ties the row to the dot the same concept wears on a
   *  card, so choosing must not repaint it. */
  iconColor?: string;
};

export type FilterSection = {
  key: string;
  title: string;
  /** The first row, the one that means "no filter here". */
  allLabel: string;
  options: FilterOption[];
};

/** Which option each section has chosen; null is the "all" row. */
export type FilterValues = Record<string, string | null>;

export default function FilterSheet({ visible, title, sections, applied, countFor, noun, onClose, onApply }: {
  visible: boolean;
  title: string;
  sections: FilterSection[];
  applied: FilterValues;
  /** How many the draft would leave — read on every change for the button. */
  countFor: (values: FilterValues) => number;
  /** The word after the count, by number: "place" / "places". */
  noun: (n: number) => string;
  onClose: () => void;
  onApply: (values: FilterValues) => void;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const rise = useRef(new Animated.Value(1)).current;
  const [draft, setDraft] = useState<FilterValues>(applied);

  useEffect(() => {
    if (!visible) { rise.setValue(1); return; }
    setDraft(applied);
    Animated.spring(rise, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 3 }).start();
  }, [visible, applied, rise]);

  const choose = (key: string, id: string | null) => {
    fireHaptic('selection');
    setDraft((current) => ({ ...current, [key]: id }));
  };
  const nothing: FilterValues = Object.fromEntries(sections.map((sec) => [sec.key, null]));
  const dirty = sections.some((sec) => (draft[sec.key] ?? null) !== null);
  const count = countFor(draft);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel={t('Close', 'Đóng', '閉じる')} />
      <Animated.View
        style={[s.sheet, {
          paddingBottom: 14 + insets.bottom,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, 420] }) }],
        }]}
      >
        <View style={s.handle} />
        <View style={s.head}>
          <Text style={s.title}>{title}</Text>
          <PressableScale
            onPress={onClose}
            testID="filter-close"
            accessibilityRole="button"
            accessibilityLabel={t('Close filters', 'Đóng bộ lọc', 'フィルターを閉じる')}
            style={s.close}
          >
            <Ionicons name="close" size={19} color={colors.text} />
          </PressableScale>
        </View>

        {sections.map((sec, si) => {
          const chosen = draft[sec.key] ?? null;
          const rows: FilterOption[] = [{ id: '', label: sec.allLabel }, ...sec.options];
          return (
            <View key={sec.key}>
              <Text style={[s.legend, si === 0 && s.legendFirst]}>{sec.title}</Text>
              <View accessibilityRole="radiogroup">
                <Card>
                  {rows.map((opt, i) => {
                    const id = opt.id || null;
                    const active = chosen === id;
                    return (
                      <PressableScale
                        key={opt.id || 'all'}
                        onPress={() => choose(sec.key, id)}
                        testID={`filter-${sec.key}-${opt.id || 'all'}`}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        aria-checked={active}
                        accessibilityLabel={opt.label}
                        style={[s.row, i < rows.length - 1 && s.rowDivided, active && s.rowOn]}
                      >
                        {opt.icon ? <Ionicons name={opt.icon} size={19} color={opt.iconColor ?? colors.textSecondary} /> : null}
                        <Text style={[s.rowText, active && s.rowTextOn]} numberOfLines={1}>{opt.label}</Text>
                        <View style={[s.radio, active && s.radioOn]}>
                          {active ? <View style={s.radioDot} /> : null}
                        </View>
                      </PressableScale>
                    );
                  })}
                </Card>
              </View>
            </View>
          );
        })}

        <View style={s.divider} />
        <View style={s.actions}>
          {dirty ? (
            <PressableScale onPress={() => setDraft(nothing)} testID="filter-reset" accessibilityRole="button" style={s.reset}>
              <Text style={s.resetText}>{t('Reset', 'Đặt lại', 'リセット')}</Text>
            </PressableScale>
          ) : null}
          <View style={s.applyWrap}>
            <GradientCta
              icon="checkmark"
              wide
              onPress={() => onApply(draft)}
              testID="filter-apply"
              label={`${t('Show', 'Hiện', '表示')} ${count} ${noun(count)}`}
            />
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

// Copied from `ExploreFilterSheet` to the figure — see the note at the
// top for why they are two files today.
const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,5,8,0.62)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: space.page, paddingTop: 8,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.card + 6, borderTopRightRadius: radius.card + 6,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: colors.textTertiary, marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.titleToContent },
  title: { color: colors.text, fontSize: 21, fontFamily: display.bold },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceGlass },
  legend: { color: colors.text, fontSize: 15, fontWeight: font.semibold, marginTop: space.titleToContent, marginBottom: space.headingToContent },
  legendFirst: { marginTop: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 14 },
  rowDivided: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderGlassSoft },
  rowOn: { backgroundColor: colors.accentSoft },
  rowText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: font.medium },
  rowTextOn: { color: colors.accent, fontWeight: font.semibold },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.textTertiary, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 11, height: 11, borderRadius: 5.5, backgroundColor: colors.accent },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft, marginTop: space.headingToContent },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  reset: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 },
  resetText: { color: colors.textSecondary, fontSize: 14, fontWeight: font.semibold },
  applyWrap: { flex: 1 },
});
