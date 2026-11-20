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
// ── the figure (owner, 20 Nov 2026: one bell) ──
//
// Everything for you lands here: a reply, a tag, a comment on your list,
// hearts, a like or a copy of your list, a friend request accepted or
// waiting (`lib/freshNews`). The last tab's dot is this, said smaller.
// It goes when Activity is opened (a request: when it is answered).
//
// A figure where the tab has a dot. The bell has room for one, and the
// figure says what a dot cannot — one thing, or a dozen — while a tab
// bar of figures reads as a bill. Counted as Activity's "For you" pill
// counts, one row a list for its likes, so the bell, the pill and the
// dots on the rows say one number. Past nine it is "9+" (`bellFigure`).
//
// No "mark all as read": opening the bell is that. Such a button earns
// its place where each item keeps its own read state, as mail does;
// here nothing does, and the button would do what opening already did.
//
// It reads the number itself, not as a prop: a caller could hand it a
// number worked out some other way. VoiceOver hears the count with the
// name, as it does on the tab.

import { StyleSheet, Text, View } from 'react-native';
import { RoundIconButton } from '../../components/ui';
import { bellFigure } from '../../lib/commentNews';
import { useFreshNews } from '../../lib/freshNews';
import { useI18n } from '../../lib/i18n';
import { useScheme } from '../../lib/theme';
import { bgHex, colors, font } from '../../theme';

export function Bell({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  const { fresh } = useFreshNews();
  // A ring is a border, and a dynamic colour on a border follows the
  // phone's appearance rather than the app's (`bgHex`): the page's
  // ground as plain hex, for this theme.
  const { scheme } = useScheme();
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
      {fresh > 0 ? (
        <View style={[s.figure, { borderColor: bgHex[scheme] }]} pointerEvents="none" testID="person-bell-figure">
          <Text style={s.figureText}>{bellFigure(fresh)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  // The news pill of the word tabs (`ui/controls`' `tabBadge`), in its
  // inks, so the bell's figure and Activity's "For you" figure are one
  // mark — made small enough to ride a glyph: 16 tall, which holds "9+"
  // at 10pt with a point either side, a disc for "1" and a capsule past
  // it. On the glyph's upper right, where the dot sat (the 22pt glyph
  // spans 11 to 33 of the 44pt box), ringed in the page's colour so it
  // is cut out of the bell it overlaps, as a badge on an app icon is.
  // Over the box, not inside the press, so it never takes a touch.
  figure: {
    position: 'absolute', top: 5, left: 25, minWidth: 16, height: 16, paddingHorizontal: 4,
    borderRadius: 8, backgroundColor: colors.badgeSolid, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  figureText: { color: colors.accentInk, fontSize: 10, lineHeight: 12, fontWeight: font.bold },
});
