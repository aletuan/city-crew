// "Hoạt động nổi bật" — where people checked in this week in the city,
// under the community's collections (owner, 26 Nov 2026). The server
// chooses and orders them (`20261126210000_highlights_by_place.sql`):
// public visits with a photo, the last seven days, a card a place,
// today's first, then the places more people went to.
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
// One visit's photo, full bleed, as the collection cards above it are —
// one shelf's shape over another's, so the two read as one page. The
// place's name; what the visitor wrote, two lines at most; then who
// went. The words are what a check-in has that a collection's card has
// not — a person saying something about a place — and a card without
// them is simply shorter, not a gap.
//
// Two people or more and the card says so twice: their faces overlapped
// at the foot, and "2 người đã ghé" in the corner `NewBadge` uses on the
// shelf above, in the same cream. People, not visits: one regular going
// daily is one, and it is the figure a place's owner reads.
//
// The heart is the shown visit's; the count beside it is the place's
// week. "This week" at the heading's end is the only time the section
// gives: never the hour, never "2 minutes ago" — a public visit says
// where a person was, and a shelf that said when to the minute would
// say where they still are.
//
// A press opens the place, not the person: somebody on Explore is
// choosing where to go, and the place's page carries these visits in
// its "Đánh giá từ khách".
//
// ── who asks ──
//
// The read is `useHighlights`, called by Explore and handed down, not
// made in here. Made in here, nothing outside could ask it again: a pull
// on Explore reloaded the catalog and left this shelf as it was, and
// coming back to the app never asked it at all — so a city that reached
// three people during the day showed nothing until the app was killed
// and opened again (owner, 26 Nov 2026, on a phone). Explore owns the
// pull, so Explore owns the read; the return to the app is the same
// two-minute rule every list the app holds keeps (`lib/stale`).

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
import { fetchHighlightCheckins, likeCheckin, useFetch, type Fetch, type HighlightCheckin } from '../../lib/data';
import { atHandle } from '../../lib/handle';
import { useI18n } from '../../lib/i18n';
import { localized } from '../../lib/localized';
import { shelfRatio } from '../../lib/shelfCard';
import { useRefreshOnForeground } from '../../lib/useRefreshOnForeground';
import { colors, coverScrim, font, onPhoto, space } from '../../theme';
import { type Nav } from '../../nav';
import { s as page } from './styles';

/** Fewer than this and the section is not drawn — see the header. Three:
 *  the collection shelf above shows two cards and a sliver at every
 *  width, so three is the fewest that still scrolls. */
export const FEATURED_MIN = 3;

const NONE: HighlightCheckin[] = [];

/** A face at a card's foot. 18: the collection card's meta line is 13pt
 *  on an 18pt line, and a face taller than its line pushes the foot row
 *  down on the cards that have one. */
const FACE = 18;

/** The shelf's read: this week's cards for the reader's city, nothing
 *  signed out, asked again on a return to the app — see "who asks". */
export function useHighlights(): Fetch<HighlightCheckin[]> {
  const { city } = useCurrentCity();
  const { session } = useSession();
  const uid = session?.user?.id ?? null;
  const cityId = city?.id ?? null;
  const fetcher = useCallback(
    () => (uid && cityId ? fetchHighlightCheckins(cityId) : Promise.resolve(NONE)),
    [uid, cityId],
  );
  const read = useFetch(fetcher, NONE);
  useRefreshOnForeground(read);
  return read;
}

export function CheckinShelf({ navigation, cards }: { navigation: Nav; cards: readonly HighlightCheckin[] }) {
  const { t, lang } = useI18n();
  const linkOf = useSignedPhotos(cards.map((c) => c.photo), cards.length >= FEATURED_MIN);
  const [pressed, setPressed] = useState<Record<string, boolean>>({});

  // The collection shelf's card, so the two shelves are one page.
  const { width: winW, height: winH } = useWindowDimensions();
  const cardW = Math.round((winW - space.page) / 2.15 - space.cardGap);
  const cardH = Math.round(cardW * shelfRatio(winH));

  if (cards.length < FEATURED_MIN) return null;

  const went = (n: number) => t(`${n} people went`, `${n} người đã ghé`, `${n}人が訪問`, `${n} 人去过`, `${n} 人去過`);

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
          const who = c.full_name || atHandle(c.handle);
          return (
            <PressableScale
              key={c.id}
              contentStyle={[page.shelfCard, { width: cardW, height: cardH }]}
              onPress={() => navigation.navigate('PlaceDetail', { slug: c.place_slug })}
              accessibilityRole="button"
              accessibilityLabel={c.visitors > 1 ? `${name}, ${went(c.visitors)}` : `${name}, ${who}`}
              testID="checkin-shelf-card"
            >
              {uri
                ? <Image source={{ uri, cacheKey: c.photo.id }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgElevated }]} testID="checkin-shelf-waiting" />}
              <LinearGradient colors={coverScrim.colors} locations={coverScrim.locations} style={StyleSheet.absoluteFill} />
              {c.visitors > 1 ? (
                <View style={s.went} pointerEvents="none" testID="checkin-shelf-went">
                  <Text style={s.wentWord}>{went(c.visitors)}</Text>
                </View>
              ) : null}
              <View style={page.shelfCardText}>
                <Text style={page.shelfCardTitle} numberOfLines={1}>{name}</Text>
                {c.note ? <Text style={s.note} numberOfLines={2} testID="checkin-shelf-note">{c.note}</Text> : null}
                <View style={page.shelfCardFoot}>
                  <View style={s.who}>
                    <View style={s.faces}>
                      {c.faces.map((f, i) => (
                        <View key={f.handle} style={i > 0 ? s.faceNext : null} testID="checkin-shelf-face">
                          <Avatar url={f.avatar_url} size={FACE} />
                        </View>
                      ))}
                    </View>
                    <Text style={[page.shelfCardMeta, s.whoName]} numberOfLines={1}>
                      {c.visitors > 1 ? `${who} +${c.visitors - 1}` : who}
                    </Text>
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
  faces: { flexDirection: 'row' },
  // A third of a face under the one before: three read as a group in
  // the width of two, and each is still a face.
  faceNext: { marginLeft: -6 },
  // The visitor's words: the meta's size in the title's ink, so they
  // read as said rather than as a caption.
  note: { color: onPhoto.text, fontSize: 13, lineHeight: 17, fontWeight: font.regular },
  // `NewBadge`'s corner, ground and ink, for the same reason: opaque, so
  // it reads on any photograph in either theme.
  went: {
    position: 'absolute', top: 10, left: 10,
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999,
    backgroundColor: colors.surfaceCard,
  },
  wentWord: { color: colors.text, fontSize: 12, lineHeight: 16, fontWeight: font.semibold },
  whoName: { flexShrink: 1, color: onPhoto.textSecondary },
});
