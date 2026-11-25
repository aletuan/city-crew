// The places themselves: one list, as cards or as a grid of three, with
// the card above them and the row or cell that adds a place.
//
// Out of `CollectionDetailScreen` on 25 Nov 2026, the fifth step of F1 in
// the 22 Nov code review. The reasoning moved with the code unchanged;
// what the screen worked out is handed in as `kit` (`useListArrange`).

import React from 'react';
import { FlatList, type FlatListProps, View } from 'react-native';
import type { Place } from '../../lib/types';
import { chipFor, ListEmpty, placeCell } from './body';
import { LiftCell, LiftedCard } from './cells';
import { s } from './styles';
import { ADD_CELL, GRID_COLUMNS, type ListArrange } from './useListArrange';

type Cell = Place | typeof ADD_CELL;

export function PlaceList({
  kit, introCard, addCell, onAdd, onCardLayout, onScroll, onRefresh, refreshing, loading, found, owned,
  narrowed, kinds, chosen, foot,
}: {
  kit: ListArrange;
  /** The card under the header, which scrolls away with the places. */
  introCard: React.ReactElement;
  /** "Add place", as a tile of this size or, with none, as a row. */
  addCell: (size?: number) => React.ReactElement;
  onAdd: () => void;
  onCardLayout: React.ComponentProps<typeof View>['onLayout'];
  onScroll: FlatListProps<Cell>['onScroll'];
  onRefresh: () => void;
  refreshing: boolean;
  loading: boolean;
  /** Whether there is a list to be empty. */
  found: boolean;
  owned: boolean;
  narrowed: boolean;
  kinds: Parameters<typeof chipFor>[1];
  chosen: Parameters<typeof chipFor>[2];
  /** What the list leaves clear under its last row: the floating bar. */
  foot: number;
}) {
  const {
    view, grid, shown, canArrange, tile, adding, lead, listRef, count,
    lift, panHandlers, onLift, onRelease, onPitch, styleOf, areaRef, onContentSizeChange, openPlace, step,
  } = kit;
  return (
    <>
  {/* On the grid a cell of the list is a row of tiles, so it is the
      lifted tile's row that is raised. */}
  <LiftedCard.Provider value={lift ? (grid ? Math.floor((lift.from + lead) / GRID_COLUMNS) : lift.from) : -1}>
    <View ref={areaRef} style={s.dragArea} testID="collection-drag-area" {...panHandlers}>
      <FlatList
        ref={listRef}
        data={lead ? [ADD_CELL, ...shown] : shown}
        keyExtractor={(p) => (p === ADD_CELL ? ADD_CELL : p.slug)}
        // A list cannot change its columns once drawn, so each view is
        // a list of its own.
        key={view}
        numColumns={grid ? GRID_COLUMNS : 1}
        columnWrapperStyle={grid ? s.gridRow : undefined}
        // Held still while a card is in the finger: the drag and the scroll
        // would otherwise both answer the same drag.
        scrollEnabled={!lift}
        onRefresh={onRefresh}
        refreshing={refreshing}
        CellRendererComponent={LiftCell}
        onScroll={onScroll}
        onContentSizeChange={onContentSizeChange}
        scrollEventThrottle={16}
        renderItem={({ item, index: at }) => (item === ADD_CELL ? addCell(tile) : placeCell({
          item, index: at - lead, grid, canArrange, count, tile, styleOf,
          openPlace, step, onLift, onRelease, onPitch, chip: narrowed ? chipFor(item, kinds, chosen) : null,
        }))}
        ListEmptyComponent={!loading && found ? <ListEmpty owned={owned} onAdd={onAdd} /> : undefined}
        // The card is on every list, so the header always is: the two
        // tests that asked whether there was a card to draw could only
        // ever say yes.
        ListHeaderComponent={(
          <>
            <View testID="collection-intro" onLayout={onCardLayout}>{introCard}</View>
            {adding && !grid && addCell()}
          </>
        )}
        ListHeaderComponentStyle={s.headerAbove}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: foot }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  </LiftedCard.Provider>
    </>
  );
}
