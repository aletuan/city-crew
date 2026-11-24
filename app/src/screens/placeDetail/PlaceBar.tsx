// The bar over a place: back, the name, and the bookmark.
//
// Out of PlaceDetailScreen since 24 Nov 2026, the piece that brought the
// screen's function under 150 lines. Whether the place is saved is read
// here, where the bookmark draws it; the tour's anchor stays the screen's,
// because the screen registers it before the place has loaded and the bar
// is drawn only after. The lines were moved, not retyped.
import type React from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton, PressableScale } from '../../components/ui';
import { Glyph, ICON } from '../../components/ui/glyph';
import { useI18n } from '../../lib/i18n';
import { useIsSaved } from '../../lib/save';
import { colors } from '../../theme';
import { BAR_NAME_MIN_SCALE, s } from './styles';

export function PlaceBar({ slug, title, onBack, onSave, saveAnchor }: {
  slug: string;
  title: string;
  onBack: () => void;
  onSave: () => void;
  saveAnchor: React.Ref<React.ComponentRef<typeof View>>;
}) {
  const { t } = useI18n();
  const saved = useIsSaved(slug);
  const insets = useSafeAreaInsets();
  return (
  <View style={[s.bar, { paddingTop: insets.top + 6 }]}>
    <BackButton onPress={() => onBack()} bare testID="detail-back" />
    <Text
      style={s.barName}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={BAR_NAME_MIN_SCALE}
      accessibilityRole="header"
      testID="detail-name"
    >
      {title}
    </Text>
    {/* The same control as the bookmark on the card that got you
        here — same glyph, same sheet, same rows underneath. It was a
        heart wired to component state: it filled in, it meant
        nothing, and it forgot on the way back. */}
    <PressableScale
      anchorRef={saveAnchor}
      onPress={() => onSave()} scaleTo={0.9} haptic="selection"
      style={s.saveHang} contentStyle={s.barControl}
      accessibilityRole="button"
      accessibilityState={{ selected: saved }}
      // Two ids for the two states, so a smoke flow can wait on the
      // save having landed without reading a trilingual label.
      testID={saved ? 'detail-saved' : 'detail-save'}
      accessibilityLabel={saved
        ? t('Saved — change collections', 'Đã lưu — đổi bộ sưu tập', '保存済み — コレクションを変更', '已保存 — 更改合集', '已儲存 — 更改合集')
        : t('Save to a collection', 'Lưu vào bộ sưu tập', 'コレクションに保存', '保存到合集', '儲存到合集')}
    >
      <Glyph name={saved ? 'bookmark' : 'bookmark-outline'} size={ICON.nav} color={saved ? colors.accent : colors.text} />
    </PressableScale>
  </View>
  );
}
