// The rows of Activity, in their two groups (owner, 19 Nov 2026): what
// somebody else did, then what the reader did — `lib/commentNews` has
// the rule and what it was weighed against. Lifted out of
// `ActivityScreen` the day the comment rows arrived: the page's function
// was at its ceiling, and a row is the part of it that is one thing.
//
// ── a row ──
//
// Who, then what: the actor's face leads, and the kind of thing they
// did rides on its corner as a badge. A row that opens something wears
// the chevron that says so; one that opens nothing wears none.
//
// A row about a list opens the list; a friendship's opens the other
// person's page (owner, 19 Nov 2026). Until then it was a line to read,
// and the one row in "For you" that led nowhere: a new friend is the one
// piece of news here whose next step is a person — see what they keep —
// and the face on the row already looked like a way there. Only where
// the other person has a handle to open: a profile not in yet has no
// page, so its row keeps no chevron.
//
// A comment's row (C7b of `docs/comments-plan.md`) is the same row with
// one line more: the comment's own words, in quotation marks, one line.
// The sentence says who and what kind — "replied to you" — and the quote
// is what a reader wants next: whether it needs an answer. For hearts it
// is the comment that was liked, so "your comment" is not a riddle on a
// page that may hold three of them.
//
// It opens the list's thread. Landing on the comment itself — scrolled
// to, and lit for a beat — is the thread page's to do with the `focus`
// the row hands it; until that is built the thread opens at its top.
//
// ── what is new (C7c; owner, 19 Nov 2026) ──
//
// A row of the first group that came since Activity was last opened
// wears a dot at its end, before the chevron: the tab's and the bell's
// own dot, so the mark that sent the reader here is the mark that says
// which rows it meant. Every row of that group, a like as much as a
// reply — on the page "new" is about time; only the dot on the tab is
// kept to what wants an answer (`freshNews`). Never on the second
// group: what the reader did is not news to them.
//
// Opening the page is seeing it: the mark moves past the newest row
// shown (`useSeenThrough`), and the dots stay for this visit.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar, Card, PressableScale } from '../../components/ui';
import { Glyph, ICON } from '../../components/ui/glyph';
import { type ActivityEntry, type CommentNews, newestAt } from '../../lib/commentNews';
import type { FriendProfile } from '../../lib/data';
import type { ActivityItem } from '../../lib/friends';
import { useSeenThrough } from '../../lib/freshNews';
import { atHandle } from '../../lib/handle';
import { useI18n } from '../../lib/i18n';
import { type Nav, toPerson } from '../../nav';
import { colors, space, type } from '../../theme';

type Translate = (en: string, vi: string, ja: string, zh?: string, hant?: string) => string;
type Glyphs = keyof typeof Ionicons.glyphMap;
/** A list as a row needs it: where it opens, and what it is called. */
type Titled = { slug: string; title_en: string; title_vi: string; title_ja?: string | null };

export function ActivityGroups({ groups, people, faces, collectionOf, ago, navigation }: {
  groups: { forYou: ActivityEntry[]; yours: ActivityEntry[] };
  /** The crew, by id: a friendship row's other person. */
  people: Record<string, FriendProfile>;
  /** Faces by handle, for the rows that came without one. */
  faces: Record<string, string>;
  collectionOf: (collectionId: string) => Titled | null;
  ago: (iso: string) => string;
  /** Where the rows go; the page's own, handed down whole since the
   *  third destination arrived and the page's function was at its
   *  ceiling. */
  navigation: Nav;
}) {
  const { t } = useI18n();
  const onList = (slug: string) => navigation.navigate('CollectionDetail', { slug });
  const onPerson = (handle: string) => toPerson(navigation, handle);
  // The thread, at the comment: `useThreadFocus` scrolls to it and lights it.
  const onComment = (n: CommentNews) =>
    navigation.navigate('Comments', { subject: { kind: 'collection', id: n.list.id }, focus: n.comment_id });
  const isNew = useSeenThrough(newestAt(groups.forYou));
  const group = (entries: ActivityEntry[], title: string, testID: string, news = false) => (entries.length === 0 ? null : (
    <>
      <Text style={s.head} accessibilityRole="header" testID={`${testID}-head`}>{title}</Text>
      <Card testID={testID}>
        {entries.map((e, i) => {
          const row = e.from === 'log'
            ? logRow(e.item, people, faces, collectionOf, onList, onPerson, t)
            : newsRow(e.news, onComment, t);
          return (
            <PressableScale
              key={row.key}
              contentStyle={[s.row, i > 0 && s.rowDivider]}
              onPress={row.open}
              accessibilityRole={row.open ? 'button' : undefined}
              testID={e.from === 'comments' ? `news-${e.news.kind}` : undefined}
            >
              {/* Who, then what: the actor's face leads the row, as
                  every social feed has it (Instagram, Threads), and the
                  kind of thing they did rides on its corner as a badge —
                  filled and in the accent, small enough to be a mark and
                  not a second picture. It replaced a bare glyph per row,
                  which told the eye nothing once five rows shared it. */}
              <View style={s.face} testID="row-face">
                <Avatar url={row.face} size={FACE} />
                <View style={s.kind} testID="kind-badge">
                  <Glyph name={row.badge} size={ICON.tiny} color={colors.accent} />
                </View>
              </View>
              <View style={s.words}>
                <Text style={s.line} numberOfLines={2}>{row.line}</Text>
                {row.quote ? <Text style={s.quote} numberOfLines={1} testID="news-quote">{row.quote}</Text> : null}
                <Text style={s.meta}>{ago(e.at)}</Text>
              </View>
              {/* Only where there is somewhere to go: the same condition
                  as the role above, so what VoiceOver hears and what the
                  eye sees agree. */}
              {news && isNew(e.at) ? (
                <View
                  style={s.fresh}
                  accessible
                  accessibilityLabel={t('New', 'Mới', '新着', '新', '新')}
                  testID="row-new"
                />
              ) : null}
              {row.open ? <Glyph name="chevron-forward" size={ICON.action} color={colors.textTertiary} style={s.rowEnd} /> : null}
            </PressableScale>
          );
        })}
      </Card>
    </>
  ));
  return (
    // One element holds both groups: what the page's tests, and a reader
    // of them, call the timeline.
    <View testID="earlier-card">
      {group(groups.forYou, t('For you', 'Dành cho bạn', 'あなたへ', '与你有关', '與你有關'), 'activity-for-you', true)}
      {group(groups.yours, t('What you did', 'Việc bạn đã làm', 'あなたがしたこと', '你做过的', '你做過的'), 'activity-yours')}
    </View>
  );
}

/** What a row draws, whichever source it came from. */
type Row = { key: string; face: string | null; badge: Glyphs; line: string; quote?: string; open?: () => void };

function logRow(
  item: ActivityItem, people: Record<string, FriendProfile>, faces: Record<string, string>,
  collectionOf: (id: string) => Titled | null, onList: (slug: string) => void, onPerson: (handle: string) => void,
  t: Translate,
): Row {
  const col = item.kind === 'friend' ? null : collectionOf(item.collection_id);
  const title = col ? t(col.title_en, col.title_vi, col.title_ja as string) : null;
  const who = handleOf(item, people);
  return {
    key: item.kind === 'friend' ? `friend-${item.other}` : `${item.kind}-${item.collection_id}-${item.at}`,
    face: who ? faces[who] : null,
    badge: BADGE[item.kind],
    line: lineOf(item, who ? atHandle(who) : null, title ?? '…', t),
    open: item.kind === 'friend' ? (who ? () => onPerson(who) : undefined) : col ? () => onList(col.slug) : undefined,
  };
}

function newsRow(n: CommentNews, onComment: (news: CommentNews) => void, t: Translate): Row {
  const by = n.handle ? atHandle(n.handle) : n.full_name;
  // The list's name as its author wrote it, in the reader's language. A
  // missing Japanese stays null for `t` to fall back from, as a list's
  // own row hands it over.
  const list = { title_en: n.list.title_en ?? '', title_vi: n.list.title_vi ?? '', title_ja: n.list.title_ja as string };
  const title = t(list.title_en, list.title_vi, list.title_ja) || '…';
  return {
    key: `news-${n.kind}-${n.comment_id}`,
    // The news comes with its actor's face; no second ask by handle.
    face: n.avatar_url,
    badge: NEWS_BADGE[n.kind],
    line: newsLine(n, by, title, t),
    quote: n.body ? `“${n.body}”` : undefined,
    open: () => onComment(n),
  };
}

/** The other person in a row, by handle: who liked or copied, whose list
 *  it was, or who the new friend is — whoever the face is of. */
export function handleOf(it: ActivityItem, people: Record<string, FriendProfile>): string | null {
  if (it.kind === 'applause') return it.liker_handle;
  if (it.kind === 'copy') return it.copier_handle;
  if (it.kind === 'friend') return people[it.other]?.handle ?? null;
  return it.owner_handle;
}

/** The mark on the face's corner: what kind of thing happened. A like is
 *  the heart and a copy the copy glyph whoever did it; a friendship is two
 *  people. */
const BADGE: Record<ActivityItem['kind'], Glyphs> = {
  applause: 'heart', liked: 'heart', copy: 'copy', copied: 'copy', friend: 'people',
};

/** And for comments: the "@" of a tag, the arrow of an answer, the bubble
 *  of a comment, and the heart a like is everywhere. */
const NEWS_BADGE: Record<CommentNews['kind'], Glyphs> = {
  tag: 'at', reply: 'arrow-undo', on_list: 'chatbubble', heart: 'heart',
};

/**
 * The sentence a comment's row says: who, and which of the four things.
 * A missing name falls back rather than going blank, as the page's other
 * rows do. Hearts name the latest liker and count the rest — "and 1
 * other", "and 2 others" — because ten hearts are one row (rule 3 of the
 * plan).
 */
function newsLine(n: CommentNews, by: string | null, title: string, t: Translate): string {
  const who = by ?? t('Someone', 'Ai đó', '誰か', '有人', '有人');
  switch (n.kind) {
    case 'tag':
      return t(`${who} mentioned you`, `${who} đã nhắc tới bạn`, `${who} があなたをメンションしました`, `${who} 提到了你`, `${who} 提到了你`);
    case 'reply':
      return t(`${who} replied to you`, `${who} đã trả lời bạn`, `${who} があなたに返信しました`, `${who} 回复了你`, `${who} 回覆了你`);
    case 'on_list':
      return t(`${who} commented on “${title}”`, `${who} đã bình luận về “${title}”`, `${who} が「${title}」にコメントしました`, `${who} 评论了“${title}”`, `${who} 評論了「${title}」`);
    case 'heart':
      if (n.others === 0) {
        return t(`${who} liked your comment`, `${who} đã thích bình luận của bạn`, `${who} があなたのコメントにいいねしました`, `${who} 赞了你的评论`, `${who} 讚了你的評論`);
      }
      return n.others === 1
        ? t(`${who} and 1 other liked your comment`, `${who} và 1 người khác đã thích bình luận của bạn`, `${who} と他1人があなたのコメントにいいねしました`, `${who} 和另外 1 人赞了你的评论`, `${who} 和另外 1 人讚了你的評論`)
        : t(`${who} and ${n.others} others liked your comment`, `${who} và ${n.others} người khác đã thích bình luận của bạn`, `${who} と他${n.others}人があなたのコメントにいいねしました`, `${who} 和另外 ${n.others} 人赞了你的评论`, `${who} 和另外 ${n.others} 人讚了你的評論`);
  }
}

/**
 * The sentence a row says. Two kinds are other people's acts on your
 * lists, two are yours on theirs, one is a friendship; each has the one
 * shape, and a missing name falls back rather than going blank. The
 * copy's verb is the button's own words — "Save a copy" is what was
 * pressed. Your own rows lead with you (owner's wording, 28 Oct 2026:
 * "Bạn đã thích “Y” của @b").
 */
function lineOf(item: ActivityItem, by: string | null, shown: string, t: Translate): string {
  switch (item.kind) {
    case 'applause':
    case 'copy':
      return praiseLine(item.kind, by ?? t('Someone', 'Ai đó', '誰か', '有人', '有人'), item.others, shown, t);
    case 'liked':
      return by
        ? t(`You liked ${by}’s “${shown}”`, `Bạn đã thích “${shown}” của ${by}`, `${by} の「${shown}」にいいねしました`, `你点赞了 ${by} 的“${shown}”`, `你按讚了 ${by} 的「${shown}」`)
        : t(`You liked “${shown}”`, `Bạn đã thích “${shown}”`, `「${shown}」にいいねしました`, `你点赞了“${shown}”`, `你按讚了「${shown}」`);
    case 'copied':
      return by
        ? t(`You saved a copy of ${by}’s “${shown}”`, `Bạn đã lưu bản sao “${shown}” của ${by}`, `${by} の「${shown}」のコピーを保存しました`, `你保存了 ${by} 的“${shown}”的副本`, `你儲存了 ${by} 的「${shown}」的副本`)
        : t(`You saved a copy of “${shown}”`, `Bạn đã lưu bản sao “${shown}”`, `「${shown}」のコピーを保存しました`, `你保存了“${shown}”的副本`, `你儲存了「${shown}」的副本`);
    case 'friend':
      if (item.asked === 'you') {
        return by
          ? t(`${by} accepted your friend request`, `${by} đã chấp nhận lời mời kết bạn của bạn`, `${by} があなたの友達リクエストを承認しました`, `${by} 接受了你的好友请求`, `${by} 接受了你的好友請求`)
          : t('Someone accepted your friend request', 'Ai đó đã chấp nhận lời mời kết bạn của bạn', '誰かがあなたの友達リクエストを承認しました', '有人接受了你的好友请求', '有人接受了你的好友請求');
      }
      return by
        ? t(`You and ${by} are now friends`, `Bạn và ${by} đã thành bạn bè`, `${by} と友達になりました`, `你和 ${by} 成为了好友`, `你和 ${by} 成為了好友`)
        : t('You made a new friend', 'Bạn đã có thêm một người bạn', '新しい友達ができました', '你有了一位新朋友', '你有了一位新朋友');
  }
}

/**
 * What others did with one of your lists: the latest of them, and the
 * rest as a number — "and 1 other", "and 2 others" — because a list is
 * one row however many liked it (`buildActivity`), as a comment is. With
 * no name to give it is "Someone", as it was.
 */
function praiseLine(kind: 'applause' | 'copy', who: string, others: number, shown: string, t: Translate): string {
  if (kind === 'applause') {
    if (others === 0) return t(`${who} liked “${shown}”`, `${who} đã thích “${shown}”`, `${who} が「${shown}」にいいねしました`, `${who} 点赞了“${shown}”`, `${who} 按讚了「${shown}」`);
    return others === 1
      ? t(`${who} and 1 other liked “${shown}”`, `${who} và 1 người khác đã thích “${shown}”`, `${who} と他1人が「${shown}」にいいねしました`, `${who} 和另外 1 人点赞了“${shown}”`, `${who} 和另外 1 人按讚了「${shown}」`)
      : t(`${who} and ${others} others liked “${shown}”`, `${who} và ${others} người khác đã thích “${shown}”`, `${who} と他${others}人が「${shown}」にいいねしました`, `${who} 和另外 ${others} 人点赞了“${shown}”`, `${who} 和另外 ${others} 人按讚了「${shown}」`);
  }
  if (others === 0) return t(`${who} saved a copy of “${shown}”`, `${who} đã lưu bản sao “${shown}”`, `${who} が「${shown}」のコピーを保存しました`, `${who} 保存了“${shown}”的副本`, `${who} 儲存了「${shown}」的副本`);
  return others === 1
    ? t(`${who} and 1 other saved a copy of “${shown}”`, `${who} và 1 người khác đã lưu bản sao “${shown}”`, `${who} と他1人が「${shown}」のコピーを保存しました`, `${who} 和另外 1 人保存了“${shown}”的副本`, `${who} 和另外 1 人儲存了「${shown}」的副本`)
    : t(`${who} and ${others} others saved a copy of “${shown}”`, `${who} và ${others} người khác đã lưu bản sao “${shown}”`, `${who} と他${others}人が「${shown}」のコピーを保存しました`, `${who} 和另外 ${others} 人保存了“${shown}”的副本`, `${who} 和另外 ${others} 人儲存了「${shown}」的副本`);
}

/** The feed line's line height, and the box that holds a 19pt glyph's
 *  whole line — see `mark`. */
const LINE = 21;
/** The face's side: the 44pt the slot it replaced had, so the text
 *  column stays where it was. */
const FACE = 44;

const s = StyleSheet.create({
  // The Profile stack's section heading (`profile/styles`' `section`).
  head: { color: colors.text, ...type.section, marginTop: 10 },
  // Centred: a 44pt face beside one or two lines of text wants its
  // middle on theirs. The rows were top-aligned while the mark was a
  // 19pt glyph set on the first line; a face has no first line to sit on.
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    paddingHorizontal: space.cardPadding, paddingVertical: 12,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  meta: { color: colors.textTertiary, ...type.meta },
  // The row aligns its top so the mark can sit on the first line of text;
  // the chevron keeps the middle, as Profile's rows do it.
  rowEnd: { alignSelf: 'center' },
  face: { width: FACE, height: FACE },
  // The badge: a 20pt disc on the card's own ground with the row's
  // hairline around it, hung a hair past the face's corner so it reads
  // as pinned on rather than printed on. 11pt glyph: the heart is a
  // mark here, not an icon to tap.
  kind: {
    position: 'absolute', right: -3, bottom: -3,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.surfaceCard,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  // The tab bar's dot, at its 9: one mark for "look here" in the app.
  fresh: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.accent },
  line: { color: colors.text, fontSize: 15, lineHeight: LINE },
  words: { flex: 1, gap: 2 },
  // The comment's own words: the line's size, a step back in colour, so
  // the sentence above stays what the row says first.
  quote: { color: colors.textSecondary, fontSize: 15, lineHeight: LINE },
});
