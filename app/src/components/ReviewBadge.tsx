// What a place nobody else can see says about itself: "Pending" while the
// desk has it, "Declined" once the desk turned it down.
//
// ── why a word, and why these colours (owner, 23 Oct 2026) ──
//
// The grid's tile carried a 22pt dark disc with a clock or a cross in it
// (#1147), and the owner found it hard to see: on a night photograph the
// disc sank into the picture, a glyph alone left the reader to guess what
// it meant, and the cross was iOS's own close-and-delete mark — a place
// the desk declined looked like it had a button for throwing it away.
// The owner's reference put the state in words on a pill, and asked that
// the pill and the card's status line be one thing, in the colours of the
// look picked on Profile.
//
// So both are this. The waiting pill is the look's warning pair
// (`warnSoft` under `warnInk`), the declined one its red pair (`badSoft`
// under `badInk`) — each held to 4.5:1 on every look by `theme.test`,
// which is what a 11–12pt word needs. `badInk` exists for this: `bad`
// was held to 3:1 on its well, and read 3.5:1 on paper and slate.
//
// "Declined" ("Bị từ chối") is the owner's pick over "Not accepted",
// which at a tile's 111pt did not fit. "Pending" covers a place approved
// and not yet published too — there were none of those on 23 Oct 2026,
// and a third pill for a state with no rows would be one more thing to
// read on a 111pt tile.
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
    ? t('Declined', 'Bị từ chối', '不採用', '已拒绝', '已拒絕')
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
  const declined = isFlagged(place);
  const ink = declined ? colors.badInk : colors.warnInk;
  const explain = () => Alert.alert(
    label,
    declined
      ? t(
        'This place was not accepted, so only you can see it. Nobody else will see it, here or anywhere on City Crew.',
        'Địa điểm này không được duyệt nên chỉ bạn thấy. Người khác sẽ không thấy nó, ở đây hay bất cứ đâu trên City Crew.',
        'このスポットは採用されなかったため、あなたにだけ表示されています。ここでも City Crew のどこでも、ほかの人には表示されません。',
        '这个地点未通过审核，所以只有你能看到。其他人在这里或 City Crew 的任何地方都看不到它。',
        '這個地點未通過審核，所以只有你能看到。其他人在這裡或 City Crew 的任何地方都看不到它。',
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
        { backgroundColor: declined ? colors.badSoft : colors.warnSoft },
        overPhoto && s.overPhoto,
      ]}
    >
      <Ionicons name={declined ? 'alert-circle' : 'time-outline'} size={compact ? 12 : 13} color={ink} />
      <Text
        style={[s.text, compact && s.textCompact, { color: ink }]}
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
  // drawn on a wider tile; at 13pt "Bị từ chối", the widest word, comes
  // to about 100pt by estimate — not measured on a device — against the
  // 99pt a 111pt tile leaves inside its 6pt insets.
  compact: { gap: 3, paddingHorizontal: 7, paddingVertical: 4 },
  // `onPhoto.line`, not a themed colour: a border takes the phone's
  // appearance rather than the app's (see `theme.ts`), and this one is the
  // same on every look.
  overPhoto: { borderWidth: StyleSheet.hairlineWidth, borderColor: onPhoto.line },
  text: { fontSize: 12, fontWeight: font.semibold },
  textCompact: { fontSize: 11 },
});
