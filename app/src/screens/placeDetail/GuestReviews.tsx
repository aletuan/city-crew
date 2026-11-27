// "Đánh giá từ khách" — what guests said about the place (owner, 26 Nov
// 2026; `20261126120000_place_guest_reviews.sql` and
// `20261127100000_checkin_note_or_photo.sql` have which visits, and why).
//
// ── where it sits ──
//
// After the desk's own words (`BlurbCard`) and the local guide's panel,
// before the facts (`InfoCard`): the argument about the place is the
// desk's first and the guests' second, and both come before the hours
// and the address. Not above the highlights: a guest's line is one
// person's evening, and it should not be the first thing said about a
// place it might not represent.
//
// ── what is drawn ──
//
// The count, always, when there is one — every check-in, a sum that
// names nobody. Then each review: who, which day (never the hour), the
// note in full, the photos at the size a thumb can press, and the heart.
// A review is words or photographs since 27 Nov 2026 (the owner; it was
// both): whichever is missing is simply not drawn.
// A guest's name opens their page; a photo opens the viewer. Nothing at
// all for a place nobody has checked in at: an empty section on a
// catalog page reads as a verdict.
//
// The name is the owner's: a visit carries no stars yet, and this is the
// section where they would go when it does.
//
// Signed out, the server sends the count and no reviews (it cannot ask
// `checkin_seen` about a reader it does not know), so a guest sees the
// figure and the invitation is the check-in pill above.
//
// ── two, then the rest ──
//
// The two newest reviews, and "Xem thêm" for the rest when there are
// more (owner, 27 Nov 2026). Each review is a note in full and up to
// three photographs, so ten of them made the place's page a feed, and
// the facts under it — the address, the hours — were a long scroll
// away. Tabs were weighed, "Thông tin" and "Đánh giá", and lost: most
// places have none or one review, so the second tab would most often be
// an empty room the reader had to open to find empty; a tab hides the
// people who went from a reader on the first, the very thing the shelf
// on Explore is there to put forward; and a tab named for reviews
// beside "109 đánh giá" on the score line had two counts called the same
// thing. A separate "all reviews" screen was weighed too: the server
// sends ten at most, so the rest fits on this page, and the app's other
// pages show more in place — the person page's feed and its "Xem thêm"
// (`person/Shared`), whose words and shape this button takes.
//
// ── when it is asked again ──
//
// When the reader's own visits here change: a new one, a note or an
// audience edited, a photo added, one removed. Until 26 Nov 2026 it was
// read once as the page opened, so a reader who checked in watched the
// pill above turn to "Đã qua" while this card kept the count and the
// reviews it had — theirs appeared only on leaving the page and coming
// back (owner, on a phone). The sheet reloads the reader's visits when
// it saves (`useCheckIn`), so those are the signal: what of them could
// change this card is folded into one string, and a different string is
// a reload. Not before the visits have loaded once — their arriving is
// not a change, and the card has just been asked for.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import LikeHeart from '../../components/LikeHeart';
import PhotoViewer from '../../components/PhotoViewer';
import { PressableScale, fireHaptic } from '../../components/ui';
import { Avatar, Card } from '../../components/ui/surfaces';
import { Glyph, ICON } from '../../components/ui/glyph';
import { useSignedPhotos } from '../../components/useSignedPhotos';
import { dayLabel } from '../../lib/ago';
import { fetchGuestReviews, likeCheckin, useFetch, type GuestReview, type GuestReviews as Reviews } from '../../lib/data';
import { visitsAt } from '../../lib/checkin';
import { useMyCheckins } from '../../lib/checkins';
import { atHandle } from '../../lib/handle';
import { useI18n } from '../../lib/i18n';
import { colors, font } from '../../theme';
import { s as page } from './styles';

/** A photo's tile: three across the card's text column on the narrowest
 *  phone (320pt less the screen's and the card's padding is ~256, and
 *  three of 76 with two 8pt gaps is 244), and a thumb's 44 with room. */
const TILE = 76;

export function GuestReviews({ slug, onPerson }: {
  slug: string;
  /** Open a guest's page; absent where the screen's stack has none, and
   *  then the name does not press. */
  onPerson?: (handle: string) => void;
}) {
  const { t, lang } = useI18n();
  const fetcher = useCallback(() => fetchGuestReviews(slug), [slug]);
  const read = useFetch<Reviews | null>(fetcher, null);
  const reviews = read.data;
  const mine = useMyCheckins();
  const stamp = useMemo(
    () => (mine.loaded
      ? visitsAt(mine.data, slug)
        .map((v) => [v.id, v.note ?? '', v.audience ?? '', (v.photos ?? []).map((p) => p.id).join(',')].join(':'))
        .join('|')
      : null),
    [mine.loaded, mine.data, slug],
  );
  const drawn = useRef(stamp);
  const { reload } = read;
  useEffect(() => {
    if (stamp === drawn.current) return;
    const first = drawn.current === null;
    drawn.current = stamp;
    if (!first) reload();
  }, [stamp, reload]);
  const visits = useMemo(() => reviews?.visits ?? [], [reviews]);
  const all = useMemo(() => visits.flatMap((v) => v.photos), [visits]);
  const linkOf = useSignedPhotos(all, true);
  const [pressed, setPressed] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);
  const shown = open ? visits : visits.slice(0, PREVIEW);
  const [viewing, setViewing] = useState<{ v: GuestReview; at: number } | null>(null);

  if (!reviews || (reviews.count === 0 && visits.length === 0)) return null;

  const heart = (v: GuestReview) => {
    const was = pressed[v.id] ?? v.liked;
    fireHaptic('light');
    setPressed((p) => ({ ...p, [v.id]: !was }));
    likeCheckin(v.id, !was).catch(() => setPressed((p) => ({ ...p, [v.id]: was })));
  };
  const viewed = viewing
    ? viewing.v.photos.flatMap((ph) => {
      const uri = linkOf(ph);
      return uri ? [{ id: ph.id, photo_uri: uri, cacheKey: ph.id }] : [];
    })
    : [];
  const n = reviews.count;
  const close = () => setViewing(null);

  return (
    <Card style={s.card} testID="guest-reviews">
      <View style={s.head}>
        <Text style={page.whyLabel}>{t('Guest reviews', 'Đánh giá từ khách', 'ゲストの声', '访客评价', '訪客評價')}</Text>
        {n > 0 ? (
          <View style={s.count} accessible testID="guest-reviews-count">
            <Glyph name="location-outline" size={ICON.meta} color={colors.textTertiary} />
            <Text style={s.countText}>
              {n === 1
                ? t('1 check-in', '1 lượt check-in', 'チェックイン1件', '1 次打卡', '1 次打卡')
                : t(`${n} check-ins`, `${n} lượt check-in`, `チェックイン${n}件`, `${n} 次打卡`, `${n} 次打卡`)}
            </Text>
          </View>
        ) : null}
      </View>
      {shown.map((v) => {
        const liked = pressed[v.id] ?? v.liked;
        return (
          <View key={v.id} style={s.review} testID="guest-review">
            <View style={s.who}>
              <PressableScale
                onPress={onPerson ? () => onPerson(v.handle) : undefined}
                disabled={!onPerson}
                haptic="selection"
                accessibilityRole={onPerson ? 'button' : 'text'}
                contentStyle={s.whoPress}
                testID="guest-review-person"
              >
                <Avatar url={v.avatar_url} size={28} />
                <Text style={s.name} numberOfLines={1}>{v.full_name || atHandle(v.handle)}</Text>
              </PressableScale>
              <Text style={s.day} numberOfLines={1} testID="guest-review-day">{dayLabel(v.day, new Date(), lang, t)}</Text>
              <LikeHeart
                liked={liked}
                count={v.likes + (liked === v.liked ? 0 : liked ? 1 : -1)}
                onPress={() => heart(v)}
                countStyle={s.likes}
                brief
                contentStyle={s.heart}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                testID="guest-review-heart"
                countTestID="guest-review-likes"
              />
            </View>
            {v.note ? <Text style={s.note} testID="guest-review-note">{v.note}</Text> : null}
            {v.photos.length > 0 ? (
            <View style={s.photos} testID="guest-review-photos">
              {v.photos.map((ph, at) => {
                const uri = linkOf(ph);
                return (
                  <PressableScale
                    key={ph.id}
                    onPress={uri ? () => setViewing({ v, at }) : undefined}
                    disabled={!uri}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={t(`Photo ${at + 1}`, `Ảnh ${at + 1}`, `写真${at + 1}`, `照片 ${at + 1}`, `照片 ${at + 1}`)}
                    testID="guest-review-photo"
                  >
                    {uri
                      ? <Image source={{ uri, cacheKey: ph.id }} style={s.tile} contentFit="cover" transition={160} />
                      : <View style={[s.tile, s.tint]} />}
                  </PressableScale>
                );
              })}
            </View>
            ) : null}
          </View>
        );
      })}
      {visits.length > shown.length ? (
        <PressableScale
          onPress={() => setOpen(true)}
          haptic="selection"
          contentStyle={s.more}
          accessibilityRole="button"
          testID="guest-reviews-more"
        >
          <Text style={s.moreText}>{t('Show more', 'Xem thêm', 'もっと見る', '查看更多', '檢視更多')}</Text>
        </PressableScale>
      ) : null}
      <Modal visible={viewed.length > 0} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        {viewing && viewed.length > 0 ? (
          <PhotoViewer
            photos={viewed}
            index={Math.min(viewing.at, viewed.length - 1)}
            onIndex={(at) => setViewing({ ...viewing, at })}
            onClose={close}
          />
        ) : null}
      </Modal>
    </Card>
  );
}

/** Reviews drawn before "Xem thêm": two fill about one screen under the
 *  highlights card on a 6.1" phone with a photo each (owner's screenshot,
 *  27 Nov 2026, one review took about half). */
const PREVIEW = 2;

const s = StyleSheet.create({
  // The highlights card's measure: 14 above, the card's padding, 10
  // between its rows.
  card: { marginTop: 14, padding: 16, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  countText: { color: colors.textTertiary, fontSize: 13 },
  review: { gap: 8, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  who: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  whoPress: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: font.semibold, flexShrink: 1 },
  day: { flex: 1, color: colors.textTertiary, fontSize: 13 },
  likes: { color: colors.textSecondary, fontSize: 13 },
  // The heart and its figure side by side, "♥ 3", as on every card in
  // the app (`explore/styles` shelfLikes): without it the figure fell
  // under the heart (owner, on a phone, 27 Nov 2026).
  heart: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // The person page's "Xem thêm" (`person/Shared`): the accent's words,
  // a 44pt row.
  more: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  moreText: { color: colors.accent, fontSize: 14, fontWeight: font.semibold },
  note: { color: colors.text, fontSize: 15, lineHeight: 21 },
  photos: { flexDirection: 'row', gap: 8 },
  tile: { width: TILE, height: TILE, borderRadius: 10 },
  // The accent's tint, as a card with no photograph wears (`ActivityCard`).
  tint: { backgroundColor: colors.accentSoft },
});
