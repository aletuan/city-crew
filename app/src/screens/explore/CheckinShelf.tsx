// "Hoạt động nổi bật" — this week's check-ins in the city, under the
// community's collections (owner, 26 Nov 2026). The server chooses and
// orders them (`20261126150000_explore_highlights.sql`): public, with a
// photo, the last seven days, one a person, hearts then newest.
//
// ── when it is drawn ──
//
// Only with `FEATURED_MIN` cards or more. Two cards under a shelf of ten
// collections read as a quiet app, which is the opposite of what the
// shelf is for; under that the whole section — heading included — is
// not drawn. Signed out, never: the server answers a reader it knows,
// and a guest is not one (a stranger's visit is for people signed in,
// `20261125200000_checkin_public.sql`).
//
// ── what a card is ──
//
// The visit's photo, full bleed, as the collection cards above it are —
// one shelf's shape over another's, so the two read as one page. The
// place's name, then whose visit it was. The heart is on the card and
// the count beside it. "This week" at the heading's end is the only
// time the section gives: never the hour, never "2 minutes ago" — a
// public visit says where a person was, and a shelf that said when to
// the minute would say where they still are.
//
// A press opens the place, not the person: somebody on Explore is
// choosing where to go, and the place's page carries this visit in its
// "Đánh giá từ khách" when it has a note to go with the photo.

import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import LikeHeart from '../../components/LikeHeart';
import { fireHaptic, PressableScale } from '../../components/ui';
import { Avatar } from '../../components/ui/surfaces';
import { useSignedPhotos } from '../../components/useSignedPhotos';
import { useSession } from '../../lib/auth';
import { useCurrentCity } from '../../lib/city';
import { fetchHighlightCheckins, likeCheckin, useFetch, type HighlightCheckin } from '../../lib/data';
import { atHandle } from '../../lib/handle';
import { useI18n } from '../../lib/i18n';
import { localized } from '../../lib/localized';
import { shelfRatio } from '../../lib/shelfCard';
import { colors, coverScrim, font, onPhoto, space } from '../../theme';
import { type Nav } from '../../nav';
import { s as page } from './styles';

/** Fewer than this and the section is not drawn — see the header. Three:
 *  the collection shelf above shows two cards and a sliver at every
 *  width, so three is the fewest that still scrolls. */
export const FEATURED_MIN = 3;

const NONE: HighlightCheckin[] = [];

export function CheckinShelf({ navigation }: { navigation: Nav }) {
  const { t, lang } = useI18n();
  const { city } = useCurrentCity();
  const { session } = useSession();
  const uid = session?.user?.id ?? null;
  const cityId = city?.id ?? null;
  const fetcher = useCallback(
    () => (uid && cityId ? fetchHighlightCheckins(cityId) : Promise.resolve(NONE)),
    [uid, cityId],
  );
  const read = useFetch(fetcher, NONE);
  const cards = read.data;
  const linkOf = useSignedPhotos(cards.map((c) => c.photo), cards.length >= FEATURED_MIN);
  const [pressed, setPressed] = useState<Record<string, boolean>>({});

  // The collection shelf's card, so the two shelves are one page.
  const { width: winW, height: winH } = useWindowDimensions();
  const cardW = Math.round((winW - space.page) / 2.15 - space.cardGap);
  const cardH = Math.round(cardW * shelfRatio(winH));

  if (cards.length < FEATURED_MIN) return null;

  const heart = (c: HighlightCheckin) => {
    const was = pressed[c.id] ?? c.liked;
    fireHaptic('light');
    setPressed((p) => ({ ...p, [c.id]: !was }));
    likeCheckin(c.id, !was).catch(() => setPressed((p) => ({ ...p, [c.id]: was })));
  };

  return (
    <View style={{ marginBottom: space.titleToContent }} testID="checkin-shelf">
      <View style={page.shelfHeader}>
        <Text style={page.section}>{t('Featured check-ins', 'Hoạt động nổi bật', '注目のチェックイン', '精选动态', '精選動態')}</Text>
        <Text style={s.week}>{t('This week', 'Tuần này', '今週', '本周', '本週')}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardW + space.cardGap}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: space.page, gap: space.cardGap }}
      >
        {cards.map((c) => {
          const uri = linkOf(c.photo);
          const liked = pressed[c.id] ?? c.liked;
          const name = localized(c.place, 'name', lang);
          return (
            <PressableScale
              key={c.id}
              contentStyle={[page.shelfCard, { width: cardW, height: cardH }]}
              onPress={() => navigation.navigate('PlaceDetail', { slug: c.place_slug })}
              accessibilityRole="button"
              accessibilityLabel={`${name}, ${c.full_name || atHandle(c.handle)}`}
              testID="checkin-shelf-card"
            >
              {uri
                ? <Image source={{ uri, cacheKey: c.photo.id }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgElevated }]} testID="checkin-shelf-waiting" />}
              <LinearGradient colors={coverScrim.colors} locations={coverScrim.locations} style={StyleSheet.absoluteFill} />
              <View style={page.shelfCardText}>
                <Text style={page.shelfCardTitle} numberOfLines={1}>{name}</Text>
                <View style={page.shelfCardFoot}>
                  <View style={s.who}>
                    <Avatar url={c.avatar_url} size={18} />
                    <Text style={[page.shelfCardMeta, s.whoName]} numberOfLines={1}>{c.full_name || atHandle(c.handle)}</Text>
                  </View>
                  <LikeHeart
                    tone="photo"
                    liked={liked}
                    count={c.likes + (liked === c.liked ? 0 : liked ? 1 : -1)}
                    onPress={() => heart(c)}
                    style={page.shelfLikeHit}
                    contentStyle={page.shelfLikes}
                    countStyle={page.shelfCardMeta}
                    hitSlop={{ top: 14, bottom: 14, left: 16, right: 12 }}
                    testID="checkin-shelf-heart"
                    countTestID="checkin-shelf-likes"
                  />
                </View>
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  // Where the collection shelf puts "See all", in the meta's quiet ink:
  // a fact about the shelf, not a way somewhere.
  week: { color: colors.textTertiary, fontSize: 14, fontWeight: font.medium },
  who: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  whoName: { flexShrink: 1, color: onPhoto.textSecondary },
});
