// A collection's cover picker: every photograph the list's places hold,
// three to a line, one of them ringed. It stood in the collection's form
// until 22 Nov 2026, when the camera on the list's page took it over
// (`CollectionCoverSheet`) and the form stopped carrying a cover.
//
// Moved out of `CollectionFormScreen` on 16 Nov 2026, whole, when it next
// had to grow: the form's one function stood at its ceiling
// (`oversize.js`), and the grid is the part of it with rules of its own.
// What decides WHICH photographs are on offer stays with the form, which
// knows the list; what order they stand in, whether "Auto" is among them
// and how the chosen one says so is here.

import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { Glyph, ICON } from './ui/glyph';
import { PressableScale } from './ui';
import { useI18n } from '../lib/i18n';
import { localized } from '../lib/localized';
import { colors, font, radius, space } from '../theme';
import type { Place, PlacePhoto } from '../lib/types';

/**
 * The cover picker's shape: three tiles to a line.
 *
 * It was one horizontal row of 64pt thumbs, and two things were wrong
 * with that. The thumbs were too small to tell one dim bar interior from
 * another, and a row that scrolls sideways hides most of what it holds —
 * four and a half chips visible out of ten, with nothing saying there are
 * more. A grid fixed the second problem straight away.
 *
 * The first took two goes. Four to a line was chosen over three to save
 * a row, on the argument that height is what a form cannot spend: its
 * first field takes focus on open and the keyboard covers the lower
 * third while the reader types. The argument was sound and the result
 * was still too small — the owner looked at four on the phone and asked
 * for bigger, which is the only test this particular question has. This
 * catalog is mostly night photography, and 80pt of a dim bar interior is
 * not enough to tell it from the next dim bar interior.
 *
 * Three gives 112 a side against 82 on a 402pt phone: a third wider, and
 * near twice the area to judge a photograph by. The price is the extra
 * row it was meant to save, and the price is affordable because the
 * screen scrolls — the keyboard hides rows, it does not forbid them.
 */
const COVER_COLS = 3;
const COVER_GAP = 10;

/** One photograph on offer: whose it is, and which of that place's it is,
 *  so a tile can say its own name — see the form's `choices`. */
export type CoverChoice = { ph: PlacePhoto & { id: string }; place: Place; n: number; of: number };

/**
 * The mark on the chosen tile (owner, 16 Nov 2026): a tick in a disc, in
 * the corner, over the ring the tile already wore.
 *
 * The ring alone is 2pt of the accent round a photograph, and on a grid
 * of thirty it is found by looking for it. The tick is found at a glance,
 * and it is the mark this app gives the one chosen thing in a set — the
 * view rows of a list's menu, a sheet of choices.
 *
 * The disc is `accentFill` and the tick `accentInk`, the pair a filled
 * button wears: 4.5:1 or better on every look (`theme.test`, "accentInk"),
 * whatever the photograph under the disc is. 22pt with a 15pt tick, 6 in
 * from the corner: about a fifth of a 111pt tile, so it marks the picture
 * without covering what makes it worth choosing.
 */
function Tick() {
  return (
    <View style={s.tick} testID="cover-tick">
      <Glyph name="checkmark" size={ICON.text} color={colors.accentInk} />
    </View>
  );
}

/**
 * The grid.
 *
 * ── the cover the list has leads it (owner, 16 Nov 2026) ──
 *
 * The photographs stood in the list's own order, place by place, with the
 * chosen one ringed wherever it fell. On a list of eleven places that is
 * some dozens of tiles, and the owner opened the form of one whose cover
 * was a bar's interior and saw three pictures of a wooden house: nothing
 * ringed in view, and no way to tell which picture the list wore short of
 * scrolling to look for a 2pt ring.
 *
 * So the first tile is always the cover as it stands. `opened` is the
 * cover the form opened with, and its tile is taken out of its place's
 * run and put first. Not `picked`, the cover as the reader is choosing
 * it: a tile that jumped to the front when tapped would move every tile
 * after it under the finger that had just tapped. The ring and the tick
 * go to what is tapped; the tiles stay where they are until the form is
 * next opened.
 *
 * ── and "Auto" is offered only until a cover is chosen (owner, same day) ──
 *
 * Auto is the null pick: the list wears its first place's own cover. It
 * led the grid always, wearing that picture, with the same picture again
 * as the next tile. The owner's reading: it answers "where does the cover
 * come from while I have not chosen one", and once one is chosen it is a
 * tile in the first place saying nothing. So it is drawn only when no
 * tile here is the cover the form opened with.
 *
 * That is a little wider than "no cover chosen", on purpose. A cover
 * whose photograph is not on offer — the rest of a place's photographs
 * still on their way, or one the desk has since hidden — has no tile to
 * lead with, and a grid with neither Auto nor a ring would be a set of
 * choices with no way to say "none of these". There Auto stands first,
 * unringed, and is the way out. When the photographs land, the chosen
 * one takes Auto's place in the same slot, so nothing else moves.
 *
 * What it gives up is the way back to Auto from a chosen cover. All Auto
 * did that a chosen cover does not is follow the list's first place as
 * the list is reordered. The one case where that mattered — the chosen
 * photograph's place taken out of the list — is handled for the owner
 * instead: `chosenCoverOf` reads such a cover as none.
 *
 * Rejected: a preview of the current cover above the grid, changing with
 * each tap. The clearest of the three, and a row of height on a form the
 * keyboard already takes half of.
 */
export function CoverGrid({ choices, opened, picked, autoUri, onPick }: {
  choices: readonly CoverChoice[];
  /** The cover the form opened with: a photograph's id, or null for Auto. */
  opened: string | null;
  /** The cover as it stands now, a tap or two later. */
  picked: string | null;
  /** What Auto resolves to — the first place's own cover, if it has one. */
  autoUri: string | undefined;
  onPick: (id: string | null) => void;
}) {
  const { t, lang } = useI18n();
  const { width } = useWindowDimensions();
  // Sized off the window rather than guessed: the page gives up
  // `space.page` at each edge and `COVER_GAP` between each pair of
  // tiles, and what is left divides by `COVER_COLS`. On a 402pt phone
  // that is 112 a side; on the small phones it shrinks with the page
  // instead of pushing a tile half off the screen.
  // Floored, not rounded: the tiles plus their gaps have to come in
  // under the line, and a fraction over sends the last to the next row.
  // The leftover — under a point — sits at the end of each row.
  //
  // Width and height stay on `contentStyle` rather than `style`, where
  // `PressableScale`'s note sends a width. The note is about a width that
  // has to survive its parent's layout; here the Pressable shrink-wraps
  // the sized view inside it, which is what the 64pt thumbs did before.
  const tile = Math.floor(
    (width - space.page * 2 - COVER_GAP * (COVER_COLS - 1)) / COVER_COLS,
  );
  const lead = choices.find((c) => c.ph.id === opened);
  const offered = lead ? [lead, ...choices.filter((c) => c !== lead)] : choices;
  return (
    <View style={s.coverBlock}>
      <View style={s.coverGrid}>
        {!lead && (
          <PressableScale
            onPress={() => onPick(null)}
            accessibilityRole="button"
            accessibilityLabel={t('Auto', 'Tự động', '自動', '自动', '自動')}
            accessibilityState={{ selected: picked == null }}
            // `aria-selected` beside it, because react-native-web drops
            // `accessibilityState` — the same pairing `Chip` and `Tile`
            // carry, and the note there is the one to read.
            aria-selected={picked == null}
            contentStyle={[s.thumb, { width: tile, height: tile }, s.auto, picked == null && s.thumbOn]}
          >
            {/* The chip wears the picture Auto would use, so "what is
                the cover right now" has a visible answer even before
                anything is picked. A first place with no photograph
                leaves the glass chip — nothing to preview. */}
            {autoUri ? (
              <>
                <Image source={{ uri: autoUri }} style={s.thumbImg} contentFit="cover" transition={120} />
                <View style={s.autoScrim}>
                  <Text style={s.autoOnPhoto}>{t('Auto', 'Tự động', '自動', '自动', '自動')}</Text>
                </View>
              </>
            ) : (
              <>
                <Glyph name="sparkles-outline" size={ICON.nav} color={colors.textSecondary} />
                <Text style={s.autoText}>{t('Auto', 'Tự động', '自動', '自动', '自動')}</Text>
              </>
            )}
            {picked == null && <Tick />}
          </PressableScale>
        )}
        {offered.map(({ ph, place, n, of }) => (
          <PressableScale
            key={ph.id}
            onPress={() => onPick(ph.id)}
            accessibilityRole="button"
            // Named, and numbered where a place has more than one:
            // four tiles all called "Heim" is a list a listener
            // cannot move through.
            accessibilityLabel={of > 1
              ? t(
                `${localized(place, 'name', lang)}, photo ${n} of ${of}`,
                `${localized(place, 'name', lang)}, ảnh ${n} trên ${of}`,
                `${localized(place, 'name', lang)}、写真${n}/${of}`,
                `${localized(place, 'name', lang)}，第 ${n} 张照片，共 ${of} 张`, `${localized(place, 'name', lang)}，第 ${n} 張照片，共 ${of} 張`,
              )
              : localized(place, 'name', lang)}
            accessibilityState={{ selected: picked === ph.id }}
            aria-selected={picked === ph.id}
            contentStyle={[s.thumb, { width: tile, height: tile }, picked === ph.id && s.thumbOn]}
          >
            <Image source={{ uri: ph.photo_uri }} style={s.thumbImg} contentFit="cover" transition={120} />
            {picked === ph.id && <Tick />}
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  coverBlock: {},
  // The tiles size themselves off the window — see `tile` — so the grid
  // only has to wrap them and space them. `gap` does both axes, which is
  // what keeps the rows as far apart as the columns.
  coverGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: COVER_GAP },
  // 2pt of always-there border so the chosen ring changes colour, not
  // layout — a tile that grows on selection makes the whole grid shuffle.
  // The glass under the picture, not merely behind it: a tile whose
  // photograph has not arrived used to be nothing at all — the page
  // showing through a box with no ground of its own. Ten tiles loaded
  // before anyone noticed; a whole list's photographs do not, and the
  // grid read as holes punched in itself while they came in.
  thumb: {
    borderRadius: radius.image, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden',
    backgroundColor: colors.surfaceGlass,
  },
  thumbOn: { borderColor: colors.accentFill },
  // Wrapped, all nine in view: a row that scrolls sideways hides most of
  // what it holds (the cover grid's note says the same of its chips).
  thumbImg: { width: '100%', height: '100%' },
  auto: {
    alignItems: 'center', justifyContent: 'center', gap: 3,
    backgroundColor: colors.surfaceGlass,
  },
  autoText: { color: colors.textSecondary, fontSize: 12, fontWeight: font.medium },
  autoScrim: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(8,7,10,0.55)', paddingVertical: 3, alignItems: 'center',
  },
  autoOnPhoto: { color: '#F7F7F5', fontSize: 11, fontWeight: font.semibold },
  // The chosen tile's mark — see `Tick`.
  tick: {
    position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentFill,
  },
});
