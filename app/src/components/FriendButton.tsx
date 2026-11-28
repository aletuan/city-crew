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
// 32 in a row of people (`CHIP_H`), where every row has one. Accept
// keeps the gradient: it is a question waiting on the reader, and should
// be the loudest thing beside a name.
//
// ── on a person's page: on the cover (owner, 28 Nov 2026) ──
//
// `size: 'photo'`. The page's head stands on its cover photograph since
// that day, and the button with it, at the end of the head's row. It
// was a row of its own under the head, 44 tall, beside a "Message — Soon"
// that answered nothing: about 80 of the page before the first card, on
// the owner's recording of a friend's page.
//
// On a photograph each state needs a ground of its own:
//   - Add friend: the photograph's light ink as a pill, dark words on
//     it — the one thing on the cover that is plainly a button;
//   - Accept: the gradient, as everywhere;
//   - Friends, Requested: the dark glass the cover's other marks wear
//     (Explore's date pill), light words. Still a fact and not a press.
//     The rule above took the pill off the facts because down a list of
//     people it made every row look pressable; here there is one, and
//     grey words cannot be read on a picture — the reason this place was
//     turned down on 16 Nov.
// All at the chip's 32, with its slop: the name beside it needs the room
// (at 44 "Le Nguyen Ngoc Minh" shrank as far as it could, 16 Nov).

import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Glyph, ICON } from './ui/glyph';
import { CHIP_H, CHIP_SLOP, PressableScale, successHaptic } from './ui';
import { useCrew } from '../lib/crew';
import { acceptFriendRequest, sendFriendRequest } from '../lib/data';
import { type Pledged, quietReason, rowButton } from '../lib/friends';
import { useI18n } from '../lib/i18n';
import { usePending } from '../lib/pending';
import { colors, font, gradAI, onPhoto, radius } from '../theme';

/** Words on the photograph's light ink: the charcoal page's own ground,
 *  fixed, as everything on a photograph is. 15.9:1 on #F7F7F5. */
const PHOTO_INK = '#151614';

export function useFriendButtons(me: string | null, prefix: string, size: 'row' | 'photo' = 'row') {
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
  const friendButton = (id: string | null, as: { size?: 'row' | 'photo'; prefix?: string; actsOnly?: boolean } = {}) => {
    const state = rowButton(id, me, crew.ships.data, crew.blocks.data, pledged);
    if (!state || !id) return null;
    const lit = (as.size ?? size) === 'photo';
    const slop = CHIP_SLOP;
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
          <View style={[s.addBtn, lit && s.addOnPhoto]}>
            <Glyph name="person-add-outline" size={ICON.text} color={lit ? PHOTO_INK : colors.accent} />
            <Text style={[s.addText, lit && s.addTextOnPhoto]}>{t('Add friend', 'Kết bạn', '友達に追加', '加好友', '加好友')}</Text>
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
          <LinearGradient {...gradAI} style={s.acceptBtn}>
            <Glyph name="checkmark" size={ICON.text} color={colors.accentInk} />
            <Text style={s.acceptText}>{t('Accept', 'Đồng ý', '承認', '接受', '接受')}</Text>
          </LinearGradient>
        </PressableScale>
      );
    }
    // A state, not a control: drawn as Crew's quiet outline, read as words.
    if (as.actsOnly) return null;
    return (
      <View style={[s.quiet, lit && s.quietOnPhoto]} testID={`${name}-${state}`}>
        <Glyph
          name={state === 'friends' ? 'checkmark' : 'time-outline'}
          size={ICON.text}
          color={lit ? onPhoto.text : colors.textTertiary}
        />
        <Text style={[s.quietText, lit && s.quietTextOnPhoto]}>
          {state === 'friends'
            ? t('Friends', 'Bạn bè', '友達', '好友', '好友')
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
  // On a cover: the photograph's light ink as the pill, and no hairline
  // (a translucent edge on a picture is bright where the picture is).
  addOnPhoto: { backgroundColor: onPhoto.text, borderWidth: 0 },
  addTextOnPhoto: { color: PHOTO_INK },
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
  quietText: { color: colors.textTertiary, fontSize: 14, fontWeight: font.medium },
  // On a cover: Explore's date pill — the dark glass and its hairline —
  // so the words have a ground whatever the photograph is.
  quietOnPhoto: {
    paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: 'rgba(10,11,10,0.55)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: onPhoto.line,
  },
  quietTextOnPhoto: { color: onPhoto.text },
});
