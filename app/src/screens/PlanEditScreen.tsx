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
import { Alert, ScrollView, View } from 'react-native';
import {
  AmbientWarmth, IconSubtitle, RoundIconButton, Screen, useTabBarClearance,
} from '../components/ui';
import { useEdgeSwipeBack, useListDrag } from '../components/useListDrag';
import { derivedTitle } from '../lib/assist';
import { DEFAULT_TZ } from '../lib/clock';
import { useSession } from '../lib/auth';
import { fromISO } from '../lib/day';
import { dateline } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { legsOfPlan, move, type Editable } from '../lib/itinerary';
import { summaryLine } from '../lib/sketch';
import type { Place } from '../lib/types';
import type { Nav, RootRoute } from '../nav';
import { space } from '../theme';
import { Facts, Gone, Hint, PlanFoot, StopRows } from './planEdit/parts';
import { s } from './planEdit/styles';
import { useNarration, usePickedPlan, useSavePlan } from './planEdit/usePlan';

export default function PlanEditScreen({ navigation, route }: {
  navigation: Nav;
  route: RootRoute<'PlanEdit'>;
}) {
  const { t, lang } = useI18n();
  const clearance = useTabBarClearance();
  const p = route.params;
  const { session } = useSession();

  // The plan the reader tapped — see `usePickedPlan`.
  const { day, picked, city } = usePickedPlan(p);

  const [stops, setStops] = useState<Editable<Place>[] | null>(null);
  /** Set the moment a save lands, so the way out it takes is not stopped. */
  const saved = useRef(false);

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
  // An emptied plan leaves without asking. There is nothing in it to
  // lose — the plan it was cut down from is still on the options screen
  // the way out leads to — and "Choose another option" answered by
  // "Discard your changes?" would be a door that argues (PLAN-02).
  const emptied = useRef(false);
  emptied.current = current.length === 0;
  useEffect(() => {
    if (!edited) return undefined;
    return navigation.addListener('beforeRemove', (e) => {
      if (saved.current || emptied.current) return;
      e.preventDefault();
      Alert.alert(
        t('Discard your changes?', 'Bỏ các thay đổi?', '変更を破棄しますか？', '放弃更改？', '放棄更改？'),
        t(
          'The times and order you changed have not been saved.',
          'Giờ giấc và thứ tự bạn vừa đổi chưa được lưu.',
          '変更した時刻と順番はまだ保存されていません。',
          '你修改的时间和顺序尚未保存。', '你修改的時間和順序尚未儲存。',
        ),
        [
          { text: t('Keep editing', 'Tiếp tục sửa', '編集を続ける', '继续编辑', '繼續編輯'), style: 'cancel' },
          {
            text: t('Discard', 'Bỏ', '破棄', '放弃', '放棄'),
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ],
      );
    });
  }, [edited, navigation, t]);

  // The words, read from the cache the options screen filled, with the
  // stale parts taken out — see `useNarration`.
  const live = useNarration(picked, current, p);

  const legs = useMemo(() => legsOfPlan(current), [current]);

  // ── the stop in the finger ──
  //
  // Landing is `move`, the same call the arrows made and VoiceOver's
  // actions still make, so a dragged stop keeps the rule the screen exists
  // for: a time set by hand is never recomputed. The pitch guess is a 2:1
  // picture on a 295pt card, the body under it and the leg row below —
  // only ever used for the first frame. One stop has no order to change,
  // and a card that lifts to go nowhere is a gesture that seems broken.
  const canArrange = current.length > 1;
  // A stop dragged at a slant is not a way back — see `useEdgeSwipeBack`.
  useEdgeSwipeBack(navigation, canArrange);
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
      '分享行程需要记录同行的人，这个功能还没有。按钮先放在这里，占好位置。', '分享行程需要記錄同行的人，這個功能還沒有。按鈕先放在這裡，佔好位置。',
    ),
  );

  const { saving, onSave } = useSavePlan({
    navigation, p, day, current, picked, live, title, onSaved: () => { saved.current = true; },
  });

  if (!picked) return <Gone onBack={() => navigation.goBack()} />;

  return (
    <Screen
      compactTitle
      title={title}
      subtitle={line ? <IconSubtitle icon="calendar-outline" text={line} /> : undefined}
      onBack={() => navigation.goBack()}
      backBare
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
          onPress={() => mock(t('Share', 'Chia sẻ', '共有', '分享', '分享'))}
          label={t('Share', 'Chia sẻ', '共有', '分享', '分享')}
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
        <Facts current={current} legs={legs} companyKey={p.company} />

        {/* What the controls on the cards do, said once above them rather
            than as a letter-spaced eyebrow. "Hold", not "drag": the hold is
            what tells a move apart from a tap and a scroll, and a reader
            told to drag drags at once and scrolls. */}
        {current.length > 0 && <Hint canArrange={canArrange} />}

        <StopRows
          current={current}
          legs={legs}
          live={live}
          tz={city?.tz ?? DEFAULT_TZ}
          canArrange={canArrange}
          drag={{ styleOf, onPitch, onLift, onRelease }}
          setStops={setStops}
          navigation={navigation}
        />

        <PlanFoot
          count={current.length}
          saving={saving}
          onSave={onSave}
          onBack={() => navigation.goBack()}
          guest={!session?.user?.id}
        />
      </ScrollView>
      </View>
    </Screen>
  );
}
