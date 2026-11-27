// What the thread is about, said at its head (owner, 27 Nov 2026).
//
// The page's title is "Comments" and nothing else on it named the list:
// reached from a card on the feed or from a row of Activity, the reader
// was among comments about they could not tell what, and on a thread of
// one comment four fifths of the page was blank. This is one row under the
// title — the list's cover, its name, how many places and whose — and a
// press on it opens the list.
//
// It stays put above the thread and does not scroll with it: it is what
// the page is, like its title, and the field at the foot answers to it.
//
// A list the catalog does not hold (a private one seen through a share,
// one not loaded yet) draws nothing, rather than a row with holes in it:
// the page worked without this row for its first nine days. What it says
// of the list is `components/CommentAbout`, which the quick field shares.
//
// The press goes *back* when the page under this one is that list's own —
// the bubble there is the way most readers come — and opens it otherwise.
// Pushing it regardless stacked list on thread on list, each back press
// retracing a step the reader never took.

import React from 'react';
import { StyleSheet } from 'react-native';
import { AboutLine, useAbout } from '../../components/CommentAbout';
import { PressableScale } from '../../components/ui';
import { Glyph, ICON } from '../../components/ui/glyph';
import type { Subject } from '../../lib/comments';
import { colors, space } from '../../theme';
import type { Nav } from '../../nav';

export default function ThreadAbout({ subject, navigation }: { subject: Subject; navigation: Nav }) {
  const about = useAbout(subject);
  if (!about) return null;
  const open = () => {
    const { routes, index } = navigation.getState();
    const under = routes[index - 1] as { name: string; params?: { slug?: string } } | undefined;
    if (under?.name === 'CollectionDetail' && under.params?.slug === about.slug) navigation.goBack();
    else navigation.navigate('CollectionDetail', { slug: about.slug });
  };
  return (
    <PressableScale
      onPress={open}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={`${about.title}, ${about.facts}`}
      contentStyle={s.row}
      testID="thread-about"
    >
      <AboutLine about={about} />
      <Glyph name="chevron-forward" size={ICON.text} color={colors.textTertiary} />
    </PressableScale>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: space.page, marginBottom: 8, padding: 8,
    borderRadius: 14, backgroundColor: colors.surfaceCard,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlass,
  },
});
