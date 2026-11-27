// The line under a place's name: the rating and its count, the price when
// the price is shown at all, and the Check-in pill at the right.
//
// Out of PlaceDetailScreen since 24 Nov 2026, the last piece taken out to
// bring the screen under the ceiling: the line was 17 of what was left of
// its complexity, every "is there a rating, a count, a price, is it free"
// a branch. The two switches that decide whether its parts are drawn at
// all, `place_price` and `place_checkin`, are read here, where they are
// used; nothing else on the page asked. The lines were moved, not retyped.
import { Text, View } from 'react-native';
import PricePill from '../../components/PricePill';
import { Glyph, ICON } from '../../components/ui/glyph';
import { fmtCount, isFree, type Place } from '../../lib/data';
import { useI18n } from '../../lib/i18n';
import { useFlag } from '../../lib/useFlag';
import { colors } from '../../theme';
import { CheckinPill } from './CheckinPill';
import { s } from './styles';

/** Nothing when the place has no rating and neither switch draws its part. */
export function ScoreRow({ place, name, cover, cityId, askToSignIn }: {
  place: Place;
  name: string;
  cover: string | null;
  cityId: string | null;
  askToSignIn: (why: 'checkin') => void;
}) {
  const { t } = useI18n();
  const showPrice = useFlag('place_price');
  const showCheckin = useFlag('place_checkin');
  const reviews = fmtCount(place.rating_count);
  // "109 on Google", not "109 reviews" (owner, 27 Nov 2026): the page now
  // carries its own "Đánh giá từ khách" further down, and two counts of
  // "đánh giá" on one page, Google's 109 and the app's 2, read as one
  // figure that disagreed with itself. The rating and its count are
  // Google's; this says whose.
  const onGoogle = t(`${reviews} on Google`, `${reviews} trên Google`, `Google ${reviews}件`, `Google ${reviews} 条`, `Google ${reviews} 條`);
  const priceShown = showPrice && (place.price_display || place.price_vnd != null);
  if (!(place.rating || showCheckin || priceShown)) return null;

  return (
    <>
    {/* ── the score, and the one thing to do about it ──
        The rating at the left, check-in at the right: one line that
        used to be two bands, the score and then a row of category
        pills with the pill at its end. The categories went onto the
        cover then, and came back under this line on 15 Oct 2026 as a
        row of their own (see "what the place is"); check-in stays
        here, beside the score it answers. */}
    <View style={s.metaRow} testID="detail-meta">
    <View style={s.metaFacts}>
      {place.rating ? (
        // Spoken as one phrase. Left to itself a screen reader reads
        // the star glyph, then the number, then a lone middle dot,
        // then the count — four stops for one fact.
        <View
          style={s.ratingRow}
          testID="detail-rating"
          accessibilityRole="text"
          accessibilityLabel={reviews ? `${place.rating} — ${onGoogle}` : String(place.rating)}
        >
          <Glyph name="star" size={ICON.action} color={colors.accent} />
          <Text style={s.ratingValue}>{place.rating}</Text>
          {reviews ? (
            <>
              <Text style={s.ratingDot}>·</Text>
              <Text style={s.ratingCount}>{onGoogle}</Text>
            </>
          ) : null}
        </View>
      ) : null}
      {/* FREE is already a pill of its own, accented because it is
          the one price that is a state; a paid price is quiet text
          and takes a tag glyph.

          On the rating's line now, as text, since the row of pills
          it sat in moved onto the cover. It went behind its switch
          because it pushed a three-category row onto a second line
          (that row wanted 427pt of a 386pt card); it would wrap
          this line the same way on a long count, which is the
          reason to look again before the switch goes back on.

          This screen is the only place in the app that has ever
          drawn a price, so the switch hides it everywhere, on 557
          published places of 648. That is why it is a row in
          `app_flags` rather than a deletion — see `lib/flags` for
          the one line that brings it back on every phone at once. */}
      {priceShown ? (
        isFree(place) ? (
          <PricePill place={place} />
        ) : (
          <View style={s.priceLine}>
            <Glyph name="pricetag-outline" size={ICON.text} color={colors.textSecondary} />
            <PricePill place={place} />
          </View>
        )
      ) : null}
    </View>
      {showCheckin && (
        <CheckinPill
          place={place} name={name} cover={cover}
          cityId={cityId} askToSignIn={askToSignIn}
        />
      )}
    </View>
    </>
  );
}
