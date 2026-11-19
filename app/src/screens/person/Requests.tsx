// The friend requests waiting on you, on your own page.
//
// ── why here (owner, 19 Nov 2026) ──
//
// The last tab opens your own page now (docs/profile-home-plan.md), and
// the tab wears a dot while a request waits (`FloatingTabBar`). The plan's
// rule: every reason for that dot is in sight on the page the tab opens,
// and goes when it is answered. A request is the commonest reason, so
// this card came with the page, in the same change, rather than a step
// later — a dot that leads to nothing teaches a reader to ignore dots.
//
// The owner's reference drew it under the counts: the faces of who is
// asking, how many, and their names in a sentence, the whole card one
// way into Friends, where each is answered. No Accept here: answering is
// a choice about a person, made beside their handle and their options
// (`CrewScreen`), not from a summary of several.
//
// Nothing when nobody waits: the card is a notice, not a place.

import { StyleSheet, Text, View } from 'react-native';

import { Avatar, Card, PressableScale } from '../../components/ui';
import { Glyph, ICON } from '../../components/ui/glyph';
import { splitFriendships } from '../../lib/friends';
import { atHandle } from '../../lib/handle';
import { useCrew } from '../../lib/crew';
import { useI18n } from '../../lib/i18n';
import { useScheme } from '../../lib/theme';
import { bgElevatedHex, colors, font, space } from '../../theme';

/** Two faces, as the reference has: who is asking, without a crowd. */
const FACES = 2;
/** The faces' size: the 34 a row's leading glyph box is, near enough
 *  that the card sits in the page's rhythm of rows. */
const FACE = 34;

type T = (en: string, vi: string, ja?: string, zh?: string, hant?: string) => string;

/**
 * Who is asking, in a sentence: one name, two, or the first and how many
 * more. The names the crew has looked up (`useCrew().people`); before
 * they arrive, the count alone, which the title already says.
 */
export function askers(names: string[], n: number, t: T): string | null {
  const [a, b] = names;
  if (!a) return null;
  if (n === 1) {
    return t(`${a} wants to be friends`, `${a} muốn kết bạn với bạn`, `${a}さんが友達になりたがっています`, `${a} 想加你为好友`, `${a} 想加你為好友`);
  }
  if (n === 2 && b) {
    return t(`${a} and ${b} want to be friends`, `${a} và ${b} muốn kết bạn với bạn`, `${a}さんと${b}さんが友達になりたがっています`, `${a} 和 ${b} 想加你为好友`, `${a} 和 ${b} 想加你為好友`);
  }
  const k = n - 1;
  return t(
    `${a} and ${k} other${k === 1 ? '' : 's'} want to be friends`,
    `${a} và ${k} người khác muốn kết bạn với bạn`,
    `${a}さんほか${k}人が友達になりたがっています`,
    `${a} 和另外 ${k} 人想加你为好友`, `${a} 和另外 ${k} 人想加你為好友`,
  );
}

export function Requests({ me, onOpen }: { me: string; onOpen: () => void }) {
  const { t } = useI18n();
  const { ships, people } = useCrew();
  // A ring is a border, and a dynamic colour on a border flattens against
  // the phone's appearance rather than the app's (`bgHex`): the card's
  // ground as plain hex, for this theme.
  const { scheme } = useScheme();
  const ring = { borderColor: bgElevatedHex[scheme] };
  const incoming = splitFriendships(ships.data, me).incoming;
  const n = incoming.length;
  if (n === 0) return null;
  const who = incoming.map((r) => people[r.requester]).filter((p) => !!p);
  const title = t(
    n === 1 ? '1 friend request' : `${n} friend requests`,
    `${n} lời mời kết bạn`,
    `友達リクエスト${n}件`,
    `${n} 个好友请求`, `${n} 個好友請求`,
  );
  const sub = askers(who.map((p) => p.full_name || atHandle(p.handle)), n, t);
  return (
    <Card style={s.card}>
      <PressableScale
        contentStyle={s.row}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={sub ? `${title}. ${sub}` : title}
        testID="person-requests"
      >
        <View style={s.faces}>
          {who.slice(0, FACES).map((p, i) => (
            <View key={p.id} style={[s.face, ring, i > 0 && s.faceOver]} testID="person-requests-face">
              <Avatar url={p.avatar_url || null} size={FACE} />
            </View>
          ))}
        </View>
        <View style={s.words}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          {sub ? <Text style={s.sub} numberOfLines={1}>{sub}</Text> : null}
        </View>
        <Glyph name="chevron-forward" size={ICON.action} color={colors.textTertiary} />
      </PressableScale>
    </Card>
  );
}

const s = StyleSheet.create({
  card: { marginTop: space.cardGap, padding: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: space.cardPadding },
  faces: { flexDirection: 'row' },
  // The second face over the first by a third of it, ringed in the card's
  // ground so the two read as two.
  face: { borderRadius: FACE, borderWidth: 2 },
  faceOver: { marginLeft: -Math.round(FACE / 3) },
  words: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: 15, fontWeight: font.semibold },
  sub: { color: colors.textSecondary, fontSize: 13 },
});
