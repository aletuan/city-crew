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
import {
  Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import ActionSheet, { type SheetAction } from '../components/ActionSheet';
import StartSheet, { Start } from '../components/StartSheet';
import {
  AmbientWarmth, Card, GradientCta, PressableScale, Screen, SelectTick, Tile, TileGrid,
  useTabBarClearance,
} from '../components/ui';
import { useDuckOnScroll } from '../components/tabBarDuck';
import IdeasHeaderArt from '../components/IdeasHeaderArt';
import { CATEGORIES, categoryLabel, presentCategories } from '../lib/categories';
import { cityShort } from '../lib/cityName';
import { type City, useCity, useMyPosition } from '../lib/city';
import { useSession } from '../lib/auth';
import { useCollections, useLikes, usePlaces } from '../lib/catalog';
import { type Collection, coverUriOf, membersOf, type Place } from '../lib/data';
import { rankByLikes } from '../lib/likes';
import { clockOf, dateline } from '../lib/format';
import { addDays, clampDay, fromISO, toISO } from '../lib/day';
import { useI18n } from '../lib/i18n';
import { partGone, startMinFor, START_MIN } from '../lib/planner';
import { useMyLists, useSaveActions } from '../lib/save';
import { canPlan, COMPANY, EMPTY_DRAFT, startPoint, toggle, TripDraft } from '../lib/trip';
import { cityAround } from '../lib/geo';
import type { Nav } from '../nav';
import { colors, font, quoteFace, radius, space, type } from '../theme';

/** The last instant of a calendar day, for a picker bound. `fromISO` gives
 *  local noon — right for a day, half a day short of a ceiling. */
const endOfDay = (iso: string): Date | undefined => {
  const d = fromISO(iso);
  if (!d) return undefined;
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * A question and the grid of answers under it.
 *
 * No count and no "pick one" beside the heading. They were there to say
 * which group swaps and which adds up, and they said it at the cost of a
 * second voice on every heading — four questions, each with an aside.
 * The screen is short on words on purpose, and the thing the asides
 * explained is cheap to discover: a second tap on `Going with…` swaps the
 * answer rather than refusing it, which is a forgiving way to learn a
 * rule and leaves nothing to undo.
 */
/** The tap that opens the community's lists. Explore's "See all" in
 *  weight and colour, a chevron down rather than an arrow right because
 *  what it opens is below, not elsewhere. */
function MoreRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} contentStyle={s.more} accessibilityRole="button" testID="seeds-more" hitSlop={6}>
      <Text style={s.moreText}>{label}</Text>
      <Ionicons name="chevron-down" size={16} color={colors.accent} />
    </PressableScale>
  );
}

/** A list, with only its members in this city — or all of them while no
 *  city is chosen. The count a row prints, and the test of whether the
 *  row appears at all. */
function inCity(c: Collection, places: Place[], cityId: string | null | undefined): { c: Collection; members: Place[] } {
  const all = membersOf(c, places);
  return { c, members: cityId ? all.filter((p) => p.city_id === cityId) : all };
}

/**
 * How many of the community's lists a reader with none of their own sees
 * before the tap. Three rows are about 200pt — one card that still leaves
 * the Plan button on the first screen of an iPhone 15 — and the three
 * most liked are the city's answer to "what is there"; the rest is a
 * longer list of the same kind, not a different offer.
 */
const COMMUNITY_FIRST = 3;

function Section({ title, cols, children }: {
  title: string;
  cols: number;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: space.titleToContent }}>
      <Text style={s.heading}>{title}</Text>
      <View style={s.grid}><TileGrid cols={cols}>{children}</TileGrid></View>
    </View>
  );
}

/** The date picker's locale for each app language — see its note. */
const PICKER_LOCALE: Record<'en' | 'vi' | 'ja', string> = { en: 'en-GB', vi: 'vi-VN', ja: 'ja-JP' };

export default function IdeasScreen({ navigation, route }: {
  navigation: Nav;
  /** Optional, since the tab mounts this screen with no params at all. */
  route?: { params?: { from?: string; at?: number } };
}) {
  const { t, lang } = useI18n();
  const { city, cities, setCity } = useCity();
  const { data: places } = usePlaces();
  const mine = useMyLists();
  const { askToSignIn } = useSaveActions();
  const cols = useCollections();
  // The ranking figure, which leaves out a curator's like of their own list.
  const { rankLikes } = useLikes();
  const uid = useSession().session?.user?.id;
  const tabClearance = useTabBarClearance();
  const duckScroll = useDuckOnScroll();
  // Its tab, pressed again here, scrolls back to the top — the last step
  // of the walk back that ExploreScreen's `tabPress` note describes.
  const scrollRef = useRef<ScrollView>(null);
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
  /** Today at 00:00 — the picker's floor. Not `fromISO(todayISO())`, which
   *  is noon; see the picker below. */
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayAt = (at: Date) => clampDay(draft.date || (partGone(draft.when, toISO(at), at)
    ? addDays(toISO(at), 1)
    : toISO(at)));
  const day = dayAt(now);
  /** The hour this plan really starts, which is not the shape's hour when
   *  the reader has insisted on a day already under way. */
  const startMin = startMinFor(draft.when, day, now);
  const late = startMin > START_MIN[draft.when];
  const [sheet, setSheet] = useState(false);

  /**
   * The lists this plan can start from: yours, and the community's, each
   * touching this city.
   *
   * A plan is for one city — the one chosen up top — and a list is not:
   * it is stamped with the city it was made in and holds whatever was
   * saved into it, Hanoi and Saigon alike (`fetchMyCollections`). This
   * section used to offer every list you own with its whole count, so a
   * reader planning Hanoi saw "8 places" on a list with three here,
   * ticked it, and met "some places did not fit" two screens later with
   * nothing pointing back at why.
   *
   * So the shelves' rule decides what appears — one place here is enough,
   * which is `touchesCity` with the members already narrowed to here —
   * and the count is the places here. The row keeps its two short lines;
   * what changed is that both are now true of this plan. A list with
   * nothing in this city cannot seed it and is not offered, rather than
   * listed, ticked and silently dropped. Not "3 of 8", and no city under
   * the count: the city is named once, in the line under the heading.
   *
   * The community's lists came in on 12 Oct 2026, and for the reader the
   * old version had nothing for: a guest, who owns no list, and an
   * account whose lists are all in another city. Both used to see no
   * section at all. They see the city's own lists now, ranked as
   * Explore's shelf ranks them (`rankByLikes`), the three most liked
   * first and the rest a tap away. A reader with lists of their own here
   * sees those, and the community's behind the same tap: their own are
   * what they came for, and this screen is short on purpose. Your own
   * published list is on both shelves under one slug and is shown once,
   * under Yours — the Collections tab's rule.
   *
   * With no city resolved yet nothing is narrowed, and the only question
   * left is whether the list holds anything — the shelves' answer too.
   */
  const own = useMemo(
    () => mine.data.map((c) => inCity(c, places, city?.id)).filter((x) => x.members.length > 0),
    [mine.data, places, city?.id],
  );
  const community = useMemo(
    () => rankByLikes(cols.data.filter((c) => !(uid && c.owner_id === uid)), rankLikes)
      .map((c) => inCity(c, places, city?.id))
      .filter((x) => x.members.length > 0),
    [cols.data, rankLikes, uid, places, city?.id],
  );
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

  /**
   * A collection sent here to start from — the detail screen's "Plan a
   * trip" (`IdeasHome.from`).
   *
   * Ticked on arrival, and the lists opened so the tick is in view. The
   * city is the question: the seeds only count places in the app's city
   * (`inCity`), so a list from elsewhere would arrive ticked and seed
   * nothing. Three cases, the start sheet's rule applied to a list. A
   * list with a place here is ticked and nothing moves. A list whose
   * places are all in one other catalog city switches the app there —
   * the reader just chose that list, and a plan of it is what they asked
   * for — and the well under the heading says so. A list across several
   * catalog cities with none here is asked about, one row per city with
   * its count, since choosing for the reader would be guessing which
   * half of their list they meant.
   *
   * Keyed on `at`, so the same list sent twice is applied twice and a
   * re-render is not; waits for the catalog, since a list read from the
   * launch cache may arrive before its places do.
   */
  const [asking, setAsking] = useState<{ slug: string; choices: { id: string; n: number }[] } | null>(null);
  const [moved, setMoved] = useState<City | null>(null);
  const applied = useRef<number | null>(null);
  const cityName = (c: City) => cityShort(c, t);
  const tick = (slug: string) => {
    setDraft((d) => (d.from.includes(slug) ? d : { ...d, from: [...d.from, slug] }));
    setMore(true);
  };
  const follow = (slug: string, to: City) => {
    setCity(to.id);
    setMoved(to);
    tick(slug);
  };
  const from = route?.params?.from;
  const at = route?.params?.at ?? 0;
  useEffect(() => {
    if (!from || applied.current === at) return;
    const c = [...mine.data, ...cols.data].find((x) => x.slug === from);
    if (!c || places.length === 0) return;
    applied.current = at;
    const all = membersOf(c, places);
    if (!city || all.some((p) => p.city_id === city.id)) { tick(from); return; }
    const count = new Map<string, number>();
    all.forEach((p) => {
      const id = p.city_id;
      if (id && cities.some((x) => x.id === id)) count.set(id, (count.get(id) ?? 0) + 1);
    });
    const choices = [...count].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n);
    if (choices.length === 0) return;
    if (choices.length === 1) {
      const to = cities.find((x) => x.id === choices[0].id);
      if (to) follow(from, to);
      return;
    }
    setAsking({ slug: from, choices });
  // `tick`, `follow` and `cityName` close over state that is listed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, at, mine.data, cols.data, places, city?.id, cities]);
  const askActions: SheetAction[] = asking
    ? asking.choices.flatMap(({ id, n }) => {
      const to = cities.find((x) => x.id === id);
      return to ? [{
        key: id,
        icon: 'location-outline' as const,
        title: cityName(to),
        desc: t(
          `${n} ${n === 1 ? 'place' : 'places'} from this collection will be included`,
          `${n} địa điểm của bộ sưu tập sẽ được đưa vào`,
          `このコレクションから${n}件が含まれます`,
        ),
        onPress: () => { setAsking(null); follow(asking.slug, to); },
      }] : [];
    })
    : [];

  // Plain "near you" until the city resolves: "Around  · near you" printed
  // the hole where its name goes.
  //
  // "Near you", not "near me". The app addresses the reader everywhere
  // else it speaks — "Ghim bạn đã thả", "Lựa chọn của bạn" — and this one
  // row answered in their voice instead, which reads as the app quoting
  // them rather than telling them something.
  //
  // Capitalised after the separator, because that is what every other
  // pair in this app does: "Thứ Bảy, 26 T9 · Ban ngày". The lower
  // case here was the exception, and it showed once `SketchingScreen`
  // split the pair onto two lines and the second one opened with a small
  // letter.
  //
  // The city's name alone, not "Around Melbourne". The row already shows
  // a pin, and the plan subtitles repeat this string on three screens;
  // "Around" was the one word in it that said nothing a reader did not
  // know, and the owner asked for it to go. Japanese drops 周辺 with it.
  const whereLabel = draft.district
    ?? (draft.at
      ? (draft.atName ?? t('A pin you dropped', 'Ghim bạn đã thả', '置いたピン'))
      : city
        ? t(`${city.short_en} · Near you`, `${city.short_vi} · Gần bạn`, `${city.short_ja ?? city.short_en} · 現在地`)
        : t('Near you', 'Gần bạn', '現在地'));

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
   * and the label two lines up distinguishes it from this one; filling it
   * with a position nobody pointed at would make "A pin you dropped"
   * appear over a pin nobody dropped. The two facts stay separate and
   * meet once, below, in the coordinate handed to the next screen.
   *
   * Never prompts — `useMyPosition` reads the permission and does not ask.
   * Denied means null means the old behaviour, which is the honest floor:
   * no origin rather than an invented one.
   */
  const me = useMyPosition();

  /**
   * The point the day starts from — pin, else district-suppresses, else
   * where they are. The rule and its reasoning live in `startPoint`.
   *
   * Frozen into the route params at the tap rather than re-read
   * downstream. Three screens after this one rebuild the plan from these
   * params, and a position that arrived between two of them would be two
   * different plans for one draft — the same hazard `startMin` is
   * carried to avoid.
   */
  const origin = startPoint(draft, me);

  // The weekday and the date, always — including for today. "Today" alone
  // was tried and is worse here: the row sits beside Day/Evening with
  // about 150pt to spare, so there is no room to print both, and the word
  // that has to go is the one that says nothing a calendar could not.
  // Somebody about to open a date picker wants to see which date they are
  // opening it on.
  const dayLabel = dateline(lang, fromISO(day) ?? new Date());

  const ready = canPlan(draft);

  /** One list as a row: cover, name, the places here, a tick. */
  const seedRow = ({ c, members }: { c: Collection; members: Place[] }, i: number) => {
    const cover = coverUriOf(c, members);
    const on = draft.from.includes(c.slug);
    return (
      <View key={c.slug}>
        {i > 0 ? <View style={s.divider} /> : null}
        <PressableScale
          onPress={() => set('from', toggle(draft.from, c.slug))}
          contentStyle={s.fromRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: on }}
        >
          {cover
            ? <Image source={{ uri: cover }} style={s.thumb} contentFit="cover" transition={200} />
            : <View style={[s.thumb, s.thumbEmpty]}>
                <Ionicons name="bookmark-outline" size={18} color={colors.accentFaint} />
              </View>}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.fromTitle} numberOfLines={1}>
              {t(c.title_en, c.title_vi, c.title_ja)}
            </Text>
            {/* The count alone. "Your collection" stood here
                once — but every row this section holds is
                yours, and a label identical on every row
                says nothing. The count stays because it is
                the one fact that picks seeds: eight places
                feed a plan, one barely seasons it. */}
            <Text style={s.fromMeta} numberOfLines={1}>
              {t(
                `${members.length} ${members.length === 1 ? 'place' : 'places'}`,
                `${members.length} địa điểm`,
                `${members.length}件`,
              )}
            </Text>
          </View>
          <SelectTick on={on} />
        </PressableScale>
      </View>
    );
  };

  return (
    <Screen
      title={t('Plan a trip', 'Lên kế hoạch', 'プランを立てる')}
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

        {/* The three headers below open a sentence and the chips finish
            it — "Going with… ✓ Friends". They used to be questions
            ("Who's coming?"), which read as a form to fill in; a copy
            edit here should keep them as openers the chip labels can
            complete, ellipsis and all. */}
        <Section title={t('Going with…', 'Bạn muốn đi cùng…', '一緒に行くのは…')} cols={4}>
          {COMPANY.map((c) => (
            <Tile
              key={c.key}
              label={t(c.en, c.vi, c.ja)}
              icon={c.icon as keyof typeof Ionicons.glyphMap}
              iconColor={c.color}
              active={draft.company === c.key}
              testID={`ideas-company-${c.key}`}
              onPress={() => set('company', draft.company === c.key ? null : c.key)}
            />
          ))}
        </Section>

        {/* No cap on this group and there must not be one: `planner.ts`
            sizes the outing from how many were named, so a limit here
            would quietly shorten somebody's day. Nothing says so on
            screen, because nothing needs to — an unlimited choice is the
            one that needs no rule explained. */}
        <Section title={t('In the mood for…', 'Hôm nay bạn thích…', '今日の気分は…')} cols={3}>
          {cats.map((c, i) => (
            <Tile
              key={c}
              testID={`ideas-cat-${i}`}
              label={categoryLabel(c, t)}
              icon={CATEGORIES[c]?.icon ?? 'ellipse-outline'}
              iconColor={CATEGORIES[c]?.color}
              active={draft.categories.includes(c)}
              onPress={() => set('categories', toggle(draft.categories, c))}
            />
          ))}
        </Section>

        <View style={{ marginBottom: space.titleToContent }}>
          <Text style={s.heading}>{t('Where and when…', 'Chỗ nào, lúc nào…', '場所と時間は…')}</Text>
          <Card style={s.whenCard}>
            <PressableScale onPress={() => setSheet(true)} contentStyle={s.whereRow} accessibilityRole="button">
              <Ionicons name="location-outline" size={19} color={colors.accent} />
              <Text style={s.whereText} numberOfLines={1}>{whereLabel}</Text>
              <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
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
                onPress={() => setPicking(true)}
                style={s.dayBox}
                contentStyle={s.dayHit}
                accessibilityRole="button"
              >
                <Ionicons name="calendar-outline" size={19} color={colors.accent} />
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
                  ['day', t('Day', 'Ban ngày', '昼')],
                  ['evening', t('Evening', 'Buổi tối', '夜')],
                ] as const).map(([key, label]) => {
                  const on = draft.when === key;
                  return (
                    <PressableScale
                      key={key}
                      onPress={() => set('when', key)}
                      haptic="selection"
                      scaleTo={0.96}
                      hitSlop={{ top: 3, bottom: 3 }}
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
                onPress={() => setPicking(true)}
                hitSlop={10}
                testID="ideas-day-chevron"
                accessible={false}
                importantForAccessibility="no-hide-descendants"
              >
                <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
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
              )}
            </Text>
          )}
        </View>

        {seeds && (
          <View style={{ marginBottom: space.titleToContent }}>
            <Text style={s.heading}>
              {t('Start from what you love', 'Bắt đầu từ thứ bạn thích', 'お気に入りから始める')}
            </Text>
            {/* Which lists these are, said once: the rows count places
                here, and this is the line that says what "here" is. The
                city's short name, as the row above the sections prints
                it, so the two never disagree. */}
            {city && (
              <Text style={s.fromHint}>
                {t(
                  `Collections with a place in ${city.short_en}`,
                  `Bộ sưu tập có địa điểm ở ${city.short_vi}`,
                  `${city.short_ja ?? city.short_en}に場所があるコレクション`,
                )}
              </Text>
            )}
            {/* The start sheet's ok well, for the same fact: a city the
                reader's own choice moved the app to. Only while the app
                is still on it — a switch made afterwards is a new fact. */}
            {moved && city?.id === moved.id && (
              <View style={s.movedWell} testID="ideas-moved">
                <Ionicons name="checkmark-circle" size={18} color={colors.okInk} />
                <Text style={s.movedText}>
                  {t(
                    `The plan will be made in ${cityName(moved)}.`,
                    `Kế hoạch sẽ lập ở ${cityName(moved)}.`,
                    `プランは${cityName(moved)}で作ります。`,
                  )}
                </Text>
              </View>
            )}
            {own.length > 0 && (
              <>
                {/* Labelled only once there are two cards to tell apart. */}
                {more && community.length > 0 && (
                  <Text style={s.groupLabel}>{t('Yours', 'Của bạn', '自分の')}</Text>
                )}
                <Card style={{ paddingVertical: 4 }}>{own.map(seedRow)}</Card>
              </>
            )}
            {community.length > 0 && (own.length > 0
              ? (more
                ? (
                  <>
                    <Text style={s.groupLabel}>{t('Community', 'Cộng đồng', 'みんなの')}</Text>
                    <Card style={{ paddingVertical: 4 }}>{community.map(seedRow)}</Card>
                  </>
                )
                : (
                  <MoreRow
                    onPress={() => setMore(true)}
                    label={t(
                      `More · ${community.length} community ${community.length === 1 ? 'collection' : 'collections'}`,
                      `Xem thêm · ${community.length} bộ sưu tập cộng đồng`,
                      `もっと見る · みんなのコレクション${community.length}件`,
                    )}
                  />
                ))
              : (
                <>
                  <Card style={{ paddingVertical: 4 }}>
                    {(more ? community : community.slice(0, COMMUNITY_FIRST)).map(seedRow)}
                  </Card>
                  {!more && community.length > COMMUNITY_FIRST && (
                    <MoreRow
                      onPress={() => setMore(true)}
                      label={t(
                        `${community.length - COMMUNITY_FIRST} more`,
                        `Xem thêm ${community.length - COMMUNITY_FIRST}`,
                        `さらに${community.length - COMMUNITY_FIRST}件`,
                      )}
                    />
                  )}
                </>
              ))}
          </View>
        )}

        <View style={s.cta}>
          {/* Dimmed rather than hidden, and the line under it says why.
              A button that vanishes leaves the reader hunting for what
              they missed; one that explains itself does not. */}
          <View style={ready ? undefined : s.ctaOff} pointerEvents={ready ? 'auto' : 'none'}>
            <GradientCta
              wide
              disabled={!ready}
              testID="ideas-sketch"
              // The paw, and the paw only. A sparkle sat here once and
              // went: it was decoration, not a second reading of the
              // label, and it has since become every app's "AI" glyph.
              // The paw is different in kind — it is the planner's own
              // mark, the orb that turns while it thinks and the start
              // mark on the rail after — so the button says *whose*
              // planning this is, which the deliberately generic label
              // does not. `GradientCta`'s own rule: a glyph earns its
              // place beside a label that is generic. Not the map (the
              // Places tab wears one 60pt below) and not the paper plane
              // from the hero (the invite sheet already means "send" by
              // it).
              icon="paw"
              // Generic, and it stays generic — see the lede's note.
              label={t('Plan a trip', 'Lên kế hoạch', 'プランを立てる')}
              // `whereLabel` rather than the raw draft: only this screen
              // knows which of the three the reader ended up with — a
              // district, a pin, or the position behind "near me" — and
              // the next one has no business re-deciding that.
              onPress={() => {
                // `pointerEvents` above stops a finger and nothing else —
                // VoiceOver's activate still lands here.
                if (!ready) return;
                // The clock of the tap, not of the last render. This is a
                // tab root and stays mounted: opened at ten and tapped at
                // half past eight, it sent an evening starting at 18:00.
                const tapped = new Date();
                const date = dayAt(tapped);
                navigation.navigate('Sketching', {
                  company: draft.company,
                  categories: draft.categories,
                  // `origin`, so the near-me case gets its words too. It
                  // used to fall to null here, and a plan that really did
                  // start where the reader was standing arrived with no
                  // answer to "starting from where".
                  where: draft.district ?? (origin ? whereLabel : null),
                  district: draft.district,
                  // The coordinate behind that label. `where` is words and
                  // has always been words; sending it without these is how
                  // a pin came out as a plan across town, with the header
                  // still claiming the pin had been read.
                  //
                  // `origin`, not `draft.at`: the default is the reader's
                  // own position, and it travels the same wire the pin
                  // does. See the note on `origin` for why a district
                  // suppresses it rather than losing to it.
                  atLat: origin?.lat,
                  atLng: origin?.lng,
                  date,
                  when: draft.when,
                  // Resolved once, here, and carried. See `PlanAsk.startMin`:
                  // the three screens after this one each rebuild the plan,
                  // and each reading the clock for itself is how one card
                  // opens as a different evening.
                  startMin: startMinFor(draft.when, date, tapped),
                  from: draft.from,
                });
              }}
            />
          </View>
          {/* The line under a dimmed button, back (17 Oct 2026, UX-06)
              and now naming only what is still missing.

              It went on 15 Oct: the two empty questions are on the
              screen, and the dimmed button already says the day is not
              whole. The review showed what that left out. The questions
              are on the screen above the fold, not beside the button —
              scrolled down to the button, neither is in view — and
              `aria-disabled` tells VoiceOver *that* the button is off,
              never *why*. A dimmed button that cannot say what it waits
              for is a lock without a keyhole.

              The old line was one sentence for every state, so with
              "Friends" already picked it still asked for who's going.
              This one drops whichever half is answered. A full sentence
              rather than "Still to pick: …" — the owner chose it over
              the terser list and over a question in the hero's voice.
              Polite live region, so TalkBack reads the change as a
              chip is tapped; VoiceOver reads it as the next element
              after the button. */}
          {!ready && (
            <Text style={s.ctaHint} accessibilityLiveRegion="polite" testID="ideas-sketch-missing">
              {draft.company === null && draft.categories.length === 0
                ? t(
                  "Pick who's going and one thing you fancy to make a plan.",
                  'Chọn người đi cùng và một thứ bạn thích để lên kế hoạch.',
                  '誰と行くかと、気になるものを1つ選ぶとプランを立てられます。',
                )
                : draft.company === null
                  ? t(
                    "Pick who's going to make a plan.",
                    'Chọn người đi cùng để lên kế hoạch.',
                    '誰と行くかを選ぶとプランを立てられます。',
                  )
                  : t(
                    'Pick one thing you fancy to make a plan.',
                    'Chọn một thứ bạn thích để lên kế hoạch.',
                    '気になるものを1つ選ぶとプランを立てられます。',
                  )}
            </Text>
          )}
        </View>
      </ScrollView>

      {/* The platform's own, so the gesture is the one the reader already
          knows. `display="inline"` is the iOS calendar rather than the
          wheel — this is a question about a day, and a month grid answers
          it in one glance. */}
      {picking && (
        <Modal transparent animationType="fade" onRequestClose={() => setPicking(false)}>
          {/* Named, so VoiceOver has a way out that is not "anywhere off
              the card" — the same backdrop the save and sign-in sheets
              give a label for the same reason. */}
          <Pressable
            style={s.pickScrim}
            onPress={() => setPicking(false)}
            accessibilityRole="button"
            accessibilityLabel={t('Close', 'Đóng', '閉じる')}
          />
          <View style={s.pickCard}>
            <DateTimePicker
              value={fromISO(day) ?? new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              // In the app's language, not the phone's. Left to the phone,
              // a Vietnamese screen opened "October 2026 / MON TUE…" under
              // a "Xong" button on a phone set to English (PLAN-07, 17 Oct
              // 2026). English is the British reading, the one `dateline`
              // already writes ("Tue, 20 Oct") and the one that starts the
              // week on Monday, as Vietnamese and the old grid did.
              //
              // iOS only: Android's dialog takes no locale and follows the
              // system. The prop only names how the grid is labelled — the
              // day still comes back as a Date and goes through `toISO`, so
              // which day was picked does not depend on it.
              locale={PICKER_LOCALE[lang]}
              // The past is refused rather than clamped after the fact:
              // there is no plan to sketch for last Tuesday, and a picker
              // that lets you choose one and then silently moves you is
              // worse than one that never offered.
              //
              // The bounds are instants, not days, which is why they are
              // built here rather than with `fromISO` — that returns local
              // *noon*, deliberately, so a calendar day survives every
              // timezone. Handed to a picker as a minimum it means
              // something else entirely: "today, from 12:00", and every
              // reader opening this before lunch found today greyed out on
              // the day they were most likely to want it.
              minimumDate={startOfToday}
              maximumDate={endOfDay(addDays(toISO(startOfToday), 365))}
              onChange={(e, picked) => {
                // Android fires once with 'set' or 'dismissed' and closes
                // itself; iOS fires on every scrub and stays open.
                if (Platform.OS !== 'ios') setPicking(false);
                if (e.type === 'dismissed' || !picked) return;
                set('date', clampDay(toISO(picked)));
              }}
            />
            {Platform.OS === 'ios' && (
              <GradientCta
                icon="checkmark"
                label={t('Done', 'Xong', '完了')}
                onPress={() => setPicking(false)}
                wide
              />
            )}
          </View>
        </Modal>
      )}

      {/* Which city, when a list sent here spans several and none is this
          one. Closing without choosing leaves the list unticked: a guess
          would be a plan of the wrong half. */}
      <ActionSheet
        visible={asking !== null}
        onClose={() => setAsking(null)}
        actions={askActions}
        header={(
          <View style={{ gap: 2 }}>
            <Text style={s.askTitle}>{t('Which city?', 'Thành phố nào?', 'どの都市にしますか？')}</Text>
            <Text style={s.askMeta}>
              {t(
                'This collection has places in more than one city. The plan is made in one.',
                'Bộ sưu tập này có địa điểm ở nhiều thành phố. Kế hoạch chỉ lập ở một nơi.',
                'このコレクションは複数の都市にスポットがあります。プランは一つの都市で作ります。',
              )}
            </Text>
          </View>
        )}
      />
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

const s = StyleSheet.create({
  // The quote face the Profile footer wears, sized for a lede, in the
  // title's own column — so no page padding of its own. The 24pt line,
  // the 6pt above and the 12pt below are what `IdeasHeaderArt.BAND`
  // counts on; change one, change both. The 12 is the room before the
  // first section heading, which sat 13pt under the lede without it.
  // A face means no fontWeight (theme's rule).
  lede: {
    color: colors.textTertiary, fontFamily: quoteFace, fontSize: 16, lineHeight: 24,
    marginTop: 6, marginBottom: 12,
  },
  heading: {
    color: colors.text, ...type.headline,
    paddingHorizontal: space.page, marginBottom: space.headingToContent,
  },

  // No heading above it, unlike every question below. A heading would make
  // it a fifth question; without one it reads as an alternative to the four,
  // which is what it is.

  grid: { paddingHorizontal: space.page },

  whenCard: { marginHorizontal: space.page, paddingVertical: 4 },
  whereRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 14 },
  whenRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 10 },
  whereText: { color: colors.text, fontSize: 16, fontWeight: font.medium, flex: 1 },
  // One track, two halves — the pill the app gives a chosen control, on a
  // recessed ground so the pair reads as a single switch rather than as
  // two buttons that happen to be adjacent.
  segment: {
    flexDirection: 'row', padding: 3,
    borderRadius: radius.pill, backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.borderGlassSoft,
  },
  // 38 drawn, inside the track's 3pt padding, and the slop takes each half
  // the 3pt above and below it: a 44pt target without a 52pt track. It
  // measured 29 from padding alone.
  segItem: {
    minHeight: 38, paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
  },
  segItemOn: { backgroundColor: colors.accentSoft },
  segText: { color: colors.textSecondary, fontSize: 14, fontWeight: font.medium },
  segTextOn: { color: colors.accent, fontWeight: font.semibold },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft, marginHorizontal: 14 },

  fromRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  thumb: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surfaceGlass },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  fromTitle: { color: colors.text, fontSize: 16, fontWeight: font.semibold },
  fromMeta: { color: colors.textTertiary, fontSize: 13 },
  // Under the heading, in the rows' own meta voice: it is about the rows.
  // On the heading's own margin, since it is the heading's second line;
  // pulled up into the heading's gap so the two read as one block.
  fromHint: {
    color: colors.textTertiary, fontSize: 13, paddingHorizontal: space.page,
    marginTop: -(space.headingToContent - 2), marginBottom: 10,
  },
  // The start sheet's well, on the heading's margin: `okSoft` on `okInk`,
  // the pair the theme keeps for state the reader made.
  movedWell: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: space.page,
    marginBottom: 12, paddingHorizontal: 14, paddingVertical: 11, borderRadius: radius.card,
    backgroundColor: colors.okSoft,
  },
  movedText: { flex: 1, color: colors.okInk, fontSize: 13, lineHeight: 19 },
  askTitle: { color: colors.text, ...type.cardTitle },
  askMeta: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  groupLabel: {
    color: colors.textTertiary, fontSize: 12, fontWeight: font.semibold,
    letterSpacing: 0.7, textTransform: 'uppercase', paddingHorizontal: space.page,
    marginTop: 12, marginBottom: 8,
  },
  more: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
    paddingVertical: 10, paddingHorizontal: space.page,
  },
  moreText: { color: colors.accent, fontSize: 14, fontWeight: font.medium },

  cta: { paddingHorizontal: space.page, marginTop: 4, gap: 10 },
  ctaOff: { opacity: 0.4 },
  ctaHint: { color: colors.textTertiary, fontSize: 13, lineHeight: 19, textAlign: 'center' },

  // Under the card, not inside it: the card is the control and this is a
  // consequence of it, the same relation `ctaHint` has to the button.
  //
  // `space.page`, like every other top-level element here. This screen has
  // no container padding — the scroll view runs edge to edge and the lede,
  // the headings, the card and the CTA each declare their own inset. A `4`
  // slipped in here instead, borrowed from a card's interior, and left the
  // line starting 18pt to the left of everything it belongs under.
  whenNote: {
    color: colors.textTertiary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    paddingHorizontal: space.page,
  },

  // The whole left of the row is the target, not the words alone: a date
  // you have to hit exactly is a worse row than one you can tap across.
  // The box takes the room; the row inside it lays the icon and date out.
  dayBox: { flex: 1 },
  dayHit: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 2 },

  pickScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,5,8,0.32)' },
  // Centred rather than a bottom sheet: the calendar is a square of dense
  // targets, and the middle of the screen is where a thumb reaches all of
  // it. The start sheet is bottom-anchored because it is a form.
  pickCard: {
    position: 'absolute', left: space.page, right: space.page,
    top: '18%',
    backgroundColor: colors.bgElevated,
    borderRadius: 22,
    padding: 14,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
});
