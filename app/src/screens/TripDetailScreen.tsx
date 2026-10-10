// A saved trip, whole.
//
// The card in the list prints three stops and says how many it left out;
// this prints all of them, with the sentence a model wrote under each and
// the money split into what it was spent on. That division is the reason
// both screens exist — a card that showed everything would make this one a
// tap that bought nothing, which is what the trips list used to argue.
//
// ── read from the list, not fetched again ──
//
// The route carries an id and nothing else. `useMyTrips` has already loaded
// every trip with its stops and its places, and reading the row out of that
// keeps one copy of a trip in the app: a second fetch here would be a
// second answer that can disagree with the first, and the screen behind
// this one would still be showing the older of the two.
//
// The cost of that is a moment of "not found" if this screen is reached
// before the list has loaded — deep-linked, or restored from a cold start.
// That is drawn honestly rather than papered over with a spinner that would
// never end.
//
// ── delete lives here ──
//
// It used to be a trash glyph on the card. Once the card became a tap of
// its own, a destructive control inside it was competing for the same
// finger, and the two are a bad pair: the cost of missing is losing a trip.
// Here it is at the bottom of the thing it destroys, after the reader has
// seen what it is.

import React, { useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFlag } from '../lib/useFlag';
import {
  AmbientWarmth, Card, Empty, IconSubtitle, PressableScale, Screen, useTabBarClearance,
} from '../components/ui';
import StopRow from '../components/StopRow';
import { useAuth } from '../lib/auth';
import { fromISO } from '../lib/day';
import {
  answerInvite, deleteTrip, sendInvites, withdrawInvites,
  type TripStopRow,
} from '../lib/data';
import { useCrew } from '../lib/crew';
import { useMyTrips } from '../lib/mytrips';
import { useInvitations } from '../lib/invitations';
import { splitFriendships } from '../lib/friends';
import InviteSheet from '../components/InviteSheet';
import StopGallery from '../components/StopGallery';
import TripCrew from '../components/TripCrew';
import { cancelTripReminder } from '../lib/reminders';
import { clockOf, dateline, fmtMinutes, openLabel } from '../lib/format';
import {  } from '../lib/geo';
import { useI18n } from '../lib/i18n';
import { mapsRouteUrl, routeMode } from '../lib/maps';
import { stopCount, summaryLine } from '../lib/sketch';
import { legsOf } from '../lib/travel';
import { spendVnd, tripCover } from '../lib/trips';
import { colors, font, radius, space, type } from '../theme';
import type { Nav, RootRoute } from '../nav';

const money = (vnd: number) => (vnd >= 1_000_000
  ? `${Math.round(vnd / 100_000) / 10}M ₫`
  : `${Math.round(vnd / 1000)}k ₫`);

/** Categories whose spend is food rather than something you did. Same set
 *  the planner splits its donut on, so a saved trip and a fresh plan
 *  account for the same café the same way. */
const FOOD = new Set(['eats', 'cafes']);

export default function TripDetailScreen({ navigation, route }: {
  navigation: Nav;
  route: RootRoute<'TripDetail'>;
}) {
  const { t, lang } = useI18n();
  const { session, profile } = useAuth();
  const clearance = useTabBarClearance();
  const trips = useMyTrips();

  /**
   * Which page of the gallery is showing, and how wide a page is.
   *
   * Above the early return, because a hook cannot live below one. This
   * screen renders "not found" while the trips list is still loading —
   * deep-linked, or restored from a cold start — and a `useState`
   * declared under that branch would be skipped on the first render and
   * present on the second. React counts hooks, so the second render
   * throws rather than misbehaving quietly.
   *
   */
  const [shot, setShot] = useState(0);
  // The "Roughly" card is behind the place detail's price switch (#598),
  // with the options card's footer and the editor's total: the price has
  // no home yet, and a trip's budget is three of them added up. Read here,
  // with the other switch, because hooks come before the early returns.
  const showPrice = useFlag('place_price');

  // Who is coming. Above the early return with the two above, and for the
  // same reason: React counts hooks, and one declared under a branch that
  // only sometimes runs throws on the render where the branch flips.
  const { ships, people, mutual } = useCrew();
  const { invites, crewCounts } = useInvitations();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const tripId = route.params.id;
  const me = session?.user?.id ?? null;
  const mineInvites = useMemo(
    () => invites.data.filter((i) => i.trip_id === tripId),
    [invites.data, tripId],
  );

  const trip = trips.data.find((x) => x.id === tripId) ?? null;
  const owned = !!trip && !!me && trip.owner_id === me;

  // The headcount an invitee is allowed — batched by the invitations
  // provider back at the Trips list, so this screen opens already holding
  // its number instead of asking in front of the reader (that ask showed
  // the failure sentence while it waited, and the owner watched the line
  // flicker). Missing = still being asked, TripCrew stays quiet; null =
  // the batch failed, TripCrew draws the numberless sentence. The owner
  // never reads it — they count their own rows.
  const heads = crewCounts[tripId];

  if (!trip) {
    return (
      <Screen
        title={t('Trip', 'Chuyến đi', '旅程')}
        onBack={() => navigation.goBack()}
      >
        <Empty text={trips.loaded
          ? t('That trip is no longer here.', 'Chuyến đi đó không còn nữa.', 'その旅程はもうありません。')
          : t('Loading…', 'Đang tải…', '読み込み中…')}
        />
      </Screen>
    );
  }

  const stops = trip.trip_stops;
  const day = fromISO(trip.day);

  const first = stops[0];
  const last = stops[stops.length - 1];
  const window = first?.arrive_min != null && last?.arrive_min != null
    ? `${clockOf(first.arrive_min)}–${clockOf(last.arrive_min + (last.dwell_min ?? 0))}`
    : null;

  // Split here rather than stored: the prices live on the places, so a
  // total worked out now is the one the catalog can currently defend. What
  // is stored is the decision — which stops, in what order, at what time.
  let food = 0;
  let doing = 0;
  for (const st of stops) {
    const v = st.places?.price_vnd ?? 0;
    if ((st.places?.categories ?? []).some((c) => FOOD.has(c))) food += v;
    else doing += v;
  }
  const spend = spendVnd(stops.map((st: TripStopRow) => st.places));

  /**
   * The journeys between the stops, derived rather than read back.
   *
   * Nothing about a leg is stored — `trip_stops` keeps the decision (which
   * places, in what order, at what time) and the distance falls out of the
   * places' own coordinates, exactly as the money above is worked out from
   * their prices rather than frozen at save time.
   *
   * A stop whose place has since left the catalog stands in as a pair of
   * nulls, which is the input `legBetween` already refuses to guess from:
   * the row either side of a delisted place simply has no leg, rather than
   * a distance measured to somewhere nobody can name.
   *
   * `legsOf` keeps unmeasurable legs in place as null so index `i` is
   * always the journey *out of* stop `i` — hence `legs[i - 1]` at the row
   * that leg arrives at.
   */
  const legs = legsOf(stops.map((st) => st.places ?? { lat: null, lng: null }));

  /**
   * The whole day as one Google Maps route.
   *
   * A link rather than a map drawn here. It used to be a licence
   * constraint — Google Places content on what was then an Apple map —
   * and the map is Google's now, so it is a preference: opening Google's
   * own app hands the reader turn-by-turn and live traffic, which a
   * thumbnail never could, and costs no Directions call. `lib/maps`
   * carries the long version.
   */
  const mapRoute = mapsRouteUrl(
    stops.map((st) => st.places ?? {}),
    routeMode(legs),
  );

  // Null only when no stop can be placed — there is nowhere to send
  // anyone, so no row. A one-stop day is a route like any other now that
  // the route starts from the reader's own position (see `mapsRouteUrl`);
  // the "Open in Google Maps" relabel this row used to wear for that day
  // went with the refusal it explained.

  /**
   * Whether there is a gallery at all, and the credit its current page
   * owes.
   *
   * `tripCover` is asked only whether *any* stop has a usable picture —
   * the gallery itself pages over the stops in order, so the answer's
   * own photograph is not used. Reusing it rather than writing a second
   * `.some()` keeps one rule about what counts as usable: a photograph
   * the desk hid is excluded there and stays excluded here.
   */
  const cover = tripCover(stops);

  /** Send what was ticked and take back what was unticked, in that order:
   *  a press that both invites and withdraws should not leave the trip
   *  briefly emptier than the reader asked for. */
  const onSend = async (invite: string[], withdraw: string[]) => {
    if (!me || sending) return;
    setSending(true);
    try {
      await sendInvites(tripId, me, invite);
      await withdrawInvites(tripId, withdraw);
      setSheetOpen(false);
      invites.reload();
    } catch (e) {
      Alert.alert(
        t('Could not send', 'Không gửi được', '送信できません'),
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      setSending(false);
    }
  };

  const confirmDelete = () => Alert.alert(
    t('Delete this trip?', 'Xoá chuyến đi này?', 'この旅程を削除しますか？'),
    t(
      `"${trip.title}" will be gone for good.`,
      `"${trip.title}" sẽ mất hẳn.`,
      `「${trip.title}」は完全に削除されます。`,
    ),
    [
      { text: t('Cancel', 'Huỷ', 'キャンセル'), style: 'cancel' },
      {
        text: t('Delete', 'Xoá', '削除'),
        style: 'destructive',
        // Back first, then reload: the list is the screen that has to
        // notice, and leaving this one standing over a row that no longer
        // exists would put it through its own "no longer here" state on
        // the way out.
        onPress: () => {
          cancelTripReminder(trip.id);
          deleteTrip(trip.id)
            .then(() => { navigation.goBack(); trips.reload(); })
            .catch((e: Error) => Alert.alert(
              t('Could not delete', 'Không xoá được', '削除できませんでした'), e.message,
            ));
        },
      },
    ],
  );

  /** The guest's version of the red button. Deleting is the owner's act —
   *  a guest who pressed it reached a row RLS would not let them touch,
   *  got a silent zero, and watched the trip "come back" on the next
   *  refetch. What a guest actually does is leave: a late decline, which
   *  ends their view of the plan for good and tells the planner the
   *  truth — the crew row marks them "can't make it". */
  const confirmLeave = () => Alert.alert(
    t('Leave this trip?', 'Rời chuyến đi này?', 'この旅程から抜けますか？'),
    t(
      `"${trip.title}" will leave your list, and the planner will see you can't make it.`,
      `"${trip.title}" sẽ rời khỏi danh sách của bạn; người mời sẽ thấy bạn không đi được.`,
      `「${trip.title}」はリストから消え、招待した人には不参加と表示されます。`,
    ),
    [
      { text: t('Cancel', 'Huỷ', 'キャンセル'), style: 'cancel' },
      {
        text: t('Leave', 'Rời', '抜ける'),
        style: 'destructive',
        onPress: () => {
          answerInvite(trip.id, 'declined')
            .then(() => {
              // Leaving takes the reminder with it, as a delete does for
              // the planner. The sync would pull it on the next reload
              // anyway; doing it here means it is gone before that.
              cancelTripReminder(trip.id);
              navigation.goBack(); trips.reload(); invites.reload();
            })
            .catch((e: Error) => Alert.alert(
              t('Could not leave', 'Không rời được', '退出できませんでした'), e.message,
            ));
        },
      },
    ],
  );

  // The subtitle is date and hours — no company, and no city. Who is
  // going is the crew row's own line below; which city is what every
  // stop's district line already says, and the owner called the header
  // repeating it the same fact twice. A subtitle states only what
  // nothing below it states.
  return (
    <Screen
      title={trip.title}
      subtitle={(
        <IconSubtitle
          icon="calendar-outline"
          text={summaryLine([
            day ? dateline(lang, day) : trip.day,
            window,
          ])}
        />
      )}
      onBack={() => navigation.goBack()}
    >
      <AmbientWarmth />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.page, paddingBottom: clearance }}
        showsVerticalScrollIndicator={false}
      >
        {/* Who is coming, before what the day is — the answer to "is this
            still on" is the one thing a reader opens a saved trip for that
            the card behind them could not already tell them.

            Invite is absent on a solo evening, which is the wizard's own
            answer to who the day is for: a button offering to add people
            to a day whose whole premise is being alone is the app not
            having listened. */}
        <TripCrew
          mine={owned}
          invites={owned ? mineInvites : []}
          people={people}
          myAvatar={profile.avatar_url}
          hostAvatar={owned ? null : (people[trip.owner_id]?.avatar_url ?? null)}
          headCount={heads}
          canInvite={owned && trip.company !== 'solo'}
          onInvite={() => setSheetOpen(true)}
        />
        {/* The day, one place at a time.

            ── one page per stop, not one page per photograph ──

            `PlaceDetailScreen`'s carousel pages through a place's own
            pictures, because there the subject is one place. Here the
            subject is the sequence, so page `i` is stop `i` and stays
            stop `i` — including for a stop with no picture, which draws
            its emoji on the same grey `PlaceCard` uses. Dropping those
            pages would be tidier and would break the one thing that
            makes this more than decoration: that the index means
            something to the list underneath.

            A stop whose place left the catalog keeps its page too, with
            a pin on it. The list below already draws it as a gap; a
            carousel that quietly skipped it would put the reader's
            fourth stop under the third name.

            Nothing here when no stop has a picture at all — `tripCover`
            already answers that, and a row of grey panels with pins on
            them is a control that costs a swipe and returns nothing. */}
        {/* One card, not three.

            The gallery, the itinerary and the route out of it were three
            stacked surfaces with gaps between them, and on the dark
            ground three panels of the same value read as one striped
            texture rather than as three things.

            They are also not three things. The whole point of the focus
            marks is that the picture *points at* a name in the list, and
            putting the two in separate boxes with a gap between them was
            the layout contradicting the feature. And the route is what
            you do with these stops, not a fact standing beside them.

            So: picture on top, itinerary under it, the way out along the
            bottom — the same shape `PlaceCard` has and the same shape the
            Trips card took in #264. The padding lives on the inner view
            so the picture can run to the card's edges. */}
        <Card style={s.card}>
          {/* `StopGallery`, which was lifted out of this screen and then
              not used by it: the plan options card drew the shared one and
              this card kept its own copy, with the marks in a different
              corner. One carousel now, one page count (`PageCount`); the
              only thing this screen decides is the proportion, the
              detail's 16:10, because this picture has the card to itself. */}
          <StopGallery
            places={stops.map((st) => st.places)}
            aspectRatio={16 / 10}
            page={shot}
            onPage={setShot}
            testID="trip-gallery"
          />

          <View style={s.cardBody}>
            {stops.map((stop, i) => {
              const place = stop.places;
              // Whether the gallery is currently showing this one. False
              // for every row when there is no gallery, which is what
              // keeps a trip with no photographs looking exactly as it did.
              const here = !!cover && i === shot;
              // `StopRow` — the row the options card draws, so a stop reads
              // the same before and after the plan is saved. Pressable only
              // when there is a place to open: a row drawn as "no longer
              // listed" has no detail screen behind it, and a press that
              // goes nowhere is worse than no press at all. The leg out of
              // each stop is not decoration: the options card and the editor
              // both print it, and saving the plan was losing it — a reader
              // chose between "6.2 km · ≈ 20 min" and "50 m · ≈ 2 min",
              // saved the one they wanted, and found neither. Nothing is
              // stored to lose; `legsOf` measures it from coordinates the
              // query already carries.
              return (
                <StopRow
                  key={`${trip.id}-${i}`}
                  time={stop.arrive_min != null ? clockOf(stop.arrive_min) : null}
                  timeTestID={`trip-stop-time-${i}`}
                  here={here}
                  first={i === 0}
                  last={i === stops.length - 1}
                  name={place ? place.name_en : null}
                  // Drawn as a gap rather than dropped. The reader kept five
                  // stops; a list of four with no explanation is the app
                  // losing one in front of them.
                  gone={t('No longer listed', 'Không còn trong danh mục', '掲載終了')}
                  meta={place
                    ? summaryLine([place.neighborhood_en, stop.dwell_min ? fmtMinutes(stop.dwell_min, lang) : null])
                    : null}
                  // Only a model's sentence is stored — the fact line the
                  // editor falls back to is derived from opening hours and
                  // would be last August's by now. `why_lang` says which
                  // language it was written in, so a trip read after a
                  // language switch can say so instead of looking broken.
                  why={stop.why}
                  whyLang={stop.why_lang}
                  leg={legs[i]}
                  onPress={place ? () => navigation.navigate('PlaceDetail', { slug: place.slug }) : undefined}
                  pressLabel={place
                    ? openLabel(place.name_en, t)
                    : undefined}
                />
              );
            })}

            {/* The way out of the app, at the bottom of the thing it acts
                on. It had its own card — round icon well, two lines,
                chevron — which is the shape `PlaceDetail` gives a *fact*
                that opens something: an address, a phone number, standing
                beside each other. This is not that. It is a verb about the
                list directly above it, and a card gave a two-line action
                the same weight as a six-line itinerary.

                So it takes the shape this app already gives an action
                inside a card: the `View plan ›` row on a trip card in the
                Trips tab. Accent text, chevron, a rule above it, no
                chrome of its own. */}
            {mapRoute && (
              <>
                <View style={s.divider} />
                <PressableScale
                  onPress={() => { Linking.openURL(mapRoute.url).catch(() => {}); }}
                  style={s.route}
                  accessibilityRole="button"
                >
                  <Ionicons name="navigate-outline" size={16} color={colors.accent} />
                  <Text style={s.routeText}>
                    {t('Open the route', 'Mở lộ trình', 'ルートを開く')}
                  </Text>
                  <Text style={s.routeSub} numberOfLines={1}>
                    {/* What it will actually do, not what it is called.
                        Google opens on the day's collapsed mode, and a
                        reader who expected the other one should find that
                        out here rather than three screens into another app.

                        Never silent about a cap either: Google takes nine
                        stops before the last, and an eleventh would
                        otherwise vanish from the route with the link still
                        looking complete. */}
                    {summaryLine([
                      t('Google Maps', 'Google Maps', 'Google マップ'),
                      mapRoute.dropped > 0
                        ? t(
                          `first ${stops.length - mapRoute.dropped} only`,
                          `chỉ ${stops.length - mapRoute.dropped} điểm đầu`,
                          `最初の${stops.length - mapRoute.dropped}件のみ`,
                        )
                        : null,
                    ])}
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color={colors.accent} />
                </PressableScale>
              </>
            )}
          </View>
        </Card>

        {showPrice && (
        <Card style={[s.card, s.spend]}>
          <Text style={s.spendTitle}>{t('Roughly', 'Ước chừng', 'おおよそ')}</Text>
          <View style={s.spendRow}>
            <Text style={s.spendKey}>{t('Food and drink', 'Ăn uống', '飲食')}</Text>
            <Text style={s.spendVal}>{money(food)}</Text>
          </View>
          <View style={s.spendRow}>
            <Text style={s.spendKey}>{t('Everything else', 'Phần còn lại', 'その他')}</Text>
            <Text style={s.spendVal}>{money(doing)}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.spendRow}>
            <Text style={[s.spendKey, s.spendTotalKey]}>
              {summaryLine([stopCount(stops.length, t), t('per person', 'mỗi người', '1人あたり')])}
            </Text>
            <Text style={[s.spendVal, s.spendTotalVal]}>{`~${money(spend)}`}</Text>
          </View>
          {/* Transport is in the total and not in either line above it: the
              planner charges a ride per hop and it belongs to no stop. Said
              rather than left as a sum that does not add up. */}
          <Text style={s.spendNote}>
            {t(
              'Rides between stops are in the total.',
              'Tiền xe giữa các điểm đã tính trong tổng.',
              '移動費も合計に含まれています。',
            )}
          </Text>
        </Card>
        )}

        <PressableScale
          onPress={owned ? confirmDelete : confirmLeave}
          style={s.delete}
          accessibilityRole="button"
          testID={owned ? 'trip-delete' : 'trip-leave'}
        >
          <Ionicons name={owned ? 'trash-outline' : 'exit-outline'} size={15} color={colors.bad} />
          <Text style={s.deleteText}>
            {owned
              ? t('Delete this trip', 'Xoá chuyến đi này', 'この旅程を削除')
              : t('Leave this trip', 'Rời chuyến đi này', 'この旅程から抜ける')}
          </Text>
        </PressableScale>
      </ScrollView>

      <InviteSheet
        open={sheetOpen}
        company={trip.company}
        friendIds={me ? splitFriendships(ships.data, me).friends : []}
        people={people}
        mutual={mutual}
        invites={mineInvites}
        sending={sending}
        onClose={() => setSheetOpen(false)}
        onSend={onSend}
      />
    </Screen>
  );
}

const CAPTION = { fontSize: 13, fontWeight: font.regular } as const;

const s = StyleSheet.create({

  // No padding of its own: the gallery inside runs to the card's edges,
  // and `cardBody` pads everything under it. `overflow` is what clips the
  // picture to the corner radius — the same trick the Trips card uses.
  card: { marginBottom: space.cardGap, overflow: 'hidden' },
  cardBody: { padding: space.cardPadding },
  // Between the stops and the route row, and above the money: the rule a
  // section break keeps. It used to stand between stops too, where the
  // rail's line now runs.
  divider: {
    height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlassSoft,
    marginVertical: 12,
  },


  // The card chrome PlaceDetail gives its address and phone rows, because
  // this is the same kind of row: a fact you tap to leave the app with.
  // The type pairing inside is this screen's own — a stop's name over its
  // meta line — so the row belongs to both at once.
  // 16:10, `PlaceCard`'s ratio rather than the Trips card's 3:1 band. The
  // roles are reversed here: on the list the picture identifies a card
  // among cards, and here it is the thing being looked at.

  // The `View plan ›` row from the Trips tab, in the footer of the card
  // it acts on. `gap` between the glyph and its word, and the detail
  // pushed right by `flex` so the chevron keeps the edge.
  // A whole row that opens another app, and it was as tall as its caption
  // (≈18pt). 44 makes it the target it reads as.
  route: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  routeText: { ...CAPTION, color: colors.accent, fontWeight: font.semibold },
  routeSub: { ...CAPTION, color: colors.textTertiary, flex: 1, textAlign: 'right', marginRight: 2 },

  // Its own padding, because `s.card` gave up the shared one when the
  // itinerary card took a full-bleed picture. This card has no picture
  // and wants the padding back.
  spend: { gap: 10, padding: space.cardPadding },
  spendTitle: { ...CAPTION, color: colors.textTertiary, fontWeight: font.semibold, letterSpacing: 0.6, textTransform: 'uppercase' },
  spendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spendKey: { ...type.body, color: colors.textSecondary, flex: 1 },
  spendVal: { ...type.body, color: colors.text, fontVariant: ['tabular-nums'] },
  spendTotalKey: { color: colors.text, fontWeight: font.semibold },
  spendTotalVal: { fontWeight: font.semibold },
  spendNote: { ...CAPTION, color: colors.textTertiary },

  // Quiet, and last. A destructive action does not need to be loud to be
  // findable — it needs to be somewhere nobody reaches by accident.
  // Narrow, and only as wide as its own words.
  //
  // It was a full-width pill at the bottom of a scroll, which is the
  // shape `GradientCta` uses for the affirmative action on every other
  // screen — so the most destructive control in the app was wearing the
  // silhouette of the most inviting one, in the place a thumb rests. The
  // colour was never the problem; the width was. A destructive action
  // should not have the breadth of an offer.
  //
  // The confirm dialog is still what actually protects the trip, and it
  // has not changed. This only stops the button asking to be pressed.
  delete: {
    alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderGlassSoft,
    paddingVertical: 11, paddingHorizontal: 20, marginTop: 4, minHeight: 44,
  },
  deleteText: { ...CAPTION, color: colors.bad, fontWeight: font.semibold },
});
