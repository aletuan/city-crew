// One of your own lists, small, at the top of a page about it: the
// Activity page and the Statistics page it opens (owner, 13 Nov 2026).
//
// The collection page's card, smaller: the face and the two lines beside
// it as its head draws them (40, `BYLINE_LINE` each), then the title and
// the words. Three lines of them and no "Read more": it is a reminder of
// which list this is, and the whole of it is one Back away.
//
// ── whose face (15 Nov 2026) ──
//
// The list's author, as the page's head names them: for your own list,
// you from the profile rather than the `curator_handle` stamped on the
// row; for somebody else's, that stamp, and the face the shelf already
// fetched for it (`useCuratorAvatar`), asked for by handle only on a cold
// open. The same two sources, in the same order, as the collection page.
//
// Until that day the card read the profile alone, which was right while
// only an owner could open the two pages. They opened to every reader on
// 15 Nov and the card went on drawing the reader: a list by maydidaudo,
// opened by trang, was headed "trang" over trang's face. No test said
// otherwise because every reader's fixture gave the list no
// `curator_handle` and never looked at the head.
//
// An editorial handle has no profile behind it, so its face is the empty
// disc — the card keeps the slot rather than moving the two lines, since
// unlike the page's head nothing here waits to be laid out once.
//
// ── the head opens the author's page (owner, 16 Nov 2026) ──
//
// The same face and handle on the collection page open the person's
// page, yours included; here they opened nothing, and the owner pressed
// the face and asked. One picture that is a button on one page and not
// on the next reads as a fault. So the head is one press — the face and
// both lines, as a visitor's head is on the page; unlike your own head
// there, no control sits in the second line to be swallowed.
//
// The head only. The title and the words under it stay still: the list
// they would open is the one the reader just came from.
//
// Not for an editorial handle: nobody stands behind it, and a press
// that opens "Nobody here" is a dead control. Somebody is there when
// the shelf holds a face for the handle or the lookup found a row —
// the collection page's rule (`curatorIsPerson`). The card is told
// where to go (`onPerson`) rather than navigating itself, as no
// component here reaches for the navigator.
//
// Drawn on the Activity page alone until the Statistics page needed the
// same reminder; moved here rather than copied, so the two pages about
// one list say which list in one way.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar, Card, PressableScale } from './ui';
import { useProfile } from '../lib/auth';
import { useCuratorAvatar } from '../lib/catalog';
import { useProfileByHandle } from '../lib/data';
import { normalizeHandle } from '../lib/handle';
import { useI18n } from '../lib/i18n';
import { ageWord, listAgeOf } from '../lib/listAge';
import type { Collection } from '../lib/types';
import { colors, font, space, type } from '../theme';

export default function ListSummaryCard({ col, owned, onPerson, testID }: {
  col: Collection;
  /** Whether the list is the reader's own — see the header. */
  owned: boolean;
  /** Opens the author's page, by handle — see the header. */
  onPerson: (handle: string) => void;
  testID: string;
}) {
  const { t, lang } = useI18n();
  const { profile } = useProfile();
  // Normalised before the lookup: editorial rows carry the `@` in the
  // value and `profileByHandle` would find nothing (`lib/handle`).
  const curator = !owned && col.curator_handle ? normalizeHandle(col.curator_handle) || null : null;
  const cached = useCuratorAvatar(curator);
  const lookup = useProfileByHandle(cached ? null : curator);
  const handle = owned ? (profile?.handle ? normalizeHandle(profile.handle) : '') : curator ?? '';
  const face = owned ? profile?.avatar_url || null : cached ?? (lookup.data?.avatar_url || null);
  const title = t(col.title_en, col.title_vi, col.title_ja);
  const desc = t(col.desc_en, col.desc_vi, col.desc_ja);
  const age = col.created_at ? listAgeOf(col.created_at, new Date()) : null;
  const ageText = age ? ageWord(age, lang, t, t('New', 'Mới tạo', '作成したばかり', '刚创建', '剛建立')) : '';
  // Somebody with a page: you, once you have a handle; another author
  // the shelf has a face for or the lookup found — see the header.
  const person = !!handle && (owned || !!cached || !!lookup.data);
  const head = (
    <>
      <Avatar url={face} size={HEAD_FACE} />
      <View style={s.headLines}>
        {handle
          ? <Text style={s.headHandle} numberOfLines={1} testID={`${testID}-handle`}>{handle}</Text>
          : null}
        {ageText ? <Text style={s.headAge}>{ageText}</Text> : null}
      </View>
    </>
  );
  return (
    <Card style={s.card} testID={testID}>
      {person ? (
        <PressableScale
          contentStyle={s.head}
          onPress={() => onPerson(handle)}
          // The collection page's head, pressed (0.97 there): a row this
          // wide at the default scale visibly leaves its card.
          scaleTo={0.97}
          // The face is 40; two more above and below is the 44 a thumb
          // is owed, as on the page.
          hitSlop={{ top: 2, bottom: 2 }}
          haptic="selection"
          accessibilityRole="button"
          // Both lines, as VoiceOver hears the page's head.
          accessibilityLabel={[handle, ageText].filter(Boolean).join(', ')}
          testID={`${testID}-person`}
        >
          {head}
        </PressableScale>
      ) : <View style={s.head}>{head}</View>}
      <View style={s.words}>
        <Text style={s.title} testID={`${testID}-title`}>{title}</Text>
        {desc
          ? <Text style={s.desc} numberOfLines={3} testID={`${testID}-desc`}>{desc}</Text>
          : null}
      </View>
    </Card>
  );
}

/** The card head's face: the collection page's 40 (`FACE` there), so the
 *  two lines beside it stand its height as they do on the page. */
const HEAD_FACE = 40;
/** Each of the head's two lines — half the face, as on the page. */
const HEAD_LINE = HEAD_FACE / 2;
/** Air between the two lines, given back around them so the head is
 *  still the face's height — the page's `BYLINE_GAP`, and its reasons. */
const HEAD_GAP = 3;

const s = StyleSheet.create({
  // The collection page's card rhythm (`descCard` there): 20 above the
  // face, whose disc is solid ink to its edge, and 14 between the head and
  // the words. 16 below, not the page's 9: that 9 gave back the heart
  // row's air, and this card ends on a line of text, whose 24pt line
  // already carries about 4 under the ink — 20 in all, the page's figure.
  card: {
    gap: 14, padding: space.cardPadding, paddingTop: space.cardPadding + 4,
    marginBottom: space.cardGap,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headLines: { flexShrink: 1, gap: HEAD_GAP, marginVertical: -HEAD_GAP / 2 },
  headHandle: { color: colors.text, fontSize: 15, fontWeight: font.semibold, lineHeight: HEAD_LINE },
  // The age under the handle in the third step, as the collection page's
  // own line under the handle is (13 Nov 2026).
  headAge: { color: colors.textTertiary, ...type.meta, lineHeight: HEAD_LINE },
  // The title and the words as one block, 4 apart (`space.nameToMeta`, a
  // name and the line that qualifies it).
  words: { gap: space.nameToMeta },
  // The words' own size and line, bold: the first line of the same text,
  // not a heading over it.
  title: { color: colors.text, ...type.body, fontWeight: font.bold, lineHeight: 24 },
  // The page's description, set as the page sets it: justified, both
  // edges (owner, 3 Nov 2026, and again 13 Nov for this card). It was
  // ragged here at first, as a summary's; the owner wanted the one text
  // to look the same in both places.
  desc: { color: colors.textSecondary, ...type.body, lineHeight: 24, textAlign: 'justify' },
});
