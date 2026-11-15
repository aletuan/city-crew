// The cells of the collection's list: a place as a card or a tile, held
// and dragged on your own list, still on anybody else's.

import React, { createContext, memo, useContext } from 'react';
import { type AccessibilityActionEvent, Animated, StyleProp, View, ViewStyle } from 'react-native';
import PlaceCard from '../../components/PlaceCard';
import PlaceTile from '../../components/PlaceTile';
import { LIFT_AFTER_MS, useListDrag } from '../../components/useListDrag';
import { useI18n } from '../../lib/i18n';
import type { Place } from '../../lib/types';
import { s } from './styles';

/** Which card is in the finger, for the cell that holds it; -1 for none. */
export const LiftedCard = createContext(-1);

/**
 * The list's cell, raised while its card is lifted.
 *
 * Each card sits in a cell of its own, and a zIndex on the card does not
 * reach past its cell to the siblings it has to pass over, so it is the
 * cell that goes up. Declared here and fed by context rather than written
 * inline on the list: an inline component is a new type every render, and
 * every lift and every slot passed is a render, so each one remounted
 * every card, the one in the finger with its gesture.
 */
export function LiftCell({ index, style, children, ...cell }: {
  index: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const lifted = useContext(LiftedCard);
  return <View {...cell} style={[style, lifted === index && s.arrangeCellLifted]}>{children}</View>;
}

/**
 * A place in your own list: the same card as everywhere else, which can
 * also be held and dragged to a new position.
 *
 * ── on the list itself, not in a mode ──
 *
 * The order used to be set in a separate mode, reached through the menu,
 * that swapped the cards for numbered one-line rows. It worked, and
 * nobody found it. The list you want to put in order is the one in front
 * of you, so that is where the order is changed: hold a card and it
 * lifts; drag it and the cards it passes step aside into the room it
 * left; let go and it lands, and the new order saves itself.
 *
 * A tap still opens the place. The hold is what tells the two apart (see
 * `LIFT_AFTER_MS`): it is the card's own long press, so a press that
 * lifted never also opens the place, and a finger that moves before the
 * hold completes cancels it and scrolls instead.
 *
 * ── the lift is the card's, the drag is the list's ──
 *
 * The card only lifts. The drag after it belongs to a responder on the
 * list around the cards, and the hold, the drag and the drop — and why
 * they are built on the responder system rather than on gesture-handler
 * or reanimated — are `useListDrag`, which the plan editor shares.
 *
 * VoiceOver cannot drag, so the card offers "Move up" and "Move down" as
 * accessibility actions, and says so in its hint.
 */
export const DraggableCard = memo(function DraggableCard({
  place, index, count, style, onOpen, onStep, onLift, onRelease, onPitch,
}: {
  place: Place;
  index: number;
  count: number;
  /** What this card wears right now — raised and travelling, stepped
   *  aside, or nothing — from `useListDrag`'s `styleOf`. */
  style: ReturnType<ReturnType<typeof useListDrag>['styleOf']>;
  onOpen: (slug: string) => void;
  /** Move the place at `index` one step: -1 up, 1 down. */
  onStep: (index: number, by: -1 | 1) => void;
  /** The hold completed: `pageY` is where the finger is, which the drag
   *  measures its travel from. */
  onLift: (index: number, pageY: number) => void;
  /** The card's button let go of the touch, by the finger coming up or by
   *  the list taking the drag over. */
  onRelease: () => void;
  onPitch: (slug: string, pitch: number) => void;
}) {
  const { t } = useI18n();
  const raised = useContext(LiftedCard) === index;
  return (
    <Animated.View
      onLayout={(e) => onPitch(place.slug, e.nativeEvent.layout.height)}
      style={style}
      testID={`drag-${place.slug}`}
    >
      <PlaceCard
        place={place}
        onPress={() => onOpen(place.slug)}
        testID={`collection-place-${index}`}
        raised={raised}
        onLongPress={(e) => onLift(index, e.nativeEvent.pageY)}
        delayLongPress={LIFT_AFTER_MS}
        onPressOut={onRelease}
        {...stepsFor(t, index, count, 'list', () => onStep(index, -1), () => onStep(index, 1))}
      />
    </Animated.View>
  );
});

/**
 * What VoiceOver is offered in place of the drag, and told in the hint: a
 * step either way, only where there is somewhere to go. On the cards a
 * step is up or down. On the grid it is earlier or later, because the next
 * place in the order is beside a tile or, at a row's end, at the start of
 * the row below — "up" there would promise a move of three.
 */
function stepsFor(
  t: ReturnType<typeof useI18n>['t'], index: number, count: number, view: 'list' | 'grid',
  onUp: () => void, onDown: () => void,
) {
  const grid = view === 'grid';
  return {
    accessibilityHint: t(
      'Hold and drag to change the order.',
      'Giữ rồi kéo để đổi thứ tự.',
      '長押ししてドラッグすると並び順を変えられます。',
      '长按并拖动即可调整顺序。', '長按並拖曳即可調整順序。',
    ),
    accessibilityActions: [
      ...(index > 0 ? [{
        name: 'moveUp',
        label: grid
          ? t('Move earlier', 'Đưa lên trước', '前へ移動', '前移', '前移')
          : t('Move up', 'Chuyển lên', '上へ移動', '上移', '上移'),
      }] : []),
      ...(index < count - 1 ? [{
        name: 'moveDown',
        label: grid
          ? t('Move later', 'Đưa ra sau', '後ろへ移動', '后移', '後移')
          : t('Move down', 'Chuyển xuống', '下へ移動', '下移', '下移'),
      }] : []),
    ],
    onAccessibilityAction: (e: AccessibilityActionEvent) => (e.nativeEvent.actionName === 'moveUp' ? onUp() : onDown()),
  };
}

/**
 * A place in your own list as a tile of the grid, which can be held and
 * dragged as the card can. The same hold, the same responder on the list
 * around it, the same save: only the arithmetic of where it lands is the
 * grid's (see `useListDrag`). Every tile is one size, so unlike the card
 * it reports no pitch.
 */
export const DraggableTile = memo(function DraggableTile({
  place, index, count, size, style, onOpen, onStep, onLift, onRelease,
}: {
  place: Place;
  index: number;
  count: number;
  size: number;
  style: ReturnType<ReturnType<typeof useListDrag>['styleOf']>;
  onOpen: (slug: string) => void;
  onStep: (index: number, by: -1 | 1) => void;
  onLift: (index: number, pageY: number, pageX: number) => void;
  onRelease: () => void;
}) {
  const { t } = useI18n();
  return (
    <Animated.View style={style} testID={`drag-${place.slug}`}>
      <PlaceTile
        place={place}
        size={size}
        onPress={() => onOpen(place.slug)}
        testID={`collection-tile-${index}`}
        onLongPress={(e) => onLift(index, e.nativeEvent.pageY, e.nativeEvent.pageX)}
        delayLongPress={LIFT_AFTER_MS}
        onPressOut={onRelease}
        {...stepsFor(t, index, count, 'grid', () => onStep(index, -1), () => onStep(index, 1))}
      />
    </Animated.View>
  );
});

/**
 * A place in somebody else's list, or in yours while it cannot be
 * arranged: a card or a tile that only opens. Behind `memo` like the two
 * above, for the same reason — see "drawn again only when it moved".
 */
export const StillCard = memo(function StillCard({ place, index, chip, onOpen }: {
  place: Place;
  index: number;
  chip: string | null | undefined;
  onOpen: (slug: string) => void;
}) {
  return (
    <PlaceCard place={place} onPress={() => onOpen(place.slug)} chip={chip} testID={`collection-place-${index}`} />
  );
});
export const StillTile = memo(function StillTile({ place, index, size, onOpen }: {
  place: Place;
  index: number;
  size: number;
  onOpen: (slug: string) => void;
}) {
  return <PlaceTile place={place} size={size} onPress={() => onOpen(place.slug)} testID={`collection-tile-${index}`} />;
});
