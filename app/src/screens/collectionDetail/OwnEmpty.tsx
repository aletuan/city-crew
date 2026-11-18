import React from 'react';
import { Text, View } from 'react-native';
import { Glyph, ICON } from '../../components/ui/glyph';
import { GradientCta } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { colors } from '../../theme';
import { s } from './styles';

/**
 * The empty state of a list you own.
 *
 * A public collection that is empty is a mistake at the desk; one of yours
 * is just new, and the screen should hand you the way forward instead of
 * reporting the absence twice.
 */
export function OwnEmpty({ onAdd }: { onAdd: () => void }) {
  const { t } = useI18n();
  return (
    <View style={s.emptyWrap}>
      <View style={s.empty}>
        <View style={s.emptyIcon}>
          <Glyph name="bookmark-outline" size={ICON.feature} color={colors.accent} />
        </View>
        {/* One line. The second sentence was telling you to go looking,
            which is what the button underneath already says — a card this
            small should not say the same thing twice, once in prose and
            once as a control. */}
        <Text style={s.emptyBody}>
          {t('Nothing here yet.', 'Chưa có gì ở đây.', 'まだ何もありません。', '这里还没有内容。', '這裡還沒有內容。')}
        </Text>
        <GradientCta
          icon="search-outline"
          label={t('Find places', 'Tìm địa điểm', 'スポットを探す', '查找地点', '查詢地點')}
          onPress={onAdd}
        />
      </View>
    </View>
  );
}
