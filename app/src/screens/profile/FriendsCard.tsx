// The friends card on Account: the way to your crew, and under it the
// way to Activity. Lifted out of `AccountProfile` the day Activity came
// back (19 Nov 2026): that function was at its ceiling, and this card
// is the one part of it with data of its own.
//
// The pill said "Coming soon" from the day this screen shipped;
// the row opens the crew now. The dot is requests. The number of
// friends was a pill at the row's end until 16 Nov 2026; it is a
// count on your own page now (`Counts`), and not said twice.
//
// ── Activity, under it again (owner, 19 Nov 2026) ──
// The row left this card for half a day, when the bell on your
// own page took its job (`person/Bell`). The owner asked for
// both: the bell is where news is noticed, and this is where a
// reader who knows the page exists goes looking for it — among
// the rooms of the account, where it had been since 6 Oct. Two
// ways to one page is the thing this screen has refused before
// (see the interests' "Edit"); the difference is that those two
// stood four lines apart on one screen, and these are on two.
// It wears no count and no dot: the dot is the bell's to carry
// (C7c of docs/comments-plan.md), and a second mark here would
// be one more reason for the tab's dot with no place on the
// first page (docs/profile-home-plan.md, section 3).

import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Card, PressableScale } from '../../components/ui';
import { Glyph, ICON } from '../../components/ui/glyph';
import { useCrew } from '../../lib/crew';
import { splitFriendships } from '../../lib/friends';
import { useI18n } from '../../lib/i18n';
import { useScheme } from '../../lib/theme';
import { bgElevatedHex, colors } from '../../theme';
import type { Nav } from '../../nav';
import { FeatureRow, RowGlyph } from './rows';
import { TITLE_LINE, s } from './styles';

/** `me` is the reader's id: `AccountProfile` has read the session once
 *  and hands it over, so the card asks nothing twice. Null is the
 *  formality it is there — Account is drawn only for a session — and
 *  means nobody is waiting on anybody: no dot. */
export function FriendsCard({ navigation, me }: { navigation: Nav; me: string | null }) {
  const { t } = useI18n();
  // For the one border here that must resolve in JS — see `reqDot`.
  const { scheme } = useScheme();
  // The dot beside the friends row. Sorted by the pure half in
  // lib/friends; the fetch itself is scoped by RLS to edges this account
  // is on.
  const { ships } = useCrew();
  const crew = useMemo(() => splitFriendships(ships.data, me ?? ''), [ships.data, me]);
  return (
    <Card style={s.featureCard}>
      <PressableScale
        contentStyle={[s.twoLineRow, s.featureRowDivider]}
        onPress={() => navigation.navigate('Crew')}
        accessibilityRole="button"
        testID="feature-row"
      >
        <View>
          <RowGlyph name="people-outline" line={TITLE_LINE} />
          {crew.incoming.length > 0 ? <View style={[s.reqDot, { borderColor: bgElevatedHex[scheme] }]} testID="friends-dot" /> : null}
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.featureTitle}>{t('Connect with friends', 'Kết nối bạn bè', '友達とつながる', '与好友联系', '與好友聯絡')}</Text>
          <Text style={s.featureSub}>
            {t('Make friends and plan together.', 'Kết bạn để cùng lên kế hoạch.', '友達になって、一緒に計画。', '结交好友，一起规划。', '結交好友，一起規劃。')}
          </Text>
        </View>
        <Glyph name="chevron-forward" size={ICON.action} color={colors.textTertiary} style={s.rowEnd} />
      </PressableScale>
      <FeatureRow
        icon="notifications-outline"
        title={t('Activity', 'Hoạt động', 'アクティビティ', '动态', '動態')}
        // No list of kinds: comments join the page behind a flag, and a
        // line that names them would be wrong for whoever has it off.
        sub={t("What's new between you and others.", 'Những gì mới giữa bạn và mọi người.', 'あなたとみんなの最近のできごと。', '你和大家之间的新动态。', '你和大家之間的新動態。')}
        onPress={() => navigation.navigate('Activity')}
        last
      />
    </Card>
  );
}
