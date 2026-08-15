// Add a place: find the real business, and we fetch the rest.
//
// The screen is a search field and a list, and that is the design rather
// than a simplification of it. There is no field for a name, a photo or
// an address, because what a visitor contributes here is a *pointer* — the
// place itself arrives from Google with its rating, its price band, its
// opening hours and its photographs, exactly as it does when the desk
// imports one. A typed-in place would land in the same list as a card with
// six photographs and 669 reviews, as a name in an empty frame.
//
// No map, and that decision is closed rather than deferred.
//
// The map in the mockup has exactly one job: telling three shops called
// "So Coffee" apart. Nobody taps it — the row is the target — and nobody
// pans it, because they typed the name and already know what they want.
//
// It cannot do that job here. Search is scoped to a city, so all five
// results share one, and the ambiguity is at district scale. A static
// image the width of a phone has to hold the whole city; five pins
// cluster in the middle of it and say "all of these are in Hanoi", which
// the reader knew. Zooming would fix that, and a static image cannot
// zoom.
//
// The interactive one cannot be drawn at all. On iOS, Expo Go can only
// render Apple Maps, and the Places API terms are explicit — §5.3, "No
// use with a non-Google map": Google Places content must not be shown in
// conjunction with a non-Google map. So the free path renders a map we
// are not allowed to put these results on, and the allowed path is a
// development build, which costs this project Expo Go.
//
// What the map was for, a distance does — see `awayFrom`. See issue #146.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Keyboard, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AmbientWarmth, BackButton, PressableScale, useTabBarClearance } from '../components/ui';
import { AddIconButton } from '../components/add';
import { distanceKm, fmtDistance } from '../lib/geo';
import { useAuth } from '../lib/auth';
import { useCity, useMyPosition } from '../lib/city';
import { usePlaces } from '../lib/catalog';
import { useI18n } from '../lib/i18n';
import {
  Candidate, knownByPlaceId, Known, searchPlaces, suggestPlace,
} from '../lib/suggest';
import { colors, font, radius, space, type } from '../theme';
import type { Nav, RootRoute } from '../nav';

/**
 * One result, in whichever of its three states it is in.
 *
 * The "already here" row is the one worth having. Somebody who could not
 * find a place by scrolling and reached for Add most often wants a place
 * that **is already there** — and this hands it to them with a way to open
 * it, rather than telling them they have made a duplicate.
 */
function Row({ c, known, busy, away, onAdd, onOpen }: {
  c: Candidate;
  known: Known;
  busy: boolean;
  /** How far from the reader, already formatted — or '' when there is no
   *  position to measure from, which is a state the row simply wears. */
  away: string;
  onAdd: () => void;
  onOpen: (slug: string) => void;
}) {
  const { t } = useI18n();
  const live = known.state === 'live';
  const mine = known.state === 'mine';

  return (
    <View style={[s.row, live && s.rowLive]}>
      <View style={[s.pin, live && s.pinLive]}>
        <Ionicons
          name={live || mine ? 'checkmark' : 'location-outline'}
          size={18}
          color={live ? colors.ok : mine ? colors.textSecondary : colors.accent}
        />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={s.name} numberOfLines={1}>{c.name}</Text>
        <Text style={[s.sub, live && s.subLive]} numberOfLines={1}>
          {live
            ? t('Already on cityCrew', 'Đã có trên cityCrew', 'すでに cityCrew にあります')
            : mine
              ? t('You added this — only you can see it', 'Bạn đã thêm — hiện chỉ mình bạn thấy', '追加済み — まだあなただけに表示')
              // Distance first, then the address as far as it fits.
              //
              // Three shops called "So Coffee" arrive with three addresses
              // that are identical for their first several words and get
              // cut at one line — "…, Hà Nội 1…", "…, Thanh Xuân,…" — so
              // the one field that tells them apart was the field being
              // truncated. A distance is four characters, never cut, and
              // is the actual answer to which one you meant — when there
              // is one. Without a position it falls back to the address
              // alone, which is what it always was.
              : away ? `${away} · ${c.address}` : c.address}
        </Text>
      </View>

      {live ? (
        <PressableScale onPress={() => onOpen(known.slug)} scaleTo={0.94} style={s.viewBtn}>
          <Text style={s.viewText}>{t('View', 'Xem', '見る')}</Text>
        </PressableScale>
      ) : mine ? null : busy ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <AddIconButton
          onPress={onAdd}
          accessibilityLabel={t(`Add ${c.name}`, `Thêm ${c.name}`, `${c.name} を追加`)}
        />
      )}
    </View>
  );
}

export default function AddPlaceScreen({ navigation, route }: { navigation: Nav; route: RootRoute<'AddPlace'> }) {
  const { t } = useI18n();
  const { city } = useCity();
  const me = useMyPosition();
  const { session } = useAuth();
  const meId = session?.user?.id;
  const places = usePlaces();
  const tabClearance = useTabBarClearance();

  const [query, setQuery] = useState(route.params?.query ?? '');
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [known, setKnown] = useState<Record<string, Known>>({});
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const input = useRef<TextInput>(null);

  const cityName = city ? t(city.short_en, city.short_vi, city.short_ja) : '';

  const run = useCallback(() => {
    const q = query.trim();
    if (!q || !city || searching) return;
    Keyboard.dismiss();
    setSearching(true);
    setResults(null);
    searchPlaces(q, city.id)
      .then((found) => {
        setResults(found);
        // Best effort, and deliberately not awaited: a failed duplicate
        // check should leave every row looking new rather than take the
        // search results down with it. The function still refuses a
        // duplicate either way.
        knownByPlaceId(found.map((c) => c.place_id), meId).then(setKnown).catch(() => {});
      })
      .catch((e: Error) => Alert.alert(t('Search failed', 'Tìm kiếm thất bại', '検索に失敗しました'), e.message))
      .finally(() => setSearching(false));
  }, [query, city?.id, searching, meId, t]);

  /**
   * Arrived from Search with the words already typed.
   *
   * Search has just told this person their words match nothing, and they
   * tapped the row that says "let us look it up". Landing on a field
   * holding their query and waiting to be told to search again would be
   * asking for the same thing twice — the tap *was* the instruction.
   *
   * Once, and only once the city is known: `run` refuses without one, so
   * firing during the city bootstrap would do nothing and never retry.
   */
  const pending = useRef(!!route.params?.query);
  useEffect(() => {
    if (!pending.current || !city) return;
    pending.current = false;
    run();
  }, [city?.id, run]);

  /**
   * How far a result is from the reader, or nothing at all.
   *
   * From where they are standing, not from the middle of the city, and
   * the difference is the whole point. "1.2 km from the centre of Hanoi"
   * is a fact about Hanoi; the reader is deciding whether they can walk
   * there, and only one of those two numbers answers that. A number that
   * looks like the answer and is not is worse than a blank.
   *
   * So no position, no distance — no fallback to the centre, no
   * approximation. Somebody who declined to share their location gets the
   * row exactly as it read before, which is an honest thing for it to be.
   *
   * The permission is read, never asked for: bootstrap already put that
   * dialog up at launch. See `useMyPosition`.
   *
   * The radius guard is for a reader browsing a city they are not in —
   * picking Hanoi from Saigon is one tap. Every result would then be
   * "1730 km", true and useless, and five identical numbers disambiguate
   * nothing. Outside the city's own radius, the distance means the wrong
   * thing and is not drawn.
   */
  const inThisCity = !!city && !!me
    && distanceKm(me.lat, me.lng, city.center_lat, city.center_lng) <= city.radius_km;

  const awayFrom = (c: Candidate) => (
    inThisCity && me && c.lat != null && c.lng != null
      ? fmtDistance(distanceKm(me.lat, me.lng, c.lat, c.lng))
      : ''
  );

  const add = (c: Candidate) => {
    if (!city || adding) return;
    setAdding(c.place_id);
    suggestPlace(c.place_id, city.id)
      .then((out) => {
        if (out.ok) {
          // Marked here rather than re-searched: the row changes state in
          // place, so adding several from one search does not mean
          // starting the search again after each.
          setKnown((k) => ({ ...k, [c.place_id]: { state: 'mine' } }));
          places.reload();
          // What is true, in the order it matters: it worked, it is
          // yours, and here is why a friend cannot see it yet.
          //
          // No mention of review. The person contributed something; being
          // told at that exact moment that their contribution must first
          // pass an inspection is a strange way to say thank you, and the
          // only part of it they actually need is why nobody else sees the
          // place. That much is a fact about now, not a process to
          // explain.
          Alert.alert(
            t('Thanks — it is in', 'Cảm ơn — đã thêm', 'ありがとうございます'),
            t(
              `${c.name} is on your Explore now. Only you can see it for the moment — we will open it up to everyone shortly.`,
              `${c.name} đã có trong mục Khám phá của bạn. Hiện chỉ mình bạn thấy — chúng tôi sẽ mở cho mọi người sớm thôi.`,
              `${c.name} はあなたの探索に追加されました。今はあなただけに表示され、まもなく全員に公開されます。`,
            ),
          );
          return;
        }
        if (out.reason === 'already_live') {
          setKnown((k) => ({ ...k, [c.place_id]: { state: 'live', slug: out.slug } }));
          return;
        }
        if (out.reason === 'already_known') {
          // Somebody else got there first, and whose suggestion it is is
          // not this reader's business — so the row says the place is
          // known, and stops.
          setKnown((k) => ({ ...k, [c.place_id]: { state: 'mine' } }));
          return;
        }
        Alert.alert(
          out.reason === 'daily_limit'
            ? t('That is enough for today', 'Hôm nay vậy là đủ', '本日はここまで')
            : t('Could not add it', 'Không thêm được', '追加できませんでした'),
          out.reason === 'daily_limit'
            ? t(
              `You can suggest ${out.limit} places a day. Come back tomorrow.`,
              `Mỗi ngày bạn có thể đề xuất ${out.limit} địa điểm. Mai quay lại nhé.`,
              `1日に${out.limit}件まで提案できます。また明日どうぞ。`,
            )
            : out.message,
        );
      })
      .finally(() => setAdding(null));
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <AmbientWarmth />
      <View style={s.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={s.title}>{t('Add a place', 'Thêm địa điểm', 'スポットを追加')}</Text>
      </View>

      <View style={s.field}>
        <Ionicons name="search" size={19} color={colors.textTertiary} />
        <TextInput
          ref={input}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={run}
          returnKeyType="search"
          // Not when the query arrived with us: the search is already
          // running, and a keyboard that opens only to be dismissed a
          // moment later is motion for nothing.
          autoFocus={!route.params?.query}
          placeholder={t(
            `Name of a place in ${cityName}`,
            `Tên một địa điểm ở ${cityName}`,
            `${cityName}のスポット名`,
          )}
          placeholderTextColor={colors.textTertiary}
          style={s.input}
        />
        {query.length > 0 && (
          <PressableScale onPress={() => { setQuery(''); setResults(null); input.current?.focus(); }} scaleTo={0.9} hitSlop={8}>
            <Ionicons name="close-circle" size={19} color={colors.textTertiary} />
          </PressableScale>
        )}
      </View>

      {searching && <ActivityIndicator color={colors.accent} style={{ marginTop: 36 }} />}

      <FlatList
        data={results ?? []}
        keyExtractor={(c) => c.place_id}
        renderItem={({ item }) => (
          <Row
            c={item}
            known={known[item.place_id] ?? { state: 'none' }}
            busy={adding === item.place_id}
            away={awayFrom(item)}
            onAdd={() => add(item)}
            onOpen={(slug) => navigation.navigate('PlaceDetail', { slug })}
          />
        )}
        ListEmptyComponent={!searching && results?.length === 0
          ? (
            <Text style={s.nothing}>
              {t(
                'Nothing found. Try the name as it appears on the door.',
                'Không tìm thấy. Thử tên đúng như trên biển hiệu xem sao.',
                '見つかりません。看板どおりの名前で試してください。',
              )}
            </Text>
          )
          : null}
        ListFooterComponent={results?.length
          ? (
            // Google requires the attribution wherever its results are
            // shown, and it is also the honest answer to "where did these
            // come from" — the same reason photo credits ride the cards.
            <Text style={s.credit}>
              {t(
                `Results from Google Maps · ${cityName}`,
                `Kết quả từ Google Maps · ${cityName}`,
                `Google マップの結果 · ${cityName}`,
              )}
            </Text>
          )
          : null}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: tabClearance }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: space.page, paddingTop: 8, paddingBottom: 14,
  },
  title: { color: colors.text, ...type.titleDetail },

  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: space.page, marginBottom: 14,
    paddingHorizontal: 14, height: 48,
    borderRadius: radius.input,
    backgroundColor: colors.surfaceCard,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  input: { flex: 1, color: colors.text, fontSize: 16, padding: 0 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: space.page, marginBottom: space.cardGap,
    padding: 14,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceCard,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  // A wash of the same green the "public" state uses, so "already here" is
  // good news in the colour good news is told in everywhere else.
  rowLive: { backgroundColor: colors.okSoft },

  pin: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  pinLive: { backgroundColor: colors.surfaceGlass },

  name: { color: colors.text, fontSize: 16, fontWeight: font.semibold },
  sub: { color: colors.textTertiary, fontSize: 13.5 },
  subLive: { color: colors.ok, fontWeight: font.medium },

  viewBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceCard,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderGlassSoft,
  },
  viewText: { color: colors.text, fontSize: 14, fontWeight: font.semibold },

  nothing: {
    color: colors.textSecondary, ...type.meta, lineHeight: 22,
    paddingHorizontal: space.page, paddingTop: 24, textAlign: 'center',
  },
  credit: {
    color: colors.textTertiary, fontSize: 12.5,
    paddingHorizontal: space.page, paddingTop: 6, textAlign: 'center',
  },
});
