// One thing somebody did with a collection, as a card.
//
// ── what it is for (owner, 17 Nov 2026) ──
//
// The plan (`docs/collection-feed-plan.md`): a person's
// page, and later the community's collections, become a feed whose unit
// is the collection — one card a collection, never one a like — with a
// line over it saying why it is here: "Trang created a collection",
// later "Minh and 2 friends liked this". Everything social in the app is
// to hang on a collection or a place, and this card is the hook.
//
// So the card knows nothing about people's pages. It is handed who, what
// they did, when, and the collection, and it draws them. The first
// screen to use it has one reason to give ("created a collection"); the
// reason is a string so the second screen brings its own.
//
// ── what it draws ──
//
// The reason: a small face, the name in bold with what they did after
// it, and when, under it in the quiet type.
// The collection: its photograph the card's full width, then its title,
// how much is on it, and two lines of its description when it has one —
// a feed is read, and a grid's tile had no room to say what a list is.
// The heart: the collection's own like, the one the shelf and the list's
// own screen flip (`catalog.toggleLike`). Liking the card is liking the
// collection; there is nothing else here to like, and no second tally.
//
// The photograph and the words are one press, into the collection. The
// heart is its own.
//
// ── the mark (owner, 17 Nov 2026) ──
//
// After the time, when the collection is not for everybody: a padlock on
// a private one, two heads and a number on one shared with friends, two
// heads and "Shared with you" on one lent to the reader. A person's page
// began to hold such collections that day (`person.listsOn`), and the
// owner's condition for it was that each says so on its face — a page of
// your own private lists with nothing to tell them from the public ones
// reads as a page everybody sees. The glyphs are the list's own
// (`shares.SEEN_GLYPH`), at the size its byline draws them. A glyph with
// no word where the page is your own, as that byline is; the caller
// decides, and hands the word VoiceOver says either way.
//
// A collection nobody may like — a private one — shows the likes it
// kept from being public as a figure in the heart's place: the outline
// in the quiet grey, the number, and nothing to press, as its own page
// draws them. With none kept it ends in the card's own padding.

import React from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import LikeHeart from './LikeHeart';
import { Glyph, ICON } from './ui/glyph';
import { PressableScale } from './ui/controls';
import { Avatar, Card } from './ui/surfaces';
import { useI18n } from '../lib/i18n';
import type { Preview } from '../lib/comments';
import { likesWorthShowing } from '../lib/likes';
import { colors, font, space, type } from '../theme';

/** The face beside the reason: a line of the reason and a line of the
 *  time is 20 + 17, and the face is their height. */
const FACE = 36;
/** Who can see a collection that is not for everybody — see the note
 *  on the mark above. */
export type ActivityMark = {
  icon: keyof typeof Ionicons.glyphMap;
  /** Drawn after the glyph; absent where the glyph says it alone. */
  text?: string;
  /** What VoiceOver says for the mark. */
  label: string;
};

/** The photograph: 16:9 of a 349pt card is 196; 168 keeps the title and
 *  the heart of the first card on a 393 × 852 screen with a head above
 *  it (drawn to scale, not measured on a phone). */
const PHOTO_H = 168;
/** The figure a private list kept, at the size the heart is drawn at
 *  (`LikeHeart`, the `card` tone). */
const HEART = ICON.action;
/** The mark's glyph: 13, a cap's height beside the time's 13pt type. */
const MARK = ICON.meta;

/** The copy button's part on a card: how many people copied the list,
 *  whether the reader has a copy, what VoiceOver says, and the press. */
export type CardCopy = { n: number; have: boolean; label: string; onPress: () => void };

/** The copy button in the foot, drawn as the comments are, filled in the
 *  accent once the reader has a copy — a state they made, as the heart. */
function CopyFoot({ copy }: { copy: CardCopy }) {
  return (
    <PressableScale
      onPress={copy.onPress}
      haptic="selection"
      scaleTo={0.82}
      contentStyle={s.heart}
      hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
      accessibilityRole="button"
      accessibilityLabel={copy.label}
      testID="activity-copy"
    >
      <Glyph name={copy.have ? 'duplicate' : 'duplicate-outline'} size={HEART} color={copy.have ? colors.accent : colors.textSecondary} />
      {copy.n > 0 ? <Text style={s.count} testID="activity-copy-count">{copy.n}</Text> : null}
    </PressableScale>
  );
}

export default function ActivityCard({
  face, who, did, when, mark, title, uri, meta, desc, liked, likes, onOpen, onHeart, comments, onComments, commentsOff, copy, testID,
}: {
  /** Whose face, as `Avatar` takes it. */
  face?: string | null;
  /** Their name, and what they did, as the rest of the sentence — with
   *  its own leading space where the language wants one. */
  who: string;
  did: string;
  /** How long ago, already in words; absent when nothing says. */
  when?: string;
  /** Who can see it, when that is not everybody. */
  mark?: ActivityMark | null;
  title: string;
  uri?: string;
  meta: string;
  desc?: string | null;
  liked: boolean;
  likes: number;
  onOpen: () => void;
  /** Absent on a collection nobody may like — then no heart is drawn. */
  onHeart?: () => void;
  /** What the thread holds, when anything. Only the count is drawn
   *  (owner, 18 Nov 2026): for a day the two newest stood under the foot
   *  as well, a line each, and on a phone they read as two stray words
   *  — "trang Thanks" — that made one card taller than its neighbours
   *  and said nothing the bubble's figure had not. The thread is a press
   *  away. Absent for a thread with nothing in it, which draws the way
   *  in and no figure. */
  comments?: Pick<Preview, 'n'>;
  /** Opens the thread. Absent where there is none to open — the switch
   *  off, or a collection that is not public — and then nothing about
   *  comments is drawn at all. Only ever handed in beside `onHeart`: a
   *  thread and a heart are both a public collection's. */
  onComments?: () => void;
  /** The thread is closed and has nothing in it: the bubble is drawn
   *  dimmed and opens nothing — there is nothing to read and nothing may
   *  be written. (A closed thread with comments still opens.) */
  commentsOff?: boolean;
  /** The copy button, after the comments (owner, 20 Nov 2026) —
   *  `components/CopyCount`. Only beside `onHeart`, as the comments are:
   *  a public collection's. */
  copy?: CardCopy;
  testID?: string;
}) {
  const { t } = useI18n();
  const n = comments?.n ?? 0;
  return (
    <Card testID={testID}>
      <View style={s.head}>
        <Avatar url={face} size={FACE} />
        <View style={s.headWords}>
          <Text style={s.line} numberOfLines={2} testID="activity-line">
            <Text style={s.who}>{who}</Text>{did}
          </Text>
          <View style={s.under}>
            {when ? <Text style={s.when} numberOfLines={1} testID="activity-when">{when}</Text> : null}
            {mark ? (
              <View style={s.mark} accessible accessibilityLabel={mark.label} testID="activity-mark">
                {when ? <Text style={s.when}>·</Text> : null}
                <Glyph name={mark.icon} size={MARK} color={colors.textTertiary} />
                {mark.text ? <Text style={s.when} numberOfLines={1}>{mark.text}</Text> : null}
              </View>
            ) : null}
          </View>
        </View>
      </View>
      <PressableScale
        onPress={onOpen}
        haptic="selection"
        scaleTo={0.985}
        accessibilityRole="button"
        accessibilityLabel={[title, meta].join(', ')}
        testID="activity-open"
      >
        {uri
          // `memory-disk`, where `expo-image` defaults to `disk`: a feed
          // prefetches the covers it is about to draw into memory, and a
          // card must read from where they were put (`Avatar` has the
          // same reason).
          ? <Image source={{ uri }} style={s.photo} contentFit="cover" transition={160} cachePolicy="memory-disk" />
          : <View style={[s.photo, s.tint]} testID="activity-tint" />}
        <View style={s.words}>
          <Text style={s.title} numberOfLines={2}>{title}</Text>
          <Text style={s.meta} numberOfLines={1}>{meta}</Text>
          {desc ? <Text style={s.desc} numberOfLines={2} testID="activity-desc">{desc}</Text> : null}
        </View>
      </PressableScale>
      {onHeart ? (
        <View style={s.foot}>
          <LikeHeart
            liked={liked}
            count={likes}
            onPress={onHeart}
            contentStyle={s.heart}
            countStyle={s.count}
            hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
            testID="activity-heart"
            countTestID="activity-likes"
          />
          {onComments || commentsOff ? (
            <PressableScale
              onPress={commentsOff ? undefined : onComments}
              disabled={commentsOff}
              haptic="selection"
              scaleTo={0.82}
              // Dimmed, not gone — `CommentRow` has the reason.
              contentStyle={commentsOff ? [s.heart, s.off] : s.heart}
              hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
              accessibilityRole="button"
              accessibilityLabel={n === 1
                ? t('1 comment', '1 bình luận', 'コメント1件', '1 条评论', '1 條評論')
                : n > 1
                  ? t(`${n} comments`, `${n} bình luận`, `コメント${n}件`, `${n} 条评论`, `${n} 條評論`)
                  : t('Comments', 'Bình luận', 'コメント', '评论', '評論')}
              testID="activity-comments"
            >
              <Glyph name="chatbubble-outline" size={HEART} color={colors.textSecondary} />
              {n > 0 ? <Text style={s.count} testID="activity-comments-count">{n}</Text> : null}
            </PressableScale>
          ) : null}
          {copy ? <CopyFoot copy={copy} /> : null}
        </View>
      ) : likesWorthShowing(likes) ? (
        <View
          style={[s.foot, s.heart]}
          accessible
          accessibilityLabel={likes === 1
            ? t('1 like', '1 lượt thích', '1件のいいね', '1 个赞', '1 個讚')
            : t(`${likes} likes`, `${likes} lượt thích`, `${likes}件のいいね`, `${likes} 个赞`, `${likes} 個讚`)}
          testID="activity-likes-kept"
        >
          <Glyph name="heart-outline" size={HEART} color={colors.textTertiary} />
          <Text style={[s.count, s.kept]}>{likes}</Text>
        </View>
      ) : <View style={s.noFoot} testID="activity-no-heart" />}
    </Card>
  );
}

const s = StyleSheet.create({
  off: { opacity: 0.35 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: space.cardPadding, paddingBottom: 12 },
  headWords: { flex: 1 },
  line: { color: colors.textSecondary, fontSize: 15, lineHeight: 20 },
  who: { color: colors.text, fontWeight: font.semibold },
  when: { color: colors.textTertiary, fontSize: 13, lineHeight: 17 },
  // The time and the mark on one line; the mark's dot, glyph and word 4
  // apart, as the collection's byline sets its own.
  under: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mark: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  kept: { color: colors.textTertiary },
  // Where the heart's row would be: the card's padding under its words.
  noFoot: { height: space.cardPadding },
  photo: { width: '100%', height: PHOTO_H },
  // The accent's tint: a collection with no photograph to wear.
  tint: { backgroundColor: colors.accentSoft },
  words: { paddingHorizontal: space.cardPadding, paddingTop: 12, gap: 4 },
  title: { color: colors.text, fontSize: 17, fontWeight: font.semibold, lineHeight: 22 },
  meta: { color: colors.textTertiary, fontSize: 13, lineHeight: 18 },
  desc: { color: colors.textSecondary, ...type.meta, lineHeight: 20, marginTop: 2 },
  // The heart's row: 44 tall, the heart at the words' edge.
  // 18 between the heart and the bubble: with each one's 6 to its own
  // figure, the two read as two things and not as one row of four.
  foot: { flexDirection: 'row', alignItems: 'center', gap: 18, minHeight: 44, paddingHorizontal: space.cardPadding },
  heart: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  count: { color: colors.textSecondary, fontSize: 14, fontWeight: font.medium, fontVariant: ['tabular-nums'] },
});
