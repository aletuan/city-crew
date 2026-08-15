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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AmbientWarmth, BackButton, GradientCta, PressableScale, useTabBarClearance } from '../components/ui';
import CandidateRow from '../components/CandidateRow';
import { useCandidates } from '../lib/candidates';
import { useCity } from '../lib/city';
import { useI18n } from '../lib/i18n';
import { colors, font, gradAI, radius, space, type } from '../theme';
import type { Nav } from '../nav';

export default function AddPlaceScreen({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const { city } = useCity();
  const tabClearance = useTabBarClearance();
  // The bar clears the tab bar itself, so the list must not clear it too —
  // doing both left a screenful of nothing between the last result and the
  // button. And `tabClearance - 24` was six points short of the tab bar's
  // own height, which is what put the note under the button behind it.
  const footClearance = useTabBarClearance(10);
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
  const finished = batch.total > 0 && !batch.running;
  const showFoot = chosen.length > 0 || batch.running || finished;

  const go = () => {
    if (!chosen.length) return;
    addMany(chosen).then((r) => {
      // Back to Explore when the run was clean, because that is where the
      // places now are. Not when something failed: navigating away from a
      // failure is the app deciding the reader does not need to know.
      if (r.failed === 0 && !r.cancelled) navigation.goBack();
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
          {batch.total > 0
            ? t(
              `ADDING ${batch.total} · ${batch.done} DONE`,
              `ĐANG THÊM ${batch.total} · XONG ${batch.done}`,
              `${batch.total}件を追加中 · ${batch.done}件完了`,
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
      {showFoot && (
        <View style={[s.foot, { paddingBottom: footClearance }]}>
          {batch.running ? (
            <>
              <LinearGradient {...gradAI} style={s.progress}>
                <ActivityIndicator color={colors.accentInk} />
                <Text style={s.progressText}>
                  {t(
                    `Adding ${batch.done + 1} of ${batch.total}…`,
                    `Đang thêm ${batch.done + 1}/${batch.total}…`,
                    `${batch.total}件中 ${batch.done + 1}件目…`,
                  )}
                </Text>
              </LinearGradient>
              <PressableScale onPress={cancel} accessibilityRole="button">
                <Text style={s.cancel}>
                  {t('Stop after this one', 'Dừng sau chỗ này', 'この件で止める')}
                </Text>
              </PressableScale>
            </>
          ) : chosen.length > 0 ? (
            // Still something to add — including after a partial failure,
            // where the ones that did not go through are still selected
            // and this button is the retry. A screen that only offered
            // the way out would be making the reader start over.
            <GradientCta
              wide
              icon="add"
              label={chosen.length === 1
                ? t('Add this place', 'Thêm địa điểm này', 'このスポットを追加')
                : t(
                  `Add ${chosen.length} places`,
                  `Thêm ${chosen.length} địa điểm`,
                  `${chosen.length}件を追加`,
                )}
              onPress={go}
            />
          ) : (
            // Reached when a run ended and nothing is left to try — either
            // everything went through and something else failed, or it was
            // cancelled. Either way the way back is the only thing left.
            <GradientCta
              wide
              icon="arrow-back"
              label={t('Back to Explore', 'Về Khám phá', '探索に戻る')}
              onPress={() => navigation.goBack()}
            />
          )}
          <Text style={s.footNote}>
            {batch.running
              ? t(
                'You can keep browsing — this finishes on its own.',
                'Bạn cứ dùng tiếp — phần này tự chạy xong.',
                'そのまま閲覧できます — 追加は自動で終わります。',
              )
              : t(
                'We fill in the name, photos and hours.',
                'Chúng tôi điền tên, ảnh và giờ mở cửa.',
                '名前・写真・営業時間はこちらで埋めます。',
              )}
          </Text>
        </View>
      )}
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

  foot: {
    paddingHorizontal: space.page, paddingTop: 14, gap: 10,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  // The gradient, literally — the same fill the button wears, so the bar
  // does not appear to swap for a different control halfway through. It
  // said this in a comment while being flat `colors.accent`, which put the
  // `accentInk` label at 3.64:1 on paper. A comment is not a measurement.
  progress: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, borderRadius: radius.pill,
  },
  progressText: { color: colors.accentInk, fontSize: 16, fontWeight: font.semibold },
  cancel: { color: colors.textSecondary, fontSize: 14, fontWeight: font.semibold, textAlign: 'center' },
  footNote: { color: colors.textTertiary, fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
});
