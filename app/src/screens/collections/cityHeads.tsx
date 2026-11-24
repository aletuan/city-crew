// The headings on the shelf: a city block's, which opens the sheet that
// jumps between cities, the one over the lists shared with you, and the
// sheet's own rows.
//
// Out of CollectionsScreen since 24 Nov 2026, where they were three
// functions inside the screen's one function. The lines were moved, not
// retyped; what they read of the screen is now their props.
import { Text, View } from 'react-native';
import { CityRow } from '../../components/CityRow';
import { PressableScale, TABS_ROW_GAP } from '../../components/ui';
import { Glyph, ICON } from '../../components/ui/glyph';
import { listsWord } from '../../lib/collectionShelf';
import type { MosaicGroup } from '../../lib/collectionMosaic';
import { useI18n } from '../../lib/i18n';
import { colors } from '../../theme';
import { s } from './styles';

  // The sheet's rows are Explore's city rows (owner, 7 Nov 2026): it was
  // a menu of acts — a pin on every row saying the same thing six times,
  // "12 collections" under each name, a tick — beside an app whose other
  // city list is names on the left and figures in a column on the right,
  // the one on screen in the tint. "Elsewhere" goes last, under a rule,
  // and names the cities it gathers: a reader after Hội An could not know
  // to look in it.
  //
  // No figures (owner, the same day): the block's heading and the pinned
  // bar already say "12 collections", and nobody picks a city to jump to
  // by how many lists it holds.
  //
  // Rejected, on the owner's question: Explore's "Use my location" and
  // "Recent". This sheet is a jump within the shelf, not the app's city —
  // nothing chosen here is kept — and the reader's own city already
  // leads it (`mosaicGroups`' `home`), so "my location" would repeat the
  // first row, or else become a third place to set a city, which the
  // 6 Nov note above ruled out. "Recent" earns its room in a list of
  // dozens; here five or six rows are read at a glance, and a recent
  // section would repeat them and make the sheet longer than its list.
export function JumpRows({ groups, atCity, cityWord, cityName, onJump }: {
  groups: MosaicGroup<unknown>[] | null;
  atCity: { id: string | null } | null;
  cityWord: (id: string | null) => string;
  cityName: (id: string) => string;
  onJump: (i: number) => void;
}) {
  return (
    <View>
      {(groups ?? []).map((g, i) => {
        const there = g.city == null;
        return (
          <CityRow
            key={g.city ?? 'elsewhere'}
            title={cityWord(g.city)}
            sub={there && g.within?.length ? g.within.map(cityName).join(' · ') : null}
            active={atCity ? atCity.id === g.city : i === 0}
            divided={i > 0}
            onPress={() => onJump(i)}
            testID={`collections-jump-${g.city ?? 'elsewhere'}`}
          />
        );
      })}
    </View>
  );
}

export function CityHead({ city, pinnedCopy, signedIn, cityWord, onPress }: {
  city: { id: string | null; count: number };
  pinnedCopy: boolean;
  signedIn: boolean;
  cityWord: (id: string | null) => string;
  onPress: () => void;
}) {
  const { t } = useI18n();
  return (
    <PressableScale
      onPress={onPress}
      contentStyle={pinnedCopy ? [s.cityBar, !signedIn && s.cityBarAlone] : s.cityHead}
      // Under the tabs the bar takes their 14 below for its reach up, so
      // the target is 14 + the line + 12 — past 44 — with nothing of the
      // tabs' own under it.
      hitSlop={pinnedCopy && signedIn ? { top: TABS_ROW_GAP } : undefined}
      testID={pinnedCopy ? 'collections-city-bar' : `collection-mosaic-city-${city.id ?? 'elsewhere'}`}
      accessibilityRole="button"
      accessibilityLabel={`${cityWord(city.id)}, ${listsWord(city.count, t)}`}
      accessibilityHint={t('Go to another city', 'Đến thành phố khác', '別の都市へ移動', '前往其他城市', '前往其他城市')}
    >
      <Text style={s.cityHeadName} numberOfLines={1}>{cityWord(city.id)}</Text>
      <Glyph name="chevron-down" size={ICON.text} color={colors.textSecondary} style={s.cityHeadChevron} />
      <Text style={s.cityHeadCount}>{listsWord(city.count, t)}</Text>
    </PressableScale>
  );
}

  // The heading over the lists friends shared with you (see `sections`):
  // a city block's heading in size and place, so Yours reads as one shelf
  // in two parts, but no ▾ — there is nowhere to jump to — and so not a
  // button. The count is lists, as a city's is.
export function SharedHead({ count }: { count: number }) {
  const { t } = useI18n();
  return (
    <View style={s.cityHead} testID="collections-shared-head">
      <Text style={s.cityHeadName} numberOfLines={1} accessibilityRole="header">
        {t('Shared with you', 'Được chia sẻ với bạn', 'あなたと共有', '与你共享', '與你共享')}
      </Text>
      <Text style={s.cityHeadCount}>{listsWord(count, t)}</Text>
    </View>
  );
}
