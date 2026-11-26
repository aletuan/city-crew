// "Hoạt động nổi bật" — where people checked in this week in the city,
// under the community's collections (owner, 26 Nov 2026). The server
// chooses and orders them (`20261126210000_highlights_by_place.sql`,
// and whose words a card carries `20261126220000_highlights_card_words`):
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
// The photo on top, with only the place's name over its foot; under it,
// on the card's own paper, who went and the heart, then what the visitor
// wrote — two lines at most. The final card of 26 Nov 2026,
// chosen by the owner from four (words over the photo, words under it,
// one quoted line, words fading in), after a day of the first on a
// phone: two lines of words, a byline and a badge stacked on a picture
// left the top third of it to look at, and the cut line read as a
// sentence dropped halfway.
//
// Under, not over: the words are what a check-in has that a collection's
// card has not, and on paper they read at the body's contrast with no
// dark laid on the photograph to carry them. One quoted line was
// weighed and lost — a Vietnamese sentence rarely fits the card's
// width, so it would be cut more often, not less. Fading the words in
// once the card settles was weighed and lost too: on a shelf a thumb
// flicks past they would rarely be seen, and once in they cover the
// picture all the same.
//
// The card is the collection card's height, so the two shelves end on
// one line; the paper takes what its words need and the photo the rest.
// No words, and the paper is the foot alone and the photo taller — a
// shorter strip, not an empty one. This is not the collection card's
// shape any more, and that is the other thing it says: the shelf above
// is lists, this one is people who went.
//
// ── who went, and the heart ──
//
// Over the words, not under them (owner, 27 Nov 2026, on a phone): the
// faces and the heart are the row the eye reads first under a photo —
// people went, people liked it — and the words below are read by the
// reader who stayed. Under the words they sat at the card's very foot,
// after a cut-off second line, where a glance never reached them.
//
// Up to three faces, whoever was there last first (the server's order),
// and "+N" for the people past three — no figure at all for one to
// three, the faces are the count. No names: the owner chose faces and a
// figure over a name cut to fit, and the badge in the corner that said
// "2 người đã ghé" went with it, because the faces said it already.
//
// The first face is on top of the rest — the facepile every app the
// reader knows draws (Slack, GitHub, Facebook), and the newest visitor
// is the one the row is about. React Native paints a later sibling over
// an earlier one, so the order is turned round with `zIndex`; drawn in
// the plain order, the second face covered a third of the first, on a
// phone, 26 Nov 2026.
//
// Names are still read out (`accessibilityLabel`), and the place's page
// names everyone under "Đánh giá từ khách".
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
import { colors, font, space } from '../../theme';
import { type Nav } from '../../nav';
import { s as page } from './styles';

/** Fewer than this and the section is not drawn — see the header. Three:
 *  the collection shelf above shows two cards and a sliver at every
 *  width, so three is the fewest that still scrolls. */
export const FEATURED_MIN = 3;

const NONE: HighlightCheckin[] = [];

/** The dark under the place's name, and nothing else on the photo. Its
 *  height is the name's line (20) and its padding (10) and a fade above
 *  them; its foot is `mosaicScrim`'s measured 0.60, which holds 16pt
 *  semibold white at 3:1 or more over a white photograph (`theme.ts`).
 *  Nothing below it on the picture needs it any more. */
const NAME_SCRIM = ['rgba(10,11,10,0)', 'rgba(10,11,10,0.34)', 'rgba(10,11,10,0.60)'] as const;
const NAME_SCRIM_H = 64;

/** A face in the card's row. 22, from 18 (owner, 27 Nov 2026): at 18
 *  beside the heart's filled glyph the faces were the smallest thing on
 *  the card and could not be told apart, and they are the row's point.
 *  22 with its ring is the heart's hit row's height, so the row is no
 *  taller for it. */
const FACE = 22;

/** The paper's ring round each face. 2, from 1.5: at 1.5 it vanished
 *  where a light photo-avatar met a light one. */
const RING = 2;

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
          const more = c.visitors - c.faces.length;
          const people = c.faces.map((f) => f.full_name || atHandle(f.handle)).join(', ') + (more > 0 ? ` +${more}` : '');
          return (
            <PressableScale
              key={c.id}
              contentStyle={[page.shelfCard, s.card, { width: cardW, height: cardH }]}
              onPress={() => navigation.navigate('PlaceDetail', { slug: c.place_slug })}
              accessibilityRole="button"
              accessibilityLabel={`${name}, ${people}`}
              testID="checkin-shelf-card"
            >
              <View style={s.photo} testID="checkin-shelf-photo">
                {uri
                  ? <Image source={{ uri, cacheKey: c.photo.id }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                  : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgElevated }]} testID="checkin-shelf-waiting" />}
                <LinearGradient colors={NAME_SCRIM} style={s.nameScrim} pointerEvents="none" />
                <Text style={[page.shelfCardTitle, s.name]} numberOfLines={1}>{name}</Text>
              </View>
              <View style={s.paper}>
                <View style={page.shelfCardFoot}>
                  <View style={s.faces}>
                    {c.faces.map((f, i) => (
                      <View
                        key={f.handle}
                        style={[s.face, { zIndex: c.faces.length - i }, i > 0 && s.faceNext]}
                        testID="checkin-shelf-face"
                      >
                        <Avatar url={f.avatar_url} size={FACE} />
                      </View>
                    ))}
                    {more > 0 ? <Text style={s.more} testID="checkin-shelf-more">+{more}</Text> : null}
                  </View>
                  <LikeHeart
                    liked={liked}
                    count={c.likes + (liked === c.liked ? 0 : liked ? 1 : -1)}
                    onPress={() => heart(c)}
                    style={page.shelfLikeHit}
                    contentStyle={page.shelfLikes}
                    countStyle={s.meta}
                    hitSlop={{ top: 14, bottom: 14, left: 16, right: 12 }}
                    testID="checkin-shelf-heart"
                    countTestID="checkin-shelf-likes"
                  />
                </View>
                {c.note ? <Text style={s.note} numberOfLines={2} testID="checkin-shelf-note">{c.note}</Text> : null}
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
  // The paper under the photo is the card's own ground: the whole card
  // wears it, and the photo is laid over its top.
  card: { backgroundColor: colors.surfaceCard, justifyContent: 'flex-start' },
  photo: { flex: 1, justifyContent: 'flex-end', overflow: 'hidden' },
  nameScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: NAME_SCRIM_H },
  name: { paddingHorizontal: 13, paddingBottom: 10 },
  paper: { paddingHorizontal: 13, paddingTop: 10, paddingBottom: 12, gap: 8 },
  // The visitor's words, in the body's ink at the meta's size: said,
  // not captioned.
  note: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: font.regular },
  meta: { color: colors.textSecondary, fontSize: 13, fontWeight: font.regular },
  faces: { flexDirection: 'row', alignItems: 'center' },
  // A ring of the paper round each face, so two overlapping read as two
  // — a background and padding, not a border, so it follows the theme.
  face: { padding: RING, borderRadius: FACE, backgroundColor: colors.surfaceCard },
  // A third of a face under the one before: three read as a group in
  // the width of two, and each is still a face.
  faceNext: { marginLeft: -Math.round((FACE + 2 * RING) / 3) },
  more: { color: colors.textSecondary, fontSize: 13, fontWeight: font.medium, marginLeft: 5 },
});
