// A sheet of the reader's friends to tick — the chrome two pickers share.
//
// It was the trip's "Who's coming?" sheet (`InviteSheet`) alone until
// 13 Nov 2026, when a private list could be shared with chosen friends
// (`ShareSheet`) and the owner asked for the same picker rather than a
// second one: a face, a name and a handle, a tick, the people already
// chosen opening ticked, and a button whose label says what pressing it
// will do. Lifted out rather than copied, because the two would drift —
// the trip sheet's rows have been reworked four times since August.
//
// What is generic is the sheet, the rows and the two ways out (the button
// and "Not now"). What is not is every decision: who is listed and in
// what order, which rows are ticked, which cannot be moved, what the
// button says and does. Each caller holds its own selection and its own
// rules (`lib/invites`, `lib/shares`) and hands this the outcome, so the
// rules stay where a Node process can test them.
//
// ── across, for a list (owner, 19 Nov 2026) ──
//
// The list's sheet draws its friends as a strip of faces to scroll
// sideways (`across`), after a reference the owner brought: a face with
// the name under it, pressed to tick, the tick a disc on the face's
// corner. What it buys is height — the rows took 300pt of the sheet and
// the strip takes about 120, so the list being shared stays in sight
// behind it — and a press on a face rather than on a line.
//
// What it costs, said to the owner and accepted:
//
//   - the handle is not drawn. There is room for a name under a face
//     and no more; VoiceOver still says both. Two friends of one name
//     are told apart by their pictures.
//   - four and a half to a screen. The half is on purpose (`PER_SCREEN`):
//     a face cut by the sheet's edge is what says there are more. A crew
//     of twelve is three swipes, and who is ticked beyond the edge is
//     not in sight — which is why the caller puts who has the list
//     first (`lib/shares.shareRows`) and the button counts them.
//
// One way at every size (owner): no falling back to rows past some
// number of friends, which would be two sheets to learn.
//
// The trip's sheet keeps its rows. A row there carries what a face has
// no room for — the places saved in common, and "Answered" in place of
// a tick — so `extra` and `badge` are the rows' alone.
//
// ── no search field ──
//
// The crew is small: a median of two friends a reader and a most of
// twelve (owner's measurement, 13 Nov 2026). A row is 64pt (a 44pt face
// and 10 above and below), so the 300pt list shows four and a half and
// twelve is two and a half lists' worth of scroll. A field to filter
// twelve names is a keyboard over the list it filters. When a crew
// outgrows that, measure again.

import React, { useEffect, useRef } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FriendProfile } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { colors, display, font, space } from '../theme';
import { Glyph, ICON } from './ui/glyph';
import { Avatar, GradientCta, PressableScale } from './ui';

type Icon = keyof typeof Ionicons.glyphMap;

/** One friend, in the state the caller decided. */
export type PickRow = {
  id: string;
  /** Ticked. */
  on: boolean;
  /** Cannot be moved: dimmed, silent under the thumb, and said as
   *  disabled — a checkbox that ignores the tap is worse than one that
   *  stands down. */
  off?: boolean;
  /** A word worn in place of the tick — an answered invitation's
   *  "Answered". A tick that cannot be untapped should not look like one
   *  that can. */
  badge?: string;
};

export default function FriendPicker({
  open, title, subtitle, rows, people, extra, none, note, across, cta, rowTestID, onToggle, onClose,
}: {
  open: boolean;
  title: string;
  /** The sentence under the title: what ticking someone means here. */
  subtitle: string;
  rows: readonly PickRow[];
  people: Record<string, FriendProfile>;
  /** More for a row's second line, after the handle: the trip's shared
   *  saves. Starts with its own separator, or is empty. */
  extra?: (id: string) => string;
  /** What an empty crew is told in place of the list. */
  none: string;
  /** The boxed line between the list and the button: what happens
   *  after the press, for the people ticked. Absent on the list's sheet
   *  since 19 Nov 2026 (`ShareSheet`); the button then keeps the space
   *  the box's two margins gave it (`gap`). */
  note?: { icon: Icon; text: string };
  /** Faces in a strip to scroll sideways, in place of rows — see the
   *  header. `extra`, and a row's `badge` and `off`, are the rows'
   *  alone: a face is always one that can be ticked. */
  across?: boolean;
  cta: { icon: Icon; label: string; testID: string; disabled: boolean; onPress: () => void };
  /** Each row's id, by its index. A function rather than a prefix so
   *  that the template is written at the call site, where the Maestro id
   *  check (`scripts/maestroIds.test.ts`) reads it: `invite-friend-${i}`
   *  answers for the smoke flow's `invite-friend-0`. */
  rowTestID: (index: number) => string;
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const rise = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!open) { rise.setValue(1); return; }
    Animated.spring(rise, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 3 }).start();
  }, [open, rise]);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel={t('Close', 'Đóng', '閉じる', '关闭', '關閉')} />
      <Animated.View
        style={[
          s.sheet,
          {
            paddingBottom: insets.bottom + 16,
            transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, 360] }) }],
          },
        ]}
      >
        <View style={s.grabber} />
        <Text style={s.title}>{title}</Text>
        <Text style={s.subtitle}>{subtitle}</Text>

        {rows.length === 0 ? (
          // Not an error, and not a dead end phrased as one: the reader
          // has simply not added anybody yet.
          <Text style={s.none}>{none}</Text>
        ) : across ? (
          <Strip rows={rows} people={people} rowTestID={rowTestID} onToggle={onToggle} />
        ) : (
          <ScrollView style={s.list} contentContainerStyle={{ paddingVertical: 4 }} showsVerticalScrollIndicator={false}>
            {rows.map((r, row) => {
              const p = people[r.id];
              return (
                <PressableScale
                  key={r.id}
                  onPress={() => { if (!r.off) onToggle(r.id); }}
                  haptic={r.off ? 'none' : 'selection'}
                  accessibilityRole="checkbox"
                  testID={rowTestID(row)}
                  accessibilityState={{ checked: r.on, disabled: !!r.off }}
                  // And as `aria-checked`, which react-native-web keeps
                  // where it drops `accessibilityState` — see `Chip` in
                  // `ui`. Without it the web build's checkboxes were
                  // silent about being ticked.
                  aria-checked={r.on}
                  style={{ alignSelf: 'stretch' }}
                  contentStyle={[s.row, r.off && s.rowOff]}
                >
                  <Avatar url={p?.avatar_url} size={44} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.name} numberOfLines={1}>
                      {p?.full_name || p?.handle || t('Someone', 'Ai đó', '誰か', '某人', '某人')}
                    </Text>
                    <Text style={s.meta} numberOfLines={1}>
                      {p?.handle ? `@${p.handle}` : ''}
                      {extra?.(r.id) ?? ''}
                    </Text>
                  </View>
                  {r.badge ? (
                    <Text style={s.badge}>{r.badge}</Text>
                  ) : (
                    <View style={[s.tick, r.on && s.tickOn]}>
                      {r.on ? <Glyph name="checkmark" size={ICON.text} color={colors.accentInk} /> : null}
                    </View>
                  )}
                </PressableScale>
              );
            })}
          </ScrollView>
        )}

        {note ? (
          <View style={s.note}>
            <Glyph name={note.icon} size={ICON.text} color={colors.textTertiary} />
            <Text style={s.noteText}>{note.text}</Text>
          </View>
        ) : <View style={s.gap} testID="picker-gap" />}

        <GradientCta
          icon={cta.icon}
          wide
          label={cta.label}
          testID={cta.testID}
          disabled={cta.disabled}
          onPress={() => { if (!cta.disabled) cta.onPress(); }}
        />

        <PressableScale onPress={onClose} accessibilityRole="button" contentStyle={s.later}>
          <Text style={s.laterText}>{t('Not now', 'Để sau', 'あとで', '暂不', '暫不')}</Text>
        </PressableScale>
      </Animated.View>
    </Modal>
  );
}

/** How many faces a screen's width holds: four, and half of a fifth cut
 *  by the sheet's edge to say the strip goes on. */
const PER_SCREEN = 4.5;
/** A face in the strip: 60. The rows' was 44 beside two lines of type;
 *  alone over its name it is the whole of the row and can be the size a
 *  thumb aims at. On a 393pt screen a cell is 82 wide, which leaves 22
 *  between two faces. Drawn to scale against the owner's reference, not
 *  yet seen on a phone. */
const FACE = 60;
/** The wash round a ticked face: 4 all round. */
const HALO = FACE + 8;

/** The friends as a strip of faces — see the header. */
function Strip({ rows, people, rowTestID, onToggle }: {
  rows: readonly PickRow[];
  people: Record<string, FriendProfile>;
  rowTestID: (index: number) => string;
  onToggle: (id: string) => void;
}) {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  // The strip runs to the sheet's two edges, so the first face stands on
  // the page's margin and the last one seen is cut by the screen.
  const cell = Math.floor((width - space.page) / PER_SCREEN);
  return (
    <ScrollView
      horizontal
      style={s.strip}
      contentContainerStyle={s.stripIn}
      showsHorizontalScrollIndicator={false}
      testID="picker-strip"
    >
      {rows.map((r, i) => {
        const p = people[r.id];
        const name = p?.full_name || p?.handle || t('Someone', 'Ai đó', '誰か', '某人', '某人');
        return (
          <PressableScale
            key={r.id}
            onPress={() => onToggle(r.id)}
            haptic="selection"
            accessibilityRole="checkbox"
            // The handle is said though it is not drawn: it is what
            // tells two friends of one name apart.
            accessibilityLabel={p?.handle && p.handle !== name ? `${name}, @${p.handle}` : name}
            accessibilityState={{ checked: r.on }}
            aria-checked={r.on}
            testID={rowTestID(i)}
            contentStyle={[s.cell, { width: cell }]}
          >
            <View style={[s.halo, r.on && s.haloOn]}>
              <Avatar url={p?.avatar_url} size={FACE} />
              {r.on ? (
                // On the sheet's own ground, so the disc is parted from
                // the photograph without a border to colour.
                <View style={s.onRim} testID="picker-on">
                  <View style={s.onDisc}>
                    <Glyph name="checkmark" size={ICON.meta} color={colors.accentInk} />
                  </View>
                </View>
              ) : null}
            </View>
            <Text style={s.cellName} numberOfLines={2}>{name}</Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,5,8,0.62)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: space.page, paddingTop: 10,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  grabber: {
    width: 38, height: 4, borderRadius: 2, alignSelf: 'center',
    backgroundColor: colors.textTertiary, marginBottom: 14,
  },
  title: { color: colors.text, fontSize: 22, fontFamily: display.bold },
  subtitle: { color: colors.textTertiary, fontSize: 14, marginTop: 3, marginBottom: 10 },
  none: { color: colors.textTertiary, fontSize: 15, lineHeight: 21, paddingVertical: 18 },

  list: { maxHeight: 300 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowOff: { opacity: 0.62 },
  name: { color: colors.text, fontSize: 16, fontWeight: font.medium },
  meta: { color: colors.textTertiary, fontSize: 13, marginTop: 1 },
  tick: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.borderGlass,
  },
  tickOn: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },
  badge: { color: colors.textTertiary, fontSize: 13, fontWeight: font.medium },

  // Out to the sheet's edges and back in by the page's margin, less the
  // slack each cell has beside its face, so the first face — not the
  // first cell — stands on the margin the title stands on.
  strip: { marginHorizontal: -space.page, flexGrow: 0 },
  stripIn: { paddingHorizontal: space.page - 7, paddingTop: 8, paddingBottom: 2 },
  cell: { alignItems: 'center', gap: 6 },
  halo: { width: HALO, height: HALO, borderRadius: HALO / 2, alignItems: 'center', justifyContent: 'center' },
  haloOn: { backgroundColor: colors.accentSoft },
  onRim: {
    position: 'absolute', right: -1, bottom: -1, width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center',
  },
  onDisc: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accentFill,
    alignItems: 'center', justifyContent: 'center',
  },
  // Two lines, centred: "Tran Thi Trang" is wider than its cell at 13 and
  // would be cut at one. The height of two is held, so a strip of short
  // and long names keeps one foot.
  cellName: {
    color: colors.text, fontSize: 13, lineHeight: 17, minHeight: 34, fontWeight: font.medium,
    textAlign: 'center', paddingHorizontal: 2,
  },

  note: {
    flexDirection: 'row', gap: 9, alignItems: 'flex-start',
    backgroundColor: colors.surfaceGlass,
    borderRadius: 14, padding: 13, marginTop: 10, marginBottom: 12,
  },
  // With no note: the note's two margins, 10 and 12, so the button
  // stands as far under the last friend as it did under the box.
  gap: { height: 22 },
  noteText: { flex: 1, color: colors.textTertiary, fontSize: 13, lineHeight: 19 },

  later: { paddingVertical: 14, marginTop: 2, alignSelf: 'center' },
  laterText: { color: colors.textSecondary, fontSize: 16, fontWeight: font.medium },
});
