// Out of `SearchScreen` on 25 Nov 2026, so the screen's function fits the
// ceiling (`oversize.js`); the reasoning moved with the code, unchanged.

import React from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { AddSlot } from '../../components/add';
import type { Candidates } from '../../lib/candidates';
import { useI18n } from '../../lib/i18n';
import { colors } from '../../theme';
import { s } from './styles';

// The tap stays, and stops being a journey.
//
// It used to open Add a place, which then ran the same search again on
// another screen. The tap was never the problem — it is the one signal
// that Google is worth asking, and no heuristic knows that better than
// the person who just failed to find something. What was wrong was
// making them leave the page to spend it.
//
// So: same row, same tap, results underneath. And once a search has
// run, the row has nothing left to offer and goes.
export function GoogleAsk({ google, typed, shown }: { google: Candidates; typed: string; shown: string }) {
  const { t } = useI18n();
  const askedGoogle = google.results !== null || google.searching;
  return google.searching
    ? <ActivityIndicator color={colors.accent} style={{ marginTop: 28 }} />
    : askedGoogle
      ? null
      : (
        <AddSlot
          onPress={() => google.run(typed)}
          title={t(`Add “${shown}”`, `Thêm “${shown}”`, `「${shown}」を追加`, `添加“${shown}”`, `新增「${shown}」`)}
          subtitle={t(
            'We look it up on Google Maps',
            'Chúng tôi tìm trên Google Maps',
            'Google マップで探します',
            '我们会在 Google 地图上查找', '我們會在 Google 地圖上查詢',
          )}
        />
      );
}

// Asked, and it had nothing the catalog has not got. Said out loud,
// because a tap that produces no visible change reads as a broken
// button rather than as an answer.
export function GoogleNothing() {
  const { t } = useI18n();
  return (
    <Text style={s.nothing}>
      {t(
        'Nothing on Google Maps that is not already here.',
        'Google Maps không có chỗ nào mà đây chưa có.',
        'Google マップにも、ここにないものはありませんでした。',
        'Google 地图上没有这里尚未收录的地点。', 'Google 地圖上沒有這裡尚未收錄的地點。',
      )}
    </Text>
  );
}
