// What a place nobody else can see says about itself: "Pending" while a
// suggestion waits on the desk, "In review" while the desk looks again at
// one it had already approved.
//
// ── why a word, and why these colours (owner, 23 Oct 2026) ──
//
// The grid's tile carried a 22pt dark disc with a clock or a cross in it
// (#1147), and the owner found it hard to see: on a night photograph the
// disc sank into the picture, a glyph alone left the reader to guess what
// it meant, and the cross was iOS's own close-and-delete mark. The owner's
// reference put the state in words on a pill, and asked that the pill and
// the card's status line be one thing, in the colours of the look picked
// on Profile: the look's warning pair, `warnSoft` under `warnInk`, held to
// 4.5:1 on every look by `theme.test` — what an 11–12pt word needs.
//
// ── "In review", not "Declined" ──
//
// `flagged` reads like a rejection and is not used as one. On 23 Oct 2026
// all three flagged places were the desk's own re-review: an approved
// place given a new blurb or photographs from Threads, flagged so the
// change gets a second look. There is no rejected state at all —
// `review_status` is pending, approved or flagged. "Bị từ chối" was on
// this pill for an hour and the owner called it too heavy for that, so
// both states are a wait, in the same amber, told apart by their glyph:
// a clock for the first look, a turn of arrows for the second. Red is
// left for a state that means no, if one is ever added.
//
// "Pending" covers a place approved and not yet published too — there
// were none of those on 23 Oct 2026, and a third pill for a state with no
// rows would be one more thing to read on a 111pt tile.
//
// A tap explains, in the platform's own alert: what the pill means for
// who can see the place. The rest of the tile or card still opens the
// place, and a hold on the tile still lifts it.

import React from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { isFlagged, isLive, type Place } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { colors, font, labelScaleCap, onPhoto, radius } from '../theme';

/** The pill's word for a place, or null for a live one — for a screen
 *  reader's label, which says what the pill shows. */
export function useReviewLabel(place: Place): string | null {
  const { t } = useI18n();
  if (isLive(place)) return null;
  return isFlagged(place)
    ? t('In review', 'Đang xem lại', '再確認中', '复核中', '複核中')
    : t('Pending', 'Chờ duyệt', '審査待ち', '待审核', '待審核');
}

export default function ReviewBadge({ place, compact, overPhoto, testID }: {
  place: Place;
  /** The grid's size: a tile is 111pt across. */
  compact?: boolean;
  /** Laid on a photograph, which needs a hairline to stand off it. */
  overPhoto?: boolean;
  testID?: string;
}) {
  const { t } = useI18n();
  const label = useReviewLabel(place);
  if (!label) return null;
  const again = isFlagged(place);
  const explain = () => Alert.alert(
    label,
    again
      ? t(
        'This place is being looked at again. Until that is done only you can see it; then everyone will see it again.',
        'Địa điểm này đang được xem lại. Trong lúc đó chỉ bạn thấy nó; xem lại xong, mọi người sẽ thấy lại.',
        'このスポットは再確認中です。終わるまではあなたにだけ表示され、終わればまたみんなに表示されます。',
        '这个地点正在复核。在此期间只有你能看到；复核完成后，所有人都能再次看到它。',
        '這個地點正在複核。在此期間只有你能看到；複核完成後，所有人都能再次看到它。',
      )
      : t(
        'Only you can see this place for now. Once it is approved, everyone will see it here and across City Crew.',
        'Hiện chỉ bạn thấy địa điểm này. Khi được duyệt, mọi người sẽ thấy nó ở đây và trên City Crew.',
        '今はあなたにだけ表示されています。承認されると、ここでも City Crew 全体でも、みんなに表示されます。',
        '目前只有你能看到这个地点。通过审核后，所有人都能在这里和 City Crew 上看到它。',
        '目前只有你能看到這個地點。通過審核後，所有人都能在這裡和 City Crew 上看到它。',
      ),
    [{ text: t('Got it', 'Đã hiểu', 'わかりました', '知道了', '知道了') }],
  );
  return (
    <Pressable
      onPress={explain}
      // To the 44pt a finger needs, without the pill growing to it.
      hitSlop={compact ? { top: 11, bottom: 11, left: 6, right: 6 } : { top: 10, bottom: 10, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('Says who can see this place', 'Cho biết ai thấy được địa điểm này', '誰に表示されるかを説明します', '说明谁能看到这个地点', '說明誰能看到這個地點')}
      testID={testID}
      style={[
        s.pill,
        compact && s.compact,
        { backgroundColor: colors.warnSoft },
        overPhoto && s.overPhoto,
      ]}
    >
      <Ionicons name={again ? 'refresh' : 'time-outline'} size={compact ? 12 : 13} color={colors.warnInk} />
      <Text
        style={[s.text, compact && s.textCompact, { color: colors.warnInk }]}
        numberOfLines={1}
        maxFontSizeMultiplier={labelScaleCap}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  // The card's status line as it was — 12pt on a pill, 9pt in — so the
  // list keeps its rhythm; only the colours and the word changed.
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill,
  },
  // The tile's: 11pt type, 7pt in. The reference's 13pt and 12pt in were
  // drawn on a wider tile; at 13pt "Đang xem lại", the widest word, comes
  // to over 100pt by estimate — not measured on a device — against the
  // 99pt a 111pt tile leaves inside its 6pt insets.
  compact: { gap: 3, paddingHorizontal: 7, paddingVertical: 4 },
  // `onPhoto.line`, not a themed colour: a border takes the phone's
  // appearance rather than the app's (see `theme.ts`), and this one is the
  // same on every look.
  overPhoto: { borderWidth: StyleSheet.hairlineWidth, borderColor: onPhoto.line },
  text: { fontSize: 12, fontWeight: font.semibold },
  textCompact: { fontSize: 11 },
});
