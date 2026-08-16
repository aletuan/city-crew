// Where the day should start.
//
// Three ways to answer, and the map is the first of them now rather than
// the last. It used to sit under a "Near me" row and a row of chips, on
// the argument that a map is the most precise answer and the least often
// wanted. The reader disagreed, with a mockup: the map is what tells you
// where you are, and everything else on the sheet is a way of moving it.
//
// So: the map, the address field that moves it, the areas that reorder
// around it, and the button. "Near me" is no longer a row of its own —
// the locate button on the map is that answer, and it keeps it as *near
// me* rather than as the coordinates you happened to be standing on, so
// a plan made now and walked to later starts from where you are then.
//
// It shows no places, and cannot: see the note at the top of MiniMap.
//
// ── on the search field ──
//
// It used to call `Location.geocodeAsync`, which on iOS is CLGeocoder, and
// CLGeocoder resolves addresses: a street and a district in, a point out.
// It has no opinion about "Ủy ban nhân dân xã Quý Lộc" — that is a name —
// so the field promised "an address or place" while being able to do only
// the first half. Apple's own search box is MKLocalSearch, a different
// API that expo-location does not expose.
//
// It asks `find-address` now, which searches OpenStreetMap. Not Google,
// and that is a licence decision rather than a taste one: Places results
// may not be displayed on a map that is not Google's (§5.3), and in Expo
// Go on iOS the only map that renders is Apple's — the same clause is why
// MiniMap shows no places at all. OSM's ODbL has no such clause.
//
// So there is a list of candidates to choose from, which is what people
// expect from a search box and what the geocoder could never give. The
// reader picks one and the map moves to it.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Keyboard, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import MiniMap from './MiniMap';
import { Chip, GradientCta, PressableScale } from './ui';
import { useCity, useMyPosition } from '../lib/city';
import { findSpots, type Spot } from '../lib/findplace';
import { useI18n } from '../lib/i18n';
import { areasNear, nearestAreaKm } from '../lib/trip';
import type { Place } from '../lib/types';
import { colors, font, radius, space, type } from '../theme';

export type Start = { district: string | null; at: { lat: number; lng: number } | null };

export default function StartSheet({ visible, places, value, onClose, onDone }: {
  visible: boolean;
  /** The catalog, because the areas are ordered from it — and ordered in
   *  here rather than by the caller, which was the first version and did
   *  not work: the sheet keeps its own draft until Done, so a caller
   *  ordering by *its* draft left the chips still while the pin moved. */
  places: Place[];
  value: Start;
  onClose: () => void;
  onDone: (next: Start) => void;
}) {
  const { t } = useI18n();
  const { city } = useCity();
  const [draft, setDraft] = useState<Start>(value);
  const [where, setWhere] = useState<string>('');
  const [query, setQuery] = useState('');
  const [finding, setFinding] = useState(false);
  const [missed, setMissed] = useState(false);
  /** What the last search turned up. null before there has been one. */
  const [hits, setHits] = useState<Spot[] | null>(null);
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
  const scroller = useRef<ScrollView>(null);
  const [fieldY, setFieldY] = useState(0);
  const showField = () => scroller.current?.scrollTo({ y: Math.max(0, fieldY - 8), animated: true });
  const showMap = () => scroller.current?.scrollTo({ y: 0, animated: true });

  // Re-seeded on each open rather than held between them: the sheet is a
  // question, and closing it without answering must not change the answer
  // that was already there.
  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    setQuery('');
    setMissed(false);
    setHits(null);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // The platform's geocoder, in the other direction: what to call the
  // point the map is showing.
  useEffect(() => {
    const at = draft.at ?? me;
    if (!visible || !at) { setWhere(''); return; }
    let live = true;
    Location.reverseGeocodeAsync({ latitude: at.lat, longitude: at.lng })
      .then((rows) => {
        const r = rows[0];
        const name = r?.district || r?.subregion || r?.street || r?.city || '';
        if (live) setWhere(name);
      })
      .catch(() => { if (live) setWhere(''); });
    return () => { live = false; };
  }, [visible, draft.at?.lat, draft.at?.lng, me?.lat, me?.lng]);

  const centre = draft.at ?? me ?? (city ? { lat: city.center_lat, lng: city.center_lng } : null);
  // Reordered as the pin moves, which is the whole of "nearby": the pin
  // wins over the reader's own position, because a pin is something they
  // placed on purpose.
  const near = draft.at ?? me;
  const districts = useMemo(
    () => areasNear(places, near),
    [places, near?.lat, near?.lng],
  );
  // Whether the chips may call themselves *nearby*. The catalog is one
  // city, so the closest area is a Hanoi district however far away the
  // reader is standing; twenty-five kilometres is well past anything this
  // app calls walkable, and past it the heading names the city instead of
  // claiming a proximity that is not there.
  const nearestKm = useMemo(() => nearestAreaKm(places, near), [places, near?.lat, near?.lng]);
  const areasAreNear = nearestKm == null || nearestKm <= 25;

  const onMe = !draft.district && !draft.at;
  const caption = useMemo(() => {
    if (!where) return undefined;
    return onMe
      ? t(`You're here · ${where}`, `Bạn đang ở đây · ${where}`, `現在地 · ${where}`)
      : where;
  }, [where, onMe, t]);

  /**
   * Search, once, when the reader says so.
   *
   * On submit rather than per keystroke. Both providers behind
   * `find-address` are free and shared, and Nominatim's usage policy makes
   * one-request-per-character the thing it blocks people for; a search box
   * that asks once when asked is also the one that stops the list
   * reshuffling under a moving thumb.
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
    setFinding(true);
    setMissed(false);
    const found = await findSpots(q, near ?? centre);
    setFinding(false);
    setHits(found);
    // Nothing found and a search that failed are one sentence here — see
    // `findSpots`, which throws for neither.
    if (found.length === 0) setMissed(true);
  };

  /** Take one of the results. The pin moves, the list goes, and the map
   *  comes back into view so the move is something the reader watches
   *  rather than something they have to scroll up to find. */
  const take = (spot: Spot) => {
    setDraft({ district: null, at: { lat: spot.lat, lng: spot.lng } });
    setHits(null);
    setQuery(spot.name);
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
    setDraft({ district: null, at: null });
    setMissed(false);
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      await Location.requestForegroundPermissionsAsync().catch(() => null);
      setAsked((n) => n + 1);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} />
      <View style={[s.sheet, { bottom: kb, maxHeight: (winH - kb) * 0.9 }]}>
        <View style={s.grabber} />
        <Text style={s.title}>{t('Where should it start?', 'Bắt đầu từ đâu?', 'どこから始めますか？')}</Text>
        <Text style={s.sub}>
          {t(
            'Roughly is fine — we keep everything walkable.',
            'Áng chừng là được — chúng tôi giữ mọi thứ trong tầm đi bộ.',
            'だいたいで大丈夫 — 歩ける範囲でまとめます。',
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
              onPick={(at) => { setDraft({ district: null, at }); setMissed(false); }}
            />
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
              )}
              placeholderTextColor={colors.textTertiary}
              style={s.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {finding ? <ActivityIndicator size="small" color={colors.accent} /> : null}
          </View>
          {missed && (
            <Text style={s.missed}>
              {t(
                'Nothing found for that. Try fewer words, or a street and district.',
                'Không tìm thấy gì. Thử bớt chữ, hoặc tên đường kèm quận.',
                '見つかりませんでした。語を減らすか、通りと区でお試しください。',
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
              {/* ODbL's side of the bargain, and the reason this search can
                  sit above an Apple map at all. */}
              <Text style={s.credit}>
                {t('Results from OpenStreetMap', 'Kết quả từ OpenStreetMap', '検索結果：OpenStreetMap')}
              </Text>
            </View>
          )}

          {districts.length > 0 && (
            <>
              <Text style={s.label}>
                {areasAreNear
                  ? t('Or pick a nearby area', 'Hoặc chọn khu vực gần đó', '近くのエリアから選ぶ')
                  // Not "nearby", because it is not. Naming the city is
                  // the honest version of the same offer: these are the
                  // areas cityCrew covers, and you are not in them.
                  : city
                    ? t(`Or pick an area in ${city.name_en}`, `Hoặc chọn khu vực ở ${city.name_vi}`, `${city.name_en}のエリアから選ぶ`)
                    : t('Or pick an area', 'Hoặc chọn một khu vực', 'エリアから選ぶ')}
              </Text>
              <View style={s.chips}>
                {districts.map((d) => (
                  <Chip
                    key={d}
                    label={d}
                    active={draft.district === d}
                    onPress={() => setDraft({ district: draft.district === d ? null : d, at: null })}
                  />
                ))}
              </View>
            </>
          )}
        </ScrollView>

        <View style={s.foot}>
          <GradientCta
            icon="checkmark"
            label={t('Use this location', 'Dùng chỗ này', 'ここにする')}
            onPress={() => onDone(draft)}
            wide
          />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,5,8,0.32)' },
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
  input: { flex: 1, color: colors.text, fontSize: 15.5, padding: 0 },
  missed: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8 },

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
  hitSub: { color: colors.textTertiary, fontSize: 12.5, marginTop: 2 },
  credit: {
    color: colors.textTertiary, fontSize: 11, textAlign: 'right',
    paddingHorizontal: 13, paddingBottom: 9, paddingTop: 2,
  },

  label: {
    color: colors.textTertiary, fontSize: 12, fontWeight: font.semibold,
    letterSpacing: 0.7, textTransform: 'uppercase', marginTop: 20, marginBottom: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  foot: { marginTop: 18, alignItems: 'stretch' },
});
