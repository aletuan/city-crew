// The plan the reader picked, before they commit to it.
//
// Everything here is a nudge to something the planner already decided, and
// the rule the screen exists to honour lives one file over in
// `lib/itinerary`: a time set by hand is never recomputed. Add a stop above
// dinner and dinner stays at eight. Without that, every edit quietly undoes
// the last one and nothing on screen admits it.
//
// Stops are moved by holding one and dragging it, the way a collection's
// places are: `useListDrag`, shared with that screen, which also records
// why it is built on the responder system and not on gesture-handler or
// reanimated. This file used to say the opposite — that dragging inside a
// `ScrollView` fought the scroll and needed a dependency the app did not
// carry — and moved stops with two arrows instead. The collection screen
// then proved the drag; the arrows live on as VoiceOver's "Move up" and
// "Move down" actions on each card, since VoiceOver cannot drag.
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
// screen, after Save, and the caption under Save says so instead of
// offering a button that would have to invent a trip to work.
//
// ── the shape of the page ──
//
// From the reference design, in order: the facts of the evening as chips
// under the title (when, how far, with whom); a line saying what the
// controls do; then the stops down the rail, each a card wearing the
// place's own photographs, with the journey between two cards printed
// under the card it leaves. What the reference has and this page does
// not: a stop count (the rail and the times say how many, and the options
// card dropped its count for the same reason); "Edit all times" and a
// per-stop Edit (nothing behind either); a kebab menu over the remove
// control (one tap on the rail beats two behind a menu); and the "⋮⋮"
// grip, since holding to lift is already the app's convention and the
// line above the stops says so. The thread down the rail is drawn solid
// where the reference dashes it: iOS draws a dashed border only when all
// four sides carry one, which on a 1pt-wide view is a 2pt double line.
//
// ── the rail, read against the other two screens (3 Oct 2026) ──
//
// The owner brought a second opinion on this page's timeline — five
// points — and asked for it to be read against the saved trip
// (`TripDetailScreen`) and the options card (`PlanOptionsScreen`), which
// draw the same evening. Three rails, and they did not agree: the options
// card leads with a time column and 8pt dots on a 2pt rail; the saved
// trip leads with a time column and no rail at all; this page led with a
// solid coral numeral and kept the time inside the card. What was taken
// and what was not, and why:
//
// - **The rail is the options card's.** First the numerals lost their
//   coral surface (the theme's rule: coral for state, and every stop is
//   a stop); then, the same day, the owner asked for the options card's
//   rail outright — the paw on the first stop, a dot on the rest, one
//   2pt line — and for the saved trip to draw it too. `components/rail`
//   is that rail, and says why the paw and why coral on every stop. The
//   numerals went with it: order is a thing the reader changes here, but
//   the rail and the clock already say what it is, and VoiceOver's "Move
//   up" names the stop, not a number. The mode disc that sat on the
//   thread went too — the leg is printed under the card it leaves, as the
//   other two screens print it, glyph and "km · ≈ min" and nothing else.
// - **The time stays in the card.** On the two read-only screens the hour
//   leads the row, and the opinion asked for the same here. Here the hour
//   is a control — the stepper — and a figure printed twice, once by the
//   node and once between − and +, invites the question which one is
//   real. The saved trip, which cannot edit it, leads with it.
// - **The leg is already on the connector**, as a disc on the thread with
//   the figure beside it, and the saved trip prints the same glyph and the
//   same "km · ≈ min". Making it a tap that opens directions was not
//   taken: a leg's directions need an origin, and the app decided
//   (`lib/maps`) to send none, so that the route always starts from where
//   the reader is standing.
// - **No grip**, for the reason already above: holding to lift is the
//   convention, and the line over the stops says so.
// - **The rest of the weight note was already so**: the thread is 1pt and
//   neutral, the travel glyph is neutral, the hour is semibold and coral
//   only once set by hand.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AmbientWarmth, Card, GradientCta, IconSubtitle, PressableScale, RoundIconButton, Screen,
  fireHaptic, successHaptic, useTabBarClearance,
} from '../components/ui';
import { RailColumn } from '../components/rail';
import StopHero from '../components/StopHero';
import { LIFT_AFTER_MS, useListDrag } from '../components/useListDrag';
import {
  cachedNarration, derivedTitle, factLine, freshen, narratableOf, prefetchNarration,
  type Narration,
} from '../lib/assist';
import { DEFAULT_TZ } from '../lib/clock';
import { useAuth } from '../lib/auth';
import { CATEGORIES, categoriesOf } from '../lib/categories';
import { usePlaces } from '../lib/catalog';
import { useCity } from '../lib/city';
import { clampDay, fromISO, todayISO } from '../lib/day';
import { saveTrip } from '../lib/data';
import { spendVnd } from '../lib/trips';
import { clockOf, dateline, fmtMinutes } from '../lib/format';
import { fmtDistance } from '../lib/geo';
import { routeMode } from '../lib/maps';
import { useI18n } from '../lib/i18n';
import { splitName } from '../lib/name';
import {
  legsOfPlan, move, NUDGE_MIN, nudge, outOfOrder, remove, windowOf, type Editable,
} from '../lib/itinerary';
import { planTrips } from '../lib/planner';
import { startMinOf } from '../lib/remind';
import { scheduleTripReminder } from '../lib/reminders';
import { membersOf } from '../lib/place';
import { useSave } from '../lib/save';
import { useNoteEvent, usePlanProfile } from '../lib/tasteProfile';
import { summaryLine } from '../lib/sketch';
import { useFlag } from '../lib/useFlag';
import { COMPANY, draftFrom, type TripDraft } from '../lib/trip';
import type { Place } from '../lib/types';
import type { Nav, RootRoute } from '../nav';
import { colors, font, radius, space, type } from '../theme';

/** One fact of the evening, worn as a chip under the title. Not a control:
 *  no role, no press — the glyph is the accent's because the reference
 *  colours it so, and because a grey glyph on a grey chip was the one
 *  thing on the page with no contrast of its own. */
function Fact({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={s.chip}>
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={15} color={colors.accent} />
      <Text style={s.chipText}>{text}</Text>
    </View>
  );
}

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
  const { mine, askToSignIn } = useSave();
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
      seed: p.seed, startMin: p.startMin, pinned, avoid: p.avoid, taste, budgetVnd, tz: city?.tz ?? DEFAULT_TZ,
    });
    return plans.find((pl) => pl.lens === p.lens) ?? plans[0] ?? null;
  }, [draft, places, city?.id, city?.tz, p.seed, p.startMin, p.lens, p.avoid, pinned, taste, budgetVnd]);

  const [stops, setStops] = useState<Editable<Place>[] | null>(null);
  const [saving, setSaving] = useState(false);
  /** Set the moment a save lands, so the way out it takes is not stopped. */
  const saved = useRef(false);

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

  // Edits live only here until Save: `stops` stays null until the first
  // one. Leaving with them used to drop them without a word — the header's
  // Back and iOS's swipe alike, since both go through `beforeRemove`.
  const edited = stops !== null;
  useEffect(() => {
    if (!edited) return undefined;
    return navigation.addListener('beforeRemove', (e) => {
      if (saved.current) return;
      e.preventDefault();
      Alert.alert(
        t('Discard your changes?', 'Bỏ các thay đổi?', '変更を破棄しますか？'),
        t(
          'The times and order you changed have not been saved.',
          'Giờ giấc và thứ tự bạn vừa đổi chưa được lưu.',
          '変更した時刻と順番はまだ保存されていません。',
        ),
        [
          { text: t('Keep editing', 'Tiếp tục sửa', '編集を続ける'), style: 'cancel' },
          {
            text: t('Discard', 'Bỏ', '破棄'),
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ],
      );
    });
  }, [edited, navigation, t]);

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
  // The same sum a saved trip is priced by, so the figure here is the one
  // TripDetail will show for it.
  const spend = spendVnd(current.map((s) => s.place));
  // Behind the place detail's price switch (#598), like the options card
  // and the saved trip: a per-person sum of prices the reader cannot see.
  const showPrice = useFlag('place_price');
  // The evening's facts, for the chips under the title. Distance is the
  // legs summed — the figure the options card prints in its footer — and
  // it wears the glyph of how the whole route is made: a walk only when
  // every measured leg is one, as the map's directions decide it. Company
  // comes from the table the wizard's tiles read, so "Friends" here is the
  // tile the reader tapped there.
  const km = legs.reduce((n, l) => n + (l?.km ?? 0), 0);
  const company = COMPANY.find((c) => c.key === p.company);

  // ── the stop in the finger ──
  //
  // Landing is `move`, the same call the arrows made and VoiceOver's
  // actions still make, so a dragged stop keeps the rule the screen exists
  // for: a time set by hand is never recomputed. The pitch guess is a 2:1
  // picture on a 295pt card, the body under it and the leg row below —
  // only ever used for the first frame. One stop has no order to change,
  // and a card that lifts to go nowhere is a gesture that seems broken.
  const canArrange = current.length > 1;
  const { lift, panHandlers, onLift, onRelease, onPitch, styleOf } = useListDrag({
    keys: current.map((st) => st.place.slug),
    onMove: (from, to) => setStops(move(current, from, to)),
    pitchGuess: 360,
  });

  // Date first, place after, company nowhere: the chips below carry who
  // is going, and every trip subtitle keeps this same order.
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
    // A guest's tap used to fall through this guard to nothing, with only
    // the caption under the button to say why — the same dead control the
    // bookmark and the heart were cured of. They raise the sign-in sheet
    // with the thing reached for named in its title; so does this.
    if (!session?.user?.id) { askToSignIn('trip'); return; }
    if (!city || !current.length) return;
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
      // The evening-before nudge and the day's own, planted while the day
      // and the first stop's hour are known. After the save and
      // fire-and-forget: a reminder is a courtesy, and the reader is not
      // kept waiting on the permission sheet's animation.
      scheduleTripReminder(
        { id: tripId, day, title, startMin: startMinOf(current.map((st) => ({ arrive_min: st.arriveMin }))) },
        t,
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
      saved.current = true;
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
      subtitle={line ? <IconSubtitle icon="calendar-outline" text={line} /> : undefined}
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
      {/* The drag's responder, around the whole list: it asks for the touch
          on every move and wants it only while a stop is up. Held still
          while one is, so the drag and the scroll never answer the same
          finger. */}
      <View style={s.dragArea} {...panHandlers}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.page, paddingBottom: clearance }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!lift}
      >
        {/* The evening in three facts, read before the stops are: when it
            runs, how far it goes, who is on it. Each is a fact and not a
            control — plain words to VoiceOver, no role. The spend joins
            them only behind the place detail's price switch (#598), and
            only when something costs anything.

            What is not here is the reader's own face. A row with their
            avatar and "Just you, for now" used to open the page, and
            under a plan already marked "friends" it argued with the
            answer the reader gave; the company chip states that answer
            instead, and the caption under Save says where inviting
            happens. */}
        <View style={s.chips}>
          {current.length > 0 && <Fact icon="time-outline" text={`${clockOf(from)}–${clockOf(to)}`} />}
          {km > 0 && (
            <Fact icon={routeMode(legs) === 'walking' ? 'walk-outline' : 'car-outline'} text={fmtDistance(km)} />
          )}
          {company && <Fact icon={company.icon} text={t(company.en, company.vi, company.ja)} />}
          {showPrice && spend > 0 && (
            <Fact icon="wallet-outline" text={`~${money(spend)} / ${t('person', 'người', '人')}`} />
          )}
        </View>

        {/* What the controls on the cards do, said once above them rather
            than as a letter-spaced eyebrow. "Hold", not "drag": the hold is
            what tells a move apart from a tap and a scroll, and a reader
            told to drag drags at once and scrolls. */}
        <View style={s.hint}>
          <Ionicons name="move-outline" size={15} color={colors.textTertiary} />
          <Text style={s.hintText}>
            {canArrange
              ? t('Hold a stop to move it. Nudge its time with − and +.', 'Giữ một điểm để kéo đổi chỗ. Chỉnh giờ bằng − và +.', 'スポットを長押しして動かす。時刻は − と + で調整。')
              : t('Nudge the time with − and +.', 'Chỉnh giờ bằng − và +.', '時刻は − と + で調整。')}
          </Text>
        </View>

        {current.map((stop, i) => {
          // The first category the place carries, worn as a glyph in a
          // soft well — the same hue this concept wears on Explore's
          // filter row and the wizard's chips, so a café here looks like
          // "café" everywhere else. A place nothing classifies gets the
          // neutral pin on the neutral ground, not a guess.
          const cat = CATEGORIES[categoriesOf(stop.place)[0]];
          const open = () => navigation.navigate('PlaceDetail', { slug: stop.place.slug });
          const hold = canArrange ? (pageY: number) => onLift(i, pageY) : undefined;
          // VoiceOver cannot drag: the arrows the rail used to carry, as
          // actions on the card. Only the ones that go somewhere.
          const actions = canArrange
            ? [
              ...(i > 0 ? [{ name: 'moveUp', label: t('Move up', 'Chuyển lên', '上へ移動') }] : []),
              ...(i < current.length - 1 ? [{ name: 'moveDown', label: t('Move down', 'Chuyển xuống', '下へ移動') }] : []),
            ]
            : undefined;
          return (
          // The row the drag lifts: the card and the leg out of it, so a
          // stop travels with its journey and the rows it passes step
          // aside by the pair's height, which is what `onPitch` reports.
          <Animated.View
            key={stop.place.slug}
            style={styleOf(i)}
            onLayout={(e) => onPitch(stop.place.slug, e.nativeEvent.layout.height)}
            testID={`drag-${stop.place.slug}`}
          >
            {/* The rail beside the card — `components/rail`, the one the
                options card and the saved trip draw. The column stretches
                to the row, so the line reaches the next mark across the
                card and the leg under it; the last stop ends the line,
                since a line running on past the evening's end points at
                nothing. */}
            <View style={s.stopRow}>
              <RailColumn first={i === 0} last={i === current.length - 1} />
              <View style={[s.column, i < current.length - 1 && s.columnGap]}>
            <Card style={[s.card, wrong.includes(i) && s.rowWrong]}>
              {/* The place's own photographs, full-bleed above the body
                  and tapped the way the band below is. The card's padding
                  moved down to `cardBody` for this: a picture inset by
                  16pt inside a 22pt-radius card is a picture in a frame. */}
              <StopHero place={stop.place} onPress={open} onHold={hold} onRelease={onRelease} testID="stop-hero" />
              <View style={s.cardBody}>
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
                onPress={open}
                onLongPress={hold ? (e) => hold(e.nativeEvent.pageY) : undefined}
                delayLongPress={LIFT_AFTER_MS}
                onPressOut={onRelease}
                accessibilityHint={canArrange
                  ? t('Hold and drag to change the order.', 'Giữ rồi kéo để đổi thứ tự.', '長押ししてドラッグすると並び順を変えられます。')
                  : undefined}
                accessibilityActions={actions}
                onAccessibilityAction={(e) => setStops(
                  move(current, i, e.nativeEvent.actionName === 'moveUp' ? i - 1 : i + 1),
                )}
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
                    {/* The brand alone, as `PlaceCard` prints it: the ward
                        after the dash opens the line below. The spoken
                        labels keep the whole name — VoiceOver reads one
                        card at a time and has no line below to lean on. */}
                    <Text style={s.name} numberOfLines={1}>{splitName(stop.place.name_en).title}</Text>
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
                  {/* District, kind, and how long — the kind by the name
                      the category wears everywhere else, so the glyph in
                      the well has its word beside it. */}
                  <Text style={s.area} numberOfLines={1}>
                    {summaryLine([
                      stop.place.neighborhood_en,
                      cat ? t(cat.en, cat.vi, cat.ja) : null,
                      fmtMinutes(stop.dwellMin, lang),
                    ])}
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
                  }, now, city?.tz ?? DEFAULT_TZ, t)}
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
                  the hour on the left, remove on the right. Everything
                  above the divider is the place; everything on the rail is
                  what you can do to it. */}
              <View style={s.rail}>
                <View style={s.timeBox}>
                  {/* Named, because the stepper used to be the only
                      labelled thing on the rail that was not labelled: a
                      minus, a clock, a plus, and nothing to say the clock
                      was the arrival. */}
                  <Text style={s.timeLabel}>{t('Time', 'Giờ', '時刻')}</Text>
                  <PressableScale
                    haptic="selection"
                    onPress={() => setStops(nudge(current, i, -NUDGE_MIN))}
                    containerStyle={s.step}
                    accessibilityRole="button"
                    accessibilityLabel={t(`Arrive ${NUDGE_MIN} min earlier at ${stop.place.name_en}`, `Đến ${stop.place.name_en} sớm ${NUDGE_MIN} phút`, `${stop.place.name_en}に${NUDGE_MIN}分早く着く`)}
                  >
                    <Ionicons name="remove" size={17} color={colors.text} />
                  </PressableScale>
                  <Text style={[s.time, stop.pinned && s.timePinned]}>{clockOf(stop.arriveMin)}</Text>
                  <PressableScale
                    haptic="selection"
                    onPress={() => setStops(nudge(current, i, NUDGE_MIN))}
                    containerStyle={s.step}
                    accessibilityRole="button"
                    accessibilityLabel={t(`Arrive ${NUDGE_MIN} min later at ${stop.place.name_en}`, `Đến ${stop.place.name_en} muộn ${NUDGE_MIN} phút`, `${stop.place.name_en}に${NUDGE_MIN}分遅く着く`)}
                  >
                    <Ionicons name="add" size={17} color={colors.text} />
                  </PressableScale>
                </View>

                {/* Remove, alone on the right: the two arrows that stood
                    beside it are the hold (and VoiceOver's actions) now. */}
                <View style={s.tools}>
                  <PressableScale
                    onPress={() => { fireHaptic('light'); setStops(remove(current, i)); }}
                    containerStyle={s.tool}
                    accessibilityRole="button"
                    accessibilityLabel={t(`Remove ${stop.place.name_en}`, `Bỏ ${stop.place.name_en}`, `${stop.place.name_en}を外す`)}
                  >
                    <Ionicons name="close" size={16} color={colors.textTertiary} />
                  </PressableScale>
                </View>
              </View>
              </View>
            </Card>

            {/* How you get to the next stop, under the card it leaves and
                inside the rail's row, so the line runs past it. The same
                glyph and the same "km · ≈ min" the options card and the
                saved trip print, so one journey keeps one appearance; the
                reference draws it as a bordered pill with a chevron, and a
                chevron promises a screen that does not exist. */}
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
            </View>
          </Animated.View>
          );
        })}

        {current.length === 0 && (
          <Card style={s.card}><Text style={s.body}>
            {t('Nothing left in this plan.', 'Không còn điểm nào trong plan này.', 'このプランには何も残っていません。')}
          </Text></Card>
        )}

        {/* One button, the width of the screen. It is the only thing here
            that does anything. */}
        {/* With the summary line gone, the air it carried above Save is
            the wrapper's. */}
        <View style={s.save} />
        <GradientCta
          icon="checkmark"
          wide
          label={saving
            ? t('Saving…', 'Đang lưu…', '保存中…')
            : t('Save to Trips', 'Lưu vào Chuyến đi', '旅程に保存')}
          onPress={() => { if (!saving) void onSave(); }}
          testID="plan-save"
        />

        <Text style={s.note}>
          {session?.user?.id
            ? t(
              // What saving does, and only that. This used to promise the
              // times and order "stay editable after saving", but a saved
              // trip opens in TripDetail, which is view-only — a promise
              // nothing in the app keeps.
              'Saved trips go to Trips, where you can invite your crew.',
              'Chuyến đã lưu nằm trong Chuyến đi, nơi bạn có thể mời crew.',
              '保存した旅程は「旅程」に入り、そこからクルーを招待できます。',
            )
            : t(
              'Sign in to save this trip.',
              'Đăng nhập để lưu chuyến đi này.',
              'この旅程を保存するにはサインインしてください。',
            )}
        </Text>
      </ScrollView>
      </View>
    </Screen>
  );
}

const CAPTION = { fontSize: 13, fontWeight: font.regular } as const;

const s = StyleSheet.create({
  body: { ...type.body, color: colors.textSecondary },

  // Wrapping, so a fourth chip (the spend, behind its switch) or a long
  // Vietnamese company label takes a second line rather than running off
  // the page. 8pt between chips both ways.
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  // The filter chip's shape (`Chip` in ui.tsx) at the filter chip's
  // measurements, filled rather than outlined because these are read, not
  // pressed — the outline is what the filter row uses to say "tap me".
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: colors.surfaceGlass, borderRadius: radius.pill,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  chipText: { color: colors.text, fontSize: 14, fontWeight: font.medium, fontVariant: ['tabular-nums'] },

  hint: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  // The responder that carries a lifted stop: the list's whole height.
  dragArea: { flex: 1 },
  hintText: { ...CAPTION, color: colors.textSecondary },

  // The rail column is `components/rail`'s 16pt; the card takes the rest.
  // 12pt between them, the same gap the identity band keeps between its
  // well and the name, so the page's two left edges line up with the
  // card's. `stretch`, so the rail's line spans the card and the leg.
  stopRow: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  // The card and the leg out of it, in one column beside the rail. 12pt
  // under a stop that has one after it: the leg row adds its own above
  // the figure, so a stop with a measured leg is card, 12, figure, 12,
  // next card — close to the 44pt the old leg row held — and a stop whose
  // leg could not be measured still clears the next card.
  column: { flex: 1 },
  columnGap: { paddingBottom: 12 },

  // `Card` carries no padding of its own — see the note on the component.
  // It used to be on the card; the hero moved it to the body so the
  // picture can meet the card's edges.
  card: { alignSelf: 'stretch' },
  cardBody: { padding: space.cardPadding },
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
  headCol: { flex: 1, gap: space.nameToMeta },
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
  timeBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeLabel: { ...CAPTION, color: colors.textSecondary, marginRight: 8 },
  // 34pt, up from 26: the reference draws the stepper as the card's main
  // control, and 26 was under the 30pt a fingertip needs even before the
  // three tools on the right were counted. 44 as drawn would push those
  // tools off a 295pt card in Vietnamese.
  step: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceGlass,
  },
  time: {
    color: colors.text, fontSize: 16, fontWeight: font.semibold,
    width: 52, textAlign: 'center', fontVariant: ['tabular-nums'],
  },
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
  tool: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

  warn: { ...CAPTION, color: colors.accent, marginTop: 8 },

  // The same row the options card and the saved trip draw: a 12pt glyph,
  // 5pt, the figure, in the tertiary ink. In the card's column, so the
  // figure starts where the card does.
  legRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 12 },
  legText: { ...CAPTION, color: colors.textTertiary },

  save: { height: 18 },
  note: { ...CAPTION, color: colors.textTertiary, marginTop: 12 },
});
