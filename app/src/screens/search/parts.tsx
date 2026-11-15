import React, { memo } from 'react';
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Glyph } from '../../components/ui/glyph';
import PlaceCard from '../../components/PlaceCard';
import { CHIP_SLOP, PressableScale } from '../../components/ui';
import { type Place } from '../../lib/data';
import { CATEGORIES } from '../../lib/categories';
import { escapeRoutes } from '../../lib/deadend';
import { useI18n } from '../../lib/i18n';
import { colors } from '../../theme';
import { s } from './styles';

/**
 * A place among the results, drawn again only when something it shows has
 * moved.
 *
 * The screen redraws on every letter typed and every ⊕ tapped, and each
 * card used to be handed a fresh `onPress` and a fresh `inList` every
 * time, so every result drew again to show what it already showed (owner,
 * 30 Oct 2026). Its props here are values and two callbacks that outlive
 * renders; the press and the ⊕ are made in here.
 *
 * `on` is null when Search was not opened from a list: no ⊕ at all.
 */
export const SearchPlaceCard = memo(function SearchPlaceCard({ place, index, city, on, listTitle, open, toggle }: {
  place: Place;
  index: number;
  city: string | null;
  on: boolean | null;
  listTitle: string;
  open: (place: Place) => void;
  toggle: (place: Place) => void;
}) {
  return (
    <PlaceCard
      place={place}
      city={city}
      testID={`search-result-${index}`}
      inList={on === null ? undefined : { on, title: listTitle, onPress: () => toggle(place) }}
      onPress={() => open(place)}
    />
  );
});

/**
 * The end of a search that found nothing.
 *
 * It used to be one grey sentence, then a sentence with worked examples
 * baked into the copy. The examples have moved out of the prose and into
 * the `Fork` chips below, where they are tappable and derived from the
 * query itself — so the sentence here contracts to the one fact left to
 * state: the catalog has not got this, yet. "Yet" is load-bearing; the
 * row directly underneath offers to go and fetch it.
 */
export function NoMatches({ term, where }: { term: string; where?: string | null }) {
  const { t } = useI18n();
  return (
    <View style={s.noneBox}>
      <View style={s.noneMark}>
        <Glyph name="search" size={30} color={colors.textTertiary} />
        {/* The question mark is the whole difference between "we are
            looking" and "we looked". A magnifier alone is what a screen
            shows while it is still searching. */}
        <View style={s.noneBadge}>
          <Text style={s.noneBadgeText}>?</Text>
        </View>
      </View>
      {/* Found in another city: said as "not here", with the chips above
          for "there", rather than as "not anywhere". */}
      <Text style={s.noneTitle}>
        {where
          ? t(`No matches for “${term}” in ${where}`, `Không có kết quả cho “${term}” ở ${where}`, `${where}に「${term}」の一致なし`, `${where}没有与“${term}”匹配的结果`, `${where}沒有與「${term}」相符的結果`)
          : t(`No matches for “${term}”`, `Không có kết quả cho “${term}”`, `「${term}」に一致なし`, `没有与“${term}”匹配的结果`, `沒有與「${term}」相符的結果`)}
      </Text>
      <Text style={s.noneHint}>
        {where
          ? t('Other cities have it: choose one above.', 'Có ở thành phố khác: chọn ở trên.', '他の都市にあります。上で選んでください。', '其他城市有：请在上方选择。', '其他城市有：請在上方選擇。')
          : t('Not in City Crew yet.', 'Chưa có trong City Crew.', 'City Crew にはまだありません。', 'City Crew 里还没有。', 'City Crew 裡還沒有。')}
      </Text>
    </View>
  );
}

/**
 * The fork out of a dead end: what the failed query *did* contain.
 *
 * "Pizza 4P's Thảo Điền" finding nothing still told the app two true
 * things — a part of town and a kind of place — and each becomes a chip
 * that re-runs the search with just that part. Re-running rather than
 * navigating is the design: the box refills with the working query, so
 * the reader sees *why* the chip worked and learns the shape of a query
 * that succeeds. A jump to another screen would fix this search and
 * teach nothing.
 *
 * "Back to Places" is always last: the fork must never be a cul-de-sac,
 * and someone whose query held nothing recognisable still deserves a
 * door that is not the keyboard.
 */
export function Fork({ routes, onSearch, onBack, toList }: {
  routes: ReturnType<typeof escapeRoutes>;
  onSearch: (q: string) => void;
  onBack: () => void;
  /** Opened from a list, back is to the list, and says so. */
  toList: boolean;
}) {
  const { t } = useI18n();
  return (
    <View style={s.forkBox}>
      <Text style={s.forkLabel}>{t('OR TRY', 'HOẶC THỬ', 'または', '或者试试', '或者試試')}</Text>
      <View style={s.forkRow}>
        {routes.map((r) => {
          if (r.kind === 'area') {
            const name = t(r.en, r.vi, r.ja);
            return (
              <ForkChip
                key={`a-${r.en}`}
                icon="location-outline"
                label={t(`Browse ${r.en}`, `Xem quanh ${r.vi}`, `${r.ja}を見る`, `浏览${r.en}`, `瀏覽${r.en}`)}
                onPress={() => onSearch(name)}
              />
            );
          }
          const cat = CATEGORIES[r.key];
          return (
            <ForkChip
              key={`c-${r.key}`}
              icon={cat.icon}
              label={t(`All ${cat.en}`, `Tất cả ${cat.vi}`, `${cat.ja}すべて`, `全部${cat.zh}`, `全部${cat.zh}`)}
              onPress={() => onSearch(t(cat.en, cat.vi, cat.ja, cat.zh, cat.hant))}
            />
          );
        })}
        <ForkChip
          icon={toList ? 'albums-outline' : 'compass-outline'}
          label={toList
            ? t('Back to the list', 'Về bộ sưu tập', 'コレクションに戻る', '返回合集', '返回合集')
            : t('Back to Places', 'Về Địa điểm', 'スポットに戻る', '返回地点', '返回地點')}
          onPress={onBack}
        />
      </View>
    </View>
  );
}

function ForkChip({ icon, label, onPress }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} haptic="selection" hitSlop={CHIP_SLOP} accessibilityRole="button">
      <View style={s.forkChip}>
        <Glyph name={icon} size={15} color={colors.accent} />
        <Text style={s.forkChipText} numberOfLines={1}>{label}</Text>
      </View>
    </PressableScale>
  );
}
