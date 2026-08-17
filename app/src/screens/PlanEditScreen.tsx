// The plan the reader picked, before they commit to it.
//
// Everything here is a nudge to something the planner already decided, and
// the rule the screen exists to honour lives one file over in
// `lib/itinerary`: a time set by hand is never recomputed. Add a stop above
// dinner and dinner stays at eight. Without that, every edit quietly undoes
// the last one and nothing on screen admits it.
//
// The list is not a drag-and-drop surface. Stops move with arrows rather
// than by dragging, and that is a deliberate trade rather than a stub:
// `FlatList` with a pan responder inside a `ScrollView` fights the scroll
// gesture, and getting it right needs a gesture-handler dependency this app
// does not carry. Two buttons reorder a three-stop evening in one tap each
// and work under VoiceOver, which dragging does not.
//
// ── on Share and Invite ──
//
// Both are mocks, and the screen says so rather than leaving a dead button.
// "Crew" is a word this repo uses in copy and has never modelled: there is
// no membership table, no invitation, no policy letting anybody read a row
// they do not own. Wiring a button to nothing would be the same mistake the
// sketching screen used to make.

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AmbientWarmth, Card, GradientCta, PressableScale, Screen, fireHaptic, successHaptic,
  useTabBarClearance,
} from '../components/ui';
import { derivedTitle, factLine, freshen, narrate, type Narration } from '../lib/assist';
import { useAuth } from '../lib/auth';
import { usePlaces } from '../lib/catalog';
import { useCity } from '../lib/city';
import { clampDay, fromISO, todayISO } from '../lib/day';
import { saveTrip } from '../lib/data';
import { dateline } from '../lib/format';
import { fmtDistance } from '../lib/geo';
import { useI18n } from '../lib/i18n';
import {
  legsOfPlan, move, NUDGE_MIN, nudge, outOfOrder, remove, windowOf, type Editable,
} from '../lib/itinerary';
import { planTrips } from '../lib/planner';
import { membersOf } from '../lib/place';
import { useSave } from '../lib/save';
import { useNoteEvent, usePlanProfile } from '../lib/tasteProfile';
import { stopCount, summaryLine } from '../lib/sketch';
import { COMPANY, type TripDraft } from '../lib/trip';
import type { Place } from '../lib/types';
import type { Nav, RootRoute } from '../nav';
import { colors, font, gradAI, radius, space, type } from '../theme';

const clock = (minutes: number) => {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const money = (vnd: number) => (vnd >= 1_000_000
  ? `${Math.round(vnd / 100_000) / 10}M ₫`
  : `${Math.round(vnd / 1000)}k ₫`);

export default function PlanEditScreen({ navigation, route }: {
  navigation: Nav;
  route: RootRoute<'PlanEdit'>;
}) {
  const { t, lang } = useI18n();
  const clearance = useTabBarClearance();
  const p = route.params;
  const { data: places } = usePlaces();
  const { city } = useCity();
  const { session } = useAuth();
  const { mine } = useSave();
  const { taste, budgetVnd } = usePlanProfile();
  const note = useNoteEvent();

  const day = clampDay(p.date || todayISO());
  const draft: TripDraft = useMemo(() => ({
    company: null, categories: p.categories, district: p.district, at: null,
    date: day, when: p.when, from: p.from ?? [],
  }), [p.categories, p.district, day, p.when, p.from]);

  // Resolved here the way the options screen resolves them, because the
  // rebuild below is only faithful if it gets the same inputs. The planner
  // still has no business knowing what a collection is.
  const pinned = useMemo(() => {
    if (!p.from?.length) return [];
    const wanted = new Set(p.from);
    return mine.data.filter((c) => wanted.has(c.slug)).flatMap((c) => membersOf(c, places));
  }, [p.from, mine.data, places]);

  // Rebuilt from the same pure inputs the options screen used, so the plan
  // the reader tapped is the plan they get. Serialising stops through
  // navigation would work too and would drift the first time either screen
  // changed what a stop holds.
  //
  // "The same inputs" has to mean all of them. This once passed the seed
  // alone, which quietly dropped two: a day seeded from a collection lost
  // its pinned places on the way here, and a plan reached through
  // Regenerate was redrawn without the slugs that draw had been told to
  // avoid — so the reader tapped one evening and opened another.
  const picked = useMemo(() => {
    const plans = planTrips(draft, places, city?.id ?? null, {
      seed: p.seed, pinned, avoid: p.avoid, taste, budgetVnd,
    });
    return plans.find((pl) => pl.lens === p.lens) ?? plans[0] ?? null;
  }, [draft, places, city?.id, p.seed, p.lens, p.avoid, pinned, taste, budgetVnd]);

  const [stops, setStops] = useState<Editable<Place>[] | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * The words, asked for once and only for the plan the reader picked.
   *
   * Not on the options screen: narrating all three would triple the cost to
   * name two evenings nobody chose. And not re-asked when the reader edits —
   * a line about a place is still true after the place above it moved, and
   * a screen that flickered new prose under every tap would be unreadable.
   */
  const [words, setWords] = useState<Narration>({ title: null, why: new Map(), fromModel: false });
  useEffect(() => {
    if (!picked?.stops.length) return;
    let live = true;
    void narrate(
      picked.stops.map((s) => ({
        slug: s.place.slug,
        name: s.place.name_en,
        categories: s.place.categories,
        neighborhood: s.place.neighborhood_en,
        rating: s.place.rating,
        arriveMin: s.arriveMin,
        openingHours: s.place.opening_hours,
      })),
      { company: p.company, categories: p.categories, when: p.when, where: p.where },
      lang,
    ).then((n) => { if (live) setWords(n); });
    // Left behind when the screen goes: a plan the reader has walked away
    // from should not set state on its way out.
    return () => { live = false; };
  }, [picked, p.company, p.categories, p.when, p.where, lang]);

  // Seeded once from the planner, then owned entirely by the reader. A
  // `useEffect` syncing it back would fight every edit they make.
  const current = stops ?? (picked
    ? picked.stops.map((s) => ({ place: s.place, arriveMin: s.arriveMin, dwellMin: s.dwellMin, pinned: false }))
    : []);

  /**
   * The narration with the stale parts taken out.
   *
   * One value for drawing and for saving, deliberately: the bug this fixes
   * put "A second stop to keep the conversation going" under the only stop
   * of a trip, and that sentence did not just render — it went into the
   * database, where nothing downstream can tell it was written about a plan
   * that no longer exists.
   *
   * `picked.stops` is the list the model was handed. It is the planner's
   * output and does not move when the reader edits, so it needs no state of
   * its own — `current` is the edited copy, and the difference between them
   * is exactly what has gone stale.
   */
  const live = useMemo(
    () => freshen(words, picked?.stops.map((st) => st.place.slug) ?? [], current.map((st) => st.place.slug)),
    [words, picked, current],
  );

  // Taken once, on the way in. `openState` needs an instant, and a fresh
  // `new Date()` per render would make every fact line a new object and
  // re-open the question of whether a café is open on every keystroke.
  const now = useMemo(() => new Date(), []);
  const legs = useMemo(() => legsOfPlan(current), [current]);
  const wrong = useMemo(() => outOfOrder(current), [current]);
  const [from, to] = windowOf(current);
  const spend = current.reduce((n, s) => n + (s.place.price_vnd ?? 0), 0)
    + legs.filter((l) => l?.mode === 'ride').length * 15000;

  const company = COMPANY.find((c) => c.key === p.company);
  const line = summaryLine([
    company ? t(company.en, company.vi, company.ja) : null,
    dateline(lang, fromISO(day) ?? new Date()),
    p.where,
  ]);

  // Three names, in falling order of how much anyone knows: what a model
  // called this evening, what the planner's lens called it, and what the
  // catalog alone can say. The last one is always available, which is why
  // the screen never has to render a plan with no name on it.
  const title = live.title || p.title || derivedTitle(
    current.map((s) => ({ slug: s.place.slug, name: s.place.name_en, neighborhood: s.place.neighborhood_en, arriveMin: s.arriveMin })),
    p.when,
    t,
  );

  const mock = (what: string) => Alert.alert(
    what,
    t(
      'Sharing a trip needs a way to say who else is on it, and that does not exist yet. The button is here so the shape is right.',
      'Chia sẻ một chuyến đi cần có chỗ ghi ai cùng đi, và phần đó chưa có. Nút này ở đây để giữ đúng hình hài.',
      '旅程の共有には同行者を記録する仕組みが必要で、それはまだありません。ここにあるのは形だけです。',
    ),
  );

  const onSave = async () => {
    if (!session?.user?.id || !city || !current.length) return;
    setSaving(true);
    try {
      await saveTrip({
        ownerId: session.user.id,
        cityId: city.id,
        title,
        company: p.company,
        categories: p.categories,
        district: p.district,
        day,
        when: p.when,
        generatedBy: live.fromModel ? 'rules+llm' : 'rules',
        stops: current.map((s) => ({
          placeSlug: s.place.slug,
          arriveMin: s.arriveMin,
          dwellMin: s.dwellMin,
          // Only a model's sentence is stored. The fact line is derived
          // from the place and would go stale the moment its hours change;
          // saving it would freeze last August's opening time into a trip.
          why: live.why.get(s.place.slug) ?? null,
          whyLang: live.why.has(s.place.slug) ? lang : null,
        })),
      });
      // The verdict the reader just delivered on a drafted evening, which
      // is the clearest signal in the app: these ones they kept, that one
      // they took out. Noted after the write, because a trip that failed to
      // save is not a decision about anything.
      const kept = new Set(current.map((st) => st.place.slug));
      for (const slug of kept) note(slug, 'plan_keep');
      for (const st of picked?.stops ?? []) {
        if (!kept.has(st.place.slug)) note(st.place.slug, 'plan_drop');
      }
      successHaptic();
      // Reset rather than push: the trip is saved, and leaving the editor
      // on the stack means Back lands in a draft of something that already
      // exists.
      navigation.getParent()?.navigate('Trips');
    } catch (e) {
      Alert.alert(
        t('Could not save', 'Chưa lưu được', '保存できませんでした'),
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      setSaving(false);
    }
  };

  if (!picked) {
    return (
      <Screen title={t('Plan a trip', 'Lên kế hoạch', 'プランを立てる')} onBack={() => navigation.goBack()}>
        <Card style={s.card}><Text style={s.body}>
          {t('That plan is no longer available.', 'Phương án đó không còn nữa.', 'そのプランはもう利用できません。')}
        </Text></Card>
      </Screen>
    );
  }

  return (
    <Screen title={title} onBack={() => navigation.goBack()}>
      <AmbientWarmth />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.page, paddingBottom: clearance }}
        showsVerticalScrollIndicator={false}
      >
        {!!line && <Text style={s.sub}>{line}</Text>}

        {/* Mocked, and labelled. The avatars are the reader's own initial
            twice over rather than invented names — a fake second person on
            a trip nobody can share is a lie with a face on it. */}
        <View style={s.crew}>
          <View style={s.avatars}>
            <LinearGradient {...gradAI} style={s.avatar}>
              <Text style={s.avatarText}>
                {(session?.user?.email ?? '?').slice(0, 1).toUpperCase()}
              </Text>
            </LinearGradient>
          </View>
          <Text style={s.crewText}>{t('Just you, for now', 'Hiện chỉ có bạn', '今はあなただけ')}</Text>
          <PressableScale onPress={() => mock(t('Invite', 'Mời thêm', '招待'))} style={s.ghost}>
            <Ionicons name="person-add-outline" size={14} color={colors.textSecondary} />
            <Text style={s.ghostText}>{t('Invite', 'Mời', '招待')}</Text>
          </PressableScale>
        </View>

        <Text style={s.eyebrow}>
          {t('STOPS · NUDGE A TIME OR MOVE ONE', 'CÁC ĐIỂM · CHỈNH GIỜ HOẶC ĐỔI THỨ TỰ', 'スポット · 時間や順番を調整')}
        </Text>

        {current.map((stop, i) => (
          <View key={stop.place.slug}>
            <Card style={[s.card, wrong.includes(i) && s.rowWrong]}>
              <View style={s.row}>
                <View style={s.timeBox}>
                  <PressableScale
                    haptic="selection"
                    onPress={() => setStops(nudge(current, i, -NUDGE_MIN))}
                    containerStyle={s.step}
                  >
                    <Ionicons name="remove" size={15} color={colors.textSecondary} />
                  </PressableScale>
                  <Text style={[s.time, stop.pinned && s.timePinned]}>{clock(stop.arriveMin)}</Text>
                  <PressableScale
                    haptic="selection"
                    onPress={() => setStops(nudge(current, i, NUDGE_MIN))}
                    containerStyle={s.step}
                  >
                    <Ionicons name="add" size={15} color={colors.textSecondary} />
                  </PressableScale>
                </View>

                <View style={s.who}>
                  <Text style={s.name} numberOfLines={1}>{stop.place.name_en}</Text>
                  <Text style={s.area} numberOfLines={1}>
                    {summaryLine([stop.place.neighborhood_en, `${stop.dwellMin}′`])}
                  </Text>
                </View>

                <View style={s.tools}>
                  <PressableScale
                    haptic="selection"
                    onPress={() => setStops(move(current, i, i - 1))}
                    containerStyle={[s.tool, i === 0 && s.toolOff]}
                  >
                    <Ionicons name="chevron-up" size={16} color={colors.textSecondary} />
                  </PressableScale>
                  <PressableScale
                    haptic="selection"
                    onPress={() => setStops(move(current, i, i + 1))}
                    containerStyle={[s.tool, i === current.length - 1 && s.toolOff]}
                  >
                    <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                  </PressableScale>
                  <PressableScale
                    onPress={() => { fireHaptic('light'); setStops(remove(current, i)); }}
                    containerStyle={s.tool}
                  >
                    <Ionicons name="close" size={16} color={colors.textTertiary} />
                  </PressableScale>
                </View>
              </View>

              {/* A sentence if one was written, and the facts behind it if
                  not. Never nothing, and never a spinner: the plan is
                  complete before the words arrive, and a row that shuffled
                  its own height when they landed would be the screen
                  admitting it was waiting.

                  On its own line under the row rather than in the middle
                  column, because that column is what is left after a time
                  stepper on one side and three tools on the other — about
                  a third of the card, which turned every sentence into two
                  clipped words. Full width it reads. */}
              {(() => {
                const line = live.why.get(stop.place.slug)
                  || factLine({
                    slug: stop.place.slug,
                    name: stop.place.name_en,
                    rating: stop.place.rating,
                    openingHours: stop.place.opening_hours,
                    arriveMin: stop.arriveMin,
                  }, now, t);
                return line ? <Text style={s.why} numberOfLines={2}>{line}</Text> : null;
              })()}

              {/* Only when the reader made it so. A plan reading backwards
                  with nothing saying so is a plan that gets somebody to a
                  closed door. */}
              {wrong.includes(i) && (
                <Text style={s.warn}>
                  {t('Earlier than the stop above.', 'Sớm hơn điểm phía trên.', '前のスポットより早い時刻です。')}
                </Text>
              )}
            </Card>

            {legs[i] && (
              <View style={s.legRow}>
                <Ionicons
                  name={legs[i]!.mode === 'walk' ? 'walk-outline' : 'car-outline'}
                  size={12}
                  color={colors.textTertiary}
                />
                <Text style={s.legText}>
                  {fmtDistance(legs[i]!.km)} · ≈ {legs[i]!.minutes} {t('min', 'phút', '分')}
                </Text>
              </View>
            )}
          </View>
        ))}

        {current.length === 0 && (
          <Card style={s.card}><Text style={s.body}>
            {t('Nothing left in this plan.', 'Không còn điểm nào trong plan này.', 'このプランには何も残っていません。')}
          </Text></Card>
        )}

        <Text style={s.total}>
          {summaryLine([
            stopCount(current.length, t),
            current.length ? `${clock(from)}–${clock(to)}` : null,
            spend > 0 ? `~${money(spend)} / ${t('person', 'người', '人')}` : null,
          ])}
        </Text>

        <View style={s.actions}>
          {/* Wrapped in the flex rather than given it: `wide` puts
              `alignSelf: 'stretch'` on the button, which in a *row* stretches
              its height and not its width. The wrapper takes what the row has
              left, `wide` fills it, and Share keeps its own size. */}
          <View style={{ flex: 1 }}>
            <GradientCta
              icon="checkmark"
              wide
              label={saving
                ? t('Saving…', 'Đang lưu…', '保存中…')
                : t('Save to Trips', 'Lưu vào Chuyến đi', '旅程に保存')}
              onPress={() => { if (!saving) void onSave(); }}
            />
          </View>
          <PressableScale
            onPress={() => mock(t('Share', 'Chia sẻ', '共有'))}
            style={s.share}
          >
            <Ionicons name="paper-plane-outline" size={16} color={colors.textSecondary} />
            <Text style={s.ghostText}>{t('Share', 'Chia sẻ', '共有')}</Text>
          </PressableScale>
        </View>

        <Text style={s.note}>
          {session?.user?.id
            ? t(
              'Times and order stay editable after saving. Sharing is not built yet.',
              'Giờ giấc và thứ tự vẫn sửa được sau khi lưu. Phần chia sẻ thì chưa làm.',
              '保存後も時刻と順番は編集できます。共有はまだありません。',
            )
            : t(
              'Sign in to save this trip.',
              'Đăng nhập để lưu chuyến đi này.',
              'この旅程を保存するにはサインインしてください。',
            )}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const CAPTION = { fontSize: 13, fontWeight: font.regular } as const;

const s = StyleSheet.create({
  sub: { ...CAPTION, color: colors.textSecondary, marginBottom: 14 },
  body: { ...type.body, color: colors.textSecondary },

  crew: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: space.titleToContent },
  avatars: { flexDirection: 'row' },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.accentInk, fontWeight: font.bold, fontSize: 13 },
  crewText: { ...CAPTION, color: colors.textSecondary, flex: 1 },
  ghost: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.pill, backgroundColor: colors.surfaceGlass,
  },
  ghostText: { ...CAPTION, color: colors.textSecondary, fontWeight: font.semibold },

  eyebrow: {
    ...CAPTION, color: colors.textTertiary, fontWeight: font.semibold,
    letterSpacing: 0.6, marginBottom: 8,
  },

  // `Card` carries no padding of its own — see the note on the component.
  // Without this the stepper sat against the card's left edge and the
  // corner radius clipped it.
  card: { padding: space.cardPadding },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowWrong: { borderColor: colors.accentFill, borderWidth: 1 },
  timeBox: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  step: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceGlass,
  },
  time: { ...CAPTION, color: colors.text, width: 46, textAlign: 'center', fontVariant: ['tabular-nums'] },
  /** A time the reader set, marked so they can see which ones the planner
   *  will no longer touch. */
  timePinned: { color: colors.accent, fontWeight: font.semibold },

  who: { flex: 1 },
  name: { ...type.body, color: colors.text, fontWeight: font.semibold },
  area: { ...CAPTION, color: colors.textTertiary },
  /** The model's sentence, or the facts standing in for it. A step down
   *  from the name and a step up from the area line, because it is the row's
   *  only claim about why this place rather than another. */
  // Full width under the row now, so it needs the air a new block needs
  // rather than the 3pt that separated it from the line above it inside a
  // column.
  why: { ...CAPTION, color: colors.textSecondary, lineHeight: 18, marginTop: 10 },

  tools: { flexDirection: 'row', gap: 2 },
  tool: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  toolOff: { opacity: 0.25 },

  warn: { ...CAPTION, color: colors.accent, marginTop: 8 },

  legRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 12, paddingVertical: 6 },
  legText: { ...CAPTION, color: colors.textTertiary },

  total: { ...CAPTION, color: colors.textSecondary, marginTop: 10, marginBottom: 16 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  share: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: radius.pill, backgroundColor: colors.surfaceGlass,
  },
  note: { ...CAPTION, color: colors.textTertiary, marginTop: 12 },
});
