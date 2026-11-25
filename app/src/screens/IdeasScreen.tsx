// Plan a trip — the questions, not the answer.
//
// Four of them, in the order they narrow: who the day is for, what sounds
// good, where and when, and whether to start from something you have
// already saved. Every one has a default or is optional except the first
// two, which is what `canPlan` says out loud.
//
// The chips are the app's own `Chip` and the app's own category taxonomy,
// so a plan cannot ask for something the catalog has no word for, and the
// glyph beside "Cà phê" here is the glyph beside "Cà phê" on Explore's
// filter row and on a place card's vibe dot. That is not tidiness — a
// wizard that invents its own vocabulary produces a plan the rest of the
// app cannot explain.
//
// The plan itself is not built here. The button hands the draft to
// Sketching, which builds it, and nothing about the draft is decided twice.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import StartSheet, { Start } from '../components/StartSheet';
import {
  AmbientWarmth,
  Screen,
  useTabBarClearance,
} from '../components/ui';
import { useDuckOnScroll } from '../components/tabBarDuck';
import IdeasHeaderArt from '../components/IdeasHeaderArt';
import { presentCategories } from '../lib/categories';
import { useCity, useMyPosition } from '../lib/city';
import { useCollections, usePlaces } from '../lib/catalog';
import { dateline } from '../lib/format';
import { addDays, clampDay, fromISO, toISO } from '../lib/day';
import { useI18n } from '../lib/i18n';
import { partGone, startMinFor, START_MIN } from '../lib/planner';
import { useMyLists, useSaveActions } from '../lib/save';
import { canPlan, EMPTY_DRAFT, startPoint, toggle, TripDraft } from '../lib/trip';
import { cityAround, standsIn } from '../lib/geo';
import type { Nav } from '../nav';
import { AskCity } from './ideas/parts';
import { Asks } from './ideas/Asks';
import { DayPicker } from './ideas/DayPicker';
import { PlanCta } from './ideas/PlanCta';
import { Seeds } from './ideas/Seeds';
import { useListSeed } from './ideas/useListSeed';
import { useSeedLists } from './ideas/useSeedLists';
import { WhenWhere } from './ideas/WhenWhere';
import { whereLabelOf } from './ideas/where';
import { s } from './ideas/styles';

export default function IdeasScreen({ navigation, route }: {
  navigation: Nav;
  /** Optional, since the tab mounts this screen with no params at all. */
  route?: { params?: { from?: string; at?: number } };
}) {
  const { t, lang } = useI18n();
  const { city } = useCity();
  const { data: places } = usePlaces();
  const mine = useMyLists();
  const { askToSignIn } = useSaveActions();
  const cols = useCollections();
  const tabClearance = useTabBarClearance();
  const duckScroll = useDuckOnScroll();
  // Its tab, pressed again here, scrolls back to the top — the last step
  // of the walk back that ExploreScreen's `tabPress` note describes.
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useScrollToTop(scrollRef);

  const [draft, setDraft] = useState<TripDraft>(EMPTY_DRAFT);

  // A pin does not survive a city switch unless it lies in the new city.
  //
  // The draft is this screen's and the city is the app's, and until 14
  // Oct 2026 nothing connected them: a pin set in Hanoi, then Explore's
  // switcher to Saigon, left the planner ready to plan Saigon cafés from
  // a Hanoi corner. A district is the old city's by construction and
  // goes with it. A pin that lies in the new city stays — which is every
  // pin the start sheet lands when it is the sheet that switched the
  // city (`StartSheet.land`), so that path loses nothing. Back to
  // near-you otherwise, the draft's own starting state.
  //
  // Keyed on the id, not the object: the catalog refetches the row and
  // a fresh object for the same city is not a switch.
  const cityId = city?.id;
  useEffect(() => {
    if (!city) return;
    setDraft((d) => {
      if (!d.district && !d.at) return d;
      if (d.at && cityAround([city], d.at.lat, d.at.lng)) return d;
      return { ...d, district: null, at: null, atName: null };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId]);
  const [picking, setPicking] = useState(false);
  /**
   * The chosen day, resolved and never in the past — and, when nobody has
   * chosen one, never a day whose outing has already happened.
   *
   * `EMPTY_DRAFT` carries '' rather than today, because it is a module
   * constant and today would be frozen at import — an app left open past
   * midnight would offer to plan yesterday. Resolving here also self-heals
   * that case for a draft chosen before midnight.
   *
   * The default is today only while today can still hold the outing. At
   * five in the afternoon, "Day" defaulted to today and produced a plan
   * starting at 09:00 — a morning that had been over for eight hours, with
   * its places picked against their 09:00 opening hours. Tomorrow is what
   * that reader meant, and the date box says so before they tap anything,
   * which is the part that makes this a default rather than a trick.
   *
   * Only the default moves. A reader who opens the picker and chooses today
   * at ten in the evening gets today, and `startMinFor` starts their plan
   * from ten rather than from six — an odd request, honestly answered,
   * instead of a silent correction.
   */
  const now = new Date();
  const dayAt = (at: Date) => clampDay(draft.date || (partGone(draft.when, toISO(at), at)
    ? addDays(toISO(at), 1)
    : toISO(at)));
  const day = dayAt(now);
  /** The hour this plan really starts, which is not the shape's hour when
   *  the reader has insisted on a day already under way. */
  const startMin = startMinFor(draft.when, day, now);
  const late = startMin > START_MIN[draft.when];
  const [sheet, setSheet] = useState(false);

  // The lists this plan can start from — see `useSeedLists`.
  const { own, community } = useSeedLists(mine.data, cols.data, places, city?.id);
  /** Whether the community's lists are open — all of them, or the ones
   *  past the first three. Not remembered between visits: the screen
   *  opens short, every time. */
  const [more, setMore] = useState(false);
  const seeds = own.length > 0 || community.length > 0;

  // Only categories this city actually has, the same rule Explore's filter
  // row follows: a chip must never lead to an empty answer.
  const cats = useMemo(() => presentCategories(places), [places]);

  const set = <K extends keyof TripDraft>(k: K, v: TripDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  // A collection sent here to start from — see `useListSeed`.
  const { asking, close, askActions, moved, cityName } = useListSeed({
    from: route?.params?.from,
    at: route?.params?.at ?? 0,
    mine: mine.data,
    cols: cols.data,
    places,
    setDraft,
    setMore,
  });

  /**
   * Where the reader is, for the default the label has always claimed.
   *
   * "Around Hanoi · near me" is the state where neither a district nor a
   * pin has been chosen — which is to say, the empty one. It read as a
   * promise and was not one: the draft carried no coordinate, `originOf`
   * therefore had no origin, and the first stop was chosen on merit from
   * anywhere in the city. The label said "near me" and the planner had
   * never been told where that was.
   *
   * Read here rather than written into the draft, and that is the whole
   * of why this is small. `draft.at` means *the point the reader chose*,
   * and the label below distinguishes it from this one; filling it
   * with a position nobody pointed at would make "A pin you dropped"
   * appear over a pin nobody dropped. The two facts stay separate and
   * meet once, below, in the coordinate handed to the next screen.
   *
   * Never prompts — `useMyPosition` reads the permission and does not ask.
   * Denied means null, and null means the day starts at the city's centre,
   * with the label saying "centre" rather than "near you".
   */
  const me = useMyPosition();

  // Plain "near you" until the city resolves, and only "near you" when the
  // reader stands in the city on screen — the reasoning is `whereLabelOf`'s.
  const here = !!me && !!city && standsIn(city, me.lat, me.lng);
  const whereLabel = whereLabelOf(draft, city, here, t);

  /**
   * The point the day starts from — pin, else district-suppresses, else
   * where they are if they are in this city, else its centre. The rule and
   * its reasoning live in `startPoint`.
   *
   * Frozen into the route params at the tap rather than re-read
   * downstream. Three screens after this one rebuild the plan from these
   * params, and a position that arrived between two of them would be two
   * different plans for one draft — the same hazard `startMin` is
   * carried to avoid.
   */
  const origin = startPoint(draft, me, city);

  // The weekday and the date, always — including for today. "Today" alone
  // was tried and is worse here: the row sits beside Day/Evening with
  // about 150pt to spare, so there is no room to print both, and the word
  // that has to go is the one that says nothing a calendar could not.
  // Somebody about to open a date picker wants to see which date they are
  // opening it on.
  const dayLabel = dateline(lang, fromISO(day) ?? new Date());

  const ready = canPlan(draft);

  return (
    <Screen
      title={t('Plan a trip', 'Lên kế hoạch', 'プランを立てる', '规划行程', '規劃行程')}
      /* The lede shares the fixed band with the title now, and the two
         cats share it with both — see `IdeasHeaderArt` for how the
         painting sits and when it steps aside.

         Three short lines where a borrowed sentence stood. Laozi's
         thousand miles gave a reason to begin; these name the three
         things the screen asks about, in the order it asks them —
         eats, views, company — and read as the answers before the
         reader has given any. Set in `quoteFace` like the Profile
         footer, unsigned because nobody said it first. Vietnamese
         keeps the folk cadence of three two-beat words rather than a
         translation; Japanese falls back to the system face, the
         known deal. */
      lede={(
        <Text style={s.lede}>
          {t(
            'Good food.\nGood views.\nGood company.',
            'Món ngon.\nCảnh đẹp.\nBạn hiền.',
            '美味しいもの。\nいい景色。\nいい仲間。',
            '好吃的。\n好看的。\n好朋友。', '好吃的。\n好看的。\n好朋友。',
          )}
        </Text>
      )}
      right={<IdeasHeaderArt />}
    >
      <AmbientWarmth />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: tabClearance }}
        showsVerticalScrollIndicator={false}
        onScroll={duckScroll}
        scrollEventThrottle={16}
      >
        {/* The lede that stood here moved up into the title band (see
            the `lede` prop above). Nothing explains the screen any more,
            and nothing needs to: the section headers open the sentences,
            the chips answer them, and the one button says what it does.
            Still generic on `when`, as before: a lede that rewrites
            itself while the reader taps the chips below is the screen
            fidgeting under their hand (the CTA note points here). */}

        <Asks
          draft={draft}
          cats={cats}
          onCompany={(c) => set('company', c)}
          onCategories={(c) => set('categories', c)}
        />

        <WhenWhere
          whereLabel={whereLabel}
          dayLabel={dayLabel}
          when={draft.when}
          onWhen={(w) => set('when', w)}
          onWhere={() => setSheet(true)}
          onDay={() => setPicking(true)}
          late={late}
          startMin={startMin}
        />

        {seeds && (
          <Seeds
            own={own}
            community={community}
            from={draft.from}
            onToggle={(slug) => set('from', toggle(draft.from, slug))}
            more={more}
            onMore={() => setMore(true)}
            city={city}
            moved={moved}
            cityName={cityName}
          />
        )}

        <PlanCta
          draft={draft}
          ready={ready}
          origin={origin}
          whereLabel={whereLabel}
          here={here}
          dayAt={dayAt}
          navigation={navigation}
        />
      </ScrollView>

      {picking && (
        <DayPicker day={day} onClose={() => setPicking(false)} onPick={(iso) => set('date', iso)} />
      )}


      {/* Which city, when a list sent here spans several and none is this
          one. Closing without choosing leaves the list unticked: a guess
          would be a plan of the wrong half. */}
      <AskCity visible={asking !== null} onClose={close} actions={askActions} />
      <StartSheet
        visible={sheet}
        places={places}
        value={{ district: draft.district, at: draft.at, atName: draft.atName }}
        onClose={() => setSheet(false)}
        onDone={(next: Start) => {
          setDraft((d) => ({ ...d, district: next.district, at: next.at, atName: next.atName ?? null }));
          setSheet(false);
        }}
        // The sheet's search needs an account. The sheet closes, the door
        // opens for that reason, and a sign-in brings the sheet back —
        // the same hand-off Explore makes for its filter sheet.
        onNeedSignIn={() => {
          setSheet(false);
          askToSignIn('start', () => setSheet(true));
        }}
      />
    </Screen>
  );
}
