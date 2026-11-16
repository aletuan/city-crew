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
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Glyph } from './ui/glyph';
import { CHIP_H, CHIP_SLOP, PressableScale, successHaptic } from './ui';
import { useCrew } from '../lib/crew';
import { acceptFriendRequest, sendFriendRequest } from '../lib/data';
import { type Pledged, quietReason, rowButton } from '../lib/friends';
import { useI18n } from '../lib/i18n';
import { usePending } from '../lib/pending';
import { colors, font, gradAI, radius } from '../theme';

export function useFriendButtons(me: string | null, prefix: string) {
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

  const friendButton = (id: string | null) => {
    const state = rowButton(id, me, crew.ships.data, crew.blocks.data, pledged);
    if (!state || !id) return null;
    if (state === 'add') {
      return (
        <PressableScale
          onPress={() => addFriend(id)}
          hitSlop={CHIP_SLOP}
          scaleTo={0.94}
          accessibilityRole="button"
          testID={`${prefix}-add`}
        >
          <View style={s.addBtn}>
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
          hitSlop={CHIP_SLOP}
          scaleTo={0.94}
          accessibilityRole="button"
          testID={`${prefix}-accept`}
        >
          <LinearGradient {...gradAI} style={s.acceptBtn}>
            <Glyph name="checkmark" size={15} color={colors.accentInk} />
            <Text style={s.acceptText}>{t('Accept', 'Đồng ý', '承認', '接受', '接受')}</Text>
          </LinearGradient>
        </PressableScale>
      );
    }
    // A state, not a control: drawn as Crew's quiet outline, read as words.
    return (
      <View style={s.quietBtn} testID={`${prefix}-${state}`}>
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
    backgroundColor: colors.surfaceGlass,
  },
  addText: { color: colors.text, fontSize: 14, fontWeight: font.medium },
  // Crew's Accept, at the chip's height rather than its request card's.
  acceptBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: CHIP_H, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6,
  },
  acceptText: { color: colors.accentInk, fontSize: 14, fontWeight: font.semibold },
  // Crew's quiet outline: Cancel, Unblock — here Friends and Requested.
  quietBtn: {
    borderWidth: 1, borderColor: colors.borderGlass, borderRadius: radius.pill,
    minHeight: CHIP_H, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 6,
  },
  quietText: { color: colors.textTertiary, fontSize: 14, fontWeight: font.semibold },
});
