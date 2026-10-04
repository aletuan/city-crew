// A stop's card on the plan editor: the place's photographs, who it is,
// why it is here, and the three things the reader can do to it.
//
// Lifted out of `PlanEditScreen` on 4 Oct 2026, step 4 of the component
// review. The screen had grown to 930 lines doing two jobs at once —
// running the plan (the planner, the narration cache, the drag, the
// pins, the save) and drawing every card — and the card was the half
// that could stand alone: it takes a stop and a set of callbacks, and
// knows nothing of the list it stands in, the rail beside it or the leg
// under it, which stay with the screen. The sentence under the name
// arrives as a string, because which sentence — the model's or the
// facts' — is the screen's to decide from caches the card has no reason
// to see.
//
// ── what is where on the card, and why ──
//
// What the place is, up top; what you do to it, at the bottom. The old
// card led every row with the time stepper, which put the controls
// between the reader and the name — the first thing on a card about a
// place was a minus button. The identity band reads left to right as
// glyph, name, rating; the controls share a rail under the divider,
// editor-chrome rather than content.
//
// The band is the way into the place; the rail underneath is the way
// into the plan. Tapping a name asked for the place and got nothing —
// the one card in the app that names a place and would not open it.
// The whole card is deliberately not the target: its lower half is a
// time stepper and a remove button, and a press swallowing those is how
// a reader nudging nine o'clock ends up on a different screen. So the
// identity band takes the tap and the controls keep theirs.
//
// VoiceOver cannot drag, so the band also carries the moves as actions
// — only the ones that go somewhere — and says in its hint that a hold
// drags. The hold itself is the band's long press and the picture's;
// `useListDrag` on the screen is what it lifts into.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CATEGORIES, categoriesOf } from '../lib/categories';
import { clockOf, fmtMinutes, openLabel } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { NUDGE_MIN } from '../lib/itinerary';
import { splitName } from '../lib/name';
import { summaryLine } from '../lib/sketch';
import type { Place } from '../lib/types';
import { colors, font, space, type } from '../theme';
import StopHero from './StopHero';
import { Card, PressableScale } from './ui';
import { LIFT_AFTER_MS } from './useListDrag';

export { NUDGE_MIN };

export default function StopCard({
  place, arriveMin, dwellMin, pinned, why, wrong, canMoveUp, canMoveDown,
  onOpen, onHold, onRelease, onNudge, onRemove, onMove,
}: {
  place: Place;
  arriveMin: number;
  dwellMin: number;
  /** The hour was set by hand and the planner will not touch it. */
  pinned: boolean;
  /** The line under the name — the model's sentence or the facts, the screen's choice. */
  why: string;
  /** Earlier than the stop above: the card says so and wears a border. */
  wrong: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onOpen: () => void;
  /** The hold completed, with the finger at `pageY`; absent when the card cannot be moved. */
  onHold?: (pageY: number) => void;
  onRelease: () => void;
  /** Nudge the arrival by `delta` minutes, ±NUDGE_MIN. */
  onNudge: (delta: number) => void;
  onRemove: () => void;
  onMove: (dir: 'up' | 'down') => void;
}) {
  const { t, lang } = useI18n();
  // The first category the place carries, worn as a glyph in a soft well
  // — the same hue this concept wears on Explore's filter row and the
  // wizard's chips, so a café here looks like "café" everywhere else. A
  // place nothing classifies gets the neutral pin on the neutral ground,
  // not a guess.
  const cat = CATEGORIES[categoriesOf(place)[0]];
  const actions = onHold
    ? [
      ...(canMoveUp ? [{ name: 'moveUp', label: t('Move up', 'Chuyển lên', '上へ移動') }] : []),
      ...(canMoveDown ? [{ name: 'moveDown', label: t('Move down', 'Chuyển xuống', '下へ移動') }] : []),
    ]
    : undefined;

  return (
    <Card style={[s.card, wrong && s.rowWrong]}>
      {/* The place's own photographs, full-bleed above the body and
          tapped the way the band below is. The card's padding sits on
          `cardBody` for this: a picture inset by 16pt inside a 22pt-radius
          card is a picture in a frame. */}
      <StopHero place={place} onPress={onOpen} onHold={onHold} onRelease={onRelease} testID="stop-hero" />
      <View style={s.cardBody}>
        <PressableScale
          style={s.identity}
          onPress={onOpen}
          onLongPress={onHold ? (e) => onHold(e.nativeEvent.pageY) : undefined}
          delayLongPress={LIFT_AFTER_MS}
          onPressOut={onRelease}
          accessibilityHint={onHold
            ? t('Hold and drag to change the order.', 'Giữ rồi kéo để đổi thứ tự.', '長押ししてドラッグすると並び順を変えられます。')
            : undefined}
          accessibilityActions={actions}
          onAccessibilityAction={(e) => onMove(e.nativeEvent.actionName === 'moveUp' ? 'up' : 'down')}
          accessibilityRole="button"
          accessibilityLabel={openLabel(place.name_en, t)}
        >
          <View style={[s.well, cat && { backgroundColor: `${cat.color}24` }]}>
            <Ionicons name={cat?.icon ?? 'location-outline'} size={20} color={cat?.color ?? colors.textTertiary} />
          </View>
          <View style={s.headCol}>
            <View style={s.nameRow}>
              {/* The brand alone, as `PlaceCard` prints it: the ward after
                  the dash opens the line below. The spoken labels keep the
                  whole name — VoiceOver reads one card at a time and has
                  no line below to lean on. */}
              <Text style={s.name} numberOfLines={1}>{splitName(place.name_en).title}</Text>
              {/* By the name, where a decision reads it. `sun`, not
                  `onPhoto.star`: the star colour is confined by its own
                  comment to photo scrims, and `sun` is the same gold
                  solved for the page, dark enough on paper to be seen. */}
              {place.rating != null && (
                <View style={s.rating}>
                  <Ionicons name="star" size={12} color={colors.sun} />
                  <Text style={s.ratingText}>{place.rating}</Text>
                </View>
              )}
            </View>
            {/* District, kind, and how long — the kind by the name the
                category wears everywhere else, so the glyph in the well
                has its word beside it. */}
            <Text style={s.area} numberOfLines={1}>
              {summaryLine([place.neighborhood_en, cat ? t(cat.en, cat.vi, cat.ja) : null, fmtMinutes(dwellMin, lang)])}
            </Text>
          </View>
        </PressableScale>

        {/* Rendered even when empty: `s.why` reserves two lines, and a card
            that skipped the element would still jump in the one
            late-landing case left — the tap faster than the model. */}
        <Text style={s.why} numberOfLines={2}>{why}</Text>

        {/* Only when the reader made it so. A plan reading backwards with
            nothing saying so is a plan that gets somebody to a closed door. */}
        {wrong && (
          <Text style={s.warn}>
            {t('Earlier than the stop above.', 'Sớm hơn điểm phía trên.', '前のスポットより早い時刻です。')}
          </Text>
        )}

        <View style={s.railDivider} />

        {/* The controls, on their own rail under the divider: nudge the
            hour on the left, remove on the right. Everything above the
            divider is the place; everything on the rail is what you can
            do to it. */}
        <View style={s.rail}>
          <View style={s.timeBox}>
            {/* Named, because the stepper used to be the only labelled
                thing on the rail that was not labelled: a minus, a clock,
                a plus, and nothing to say the clock was the arrival. */}
            <Text style={s.timeLabel}>{t('Time', 'Giờ', '時刻')}</Text>
            <PressableScale
              haptic="selection"
              onPress={() => onNudge(-NUDGE_MIN)}
              containerStyle={s.step}
              accessibilityRole="button"
              accessibilityLabel={t(`Arrive ${NUDGE_MIN} min earlier at ${place.name_en}`, `Đến ${place.name_en} sớm ${NUDGE_MIN} phút`, `${place.name_en}に${NUDGE_MIN}分早く着く`)}
            >
              <Ionicons name="remove" size={17} color={colors.text} />
            </PressableScale>
            <Text style={[s.time, pinned && s.timePinned]}>{clockOf(arriveMin)}</Text>
            <PressableScale
              haptic="selection"
              onPress={() => onNudge(NUDGE_MIN)}
              containerStyle={s.step}
              accessibilityRole="button"
              accessibilityLabel={t(`Arrive ${NUDGE_MIN} min later at ${place.name_en}`, `Đến ${place.name_en} muộn ${NUDGE_MIN} phút`, `${place.name_en}に${NUDGE_MIN}分遅く着く`)}
            >
              <Ionicons name="add" size={17} color={colors.text} />
            </PressableScale>
          </View>

          {/* Remove, alone on the right: the two arrows that stood beside
              it are the hold (and VoiceOver's actions) now. */}
          <View style={s.tools}>
            <PressableScale
              onPress={onRemove}
              containerStyle={s.tool}
              accessibilityRole="button"
              accessibilityLabel={t(`Remove ${place.name_en}`, `Bỏ ${place.name_en}`, `${place.name_en}を外す`)}
            >
              <Ionicons name="close" size={16} color={colors.textTertiary} />
            </PressableScale>
          </View>
        </View>
      </View>
    </Card>
  );
}

const CAPTION = { fontSize: 13, fontWeight: font.regular } as const;

const s = StyleSheet.create({
  // `Card` carries no padding of its own — see the note on the component.
  // It used to be on the card; the hero moved it to the body so the
  // picture can meet the card's edges.
  card: { alignSelf: 'stretch' },
  cardBody: { padding: space.cardPadding },
  rowWrong: { borderColor: colors.accentFill, borderWidth: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  /**
   * The one place a category hue touches a fill.
   *
   * The colour discipline everywhere else — the glyph carries the hue,
   * never a surface — still holds as a rule; this well is its measured
   * exception, from the reference design. The wash is the glyph's *own*
   * colour at 14% alpha, so it reads as the glyph's halo rather than as a
   * second colour, and at that alpha it sits behind the icon as ground in
   * both the cream and the near-black theme. A place with no category
   * keeps the neutral glass instead — a guess would colour it wrong.
   */
  well: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceGlass,
  },
  headCol: { flex: 1, gap: space.nameToMeta },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { ...type.body, color: colors.text, fontWeight: font.semibold, flex: 1 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: {
    ...CAPTION, color: colors.textSecondary,
    fontWeight: font.semibold, fontVariant: ['tabular-nums'],
  },
  area: { ...CAPTION, color: colors.textTertiary },
  railDivider: {
    height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft, marginTop: 12,
  },
  rail: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10,
  },
  timeBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeLabel: { ...CAPTION, color: colors.textSecondary, marginRight: 8 },
  // 34pt, up from 26: the reference draws the stepper as the card's main
  // control, and 26 was under the 30pt a fingertip needs even before the
  // three tools on the right were counted. 44 as drawn would push those
  // tools off a 295pt card in Vietnamese.
  step: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceGlass,
  },
  time: {
    color: colors.text, fontSize: 16, fontWeight: font.semibold,
    width: 52, textAlign: 'center', fontVariant: ['tabular-nums'],
  },
  /** A time the reader set, marked so they can see which ones the planner
   *  will no longer touch. */
  timePinned: { color: colors.accent, fontWeight: font.semibold },
  /** The model's sentence, or the facts standing in for it. A step down
   *  from the name and a step up from the area line, because it is the row's
   *  only claim about why this place rather than another. */
  // Full width under the row now, so it needs the air a new block needs
  // rather than the 3pt that separated it from the line above it inside a
  // column.
  // Two lines' worth of room whether or not two lines arrive.
  //
  // The rule above this line in the body — never a spinner, because a row
  // that shuffled its own height when the words landed would be the screen
  // admitting it was waiting — was written and then not enforced. The
  // fallback is one line of facts and a model's sentence is two, so every
  // card grew 18pt when the narration returned, up to four seconds in.
  // With two stops that is 36pt, and Save to Trips walked out from under
  // whichever finger was reaching for it.
  //
  // `minHeight` rather than a fixed height: the line is capped at two by
  // `numberOfLines`, so this reserves the maximum rather than imposing it,
  // and a language whose caption wraps differently is not clipped.
  why: {
    ...CAPTION, color: colors.textSecondary, lineHeight: 18, marginTop: 10, minHeight: 36,
  },
  tools: { flexDirection: 'row', gap: 2 },
  tool: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  warn: { ...CAPTION, color: colors.accent, marginTop: 8 },
});
