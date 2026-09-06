// "Save to…" — the list of your lists, with the ones already holding this
// place ticked.
//
// It stays open after a tap. Saving to two lists is one gesture short of
// saving to one, and a sheet that closes itself makes the second save a
// whole journey again.

import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Collection, holds, Place } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { colors, display, font, space } from '../theme';
import { PressableScale } from './ui';

export default function SaveSheet({ place, collections, onClose, onToggle, onNew }: {
  /** The place being saved; null keeps the sheet shut. */
  place: Place | null;
  collections: Collection[];
  onClose: () => void;
  onToggle: (c: Collection, place: Place) => void;
  onNew: () => void;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const rise = useRef(new Animated.Value(1)).current;
  const visible = !!place;

  useEffect(() => {
    if (!visible) { rise.setValue(1); return; }
    Animated.spring(rise, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 3 }).start();
  }, [visible, rise]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel={t('Close', 'Đóng', '閉じる')} />
      <Animated.View
        style={[
          s.sheet,
          {
            paddingBottom: insets.bottom + 16,
            transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, 320] }) }],
          },
        ]}
      >
        <View style={s.grabber} />
        <Text style={s.title}>{t('Save to', 'Lưu vào', '保存先')}</Text>
        {place ? (
          <Text style={s.subtitle} numberOfLines={1}>
            {t(place.name_en, place.name_vi, place.name_ja)}
          </Text>
        ) : null}

        {/* Capped so a long list cannot push the sheet past the screen; it
            scrolls inside instead. */}
        <ScrollView style={s.list} contentContainerStyle={{ paddingVertical: 4 }} showsVerticalScrollIndicator={false}>
          {collections.map((c) => {
            const on = place ? holds(c, place.slug) : false;
            return (
              <PressableScale
                key={c.slug}
                onPress={() => place && onToggle(c, place)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                containerStyle={{ alignSelf: 'stretch' }}
                style={s.row}
              >
                <View style={[s.tick, on && s.tickOn]}>
                  {on ? <Ionicons name="checkmark" size={15} color={colors.accentInk} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowText} numberOfLines={1}>{t(c.title_en, c.title_vi, c.title_ja)}</Text>
                  <Text style={s.rowMeta} numberOfLines={1}>
                    {c.collection_places.length === 0
                      ? t('Empty', 'Trống', '空')
                      : `${c.collection_places.length} ${t(c.collection_places.length === 1 ? 'place' : 'places', 'địa điểm', 'スポット')}`}
                  </Text>
                </View>
              </PressableScale>
            );
          })}
        </ScrollView>

        <PressableScale
          onPress={onNew}
          accessibilityRole="button"
          containerStyle={{ alignSelf: 'stretch' }}
          style={s.newRow}
        >
          <View style={s.newIcon}>
            <Ionicons name="add" size={19} color={colors.accent} />
          </View>
          <Text style={s.newText}>{t('New collection', 'Bộ sưu tập mới', '新しいコレクション')}</Text>
        </PressableScale>

        <PressableScale onPress={onClose} accessibilityRole="button" style={s.done}>
          <Text style={s.doneText}>{t('Done', 'Xong', '完了')}</Text>
        </PressableScale>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,5,8,0.62)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: space.page, paddingTop: 10,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  grabber: {
    width: 38, height: 4, borderRadius: 2, alignSelf: 'center',
    backgroundColor: colors.textTertiary, marginBottom: 14,
  },
  title: { color: colors.text, fontSize: 20, fontFamily: display.bold },
  subtitle: { color: colors.textTertiary, fontSize: 14, marginTop: 2, marginBottom: 6 },

  list: { maxHeight: 320 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  // Empty box, not an empty circle: a circle here would echo the accent
  // disc in the tab bar, which means "selected tab" everywhere else.
  tick: {
    width: 24, height: 24, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.borderGlass,
  },
  // The filled box is a surface, so it takes the fill coral — the same
  // one the gradients use — and its check is accentInk on top.
  tickOn: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },
  rowText: { color: colors.text, fontSize: 16, fontWeight: font.medium },
  rowMeta: { color: colors.textTertiary, fontSize: 13, marginTop: 1 },

  newRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 13, marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  newIcon: {
    width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentLine,
  },
  newText: { color: colors.accent, fontSize: 16, fontWeight: font.medium },

  done: { paddingVertical: 14, marginTop: 2, alignSelf: 'center' },
  doneText: { color: colors.textSecondary, fontSize: 15.5, fontWeight: font.medium },
});
