// What a person has shared, on their page: what they did, newest first —
// and, a tap away, every collection they made.
//
// ── activity, where the grid was (owner, 17 Nov 2026) ──
//
// The page ended in a grid of the person's public collections, two to a
// row. It is a feed now, one card a collection (`ActivityCard`), each
// headed by what the person did and when. The plan this is the first
// step of is `docs/collection-feed-plan.md`: the page,
// and after it the community's collections, turn into a feed in which a
// collection is the thing every interaction hangs on.
//
// One thing a person can have done, for now: created a collection. So
// today the feed is the grid's own collections in the grid's own order,
// each a card the width of the page with its description and a heart. It
// needs no new table — a collection's `created_at` and its likes were
// already here — and that is why it is the first step.
//
// ── the grid is not gone ──
//
// A feed is for reading and a grid is for finding. One curator has 24
// public collections; at a card each that is some 8,000pt of scrolling
// to reach the oldest, where the grid shows six to a screen. So the
// section's heading carries a count on its right — "24 collections" —
// and pressing it turns the section into the grid, with "Activity" there
// to turn it back. The grid is the one that was here, tiles and all.
//
// ── five at a time ──
//
// The feed draws `PAGE` cards and a "Show more" under them, which adds
// `PAGE` more. Every card is a photograph the page's width, and the
// screen is a scroll view, not a list that recycles: all 24 at once is
// 24 decodes for a reader who came to see who this is.
//
// ── the heart ──
//
// The collection's own like, wired as the shelf wires it: signed out,
// the tap is the invitation to sign in; signed in, the provider owns the
// write and the optimistic count, so a like made here shows everywhere.
// A row from a launch cache with no id cannot be liked and draws none.

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import ActivityCard from '../../components/ActivityCard';
import { Glyph } from '../../components/ui/glyph';
import { Card, fireHaptic, PressableScale } from '../../components/ui';
import { agoLabel } from '../../lib/ago';
import { useLikes } from '../../lib/catalog';
import type { Collection, FriendProfile } from '../../lib/data';
import { atHandle } from '../../lib/handle';
import { useI18n } from '../../lib/i18n';
import { localized } from '../../lib/localized';
import { useSaveActions } from '../../lib/save';
import { colors, font, space, type } from '../../theme';

/** How many cards the feed draws at first, and adds at each "Show more". */
export const PAGE = 5;
/** A tile's photograph: the height the grid has always had. */
const TILE_PHOTO_H = 108;

export default function Shared({ me, person, lists, coverFor, onOpen }: {
  me: string | null;
  person: FriendProfile;
  /** Their public collections, newest first (`person.listsBy`). */
  lists: Collection[];
  coverFor: (c: Collection) => string | undefined;
  onOpen: (c: Collection) => void;
}) {
  const { t, lang } = useI18n();
  const { likes, myLikes, toggleLike } = useLikes();
  const { askToSignIn } = useSaveActions();
  const [all, setAll] = useState(false);
  const [shown, setShown] = useState(PAGE);

  const placesWord = (n: number) => (n === 1
    ? t('1 place', '1 địa điểm', '1か所', '1 个地点', '1 個地點')
    : t(`${n} places`, `${n} địa điểm`, `${n}か所`, `${n} 个地点`, `${n} 個地點`));
  const likesWord = (n: number) => (n === 1
    ? t('1 like', '1 lượt thích', 'いいね1件', '1 个赞', '1 個讚')
    : t(`${n} likes`, `${n} lượt thích`, `いいね${n}件`, `${n} 个赞`, `${n} 個讚`));
  const listsWord = (n: number) => (n === 1
    ? t('1 collection', '1 bộ sưu tập', 'コレクション1件', '1 个合集', '1 個合集')
    : t(`${n} collections`, `${n} bộ sưu tập`, `コレクション${n}件`, `${n} 个合集`, `${n} 個合集`));

  const heart = (c: Collection) => {
    if (!me) { askToSignIn('like'); return; }
    fireHaptic('light');
    void toggleLike({ id: c.id as string, slug: c.slug });
  };

  const none = lists.length === 0;
  return (
    <>
      <View style={s.heading}>
        <Text style={s.label}>
          {all
            ? t('Collections', 'Bộ sưu tập', 'コレクション', '合集', '合集')
            : t('Activity', 'Hoạt động', 'アクティビティ', '动态', '動態')}
        </Text>
        {none ? null : (
          <PressableScale
            onPress={() => setAll((v) => !v)}
            haptic="selection"
            contentStyle={s.turn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            testID="person-turn"
          >
            <Text style={s.turnText}>
              {all ? t('Activity', 'Hoạt động', 'アクティビティ', '动态', '動態') : listsWord(lists.length)}
            </Text>
            <Glyph name="chevron-forward" size={13} color={colors.accent} />
          </PressableScale>
        )}
      </View>
      {none ? (
        <Card style={s.none} testID="person-no-lists">
          <Text style={s.noneTitle}>
            {t('No public collections yet', 'Chưa có bộ sưu tập công khai', '公開コレクションはまだありません', '还没有公开的合集', '還沒有公開的合集')}
          </Text>
          <Text style={s.noneBody}>
            {t(
              'When they share a collection, it will show here.',
              'Khi họ chia sẻ một bộ sưu tập, nó sẽ hiện ở đây.',
              'コレクションが公開されると、ここに表示されます。',
              '对方分享合集后，会显示在这里。', '對方分享合集後，會顯示在這裡。',
            )}
          </Text>
        </Card>
      ) : all ? (
        <Grid
          lists={lists}
          coverFor={coverFor}
          onOpen={onOpen}
          metaOf={(c) => {
            const liked = likes[c.slug] ?? 0;
            return [placesWord(c.collection_places.length), liked > 0 ? likesWord(liked) : ''].filter(Boolean).join(' · ');
          }}
          titleOf={(c) => localized(c, 'title', lang)}
        />
      ) : (
        <View style={s.feed} testID="person-activity">
          {lists.slice(0, shown).map((c) => (
            <ActivityCard
              key={c.slug}
              testID="person-act"
              face={person.avatar_url}
              who={person.full_name || atHandle(person.handle)}
              did={t(' created a collection', ' đã tạo bộ sưu tập', 'さんがコレクションを作成', ' 创建了合集', ' 建立了合集')}
              when={c.created_at ? agoLabel(c.created_at, Date.now(), lang, t) : undefined}
              title={localized(c, 'title', lang)}
              uri={coverFor(c)}
              meta={placesWord(c.collection_places.length)}
              desc={localized(c, 'desc', lang)}
              liked={!!c.id && myLikes.includes(c.id)}
              likes={likes[c.slug] ?? 0}
              onOpen={() => onOpen(c)}
              onHeart={c.id ? () => heart(c) : undefined}
            />
          ))}
          {lists.length > shown ? (
            <PressableScale
              onPress={() => setShown((n) => n + PAGE)}
              haptic="selection"
              contentStyle={s.more}
              accessibilityRole="button"
              testID="person-show-more"
            >
              <Text style={s.moreText}>{t('Show more', 'Xem thêm', 'もっと見る', '查看更多', '檢視更多')}</Text>
            </PressableScale>
          ) : null}
        </View>
      )}
    </>
  );
}

/** Every collection they made, two to a row — the grid the page ended
 *  in until 17 Nov 2026. Pairs rather than a wrapping row: a wrapping
 *  row needs a width, and the width is the screen's. */
function Grid({ lists, coverFor, onOpen, metaOf, titleOf }: {
  lists: Collection[];
  coverFor: (c: Collection) => string | undefined;
  onOpen: (c: Collection) => void;
  metaOf: (c: Collection) => string;
  titleOf: (c: Collection) => string;
}) {
  const rows: Collection[][] = [];
  for (let i = 0; i < lists.length; i += 2) rows.push(lists.slice(i, i + 2));
  return (
    <View style={s.grid} testID="person-grid">
      {rows.map((pair) => (
        <View key={pair[0].slug} style={s.gridRow}>
          {pair.map((c) => (
            <ListTile key={c.slug} title={titleOf(c)} uri={coverFor(c)} meta={metaOf(c)} onPress={() => onOpen(c)} />
          ))}
          {pair.length === 1 ? <View style={s.tileSlot} /> : null}
        </View>
      ))}
    </View>
  );
}

/** One of their lists: its photograph, its title, and how much is on
 *  it. A tile with no photograph wears the tint, as the cover does. */
function ListTile({ title, uri, meta, onPress }: {
  title: string; uri: string | undefined; meta: string; onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      style={s.tileSlot}
      accessibilityRole="button"
      accessibilityLabel={[title, meta].join(', ')}
      testID="person-list"
    >
      <Card>
        {uri
          ? <Image source={{ uri }} style={s.tilePhoto} contentFit="cover" transition={160} />
          : <View style={[s.tilePhoto, s.tint]} />}
        <View style={s.tileWords}>
          <Text style={s.tileTitle} numberOfLines={2}>{title}</Text>
          <Text style={s.tileMeta} numberOfLines={1}>{meta}</Text>
        </View>
      </Card>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  // The accent's tint: a tile with no photograph to wear.
  tint: { backgroundColor: colors.accentSoft },
  // The section's heading: its label in the small capitals the place
  // page heads a fact with, and the way to the other view on its right.
  heading: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 22, marginBottom: 10,
  },
  label: {
    color: colors.textTertiary, fontSize: 12, fontWeight: font.semibold,
    textTransform: 'uppercase', letterSpacing: 1.2,
  },
  turn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  turnText: { color: colors.accent, fontSize: 13, fontWeight: font.semibold },
  feed: { gap: space.cardGap },
  more: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  moreText: { color: colors.accent, fontSize: 14, fontWeight: font.semibold },
  grid: { gap: space.cardGap },
  gridRow: { flexDirection: 'row', gap: space.cardGap },
  tileSlot: { flex: 1 },
  tilePhoto: { width: '100%', height: TILE_PHOTO_H },
  tileWords: { padding: 12, gap: 6 },
  tileTitle: { color: colors.text, fontSize: 15, fontWeight: font.semibold, lineHeight: 20 },
  tileMeta: { color: colors.textTertiary, fontSize: 13 },
  none: { padding: space.cardPadding, gap: 6 },
  noneTitle: { color: colors.text, fontSize: 15, fontWeight: font.semibold },
  noneBody: { color: colors.textSecondary, ...type.meta },
});
