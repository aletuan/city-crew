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
// ── on Share, and on where Invite went ──
//
// Share is still a mock, and the screen says so rather than leaving a dead
// button.
//
// Invite is not here any more. It used to be a mock beside it for a reason
// that has since been fixed — "there is no membership table, no invitation,
// no policy letting anybody read a row they do not own" — and the
// trip_invites migration is that table. But an invitation has to point at a
// trip, and on this screen the plan does not exist yet: it is a draft the
// reader may still walk away from. So inviting lives on the trip's own
// screen, after Save, and the crew row here says so instead of offering a
// button that would have to invent a trip to work.

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AmbientWarmth, Avatar, Card, GradientCta, PressableScale, RoundIconButton, Screen, fireHaptic,
  successHaptic, useTabBarClearance,
} from '../components/ui';
import {
  cachedNarration, derivedTitle, factLine, freshen, narratableOf, prefetchNarration,
  type Narration,
} from '../lib/assist';
import { useAuth } from '../lib/auth';
import { CATEGORIES, categoriesOf } from '../lib/categories';
import { usePlaces } from '../lib/catalog';
import { useCity } from '../lib/city';
import { clampDay, fromISO, todayISO } from '../lib/day';
import { saveTrip } from '../lib/data';
import { clockOf, dateline, fmtMinutes } from '../lib/format';
import { fmtDistance } from '../lib/geo';
import { useI18n } from '../lib/i18n';
import {
  legsOfPlan, move, NUDGE_MIN, nudge, outOfOrder, remove, windowOf, type Editable,
} from '../lib/itinerary';
import { planTrips } from '../lib/planner';
import { scheduleTripReminder } from '../lib/reminders';
import { membersOf } from '../lib/place';
import { useSave } from '../lib/save';
import { useNoteEvent, usePlanProfile } from '../lib/tasteProfile';
import { stopCount, summaryLine } from '../lib/sketch';
import { draftFrom, type TripDraft } from '../lib/trip';
import type { Place } from '../lib/types';
import type { Nav, RootRoute } from '../nav';
import { colors, font, space, type } from '../theme';

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
  const { session, profile } = useAuth();
  const { mine } = useSave();
  const { taste, budgetVnd } = usePlanProfile();
  const note = useNoteEvent();

  const day = clampDay(p.date || todayISO());
  const draft: TripDraft = useMemo(() => draftFrom(p, day), [p, day]);

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
      seed: p.seed, startMin: p.startMin, pinned, avoid: p.avoid, taste, budgetVnd,
    });
    return plans.find((pl) => pl.lens === p.lens) ?? plans[0] ?? null;
  }, [draft, places, city?.id, p.seed, p.startMin, p.lens, p.avoid, pinned, taste, budgetVnd]);

  const [stops, setStops] = useState<Editable<Place>[] | null>(null);
  const [saving, setSaving] = useState(false);

  /** What the model was — or would be — asked about, in exactly the shape
   *  the options screen prefetched with, so the cache key matches. */
  const asked = useMemo(() => narratableOf(picked?.stops ?? []), [picked]);

  /**
   * The words, read from the cache the options screen filled.
   *
   * This screen used to ask for them itself, on arrival — the deliberate
   * thrift of narrating only the plan the reader picked — and paid for it
   * in the worst currency: the card rendered its facts, and the model's
   * sentences rewrote them under the reader up to four seconds in. The
   * asking now starts on the sketch screen, whose last step holds until
   * the words settle, with the options screen prefetching again as a
   * backstop for Regenerate — so by the time a card is tapped the answer
   * is normally sitting in `cachedNarration` for the first render to use.
   *
   * The effect covers the two ways that can miss. A tap faster than the
   * model joins the in-flight call — `prefetchNarration` dedupes on key —
   * and lands one update, into lines whose height is already reserved. And
   * a failed generation is *cached as empty*, so this screen opens on
   * facts and stays on facts: the fallback is a state, not a retry loop.
   *
   * Still never re-asked when the reader edits — a line about a place is
   * still true after the place above it moved, and a screen that flickered
   * new prose under every tap would be unreadable. `freshen` below is what
   * retires the lines that editing falsifies.
   */
  const [words, setWords] = useState<Narration>(() => (asked.length
    ? cachedNarration(asked, lang)
    : null) ?? { title: null, why: new Map(), fromModel: false });
  useEffect(() => {
    if (!asked.length) return;
    const hit = cachedNarration(asked, lang);
    // Same object the initial state read — React bails on the no-op. Here
    // for the rare re-run where `picked` itself changed under the screen.
    if (hit) { setWords(hit); return; }
    let live = true;
    void prefetchNarration(
      asked,
      { company: p.company, categories: p.categories, when: p.when, where: p.where },
      lang,
    ).then((n) => { if (live) setWords(n); });
    // Left behind when the screen goes: a plan the reader has walked away
    // from should not set state on its way out.
    return () => { live = false; };
  }, [asked, p.company, p.categories, p.when, p.where, lang]);

  // Seeded once from the planner, then owned entirely by the reader. A
  // `useEffect` syncing it back would fight every edit they make.
  //
  // Memoised because three `useMemo`s below depend on it. Before the lint
  // gate this was a bare expression, so on every render where the reader had
  // not edited yet — `stops` still null — it built a new array, and `live`,
  // `legs` and `wrong` all recomputed off a dependency that had changed
  // identity without changing value. The memo is what makes theirs work.
  const current = useMemo(
    () => stops ?? (picked
      ? picked.stops.map((s) => ({ place: s.place, arriveMin: s.arriveMin, dwellMin: s.dwellMin, pinned: false }))
      : []),
    [stops, picked],
  );

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

  // Date first, place after, company nowhere: the crew row below carries
  // who is going, and every trip subtitle keeps this same order.
  const line = summaryLine([
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
      const tripId = await saveTrip({
        ownerId: session.user.id,
        cityId: city.id,
        title,
        company: p.company,
        categories: p.categories,
        district: p.district,
        atLat: p.atLat,
        atLng: p.atLng,
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
      // The evening-before nudge, planted while the day is known. After
      // the save and fire-and-forget: a reminder is a courtesy, and the
      // reader is not kept waiting on the permission sheet's animation.
      scheduleTripReminder(
        { id: tripId, day },
        {
          title: t('Tomorrow: ' + title, 'Ngày mai: ' + title, '明日：' + title),
          body: t(
            'Your plan starts in the morning. Sleep well.',
            'Kế hoạch bắt đầu vào sáng mai. Ngủ ngon nhé.',
            '予定は明日の朝から。おやすみなさい。',
          ),
        },
      );
      const kept = new Set(current.map((st) => st.place.slug));
      for (const slug of kept) note(slug, 'plan_keep');
      for (const st of picked?.stops ?? []) {
        if (!kept.has(st.place.slug)) note(st.place.slug, 'plan_drop');
      }
      successHaptic();
      // Reset, then leave — and for a long time this comment said "reset"
      // over a line that only left. The Ideas stack kept the whole flow,
      // so the next visit to the tab landed back on this editor with a
      // live Save button: a screen that *looks* like "edit my saved trip"
      // and *is* "insert a duplicate", because nothing here is wired to
      // the saved row and TripDetail is view-only. The pop happens first,
      // while this stack is still the visible one, so by the time the
      // Trips tab shows there is nothing stale behind it; the wizard at
      // the bottom keeps its answers, because it is the same mounted
      // screen — completing the flow discards the flow, not the asks.
      // Same pattern as the auth screens, which popToTop when theirs ends.
      navigation.popToTop();
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
    <Screen
      title={title}
      subtitle={line || undefined}
      onBack={() => navigation.goBack()}
      /**
       * Share goes here rather than beside Save, and the reference design
       * shows it in both places — which is the thing this app just spent a
       * commit removing from the Trips tab. One offer per screen.
       *
       * The header is the right half of that pair. Sharing is a mock: there
       * is no membership table, no invitation, nothing that lets anybody
       * read a row they do not own. A button that cannot do its job should
       * not stand shoulder to shoulder with the one that works, sized and
       * weighted like its equal — and the bottom row's caption then had to
       * spend a sentence apologising for it. As a header accessory it is
       * where iOS puts share, it is quiet, and Save gets the full width it
       * has earned by being the only thing on this screen that does
       * anything.
       */
      right={(
        <RoundIconButton
          icon="share-outline"
          onPress={() => mock(t('Share', 'Chia sẻ', '共有'))}
          label={t('Share', 'Chia sẻ', '共有')}
        />
      )}
    >
      <AmbientWarmth />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.page, paddingBottom: clearance }}
        showsVerticalScrollIndicator={false}
      >
        {/* The reader's own face — the profile has one now, so the initial
            it used to wear is only the fallback Avatar itself draws. The
            row itself always stands: hiding it on solo pushed the page
            around and took the face with it, and the owner sent it back.

            What is no longer here is Invite. It was a labelled mock for a
            reason that has since been fixed — trip_invites is that
            membership table — but an invitation points at a trip, and
            here the plan does not exist yet. So on a plan with company
            the row says what the button would have had to lie about — a
            sentence, not a disabled control — and a solo plan does not
            even say that: pointing at inviting under a plan marked
            "just me" is the app arguing with the reader. */}
        <View style={s.crew}>
          <View style={s.avatars}>
            <Avatar url={profile.avatar_url} size={30} />
          </View>
          <Text style={s.crewText}>{t('Just you, for now', 'Hiện chỉ có bạn', '今はあなただけ')}</Text>
          {p.company !== 'solo' && (
            <Text style={s.crewHint}>
              {t('Save first, then invite', 'Lưu trước rồi mời', '保存してから招待')}
            </Text>
          )}
        </View>

        <Text style={s.eyebrow}>
          {t('STOPS · NUDGE A TIME OR MOVE ONE', 'CÁC ĐIỂM · CHỈNH GIỜ HOẶC ĐỔI THỨ TỰ', 'スポット · 時間や順番を調整')}
        </Text>

        {current.map((stop, i) => {
          // The first category the place carries, worn as a glyph in a
          // soft well — the same hue this concept wears on Explore's
          // filter row and the wizard's chips, so a café here looks like
          // "café" everywhere else. A place nothing classifies gets the
          // neutral pin on the neutral ground, not a guess.
          const cat = CATEGORIES[categoriesOf(stop.place)[0]];
          return (
          <View key={stop.place.slug}>
            <Card style={[s.card, wrong.includes(i) && s.rowWrong]}>
              {/* What the place is, up top; what you do to it, at the
                  bottom. The old card led every row with the time stepper,
                  which put the controls between the reader and the name —
                  the first thing on a card about a place was a minus
                  button. The identity band now reads left to right as
                  glyph, name, rating; the controls share a rail under the
                  divider, editor-chrome rather than content. */}
              {/* The band is the way into the place; the rail underneath
                  is the way into the plan. Tapping a name asked for the
                  place and got nothing — the one card in the app that
                  names a place and would not open it.

                  The whole card is deliberately not the target. Its lower
                  half is a time stepper and three small buttons, and a
                  press swallowing those is how a reader nudging nine
                  o'clock ends up on a different screen. So the identity
                  band takes the tap and the controls keep theirs. */}
              <PressableScale
                style={s.identity}
                onPress={() => navigation.navigate('PlaceDetail', { slug: stop.place.slug })}
                accessibilityRole="button"
                accessibilityLabel={t(
                  `Open ${stop.place.name_en}`,
                  `Mở ${stop.place.name_en}`,
                  `${stop.place.name_en}を開く`,
                )}
              >
                <View style={[s.well, cat && { backgroundColor: `${cat.color}24` }]}>
                  <Ionicons
                    name={cat?.icon ?? 'location-outline'}
                    size={20}
                    color={cat?.color ?? colors.textTertiary}
                  />
                </View>
                <View style={s.headCol}>
                  <View style={s.nameRow}>
                    <Text style={s.name} numberOfLines={1}>{stop.place.name_en}</Text>
                    {/* By the name, where a decision reads it — not buried
                        in the fallback line where a model's sentence used
                        to replace it. `sun`, not `onPhoto.star`: the star
                        colour is confined by its own comment to photo
                        scrims, and `sun` is the same gold solved for the
                        page, dark enough on paper to be seen. */}
                    {stop.place.rating != null && (
                      <View style={s.rating}>
                        <Ionicons name="star" size={12} color={colors.sun} />
                        <Text style={s.ratingText}>{stop.place.rating}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.area} numberOfLines={1}>
                    {summaryLine([stop.place.neighborhood_en, fmtMinutes(stop.dwellMin, lang)])}
                  </Text>
                </View>
              </PressableScale>

              {/* A sentence if one was written, and the facts behind it if
                  not. Never nothing, and never a spinner: the plan is
                  complete before the words arrive — and since the options
                  screen started asking ahead, they normally arrived before
                  this screen did. Full width, because a sentence squeezed
                  into a column beside controls was two clipped words.

                  The rating is left out of the fallback here — `factLine`
                  would happily print it, but it sits beside the name now,
                  and a line that repeats the header one row down reads as
                  a screen stuttering.

                  Rendered even when empty: `s.why` reserves two lines, and
                  a card that skipped the element would still jump in the
                  one late-landing case left — the tap faster than the
                  model. */}
              <Text style={s.why} numberOfLines={2}>
                {live.why.get(stop.place.slug)
                  || factLine({
                    slug: stop.place.slug,
                    name: stop.place.name_en,
                    rating: null,
                    openingHours: stop.place.opening_hours,
                    arriveMin: stop.arriveMin,
                  }, now, t)}
              </Text>

              {/* Only when the reader made it so. A plan reading backwards
                  with nothing saying so is a plan that gets somebody to a
                  closed door. */}
              {wrong.includes(i) && (
                <Text style={s.warn}>
                  {t('Earlier than the stop above.', 'Sớm hơn điểm phía trên.', '前のスポットより早い時刻です。')}
                </Text>
              )}

              <View style={s.railDivider} />

              {/* The controls, on their own rail under the divider: nudge
                  the hour on the left, reorder and remove on the right.
                  Everything above the divider is the place; everything on
                  the rail is what you can do to it. */}
              <View style={s.rail}>
                <View style={s.timeBox}>
                  <PressableScale
                    haptic="selection"
                    onPress={() => setStops(nudge(current, i, -NUDGE_MIN))}
                    containerStyle={s.step}
                  >
                    <Ionicons name="remove" size={15} color={colors.textSecondary} />
                  </PressableScale>
                  <Text style={[s.time, stop.pinned && s.timePinned]}>{clockOf(stop.arriveMin)}</Text>
                  <PressableScale
                    haptic="selection"
                    onPress={() => setStops(nudge(current, i, NUDGE_MIN))}
                    containerStyle={s.step}
                  >
                    <Ionicons name="add" size={15} color={colors.textSecondary} />
                  </PressableScale>
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
            </Card>

            {legs[i] && (
              <View style={s.legRow}>
                <Ionicons
                  name={legs[i]!.mode === 'walk' ? 'walk-outline' : 'car-outline'}
                  size={12}
                  color={colors.textTertiary}
                />
                <Text style={s.legText}>
                  {fmtDistance(legs[i]!.km)} · ≈ {fmtMinutes(legs[i]!.minutes, lang)}
                </Text>
              </View>
            )}
          </View>
          );
        })}

        {current.length === 0 && (
          <Card style={s.card}><Text style={s.body}>
            {t('Nothing left in this plan.', 'Không còn điểm nào trong plan này.', 'このプランには何も残っていません。')}
          </Text></Card>
        )}

        <Text style={s.total}>
          {summaryLine([
            stopCount(current.length, t),
            current.length ? `${clockOf(from)}–${clockOf(to)}` : null,
            spend > 0 ? `~${money(spend)} / ${t('person', 'người', '人')}` : null,
          ])}
        </Text>

        {/* One button, the width of the screen. It is the only thing here
            that does anything. */}
        <GradientCta
          icon="checkmark"
          wide
          label={saving
            ? t('Saving…', 'Đang lưu…', '保存中…')
            : t('Save to Trips', 'Lưu vào Chuyến đi', '旅程に保存')}
          onPress={() => { if (!saving) void onSave(); }}
        />

        <Text style={s.note}>
          {session?.user?.id
            ? t(
              // The caption no longer has to apologise for the button
              // beside it, because there is no longer a button beside it —
              // Share and Invite say they are mocks when pressed.
              'Times and order stay editable after saving.',
              'Giờ giấc và thứ tự vẫn sửa được sau khi lưu.',
              '保存後も時刻と順番は編集できます。',
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
  body: { ...type.body, color: colors.textSecondary },

  crew: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: space.titleToContent },
  avatars: { flexDirection: 'row' },
  crewText: { ...CAPTION, color: colors.textSecondary, flex: 1 },
  crewHint: { color: colors.textTertiary, fontSize: 12.5 },

  eyebrow: {
    ...CAPTION, color: colors.textTertiary, fontWeight: font.semibold,
    letterSpacing: 0.6, marginBottom: 8,
  },

  // `Card` carries no padding of its own — see the note on the component.
  // Without this the stepper sat against the card's left edge and the
  // corner radius clipped it.
  card: { padding: space.cardPadding },
  rowWrong: { borderColor: colors.accentFill, borderWidth: 1 },

  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  /**
   * The one place a category hue touches a fill.
   *
   * The colour discipline everywhere else — the glyph carries the hue,
   * never a surface — still holds as a rule; this well is its measured
   * exception, from the reference design. The wash is the glyph's *own*
   * colour at 14% alpha, so it reads as the glyph's halo rather than as a
   * second colour, and at that alpha it sits behind the icon as ground in
   * both the cream and the near-black theme. A place with no category
   * keeps the neutral glass instead — a guess would colour it wrong.
   */
  well: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceGlass,
  },
  headCol: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { ...type.body, color: colors.text, fontWeight: font.semibold, flex: 1 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: {
    ...CAPTION, color: colors.textSecondary,
    fontWeight: font.semibold, fontVariant: ['tabular-nums'],
  },
  area: { ...CAPTION, color: colors.textTertiary },

  railDivider: {
    height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft, marginTop: 12,
  },
  rail: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10,
  },
  timeBox: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  step: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceGlass,
  },
  time: { ...CAPTION, color: colors.text, width: 46, textAlign: 'center', fontVariant: ['tabular-nums'] },
  /** A time the reader set, marked so they can see which ones the planner
   *  will no longer touch. */
  timePinned: { color: colors.accent, fontWeight: font.semibold },
  /** The model's sentence, or the facts standing in for it. A step down
   *  from the name and a step up from the area line, because it is the row's
   *  only claim about why this place rather than another. */
  // Full width under the row now, so it needs the air a new block needs
  // rather than the 3pt that separated it from the line above it inside a
  // column.
  // Two lines' worth of room whether or not two lines arrive.
  //
  // The rule above this line in the body — never a spinner, because a row
  // that shuffled its own height when the words landed would be the screen
  // admitting it was waiting — was written and then not enforced. The
  // fallback is one line of facts and a model's sentence is two, so every
  // card grew 18pt when the narration returned, up to four seconds in.
  // With two stops that is 36pt, and Save to Trips walked out from under
  // whichever finger was reaching for it.
  //
  // `minHeight` rather than a fixed height: the line is capped at two by
  // `numberOfLines`, so this reserves the maximum rather than imposing it,
  // and a language whose caption wraps differently is not clipped.
  why: {
    ...CAPTION, color: colors.textSecondary, lineHeight: 18, marginTop: 10, minHeight: 36,
  },

  tools: { flexDirection: 'row', gap: 2 },
  tool: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  toolOff: { opacity: 0.25 },

  warn: { ...CAPTION, color: colors.accent, marginTop: 8 },

  legRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 12, paddingVertical: 6 },
  legText: { ...CAPTION, color: colors.textTertiary },

  total: { ...CAPTION, color: colors.textSecondary, marginTop: 10, marginBottom: 16 },
  note: { ...CAPTION, color: colors.textTertiary, marginTop: 12 },
});
