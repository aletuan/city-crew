// "Sketching your day" — the screen between pressing the button and
// having a plan.
//
// It is honest about being a mock, and that shapes the whole thing. There
// is no agent behind it: the steps run on a clock, not on work. So the
// screen must not end by *presenting a plan*, because there is none. It
// ends by saying the itinerary lands next — the same sentence the button
// used to say in an alert, arrived at the long way round.
//
// Which is the trade worth naming. Eight seconds of theatre in front of a
// message the reader could have had instantly is a cost, and it is only
// worth paying because this is the shape the real thing will have: when
// the planner exists, the steps stop being a timer and start being
// reports, and nothing above them changes. If that stops being true, this
// screen should go back to being an alert.
//
// The sequence, the finish and the summary line are in `lib/sketch`,
// where a test can reach them. What is left here is the drawing.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import SketchOrb from '../components/SketchOrb';
import {
  GradientCta, Screen, Skeleton, useLoop, useReducedMotion, useTabBarClearance,
} from '../components/ui';
import { CATEGORIES, categoryLabel } from '../lib/categories';
import { dateline } from '../lib/format';
import { useI18n } from '../lib/i18n';
import {
  finished, SKETCH_STEPS, stepStates, summaryLine, totalMs, type StepState,
} from '../lib/sketch';
import { COMPANY } from '../lib/trip';
import { clampDay, fromISO, todayISO } from '../lib/day';
import type { Nav, RootRoute } from '../nav';
import { colors, font, gradAI, radius, space } from '../theme';

/** How often the clock is read. Fast enough that a step never appears to
 *  linger past its end, slow enough not to re-render at frame rate for a
 *  list of four rows. */
const TICK_MS = 120;

export default function SketchingScreen({ navigation, route }: {
  navigation: Nav;
  route: RootRoute<'Sketching'>;
}) {
  const { t, lang } = useI18n();
  const clearance = useTabBarClearance(10);
  const calm = useReducedMotion();
  const p = route.params;

  // Measured from a ref rather than counted in ticks: a counter drifts
  // whenever a frame is late, and this screen's whole content is derived
  // from elapsed time.
  const startedAt = useRef(Date.now()).current;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      const at = Date.now() - startedAt;
      setElapsed(at);
      if (at >= totalMs()) clearInterval(id);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [startedAt]);

  const states = stepStates(elapsed);
  const done = finished(elapsed);

  const company = COMPANY.find((c) => c.key === p.company);
  const day = clampDay(p.date || todayISO());
  const line = summaryLine([
    company ? t(company.en, company.vi, company.ja) : null,
    p.when === 'day' ? t('Day', 'Ban ngày', '昼') : t('Evening', 'Buổi tối', '夜'),
    dateline(lang, fromISO(day) ?? new Date()),
    p.where,
  ]);
  const wants = summaryLine(p.categories.map((c) => (CATEGORIES[c] ? categoryLabel(c, t) : null)));

  return (
    <Screen title={t('Plan a trip', 'Lên kế hoạch', 'プランを立てる')}>
      <ScrollView
        contentContainerStyle={[s.body, { paddingBottom: clearance }]}
        showsVerticalScrollIndicator={false}
      >
        <SketchOrb still={done || calm} />

        <Text style={s.title}>
          {done
            ? t('That is as far as it goes', 'Tạm dừng ở đây', 'ここまでです')
            : p.when === 'day'
              ? t('Sketching your day…', 'Đang phác ngày của bạn…', '一日を下描き中…')
              : t('Sketching your evening…', 'Đang phác buổi tối của bạn…', '夜を下描き中…')}
        </Text>
        {!!line && <Text style={s.sub}>{line}</Text>}
        {!!wants && <Text style={s.sub}>{wants}</Text>}

        <View style={s.card}>
          {SKETCH_STEPS.map((step, i) => (
            <StepRow
              key={step.key}
              label={t(step.en, step.vi, step.ja)}
              state={states[i]}
              still={calm}
            />
          ))}
        </View>

        {/* What a plan will look like, in the shape it will arrive in. It
            keeps pulsing after the steps stop, which is deliberate: the
            work is not finished, it is unbuilt, and a settled skeleton
            would read as an empty result. */}
        <View style={s.preview}>
          <Skeleton style={{ height: 12, width: '46%', borderRadius: 6 }} />
          <Skeleton style={{ height: 12, width: '88%', borderRadius: 6 }} />
          <Skeleton style={{ height: 12, width: '72%', borderRadius: 6 }} />
        </View>

        {done ? (
          <>
            <Text style={s.note}>
              {t(
                'The itinerary itself lands next — this screen is the shape it will arrive in. Your answers are ready for it.',
                'Phần lịch trình sẽ có ở bước tiếp theo — màn hình này là hình hài nó sẽ xuất hiện. Các lựa chọn của bạn đã sẵn sàng.',
                '旅程はこの次に登場します。この画面はその器です。回答は保存されています。',
              )}
            </Text>
            <GradientCta
              icon="arrow-back"
              label={t('Back to the answers', 'Quay lại phần trả lời', '回答に戻る')}
              onPress={() => navigation.goBack()}
              wide
            />
          </>
        ) : (
          <Text style={s.note}>
            {t(
              'You can edit everything afterwards.',
              'Bạn có thể sửa lại mọi thứ sau.',
              'あとから全部編集できます。',
            )}
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}

/**
 * The mark beside a step, in whichever of the three states it is in.
 *
 * The active one is a bright arc travelling over a faint full ring, and
 * both halves of that matter. The first version drew only the arc — a
 * circle with its top border transparent — which is a *hole*, not a
 * segment, and a hole in a ring that is also standing still does not read
 * as "working". It reads as broken, which is what it was reported as.
 *
 * So: the track goes back, and the arc turns again.
 *
 * It turns at the orb's own 1.6s, which answers the objection that put it
 * on hold. Two spinners at two speeds read as two separate things
 * happening; two turning in step read as one thing, in two sizes.
 */
function StepMark({ state, still }: { state: StepState; still: boolean }) {
  const spin = useLoop(1600, still || state !== 'active');

  if (state === 'done') {
    return (
      <LinearGradient {...gradAI} style={s.mark}>
        <Ionicons name="checkmark" size={14} color={colors.accentInk} />
      </LinearGradient>
    );
  }
  if (state !== 'active') return <View style={[s.mark, s.markPending]} />;

  return (
    <View style={s.mark}>
      {/* The track. Without it the arc is a gap rather than a segment, and
          the ring looks damaged at every angle it stops at. */}
      <View style={[StyleSheet.absoluteFill, s.markTrack]} />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          s.markArc,
          { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] },
        ]}
      />
    </View>
  );
}

function StepRow({ label, state, still }: { label: string; state: StepState; still: boolean }) {
  // The label breathes while its step is running — the `shimmer` the design
  // asked for, at 0.62 rather than 0.45 at the bottom. Text that fades most
  // of the way out is text somebody is mid-sentence with when it goes.
  const glow = useLoop(1400, still || state !== 'active', 'inOut');
  const dim = state === 'active'
    ? glow.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1] })
    : 1;

  return (
    <View style={[s.step, state === 'active' && s.stepOn]}>
      <StepMark state={state} still={still} />
      <Animated.Text
        style={[
          s.stepText,
          state === 'pending' && s.stepTextOff,
          state === 'active' && s.stepTextOn,
          { opacity: dim },
        ]}
        numberOfLines={2}
      >
        {label}
      </Animated.Text>
    </View>
  );
}

const s = StyleSheet.create({
  body: { alignItems: 'center', paddingHorizontal: space.page, paddingTop: 10, gap: 14 },

  title: { color: colors.text, fontSize: 27, fontFamily: 'SpaceGrotesk_700Bold', textAlign: 'center', marginTop: 6 },
  sub: { color: colors.textSecondary, fontSize: 15, lineHeight: 21, textAlign: 'center' },

  card: {
    alignSelf: 'stretch', marginTop: 6,
    backgroundColor: colors.surfaceCard, borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
    paddingVertical: 6,
  },
  step: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    paddingHorizontal: 16, paddingVertical: 11,
    marginHorizontal: 6, borderRadius: radius.input,
  },
  // A tint under the running row, which says "this one" without moving.
  // It is the half of the signal that survives reduced motion.
  stepOn: { backgroundColor: colors.accentSoft },
  mark: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  // The faint full circle the arc rides on.
  markTrack: { borderRadius: 12, borderWidth: 2, borderColor: colors.accentLine },
  // One quadrant of colour. Every other side transparent, so what shows is
  // an arc on the track rather than a ring with a bite out of it.
  markArc: {
    borderRadius: 12, borderWidth: 2,
    borderColor: 'transparent', borderTopColor: colors.accent,
  },
  markPending: { borderWidth: 1.5, borderColor: colors.borderGlass, borderStyle: 'dashed' },
  stepText: { flex: 1, color: colors.textSecondary, fontSize: 15 },
  stepTextOn: { color: colors.text, fontWeight: font.semibold },
  stepTextOff: { color: colors.textTertiary },

  preview: {
    alignSelf: 'stretch', gap: 10, padding: 16, marginTop: 2,
    backgroundColor: colors.surfaceCard, borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  note: { color: colors.textTertiary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 2 },
});
