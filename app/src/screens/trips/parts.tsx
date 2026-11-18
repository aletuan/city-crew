import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Glyph, ICON } from '../../components/ui/glyph';
import { Image } from 'expo-image';
import { GradientCta, PressableScale } from '../../components/ui';
import { fromISO } from '../../lib/day';
import { type Trip } from '../../lib/data';
import { clockOf, dateline } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { COMPANY } from '../../lib/trip';
import { tripCover } from '../../lib/trips';
import { colors } from '../../theme';
import PhotoCredit from '../../components/PhotoCredit';
import { s } from './styles';

/**
 * One saved trip, whole.
 *
 * `past` only dims it. A trip you already went on is still yours and still
 * legible — greying it into the background would be the app deciding your
 * last weekend mattered less than your next one.
 */
/**
 * How many stops a card prints before it defers to the detail screen.
 *
 * Three, because an evening *is* three and a day out is five: the common
 * case shows whole and the long one shows its shape with a line saying
 * what is missing. Printing all five would make a card the length of a
 * screen and leave nothing for a tap to be for.
 */
const CARD_STOPS = 3;

/** The wizard's answer — who the day is with — as the date beside it is
 *  set: its glyph in the third grey and its word in the date's own caption
 *  and grey, on nothing (owner, 13 Nov 2026). It was a badge until then,
 *  accent fill, accent rule, accent semibold: on a card whose title is the
 *  point, the loudest thing after it, for a fact nobody presses. The
 *  stops' ward column already stands at this right edge in grey, so the
 *  answer now reads as one more line of that column.
 *
 *  The answer's own word and glyph, kept: "Hai người" is the couple, and
 *  its heart is what says so. Rejected with it, from a proposal that read
 *  the label as a headcount: "2 người", which "Bạn bè" and "Gia đình"
 *  have no figure for and two friends would also be; and the bare word,
 *  which loses the heart. Rejected as well: the answer after the date as
 *  "date · answer", two glyphs on one line and a "·" left at the start
 *  of a wrapped one under large type.
 *
 *  The glyph wore the companion's fixed hue until 3 Nov 2026, then the
 *  badge's accent; one ink across the planner's answers either way. */
function CompanyChip({ company }: { company: string | null }) {
  const { t } = useI18n();
  const c = COMPANY.find((x) => x.key === company);
  if (!c) return null;
  return (
    <View style={s.company} testID="trip-company">
      {c.icon ? (
        <Glyph name={c.icon as keyof typeof Ionicons.glyphMap} size={ICON.meta} color={colors.textTertiary} />
      ) : null}
      <Text style={s.companyText}>{t(c.en, c.vi, c.ja, c.zh, c.hant)}</Text>
    </View>
  );
}

/**
 * One saved trip, summarised.
 *
 * `past` only dims it. A trip you already went on is still yours and still
 * legible — greying it into the background would be the app deciding your
 * last weekend mattered less than your next one.
 */
export function TripCard({ trip, past, onPress, testID }: {
  trip: Trip;
  testID?: string;
  past: boolean;
  onPress: () => void;
}) {
  const { t, lang } = useI18n();
  const day = fromISO(trip.day);
  const stops = trip.trip_stops;
  const shown = stops.slice(0, CARD_STOPS);
  const hidden = stops.length - shown.length;
  const cover = tripCover(stops);

  return (
    <PressableScale onPress={onPress} scaleTo={0.985} contentStyle={[s.card, past && s.cardPast]} testID={testID}>
      {/* The one picture that says which trip this is.
          ── why the card has a band and PlaceCard has a hero ──

          On a place card the photograph *is* the content, so it takes
          16:10 and the words sit under it. Here it is an identifier over
          a timeline: the card's job is still the day — the rail, the
          dots, the hours — and a hero would push all of that past the
          fold on a list that already runs two cards to a screen. 3:1 is
          enough to recognise a storefront and not enough to take over.

          Everything else about it is `PlaceCard`'s, deliberately: the
          padding comes off the card and onto a body view so the picture
          can run edge to edge, `overflow: hidden` on the card clips it to
          the corner radius, and the credit sits bottom-right over it.

          Google asks for the photographer's attribution wherever the
          photo is shown, and it is not negotiable by size — so a band big
          enough to carry a legible credit is part of why this is a band
          rather than a 52pt thumbnail. Whether it is drawn at all is the
          `photo_attribution` switch; see `lib/flags.ts`. */}
      {cover && (
        <View>
          <Image source={{ uri: cover.photo_uri }} style={s.cover} contentFit="cover" transition={200} />
          <PhotoCredit name={cover.attribution_name} style={s.attr} />
        </View>
      )}
      <View style={s.cardBody}>
        {/* The title has the card's width to itself and up to two lines.
            It shared a row with the company chip and was cut to one, and
            what the cut took was the part that tells trips apart: the
            planner names them "A morning of coffee in Yên Hòa", so a list
            of 55 read as a column of "A morning of coffee in…" (UX-11,
            17 Oct 2026). The chip moved down to the date, the other
            line about the shape of the day. */}
        <Text style={s.title} numberOfLines={2}>{trip.title}</Text>

        {/* The glyph earns its place by being the one thing on the card that
            says "this is a date" at a glance, in a list where every card
            starts with a name. */}
        <View style={s.metaRow}>
          <Glyph name="calendar-outline" size={ICON.text} color={colors.accent} />
          <Text style={s.meta} numberOfLines={1}>
            {/* The day alone: not the hour, and not the city.

                The hour went on 24 Oct 2026 (owner). "from 09:00" was the
                first stop's arrival, and the stops printed under it open
                with that same 09:00 — the line said twice what the
                timeline says once, a few points lower.

                The city used to
                join them once a reader's trips spanned two, and on 7 Oct
                2026 the owner read "from 18:00 · Saigon" above a stop
                whose ward is "Sài Gòn" — a ward of that name since the
                2025 merger, home to 78 places in the catalog — as the
                same word twice. The stops' ward column already answers
                "where", stop by stop, and the cover and the title say
                the rest; the city was the one token on the card the
                rest of it had made redundant. */}
            {day ? dateline(lang, day) : trip.day}
          </Text>
          {/* At the row's far end, and onto a line of its own when large
              type leaves no room beside the date — the row wraps rather
              than cutting the day short. */}
          <CompanyChip company={trip.company} />
        </View>

        <View style={s.stops}>
          {shown.map((stop, i) => (
            <View key={`${trip.id}-${i}`} style={s.stopRow}>
              <Text style={s.stopTime}>
                {stop.arrive_min != null ? clockOf(stop.arrive_min) : '—'}
              </Text>
              {/* The rail is drawn by the stop it leaves, so the last one has
                  none — a line running off the bottom of a list claims a stop
                  that is not there. */}
              <View style={s.dotCol}>
                <View style={s.dot} />
                {i < shown.length - 1 ? <View style={s.rail} /> : null}
              </View>
              {stop.places
                ? (
                  <>
                    <Text style={s.stopName} numberOfLines={1}>{stop.places.name_en}</Text>
                    <Text style={s.stopArea} numberOfLines={1}>{stop.places.neighborhood_en}</Text>
                  </>
                )
                : (
                  <Text style={s.stopGone} numberOfLines={1}>
                    {t('No longer listed', 'Không còn trong danh mục', '掲載終了', '已下架', '已下架')}
                  </Text>
                )}
            </View>
          ))}
          {hidden > 0 && (
            <Text style={s.more}>
              {t(`+${hidden} more`, `+${hidden} điểm nữa`, `他${hidden}件`, `还有 ${hidden} 个`, `還有 ${hidden} 個`)}
            </Text>
          )}
        </View>

        <View style={s.divider} />

        {/* The way in, and nothing beside it. The foot used to open with
            the count and the spend — "1 stop · ~150k ₫ / person" — and the
            owner took both off every card, upcoming and past (24 Oct
            2026). The count repeats the stops printed just above it, with
            "+N more" for the rest; the spend is a guess from the
            catalog's price bands, and on a list of 55 trips it was the
            same small figure under each one. Both still head the trip's
            own screen, where a plan is weighed rather than recognised. */}
        <View style={s.foot}>
          <View style={s.open}>
            <Text style={s.openText}>{t('View plan', 'Xem kế hoạch', 'プランを見る', '查看计划', '檢視計畫')}</Text>
            <Glyph name="chevron-forward" size={ICON.text} color={colors.accent} />
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

/**
 * Signed in, nothing saved yet.
 *
 * Mirrors Collections' first-run card — same tinted well, same gradient
 * action — because it is the same argument aimed at a different tab. The
 * button jumps to Ideas, which is where a trip comes from; an empty state
 * that only says "empty" leaves the reader to find that out themselves.
 */
export function FirstTrip({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  return (
    <View style={s.first} testID="trips-empty">
      <View style={s.firstIcon}>
        <Glyph name="map" size={ICON.feature} color={colors.accent} />
      </View>
      <Text style={s.firstTitle}>
        {t('No trips yet', 'Chưa có chuyến đi nào', '旅程はまだありません', '还没有行程', '還沒有行程')}
      </Text>
      {/* The owner's words (25 Oct 2026). It read "Answer four
          questions in Explore and keep the plan you like": a count where
          the point belonged, and a tab's name the button below already
          goes to. "chuyến đi", not "lịch trình", the same evening (owner):
          the screen is called Chuyến đi, and so is what it suggests. */}
      <Text style={s.firstBody}>
        {t(
          'Pick a few options and the app will suggest a trip that suits you.',
          'Trả lời một vài lựa chọn để ứng dụng tự động gợi ý chuyến đi phù hợp.',
          'いくつかの質問に答えると、アプリがぴったりのプランを自動で提案します。',
          '回答几个选项，应用会自动为你推荐合适的行程。', '回答幾個選項，App會自動為你推薦合適的行程。',
        )}
      </Text>
      <GradientCta
        icon="sparkles"
        label={t('Plan a trip', 'Lên kế hoạch', 'プランを立てる', '规划行程', '規劃行程')}
        onPress={onPress}
      />
    </View>
  );
}
