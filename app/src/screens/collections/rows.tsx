// A row of the shelf and the foot of a section.
//
// Out of CollectionsScreen since 24 Nov 2026, where they were the list's
// `renderItem` and `renderSectionFooter`, written inline. The lines were
// moved, not retyped; what they read of the screen is now their props,
// and the row and section types moved with them.
import { View } from 'react-native';
import { Empty } from '../../components/ui';
import type { ShelfRow } from '../../lib/collectionShelf';
import type { MosaicRow } from '../../lib/collectionMosaic';
import type { Collection } from '../../lib/data';
import { useI18n } from '../../lib/i18n';
import { space } from '../../theme';
import { CollectionTile, MosaicCard, type ShelfKit } from './cards';
import { CommunityEmpty, FirstCollection } from './empties';
import { s } from './styles';

export type ListRow = ShelfRow<Collection> | MosaicRow<Collection>;


/** A section of the list: yours, the lists friends shared with you, or
 *  the community's, with its rows. The rows are named here, not only by
 *  the list: React Native 0.88 types a section handed back to a render
 *  prop as possibly the extra fields alone. */
export type Section = {
  own: boolean;
  data: ListRow[];
  city?: { id: string | null; count: number };
  /** The lists friends shared with you, and how many. */
  shared?: { count: number };
};

/** One row: a pair of tiles, or a row of the Mosaic in one of its three
 *  layouts. */
export function ShelfRowView({ item, section, winW, gcardW, gcardH, kit }: {
  item: ListRow; section: Section; winW: number; gcardW: number; gcardH: number; kit: ShelfKit;
}) {
  if (item.kind === 'mosaic') {
    const width = winW - space.page * 2;
    return (
      <View style={s.gridRow} testID={`collection-mosaic-row-${item.layout}`}>
        {item.layout === 'feature'
          ? <MosaicCard entry={item.items[0]} width={width} height={Math.round(gcardW * 1.28)} featured kit={kit} />
          : item.layout === 'stack' ? (
            <>
              <MosaicCard entry={item.items[0]} width={gcardW} height={gcardH * 2 + space.cardGap} kit={kit} />
              <View style={{ gap: space.cardGap }}>
                {item.items.slice(1).map((entry) => <MosaicCard key={entry.c.slug} entry={entry} width={gcardW} height={gcardH} kit={kit} />)}
              </View>
            </>
          ) : item.items.map((entry) => <MosaicCard key={entry.c.slug} entry={entry} width={gcardW} height={gcardH} kit={kit} />)}
      </View>
    );
  }
  // Otherwise a pair of tiles: the only shape left besides the
  // Mosaic since the list view went (owner, 7 Nov 2026).
  return (
    <View style={s.gridRow}>
      {item.pair.map((c, j) => (
        <CollectionTile
          key={c.slug} c={c} own={item.own} shared={!!section.shared} at={item.at + j}
          width={gcardW} height={gcardH} kit={kit}
        />
      ))}
      {item.pair.length === 1 ? <View style={{ width: gcardW }} /> : null}
    </View>
  );
}

/** Under a section: the miss under a search, or the empty shelf's card. */
export function ShelfFoot({ section, sections, asked, q, signedIn, onCreate, onExplore }: {
  section: Section; sections: Section[]; asked: boolean; q: string; signedIn: boolean;
  onCreate: () => void; onExplore: () => void;
}) {
  const { t } = useI18n();
  // Under a query, the only footer is the honest one: nothing
  // matched. The creation rows stay out of it — "start your
  // first collection" under a search that found nothing would
  // be answering a question nobody asked.
  if (asked) {
    // Once, and only when nothing anywhere matched: on Yours
    // the lists shared with you are a second section, and a
    // miss among your own above a hit among theirs is not
    // "nothing here".
    if (sections.some((x) => x.data.length > 0)) return null;
    return q
      ? <Empty text={t(`Nothing here matches "${q}".`, `Không có gì khớp với "${q}".`, `「${q}」に一致するものはありません。`, `没有与“${q}”匹配的内容。`, `沒有與「${q}」相符的內容。`)} />
      : <Empty text={t('No collections match that choice.', 'Không có bộ sưu tập nào khớp lựa chọn đó.', 'その条件に合うコレクションはありません。', '没有符合条件的合集。', '沒有符合條件的合集。')} />;
  }
  if (section.own) {
    return section.data.length === 0
      ? <FirstCollection onPress={onCreate} />
      : null;
  }
  return section.data.length === 0
    ? (
      <CommunityEmpty
        signedIn={signedIn}
        onCreate={onCreate}
        onExplore={onExplore}
      />
    )
    : null;
}
