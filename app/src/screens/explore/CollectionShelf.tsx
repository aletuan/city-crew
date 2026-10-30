// Explore's shelf of community collections.
//
// A card is its cover, its title, its count and its heart — what the
// Collections tab's card shows, and nothing more (owner, 24 Oct 2026).
// It used to wear a category badge in its top corner: the kind its
// members shared most, as a glyph in that kind's colour. Removed, not
// moved. The same list wore a mark on Explore and none on the
// Collections tab, so the reader was left asking what the mark was for;
// and one glyph cannot say what a mixed list holds — five places to eat
// and four cafés came out as a fork and knife. The cover and the title
// already say what the list is. Screen readers never heard the badge,
// so nothing was lost for them.
//
// The corner it left holds `NewBadge` now (owner, 29 Oct 2026), on a
// list made this week. That one does not have the old badge's trouble:
// it is the same word on every screen a list is drawn on, Collections
// included, and it says one thing a cover cannot.

import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fireHaptic, PressableScale, Skeleton } from '../../components/ui';
import { useCurrentCity } from '../../lib/city';
import { Collection, coverUriOf, membersOf, touchesCity } from '../../lib/data';
import { useCollections, useLikes, usePlaces } from '../../lib/catalog';
import { useSession } from '../../lib/auth';
import { useSaveActions } from '../../lib/save';
import { likesWorthShowing, rankByLikes } from '../../lib/likes';
import { isNewList } from '../../lib/newest';
import NewBadge from '../../components/NewBadge';
import { useI18n } from '../../lib/i18n';
import { colors, coverScrim, onPhoto, space } from '../../theme';
import { type Nav } from '../../nav';
import { s } from './styles';

export function CollectionShelf({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { city } = useCurrentCity();
  const cols = useCollections();
  const { likes, rankLikes, myLikes, toggleLike } = useLikes();
  const { session, userId: reader } = useSession();
  const uid = session?.user?.id;
  const { askToSignIn } = useSaveActions();

  // Signed out, the tap is an invitation rather than a failure: the same
  // sheet the bookmark opens, because "sign in to keep this" is the same
  // sentence whether the thing kept is a place or a list.
  //
  // Signed in, everything else belongs to the provider — the write, the
  // refetch, and the local answer that fills the heart before either has
  // finished. This screen and the collection's own had a copy each and
  // the copies had already drifted; worse, a like made here did not show
  // there until a refetch happened to land.
  const onHeart = useCallback((c: Collection) => {
    if (!c.id) return;
    if (!uid) { askToSignIn('like'); return; }
    fireHaptic('light');
    void toggleLike({ id: c.id, slug: c.slug });
  }, [uid, toggleLike, askToSignIn]);
  const { data: places, loaded: placesLoaded } = usePlaces();
  // `loaded`, not `loading` — hydrated data shows while its background
  // refresh is still in flight; see the note in the screen body below.
  const holding = !cols.loaded || !placesLoaded;
  // Only collections with at least one visible member in this city — an
  // empty collection is a dead end for a browsing guest, and one whose
  // places are all somewhere else is a shelf entry for a different trip.
  // Most liked first, and the shelf's old order underneath it — see
  // `rankByLikes`. While every count is zero, which is the state this
  // ships in, the result is byte-for-byte the shelf that was here before.
  // By everybody's likes but the owner's own — `rankLikes`; the heart on
  // each card still prints the whole count.
  const visible = rankByLikes(
    cols.data.filter((c) => touchesCity(membersOf(c, places), city?.id)),
    rankLikes,
  );

  const coverFor = (c: Collection) => coverUriOf(c, membersOf(c, places));
  const now = Date.now();

  // The card's width comes from the screen's, and the reason is what a
  // fixed 176 did between devices: a 430pt phone showed a 28pt sliver of
  // the third card, while a 390–402pt one fitted exactly two and cut
  // nothing — a shelf that scrolls with no visible evidence that it
  // does. ~2.15 cards per viewport keeps a ~26pt sliver at every width,
  // and lands on the same 176×220 on the 430pt screens the fixed number
  // was tuned against.
  const { width: winW } = useWindowDimensions();
  const cardW = Math.round((winW - space.page) / 2.15 - space.cardGap);
  const cardH = Math.round(cardW * 1.25);

  if (!holding && visible.length === 0) return null;

  return (
    <View style={{ marginBottom: space.titleToContent }}>
      <View style={s.shelfHeader}>
        {/* The same word its "See all" lands on — the Community tab. It
            was "Public collections", which named a visibility status
            rather than a source, and stopped matching its own
            destination the day the tab got its real name. Your own
            public lists belong on it too: a public list is part of the
            community, yours included. */}
        <Text style={s.section}>{t('From the community', 'Từ cộng đồng', 'みんなのコレクション', '来自社区', '來自社群')}</Text>
        <Pressable
          // "See all" of a *public* shelf lands on the Community tab, not
          // on your library. `CollectionsHome` is the stack's first
          // screen, so no `initial: false` dance — see `goTo`.
          onPress={() => {
            fireHaptic('selection');
            navigation.getParent()?.navigate('Collections', {
              // `at` makes every tap a fresh param, so a second tap
              // re-aims a tab the reader has since switched away from.
              screen: 'CollectionsHome', params: { tab: 'community', at: Date.now() },
            });
          }}
          hitSlop={10}
        >
          <Text style={s.seeAll}>{t('See all', 'Xem tất cả', 'すべて見る', '查看全部', '檢視全部')} →</Text>
        </Pressable>
      </View>
      {holding ? (
        <View style={{ flexDirection: 'row', gap: space.cardGap, paddingHorizontal: space.page }}>
          <Skeleton style={{ width: cardW, height: cardH }} />
          <Skeleton style={{ width: cardW, height: cardH }} />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // Cards settle aligned with the page margin rather than
          // wherever momentum died; the interval is a card and its gap,
          // which is also what makes the padding the snap origin.
          snapToInterval={cardW + space.cardGap}
          snapToAlignment="start"
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: space.page, gap: space.cardGap }}
        >
          {visible.map((c) => {
            const uri = coverFor(c);
            const members = membersOf(c, places);
            const count = members.length;
            return (
              <PressableScale
                key={c.slug}
                contentStyle={[s.shelfCard, { width: cardW, height: cardH }]}
                onPress={() => navigation.navigate('CollectionDetail', { slug: c.slug })}
              >
                {uri
                  ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                  : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgElevated }]} />}
                <LinearGradient
                  colors={coverScrim.colors}
                  locations={coverScrim.locations}
                  style={StyleSheet.absoluteFill}
                  testID="shelf-card-scrim"
                />
                {isNewList(c, reader, now) ? <NewBadge /> : null}
                <View style={s.shelfCardText}>
                  {/* One line, always. A second line pushed the count down
                      on some tiles and not others, so a row of cards that
                      should read as one band came out ragged. */}
                  <Text style={s.shelfCardTitle} numberOfLines={1}>{t(c.title_en, c.title_vi, c.title_ja)}</Text>
                  <View style={s.shelfCardFoot}>
                    {/* English is the only of the three that inflects. */}
                    <Text style={s.shelfCardMeta}>{count} {t(count === 1 ? 'place' : 'places', 'địa điểm', 'スポット', '个地点', '個地點')}</Text>
                    {/* One heart, and it is both the gesture and the
                        tally.

                        There were two: a 30pt disc in the photograph's
                        top corner that you could press, and a small mark
                        down here that only counted. Two hearts on one
                        card is one heart too many — the reader has to
                        work out which of them is theirs — and the
                        counting one sat next to a number it looked like
                        it was labelling rather than a state it could
                        change. Merged, the shape says both things at
                        once: outline is a list you have not liked, coral
                        filled is one you have, and the figure beside it
                        is how many people agree.

                        The tally still only prints from one, per
                        `likesWorthShowing` — a `0` reads as "nobody liked
                        this" rather than "no votes yet". The heart draws
                        bare below that, which is exactly when it is most
                        obviously an invitation.

                        Pushed to the card's right edge, away from the
                        places count, so the two facts do not read as one
                        phrase and the thumb has a corner rather than the
                        middle of a line. `hitSlop` takes the target past
                        44pt without a disc: the glyph can stay small
                        because the touchable does not have to.

                        Pressable for everyone, the curator included
                        (owner, 17 Oct 2026). Until then your own list
                        wore a dimmed, inert heart, because the database
                        refused a curator's like; it takes it now, as
                        every other social app does, and keeps the vote
                        out of the order instead — the shelf sorts by
                        `rankLikes`, which leaves the owner's like out.
                        The collection's own screen and the Collections
                        grid draw the same heart by the same rule. */}
                    {c.id ? (
                      <PressableScale
                        style={s.shelfLikeHit}
                        contentStyle={s.shelfLikes}
                        scaleTo={0.82}
                        haptic="none"
                        hitSlop={{ top: 14, bottom: 14, left: 16, right: 12 }}
                        onPress={() => onHeart(c)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: myLikes.includes(c.id) }}
                        accessibilityLabel={myLikes.includes(c.id)
                          ? t('Unlike this collection', 'Bỏ thích bộ sưu tập này', 'いいねを取り消す', '取消点赞这个合集', '取消按讚這個合集')
                          : t('Like this collection', 'Thích bộ sưu tập này', 'このコレクションにいいね', '点赞这个合集', '按讚這個合集')}
                      >
                        <Ionicons
                          name={myLikes.includes(c.id) ? 'heart' : 'heart-outline'}
                          size={15}
                          color={myLikes.includes(c.id) ? onPhoto.accent : onPhoto.text}
                        />
                        {likesWorthShowing(likes[c.slug]) && (
                          <Text style={s.shelfCardMeta}>{likes[c.slug]}</Text>
                        )}
                      </PressableScale>
                    ) : null}
                  </View>
                </View>
              </PressableScale>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
