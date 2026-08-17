// Three ways to spend the evening, and the button that asks for three more.
//
// The reader picks between drafts rather than arguing with one. That is
// the whole reason this screen exists and it is worth naming, because it
// is also what keeps the feature cheap: choosing among three and nudging
// the winner gives more control than a chat with a model would, and costs
// nothing to run.
//
// The plans are rebuilt here from the answers rather than carried in from
// the screen before. `planTrips` is pure and seeded, so the same answers
// and the same seed give the identical three — cheaper than serialising
// plans through navigation, and it leaves one source of truth for what a
// set of answers produces. Regenerate is a new seed and the slugs already
// shown, so the next set moves rather than relying on luck.
//
// ── on showing fewer than three ──
//
// Da Nang holds two places to eat, and two of the three cities hold no
// shopping places at all. Three near-identical cards would be worse than
// one, because they claim a choice the catalog cannot back — so
// `planTrips` returns what it can honestly build and this screen renders
// however many that is, with a line saying so. The one thing it must never
// do is pad.

import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AmbientWarmth, Card, GradientCta, PressableScale, Screen, useTabBarClearance,
} from '../components/ui';
import { usePlaces } from '../lib/catalog';
import { useCity } from '../lib/city';
import { clampDay, fromISO, todayISO } from '../lib/day';
import { dateline } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { fmtDistance } from '../lib/geo';
import { membersOf } from '../lib/place';
import { planTrips, type LensKey, type TripPlan } from '../lib/planner';
import { useSave } from '../lib/save';
import { summaryLine } from '../lib/sketch';
import { COMPANY, type TripDraft } from '../lib/trip';
import type { Nav, RootRoute } from '../nav';
import { colors, font, gradAI, radius, space, type } from '../theme';

/** What each lens is called on its card. The badge comes from the lens
 *  rather than from a model: it says which weighting produced this plan,
 *  which is a fact, where the plan's *name* is a piece of writing and
 *  waits for a later phase. */
const BADGE: Record<LensKey, { en: string; vi: string; ja: string; star?: boolean }> = {
  match: { en: 'Best match', vi: 'Hợp nhất', ja: '最適', star: true },
  iconic: { en: 'Iconic views', vi: 'Biểu tượng', ja: '定番' },
  lowkey: { en: 'Low-key', vi: 'Nhẹ nhàng', ja: '控えめ' },
};

/** "18:30". Minutes past midnight on the catalog's clock, printed the way
 *  the rest of the app prints a time of day. */
function clock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "~420k ₫". Per person — see the note under the cards. */
function money(vnd: number): string {
  if (vnd >= 1_000_000) {
    const m = Math.round(vnd / 100_000) / 10;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M ₫`;
  }
  return `${Math.round(vnd / 1000)}k ₫`;
}

function hours(windowMin: [number, number]): string {
  const h = (windowMin[1] - windowMin[0]) / 60;
  return `${Math.round(h * 2) / 2}h`;
}

export default function PlanOptionsScreen({ navigation, route }: {
  navigation: Nav;
  route: RootRoute<'PlanOptions'>;
}) {
  const { t, lang } = useI18n();
  const clearance = useTabBarClearance();
  const p = route.params;
  const { data: places } = usePlaces();
  const { city } = useCity();
  const { mine } = useSave();

  const [seed, setSeed] = useState(p.seed);
  // Everything already offered, so Regenerate moves rather than rolling
  // the dice again and hoping. Grows across taps: the second Regenerate
  // avoids what the first one showed too.
  const [shown, setShown] = useState<string[]>([]);

  const day = clampDay(p.date || todayISO());
  const draft: TripDraft = useMemo(() => ({
    company: null, categories: p.categories, district: p.district, at: null,
    date: day, when: p.when, from: p.from ?? [],
  }), [p.categories, p.district, day, p.when, p.from]);

  // Collections resolve to places here rather than in the planner: only a
  // screen has the reader's own lists, and the planner has no business
  // knowing what a collection is.
  const pinned = useMemo(() => {
    if (!p.from?.length) return [];
    const wanted = new Set(p.from);
    return mine.data.filter((c) => wanted.has(c.slug)).flatMap((c) => membersOf(c, places));
  }, [p.from, mine.data, places]);

  const plans = useMemo(
    () => planTrips(draft, places, city?.id ?? null, { seed, pinned, avoid: shown }),
    [draft, places, city?.id, seed, pinned, shown],
  );

  const company = COMPANY.find((c) => c.key === p.company);
  const line = summaryLine([
    company ? t(company.en, company.vi, company.ja) : null,
    dateline(lang, fromISO(day) ?? new Date()),
    p.where,
  ]);

  const regenerate = () => {
    setShown((was) => [...was, ...plans.flatMap((pl) => pl.stops.map((s) => s.place.slug))]);
    setSeed((n) => n + 1);
  };

  // Said once under the cards rather than on each of them: it is the same
  // sentence three times otherwise, and it is about how every figure on
  // the screen is read.
  const perPerson = t(
    'Costs are estimated for one person.',
    'Chi phí ước tính cho một người.',
    '費用は1人あたりの目安です。',
  );

  return (
    <Screen title={t('Your evening, three ways', 'Buổi tối của bạn, ba cách', 'あなたの夜、三通り')}>
      <AmbientWarmth />
      <ScrollView
        contentContainerStyle={{ paddingBottom: clearance }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.lede}>
          {t(
            'Drafted from your answers — tap one to fine-tune. Regenerate for another set.',
            'Phác từ lựa chọn của bạn — chạm vào một cái để chỉnh. Bấm Tạo lại để xem bộ khác.',
            'あなたの回答から下描きしました。ひとつ選んで調整できます。',
          )}
        </Text>

        {/* Named for what it is. The plans come out of a scoring function,
            not a model, and calling that AI would be a claim the code does
            not back. */}
        {!!line && (
          <View style={s.byline}>
            <Ionicons name="sparkles" size={13} color={colors.accent} />
            <Text style={s.bylineText}>{line}</Text>
          </View>
        )}

        {plans.length > 0 && plans.length < 3 && (
          <Text style={s.thin}>
            {t(
              `Only ${plans.length === 1 ? 'one way' : `${plans.length} ways`} to do this with what is open here.`,
              `Chỉ dựng được ${plans.length} cách với những chỗ đang mở ở đây.`,
              `この街で開いている店では${plans.length}通りだけです。`,
            )}
          </Text>
        )}

        {plans.map((plan, i) => (
          <PlanCard
            key={`${plan.lens}-${i}`}
            plan={plan}
            best={i === 0}
            onPress={() => navigation.navigate('PlanEdit', {
              ...p, seed, lens: plan.lens, title: plan.title ?? undefined,
            })}
          />
        ))}

        {plans.length === 0 && (
          <Card style={s.emptyCard}>
            <Text style={s.emptyText}>
              {t(
                'Nothing here matches those answers now. Try Regenerate, or change what you asked for.',
                'Hiện không có gì khớp với lựa chọn đó. Thử tạo lại, hoặc sửa câu trả lời.',
                '今の条件に合うものがありません。作り直すか、条件を変えてみてください。',
              )}
            </Text>
          </Card>
        )}

        {plans.length > 0 && (
          <Text style={s.footnote}>
            {`${perPerson} ${t(
              'Tap one to nudge its times and save it.',
              'Chạm vào một cái để chỉnh giờ và lưu lại.',
              'ひとつ選ぶと時刻を調整して保存できます。',
            )}`}
          </Text>
        )}

        <View style={s.regen}>
          <GradientCta
            icon="refresh"
            wide
            label={t('Regenerate', 'Tạo lại', '作り直す')}
            onPress={regenerate}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

/** One draft. Tapping it opens the editor, where times and order become
 *  the reader's rather than the planner's. */
function PlanCard({ plan, best, onPress }: { plan: TripPlan; best: boolean; onPress: () => void }) {
  const { t } = useI18n();
  const badge = BADGE[plan.lens];
  const total = plan.costVnd.food + plan.costVnd.activity + plan.costVnd.transport;
  const km = plan.legs.reduce((n, l) => n + (l?.km ?? 0), 0);

  return (
    <PressableScale scaleTo={0.985} onPress={onPress} containerStyle={s.cardWrap}>
      <Card style={best ? s.cardBest : undefined}>
        <View style={s.head}>
          {/* Untitled until a model names it. The stops carry the plan
              until then, which is more use than an invented title. */}
          <Text style={s.name} numberOfLines={1}>
            {plan.title ?? plan.stops.map((st) => st.place.neighborhood_en).filter(Boolean)[0]
              ?? t('An evening out', 'Một buổi tối', '夜のおでかけ')}
          </Text>
          {badge.star ? (
            <LinearGradient {...gradAI} style={s.badgeOn}>
              <Ionicons name="star" size={11} color={colors.accentInk} />
              <Text style={s.badgeOnText}>{t(badge.en, badge.vi, badge.ja)}</Text>
            </LinearGradient>
          ) : (
            <View style={s.badge}>
              <Text style={s.badgeText}>{t(badge.en, badge.vi, badge.ja)}</Text>
            </View>
          )}
        </View>

        {plan.stops.map((st, i) => (
          <View key={st.place.slug}>
            <View style={s.stop}>
              <Text style={s.time}>{clock(st.arriveMin)}</Text>
              <View style={s.dotCol}>
                <View style={s.dot} />
                {i + 1 < plan.stops.length && <View style={s.rail} />}
              </View>
              <Text style={s.stopName} numberOfLines={1}>{st.place.name_en}</Text>
              <Text style={s.area} numberOfLines={1}>{st.place.neighborhood_en ?? ''}</Text>
            </View>
            {/* Dropped rather than guessed when a stop has no coordinates
                — `legBetween` returns null and the row would be a number
                nobody measured. */}
            {plan.legs[i] && (
              <View style={s.legRow}>
                <Ionicons
                  name={plan.legs[i]!.mode === 'walk' ? 'walk-outline' : 'car-outline'}
                  size={12}
                  color={colors.textTertiary}
                />
                <Text style={s.legText}>
                  {fmtDistance(plan.legs[i]!.km)} · ≈ {plan.legs[i]!.minutes} {t('min', 'phút', '分')}
                </Text>
              </View>
            )}
          </View>
        ))}

        <View style={s.foot}>
          <Text style={s.summary}>
            {summaryLine([
              `${plan.stops.length} ${t('stops', 'điểm', 'スポット')}`,
              `~${hours(plan.windowMin)}`,
              km > 0 ? fmtDistance(km) : null,
              total > 0 ? `~${money(total)}` : null,
            ])}
          </Text>
        </View>

        {/* Only what could not be used, and why. Somebody who built from a
            café list where everything shuts at six should be told that,
            not left wondering where their picks went. */}
        {plan.pinnedDropped.length > 0 && (
          <Text style={s.dropped}>
            {t(
              `${plan.pinnedDropped.length} saved ${plan.pinnedDropped.length === 1 ? 'place is' : 'places are'} closed or unavailable at this hour.`,
              `${plan.pinnedDropped.length} chỗ bạn đã lưu đóng cửa hoặc không dùng được vào giờ này.`,
              `保存済みの${plan.pinnedDropped.length}件はこの時間帯は利用できません。`,
            )}
          </Text>
        )}
      </Card>
    </PressableScale>
  );
}

/** The scale in `theme.ts` stops at `meta` (15pt); the small print on a
 *  card sits a step below it. Declared once here rather than inline on
 *  eight rows, which is how the other screens ended up with 12, 12.5, 13
 *  and 13.5 all meaning "caption". */
const CAPTION = { fontSize: 13, fontWeight: font.regular } as const;

const s = StyleSheet.create({
  lede: { ...type.body, color: colors.textSecondary, marginBottom: 10 },
  byline: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: space.headingToContent },
  bylineText: { ...CAPTION, color: colors.textSecondary },
  thin: { ...CAPTION, color: colors.textTertiary, marginBottom: 10 },

  cardWrap: { marginBottom: space.cardGap },
  cardBest: { borderColor: colors.accentFill, borderWidth: 1 },

  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  name: { ...type.headline, color: colors.text, flex: 1 },

  badge: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
    backgroundColor: colors.surfaceGlass,
  },
  badgeText: { ...CAPTION, color: colors.textSecondary, fontWeight: font.semibold },
  badgeOn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
  },
  badgeOnText: { ...CAPTION, color: colors.accentInk, fontWeight: font.semibold },

  stop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  time: { ...CAPTION, color: colors.textSecondary, width: 44, fontVariant: ['tabular-nums'] },
  dotCol: { alignItems: 'center', width: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentFill },
  rail: { position: 'absolute', top: 8, width: 2, height: 34, backgroundColor: colors.borderGlassSoft },
  stopName: { ...type.body, color: colors.text, flex: 1, fontWeight: font.semibold },
  area: { ...CAPTION, color: colors.textTertiary, maxWidth: 96, textAlign: 'right' },

  legRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 60, paddingVertical: 5 },
  legText: { ...CAPTION, color: colors.textTertiary },

  foot: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  summary: { ...CAPTION, color: colors.textSecondary },
  dropped: { ...CAPTION, color: colors.textTertiary, marginTop: 8 },

  emptyCard: { alignItems: 'center' },
  emptyText: { ...type.body, color: colors.textSecondary, textAlign: 'center' },

  footnote: { ...CAPTION, color: colors.textTertiary, marginTop: 2, marginBottom: 16 },
  regen: { marginTop: 4 },
});
