// Out of `PlaceCard` on 27 Nov 2026, so its function fits the ceiling
// (`oversize.js`); the reasoning moved with the code, unchanged.
// The photograph and the three marks over it: the bookmark, the rating,
// and the shut sash.

import React from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Glyph, ICON } from './ui/glyph';
import { type coverOf, fmtCount, type Place } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { useIsSaved, useSaveActions } from '../lib/save';
import { labelScaleCap, onPhoto } from '../theme';
import { PressableScale } from './ui';
import PhotoCredit from './PhotoCredit';
import ListToggle from './ListToggle';
import { s } from './placeCardStyles';

export function PlaceCardPhoto({ place, cover, testID, inList, sash, shut }: {
  place: Place;
  cover: ReturnType<typeof coverOf>;
  testID?: string;
  inList?: { on: boolean; title: string; onPress: () => void };
  /** What the sash shows, and what a screen reader hears — `sashLabel`,
   *  `shutLabel`. */
  sash: string | null;
  shut: string | null;
}) {
  const { t } = useI18n();
  const { save } = useSaveActions();
  const saved = useIsSaved(place.slug);
  const reviews = fmtCount(place.rating_count);
  return (
    <View testID={testID && `${testID}-frame`}>
      {cover ? (
        <>
          <Image
            source={{ uri: cover.photo_uri }}
            style={s.photo}
            contentFit="cover"
            transition={200}
          />
          <PhotoCredit name={cover.attribution_name} style={s.attr} />
        </>
      ) : (
        <View style={[s.photo, s.photoFallback]}>
          <Text style={{ fontSize: 44 }}>{place.emoji ?? '📍'}</Text>
        </View>
      )}
      {/* The bookmark holds the photo's top-right corner — the same
          disc, in the same corner, that the detail screen hangs its
          own bookmark in, so the card and the screen it opens keep
          one save control between them. It is also the corner every
          catalog app puts it in, which is the better argument: a
          thumb arrives here already knowing what lives there.

          The price pill used to hold this corner, and it did not
          move — it went. A tile price was an inferred number wearing
          a badge, and "roughly how much" is a question about a place
          you are already considering; the detail screen answers it
          two lines under the name, on a ground where its type can
          actually be read. The tile keeps to what browsing needs:
          what, where, open till when, and now *keep this*.

          The old objection to a bookmark up here — a fourth mark
          crowding the photograph, carrying its own scrim to survive
          any sky — went with the price too. Three corners, three
          marks, one dark-glass material shared with the rating pill
          beside it. */}
      {inList ? (
        <ListToggle
          on={inList.on}
          title={inList.title}
          onPress={inList.onPress}
          overPhoto
          style={s.saveSlot}
          testID={testID && `${testID}-in-list`}
        />
      ) : (
      <PressableScale
        onPress={() => save(place)}
        scaleTo={0.9}
        haptic="selection"
        accessibilityRole="button"
        accessibilityState={{ selected: saved }}
        accessibilityLabel={saved
          ? t('Saved — change collections', 'Đã lưu — đổi bộ sưu tập', '保存済み — コレクションを変更', '已保存 — 更改合集', '已儲存 — 更改合集')
          : t('Save to a collection', 'Lưu vào bộ sưu tập', 'コレクションに保存', '保存到合集', '儲存到合集')}
        hitSlop={8}
        style={s.saveSlot}
        contentStyle={s.saveFab}
      >
        <Glyph
          name={saved ? 'bookmark' : 'bookmark-outline'}
          size={ICON.action}
          color={saved ? onPhoto.accent : onPhoto.text}
        />
      </PressableScale>
      )}
      {/* The score belongs to the picture, not to the name under it:
          on the photo it is read at a glance with the place, and the
          body is left to the title and its chips. Bottom-left is the
          last free corner — the bookmark holds the top-right,
          attribution the bottom-right. */}
      {place.rating ? (
        <View style={s.ratingSlot} pointerEvents="none">
          <Text style={s.star}>★</Text>
          <Text style={s.ratingValue}>{place.rating}</Text>
          {reviews ? <Text style={s.ratingCount}>({reviews})</Text> : null}
        </View>
      ) : null}
      {/* ── the shut door, said out loud ──

          A band across the corner nothing else wants. The three marks
          above hold the other three: bookmark top-right, rating
          bottom-left, attribution bottom-right. Top-left has been
          empty since the pill that used to sit there went.

          For three versions a drawing tried to hold this fact — a
          three-point track under the photograph, twenty-four hours
          wide, the open stretches filled and a tick at the hour it
          was. It could show a shape no sentence can: of the places
          with readable hours, 55 shut for lunch and open again and
          51 run past midnight. It could not say *not now*, except
          by where a two-point tick fell, and at 22:42 a café that
          shut at ten puts that tick ten points past the end of the
          fill — 23 of 122 shut places land it within three points
          of the fill it is meant to sit outside of.

          It is gone now, and the reason it went is worth keeping.
          Nobody read it. The drawing was argued from this catalog
          rather than borrowed from anywhere, so it arrived carrying
          no convention a reader could lean on, and the person who
          commissioned it looked at a screenshot two versions later
          and reported the tick as a rendering fault. The contrast
          could have been raised — the track sat at 1.20:1 against
          the card, where the tick sat at 4.96:1 — but that would
          have made an unreadable thing visible rather than legible.

          What it drew is not lost. A shut place gets this sash, with
          the hour it opens; an open place within `CLOSING_SOON_MIN`
          of closing gets the hour on the meta line. Those are the
          two moments the answer changes a decision, and both are in
          words. An open place with hours left said nothing then
          either — the tick was there, and it told the reader what
          they already had: time.

          So the fact goes back into words, and takes the shape the
          reference asked for. What the sash costs was worth measuring
          before building it, because the objection to it had been
          mine: at twenty characters it covered 2.8% of the photograph,
          against the 5.7% of the pill it replaced. It is shorter now —
          "Opens 08:00", eleven characters, the state left to the red —
          and covers 1.8%; the geometry note on `shutSash` has the
          arithmetic.

          The words changed for a reason the first version could not
          see. "Closed" is the one thing the reader already knows from
          the colour; the hour is the thing they cannot know, and at
          night it was almost always missing, because `openState` only
          looked at today. It looks a day ahead now, so at half past
          eleven the sash says when to come back rather than what is
          obvious.

          It is loud on purpose and it is not always loud. Across a
          browsing day in this catalog the share of cards wearing it
          runs 10% at half past six, 24% at half past nine, and 58% at
          half past ten — which is the hour somebody is most likely to
          set out for a door that will not open. A feed half-marked at
          eleven at night is the true feed.

          `pointerEvents="none"` because the whole card is the tap,
          and the sash sits over none of the three controls anyway.
          The Card clips it: `overflow: 'hidden'` and the card radius
          cut the ends, which is what makes it a sash rather than a
          floating bar. */}
      {sash && shut ? (
        <View style={s.shutSash} pointerEvents="none">
          {/* The band is 20pt tall and drawn at an angle; a word that
              outgrew it would be cut at the top and bottom rather than
              wrap. See `labelScaleCap`. */}
          <Text style={s.shutSashText} numberOfLines={1} maxFontSizeMultiplier={labelScaleCap} accessibilityLabel={shut}>{sash}</Text>
        </View>
      ) : null}
    </View>
  );
}
