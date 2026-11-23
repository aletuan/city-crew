// The body of a list: the kinds' row on the card, each place in the list
// or the grid, the empty list, the dock, and the two sheets.
//
// Out of `CollectionDetailScreen` on 23 Nov 2026, the fourth and last
// step of F1 in the 22 Nov code review. Each piece here was a ternary or
// two in the screen's render; each is now drawn by something that knows
// only what it draws. The screen still decides when each appears and
// owns every press. The reasoning moved with the code unchanged.

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import ActionSheet, { SheetRows, type SheetAction } from '../../components/ActionSheet';
import { DockOffer, DockSlot } from '../../components/DockSlot';
import { AddPill } from '../../components/add';
import { KindPills } from '../../components/KindPill';
import { Empty } from '../../components/ui';
import { Glyph, ICON } from '../../components/ui/glyph';
import type { useListDrag } from '../../components/useListDrag';
import { categoriesOf } from '../../lib/categories';
import { useI18n } from '../../lib/i18n';
import type { Place } from '../../lib/types';
import { colors } from '../../theme';
import { DraggableCard, DraggableTile, StillCard, StillTile } from './cells';
import { OwnEmpty } from './OwnEmpty';
import { sendRows, ShareHead } from './Share';
import { s } from './styles';
import type { useKindFilter } from './useKindFilter';

type Drag = ReturnType<typeof useListDrag>;
type Kinds = ReturnType<typeof useKindFilter>;

/** The kinds a list holds, its count, and "4 of 11 · Clear" while a chip narrows it. */
export function KindRow({ members, kinds, filters, chosen, narrowed, pick, kept, setPicked }: {
  members: Place[];
} & Pick<Kinds, 'kinds' | 'filters' | 'chosen' | 'narrowed' | 'pick' | 'kept' | 'setPicked'>) {
  const { t } = useI18n();
  /* ── the count, at the end of the kinds' row (owner, 13 Nov 2026) ──
     How many places, beside what kinds they are: the two say what is in
     the list, so they share a row, the count fixed at its right edge and
     the kinds wrapping in the column to its left — a fourth kind goes to
     a second line under the first, never under the count. One place for
     the figure, for the owner and a visitor alike: it had been the foot's
     on somebody else's list and the "Add place" cell's corner on yours,
     and the foot is now the activity row, the heart and, on your own
     list, the way to its activity (`activity`).

     The list's whole count, whatever a chip has narrowed it to: the grid
     shows what the chip kept, and the line under the row says "4 of 11"
     while one is chosen. Its box is a pill's box — the same rule, clear,
     when the kinds are a filter — so the figure sits on the first line's
     baseline by construction rather than by a guessed offset.

     Its pin and figure, never the word (owner, 31 Oct 2026); a screen
     reader hears the word. On a list with no places there is no count:
     "Nothing here yet" is the card's whole answer.

     A faint upright hairline before the pin, while there are kinds
     beside it (owner, 13 Nov 2026). The kinds say what is in the list
     and, with two or more, are a filter; the figure counts and is not
     pressed. Air alone left the figure reading as one more kind once the
     kinds reached across the row. The rule is a place card's own
     separator ("4.5 ★ | $$ | 1.2 km"), not the "·" this card uses to
     join two of a kind ("12/11 · Private", "4 of 11 · Clear"), which
     would have made the count one more item of the kinds. Inside the
     count's own box, so it centres on the count's line — the kinds'
     first — however many lines the kinds wrap to; and not drawn when
     the count stands alone, with nothing to be told apart from. */
  const placesWord = t(members.length === 1 ? 'place' : 'places', 'địa điểm', 'スポット', '个地点', '個地點');
  const placeCount = members.length > 0 ? (
    <View
      style={[s.placeCount, filters && s.placeCountRule]}
      accessible
      accessibilityLabel={`${members.length} ${placesWord}`}
      testID="collection-count"
    >
      {kinds.length > 0 ? <View style={s.countRule} testID="collection-count-rule" /> : null}
      <Glyph name="location-outline" size={ICON.meta} color={colors.textTertiary} />
      <Text style={s.placeCountText}>{members.length}</Text>
    </View>
  ) : null;
  return kinds.length > 0 || placeCount ? (
    <View style={s.kindsBlock}>
      <View style={s.kindsLine}>
        <View style={s.kindsLeft}>
          {kinds.length > 0 ? (
            <KindPills
              kinds={kinds}
              chosen={chosen}
              onPick={filters ? pick : undefined}
              bare
              testID="collection-kinds"
            />
          ) : null}
        </View>
        {placeCount}
      </View>
      {narrowed ? (
        <View style={s.filterCount}>
          <Text style={s.filterCountText} testID="collection-filter-count">
            {t(
              `${kept} of ${members.length} places`,
              `${kept} trên ${members.length} địa điểm`,
              `${members.length}件中${kept}件`,
              `${members.length} 个地点中的 ${kept} 个`, `${members.length} 個地點中的 ${kept} 個`,
            )}
          </Text>
          <Text style={s.filterCountText}>·</Text>
          <Pressable
            onPress={() => setPicked([])}
            hitSlop={12}
            accessibilityRole="button"
            testID="collection-filter-clear"
          >
            <Text style={s.filterClear}>{t('Clear', 'Bỏ lọc', '解除', '清除', '清除')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  ) : null;
}

/** The chosen kind a place answers to, the first in the card's order:
 *  what its card names while a chip narrows the list. */
export const chipFor = (item: Place, kinds: Kinds['kinds'], chosen: Kinds['chosen']) =>
  kinds.find((k) => chosen.includes(k) && categoriesOf(item).includes(k)) ?? null;

/** One place in the list or the grid, held still or ready to be moved.
 *  A function, not a component, so the list's cells are what they were. */
export function placeCell({
  item, index, grid, canArrange, count, tile, styleOf, openPlace, step, onLift, onRelease, onPitch, chip,
}: {
  item: Place;
  index: number;
  grid: boolean;
  canArrange: boolean;
  count: number;
  tile: number;
  styleOf: Drag['styleOf'];
  openPlace: (slug: string) => void;
  step: (index: number, by: -1 | 1) => void;
  onLift: Drag['onLift'];
  onRelease: Drag['onRelease'];
  onPitch: Drag['onPitch'];
  chip: string | null;
}) {
  if (grid) {
    return canArrange
      ? (
        <DraggableTile
          place={item}
          index={index}
          count={count}
          size={tile}
          style={styleOf(index)}
          onOpen={openPlace}
          onStep={step}
          onLift={onLift}
          onRelease={onRelease}
        />
      )
      : <StillTile place={item} index={index} size={tile} onOpen={openPlace} />;
  }
  return canArrange
    ? (
      <DraggableCard
        place={item}
        index={index}
        count={count}
        style={styleOf(index)}
        onOpen={openPlace}
        onStep={step}
        onLift={onLift}
        onRelease={onRelease}
        onPitch={onPitch}
      />
    )
    // By position, mine or not, so a smoke flow opens the first
    // place whichever card shape the list is drawn with.
    // Narrowed, the card names the chosen kind it answers to —
    // the first of them in the card's order — as the pin and
    // card do under a chip on Explore.
    : (
      <StillCard
        place={item}
        index={index}
        onOpen={openPlace}
        chip={chip}
      />
    );
}

/** A list with no places: the owner is handed the way to add one. */
export function ListEmpty({ owned, onAdd }: { owned: boolean; onAdd: () => void }) {
  const { t } = useI18n();
  return owned
    // One message, not two. The reference stacks "No places in this
    // collection yet." above a card that says the same thing again.
    ? <OwnEmpty onAdd={onAdd} />
    : <Empty text={t(
      'No places in this collection yet.',
      'Bộ sưu tập này chưa có địa điểm nào.',
      'このコレクションにはまだスポットがありません。',
      '这个合集里还没有地点。', '這個合集裡還沒有地點。',
    )} />;
}

/** The ⋯'s sheet: the acts above, the two views, the acts below. */
export function MenuSheet({ title, menu, setMenu, actsBefore, viewRows, actsAfter }: {
  title: string;
  menu: boolean;
  setMenu: (open: boolean) => void;
  actsBefore: SheetAction[];
  viewRows: SheetAction[];
  actsAfter: SheetAction[];
}) {
  const { t } = useI18n();
  const close = () => setMenu(false);
  return (
    <ActionSheet
      visible={menu}
      onClose={close}
      header={<Text style={s.sheetTitle} numberOfLines={2} accessibilityRole="header">{title}</Text>}
    >
      <SheetRows actions={actsBefore} onClose={close} />
      <Text style={s.menuSection} accessibilityRole="header">
        {t('View', 'Chế độ xem', '表示', '视图', '檢視')}
      </Text>
      <SheetRows actions={viewRows} onClose={close} />
      <SheetRows actions={actsAfter} onClose={close} />
    </ActionSheet>
  );
}

/** Who can see the list: the three answers, then the ways to send it.
 *  Drawn after the friends picker, as it always was — the picker opens
 *  in its place, and the order is what puts one over the other. */
export function WhoSeesSheet({ whoSees, setWhoSees, whoSees3 }: {
  whoSees: boolean;
  setWhoSees: (open: boolean) => void;
  whoSees3: SheetAction[];
}) {
  const { t } = useI18n();
  const close = () => setWhoSees(false);
  return (
    <ActionSheet visible={whoSees} onClose={close} header={<ShareHead />}>
      <SheetRows actions={whoSees3} onClose={close} />
      <SheetRows actions={sendRows(t)} onClose={close} />
    </ActionSheet>
  );
}

/** The dock: Plan a trip, and the second act beside it — Add for the
 *  owner, Save a copy for a visitor who may. */
export function ListDock({ dock, plan, owned, canCopy, addPlace, copy }: {
  dock: boolean;
  plan: () => void;
  owned: boolean;
  canCopy: boolean;
  addPlace: () => void;
  copy: () => void;
}) {
  const { t } = useI18n();
  return (
    <DockSlot visible={dock} onPress={plan} accessibilityRole="button" testID="collection-dock">
      <DockOffer
        icon="paw"
        title={t('Plan a trip', 'Lên kế hoạch', 'プランを立てる', '规划行程', '規劃行程')}
        // Short enough for one line beside the widest pill. "Dùng danh
        // sách này cho chuyến đi" was cut to "…cho ch…" beside "Lưu bản
        // sao" on the owner's phone (17 Oct 2026): about 23 characters
        // fit there, fewer on a 375pt screen. "Danh sách này" was the
        // part the screen already says.
        sub={t('Use it for a trip', 'Dùng cho chuyến đi', '旅の計画に使う', '用于规划行程', '用於規劃行程')}
      />
      {owned ? (
        <AddPill
          label={t('Place', 'Địa điểm', 'スポット', '地点', '地點')}
          accessibilityLabel={t('Add place', 'Thêm địa điểm', 'スポットを追加', '添加地点', '新增地點')}
          onPress={addPlace}
          testID="collection-dock-add"
        />
      ) : canCopy ? (
        <AddPill
          icon="copy-outline"
          label={t('Save a copy', 'Lưu bản sao', 'コピーを保存', '保存副本', '儲存副本')}
          onPress={copy}
          testID="collection-dock-copy"
        />
      ) : null}
    </DockSlot>
  );
}
