// The bell on your own page: the way to Activity.
//
// ── where ──
//
// Activity was a row on the Account page, under Friends. The last tab
// opens your own page now and Account is a page under it
// (docs/profile-home-plan.md), so its way in came here. On 19 Nov 2026
// the owner chose, from two drawn for him, the cover's top-right corner
// (A) over a place beside "Account ›" on the activity heading (B): A was
// in sight the moment the page opened, B a scroll away.
//
// On 20 Nov 2026 (owner, from a mock-up of his own) it went up to the
// header's right end, between the search and the gear (`person/Tools`).
// That keeps what A was chosen for — in sight on opening — and drops
// what A cost: it no longer lies on the photograph. So it is bare, the
// header's own control (`RoundIconButton`), not the `photoDisc` a
// control over a picture wears.
//
// ── the dot ──
//
// The plan's rule: every reason for the last tab's dot is in sight on
// this page and goes when it is answered. A reply, a tag or a comment on
// your list is one (C7c of docs/comments-plan.md), and its place is
// here, gone when Activity is opened. The bell reads it from
// `useFreshNews`, the one copy the tab's dot reads, so the two cannot
// disagree — and reads it itself, not as a prop: a caller could hand it
// a number worked out some other way.
//
// VoiceOver hears the count with the name, as it does on the tab.

import { StyleSheet, View } from 'react-native';
import { RoundIconButton } from '../../components/ui';
import { useFreshNews } from '../../lib/freshNews';
import { useI18n } from '../../lib/i18n';
import { colors } from '../../theme';

export function Bell({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  const { fresh } = useFreshNews();
  const name = t('Activity', 'Hoạt động', 'アクティビティ', '动态', '動態');
  return (
    <View>
      <RoundIconButton
        bare
        icon="notifications-outline"
        onPress={onPress}
        label={fresh > 0 ? t(`${name}, ${fresh} new`, `${name}, ${fresh} mới`, `${name}、新着${fresh}件`, `${name}，${fresh} 条新消息`, `${name}，${fresh} 條新訊息`) : name}
        testID="person-bell"
      />
      {fresh > 0 ? <View style={s.dot} pointerEvents="none" testID="person-bell-dot" /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  // The tab bar's dot, 9, on the glyph's upper right as it sat on the
  // disc: the 22pt glyph spans 11 to 33 of the 44pt box, so its top edge
  // less one and its right edge flush. Over the box, not inside the
  // press, so it never takes a touch.
  dot: { position: 'absolute', top: 10, right: 11, width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.accent },
});
