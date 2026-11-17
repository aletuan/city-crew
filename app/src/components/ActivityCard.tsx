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

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Glyph } from './ui/glyph';
import { PressableScale } from './ui/controls';
import { Avatar, Card } from './ui/surfaces';
import { useI18n } from '../lib/i18n';
import { likesWorthShowing } from '../lib/likes';
import { colors, font, space, type } from '../theme';

/** The face beside the reason: a line of the reason and a line of the
 *  time is 20 + 17, and the face is their height. */
const FACE = 36;
/** The photograph: 16:9 of a 349pt card is 196; 168 keeps the title and
 *  the heart of the first card on a 393 × 852 screen with a head above
 *  it (drawn to scale, not measured on a phone). */
const PHOTO_H = 168;

export default function ActivityCard({
  face, who, did, when, title, uri, meta, desc, liked, likes, onOpen, onHeart, testID,
}: {
  /** Whose face, as `Avatar` takes it. */
  face?: string | null;
  /** Their name, and what they did, as the rest of the sentence — with
   *  its own leading space where the language wants one. */
  who: string;
  did: string;
  /** How long ago, already in words; absent when nothing says. */
  when?: string;
  title: string;
  uri?: string;
  meta: string;
  desc?: string | null;
  liked: boolean;
  likes: number;
  onOpen: () => void;
  /** Absent on a collection nobody may like — then no heart is drawn. */
  onHeart?: () => void;
  testID?: string;
}) {
  const { t } = useI18n();
  return (
    <Card testID={testID}>
      <View style={s.head}>
        <Avatar url={face} size={FACE} />
        <View style={s.headWords}>
          <Text style={s.line} numberOfLines={2} testID="activity-line">
            <Text style={s.who}>{who}</Text>{did}
          </Text>
          {when ? <Text style={s.when} numberOfLines={1} testID="activity-when">{when}</Text> : null}
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
          <PressableScale
            contentStyle={s.heart}
            scaleTo={0.82}
            haptic="none"
            hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
            onPress={onHeart}
            accessibilityRole="button"
            accessibilityState={{ selected: liked }}
            accessibilityLabel={liked
              ? t('Unlike this collection', 'Bỏ thích bộ sưu tập này', 'いいねを取り消す', '取消点赞这个合集', '取消按讚這個合集')
              : t('Like this collection', 'Thích bộ sưu tập này', 'このコレクションにいいね', '点赞这个合集', '按讚這個合集')}
            testID="activity-heart"
          >
            <Glyph name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? colors.bad : colors.textSecondary} />
            {/* The tally from one like up, as everywhere (`likesWorthShowing`). */}
            {likesWorthShowing(likes) ? <Text style={s.count} testID="activity-likes">{likes}</Text> : null}
          </PressableScale>
        </View>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: space.cardPadding, paddingBottom: 12 },
  headWords: { flex: 1 },
  line: { color: colors.textSecondary, fontSize: 15, lineHeight: 20 },
  who: { color: colors.text, fontWeight: font.semibold },
  when: { color: colors.textTertiary, fontSize: 13, lineHeight: 17 },
  photo: { width: '100%', height: PHOTO_H },
  // The accent's tint: a collection with no photograph to wear.
  tint: { backgroundColor: colors.accentSoft },
  words: { paddingHorizontal: space.cardPadding, paddingTop: 12, gap: 4 },
  title: { color: colors.text, fontSize: 17, fontWeight: font.semibold, lineHeight: 22 },
  meta: { color: colors.textTertiary, fontSize: 13, lineHeight: 18 },
  desc: { color: colors.textSecondary, ...type.meta, lineHeight: 20, marginTop: 2 },
  // The heart's row: 44 tall, the heart at the words' edge.
  foot: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: space.cardPadding },
  heart: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  count: { color: colors.textSecondary, fontSize: 14, fontWeight: font.medium, fontVariant: ['tabular-nums'] },
});
