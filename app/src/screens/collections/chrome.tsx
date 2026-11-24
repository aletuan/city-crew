// The screen's chrome around the shelf: the skeleton while the catalog
// loads, the pinned copy of the tabs and the city over the shelf, and the
// dock.
//
// Out of CollectionsScreen since 24 Nov 2026. The lines were moved, not
// retyped; what they read of the screen is now their props.
import type React from 'react';
import { View } from 'react-native';
import { DockOffer, DockSlot } from '../../components/DockSlot';
import { AddPill } from '../../components/add';
import { Skeleton } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import type { Nav } from '../../nav';
import { CityHead } from './cityHeads';
import { GuestNotice } from './empties';
import { ShelfTop, TabsRow, type ShelfHead } from './header';
import { s } from './styles';

/** The grid the shelf is about to be, under the guest's notice. */
export function ShelfSkeleton({ navigation, gcardW, gcardH }: { navigation: Nav; gcardW: number; gcardH: number }) {
  return (
    <View>
      <GuestNotice navigation={navigation} />
      {/* The grid it is about to be — the only shape the shelf has
          drawn since the list view went (7 Nov 2026). */}
      {[0, 1].map((i) => (
        <View key={i} style={s.gridRow}>
          {[0, 1].map((j) => <Skeleton key={j} style={[s.gcard, { width: gcardW, height: gcardH }]} />)}
        </View>
      ))}
    </View>
  );
}

  {/* The tabs, pinned: a copy over the shelf rather than a sticky
      header, as Explore's filter row is, so nothing it does can
      move a row or eat a tap meant for one. */}
export function PinnedBar({ shown, head, signedIn, headerExpanded, tabsHRef, city, cityWord, onCity }: {
  /** Once the list has carried the tabs to the top, and the shelf is in. */
  shown: boolean;
  head: ShelfHead; signedIn: boolean; headerExpanded: boolean;
  tabsHRef: React.MutableRefObject<number>;
  city: { id: string | null; count: number } | null;
  cityWord: (id: string | null) => string;
  onCity: () => void;
}) {
  // A guest has no tabs to pin, so for them the bar is the city alone.
  if (!shown || !(signedIn || city)) return null;
  return (
    <View style={s.pinned} testID="collections-pinned">
      {signedIn ? (
        <View onLayout={(e) => { tabsHRef.current = Math.round(e.nativeEvent.layout.height); }} testID="collections-pinned-tabs">
          {headerExpanded ? <ShelfTop h={head} floating /> : <TabsRow h={head} floating />}
        </View>
      ) : null}
      {city ? <CityHead city={city} pinnedCopy signedIn={signedIn} cityWord={cityWord} onPress={onCity} /> : null}
    </View>
  );
}

    {/* Explore's dock, with this screen's two actions: the whole island
        is the box (`findFromDock`), the pill a new list. "+ Bộ sưu tập",
        "+ Tạo mới", the word every pill that makes something wears, as
        this screen's own header pill does. Guests start no lists. */}
export function ShelfDock({ visible, signedIn, onFind, onNew }: {
  visible: boolean; signedIn: boolean; onFind: () => void; onNew: () => void;
}) {
  const { t } = useI18n();
  return (
      <DockSlot visible={visible} onPress={onFind} accessibilityRole="button" testID="collections-dock">
        <DockOffer
          icon="search-outline"
          title={t('Find a collection', 'Tìm bộ sưu tập', 'コレクションを探す', '查找合集', '查詢合集')}
          // Short, for one line beside the pill: about 23 characters fit
          // there (CollectionDetail's dock measured it, 17 Oct 2026).
          sub={t('By name or place', 'Theo tên hoặc địa điểm', '名前やスポットで', '按名称或地点', '按名稱或地點')}
        />
        {signedIn ? (
          <AddPill
            label={t('New', 'Tạo mới', '新規', '新建', '新增')}
            accessibilityLabel={t('New collection', 'Bộ sưu tập mới', '新しいコレクション', '新建合集', '新增合集')}
            onPress={onNew}
            testID="collections-dock-new"
          />
        ) : null}
      </DockSlot>
  );
}
