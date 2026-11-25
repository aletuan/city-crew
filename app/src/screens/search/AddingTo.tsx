// Out of `SearchScreen` on 25 Nov 2026, so the screen's function fits the
// ceiling (`oversize.js`); the reasoning moved with the code, unchanged.

import React from 'react';
import { Text, View } from 'react-native';
import { Glyph, ICON } from '../../components/ui/glyph';
import { useI18n } from '../../lib/i18n';
import { colors } from '../../theme';
import { s } from './styles';

// Where a ⊕ puts a place, said once under the box rather than on
// every row: the rows only say whether each one is in.
//
// A chip, and not a line (owner, 23 Oct 2026). The line was the
// accent's green at 13pt behind a ⊕, which read as one more
// button and left the list's name no louder than the words before
// it. The chip is the "Browse" chips' glass, so it reads as a
// fact the screen is set to, with the name as its loudest part;
// a bookmark rather than a ⊕, because nothing here is pressed.
// The city is not named: the list's own title almost always
// says it, and the chips below show it.
export function AddingTo({ title, count }: { title: string; count: number }) {
  const { t } = useI18n();
  return (
    <View style={s.addingToRow}>
      <View
        style={s.addingTo}
        testID="search-adding-to"
        accessible
        accessibilityLabel={t(
          `Adding to ${title}, ${count} ${count === 1 ? 'place' : 'places'}`,
          `Đang thêm vào ${title}, ${count} địa điểm`,
          `「${title}」に追加中、${count}件`,
          `正在添加到“${title}”，${count} 个地点`, `正在新增到「${title}」，${count} 個地點`,
        )}
      >
        <Glyph name="bookmark-outline" size={ICON.text} color={colors.textTertiary} />
        <Text style={s.addingToText} numberOfLines={1}>
          {t('Add to collection: ', 'Thêm vào bộ sưu tập: ', 'コレクションに追加：', '添加到合集：', '新增到合集：')}
          <Text style={s.addingToTitle}>{title}</Text>
        </Text>
        {/* How many it holds, moving as each ⊕ is tapped (owner, 23 Oct
            2026): the list read from `useMyLists` has the taps laid
            over it, so the figure is the one the list will show. Its
            own text, outside the one that shrinks, so a long name
            ends in "…" and the count stays. */}
        <Text style={s.addingToCount} testID="search-adding-to-count">{`(${count})`}</Text>
      </View>
    </View>
  );
}
