// Out of `IdeasScreen` on 25 Nov 2026, so the screen's function fits the
// ceiling (`oversize.js`); the reasoning moved with the code, unchanged.

import React from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Glyph, ICON } from '../../components/ui/glyph';
import { Card, PressableScale, SelectTick } from '../../components/ui';
import type { City } from '../../lib/city';
import { coverUriOf } from '../../lib/data';
import { useI18n } from '../../lib/i18n';
import { placesOf } from '../../lib/collectionShelf';
import { colors, space } from '../../theme';
import { MoreRow } from './parts';
import { s } from './styles';
import type { Seed } from './useSeedLists';

/**
 * How many of the community's lists a reader with none of their own sees
 * before the tap. Three rows are about 200pt — one card that still leaves
 * the Plan button on the first screen of an iPhone 15 — and the three
 * ranked first are the city's answer to "what is there"; the rest is a
 * longer list of the same kind, not a different offer.
 */
const COMMUNITY_FIRST = 3;

/** The lists a plan can start from, yours and the community's. */
export function Seeds({ own, community, from, onToggle, more, onMore, city, moved, cityName }: {
  own: Seed[];
  community: Seed[];
  /** The slugs ticked. */
  from: string[];
  onToggle: (slug: string) => void;
  more: boolean;
  onMore: () => void;
  city: City | null;
  moved: City | null;
  cityName: (c: City) => string;
}) {
  const { t } = useI18n();
  /** One list as a row: cover, name, the places here, a tick. */
  const seedRow = ({ c, members }: Seed, i: number) => {
    const cover = coverUriOf(c, members);
    const on = from.includes(c.slug);
    return (
      <View key={c.slug}>
        {i > 0 ? <View style={s.divider} /> : null}
        <PressableScale
          onPress={() => onToggle(c.slug)}
          contentStyle={s.fromRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: on }}
        >
          {cover
            ? <Image source={{ uri: cover }} style={s.thumb} contentFit="cover" transition={200} />
            : <View style={[s.thumb, s.thumbEmpty]}>
                <Glyph name="bookmark-outline" size={ICON.action} color={colors.accentFaint} />
              </View>}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.fromTitle} numberOfLines={1}>
              {t(c.title_en, c.title_vi, c.title_ja)}
            </Text>
            {/* The count alone. "Your collection" stood here
                once — but every row this section holds is
                yours, and a label identical on every row
                says nothing. The count stays because it is
                the one fact that picks seeds: eight places
                feed a plan, one barely seasons it.

                The pin and the figure, not "13 địa điểm"
                (owner, 21 Nov 2026): the word stood on every
                row of a list where every row counts the same
                thing, and the Explore shelf, Collections'
                tiles and a list's own card already say it with
                the pin (owner, 2 Nov 2026). Spoken in full, so
                VoiceOver still hears "13 places". In the row's
                tertiary ink rather than the photo cards' — it
                sits on paper, not a picture. */}
            <View style={s.fromCount} accessible accessibilityLabel={placesOf(members.length, t)} testID="ideas-seed-count">
              <Glyph name="location-outline" size={ICON.meta} color={colors.textTertiary} />
              <Text style={s.fromMeta} numberOfLines={1}>{members.length}</Text>
            </View>
          </View>
          <SelectTick on={on} />
        </PressableScale>
      </View>
    );
  };

  return (
    <View style={{ marginBottom: space.titleToContent }}>
      <Text style={s.heading}>
        {t('Start from what you love', 'Bắt đầu từ thứ bạn thích', 'お気に入りから始める', '从你喜欢的开始', '從你喜歡的開始')}
      </Text>
      {/* Which lists these are, said once: the rows count places
          here, and this is the line that says what "here" is. The
          city's short name, as the row above the sections prints
          it, so the two never disagree. */}
      {city && (
        <Text style={s.fromHint}>
          {t(
            `Collections with a place in ${city.short_en}`,
            `Bộ sưu tập có địa điểm ở ${city.short_vi}`,
            `${city.short_ja ?? city.short_en}に場所があるコレクション`,
            `有${city.short_en}地点的合集`, `有${city.short_en}地點的合集`,
          )}
        </Text>
      )}
      {/* The start sheet's ok well, for the same fact: a city the
          reader's own choice moved the app to. Only while the app
          is still on it — a switch made afterwards is a new fact. */}
      {moved && city?.id === moved.id && (
        <View style={s.movedWell} testID="ideas-moved">
          <Glyph name="checkmark-circle" size={ICON.action} color={colors.okInk} />
          <Text style={s.movedText}>
            {t(
              `The plan will be made in ${cityName(moved)}.`,
              `Kế hoạch sẽ lập ở ${cityName(moved)}.`,
              `プランは${cityName(moved)}で作ります。`,
              `计划将在${cityName(moved)}制定。`, `計畫將在${cityName(moved)}制定。`,
            )}
          </Text>
        </View>
      )}
      {own.length > 0 && (
        <>
          {/* Labelled only once there are two cards to tell apart. */}
          {more && community.length > 0 && (
            <Text style={s.groupLabel}>{t('Yours', 'Của bạn', '自分の', '我的', '我的')}</Text>
          )}
          <Card style={s.seedCard} testID="ideas-seed-card">{own.map(seedRow)}</Card>
        </>
      )}
      {community.length > 0 && (own.length > 0
        ? (more
          ? (
            <>
              <Text style={s.groupLabel}>{t('Community', 'Cộng đồng', 'みんなの', '社区', '社群')}</Text>
              <Card style={s.seedCard} testID="ideas-seed-card">{community.map(seedRow)}</Card>
            </>
          )
          : (
            <MoreRow
              onPress={onMore}
              label={t(
                `More · ${community.length} community ${community.length === 1 ? 'collection' : 'collections'}`,
                `Xem thêm · ${community.length} bộ sưu tập cộng đồng`,
                `もっと見る · みんなのコレクション${community.length}件`,
                `更多 · ${community.length} 个社区合集`, `更多 · ${community.length} 個社群合集`,
              )}
            />
          ))
        : (
          <>
            <Card style={s.seedCard} testID="ideas-seed-card">
              {(more ? community : community.slice(0, COMMUNITY_FIRST)).map(seedRow)}
            </Card>
            {!more && community.length > COMMUNITY_FIRST && (
              <MoreRow
                onPress={onMore}
                label={t(
                  `${community.length - COMMUNITY_FIRST} more`,
                  `Xem thêm ${community.length - COMMUNITY_FIRST}`,
                  `さらに${community.length - COMMUNITY_FIRST}件`,
                  `还有 ${community.length - COMMUNITY_FIRST} 个`, `還有 ${community.length - COMMUNITY_FIRST} 個`,
                )}
              />
            )}
          </>
        ))}
    </View>
  );
}
