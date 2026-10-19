import React from 'react';
import {
  type AccessibilityActionEvent, type AccessibilityActionInfo, type GestureResponderEvent, StyleSheet, Text, View,
} from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { categoriesOf, pinCategory } from '../lib/categories';
import { coverOf, fmtCount, isFlagged, isLive, Place } from '../lib/data';
import { useCity } from '../lib/city';
import { cityTz } from '../lib/clock';
import { openFragment, openState, sashLabel, shutLabel } from '../lib/format';
import { fmtDistance } from '../lib/geo';
import { useI18n } from '../lib/i18n';
import { localized } from '../lib/localized';
import { splitName } from '../lib/name';
import { useSave } from '../lib/save';
import { colors, font, labelScaleCap, onPhoto, quoteFace, radius, space, type } from '../theme';
import { Card, PressableScale } from './ui';
import PhotoCredit from './PhotoCredit';
import { KindPill } from './KindPill';

export default function PlaceCard({
  place, onPress, testID, distanceKm, chip, onLongPress, delayLongPress, onPressOut,
  accessibilityHint, accessibilityActions, onAccessibilityAction,
}: {
  place: Place;
  /** The category the list is filtered to, if any (Explore's chip row).
   *  The pill then names it, as the map's pin does — see `pinCategory`. */
  chip?: string | null;
  onPress: () => void;
  testID?: string;
  /** How far from the reader, when the list is in the order that figure
   *  decides (Explore's "Nearest first") — null otherwise, and the line
   *  under the name says nothing about it. See the meta row for why the
   *  figure comes with the sort and not with the fix. */
  distanceKm?: number | null;
  /** For a card that does more than open its place: the collection screen's,
   *  which lifts on a hold so it can be dragged, and offers VoiceOver the
   *  same moves as actions. */
  onLongPress?: (e: GestureResponderEvent) => void;
  delayLongPress?: number;
  onPressOut?: (e: GestureResponderEvent) => void;
  accessibilityHint?: string;
  accessibilityActions?: AccessibilityActionInfo[];
  onAccessibilityAction?: (e: AccessibilityActionEvent) => void;
}) {
  const { t, lang } = useI18n();
  const { save, isSaved } = useSave();
  const saved = isSaved(place.slug);
  const cover = coverOf(place);
  const reviews = fmtCount(place.rating_count);
  // The clock is read per render, not memoised, for the reason the Search
  // zero-state gives: a list left open across a closing time should not
  // keep insisting the door is open.
  const where = place.neighborhood_en
    ? localized(place, 'neighborhood', lang)
    : null;
  const at = new Date();
  // On the place's own clock: a list can hold places from more than one
  // city (see `membersOf`), so the zone is the card's to look up.
  const tz = cityTz(useCity().cities, place.city_id);
  const hours = openState(place.opening_hours, at, tz);
  const shut = shutLabel(hours, t);
  // What the sash shows and what it says are two lines about one fact:
  // the eye gets "Opens 08:00" on a red ground, a screen reader gets
  // "Closed · opens 08:00" — see `sashLabel` for why the state is left to
  // the colour, and why that is only safe with the full sentence beside it.
  const sash = sashLabel(hours, t);
  // Only the closing hour reaches the meta line. `openFragment` would
  // also hand back "opens 08:00" for a shut place, and this card says
  // that on the photograph instead — printing both would be the same
  // fact twice, once in grey and once in amber. So whenever `when` is
  // set here it means one thing, which is why its style can be amber
  // unconditionally rather than behind a second test.
  const when = hours?.open ? openFragment(hours, t) : null;
  // "850 m", "1.2 km", "12 km": `fmtDistance` sets the precision, and its
  // own note says why metres round to fifty and why the decimal is a full
  // stop beside a "4.7" rating even in Vietnamese.
  const far = distanceKm != null ? fmtDistance(distanceKm) : null;
  // The pill names what the place is, in the rule the map's pin follows,
  // so a card and its pin cannot disagree; the rest of its kinds are a
  // count. A place nothing classifies, or classifies only in keys the
  // table has not learned, gets its first key spelled out and no dot: a
  // colour is a category's, and an unknown one has none to give.
  const kinds = categoriesOf(place);
  const kind = pinCategory(place, chip) ?? kinds[0] ?? null;
  const more = kinds.filter((k) => k !== kind).length;
  return (
    <PressableScale
      onPress={onPress}
      testID={testID}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      onPressOut={onPressOut}
      accessibilityHint={accessibilityHint}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
    >
      <Card style={s.card}>
        <View>
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
          <PressableScale
            onPress={() => save(place)}
            scaleTo={0.9}
            haptic="selection"
            accessibilityRole="button"
            accessibilityState={{ selected: saved }}
            accessibilityLabel={saved
              ? t('Saved — change collections', 'Đã lưu — đổi bộ sưu tập', '保存済み — コレクションを変更')
              : t('Save to a collection', 'Lưu vào bộ sưu tập', 'コレクションに保存')}
            hitSlop={8}
            style={s.saveSlot}
            contentStyle={s.saveFab}
          >
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={19}
              color={saved ? onPhoto.accent : onPhoto.text}
            />
          </PressableScale>
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
        <View style={s.body}>
          {/* The whole line is the name's now that the bookmark rides the
              photograph — a 40pt disc used to sit beside it, and the
              names this catalog actually holds are long enough that the
              disc's width was the difference between reading one and
              reading "Bún chả Hàng Quạt – quán g…".

              And only the brand: what the catalog hangs after the dash
              is the branch's ward or its building (`docs/place-naming.md`,
              rule 4), and the ward is what the line under this one
              prints, with a pin. "Comfy Coffee & Bakes – Thủ Đức" over
              "⌖ Thủ Đức" said the one fact twice, in 169 rows. Two
              branches of one brand in one ward is the case that would
              need the suffix here, and the owner ruled it rare enough to
              leave to the detail screen, which prints the full name and
              the street address (2 Oct 2026). `splitName` cuts at the
              first spaced dash and leaves a name without one whole. */}
          <Text style={s.name} numberOfLines={1}>{splitName(localized(place, 'name', lang)).title}</Text>
          {/* Which part of town, before you have to open it to find out.
              ── the question this answers ──

              This catalog holds three Hadu Sushi and two Artemis Pastry,
              and they are not duplicates: separate businesses with
              separate Google ids, kilometres apart, in different
              districts. Search "Hadu" and three cards came back that were
              identical — same name, same chips, differing only in a
              photograph — and telling them apart meant opening each one
              and coming back.

              `PlaceDetailScreen` has carried the district and the full
              address all along. That is one screen too late: the
              disambiguating happens in the list, and the detail only
              confirms whichever guess you already made.

              ── unconditional, not only-when-ambiguous ──

              Showing it only for names that repeat would need the card to
              know the whole catalog, through a prop or a context read.
              That is more machinery for a card that is *harder* to
              predict: one that sometimes carries a district and sometimes
              does not reads as a bug. It is also useful on every card —
              "what part of town is this in" is a question about a place,
              not about a collision.

              Drawn as the plan and trip screens draw it, so a place named
              in a list and the same place named in an itinerary say the
              same thing the same way. Dropped rather than left blank when
              the catalog has no district for a row: an empty line under a
              name is a gap that looks like a loading state. */}
          {/* The hour rides the district's line — "Ngọc Hà · đến 21:00"
              — because "can I actually go" is the same question at the
              same moment as "what part of town". The grammar is
              `openFragment`'s, shared with the Search zero-state rows,
              so two lists of places can never learn to disagree about
              what an hour says. A place near closing announces itself
              while you scroll, which no amount of opening its page
              earlier could do.

              The pin still belongs to the district alone: with no
              district the row can still carry an hour, and an icon
              pointing at a closing time would label the wrong half of
              the sentence. */}
          {/* The kind rides the district's line rather than a line of its own.

              ── why the category and not the vibe ──

              This pill spelled out the first vibe tag until 15 Oct 2026,
              in a dot of the vibe's hue. Measured that day, 1,152 of the
              catalog's 1,350 vibe tags restate the place's category (493
              of 495 `cafes` sit on a café), and those seven vibes wore
              their category's exact hue, so the pill was a category drawn
              from a second column — and only mostly: on six places the
              first vibe was a judgement, and the pill said "Chill" in a
              blue no category wears. The owner's rule for every tag in the
              app (15 Oct): colour is the category's. So the pill reads the
              category, with the dot its pin wears.

              The notes below were written for the vibe pill and count
              vibes. The categories have the same shape, measured the same
              day: of 976 published places 787 carry one, 161 two, 28
              three, and none carries none.

              ── why it moved ──

              It used to be a third row of up to three chips, and that row
              cost every card in the feed about 32pt of height for a fact
              that, on two thirds of the catalog, is a single word: 343 of
              531 published places carry exactly one vibe tag, 122 carry
              two. A whole row, on most cards, to say "Cà phê".

              Folded onto the district's line it costs nothing: the row
              was already there and its right half was empty. The feed
              gets a shorter card, and the vibe keeps its word.

              ── why one pill and not three chips ──

              The line has room for one label beside a district and an
              hour, not three. So the first tag is spelled out and the
              rest become a count — the shape the catalog's own
              distribution wants, since the tail that needs counting is
              66 places out of 531.

              The district text takes the slack (`flex: 1`, one line) and
              the pill never shrinks: when a long name's card runs out of
              room it is the hour that gives way, not the tag. Losing
              "đến 22:00" leaves a fact you can still read; a pill squeezed
              to "Cà…" leaves one you cannot. */}
          {/* The distance, when there is one, rides the same line, between
              the district and the hour: "Kim Liên · 850 m · until 22:00".

              ── why the figure is here at all ──

              "Nearest first" orders the feed by a number no card printed.
              The reader saw the cards reshuffle and could not tell 300 m
              from 3 km, or whether the sort had taken at all. A figure on
              each card is the evidence of the order, and the one fact the
              reader who chose that order is asking for: whether it is a
              walk. So the screen hands the distance over only with that
              sort — a figure under "Recommended" would not match the
              order it sat in, and every "why is 0.5 km under 3 km" would
              be earned.

              ── why this order on the line ──

              District, then distance, then hour. District first because
              the line reads as a sentence about a place and that is its
              subject; the distance after it, as "Kim Liên · 850 m" reads
              and "850 m · Kim Liên" does not.

              ── words give way, figures never ──

              The line used to be one Text clipped at its tail, which cut
              whatever came last — the hour, by the vibe note's reasoning
              that "đến 22:00" lost is a fact you can still read. That
              held until a figure sat on the line: measured on the
              owner's 430pt phone, the district column has about 31
              characters beside a two-vibe pill, 25 on a 390pt phone, and
              "Xuân Hương - Đà Lạt · 1.2 km" is 28. The tail cut landed on
              the number — "Xuân Hương - Đà Lạt · 1.…" — and a clipped
              figure is not a shorter fact, it is a wrong one. (The hour
              had the same flaw all along: "Kim Liên · đến 2…".)

              So the district is the one piece that shrinks and takes the
              ellipsis, and the figures sit in a Text that never does.
              A long district reads "Xuân Hương - Đ… · 1.2 km", which is
              a shortened word beside a whole number. The catalog's own
              long names were cut by hand the same day (see
              `docs/place-naming.md`, "Dòng phường"), so this is the
              backstop for the next merged ward, not the fix for those.

              ── why the weight and not the colour ──

              Semibold in the district's grey. The hour on this line is
              already amber and bold for the forty-five minutes it is
              urgent, and a second accent on a 13pt line leaves neither
              one an accent. Weight alone lifts the figure enough to be
              found at a glance down the feed.

              ── why the pin stays the pin ──

              The first cut swapped the pin for the sort's own arrow
              whenever a figure was present, so the line would wear the
              mark of the control that asked for it. The owner saw the
              icon change under "Nearest first" and asked whether it was
              an accident — which is the whole case against it: three
              sorts, one of which changes a glyph on every card and two
              of which do not, reads as a glitch to anyone who did not
              open the sheet. The figure in the district's weight already
              says "from where you are"; the glyph's job is to be the same
              thing in the same place so the eye finds the line through
              every change of sort. */}
          {(where || far || when || kind) && (
            <View style={s.metaRow}>
              {(where || far || when) ? (
                <View style={s.whereRow}>
                  {(where || far)
                    ? <Ionicons name="location-outline" size={13} color={colors.textTertiary} />
                    : null}
                  {where ? (
                    <Text style={s.where} numberOfLines={1} testID={testID ? `${testID}-district` : undefined}>
                      {where}
                    </Text>
                  ) : null}
                  {(far || when) ? (
                    <Text style={s.figures} numberOfLines={1} testID={testID ? `${testID}-figures` : undefined}>
                      {where && far ? ' · ' : ''}
                      {far ? <Text style={s.far}>{far}</Text> : null}
                      {(where || far) && when ? ' · ' : ''}
                      {when ? <Text style={s.soon}>{when}</Text> : null}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {kind ? <KindPill kind={kind} more={more} testID={testID ? `${testID}-kind` : undefined} /> : null}
            </View>
          )}
          {/* Only its submitter can see this card at all, so the marker is
              not a warning — it is the answer to "why can nobody else see
              the place I added". Without it the card looks live, they show
              a friend, the friend sees nothing, and the app reads as broken.

              It says what is true of the card rather than what is being
              done about it. "Awaiting review" was a worse label twice
              over: it made a contribution sound like a submission at a
              counter, and it was not even accurate — a place can be
              approved and still not published, and that card said the desk
              had not looked at it when the desk had.

              Turned down keeps its own words. One is *wait*, the other is
              *no*, and a person owed the second should not be left
              expecting the first — which is exactly what would happen if
              this softening reached across to cover it. */}
          {!isLive(place) && (
            <View style={[s.statusRow, isFlagged(place) && s.statusRowBad]}>
              <Ionicons
                name={isFlagged(place) ? 'close-circle-outline' : 'time-outline'}
                size={13}
                color={isFlagged(place) ? colors.bad : colors.textSecondary}
              />
              <Text style={[s.statusText, isFlagged(place) && s.statusTextBad]} numberOfLines={1}>
                {isFlagged(place)
                  ? t('Not accepted', 'Không được duyệt', '不採用')
                  : t('Only you can see this', 'Chỉ mình bạn thấy', 'あなただけに表示中')}
              </Text>
            </View>
          )}
        </View>
      </Card>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  card: { marginHorizontal: space.page, marginBottom: space.cardGap },
  photo: { width: '100%', aspectRatio: 16 / 10, backgroundColor: colors.surfaceGlass },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  // Google asks for the photo's author attribution wherever the photo is
  // shown, so this is not dropped — only made to recede. The camera
  // glyph is gone (it read as a control), the type is smaller, and it is
  // capped at half the card so a long name can't cross the frame.
  // Whether it is drawn at all is the `photo_attribution` switch, and
  // that is a decision taken in the database, not here — see
  // `lib/flags.ts` for why it has to be reversible without a release.
  attr: {
    position: 'absolute', right: 10, bottom: 8, maxWidth: '50%',
    fontSize: 9, color: onPhoto.text, opacity: 0.5,
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3,
  },
  // ~10% tighter than the standard card body: this is a feed, not a form.
  body: { paddingHorizontal: space.cardPadding, paddingVertical: 13 },
  // Top-right of the image, mirroring the attribution bottom-right.
  saveSlot: { position: 'absolute', top: 10, right: 10 },
  /**
   * The closed-sash, solved against the reference rather than eyeballed.
   *
   * Measured off the mock rather than eyeballed, and the way it had to
   * be measured is worth recording: reading a slanted band off a
   * photograph column by column gives numbers that are wrong in a
   * flattering way, because a brick wall passes for a dark red and the
   * card's own rounded corner clips the band just where a column meets
   * it. Rotating the crop flat first and measuring the band horizontally
   * is what produced these.
   *
   * On the mock's 1268 × 691 photograph, scaled by 349/1268 to the card
   * this app draws:
   *
   *   band thickness      70 px   →  19pt, taken as 20
   *   centre line meets the left edge   52pt down
   *   centre line meets the top edge   130pt across
   *   so the angle is atan(52/130) ≈ 22°, and the visible chord 140pt
   *   the line of text                 345 px  →  95pt for 20 characters
   *
   * ── why the angle is not the reference's 22° ──
   *
   * Shipped at 22° and looked at on a phone, the sash reads as a banner
   * laid along the top rather than a corner cut off, and the numbers say
   * why: it spends 130pt of a 349pt top edge and only 52 of a 218pt side,
   * which is 37% of the width against 24% of the height. Two and a half
   * times as much horizontal as vertical.
   *
   * The chord cannot shrink — it is holding a sentence — so the only
   * freedom is the angle, and the question is which angle is *balanced*
   * on a frame that is not square. 45° balances the two crossings in
   * points and therefore unbalances them against the edges: on a 16:10
   * photograph it spends 28% of the width and 45% of the height, tipped
   * as far the other way as 22° was this way, and it slants the type
   * enough to slow reading a twenty-character line.
   *
   * Equal *shares of each edge* is the balance a rectangle actually has,
   * and for 16:10 that is atan(10/16) ≈ 32°:
   *
   *              across   down    of the width / of the height
   *     22°       130pt    52pt        37%  /  24%
   *     32°       119pt    74pt        34%  /  34%      ← here
   *     45°        99pt    99pt        28%  /  45%
   *
   * So the sash sits on the diagonal of its own corner rather than along
   * one edge of it, and the angle stays whatever the words do.
   *
   * ── the chord, cut to the words ──
   *
   * The chord is set by the line it has to hold, and the line got short.
   * "Closed · opens 08:00" was twenty characters; 95pt across twenty is
   * 4.75 per character, which is Lora italic at **10pt**, not the 12 a
   * first pass guessed from the band's depth — and the difference is the
   * whole character of the thing. At 12 the sentence fills the chord end
   * to end and the sash reads as a banner; at 10 it keeps 22pt of red at
   * each end and reads as a stamp, which is what the reference drew.
   *
   * "Opens 08:00" is eleven, the longest of the three languages
   * (`sashLabel` pins that), so 52pt of type. The same 20pt of red at
   * each end gives a chord of 92, against 140 before:
   *
   *              across   down    of the width / of the height
   *     140pt     119pt    74pt        34%  /  34%
   *      92pt      78pt    49pt        22%  /  22%      ← here
   *
   * Still equal shares of each edge — the chord shrank along the same
   * 32° line — and the band covers 1.8% of the photograph where it
   * covered 2.8%. It also clears the rating pill by a wider margin than
   * before on a short card, which was the one place the old chord came
   * close to something.
   *
   * The rest is arithmetic. The centre line must pass through the chord's
   * midpoint (78/2, 49/2); a strip 180 wide leaves 44pt hanging past each
   * crossing for the card's radius to cut; rotation is about the centre,
   * so `left` and `top` place that centre and nothing else:
   *
   *   left = 78/2 − 180/2 = −51      top = 49/2 − 20/2 = 14.5
   *
   * `height` is fixed rather than grown from the text because `top` is
   * derived from it, and a font metric that moved would slide the sash
   * off its corner.
   *
   * Points, not percentages, like the bookmark at `top: 10, right: 10`:
   * a corner mark is the same size on every phone, and only the
   * photograph under it gets wider.
   */
  shutSash: {
    position: 'absolute', left: -51, top: 14.5, width: 180, height: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: onPhoto.shut,
    transform: [{ rotate: '-32deg' }],
  },
  // Lora italic, which the app already loads for the Ideas lede and the
  // Profile footer. Borrowed rather than added: a serif at a slant reads
  // as something stamped on the picture, where the card's own sans would
  // have read as one more piece of UI furniture — and the alternative was
  // shipping a face for one line of text.
  shutSashText: {
    color: onPhoto.text, fontSize: 10, lineHeight: 13,
    fontFamily: quoteFace, letterSpacing: 0.3,
  },
  // Top-left, the photograph's one free corner, in the rating pill's
  // exact material — the card's rule is that marks on one picture are
  // made of one thing.
  // The rating pill's exact ground, one hairline and all: two marks on
  // one photograph should be made of one material. The circle is not
  // decoration — it separates this tap from the card's own (press the
  // disc and you save, press anywhere else and the place opens) and it
  // holds the 40pt target that makes that separation reachable.
  saveFab: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(10,11,10,0.58)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: onPhoto.line,
  },
  name: { color: colors.text, ...type.cardTitle },
  // District and hour on the left, the kind pill on the right, on one line.
  // The text cluster takes the slack and the pill keeps its size — see the
  // note beside the markup for which half is allowed to give way.
  //
  // 8pt above it, the same the status row takes, and it used to be 3. The
  // 3 was argued for: this line was the second half of the name's
  // sentence, so it sat tight under it while separate statements got 8.
  // That stopped being true when the vibe pill moved onto this line. A row
  // with a pill anchored to its right edge is not the tail of the sentence
  // above it — it is a row, and it reads as one whether or not the spacing
  // admits it.
  //
  // The number is not free-drawn. Neither text here sets `lineHeight`, so
  // each carries its own half-leading and 3pt of margin renders as about
  // 10.6pt of white between the letters; the reference card has about
  // 16.9. Two ways of measuring the difference — ink to ink, and baseline
  // to baseline — both land between 7 and 8, and 8 is the one this file
  // already owns.
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  whereRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  // The same tertiary weight the plan and trip screens give a district, so
  // the fact wears one face across the app.
  // The district shrinks and takes the ellipsis; nothing else on the
  // line does — see "words give way, figures never" at the meta row.
  where: { flexShrink: 1, color: colors.textTertiary, ...type.meta },
  // The figures' Text: the same face as the district, in a box that
  // never gives up a point of width.
  figures: { flexShrink: 0, color: colors.textTertiary, ...type.meta },
  // The hour, for the forty-five minutes it is urgent — see CLOSING_SOON_MIN.
  // Weight as well as colour: amber alone is a hue difference, and the
  // readers most likely to be planning an evening around a closing time
  // are not all seeing the hue.
  soon: { color: colors.soon, fontWeight: font.semibold },
  // The distance, in the district's grey and the hour's weight — the meta
  // row's note says why it is weight and not a second colour.
  far: { fontWeight: font.semibold },
  // The rating supplies its own ground, like the bookmark: a photograph
  // can be any brightness, and a score has to be legible over all of them.
  ratingSlot: {
    position: 'absolute', left: 10, bottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 5,
    backgroundColor: 'rgba(10,11,10,0.58)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: onPhoto.line,
  },
  // Three weights: the gold mark, the number, the count in parentheses.
  star: { color: onPhoto.star, fontSize: 13 },
  ratingValue: { color: onPhoto.text, fontSize: 15, fontWeight: font.semibold },
  ratingCount: { color: onPhoto.textSecondary, fontSize: 13, fontWeight: font.regular },
  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', marginTop: 8,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: radius.pill, backgroundColor: colors.surfaceGlass,
  },
  statusRowBad: { backgroundColor: colors.badSoft },
  statusText: { color: colors.textSecondary, fontSize: 12, fontWeight: font.medium },
  statusTextBad: { color: colors.bad },

  // The pill itself is `KindPill`, shared with the place page and a
  // list's card, so the three say a category one way.
});
