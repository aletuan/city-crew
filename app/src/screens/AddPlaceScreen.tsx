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
// What the map was for, a distance does — see `awayFrom` in
// `lib/candidates`. See issue #146.

import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AmbientWarmth, BackButton, PressableScale, useTabBarClearance } from '../components/ui';
import AddBatchBar, { batchBarShown } from '../components/AddBatchBar';
import { finished } from '../lib/batch';
import CandidateRow from '../components/CandidateRow';
import { useCandidates } from '../lib/candidates';
import { useCity } from '../lib/city';
import { useI18n } from '../lib/i18n';
import { colors, font, radius, space, type } from '../theme';
import type { Nav } from '../nav';

export default function AddPlaceScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { city } = useCity();
  const tabClearance = useTabBarClearance();
  const { results, known, searching, adding, batch, run, addMany, cancel, awayFrom, clear } = useCandidates();

  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const input = useRef<TextInput>(null);

  // Only what can actually be added. A result already in the catalog is
  // shown — that is the point of showing it — but it is not a thing you
  // can pick, so it must not count toward the button's number either.
  const addable = (results ?? []).filter(
    (c) => (known[c.place_id]?.state ?? 'none') === 'none',
  );
  const chosen = addable.filter((c) => picked.includes(c.place_id));
  const done = {
    label: t('Back to Explore', 'Về Khám phá', '探索に戻る'),
    onPress: () => navigation.goBack(),
  };
  // The bar clears the tab bar itself, so the list must not clear it too —
  // doing both left a screenful of nothing between the last result and the
  // button.
  const showFoot = batchBarShown(chosen.length, batch, done);

  const go = () => {
    if (!chosen.length) return;
    addMany(chosen).then((r) => {
      // Back to Explore when the run was clean, because that is where the
      // places now are. Not when something failed, and not when the cap
      // held anything back: navigating away from either is the app
      // deciding the reader does not need to know.
      if (r.failed === 0 && r.held === 0 && !r.cancelled) navigation.goBack();
    });
  };

  const cityName = city ? t(city.short_en, city.short_vi, city.short_ja) : '';

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
          onSubmitEditing={() => { setPicked([]); run(query); }}
          returnKeyType="search"
          autoFocus
          placeholder={t(
            `Name of a place in ${cityName}`,
            `Tên một địa điểm ở ${cityName}`,
            `${cityName}のスポット名`,
          )}
          placeholderTextColor={colors.textTertiary}
          style={s.input}
        />
        {query.length > 0 && (
          <PressableScale onPress={() => { setQuery(''); clear(); setPicked([]); input.current?.focus(); }} scaleTo={0.9} hitSlop={8}>
            <Ionicons name="close-circle" size={19} color={colors.textTertiary} />
          </PressableScale>
        )}
      </View>

      {searching && <ActivityIndicator color={colors.accent} style={{ marginTop: 36 }} />}

      {/* Count and city, above the results rather than under them. Both
          are answers to "did it search the right place", which is a
          question you have the moment the list appears — not one you
          scroll to the bottom to ask. */}
      {!searching && !!results?.length && (
        <Text style={s.resultHead}>
          {/* "ADDING" only while it is. This asked whether a batch
              existed, so a run that had stopped an hour ago still read as
              in progress. */}
          {batch.running
            ? t(
              `ADDING ${batch.total} · ${batch.done} DONE`,
              `ĐANG THÊM ${batch.total} · XONG ${batch.done}`,
              `${batch.total}件を追加中 · ${batch.done}件完了`,
            )
            : finished(batch)
              ? t(
                `ADDED ${batch.done} OF ${batch.total}`,
                `ĐÃ THÊM ${batch.done}/${batch.total}`,
                `${batch.total}件中 ${batch.done}件を追加`,
              )
              : t(
                `${results.length} RESULTS · ${cityName.toUpperCase()}`,
                `${results.length} KẾT QUẢ · ${cityName.toUpperCase()}`,
                `${results.length}件 · ${cityName}`,
              )}
        </Text>
      )}

      <FlatList
        data={results ?? []}
        keyExtractor={(c) => c.place_id}
        renderItem={({ item }) => (
          <CandidateRow
            c={item}
            known={known[item.place_id] ?? { state: 'none' }}
            busy={adding === item.place_id}
            away={awayFrom(item)}
            item={batch.state[item.place_id]}
            selected={picked.includes(item.place_id)}
            onToggle={() => setPicked((p) => (
              p.includes(item.place_id) ? p.filter((x) => x !== item.place_id) : [...p, item.place_id]
            ))}
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
        contentContainerStyle={{ paddingTop: 8, paddingBottom: showFoot ? 10 : tabClearance }}
        showsVerticalScrollIndicator={false}
      />

      {/* The commit, pinned rather than at the end of the list. It acts on
          a selection that is visible above it, and a button you have to
          scroll to find is a button you lose track of while choosing. */}
      <AddBatchBar chosen={chosen.length} batch={batch} onAdd={go} onCancel={cancel} done={done} />

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

  nothing: {
    color: colors.textSecondary, ...type.meta, lineHeight: 22,
    paddingHorizontal: space.page, paddingTop: 24, textAlign: 'center',
  },
  credit: {
    color: colors.textTertiary, fontSize: 12.5,
    paddingHorizontal: space.page, paddingTop: 6, textAlign: 'center',
  },
  resultHead: {
    color: colors.textTertiary, fontSize: 12, fontWeight: font.semibold,
    letterSpacing: 0.7, paddingHorizontal: space.page, paddingBottom: 10,
  },

});
