// One visit on the check-ins list.
//
// Out of `VisitedScreen` on 24 Nov 2026, when the row gained its third
// line — the note, or the line that asks for one (`VisitNote`) — and the
// screen, held to the size it stood at (`oversize.js`), had no room for
// it. Why the row leads with a picture, and why only a visit at a place
// since removed keeps its ⋯, is written at the head of that screen.
//
// The third line is under the date and not beside it: a note is a
// sentence, the date's line is already three facts, and the row's end is
// the chevron's. It makes a row with words taller than one without, and
// the picture stays on the row's middle either way.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import CheckinSheet from '../../components/CheckinSheet';
import VisitNote from '../../components/VisitNote';
import { PressableScale } from '../../components/ui';
import { Glyph, ICON } from '../../components/ui/glyph';
import { AUDIENCE_ON, audienceOf, type Checkin } from '../../lib/checkin';
import { useI18n } from '../../lib/i18n';
import { colors, font, space, type } from '../../theme';

const LINE = 21;
/** The thumbnail's side: 56, the size a content thumbnail takes in a
 *  list that is about the content (Apple Music's lists, Spotify's).
 *  It opened at 48 and was taken to 44 to match the face on Activity;
 *  the owner's eye on the phone said both were too small, and the
 *  reason is fair — a picture of a place has a whole room in it and
 *  needs the pixels to read, where a face reads at 44. So a place's
 *  picture and a person's face are two sizes on purpose, each the size
 *  its subject needs. Radius 12 keeps the 48:10 proportion. Two lines
 *  of text stand about 41pt; the row is 80 with the padding. */
const THUMB = 56;

export function VisitRow({ v, name, meta, divided, onOpen, onMenu, onNote }: {
  v: Checkin;
  name: string;
  meta: string;
  /** Not the first of its month: a hairline over it. */
  divided: boolean;
  /** To the place — absent when the catalog no longer has it. */
  onOpen?: () => void;
  onMenu: () => void;
  onNote: () => void;
}) {
  const { t } = useI18n();
  return (
    <PressableScale
      contentStyle={[s.row, divided && s.rowDivider]}
      onPress={onOpen}
      // A button only when it goes somewhere — the same
      // condition as the chevron, so what VoiceOver hears
      // and what the eye sees agree.
      accessibilityRole={onOpen ? 'button' : undefined}
      testID="visit-row"
    >
      <View style={s.thumb} testID="visit-thumb">
        {v.place?.cover ? (
          <Image source={{ uri: v.place.cover }} style={s.thumbImage} contentFit="cover" transition={150} aria-hidden />
        ) : (
          <Glyph name="location-outline" size={ICON.action} color={colors.textTertiary} />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.name} numberOfLines={2} testID="visit-name">{name}</Text>
        <Text style={s.meta} testID="visit-meta">{meta}</Text>
        <VisitNote note={v.note} onEdit={onNote} />
      </View>
      {onOpen ? (
        <Glyph name="chevron-forward" size={ICON.action} color={colors.textTertiary} style={s.rowEnd} />
      ) : (
        <PressableScale
          onPress={onMenu}
          scaleTo={0.85}
          hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
          style={s.rowEnd}
          accessibilityRole="button"
          accessibilityLabel={t('Options', 'Tuỳ chọn', 'オプション', '选项', '選項')}
        >
          <Glyph name="ellipsis-horizontal" size={ICON.nav} color={colors.textTertiary} />
        </PressableScale>
      )}
    </PressableScale>
  );
}

/**
 * The sheet a row's note opens, over the visit `v` (none: put away).
 * Here, and not built in the screen, for the screen's size again; and
 * because what a visit is to the sheet — its own answer about who sees
 * it, never the reader's latest; not fresh — is the row's business.
 */
export function VisitNoteSheet({ v, nameOf, onDone, reload }: {
  v: Checkin | null;
  nameOf: (v: Checkin) => string;
  onDone: () => void;
  reload: () => void;
}) {
  return (
    <CheckinSheet
      visit={v ? {
        id: v.id, name: nameOf(v), cover: v.place?.cover, at: v.at,
        note: v.note ?? null, audience: audienceOf(v), fresh: false,
      } : null}
      withAudience={AUDIENCE_ON}
      onClose={(saved) => { onDone(); if (saved) reload(); }}
    />
  );
}

const s = StyleSheet.create({
  // Centred: a 56pt picture beside two lines of text wants its middle
  // on theirs, where a 19pt glyph wanted the first line's. 12 of
  // padding puts the 56 in an 80pt row.
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: space.cardPadding, paddingVertical: 12,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  rowEnd: { alignSelf: 'center' },
  thumb: {
    width: THUMB, height: THUMB, borderRadius: 12, overflow: 'hidden',
    backgroundColor: colors.surfaceGlassStrong, alignItems: 'center', justifyContent: 'center',
  },
  thumbImage: { width: THUMB, height: THUMB },
  name: { color: colors.text, fontSize: 15, lineHeight: LINE, fontWeight: font.medium },
  meta: { color: colors.textTertiary, ...type.meta },
});
