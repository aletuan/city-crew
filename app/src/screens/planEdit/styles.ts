// PlanEditScreen's stylesheet: as it was in one file.

import { StyleSheet } from 'react-native';
import { colors, font, radius, type } from '../../theme';

const CAPTION = { fontSize: 13, fontWeight: font.regular } as const;

export const s = StyleSheet.create({
  body: { ...type.body, color: colors.textSecondary },

  // Wrapping, so a fourth chip (the spend, behind its switch) or a long
  // Vietnamese company label takes a second line rather than running off
  // the page. 8pt between chips both ways.
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  // The filter chip's shape (`Chip` in ui/controls.tsx) at the filter chip's
  // measurements, filled rather than outlined because these are read, not
  // pressed — the outline is what the filter row uses to say "tap me".
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: colors.surfaceGlass, borderRadius: radius.pill,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  chipText: { color: colors.text, fontSize: 14, fontWeight: font.medium, fontVariant: ['tabular-nums'] },

  hint: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  // The responder that carries a lifted stop: the list's whole height.
  dragArea: { flex: 1 },
  hintText: { ...CAPTION, color: colors.textSecondary },

  // The rail column is `components/rail`'s 16pt; the card takes the rest.
  // 12pt between them, the same gap the identity band keeps between its
  // well and the name, so the page's two left edges line up with the
  // card's. `stretch`, so the rail's line spans the card and the leg.
  stopRow: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  // The card and the leg out of it, in one column beside the rail. 12pt
  // under a stop that has one after it: the leg row adds its own above
  // the figure, so a stop with a measured leg is card, 12, figure, 12,
  // next card — close to the 44pt the old leg row held — and a stop whose
  // leg could not be measured still clears the next card.
  column: { flex: 1 },
  // The screen's own cards — the empty and the gone states — stretch to
  // the column, as the stop card does inside `StopCard`.
  card: { alignSelf: 'stretch' },
  columnGap: { paddingBottom: 12 },






  // `LegRow`'s place on this screen: 12pt under the card, in the card's
  // column so the figure starts where the card does.
  leg: { paddingTop: 12 },

  save: { height: 18 },
  note: { ...CAPTION, color: colors.textTertiary, marginTop: 12 },
});
