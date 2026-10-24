// Where the day should start.
//
// Three ways to answer, and the map is the first of them now rather than
// the last. It used to sit under a "Near me" row and a row of chips, on
// the argument that a map is the most precise answer and the least often
// wanted. The reader disagreed, with a mockup: the map is what tells you
// where you are, and everything else on the sheet is a way of moving it.
//
// So: the map, the address field that moves it, the areas that reorder
// around it, and the button. "Near me" was a row of its own, then only
// the locate button on the map, and is a row again — see `meRow` for why
// the map's button was not enough. Either way it keeps the answer as
// *near me* rather than as the coordinates you happened to be standing
// on, so a plan made now and walked to later starts from where you are
// then.
//
// It shows no places, by choice rather than by licence: see the note at
// the top of MiniMap.
//
// ── on the search field ──
//
// It asks Google Places, through `fetch-place`, the Edge Function that
// already holds the key for Add a place. It has been two other things.
// First `Location.geocodeAsync`, which on iOS is CLGeocoder and resolves
// addresses only: a street and a district in, a point out, and no opinion
// about "Ủy ban nhân dân xã Quý Lộc", which is a name. Then OpenStreetMap,
// which knew names but not well — asked for that same commune office it
// returned four confident answers from two other provinces — and was
// there only because the map was Apple's and Google Places content may
// not be shown on a non-Apple map (Places ToS §5.3). The map is Google's
// now, so the search can be too.
//
// So there is a list of candidates to choose from, which is what people
// expect from a search box and what the geocoder could never give. The
// reader picks one and the map moves to it.
//
// ── the five rules (14 Oct 2026) ──
//
// Three fixes in a day each closed one hole and opened the next — a pin
// in Saigon kept a tick on Thanh Xuân; the "switched" well outlived the
// pin; cancelling the sheet put the start back and left the city moved.
// All of them were the sheet keeping three kinds of state under three
// different rules. The owner asked for the rules instead of a fourth fix:
//
// 1. The sheet is a transaction. City and mode are snapshotted on open;
//    "Use this location" commits everything, closing without it puts
//    everything back, the city included. While it is open the app may be
//    switched for real, so the chips and the map show the pin's city.
// 2. Exactly one answer is current and it is always visible: the tick on
//    the row, a lit chip, or the pin's name in the field — on reopening
//    too, which is why the field is seeded from `value`.
// 3. Refused means nothing is chosen. A pin, or the reader's own position,
//    in no catalog city drops the tick, dims the button and says the
//    ways out in the warn well. There is no quiet road back to the city
//    the sheet was open on.
// 4. The wells describe the current answer, not the last action: cleared
//    on open and by any other answer, and worded for what the plan will
//    do rather than what the app just did.
// 5. Nothing found is not a refusal. The reader chose nothing new, so the
//    old answer stands and the grey line says so.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, AppState, Keyboard, Linking, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import * as Location from 'expo-location';
import Ionicons from '@expo/vector-icons/Ionicons';
import MiniMap from './MiniMap';
import { Chip, GradientCta, PressableScale, SelectTick } from './ui';
import { type City, useCity, useMyPosition } from '../lib/city';
import { cityAround } from '../lib/geo';
import { findSpots, nameOf, SearchLimitError, SignedOutError, type Spot } from '../lib/findplace';
import { searchLimitWords } from '../lib/quota';
import { useSession } from '../lib/auth';
import { ctaMode } from '../lib/spots';
import { useI18n } from '../lib/i18n';
import { areaCentre, areasNear, nearestAreaKm } from '../lib/trip';
import type { Place } from '../lib/types';
import { colors, font, radius, space, type } from '../theme';

export type Start = {
  district: string | null;
  at: { lat: number; lng: number } | null;
  /** The words for the pin, when it has any: the name of the result the
   *  reader took, else what the geocoder called the point they tapped.
   *  Null for a nameless pin and for no pin at all. */
  atName: string | null;
};

export default function StartSheet({ visible, places, value, onClose, onDone, onNeedSignIn }: {
  visible: boolean;
  /** The catalog, because the areas are ordered from it — and ordered in
   *  here rather than by the caller, which was the first version and did
   *  not work: the sheet keeps its own draft until Done, so a caller
   *  ordering by *its* draft left the chips still while the pin moved. */
  places: Place[];
  value: Start;
  onClose: () => void;
  onDone: (next: Start) => void;
  /** The search needs an account (`fetch-place` answers 401 without
   *  one). Raised instead of searching when there is none, and when the
   *  function says there is none — a session can lapse between render
   *  and tap. The screen owns the door, as Explore does for its filter
   *  sheet: a sheet over a sheet is the caller's to arrange. */
  onNeedSignIn: () => void;
}) {
  const { t, lang } = useI18n();
  const { city, cities, mode, setCity, followMyLocation } = useCity();
  const signedIn = !!useSession().session;
  /** A pin that fell in no catalog city, by the name it came with; `me`
   *  when the pin is the reader, for whom "use your current location" is
   *  not a way out. */
  const [elsewhere, setElsewhere] = useState<{ name: string; me: boolean } | null>(null);
  /** The city the last pin moved the app to, when it did. */
  const [moved, setMoved] = useState<City | null>(null);
  const cityName = (c: City) => (lang === 'vi' ? c.name_vi : lang === 'ja' ? (c.name_ja ?? c.name_en) : c.name_en);

  /**
   * Where a pin may land.
   *
   * The search is biased, not restricted, so a pin can come back from
   * anywhere — and until 14 Oct 2026 it did: a reader in Hanoi took
   * "Thành phố Hồ Chí Minh" as her pin and was planned a Hanoi evening
   * starting 1,100 km away. Three cases now. A pin in the city the app
   * is showing lands. A pin in another catalog city lands and moves the
   * app there (`setCity`): the reader just named that city, and a plan
   * of it is what she asked for. A pin in no catalog city does not land
   * at all — the sheet says there is nothing around it, and nothing is
   * chosen (rule 3): the draft goes back to near-you *and* `elsewhere`
   * takes the tick and the button away, so the one tap that used to make
   * a Hanoi plan out of "Cần Thơ" makes nothing. The owner's rule: never
   * plan the city the sheet happened to be open on, because the reader
   * would not know what they had done wrong.
   */
  const land = (at: { lat: number; lng: number }, atName: string | null): boolean => {
    const home = cityAround(cities, at.lat, at.lng);
    if (!home) {
      setElsewhere({ name: atName ?? t('that pin', 'ghim này', 'そのピン', '那个图钉', '那個圖釘'), me: false });
      setMoved(null);
      setDraft({ district: null, at: null, atName: null });
      return false;
    }
    setElsewhere(null);
    if (city && home.id !== city.id) { setCity(home.id); setMoved(home); } else setMoved(null);
    setDraft({ district: null, at, atName });
    return true;
  };
  const [draft, setDraft] = useState<Start>(value);
  const [where, setWhere] = useState<string>('');
  const [query, setQuery] = useState('');
  const [finding, setFinding] = useState(false);
  const [missed, setMissed] = useState(false);
  /** What the last search turned up. null before there has been one. */
  const [hits, setHits] = useState<Spot[] | null>(null);
  /** The query as of the last search or the last result taken — see
   *  `ctaMode`, which compares it against what is in the field now. */
  const [settled, setSettled] = useState('');
  /**
   * Bumped by the locate button once the permission dialog has closed.
   *
   * Granting the permission changes nothing on its own: `useMyPosition`
   * has already run and found no permission, and the map's own blue dot
   * was decided when the native view mounted. This number re-reads the
   * one and remounts the other.
   */
  const [asked, setAsked] = useState(0);
  const me = useMyPosition(asked);
  /**
   * True once the reader has asked to be located and the system has no
   * dialog left to show them.
   *
   * iOS raises the location prompt **once per install**. After "Don't
   * Allow", every later `requestForegroundPermissionsAsync` returns
   * denied with no interface at all — so the locate button was calling
   * it, getting denied, bumping `asked`, re-reading nothing, and leaving
   * the screen exactly as it was. A button that does nothing and says
   * nothing is read as a broken button, and correctly.
   *
   * The only way back is Settings, which the app cannot open on the
   * reader's behalf without being asked. So this state exists to ask.
   */
  const [blocked, setBlocked] = useState(false);

  /**
   * Coming back from Settings, having granted it.
   *
   * Without this the notice is a dead end in the other direction: the
   * reader does the thing it asked for, returns, and finds the same
   * sentence telling them to do it — because nothing in the app re-reads
   * a permission that changed while it was in the background. The nonce
   * does double duty here, re-running `useMyPosition` and remounting the
   * map so its blue dot appears too.
   *
   * Only while the notice is up. An always-on listener would re-read the
   * permission every time a notification shade closed, for a sheet that
   * is usually not even on screen.
   */
  useEffect(() => {
    if (!visible || !blocked) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      Location.getForegroundPermissionsAsync()
        .then(({ status }) => {
          if (status !== 'granted') return;
          setBlocked(false);
          setAsked((n) => n + 1);
        })
        .catch(() => {});
    });
    return () => sub.remove();
  }, [visible, blocked]);

  // ── the keyboard ──
  //
  // The sheet is anchored to the bottom of the screen, so the keyboard
  // covered the field being typed into, the chips, and the button.
  //
  // Measured here rather than handed to `KeyboardAvoidingView`, and the
  // reason is a rule rather than a preference: that component works by
  // adding bottom padding to itself, and an absolutely positioned child —
  // which this sheet is, being pinned to the bottom — is laid out against
  // its parent's *padding box*. Padding therefore moves it not at all.
  // The first attempt at this did exactly that and changed nothing.
  //
  // iOS only. Android resizes its own window through `windowSoftInputMode`,
  // so lifting the sheet as well would raise it twice.
  const { height: winH } = useWindowDimensions();
  const [kb, setKb] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    // `will`, not `did`: the frame is known before the animation starts,
    // so the sheet travels with the keyboard instead of jumping after it.
    const up = Keyboard.addListener('keyboardWillShow', (e) => setKb(e.endCoordinates.height));
    const down = Keyboard.addListener('keyboardWillHide', () => setKb(0));
    return () => { up.remove(); down.remove(); };
  }, []);

  // Focusing the field scrolls it to the top of what is left, which takes
  // the map off screen. That is the right trade rather than a compromise:
  // while you are typing an address, the map carries nothing.
  //
  // Coming back matters as much as going. After a search lands, the
  // keyboard closes and this scrolls back to the top — otherwise the map
  // moves to the address you asked for while scrolled out of sight, and
  // the only thing you see happen is the keyboard going away.
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [fieldY, setFieldY] = useState(0);
  const showField = () => scroller.current?.scrollTo({ y: Math.max(0, fieldY - 8), animated: true });
  const showMap = () => scroller.current?.scrollTo({ y: 0, animated: true });

  /** The city and mode the sheet opened on — what a cancel puts back. */
  const opened = useRef<{ id: string; mode: 'auto' | 'manual' } | null>(null);
  /** Set by the button; a hide without it is a cancel. */
  const committed = useRef(false);

  // Re-seeded on each open rather than held between them: the sheet is a
  // question, and closing it without answering must not change the answer
  // that was already there (rule 1). The field is seeded with the pin's
  // name so the answer the sheet reopens on is visible in it (rule 2);
  // the wells and the permission notice answered a visit that is over
  // (rule 4).
  //
  // The hide is the cancel, not the scrim or the back gesture: the screen
  // above closes the sheet for a sign-in too, and a switch that leaks
  // through that door would stand on a sheet that reopens reseeded from
  // `value`, as if nothing had been chosen — which is what the reseed
  // already says. Put back as it was, auto or manual: `setCity`'s second
  // argument has the reasoning.
  useEffect(() => {
    if (!visible) {
      const was = opened.current;
      if (!committed.current && was && city && was.id !== city.id) setCity(was.id, was.mode);
      return;
    }
    opened.current = city ? { id: city.id, mode } : null;
    committed.current = false;
    setDraft(value);
    const name = value.at ? (value.atName ?? '') : '';
    setQuery(name);
    setSettled(name);
    setMissed(false);
    setHits(null);
    setMoved(null);
    setElsewhere(null);
    setBlocked(false);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * The point the sheet is talking about, whichever way it was chosen.
   *
   * Three ways lead here and all three are the reader placing a pin on
   * purpose: a search result, a tap on the map, and — the one this missed
   * — choosing an area. Picking "Hà Đông" sets a district and no point, so
   * everything below used to fall back to where the reader was *standing*:
   * somebody in Thanh Hóa planning a day in Hà Đông chose it, saw the chip
   * light up, and watched the map go on showing Thanh Hóa.
   *
   * Derived here rather than written into the draft, because `Start` keeps
   * district and point exclusive and the screen above reads them that way.
   * What the caller gets back is unchanged; what the sheet shows is not.
   */
  const pinned = draft.at ?? areaCentre(places, draft.district);
  const centre = pinned ?? me ?? (city ? { lat: city.center_lat, lng: city.center_lng } : null);
  // Reordered as the pin moves, which is the whole of "nearby": the pin
  // wins over the reader's own position, because a pin is something they
  // placed on purpose.
  const near = pinned ?? me;
  const cta = ctaMode(query, settled);

  // Google's geocoder, in the other direction: what to call the point the
  // map is showing. Google's rather than the phone's because the map is
  // Google's — `nameOf` has the licence reasoning.
  useEffect(() => {
    if (!visible || !near) { setWhere(''); return; }
    let live = true;
    nameOf({ lat: near.lat, lng: near.lng }, lang)
      .then((name) => { if (live) setWhere(name); });
    return () => { live = false; };
  // `near` is a fresh object each render; its coordinates are what move.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, near?.lat, near?.lng, lang]);

  const districts = useMemo(
    () => areasNear(places, near),
    // `near` is a fresh object each render; its coordinates are what move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [places, near?.lat, near?.lng],
  );
  // Whether the chips may call themselves *nearby*. The catalog is one
  // city, so the closest area is a Hanoi district however far away the
  // reader is standing; twenty-five kilometres is well past anything this
  // app calls walkable, and past it the heading names the city instead of
  // claiming a proximity that is not there.
  // `near` is a fresh object each render; its coordinates are what move.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nearestKm = useMemo(() => nearestAreaKm(places, near), [places, near?.lat, near?.lng]);
  const areasAreNear = nearestKm == null || nearestKm <= 25;

  // Not while a refusal stands: the draft is near-you then, as it is at
  // open, but nothing has been chosen (rule 3), and the tick says chosen.
  const onMe = !draft.district && !draft.at && !elsewhere;
  // The button is a way out only while the field holds a new question.
  // Committing over a refusal would be the quiet road back to the city
  // the sheet was open on, which is the road rule 3 closes.
  const refused = !!elsewhere && cta === 'commit';

  /**
   * What leaves the sheet.
   *
   * A pin taken from a search result already carries the result's name.
   * A pin tapped onto the map has none of its own, so it takes the name
   * the geocoder has given the point by now — the caption under the map,
   * which is what the reader was looking at when they pressed the button.
   * The row on the Ideas screen prints these words; before this it said
   * "A pin you dropped" over a place the reader had just picked by name.
   */
  const settle = (): Start => ({
    ...draft,
    atName: draft.at ? (draft.atName ?? (where || null)) : null,
  });
  const caption = useMemo(() => {
    if (!where) return undefined;
    return onMe
      ? t(`You're here · ${where}`, `Bạn đang ở đây · ${where}`, `現在地 · ${where}`, `你在这里 · ${where}`, `你在這裡 · ${where}`)
      : where;
  }, [where, onMe, t]);

  /**
   * The second line of the "Current location" row.
   *
   * With no position there is nothing to name, and the one thing worth
   * saying is that a tap is what changes it — the row is the only control
   * on the sheet that may raise the permission dialog, see `locate`. With
   * a position, and the row chosen, the geocoder's name for it: the same
   * word the map's caption carries, without the "You're here" the caption
   * needs because the caption sits on a map that could be showing
   * anywhere. With a position and some other answer chosen, nothing: the
   * row is an offer then, not a description, and a name under an offer
   * reads as the thing already taken.
   */
  const meSub = !me
    ? t('Not located yet · tap to locate', 'Chưa xác định được · nhấn để định vị', '未取得 · タップで取得', '尚未定位 · 点按定位', '尚未定位 · 點按定位')
    : onMe ? where : '';

  /**
   * Search, once, when the reader says so.
   *
   * On submit rather than per keystroke. Every search is one billed call
   * to Google Places, and a search box that asks once when asked is also
   * the one that stops the list reshuffling under a moving thumb.
   *
   * Biased by coordinates rather than by pasting the city's name onto the
   * query, which is what this did before and was wrong twice over: it
   * turned "Ủy ban nhân dân xã Quý Lộc" into a Hanoi question when the
   * reader was eighty-five kilometres from Hanoi, and it could only ever
   * bias towards the one city the app happens to be showing.
   */
  const find = async () => {
    const q = query.trim();
    if (!q || finding) return;
    Keyboard.dismiss();
    // No session, no search: the function would say so with a 401, and
    // "nothing found" is the wrong sentence for it (see `findSpots`).
    if (!signedIn) { onNeedSignIn(); return; }
    setFinding(true);
    setMissed(false);
    setElsewhere(null);
    let found: Spot[];
    try {
      found = await findSpots(q, near ?? centre, city?.id ?? null, lang);
    } catch (e) {
      setFinding(false);
      if (e instanceof SignedOutError) { onNeedSignIn(); return; }
      // A spent day's allowance, said as that — see `searchLimitWords`.
      if (e instanceof SearchLimitError) {
        const w = searchLimitWords(e.scope, e.limit, t);
        Alert.alert(w.title, w.body);
        return;
      }
      throw e;
    }
    setFinding(false);
    setHits(found);
    // Asked, so the button stops offering to ask again. A search that came
    // back empty still counts: the reader has had their answer and may now
    // want the pin they already have.
    setSettled(q);
    // Nothing found and a search that failed are one sentence here — see
    // `findSpots`, which throws for neither.
    if (found.length === 0) setMissed(true);
  };

  /** Take one of the results. The pin moves, the list goes, and the map
   *  comes back into view so the move is something the reader watches
   *  rather than something they have to scroll up to find. */
  const take = (spot: Spot) => {
    // A result in no catalog city is not taken. The list goes and the
    // well under the field says so, pointing at the areas below; the
    // words typed stay, to be edited rather than retyped.
    if (!land({ lat: spot.lat, lng: spot.lng }, spot.name)) { setHits(null); return; }
    setHits(null);
    setQuery(spot.name);
    setSettled(spot.name);
    setMissed(false);
    showMap();
  };

  /**
   * Back to near-me, and the one place in the app that may raise the
   * permission dialog.
   *
   * Everywhere else reads the permission and never asks — see
   * `useMyPosition`. Here the reader has just pressed a button whose only
   * meaning is "use where I am", which is the one moment asking is an
   * answer to a question rather than an interruption of one.
   */
  const locate = async () => {
    setDraft({ district: null, at: null, atName: null });
    // Taking this answer drops a half-typed search, as taking an area
    // does: with the row beside the field, leaving "cau giay" in it kept
    // the button saying Search over an answer that had already been given.
    setQuery('');
    setSettled('');
    setHits(null);
    setMissed(false);
    // The wells answer the pin that was just taken; this is a different
    // answer. They stayed up past it on 14 Oct 2026 — "switched to Ho Chi
    // Minh City" over a ticked "Current location · Thanh Xuân".
    setMoved(null);
    setElsewhere(null);
    const held = await Location.getForegroundPermissionsAsync();
    if (held.status === 'granted') { setBlocked(false); await settleCity(); return; }
    // `canAskAgain` is the difference between a question and a wall. The
    // first press on a fresh install can still raise the dialog; every
    // press after a refusal cannot, and pretending otherwise is what made
    // this button silent.
    if (!held.canAskAgain) { setBlocked(true); return; }
    const got = await Location.requestForegroundPermissionsAsync().catch(() => null);
    setBlocked(got != null && got.status !== 'granted' && !got.canAskAgain);
    setAsked((n) => n + 1);
  };

  /**
   * Where the reader is standing, held to the same rule as a pin.
   *
   * A pin that switched the app to another city left "Current location"
   * pointing at the old one: the sheet ticked Thanh Xuân and listed the
   * areas of Ho Chi Minh City, and the plan would have been Saigon cafés
   * from a Hanoi corner — the first bug, mirrored. So the reader's
   * position goes through the city's own "use my location": in another
   * catalog city, the app follows them there (and back to automatic, as
   * that button has always meant) and the ok well says so. In no catalog
   * city, there is nothing to refuse — it is where they are — so the
   * warn well says the plan will not reach them and leaves the choice.
   */
  const settleCity = async () => {
    if (!me) return;
    const home = cityAround(cities, me.lat, me.lng);
    if (!home) { setElsewhere({ name: t('you', 'bạn', '現在地', '你', '你'), me: true }); return; }
    if (city && home.id !== city.id && await followMyLocation()) setMoved(home);
  };

  /** The one way anything leaves the sheet; see `committed`. */
  const commit = () => {
    committed.current = true;
    onDone(settle());
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} />
      <View style={[s.sheet, { bottom: kb, maxHeight: (winH - kb) * 0.9 }]}>
        <View style={s.grabber} />
        <Text style={s.title}>{t('Choose a starting point', 'Chọn địa điểm bắt đầu', '出発地点を選ぶ', '选择出发地点', '選擇出發地點')}</Text>
        <Text style={s.sub}>
          {t(
            // The owner's wording (4 Oct 2026): what to do on this sheet,
            // in the order the sheet offers it — a spot near you, or the
            // search box. The line it replaced promised that plans "lean
            // toward what's nearby", which was already the softest claim
            // the store listing allows (docs/store/listing.md: never write
            // "walkable"); this one promises nothing about distance at
            // all, and the plan still prints every leg's real figure.
            'Pick a spot near you, or search for a starting point in the address box.',
            'Chọn một chỗ gần bạn, hoặc tìm kiếm địa điểm xuất phát trong phần tìm địa chỉ.',
            '近くの場所を選ぶか、住所検索で出発地点を探してください。',
            '选择你附近的地点，或在地址栏中搜索出发地点。', '選擇你附近的地點，或在搜尋欄中搜尋出發地點。',
          )}
        </Text>

        <ScrollView
          ref={scroller}
          // Yoga defaults `flexShrink` to 0, unlike CSS. Without this the
          // list keeps its full content height while the sheet's ceiling
          // comes down around it — the overflow is clipped rather than
          // scrolled, which would have made everything above pointless.
          style={{ flexShrink: 1 }}
          contentContainerStyle={{ paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          // Drag the list down and the keyboard follows the finger, which
          // is what every iOS list with a keyboard over it does.
          keyboardDismissMode="interactive"
        >
          {centre && (
            <MiniMap
              key={asked}
              lat={centre.lat}
              lng={centre.lng}
              height={196}
              caption={caption}
              onLocate={locate}
              onPick={(at) => {
                if (!land(at, null)) return;
                // The old point's name must not be read as this one's
                // while the geocoder is still out; the effect refills it.
                setWhere('');
                setMissed(false);
              }}
            />
          )}

          {/* Where you are, as a row — the answer the map's locate button
              gives, offered where there is no map to put a button on.

              Two builds draw no map: Expo Go on an iPhone, and any build
              made without the Google Maps key (`canDrawMap`). On both the
              sheet still searched and still offered the areas, but "start
              from where I am" had no control left at all, and nothing on
              the sheet said that it was already the answer whenever no
              area and no pin was chosen. A reader on such a build sent a
              screenshot and asked for exactly this.

              It stays when the map is there. A row with a tick is also the
              one place the sheet *shows* which of its three answers is
              current: the chips show an area, the map shows a pin, and
              near-me was only ever a caption. */}
          <PressableScale
            onPress={locate}
            scaleTo={0.985}
            haptic="selection"
            contentStyle={s.meRow}
            accessibilityRole="button"
            accessibilityLabel={t('Current location', 'Vị trí hiện tại', '現在地', '当前位置', '目前位置')}
            aria-selected={onMe}
          >
            <View style={s.meIcon}>
              <Ionicons name="navigate" size={16} color={colors.accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.hitName} numberOfLines={1}>
                {t('Current location', 'Vị trí hiện tại', '現在地', '当前位置', '目前位置')}
              </Text>
              {meSub ? <Text style={s.hitSub} numberOfLines={1}>{meSub}</Text> : null}
            </View>
            <SelectTick on={onMe} />
          </PressableScale>

          {/* What the locate button used to do silently, said out loud.

              It names what is missing and what it costs — not "permission
              denied", which is the system's word for its own state and
              tells the reader nothing about their plan. Then the one
              action that can change it. `openSettings` lands on this
              app's own page, so it is a tap and a switch rather than a
              hunt through Privacy.

              Only after they ask to be located. Nobody who has picked a
              district or dropped a pin needs to be told about a
              permission they are not using, and a notice that appears
              unbidden is a nag. */}
          {blocked && (
            <View style={s.blocked}>
              <Ionicons name="location-outline" size={17} color={colors.textSecondary} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={s.missed}>
                  {t(
                    "City Crew is not allowed to know where you are, so plans start from the city rather than from you. iOS only asks once — after that it is a switch in Settings.",
                    'City Crew chưa được phép biết bạn ở đâu, nên kế hoạch sẽ bắt đầu từ thành phố thay vì từ chỗ bạn đứng. iOS chỉ hỏi một lần — sau đó phải bật lại trong Cài đặt.',
                    'City Crew は現在地を取得できないため、プランはあなたの居場所ではなく街を起点にします。iOS が尋ねるのは一度きりで、あとは設定でのオンオフになります。',
                    'City Crew 无法获取你的位置，因此计划会从城市而不是你的位置出发。iOS 只会询问一次 — 之后需要在设置中开启。', 'City Crew 無法取得你的位置，因此計畫會從城市而不是你的位置出發。iOS 只會詢問一次 — 之後需要在設定中開啟。',
                  )}
                </Text>
                <PressableScale
                  onPress={() => Linking.openSettings().catch(() => {})}
                  accessibilityRole="button"
                >
                  <Text style={s.blockedCta}>
                    {t('Open Settings', 'Mở Cài đặt', '設定を開く', '打开设置', '開啟設定')}
                  </Text>
                </PressableScale>
              </View>
            </View>
          )}

          <View style={s.field} onLayout={(e) => setFieldY(e.nativeEvent.layout.y)}>
            <Ionicons name="search" size={18} color={colors.textTertiary} />
            <TextInput
              value={query}
              onChangeText={(v) => { setQuery(v); setMissed(false); }}
              onFocus={showField}
              onSubmitEditing={find}
              returnKeyType="search"
              placeholder={t(
                'Search an address or place',
                'Tìm địa chỉ hoặc địa điểm',
                '住所や場所を検索',
                '搜索地址或地点', '搜尋地址或地點',
              )}
              placeholderTextColor={colors.textTertiary}
              style={s.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {finding ? <ActivityIndicator size="small" color={colors.accent} /> : null}
          </View>
          {/* ── a pin that fell nowhere ──
              A well, not a line. The first cut said this in `missed`'s
              13pt grey, the register of "nothing found for that", and the
              owner's reading was that nobody would notice it — which is
              the one notice here that must be noticed, since the reader
              has just done something the sheet refused. The theme's warn
              pair (new with this, amber on every look) with the glyph
              beside it; the fact in bold, the way out under it: search
              again, or the area chips right below. "Not yet" rather than
              "none": the catalog has not reached there, not the place. */}
          {elsewhere && (
            <View style={[s.well, s.warnWell]} testID="start-elsewhere">
              <Ionicons name="alert-circle" size={18} color={colors.warnInk} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.wellTitle, { color: colors.warnInk }]}>
                  {t(
                    `No places near ${elsewhere.name} yet.`,
                    `Chưa có địa điểm quanh ${elsewhere.name}.`,
                    `${elsewhere.name} の周辺にはまだスポットがありません。`,
                    `${elsewhere.name}附近还没有地点。`, `${elsewhere.name}附近還沒有地點。`,
                  )}
                </Text>
                {/* Every way out, since nothing is chosen now (rule 3) and
                    the button below is dimmed. When the refused pin is
                    the reader's own position, "your current location"
                    is the thing just refused, and the areas come first:
                    they are the only answer that needs no typing. */}
                <Text style={[s.wellBody, { color: colors.warnInk }]}>
                  {elsewhere.me
                    ? t(
                      'Pick an area below, or search somewhere else.',
                      'Chọn một khu vực bên dưới, hoặc tìm chỗ khác.',
                      '下のエリアを選ぶか、別の場所を検索してください。',
                      '选择下方的区域，或搜索其他地方。', '選擇下方的區域，或搜尋其他地方。',
                    )
                    : t(
                      'Search somewhere else, pick an area below, or use your current location.',
                      'Tìm chỗ khác, chọn một khu vực bên dưới, hoặc dùng vị trí hiện tại.',
                      '別の場所を検索するか、下のエリアを選ぶか、現在地を使ってください。',
                      '搜索其他地方、选择下方的区域，或使用你的当前位置。', '搜尋其他地方、選擇下方的區域，或使用你的目前位置。',
                    )}
                </Text>
              </View>
            </View>
          )}
          {/* The confirmation is the ok pair: a city the reader just chose
              is state they made, which is what that green is for. What
              the plan will do, not what the app just did (rule 4): the
              switch is real now and undone by a cancel, and "switched to"
              was a report of the one thing a cancel takes back. */}
          {moved && (
            <View style={[s.well, s.okWell]} testID="start-moved">
              <Ionicons name="checkmark-circle" size={18} color={colors.okInk} />
              <Text style={[s.wellBody, { color: colors.okInk, flex: 1 }]}>
                {t(
                  `The plan will be made in ${cityName(moved)}.`,
                  `Kế hoạch sẽ lập ở ${cityName(moved)}.`,
                  `プランは${cityName(moved)}で作ります。`,
                  `计划将在${cityName(moved)}制定。`, `計畫將在${cityName(moved)}制定。`,
                )}
              </Text>
            </View>
          )}
          {missed && (
            <Text style={s.missed}>
              {t(
                'Nothing found for that. Try fewer words, or a street and district.',
                'Không tìm thấy gì. Thử bớt chữ, hoặc tên đường kèm quận.',
                '見つかりませんでした。語を減らすか、通りと区でお試しください。',
                '没有找到结果。试试减少关键词，或输入街道和区名。', '沒有找到結果。試試減少關鍵字，或輸入街道和區名。',
              )}
            </Text>
          )}

          {hits && hits.length > 0 && (
            <View style={s.hits}>
              {hits.map((h, i) => (
                <PressableScale
                  key={`${h.lat},${h.lng}`}
                  onPress={() => take(h)}
                  scaleTo={0.985}
                  haptic="selection"
                  accessibilityRole="button"
                >
                  <View style={[s.hit, i > 0 && s.hitTop]}>
                    <Ionicons name="location-outline" size={17} color={colors.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.hitName} numberOfLines={1}>{h.name}</Text>
                      {/* Only when it says something the name did not —
                          see `spotLabel`, which drops the parts that
                          repeat. A blank line under every result is worse
                          than a row that is simply one line tall. */}
                      {h.label ? (
                        <Text style={s.hitSub} numberOfLines={1}>{h.label}</Text>
                      ) : null}
                    </View>
                  </View>
                </PressableScale>
              ))}
              {/* No credit line. Google's terms ask for a "Powered by
                  Google" mark only where Places data is shown *without* a
                  Google map, and the map above this list is Google's and
                  carries its own logo. (In Expo Go on an iPhone there is no
                  map — see `canDrawMap` — which is a development build's
                  problem and not a shipped one.) */}
            </View>
          )}

          {districts.length > 0 && (
            <>
              <Text style={s.label}>
                {areasAreNear
                  ? t('Or pick a nearby area', 'Hoặc chọn khu vực gần đó', '近くのエリアから選ぶ', '或选择附近的区域', '或選擇附近的區域')
                  // Not "nearby", because it is not. Naming the city is
                  // the honest version of the same offer: these are the
                  // areas City Crew covers, and you are not in them.
                  : city
                    ? t(`Or pick an area in ${city.name_en}`, `Hoặc chọn khu vực ở ${city.name_vi}`, `${city.name_en}のエリアから選ぶ`, `或选择${city.name_en}的区域`, `或選擇${city.name_en}的區域`)
                    : t('Or pick an area', 'Hoặc chọn một khu vực', 'エリアから選ぶ', '或选择一个区域', '或選擇一個區域')}
              </Text>
              <View style={s.chips}>
                {districts.map((d) => (
                  <Chip
                    key={d}
                    label={d}
                    active={draft.district === d}
                    onPress={() => {
                      setMoved(null);
                      setElsewhere(null);
                      setDraft({ district: draft.district === d ? null : d, at: null, atName: null });
                      // The heading above says *or*. Taking this answer
                      // drops the other one rather than leaving half a
                      // search in the field for the button to insist on.
                      setQuery('');
                      setSettled('');
                      setHits(null);
                      setMissed(false);
                    }}
                  />
                ))}
              </View>
            </>
          )}
        </ScrollView>

        <View style={s.foot}>
          {/* One button, two things it could mean — so it says which. Text
              in the field that has never been searched is an intention
              that has not happened yet, and committing over it used to
              throw it away without a word: you typed "cau giay", pressed
              the biggest warmest thing on the screen, and started the day
              in Ba Đình. See `ctaMode`. */}
          <GradientCta
            icon={cta === 'search' ? 'search' : 'checkmark'}
            label={cta === 'search'
              ? t('Search', 'Tìm', '検索', '搜索', '搜尋')
              : t('Use this location', 'Dùng chỗ này', 'ここにする', '使用这个位置', '使用這個位置')}
            onPress={cta === 'search' ? find : commit}
            disabled={refused}
            wide
          />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,5,8,0.32)' },
  // `bottom` and `maxHeight` are set inline from the keyboard's height —
  // a sheet lifted without lowering its ceiling would simply grow off the
  // top of the screen instead.
  sheet: {
    position: 'absolute', left: 0, right: 0,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: space.page, paddingTop: 10, paddingBottom: 26,
  },
  grabber: {
    width: 38, height: 4, borderRadius: 2, alignSelf: 'center',
    backgroundColor: colors.borderGlass, marginBottom: 14,
  },
  title: { color: colors.text, ...type.titleDetail },
  sub: { color: colors.textTertiary, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 16 },

  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 12, paddingHorizontal: 14, height: 46,
    borderRadius: radius.input,
    backgroundColor: colors.surfaceGlass,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  input: { flex: 1, color: colors.text, fontSize: 16, padding: 0 },
  missed: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8 },
  // The two wells under the field, `blocked`'s shape in the theme's
  // semantic tones: 14 inside, the card's radius, glyph at the top of the
  // first line so a two-line well still reads glyph-then-title.
  well: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12,
    paddingHorizontal: 14, paddingVertical: 11, borderRadius: radius.card,
  },
  warnWell: { backgroundColor: colors.warnSoft },
  okWell: { backgroundColor: colors.okSoft },
  wellTitle: { fontSize: 14, lineHeight: 19, fontWeight: font.semibold },
  wellBody: { fontSize: 13, lineHeight: 19 },
  // A tinted well rather than a bare line, unlike `missed`: that one
  // answers a search the reader just ran and is read in passing, while
  // this one is asking them to leave the app and come back.
  blocked: {
    flexDirection: 'row', gap: 10, marginTop: 12,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceGlass,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  blockedCta: { color: colors.accent, fontSize: 14, fontWeight: font.semibold },

  // The same card as a search hit, so the two kinds of answer on the
  // sheet that are a named point read as one family; the glyph gets a
  // tinted well because a bare 16pt arrow next to 15pt text was the
  // least visible thing on the sheet, and this row exists to be found.
  meRow: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    marginTop: 12, paddingHorizontal: 13, paddingVertical: 11,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceCard,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  meIcon: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },

  hits: {
    marginTop: 10,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceCard,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
    overflow: 'hidden',
  },
  hit: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingVertical: 11 },
  // A hairline between rows and none above the first, so the list reads as
  // one card rather than a stack of them.
  hitTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  hitName: { color: colors.text, fontSize: 15, fontWeight: font.semibold },
  hitSub: { color: colors.textTertiary, fontSize: 13, marginTop: 2 },

  label: {
    color: colors.textTertiary, fontSize: 12, fontWeight: font.semibold,
    letterSpacing: 0.7, textTransform: 'uppercase', marginTop: 20, marginBottom: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  foot: { marginTop: 18, alignItems: 'stretch' },
});
