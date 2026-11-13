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
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FriendProfile } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { colors, display, font, space } from '../theme';
import { Glyph } from './ui/glyph';
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
  open, title, subtitle, rows, people, extra, none, note, cta, rowTestID, onToggle, onClose,
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
   *  after the press, for the people ticked. */
  note: { icon: Icon; text: string };
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
                      {r.on ? <Glyph name="checkmark" size={15} color={colors.accentInk} /> : null}
                    </View>
                  )}
                </PressableScale>
              );
            })}
          </ScrollView>
        )}

        <View style={s.note}>
          <Glyph name={note.icon} size={15} color={colors.textTertiary} />
          <Text style={s.noteText}>{note.text}</Text>
        </View>

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

  note: {
    flexDirection: 'row', gap: 9, alignItems: 'flex-start',
    backgroundColor: colors.surfaceGlass,
    borderRadius: 14, padding: 13, marginTop: 10, marginBottom: 12,
  },
  noteText: { flex: 1, color: colors.textTertiary, fontSize: 13, lineHeight: 19 },

  later: { paddingVertical: 14, marginTop: 2, alignSelf: 'center' },
  laterText: { color: colors.textSecondary, fontSize: 16, fontWeight: font.medium },
});
