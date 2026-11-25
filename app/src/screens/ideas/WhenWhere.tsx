// Out of `IdeasScreen` on 25 Nov 2026, so the screen's function fits the
// ceiling (`oversize.js`); the reasoning moved with the code, unchanged.

import React from 'react';
import { Text, View } from 'react-native';
import { Glyph, ICON } from '../../components/ui/glyph';
import { Card, PressableScale } from '../../components/ui';
import { clockOf } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import type { TimeOfDay } from '../../lib/trip';
import { colors, space } from '../../theme';
import { SEG_SLOP, s } from './styles';

/** Where and when: the start, the day, and Day or Evening. */
export function WhenWhere({ whereLabel, dayLabel, when, onWhen, onWhere, onDay, late, startMin }: {
  whereLabel: string;
  dayLabel: string;
  when: TimeOfDay;
  onWhen: (w: TimeOfDay) => void;
  onWhere: () => void;
  onDay: () => void;
  late: boolean;
  startMin: number;
}) {
  const { t } = useI18n();
  return (
    <View style={{ marginBottom: space.titleToContent }}>
      <Text style={s.heading}>{t('Where and when…', 'Chỗ nào, lúc nào…', '場所と時間は…', '何时何地…', '何時何地…')}</Text>
      <Card style={s.whenCard}>
        <PressableScale onPress={onWhere} contentStyle={s.whereRow} accessibilityRole="button">
          <Glyph name="location-outline" size={ICON.action} color={colors.accent} />
          <Text style={s.whereText} numberOfLines={1}>{whereLabel}</Text>
          <Glyph name="chevron-forward" size={ICON.action} color={colors.textTertiary} />
        </PressableScale>
        <View style={s.divider} />
        <View style={s.whenRow}>
          {/* The date used to be a label here, printed from
              `new Date()` and not in the draft at all — while sitting
              in the same card, directly under a row that *is* a
              control, with the same icon and layout. It read as
              tappable and was not. */}
          {/* The flex on `style`, the Pressable itself, and the row on
              `contentStyle`, the animated view inside. The row above
              gets away without it
              by being a direct child of the Card, which is a column,
              so it stretches. This one is inside a row, so without a
              flex on the *outer* element the pressable shrank to its
              icon and the date inside it collapsed to nothing. */}
          <PressableScale
            onPress={onDay}
            style={s.dayBox}
            contentStyle={s.dayHit}
            accessibilityRole="button"
          >
            <Glyph name="calendar-outline" size={ICON.action} color={colors.accent} />
            <Text style={s.whereText} numberOfLines={1}>{dayLabel}</Text>
          </PressableScale>
          {/* One control, not two chips side by side. Day and Evening
              are the two halves of one answer and swapping between
              them is a single decision; drawn as separate chips they
              read as two independent switches, and nothing said that
              turning one on turns the other off.

              A bordered track on the page's own ground, recessed
              inside the card the way a switch is recessed into a
              panel — so the pair reads as one object with a moving
              part rather than as two buttons that happen to touch. */}
          <View style={s.segment} accessibilityRole="radiogroup">
            {([
              ['day', t('Day', 'Ban ngày', '昼', '白天', '白天')],
              ['evening', t('Evening', 'Buổi tối', '夜', '晚上', '晚上')],
            ] as const).map(([key, label]) => {
              const on = when === key;
              return (
                <PressableScale
                  key={key}
                  onPress={() => onWhen(key)}
                  haptic="selection"
                  scaleTo={0.96}
                  hitSlop={SEG_SLOP}
                  contentStyle={[s.segItem, on && s.segItemOn]}
                  accessibilityRole="radio"
                  aria-checked={on}
                >
                  <Text style={[s.segText, on && s.segTextOn]} numberOfLines={1}>{label}</Text>
                </PressableScale>
              );
            })}
          </View>
          {/* The chevron ends this row because it ends the one above
              it. Both rows of this card are "tap to change", and a
              card whose two rows disagree about where that is said
              makes the reader check each one. It was tucked beside
              the date for a while on the argument that at the edge it
              would seem to belong to the Day/Evening control — but
              that control is plainly its own bordered object, and a
              ragged right edge costs more than the ambiguity it
              avoided.

              Its own tap target, opening the same picker, so the
              glyph is not a picture of an affordance. Hidden from
              VoiceOver: the date beside it is already the button, and
              a second nameless one on the same row is noise. */}
          <PressableScale
            onPress={onDay}
            hitSlop={10}
            testID="ideas-day-chevron"
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          >
            <Glyph name="chevron-forward" size={ICON.action} color={colors.textTertiary} />
          </PressableScale>
        </View>
      </Card>
      {/* Only when the clock has moved the start, which is only ever
          on today. Said here rather than left for the reader to notice
          on the plan: a day out that begins at 17:15 is a surprise
          worth having before the sketching starts, not after. */}
      {late && (
        <Text style={s.whenNote}>
          {t(
            `It is already ${clockOf(startMin)} — this plan starts from there.`,
            `Bây giờ đã ${clockOf(startMin)} — kế hoạch sẽ bắt đầu từ đó.`,
            `もう${clockOf(startMin)}です — ここから始めるプランにします。`,
            `现在已经 ${clockOf(startMin)} 了 — 计划将从这个时间开始。`, `現在已經 ${clockOf(startMin)} 了 — 計畫將從這個時間開始。`,
          )}
        </Text>
      )}
    </View>
  );
}
