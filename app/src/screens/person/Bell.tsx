// The bell on your own page: the way to Activity.
//
// ── where (owner, 19 Nov 2026) ──
//
// Activity was a row on the Account page, under Friends. The last tab
// opens your own page now and Account is a page under it
// (docs/profile-home-plan.md), so its way in came here, and the owner
// chose its place from two drawn for him: over the cover's top-right
// corner, as his reference has it (A), rather than beside "Account ›" on
// the activity heading (B). A is in sight the moment the page opens; B
// sat under the counts and the requests, a scroll away on a page with
// both. The cost of A, said and accepted: it lies on the photograph.
//
// The disc is `photoDisc`, the app's one control over a picture — the
// card's bookmark, the viewer's ×: 36 drawn, 44 to the thumb.
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
import { PHOTO_GLYPH, PHOTO_SLOP, photoDisc, PressableScale } from '../../components/ui';
import { Glyph } from '../../components/ui/glyph';
import { useFreshNews } from '../../lib/freshNews';
import { useI18n } from '../../lib/i18n';
import { colors, onPhoto } from '../../theme';

/** The cover's own inset for a control in its corner: the bookmark's
 *  on a place card. */
const INSET = 10;

export function Bell({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  const { fresh } = useFreshNews();
  const name = t('Activity', 'Hoạt động', 'アクティビティ', '动态', '動態');
  return (
    <PressableScale
      style={s.at}
      contentStyle={photoDisc}
      onPress={onPress}
      hitSlop={PHOTO_SLOP}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={fresh > 0 ? t(`${name}, ${fresh} new`, `${name}, ${fresh} mới`, `${name}、新着${fresh}件`, `${name}，${fresh} 条新消息`, `${name}，${fresh} 條新訊息`) : name}
      testID="person-bell"
    >
      <Glyph name="notifications-outline" size={PHOTO_GLYPH} color={onPhoto.text} />
      {fresh > 0 ? <View style={s.dot} testID="person-bell-dot" /> : null}
    </PressableScale>
  );
}

const s = StyleSheet.create({
  at: { position: 'absolute', top: INSET, right: INSET },
  // The tab bar's dot, 9, on the disc's upper right, ringed by nothing:
  // the disc is dark under it whatever the photograph.
  dot: { position: 'absolute', top: 6, right: 7, width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.accent },
});
