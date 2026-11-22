// A row of a freshly opened list, arriving: it rises 16pt, grows from 0.86
// and fades in, each row a step after the one above. The numbers live in
// `lib/coverMorph`.
//
// It is the list's own cell that arrives (`LiftCell`), not the tile in it:
// the tiles are lifted, dragged and stepped aside by code that reaches
// over their neighbours with a zIndex, and a wrapper between a tile and its
// row would be a stacking context that code could not reach out of.
//
// Decided when the row mounts. Rows past the fourth are mounted by the
// list as the reader scrolls, and a row that has arrived stays arrived.

import { ARRIVE_MS, arriveDelay, arrives } from '../lib/coverMorph';
import { useArrival, useReducedMotion } from './ui/motion';

export function useRowArrival(row: number) {
  const still = useReducedMotion();
  const v = useArrival(ARRIVE_MS, arriveDelay(row), still || !arrives(row));
  return {
    opacity: v,
    transform: [
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
    ],
  };
}
