// The friend button beside a person: Add friend, Accept, or the quiet
// word for what already stands (Friends, Requested).
//
// It was written inside a list's activity page (13 Nov 2026) and moved
// here unchanged on 16 Nov 2026, when a person's own page needed the
// same button: one set of taps and pledges, two screens. A hook and not
// a component, because the pledges are shared across every button on a
// screen — one map, one crew read after a write — and a row asks for its
// button by the person's id. The reasoning for each state is where it
// was written, in `CollectionActivityScreen`'s header.
//
// `prefix` names the testIDs (`activity-add`, `person-add`), so each
// screen's tests find their own.
//
// ── which of them is a button (owner, 16 Nov 2026) ──
//
// Add friend and Accept are things to do. "Requested" and "Friends" are
// facts, and until that day wore a bordered pill the size of the two
// buttons: a control's dress on a thing that answers no press. Down a
// list of people the column was pills from top to bottom, and the one
// that could be pressed was no easier to find than the ones that could
// not.
//
// So the facts are words now, in the quiet grey, each led by a small
// mark: a clock for a request still waiting, a tick for a friend. Two
// marks, not a tick on both — "✓ Requested" reads as done, a step from
// "✓ Friends", and they are not the same answer.
//
// Not pressable, either of them. Taking a request back is on Crew; a
// grey word that turned out to be a button would be the same confusion
// from the other side.
//
// ── Add friend's dress, and its two sizes ──
//
// A pill, as every button in the app is. On the card's surface with a
// hairline, as Edit profile is on your own Profile (`editBtn`): it was
// the glass tint, which on the paper look is a grey smudge on a warm
// page — the reason that button left the tint. The two are a pair: what
// you do on your own page, what you do on somebody else's.
//
// 32 in a row of people (`CHIP_H`), where every row has one. 44 on a
// person's page (`SECONDARY_CONTROL_H`, `size: 'page'`), where it is the
// page's one act and Edit profile's opposite number. Accept takes the
// same two sizes and keeps the gradient: it is a question waiting on
// the reader, and should be the loudest thing beside a name.

import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Glyph } from './ui/glyph';
import { CHIP_H, CHIP_SLOP, PressableScale, SECONDARY_CONTROL_H, successHaptic } from './ui';
import { useCrew } from '../lib/crew';
import { acceptFriendRequest, sendFriendRequest } from '../lib/data';
import { type Pledged, quietReason, rowButton } from '../lib/friends';
import { useI18n } from '../lib/i18n';
import { usePending } from '../lib/pending';
import { colors, font, gradAI, radius } from '../theme';

export function useFriendButtons(me: string | null, prefix: string, size: 'row' | 'page' = 'row') {
  const { t } = useI18n();
  // The friend buttons — see the header. `pledged` is each tap until the
  // crew is read again; `run` keeps one write per person in flight.
  //
  // No dimmed, disabled button while a write is out, as Crew has: the
  // pledge takes the button away for the length of the write — Add
  // friend becomes the inert "Requested", Accept the inert "Friends" —
  // so there is nothing left to dim, and `run` refuses a second write
  // for the same person all the same.
  const crew = useCrew();
  const [pledged, setPledged] = useState<Record<string, Pledged>>({});
  const { run } = usePending();
  const unpledge = (id: string) => setPledged(({ [id]: _gone, ...rest }) => rest);
  const ask = (id: string, as: Pledged, write: () => Promise<void>, title: string) => {
    setPledged((p) => ({ ...p, [id]: as }));
    run(
      id,
      write,
      () => { successHaptic(); crew.ships.reload(); },
      (e) => { unpledge(id); Alert.alert(title, quietReason(e)); },
    );
  };
  const addFriend = (id: string) => ask(id, 'requested', () => sendFriendRequest(me!, id),
    t('Could not send the request', 'Không gửi được lời mời', 'リクエストを送れませんでした', '无法发送请求', '無法傳送請求'));
  const acceptFriend = (id: string) => ask(id, 'friends', () => acceptFriendRequest(id, me!),
    t('Could not accept the request', 'Không chấp nhận được lời mời', 'リクエストを承認できませんでした', '无法接受请求', '無法接受請求'));

  /**
   * The button for one person. `as` draws this one differently from the
   * screen's others while sharing their pledges — a person's page draws
   * the same person's button twice, large under their name and small in
   * the header once that has scrolled away (`PersonScreen`):
   *   - `size`, in place of the hook's;
   *   - `prefix`, so the two are told apart in tests;
   *   - `actsOnly`, for a place that has room for a thing to do and none
   *     for a fact: Add friend or Accept, and nothing for what stands.
   */
  const friendButton = (id: string | null, as: { size?: 'row' | 'page'; prefix?: string; actsOnly?: boolean } = {}) => {
    const state = rowButton(id, me, crew.ships.data, crew.blocks.data, pledged);
    if (!state || !id) return null;
    // On a page the buttons are 44 and need no slop to reach it.
    const page = (as.size ?? size) === 'page';
    const slop = page ? undefined : CHIP_SLOP;
    const name = as.prefix ?? prefix;
    if (state === 'add') {
      return (
        <PressableScale
          onPress={() => addFriend(id)}
          hitSlop={slop}
          scaleTo={0.94}
          accessibilityRole="button"
          testID={`${name}-add`}
        >
          <View style={[s.addBtn, page && s.onPage]}>
            <Glyph name="person-add-outline" size={15} color={colors.accent} />
            <Text style={s.addText}>{t('Add friend', 'Kết bạn', '友達に追加', '加好友', '加好友')}</Text>
          </View>
        </PressableScale>
      );
    }
    if (state === 'accept') {
      return (
        <PressableScale
          onPress={() => acceptFriend(id)}
          hitSlop={slop}
          scaleTo={0.94}
          accessibilityRole="button"
          testID={`${name}-accept`}
        >
          <LinearGradient {...gradAI} style={[s.acceptBtn, page && s.onPage]}>
            <Glyph name="checkmark" size={15} color={colors.accentInk} />
            <Text style={s.acceptText}>{t('Accept', 'Đồng ý', '承認', '接受', '接受')}</Text>
          </LinearGradient>
        </PressableScale>
      );
    }
    // A state, not a control: drawn as Crew's quiet outline, read as words.
    if (as.actsOnly) return null;
    return (
      <View style={[s.quiet, page && s.quietOnPage]} testID={`${name}-${state}`}>
        <Glyph name={state === 'friends' ? 'checkmark' : 'time-outline'} size={15} color={colors.textTertiary} />
        <Text style={s.quietText}>
          {state === 'friends'
            ? t('Friends', 'Bạn bè', '友だち', '好友', '好友')
            : t('Requested', 'Đã gửi', '送信済み', '已发送', '已傳送')}
        </Text>
      </View>
    );
  };
  return { friendButton, crew };
}

const s = StyleSheet.create({
  // Crew's "Add" suggestion pill.
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: CHIP_H, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderGlassSoft,
  },
  // Edit profile's weight, with its dress.
  addText: { color: colors.text, fontSize: 14, fontWeight: font.semibold },
  // On a person's page: the button scale's 44 and Edit profile's 16 of
  // side room.
  onPage: { minHeight: SECONDARY_CONTROL_H, paddingHorizontal: 16 },
  // Crew's Accept, at the chip's height rather than its request card's.
  acceptBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: CHIP_H, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6,
  },
  acceptText: { color: colors.accentInk, fontSize: 14, fontWeight: font.semibold },
  // Crew's quiet outline: Cancel, Unblock — here Friends and Requested.
  // A fact, not a button: words and a mark, the height of the button
  // that would stand here so a row of people keeps its line.
  quiet: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: CHIP_H },
  quietOnPage: { minHeight: SECONDARY_CONTROL_H },
  quietText: { color: colors.textTertiary, fontSize: 14, fontWeight: font.medium },
});
