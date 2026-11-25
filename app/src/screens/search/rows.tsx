// Out of `SearchScreen` on 25 Nov 2026, so the screen's function fits the
// ceiling (`oversize.js`); the reasoning moved with the code, unchanged.
// The zero-state's rows and a collection's result row, one component each.

import React from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Glyph, ICON } from '../../components/ui/glyph';
import ListToggle from '../../components/ListToggle';
import NewBadge from '../../components/NewBadge';
import { Card, PressableScale, Tile, TileGrid } from '../../components/ui';
import { type Collection, coverOf, fmtCount, type Place } from '../../lib/data';
import { CATEGORIES, categoryLabel } from '../../lib/categories';
import { openFragment, openState } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { localized } from '../../lib/localized';
import { isNewList } from '../../lib/newest';
import { splitName } from '../../lib/name';
import { browseColumns } from '../../lib/searchRows';
import { colors } from '../../theme';
import { s } from './styles';

/** A zero-state section's eyebrow, and Clear beside Recent. */
export function Eyebrow({ label, clear, onClear }: { label: string; clear?: boolean; onClear: () => void }) {
  const { t } = useI18n();
  return (
    <View style={s.eyebrowRow}>
      <Text style={s.eyebrow}>{label}</Text>
      {/* Clear wipes the whole memory — the reference design has
          no per-row delete, and a memory you can prune one line
          at a time invites tidying a list that exists to be
          overwritten anyway. */}
      {clear ? (
        <PressableScale
          onPress={onClear}
          scaleTo={0.92}
          hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t('Clear recent searches', 'Xoá tìm kiếm gần đây', '最近の検索を消去', '清除最近搜索', '清除最近搜尋')}
        >
          <Text style={s.clear}>{t('Clear', 'Xoá', '消去', '清除', '清除')}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

/** One remembered search. */
export function RecentRow({ term, onRun, onEdit }: { term: string; onRun: () => void; onEdit: () => void }) {
  const { t } = useI18n();
  return (
    // Two promises on one row, the standard split: the words
    // re-run the search as typed, the ↗ only lifts the term into
    // the box so it can be edited before it runs.
    //
    // Siblings, not one inside the other. The ↗ used to sit
    // inside the row's own button, and a button with a label is
    // a single element to VoiceOver — the ↗ inside it could not
    // be reached at all (and on the web it was a <button> in a
    // <button>, which is not valid HTML).
    <View style={s.recentRow}>
      <PressableScale
        style={s.recentHit}
        contentStyle={s.recentMain}
        scaleTo={0.97}
        onPress={onRun}
        accessibilityRole="button"
        accessibilityLabel={term}
      >
        <Glyph name="time-outline" size={ICON.action} color={colors.textTertiary} />
        <Text style={s.recentTerm} numberOfLines={1}>{term}</Text>
      </PressableScale>
      <PressableScale
        onPress={onEdit}
        scaleTo={0.85}
        hitSlop={{ top: 12, bottom: 12, left: 14, right: 14 }}
        accessibilityRole="button"
        accessibilityLabel={t('Edit this search', 'Sửa tìm kiếm này', 'この検索を編集', '编辑此搜索', '編輯此搜尋')}
      >
        <Glyph
          name="arrow-up"
          size={ICON.action}
          color={colors.textTertiary}
          style={{ transform: [{ rotate: '45deg' }] }}
        />
      </PressableScale>
    </View>
  );
}

/** The categories, as doors. */
export function Browse({ cats, onPick }: { cats: string[]; onPick: (label: string) => void }) {
  const { t } = useI18n();
  return (
    // A grid of nine doors, two rows of five (owner, 3 Nov
    // 2026). It was Explore's underline row, stacked (25 Oct):
    // one line that scrolled, which on a 390pt phone showed five
    // and a half of the nine and hid Shopping, Nightlife and Fun
    // — and a row that launches is for seeing what there is,
    // where a row that filters is for someone who already knows.
    // The planner and the taste picker were already grids of
    // the same `Tile`.
    //
    // Five across, not the planner's three: the keyboard is up
    // whenever this shows, and three rows of 82pt cells pushed
    // the popular places under it. Two rows of the compact cell
    // are 104pt where the row was 42. With three recent searches
    // on a 390pt phone the first popular place was whole above
    // the keys and is now two-thirds of it, some 30pt under them
    // (measured on a mock of this page, 3 Nov) — the price of
    // seeing all nine, and the owner's call to pay it.
    //
    // The rows are even (owner, 3 Nov 2026): a city with eight
    // kinds drew five over three, and a short second row reads
    // as the leftovers. `browseColumns` splits them in half, five
    // and under on one row. And 12pt between the two rows: with
    // none, a word sat 10pt over the next row's glyph — closer
    // than the 22 its own glyph was above it — so the second
    // row read as hanging off the first.
    //
    // Nothing is ever chosen here. A tap *is* a search: it types
    // the category's own label into the box, and the haystack —
    // which carries every category's labels in all three
    // languages — does the rest, so a tap can never disagree
    // with typing the same word. The moment there is a word the
    // zero-state yields to results and this grid with it.
    <View style={s.browseGrid} testID="search-browse">
      <TileGrid cols={browseColumns(cats.length)} gap={0} rowGap={12}>
        {cats.map((key) => (
          <Tile
            key={key}
            compact
            label={categoryLabel(key, t)}
            icon={CATEGORIES[key]?.icon ?? 'ellipse-outline'}
            onPress={() => onPick(categoryLabel(key, t))}
            testID={`search-browse-${key}`}
          />
        ))}
      </TileGrid>
    </View>
  );
}

/** A place on the Most popular or Recently added shelf. */
export function ShelfRow({ place: pl, kind, now, tz, toggle, onOpen }: {
  place: Place;
  kind: 'popular' | 'latest';
  now: Date;
  tz: string;
  /** The list's ⊕, when Search was opened from one. */
  toggle?: { on: boolean; title: string; onPress: () => void };
  onOpen: () => void;
}) {
  const { t, lang } = useI18n();
  const cover = coverOf(pl)?.photo_uri;
  // The reference layout, followed exactly: the meta line is
  // *where and until when* — "Bình Thạnh · until 22:00" — and
  // the rating stands alone on the right, where the eye checks
  // it last. The rating used to open the meta line, which made
  // every row lead with the one figure that least separates
  // rows on a shelf where everything is 4-and-something.
  //
  // The time half of the line answers whichever question the
  // clock poses — "until 22:00" open, "opens 08:00" closed,
  // "mở 24/24" for the places that never stop, silence when
  // the hours cannot be read. The grammar lives in
  // `openFragment`, shared with the Explore cards, so the two
  // lists can never learn to disagree about what an hour says.
  const when = openFragment(openState(pl.opening_hours, now, tz), t);
  const area = localized(pl, 'neighborhood', lang);
  const meta = [area, when].filter(Boolean).join(' · ');
  return (
    <PressableScale
      contentStyle={s.row}
      onPress={onOpen}
    >
      <Card style={s.card}>
        {cover
          ? <Image source={{ uri: cover }} style={s.thumb} contentFit="cover" transition={200} />
          : <View style={s.thumb} />}
        <View style={{ flex: 1, gap: 4 }}>
          {/* The brand alone, as `PlaceCard` prints it: the ward
              after the dash is the row below. */}
          <Text style={s.cardTitle} numberOfLines={1}>
            {splitName(localized(pl, 'name', lang)).title}
          </Text>
          {/* The pin belongs to the area, the same mark at
              the same size PlaceCard's district row wears — so
              "what part of town" carries one symbol across the
              app. The time half stays bare text on purpose:
              "until", "opens" and "mở 24/24" already say what
              kind of fact follows, and a clock glyph would
              repeat them in grey. No area, no pin — an icon
              pointing at a closing time would be labelling the
              wrong half of the sentence. */}
          {meta
            ? (
              <View style={s.metaRow}>
                {area
                  ? <Glyph name="location-outline" size={ICON.meta} color={colors.textTertiary} />
                  : null}
                <Text style={s.cardMeta} numberOfLines={1}>{meta}</Text>
              </View>
            )
            : null}
        </View>
        {/* The rating takes the chevron's seat rather than
            sharing the meta line. A row that is plainly a place
            does not need an arrow to say it opens; it needs the
            score, right-aligned, the way the reference draws
            it. Unrated places keep the chevron so the right
            edge is never simply empty.

            With its count, as PlaceCard and the map's card
            print it (owner, 21 Oct 2026). Without one a 5.0
            says nothing about itself: of the 228 published
            places at 4.9 or more, 49 stand on fewer than 50
            reviews and 12 on fewer than 10, beside a 4.7 on
            three thousand. The ranking already weighs the
            count (`rank.ts` shrinks a thin score towards the
            mean), so a 5.0 listed under a 4.8 needs the count
            on screen to read as anything but a mistake. */}
        {pl.rating != null
          ? (
            <View style={s.rowRating}>
              <Text style={s.rowStar}>★</Text>
              <Text style={s.rowRatingValue}>{pl.rating.toFixed(1)}</Text>
              {pl.rating_count
                ? (
                  <Text
                    style={s.rowRatingCount}
                    accessibilityLabel={t(`${pl.rating_count} reviews`, `${pl.rating_count} đánh giá`, `${pl.rating_count}件の評価`, `${pl.rating_count} 条评价`, `${pl.rating_count} 條評價`)}
                  >
                    ({fmtCount(pl.rating_count)})
                  </Text>
                )
                : null}
            </View>
          )
          : <Glyph name="chevron-forward" size={ICON.action} color={colors.textTertiary} />}
        {toggle
          ? <ListToggle {...toggle} testID={`search-${kind}-${pl.slug}-in-list`} />
          : null}
      </Card>
    </PressableScale>
  );
}

/** A collection among the results. */
export function CollectionRow({ collection, count, cover, now, onOpen }: {
  collection: Collection;
  count: number;
  cover?: string;
  now: Date;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  return (
  <PressableScale
    contentStyle={s.row}
    onPress={onOpen}
  >
    <Card style={s.card}>
      <View>
        {cover
          ? <Image source={{ uri: cover }} style={s.thumb} contentFit="cover" transition={200} />
          : <View style={s.thumb} />}
        {/* 4pt in, not the 10 a larger cover takes: on a 64pt
            thumb, 10 would leave the word half off its edge. */}
        {isNewList(collection, now.getTime()) ? <NewBadge style={s.thumbBadge} /> : null}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.cardTitle} numberOfLines={2}>
          {t(collection.title_en, collection.title_vi, collection.title_ja)}
        </Text>
        <Text style={s.cardMeta}>
          {count} {t(count === 1 ? 'place' : 'places', 'địa điểm', 'スポット', '个地点', '個地點')}
        </Text>
      </View>
      <Glyph name="chevron-forward" size={ICON.action} color={colors.textTertiary} />
    </Card>
  </PressableScale>
  );
}
