// What the reader and the person whose page this is have in common.
//
// ── why it is a section (owner, 16 Nov 2026) ──
//
// The page said "3 mutual saves" on the line that counts a person's
// lists — to a friend only, and as a number that opened nothing. The
// owner asked for it apart: that line is about the person, this is about
// the two of you, and a count of places is less than the places. Two
// kinds to begin with, each a row that scrolls sideways:
//
//   - places you both keep in public collections;
//   - public collections you both liked.
//
// ── who sees it ──
//
// Anybody signed in, a friend or not; nobody signed out; never yourself.
// The owner's worry the same day was a stranger seeing too much, and
// these two were let through it because of what they are: only the part
// of this person's public doings that the reader shares, computed from
// nothing private. The rule, and what was kept out by it (check-ins,
// private saves), is written where it is enforced —
// `20261116120000_in_common.sql`. A block between the two answers
// nothing, so nothing is drawn.
//
// ── what it draws when there is little ──
//
// Nothing at all for nothing in common, while the answer is out, and
// when it could not be had: a heading over an empty row, or a spinner in
// the middle of somebody's page for a section most pairs will not have,
// is worse than its absence. One kind without the other draws that row
// alone.
//
// A liked list is drawn from the shelf in memory, by the slug the
// database answered: every public list is there, and one that is not is
// a list this reader cannot open. A place is drawn from the answer
// itself — it carries its own name and photograph, because what two
// people share is not confined to the one city the catalog holds.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { PressableScale } from './ui';
import { useCollections, usePlaces } from '../lib/catalog';
import { type Collection, coverUriOf, membersOf, useInCommonQuery } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { localized } from '../lib/localized';
import { colors, font, space } from '../theme';
import type { Nav } from '../nav';

/**
 * How many of each kind a row shows: five (owner, 16 Nov 2026).
 *
 * The database answers up to thirty, and the first pair it was tried on
 * — the owner's account and a friend's — had thirty collections liked in
 * common: a strip of thirty tiles across the middle of somebody's page,
 * above the collections the page is about. The section is a glance at
 * what you share, not a list of it. Five is the owner's number; at 116pt
 * a tile, three are on a phone's screen and two more are a short pull.
 *
 * The first five as the database orders them: collections by the latest
 * like of either of you, places by name. Cut here and not in the two
 * functions, so that a "see all" later is a screen and not a migration.
 * Nothing says there are more: the row does not claim to be the whole.
 */
export const IN_COMMON_SHOWN = 5;

/** A tile: a photograph and two lines of name under it. Small — a row
 *  of them is a glance, and the page's own tiles are below. */
const TILE_W = 116;
const TILE_PHOTO_H = 87;

function Tile({ title, uri, onPress, testID }: {
  title: string; uri: string | null | undefined; onPress: () => void; testID: string;
}) {
  return (
    <PressableScale onPress={onPress} haptic="selection" accessibilityRole="button" accessibilityLabel={title} testID={testID}>
      <View style={s.tile}>
        {uri
          ? <Image source={{ uri }} style={s.photo} contentFit="cover" transition={160} />
          : <View style={[s.photo, s.tint]} />}
        {/* Two lines kept whether or not the name fills them, so a row
            of tiles is one height. */}
        <Text style={s.name} numberOfLines={2}>{title}</Text>
      </View>
    </PressableScale>
  );
}

export default function InCommon({ me, otherId, navigation }: {
  me: string | null;
  otherId: string;
  navigation: Nav;
}) {
  const { t, lang } = useI18n();
  const q = useInCommonQuery(me, otherId);
  const shelf = useCollections();
  const catalog = usePlaces();

  const places = q.data.places.slice(0, IN_COMMON_SHOWN);
  const lists = q.data.lists
    .map((slug) => shelf.data.find((c) => c.slug === slug))
    .filter((c): c is Collection => !!c)
    .slice(0, IN_COMMON_SHOWN);
  if (places.length === 0 && lists.length === 0) return null;

  return (
    <View testID="person-in-common">
      <Text style={s.sectionLabel}>{t('In common', 'Điểm chung', '共通点', '共同点', '共同點')}</Text>
      {places.length > 0 ? (
        <>
          <Text style={s.rowLabel}>
            {t('Places you both keep', 'Địa điểm cả hai cùng lưu', 'お互いが保存しているスポット', '你们都收藏的地点', '你們都收藏的地點')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.bleed} contentContainerStyle={s.row} testID="common-places">
            {places.map((p) => (
              <Tile
                key={p.slug}
                title={localized(p, 'name', lang)}
                uri={p.photo_uri}
                onPress={() => navigation.navigate('PlaceDetail', { slug: p.slug })}
                testID="common-place"
              />
            ))}
          </ScrollView>
        </>
      ) : null}
      {lists.length > 0 ? (
        <>
          <Text style={[s.rowLabel, places.length > 0 && s.rowLabelNext]}>
            {t('Collections you both liked', 'Bộ sưu tập cùng thích', 'お互いがいいねしたコレクション', '你们都赞过的合集', '你們都贊過的合集')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.bleed} contentContainerStyle={s.row} testID="common-lists">
            {lists.map((c) => (
              <Tile
                key={c.slug}
                title={localized(c, 'title', lang)}
                uri={coverUriOf(c, membersOf(c, catalog.data))}
                onPress={() => navigation.navigate('CollectionDetail', { slug: c.slug })}
                testID="common-list"
              />
            ))}
          </ScrollView>
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  // The page's section label, as "Collections" under it wears.
  sectionLabel: {
    color: colors.textTertiary, fontSize: 12, fontWeight: font.semibold,
    textTransform: 'uppercase', letterSpacing: 1.2,
    marginTop: 22, marginBottom: 10,
  },
  rowLabel: { color: colors.textSecondary, fontSize: 14, marginBottom: 8 },
  rowLabelNext: { marginTop: 14 },
  // The row runs to the screen's edges and starts on the page's margin,
  // so a tile cut off at the right says there are more.
  bleed: { marginHorizontal: -space.page },
  row: { paddingHorizontal: space.page, gap: 10 },
  tile: { width: TILE_W, gap: 6 },
  photo: { width: TILE_W, height: TILE_PHOTO_H, borderRadius: 14 },
  tint: { backgroundColor: colors.accentSoft },
  name: { color: colors.text, fontSize: 13, fontWeight: font.medium, lineHeight: 17, minHeight: 34 },
});
