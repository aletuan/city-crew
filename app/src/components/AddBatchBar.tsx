// The commit for a batch of candidates, pinned above the tab bar.
//
// Two screens select several Google results and add them together — Add a
// place, and Search once its own results have come up short — and the bar
// underneath is the same object in both: a count, a gradient button, a way
// to stop, and one line saying what happens next. It was written once for
// Add a place; the second screen needing it is the moment to move it here
// rather than the moment to copy it.
//
// What the two still differ on is where you are afterwards, which is the
// one genuine difference between them: Add a place exists only to add, so
// a finished run has somewhere to be. Search does not — the reader was
// looking for something and is still on the results — so it passes no
// `done` and the bar simply goes when there is nothing left to add.

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientCta, PressableScale, useTabBarClearance } from './ui';
import type { Batch } from '../lib/candidates';
import { useI18n } from '../lib/i18n';
import { colors, font, gradAI, radius, space } from '../theme';

type Done = { label: string; onPress: () => void };

/**
 * Is the bar on screen?
 *
 * Exported because the list above it has to reserve the room: the bar
 * clears the tab bar itself, so a list that also cleared it left a
 * screenful of nothing between the last result and the button.
 */
export function batchBarShown(chosen: number, batch: Batch, done?: Done): boolean {
  return chosen > 0 || batch.running || (!!done && batch.total > 0 && !batch.running);
}

export default function AddBatchBar({ chosen, batch, onAdd, onCancel, done }: {
  /** How many are selected and can still be added. */
  chosen: number;
  batch: Batch;
  onAdd: () => void;
  onCancel: () => void;
  /** The way out once a run has ended and nothing is left to add. Omitted
   *  by screens the reader already has a reason to be on. */
  done?: Done;
}) {
  const { t } = useI18n();
  // Ten points of breathing room over the tab bar's own height. It used to
  // be `clearance - 24`, which was six points short of that height — which
  // is what put this bar's note behind the tab bar.
  const clearance = useTabBarClearance(10);
  if (!batchBarShown(chosen, batch, done)) return null;

  return (
    <View style={[s.foot, { paddingBottom: clearance }]}>
      {batch.running ? (
        <>
          <LinearGradient {...gradAI} style={s.progress}>
            <ActivityIndicator color={colors.accentInk} />
            <Text style={s.progressText}>
              {t(
                `Adding ${batch.done + 1} of ${batch.total}…`,
                `Đang thêm ${batch.done + 1}/${batch.total}…`,
                `${batch.total}件中 ${batch.done + 1}件目…`,
              )}
            </Text>
          </LinearGradient>
          <PressableScale onPress={onCancel} accessibilityRole="button">
            <Text style={s.cancel}>
              {t('Stop after this one', 'Dừng sau chỗ này', 'この件で止める')}
            </Text>
          </PressableScale>
        </>
      ) : chosen > 0 ? (
        // Still something to add — including after a partial failure, where
        // the ones that did not go through are still selected and this
        // button is the retry. A screen that only offered the way out would
        // be making the reader start over.
        <GradientCta
          wide
          icon="add"
          label={chosen === 1
            ? t('Add this place', 'Thêm địa điểm này', 'このスポットを追加')
            : t(
              `Add ${chosen} places`,
              `Thêm ${chosen} địa điểm`,
              `${chosen}件を追加`,
            )}
          onPress={onAdd}
        />
      ) : done ? (
        <GradientCta wide icon="arrow-back" label={done.label} onPress={done.onPress} />
      ) : null}
      <Text style={s.footNote}>
        {batch.running
          ? t(
            'You can keep browsing — this finishes on its own.',
            'Bạn cứ dùng tiếp — phần này tự chạy xong.',
            'そのまま閲覧できます — 追加は自動で終わります。',
          )
          : t(
            'We fill in the name, photos and hours.',
            'Chúng tôi điền tên, ảnh và giờ mở cửa.',
            '名前・写真・営業時間はこちらで埋めます。',
          )}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  foot: {
    paddingHorizontal: space.page, paddingTop: 14, gap: 10,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  // The gradient, literally — the same fill the button wears, so the bar
  // does not appear to swap for a different control halfway through. It
  // said this in a comment while being flat `colors.accent`, which put the
  // `accentInk` label at 3.64:1 on paper. A comment is not a measurement.
  progress: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, borderRadius: radius.pill,
  },
  progressText: { color: colors.accentInk, fontSize: 16, fontWeight: font.semibold },
  cancel: { color: colors.textSecondary, fontSize: 14, fontWeight: font.semibold, textAlign: 'center' },
  footNote: { color: colors.textTertiary, fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
});
