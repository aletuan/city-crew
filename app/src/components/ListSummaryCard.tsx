// One of your own lists, small, at the top of a page about it: the
// Activity page and the Statistics page it opens (owner, 13 Nov 2026).
//
// The collection page's card, smaller: the face and the two lines beside
// it as its head draws them (40, `BYLINE_LINE` each), then the title and
// the words. Three lines of them and no "Read more": it is a reminder of
// which list this is, and the whole of it is one Back away. The handle is
// yours from the profile, as the page's head takes it, not the
// `curator_handle` stamped on the row.
//
// Drawn on the Activity page alone until the Statistics page needed the
// same reminder; moved here rather than copied, so the two pages about
// one list say which list in one way.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar, Card } from './ui';
import { useProfile } from '../lib/auth';
import { normalizeHandle } from '../lib/handle';
import { useI18n } from '../lib/i18n';
import { ageWord, listAgeOf } from '../lib/listAge';
import type { Collection } from '../lib/types';
import { colors, font, space, type } from '../theme';

export default function ListSummaryCard({ col, testID }: { col: Collection; testID: string }) {
  const { t, lang } = useI18n();
  const { profile } = useProfile();
  const title = t(col.title_en, col.title_vi, col.title_ja);
  const desc = t(col.desc_en, col.desc_vi, col.desc_ja);
  const age = col.created_at ? listAgeOf(col.created_at, new Date()) : null;
  return (
    <Card style={s.card} testID={testID}>
      <View style={s.head}>
        <Avatar url={profile?.avatar_url || null} size={HEAD_FACE} />
        <View style={s.headLines}>
          {profile?.handle
            ? <Text style={s.headHandle} numberOfLines={1}>{normalizeHandle(profile.handle)}</Text>
            : null}
          {age
            ? <Text style={s.headAge}>{ageWord(age, lang, t, t('New', 'Mới tạo', '作成したばかり', '刚创建', '剛建立'))}</Text>
            : null}
        </View>
      </View>
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
  headLines: { flexShrink: 1 },
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
