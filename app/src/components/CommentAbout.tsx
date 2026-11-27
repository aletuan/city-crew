// The list a thread is about, drawn where comments are read and written
// (owner, 27 Nov 2026).
//
// Two places say it. The thread's page says it in a row under its title
// (`screens/comments/ThreadAbout`), and the field raised over a page for a
// first comment (`CommentQuick`) says it in a card standing on the field.
// Both take what they say from here, so the two cannot name a list
// differently: its cover, its name, how many places, whose.
//
// ── the card over the page, and what it was weighed against ──
//
// Over a feed the dim falls on every card alike, the one that was pressed
// included, and that card may be under the field: a line of small type in
// the field was all that said what the words were for. The picture agreed
// with the owner keeps the pressed card lit above the field. This draws
// that picture with a card of its own, riding the field, rather than by
// scrolling the page and cutting a hole in the dim over the card itself:
// that needs the card measured on the screen and the page's scroll view in
// hand, in each of the three places a bubble stands (the feed, a list's
// page, a person's), and none of it can be checked without a phone. If
// the copy reads as a copy, that is the next step, one page at a time.
//
// A list the catalog does not hold answers null, and each place then says
// what it said before this existed.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useCollections, usePlaces } from '../lib/catalog';
import type { Subject } from '../lib/comments';
import { coverUriOf, membersOf } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { localized } from '../lib/localized';
import { colors, font, space } from '../theme';

export type About = { slug: string; title: string; facts: string; uri: string | undefined };

/** What to say of the list `subject` names, or null when it is not known. */
export function useAbout(subject: Subject | null): About | null {
  const { t, lang } = useI18n();
  const { data: lists } = useCollections();
  const { data: places } = usePlaces();
  const list = subject ? lists.find((c) => c.id === subject.id) : undefined;
  if (!list) return null;
  const n = list.collection_places.length;
  return {
    slug: list.slug,
    title: localized(list, 'title', lang),
    facts: [
      `${n} ${t(n === 1 ? 'place' : 'places', 'địa điểm', 'スポット', '个地点', '個地點')}`,
      ...(list.curator_handle ? [list.curator_handle] : []),
    ].join(' · '),
    uri: coverUriOf(list, membersOf(list, places)),
  };
}

/** Cover, name and facts in a line: the inside of the thread's row. */
export function AboutLine({ about }: { about: About }) {
  return (
    <>
      {about.uri
        ? <Image source={{ uri: about.uri }} style={s.thumb} contentFit="cover" />
        : <View style={[s.thumb, s.blank]} />}
      <View style={s.words}>
        <Text style={s.title} numberOfLines={1}>{about.title}</Text>
        <Text style={s.facts} numberOfLines={1}>{about.facts}</Text>
      </View>
    </>
  );
}

/** The card that stands on the quick field: the list, lit, over the dim. */
export function AboutCard({ about }: { about: About }) {
  return (
    <View style={s.card} testID="comment-about-card" accessibilityLabel={`${about.title}, ${about.facts}`}>
      {about.uri
        ? <Image source={{ uri: about.uri }} style={s.cover} contentFit="cover" />
        : <View style={[s.cover, s.blank]} />}
      <View style={s.under}>
        <Text style={s.title} numberOfLines={1}>{about.title}</Text>
        <Text style={s.facts} numberOfLines={1}>{about.facts}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // A comment's face is 32; a little over it, so the list reads as what
  // the faces below are talking about and not as one of them.
  thumb: { width: 40, height: 40, borderRadius: 8 },
  blank: { backgroundColor: colors.surfaceGlassStrong },
  words: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: font.semibold },
  facts: { color: colors.textTertiary, fontSize: 12, lineHeight: 16 },
  card: {
    marginHorizontal: space.page, marginBottom: 10,
    borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surfaceCard,
  },
  // Short: the keyboard has half the screen and the field a row of what
  // is left, and the card must not push the page's own top out of sight.
  // 96 is a feed card's cover at about half its height — drawn, not
  // measured on a phone.
  cover: { width: '100%', height: 96 },
  under: { paddingHorizontal: 12, paddingVertical: 8 },
});
