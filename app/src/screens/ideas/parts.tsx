import React from 'react';
import { Text, View } from 'react-native';
import { Glyph, ICON } from '../../components/ui/glyph';
import ActionSheet, { type SheetAction } from '../../components/ActionSheet';
import { PressableScale, TileGrid } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { colors, space } from '../../theme';
import { s } from './styles';

/**
 * A question and the grid of answers under it.
 *
 * No count and no "pick one" beside the heading. They were there to say
 * which group swaps and which adds up, and they said it at the cost of a
 * second voice on every heading — four questions, each with an aside.
 * The screen is short on words on purpose, and the thing the asides
 * explained is cheap to discover: a second tap on `Going with…` swaps the
 * answer rather than refusing it, which is a forgiving way to learn a
 * rule and leaves nothing to undo.
 */
/** The tap that opens the community's lists. Explore's "See all" in
 *  weight and colour, a chevron down rather than an arrow right because
 *  what it opens is below, not elsewhere. */
export function MoreRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} contentStyle={s.more} accessibilityRole="button" testID="seeds-more" hitSlop={6}>
      <Text style={s.moreText}>{label}</Text>
      <Glyph name="chevron-down" size={ICON.text} color={colors.accent} />
    </PressableScale>
  );
}

export function Section({ title, cols, children }: {
  title: string;
  cols: number;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: space.titleToContent }}>
      <Text style={s.heading}>{title}</Text>
      <View style={s.grid}><TileGrid cols={cols}>{children}</TileGrid></View>
    </View>
  );
}

/** Which city, for a list sent here that spans several and none of them
 *  this one (`useListSeed`). Out of `IdeasScreen` on 25 Nov 2026, unchanged. */
export function AskCity({ visible, onClose, actions }: {
  visible: boolean;
  onClose: () => void;
  actions: SheetAction[];
}) {
  const { t } = useI18n();
  return (
    <ActionSheet
      visible={visible}
      onClose={onClose}
      actions={actions}
      header={(
        <View style={{ gap: 2 }}>
          <Text style={s.askTitle}>{t('Which city?', 'Thành phố nào?', 'どの都市にしますか？', '哪个城市？', '哪個城市？')}</Text>
          <Text style={s.askMeta}>
            {t(
              'This collection has places in more than one city. The plan is made in one.',
              'Bộ sưu tập này có địa điểm ở nhiều thành phố. Kế hoạch chỉ lập ở một nơi.',
              'このコレクションは複数の都市にスポットがあります。プランは一つの都市で作ります。',
              '这个合集的地点分布在多个城市，计划只能在一个城市中制定。', '這個合集的地點分佈在多個城市，計畫只能在一個城市中制定。',
            )}
          </Text>
        </View>
      )}
    />
  );
}
