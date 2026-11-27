// Out of `PlaceCard` on 27 Nov 2026, so its function fits the ceiling
// (`oversize.js`); the reasoning moved with the code, unchanged.
// The line under the name: where, how far, open till when, and what kind.

import React from 'react';
import { Text, View } from 'react-native';
import { Glyph, ICON } from './ui/glyph';
import { colors } from '../theme';
import { KindPill } from './KindPill';
import { s } from './placeCardStyles';

export function PlaceCardMeta({ where, far, when, kind, more, testID }: {
  where: string | null;
  far: string | null;
  when: string | null;
  kind: string | null;
  /** How many more kinds than the one the pill names. */
  more: number;
  testID?: string;
}) {
  return (
    <>
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
                ? <Glyph name="location-outline" size={ICON.meta} color={colors.textTertiary} />
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
          {kind ? <KindPill kind={kind} more={more} bare testID={testID ? `${testID}-kind` : undefined} /> : null}
        </View>
      )}
    </>
  );
}
