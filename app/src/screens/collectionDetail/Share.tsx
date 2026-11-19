// Sharing a list of your own: the button at the card's foot, and the
// parts of the sheet it opens that are not the list's own state.
//
// ── Share, beside the heart (owner, 17 Nov 2026) ──
//
// Who can see the list was a word and a chevron under the handle
// ("Public ⌄"), and the owner did not like a setting standing in the line
// that says who made the list and when. A row of acts is at the card's
// foot; it went there.
//
// Under the sign for sharing, not for a setting — the owner's idea, taken
// in the shape a shared document's Share button has: one door for "who
// has this" and "send it to somebody", because to the person holding the
// list those are one question. The sheet is headed "Share" and holds
// both: the three answers to who can see it (`whoSeesRows`, the screen's,
// since they are the list's state) and the sending (`sendRows`).
//
// The figure is how many friends have it, and is drawn only while the
// list is shared with friends. Public has no number — everybody — and
// private has none to give; and a figure beside a share mark on a public
// list would be read as "shared 3 times", the count every other app
// prints there.
//
// Yours alone. A visitor has no setting to change and, until a list has
// an address to send, nothing to send either: a button that opened one
// dimmed row would be a door onto a wall.
//
// The heart's grey, size and reach.
//
// ── with its word (owner, 18 Nov 2026) ──
//
// The glyph stood alone for a day, and beside a heart with a number it
// read as an afterthought. "Share" after it now, and while the list is
// shared with friends, "Share · 2". The word is what makes the iOS share
// glyph honest here: alone it promises a send sheet, and with "Share"
// beside it it is the button a shared document has, which opens who has
// the thing. The figure after the word and a dot cannot be read as
// "shared twice", which a bare number beside the glyph could.
//
// Weighed with it: the glyph on a tinted disc (heavier than the heart,
// for a button only the owner has), and "7 likes" spelled out beside
// "Share" (three phrases do not fit the row on a narrow phone). The row
// fits this one because "View activity" became "Activity" the same day.
//
// ── a paper plane, and no word (owner, 18 Nov 2026, the next morning) ──
//
// The word lasted a night. On the phone the owner took it off again and
// changed the glyph: `paper-plane-outline`, from a set of five weighed
// for him (the plane; three joined dots, Android's; two heads; a globe;
// an arrow up and right). The iOS box-and-arrow needed the word to be
// honest, and the plane does not: it says "to somebody", which is what
// choosing who sees a list is, and it is not the system's own share
// sheet. Two heads was the other candidate and is the mark under the
// handle already (`shares.SEEN_GLYPH`), so the button would have doubled
// it.
//
// Ionicons' own plane, as the heart beside it is Ionicons' (`ui/glyph`
// has the day it spent in the line set, and why it came back).
//
// The figure after it is back to a bare number, as it first was: how
// many friends the list is shared with. VoiceOver is told all of it —
// "Share, Friends, 3".
//
// ── after the comments (owner, 19 Nov 2026) ──
//
// "Beside the heart" above is where it began. It is third now: heart,
// comments, Share. `CollectionDetailScreen` has the reasons where the
// row is put together.
//
// ── what stays under the handle ──
//
// The state's glyph alone — a globe, two heads, a padlock — with no word
// and no chevron: a mark of how the list stands, not the place to change
// it. It still opens the sheet for now. Whoever learned to press there
// reaches the same sheet, and the press can go once nobody does.
//
// The two heads alone are the weak one. The word was kept beside the
// glyph on 13 Nov 2026 because nobody could read them unaided as "shared
// with some friends"; it is given up here for a mark that is the same
// shape in all three states, and the count beside Share says "friends"
// in the same card. If the heads prove unreadable, the word comes back
// for that one state.
//
// ── out of the screen ──
//
// `CollectionDetailScreen`'s function is at its ceiling (`oversize.js`);
// what could leave it is here.

import React from 'react';
import { Text, View } from 'react-native';
import { type SheetAction } from '../../components/ActionSheet';
import { PressableScale } from '../../components/ui';
import { Glyph, ICON } from '../../components/ui/glyph';
import { useI18n } from '../../lib/i18n';
import { type ReaderMark, SEEN_GLYPH, seenName } from '../../lib/shares';
import { colors } from '../../theme';
import { ACT_GLYPH, s } from './styles';

type T = ReturnType<typeof useI18n>['t'];
type Seen = Parameters<typeof seenName>[0];

/** What a press on either door does, for VoiceOver. */
export const whoHint = (t: T): string => t(
  'Choose who can see this list',
  'Chọn ai có thể xem bộ sưu tập này',
  'このリストを見られる人を選びます',
  '选择谁可以看到这个清单', '選擇誰可以看到這個清單',
);

/** Share, at the card's foot — see the header. */
export function ShareButton({ seen, friends, onPress }: {
  /** How the list stands now, which VoiceOver hears in the button's name. */
  seen: Seen;
  /** How many friends the list is shared with. */
  friends: number;
  onPress: () => void;
}) {
  const { t } = useI18n();
  return (
    <PressableScale
      contentStyle={s.like}
      scaleTo={0.82}
      haptic="selection"
      hitSlop={{ top: 14, bottom: 14, left: 12, right: 14 }}
      onPress={onPress}
      accessibilityRole="button"
      // What it is, how the list stands, and how many have it: the mark
      // under the handle no longer says the second in words, and the
      // figure is not read once the button has a name.
      accessibilityLabel={[
        t('Share', 'Chia sẻ', '共有', '分享', '分享'), seenName(seen, t), ...(seen === 'friends' ? [String(friends)] : []),
      ].join(', ')}
      accessibilityHint={whoHint(t)}
      testID="collection-share"
    >
      <Glyph name="paper-plane-outline" size={ACT_GLYPH} color={colors.textSecondary} />
      {seen === 'friends' ? <Text style={s.act} testID="collection-share-count">{friends}</Text> : null}
    </PressableScale>
  );
}

/** The sheet's head: what the button said, then the question its first
 *  card answers. The second card is the other half of sharing. */
/** What VoiceOver is told of the reader's mark; nothing for none. */
export function readerWord(kind: ReaderMark | null, t: T): string {
  if (!kind) return '';
  return kind === 'lent'
    ? t('Shared with you', 'Chia sẻ với bạn', 'あなたに共有', '与你分享', '與你分享')
    : seenName('public', t);
}

/**
 * The mark under the handle for a reader who is not the owner
 * (`shares.readerMark`): two heads and "Shared with you" on a list lent
 * to them, the globe alone on a person's public list. Not a button —
 * the owner's mark in the same place is, and opens the sheet — and at
 * that mark's size and in its grey, so the line reads the same whoever
 * is looking.
 */
export function ReaderSeen({ kind }: { kind: ReaderMark }) {
  const { t } = useI18n();
  return kind === 'lent' ? (
    <View style={s.visibility} testID="collection-shared">
      <Glyph name={SEEN_GLYPH.friends} size={ICON.text} color={colors.textTertiary} />
      <Text style={s.visibilityWord}>{readerWord(kind, t)}</Text>
    </View>
  ) : (
    <View style={s.visibility} accessible accessibilityLabel={readerWord(kind, t)} testID="collection-public">
      <Glyph name={SEEN_GLYPH.public} size={ICON.text} color={colors.textTertiary} />
    </View>
  );
}

export function ShareHead() {
  const { t } = useI18n();
  return (
    <View style={s.sheetHead}>
      <Text style={s.sheetTitle} accessibilityRole="header">{t('Share', 'Chia sẻ', '共有', '分享', '分享')}</Text>
      <Text style={s.sheetAsk}>
        {t('Who can see your list?', 'Những ai xem được bộ sưu tập của bạn?', 'あなたのリストを見られるのは？', '谁能看到你的清单？', '誰能看到你的清單？')}
      </Text>
    </View>
  );
}

/**
 * Sending the list to somebody: not built.
 *
 * Nothing registers a web address or a URL scheme for a collection, so
 * there is no link to hand over, and a share sheet onto one that 404s for
 * whoever receives it would be worse than none. Until 17 Nov 2026 a
 * "Share" row in the ⋯ said so in an alert; it is said here now, where
 * the question is asked — a row drawn dimmed with "Soon", as the app
 * draws a thing that is coming (`ActionSheet`, `disabled`). When a list
 * has an address this is the row that sends it.
 */
export const sendRows = (t: T): SheetAction[] => [{
  key: 'link',
  icon: 'link-outline',
  title: t('Send a link', 'Gửi liên kết', 'リンクを送る', '发送链接', '傳送連結'),
  desc: t('Soon', 'Sắp có', '近日公開', '即将推出', '即將推出'),
  disabled: true,
  onPress: () => {},
  testID: 'collection-send-link',
}];
