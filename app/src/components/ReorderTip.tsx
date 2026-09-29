// The one line that says a list can be put in order by hand.
//
// Holding a card to lift it is a gesture nothing on the screen draws. The
// cards look exactly as they do on every other screen, where holding one
// does nothing. So the owner is told once, under the title, where a first
// look at their own list lands.
//
// Once, and then it gets out of the way. The tip retires for good either
// when the reader closes it or when they make their first move: after
// that they know, and a tip that keeps explaining what they have just
// done reads as the app not noticing. A move retires it for the next
// visit, not this one. Pulling it out from under the finger that just
// dropped a card would shift every card up by its height, mid-glance.
//
// Stored on the device like the welcome's flag (`WelcomeSheet`), and for
// the same reason a failed read means "seen": a store that cannot be read
// cannot be written either, and a tip that can never be dismissed is worse
// than one missed.

import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useI18n } from '../lib/i18n';
import { colors, font, radius, space, type } from '../theme';
import { PressableScale } from './ui';

export const REORDER_TIP_KEY = 'tip.holdToReorder.v1';

export default function ReorderTip({ show, used }: {
  /** Whether this list can be arranged at all: the reader's own, with two
   *  places or more. */
  show: boolean;
  /** A move has been made on this screen, so the tip has done its job. */
  used: boolean;
}) {
  const { t } = useI18n();
  // Null until storage answers: drawing it first and then taking it away
  // would flash a tip at everybody who had already closed it.
  const [seen, setSeen] = useState<boolean | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(REORDER_TIP_KEY)
      .then((v) => { if (live) setSeen(v !== null); })
      .catch(() => { if (live) setSeen(true); });
    return () => { live = false; };
  }, []);

  const retire = useCallback(() => {
    AsyncStorage.setItem(REORDER_TIP_KEY, '1').catch(() => {});
  }, []);

  useEffect(() => { if (used && seen === false) retire(); }, [used, seen, retire]);

  if (!show || seen !== false || closed) return null;
  return (
    <View style={s.tip} accessibilityRole="summary">
      <Ionicons name="hand-left-outline" size={18} color={colors.accent} style={s.icon} />
      <Text style={s.text}>
        <Text style={s.lead}>{t('Tip', 'Mẹo', 'ヒント')}  </Text>
        {t(
          'Hold a place, then drag it to change the order. Changes save on their own.',
          'Giữ một địa điểm rồi kéo để đổi thứ tự. Thay đổi được lưu tự động.',
          'スポットを長押ししてドラッグすると並び順を変えられます。変更は自動で保存されます。',
        )}
      </Text>
      <PressableScale
        onPress={() => { setClosed(true); retire(); }}
        haptic="selection"
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t('Dismiss tip', 'Ẩn mẹo', 'ヒントを閉じる')}
      >
        <Ionicons name="close" size={18} color={colors.textTertiary} />
      </PressableScale>
    </View>
  );
}

const s = StyleSheet.create({
  // The banner's shape — a soft card the width of the page — in the
  // accent's own soft ground, so it reads as the app talking rather than
  // as one more place.
  tip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    marginHorizontal: space.page, marginBottom: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: radius.input, backgroundColor: colors.accentSoft,
  },
  icon: { marginTop: 1 },
  text: { flex: 1, color: colors.text, ...type.meta, lineHeight: 21 },
  lead: { fontWeight: font.semibold, color: colors.accent },
});
