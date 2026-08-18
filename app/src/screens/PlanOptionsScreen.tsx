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

import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AmbientWarmth, Card, GradientCta, PressableScale, Screen, useTabBarClearance,
} from '../components/ui';
import { prefetchNarration } from '../lib/assist';
import { usePlaces } from '../lib/catalog';
import { useCity } from '../lib/city';
import { clampDay, fromISO, todayISO } from '../lib/day';
import { clockOf, dateline } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { fmtDistance } from '../lib/geo';
import { membersOf } from '../lib/place';
import { planTrips, type LensKey, type TripPlan } from '../lib/planner';
import { usePlanProfile } from '../lib/tasteProfile';
import { useSave } from '../lib/save';
import { stopCount, summaryLine } from '../lib/sketch';
import { COMPANY, type TripDraft } from '../lib/trip';
import type { Nav, RootRoute } from '../nav';
import { colors, font, gradAI, radius, space, type } from '../theme';

/**
 * What each lens is called on its card. The badge comes from the lens
 * rather than from a model: it says which weighting produced this plan,
 * which is a fact, where the plan's *name* is a piece of writing and
 * waits for a later phase.
 *
 * Two of the Vietnamese labels were translations of the English word
 * rather than of the meaning, and both landed on a different word. "Hợp
 * nhất" is read as *merge* far more often than as *most suitable*, so the
 * recommended plan was badged "Merged"; "Biểu tượng" is the noun *symbol*
 * — a logo — not the adjective. Neither is a near miss a reader corrects
 * from context, because both are ordinary words meaning something else.
 */
const BADGE: Record<LensKey, { en: string; vi: string; ja: string; star?: boolean }> = {
  match: { en: 'Best match', vi: 'Khớp nhất', ja: '最適', star: true },
  iconic: { en: 'Iconic views', vi: 'Nổi tiếng', ja: '定番' },
  lowkey: { en: 'Low-key', vi: 'Nhẹ nhàng', ja: '控えめ' },
};

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
  const { taste, budgetVnd } = usePlanProfile();

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
    () => planTrips(draft, places, city?.id ?? null,
      { seed, startMin: p.startMin, pinned, avoid: shown, taste, budgetVnd }),
    [draft, places, city?.id, seed, p.startMin, pinned, shown, taste, budgetVnd],
  );

  /**
   * The words are asked for here, while the reader is still comparing
   * cards — not on the editor they land on.
   *
   * This reverses a documented decision. The editor used to ask on
   * arrival, precisely because narrating all three triples the calls to
   * name two evenings nobody chose — and the price of that thrift was paid
   * on the wrong screen: the plan rendered as facts and the model's
   * sentences landed up to four seconds later, rewriting the card under
   * the reader. Three calls is the cost of an editor that is finished when
   * it opens. The reading time on this screen is the model's head start,
   * and the daily cap still holds server-side.
   *
   * Fire-and-forget into the cache in `assist.ts`; the editor reads it
   * synchronously. Nothing renders from here, so nothing here flickers.
   */
  useEffect(() => {
    for (const plan of plans) {
      void prefetchNarration(
        plan.stops.map((st) => ({
          slug: st.place.slug,
          name: st.place.name_en,
          categories: st.place.categories,
          neighborhood: st.place.neighborhood_en,
          rating: st.place.rating,
          arriveMin: st.arriveMin,
          openingHours: st.place.opening_hours,
        })),
        { company: p.company, categories: p.categories, when: p.when, where: p.where },
        lang,
      );
    }
  }, [plans, p.company, p.categories, p.when, p.where, lang]);

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

  /**
   * What happened to the places the reader asked to build from.
   *
   * Somebody who seeded an evening from a café list should be told their
   * picks did not all make it, rather than left to notice. Two things this
   * used to get wrong:
   *
   * It named a reason it did not have. `dropReason` returns four — not
   * published, another city, shut at that hour, or not the kind of place
   * the reader asked for — and the line called all four "closed or
   * unavailable at this hour". The last of those is much the commonest:
   * seed an evening of food from a twenty-place list and every café in it
   * drops for being a café. Telling somebody their café is closed when it
   * is merely not a restaurant sends them to check its opening hours.
   *
   * So it names the hour only when the hour is the whole of it, and
   * otherwise says the true, quieter thing. No counts by reason: a reader
   * looking at three evenings wants a sentence, not a table.
   *
   * And it sits under the cards rather than on them. `pinnedDropped` is
   * computed once and handed to all three plans, so on the cards it was the
   * same sentence three times — which is exactly why `perPerson` below
   * lives here too.
   */
  const dropped = plans[0]?.pinnedDropped ?? [];
  const shutOnly = dropped.length > 0 && dropped.every((d) => d.reason === 'closed');
  const droppedLine = dropped.length === 0 ? null : shutOnly
    ? t(
      'Some places from your collections are not open at this hour.',
      'Một số chỗ trong bộ sưu tập của bạn không mở vào giờ này.',
      'コレクションの一部はこの時間帯は開いていません。',
    )
    : t(
      'Some places from your collections did not fit this plan.',
      'Một số chỗ trong bộ sưu tập của bạn chưa hợp với plan này.',
      'コレクションの一部は今回のプランには入りませんでした。',
    );

  // Said once under the cards rather than on each of them: it is the same
  // sentence three times otherwise, and it is about how every figure on
  // the screen is read.
  const perPerson = t(
    'Costs are estimated for one person.',
    'Chi phí ước tính cho một người.',
    '費用は1人あたりの目安です。',
  );

  return (
    <Screen
      // Which outing this is, not always an evening. The title was a fixed
      // string, so a day planned from the wizard arrived under the heading
      // "Your evening, three ways" above three plans starting at 09:00 —
      // and the screen after it, which derives its name properly, called
      // the same plan "A day out". Two screens, one plan, two answers.
      title={p.when === 'day'
        ? t('Your day, three ways', 'Ngày của bạn, ba cách', 'あなたの一日、三通り')
        : t('Your evening, three ways', 'Buổi tối của bạn, ba cách', 'あなたの夜、三通り')}
      // Moved out of the body and into the header, which is where the
      // reference design puts it and where it costs no scroll: it is one
      // quiet line about the screen, not a paragraph on it.
      subtitle={t(
        'Distances checked · shortest hops first',
        'Đã tính quãng đường · chặng ngắn lên trước',
        '距離を確認済み · 移動の短い順',
      )}
      onBack={() => navigation.goBack()}
    >
      <AmbientWarmth />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.page, paddingBottom: clearance }}
        showsVerticalScrollIndicator={false}
      >
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
              ...p, seed, lens: plan.lens, title: plan.title ?? undefined, avoid: shown,
            })}
          />
        ))}

        {plans.length === 0 && (
          <Card style={[s.card, s.emptyCard]}>
            <Text style={s.emptyText}>
              {t(
                'Nothing here matches those answers now. Try Regenerate, or change what you asked for.',
                'Hiện không có gì khớp với lựa chọn đó. Thử tạo lại, hoặc sửa câu trả lời.',
                '今の条件に合うものがありません。作り直すか、条件を変えてみてください。',
              )}
            </Text>
          </Card>
        )}

        {!!droppedLine && <Text style={s.dropped}>{droppedLine}</Text>}

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

/**
 * Where a plan happens, as a heading — until a model gives it a name.
 *
 * The fallback used to be the *first* stop's district, flat. That was one
 * word repeated: the district column beside every stop already said it, and
 * on a thin catalog two of the three cards came back headed "Hoàn Kiếm",
 * which is a title that tells the reader nothing about which card is which.
 *
 * Now that each stop prints its own area under its name, the heading is
 * free to answer the question the rows cannot: does this outing stay put,
 * or does it cross town? That is the real trade between the three cards —
 * fifty metres on foot in one district against two kilometres by taxi into
 * another — and it belongs on the first line rather than in a distance the
 * reader has to add up.
 *
 * Counted over distinct areas in order, so "+1" means one *other* district
 * and not one more stop. A plan whose places carry no district at all falls
 * back to naming the outing, which is the only honest thing left to say.
 */
function areaLine(plan: TripPlan, t: (en: string, vi: string, ja: string) => string): string {
  const areas: string[] = [];
  for (const st of plan.stops) {
    const a = st.place.neighborhood_en?.trim();
    if (a && !areas.includes(a)) areas.push(a);
  }
  if (!areas.length) return t('An outing', 'Một buổi đi chơi', 'おでかけ');
  const more = areas.length - 1;
  if (!more) return areas[0];
  return t(`${areas[0]} +${more} area`, `${areas[0]} +${more} khu`, `${areas[0]} 他${more}地区`);
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
      <Card style={[s.card, best && s.cardBest]}>
        <View style={s.head}>
          {/* Untitled until a model names it. The stops carry the plan
              until then, which is more use than an invented title. */}
          <Text style={s.name} numberOfLines={1}>
            {plan.title ?? areaLine(plan, t)}
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

        {/* The leg lives *inside* the stop's own column, and that is
            structural rather than cosmetic. The rail used to be
            `height: 34` — a number measured once against a one-line row and
            then load-bearing, so any change to the spacing broke the
            timeline into disconnected stubs. Nested this way the dot column
            spans the name, the meta line and the leg together, and the rail
            is `flex: 1`: it reaches the next dot whatever is between them,
            and nobody has to remember to re-measure it. */}
        {plan.stops.map((st, i) => (
          <View key={st.place.slug} style={s.stop}>
            <Text style={s.time}>{clockOf(st.arriveMin)}</Text>
            <View style={s.dotCol}>
              <View style={s.dot} />
              {i + 1 < plan.stops.length && <View style={s.rail} />}
            </View>
            <View style={s.body}>
              <Text style={s.stopName} numberOfLines={1}>{st.place.name_en}</Text>
              {/* The district under the name rather than in a column beside
                  it, which is how the editor and the saved trip already
                  print it. Right-aligned it took 96pt off every name on the
                  one screen where the names *are* the choice — and half
                  this catalog has a name longer than what was left. It also
                  makes room for the dwell, which this screen never showed
                  at all while both screens after it did. */}
              <Text style={s.stopMeta} numberOfLines={1}>
                {summaryLine([st.place.neighborhood_en, `${st.dwellMin}′`])}
              </Text>
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
          </View>
        ))}

        <View style={s.foot}>
          <Text style={s.summary}>
            {summaryLine([
              stopCount(plan.stops.length, t),
              `~${hours(plan.windowMin)}`,
              km > 0 ? fmtDistance(km) : null,
              total > 0 ? `~${money(total)}` : null,
            ])}
          </Text>
        </View>

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
  // `Card` carries no padding of its own — see the note on the component.
  // Without this the cards ran to both screen edges and the corner radius
  // clipped the first glyph of every plan name.
  card: { padding: space.cardPadding },
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

  // `flex-start`, not `center`: a stop is two lines now, and centred the
  // hour and the dot would float to the middle of the pair instead of
  // sitting on the name they belong to.
  stop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  // The 2 is optical, not arithmetic — the caption's smaller cap height
  // sits high in its line box, so matching the box tops leaves the digits
  // reading above the name. TripDetail's own time column does the same.
  time: {
    ...CAPTION, color: colors.textSecondary, width: 44,
    fontVariant: ['tabular-nums'], paddingTop: 2,
  },
  dotCol: { alignItems: 'center', width: 10, alignSelf: 'stretch' },
  dot: {
    width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: colors.accentFill,
  },
  // No height. It fills whatever the stop beside it turned out to be —
  // see the note where the leg is nested.
  rail: { flex: 1, width: 2, backgroundColor: colors.borderGlassSoft },
  body: { flex: 1, gap: 2 },
  stopName: { ...type.body, color: colors.text, fontWeight: font.semibold },
  stopMeta: { ...CAPTION, color: colors.textTertiary },

  // Doubled from 5. Ten points of air between two stops read as one block
  // of text with a line in it rather than as two places you go to.
  legRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10 },
  legText: { ...CAPTION, color: colors.textTertiary },

  foot: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  summary: { ...CAPTION, color: colors.textSecondary },
  dropped: { ...CAPTION, color: colors.textTertiary, marginTop: 2, marginBottom: 6 },

  emptyCard: { alignItems: 'center' },
  emptyText: { ...type.body, color: colors.textSecondary, textAlign: 'center' },

  footnote: { ...CAPTION, color: colors.textTertiary, marginTop: 2, marginBottom: 16 },
  regen: { marginTop: 4 },
});
