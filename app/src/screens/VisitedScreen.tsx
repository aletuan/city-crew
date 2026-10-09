// Where you have been: every check-in, filed by month, newest first.
//
// ── what this is, and is not ──
//
// The reader's own record, from the `checkins` table — the row the pill
// on a place's screen writes. Not the taste profile's `place_events`,
// which is private by promise and never drawn; and not Activity, which
// is news *from* other people about your things. The three hold three
// kinds of fact and this screen shows the one the reader made on
// purpose. See `lib/checkin.ts`.
//
// ── the shape ──
//
// Activity's shape, deliberately: an eyebrow per group, a card of rows
// under it, a chevron only where a row goes somewhere. The groups are
// months rather than Upcoming and Earlier, because a visit has no
// future half. The row's second line is the day, the clock and the city
// — the city because the list spans every city the reader has been to,
// while the catalog on the phone holds one. The names and the covers
// come with the rows for the same reason.
//
// The row leads with the place's cover, not a glyph. It opened with a
// pin in Activity's bare 44pt slot, and on a phone thirty pins in a
// column told the eye nothing — a glyph every row shares is decoration,
// where a picture is the one thing that says which row this is (Maps'
// recents, Timeline, every music app). 56pt, rounded 12, the shape a
// content thumbnail takes here as against the circle a person takes on
// Crew; a place with no picture gets the pin on a glass square of the
// same size, so the names stay in one column either way. The pictures
// are the covers the cards draw, at full size: a thumbnail endpoint is
// a later cut, and `expo-image` caches and downsizes in the meantime.
//
// Undo lives on the place's own screen, which holds the whole history
// of visits there and lets any one of them go. This list does not
// repeat the control: a ⋯ on forty rows was forty things to read past
// to find the row, for an action the row's tap already leads to. The
// one exception is a visit at a place since removed from the catalog —
// that row opens nothing, so its ⋯ and sheet stay, as the request cards
// on Activity do it. Not a swipe either way: nothing in this app swipes
// to delete yet, and one screen teaching a gesture the others do not
// honour is a trap.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, ScrollView, StyleSheet, Text, type TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import ActionSheet, { type SheetAction } from '../components/ActionSheet';
import { Card, Chip, Empty, PressableScale, Screen, useTabBarClearance } from '../components/ui';
import SearchField from '../components/SearchField';
import { CATEGORIES, categoryLabel } from '../lib/categories';
import {
  type Checkin, filterVisits, monthTitle, textMatches, visitCategories, visitCities, visitSections, visitSummary,
} from '../lib/checkin';
import { useCity } from '../lib/city';
import { useMyCheckins } from '../lib/checkins';
import { removeCheckin } from '../lib/data';
import { clockOf, numericDate } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { parseRecents, RECENTS_SHOWN, rememberSearch, VISIT_RECENTS_KEY } from '../lib/recents';
import { colors, display, font, space, type } from '../theme';
import type { Nav } from '../nav';

const LINE = 21;
/** The thumbnail's side: 56, the size a content thumbnail takes in a
 *  list that is about the content (Apple Music's lists, Spotify's).
 *  It opened at 48 and was taken to 44 to match the face on Activity;
 *  the owner's eye on the phone said both were too small, and the
 *  reason is fair — a picture of a place has a whole room in it and
 *  needs the pixels to read, where a face reads at 44. So a place's
 *  picture and a person's face are two sizes on purpose, each the size
 *  its subject needs. Radius 12 keeps the 48:10 proportion. Two lines
 *  of text stand about 41pt; the row is 80 with the padding. */
const THUMB = 56;

export default function VisitedScreen({ navigation }: { navigation: Nav }) {
  const { t, lang } = useI18n();
  const visits = useMyCheckins();
  const { cities } = useCity();
  const [menuFor, setMenuFor] = useState<Checkin | null>(null);
  const clearance = useTabBarClearance();

  // The box, always there under the title; and under the box, only once
  // the reader taps into it, a panel: what they searched here before,
  // then the cities, then the kinds of place. This is the fourth drawing
  // of the same two questions. Two scrolling rows of chips (#827) were
  // too much header; a search door and a filter sheet (#828) hid them;
  // chips wrapping in the open under the box (#829) were in sight but
  // took their hundred points from every reader, including the one who
  // came to scroll the list and never narrows it. The panel costs the
  // reader who narrows one tap — the one they were making anyway — and
  // costs the other nothing. It is the catalog's search screen's shape:
  // suggestions, then "browse by", in one card.
  //
  // The panel is opened by focus and closed by Cancel, not by blur. A
  // blur happens when the keyboard is put away to read the list the
  // chips just narrowed, and closing the panel then would take the
  // chips out from under the reader mid-choice. Cancel lets everything
  // go — the words and both chips — because once the panel is closed
  // nothing but the subtitle says the list is narrowed, and a filter
  // nobody can see is a trap.
  //
  // One city and one kind at a time, and a chosen chip tapped again lets
  // go — that is the "All" chip's job done by the chip itself. Multi-
  // select is not here on purpose: on one's own check-ins "Hà Nội or Sài
  // Gòn" is two taps either way, and the union is a second kind of
  // control before anyone has asked for it. A group is offered only when
  // there is a choice to make — one city is a fact, not a filter.
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const cancel = () => {
    setOpen(false); setQuery(''); setCity(null); setKind(null);
    inputRef.current?.blur();
    Keyboard.dismiss();
  };

  // What this box remembered, in its own drawer (`VISIT_RECENTS_KEY`),
  // ferried to and from storage as the catalog's box ferries its own.
  // Remembered when the search *worked*: a row opened, or the return key
  // pressed — a deliberate act either way, never a keystroke, which would
  // keep the seven prefixes of one word. Offered narrowed by what is
  // typed so far, and never the word already in the box.
  const [recents, setRecents] = useState<string[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(VISIT_RECENTS_KEY)
      .then((raw) => setRecents(parseRecents(raw)))
      .catch(() => {});
  }, []);
  const keepRecents = (next: string[]) => {
    setRecents(next);
    AsyncStorage.setItem(VISIT_RECENTS_KEY, JSON.stringify(next)).catch(() => {});
  };
  const noteSearch = () => {
    const next = rememberSearch(recents, query);
    if (next !== recents) keepRecents(next);
  };
  const suggestions = recents
    .filter((term) => textMatches([term], query) && term.trim() !== query.trim())
    .slice(0, RECENTS_SHOWN);
  const cityChoices = useMemo(() => visitCities(visits.data), [visits.data]);
  const kindChoices = useMemo(() => visitCategories(visits.data), [visits.data]);
  const cityName = (id: string) => {
    const c = cities.find((x) => x.id === id);
    return c ? t(c.short_en, c.short_vi, c.short_ja ?? c.short_en) : id;
  };
  // The words typed match the place's name or its city, through the same
  // fold the catalog search uses, and they narrow what the chips leave.
  const shown = useMemo(() => filterVisits(visits.data, city, kind)
    .filter((v) => textMatches([v.place ? t(v.place.name_en, v.place.name_vi, v.place.name_ja ?? v.place.name_en) : '', v.city_id ? cityName(v.city_id) : ''], query)),
    // `cityName` closes over `cities` and `t`, which are listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visits.data, city, kind, query, cities, t]);
  const sections = useMemo(() => visitSections(shown), [shown]);
  const summary = visitSummary(shown);
  const filtered = !!(city || kind);

  const nameOf = (v: Checkin) => (v.place
    ? t(v.place.name_en, v.place.name_vi, v.place.name_ja ?? v.place.name_en)
    : t('A place that was removed', 'Một địa điểm đã bị gỡ', '削除された場所'));
  /** The date, the clock, and the city when the app still knows it. No
   *  weekday — see `numericDate`: thirty rows of "Thứ 5," said nothing. */
  const metaOf = (v: Checkin) => {
    const d = new Date(v.at);
    const city = cities.find((c) => c.id === v.city_id);
    const parts = [numericDate(lang, d), clockOf(d.getHours() * 60 + d.getMinutes())];
    if (city) parts.push(t(city.short_en, city.short_vi, city.short_ja ?? city.short_en));
    return parts.join(' · ');
  };

  const remove = async (v: Checkin) => {
    try {
      await removeCheckin(v.id);
      visits.reload();
    } catch (e) {
      Alert.alert(t('Could not remove it', 'Không bỏ được', '削除できませんでした'), (e as Error).message);
    }
  };
  const actions: SheetAction[] = [{
    key: 'remove', icon: 'trash-outline', destructive: true,
    title: t('Remove this visit', 'Bỏ lần ghé này', 'この訪問を削除'),
    desc: t('Only this one; your other visits stay.', 'Chỉ lần này; các lần khác vẫn giữ.', 'この1件だけ。他の訪問は残ります。'),
    onPress: () => { const v = menuFor; setMenuFor(null); if (v) void remove(v); },
  }];

  // Places and cities, not visits: "30 lần ghé · 30 địa điểm" said one
  // number twice to a reader who checks in once per place, and the city
  // count is the fact the list cannot show on its own.
  // The one quiet line under the title. Unfiltered it is the whole: places
  // and cities. Narrowed, it names what the reader chose — "12 places ·
  // Hà Nội · Cà phê" — because that is the answer to the question the
  // tap asked. A search for a city's name counts as choosing it.
  const placesWord = t(`${summary.places} ${summary.places === 1 ? 'place' : 'places'}`, `${summary.places} địa điểm`, `${summary.places}か所`);
  const chosen = [
    city ? cityName(city) : (summary.cities === 1 && (filtered || query) ? cityName(shown[0]?.city_id ?? '') : null),
    kind ? categoryLabel(kind, t) : null,
  ].filter(Boolean);
  const summaryLine = chosen.length > 0
    ? [placesWord, ...chosen].join(' · ')
    : t(
      `${placesWord} · ${summary.cities} ${summary.cities === 1 ? 'city' : 'cities'}`,
      `${placesWord} · ${summary.cities} thành phố`,
      `${placesWord} · ${summary.cities}都市`,
    );

  return (
    <Screen
      title={t('Check-ins', 'Địa điểm check-in', 'チェックインした場所')}
      subtitle={visits.loaded && visits.data.length > 0 ? summaryLine : undefined}
      onBack={() => navigation.goBack()}
    >
      <ScrollView
        // 6 on top, not the page's 22: the header already ends 14 under
        // the subtitle, and 36 between the subtitle and the box read as
        // a gap between two screens. 20 is what the catalog's search
        // screen leaves between its header row and its first card.
        contentContainerStyle={{ padding: space.page, paddingTop: 6, paddingBottom: clearance, gap: space.cardGap }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* No autoFocus: the box is furniture here, not the reason the
            screen opened, and a keyboard over the list on arrival would
            hide the list the reader came for. */}
        <View style={s.searchRow}>
          <SearchField
            inputRef={inputRef}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setOpen(true)}
            onSubmitEditing={noteSearch}
            testID={{ input: 'visits-input', clear: 'visits-clear' }}
            placeholder={t('Place or city', 'Tên địa điểm hoặc thành phố', '場所または都市')}
          />
          {open && (
            <PressableScale
              onPress={cancel}
              scaleTo={0.94}
              style={s.cancel}
              accessibilityRole="button"
              accessibilityLabel={t('Cancel', 'Hủy', 'キャンセル')}
            >
              <Text style={s.cancelText}>{t('Cancel', 'Hủy', 'キャンセル')}</Text>
            </PressableScale>
          )}
        </View>
        {open && (
          <Card style={s.panel}>
            {suggestions.length > 0 && (
              <View style={s.group}>
                <View style={s.legendRow}>
                  <Text style={s.legend}>{t('Suggestions', 'Gợi ý', '候補')}</Text>
                  <PressableScale
                    onPress={() => keepRecents([])}
                    scaleTo={0.92}
                    hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel={t('Clear suggestions', 'Xóa gợi ý', '候補を消去')}
                  >
                    <Text style={s.clear}>{t('Clear', 'Xóa', '消去')}</Text>
                  </PressableScale>
                </View>
                {suggestions.map((term) => (
                  <PressableScale
                    key={term}
                    style={s.suggestion}
                    scaleTo={0.97}
                    onPress={() => setQuery(term)}
                    accessibilityRole="button"
                    accessibilityLabel={term}
                  >
                    <Ionicons name="search-outline" size={17} color={colors.textTertiary} />
                    <Text style={s.suggestionText} numberOfLines={1}>{term}</Text>
                  </PressableScale>
                ))}
              </View>
            )}
            {cityChoices.length > 1 && (
              <View style={s.group}>
                <Text style={s.legend}>{t('City', 'Thành phố', '都市')}</Text>
                <View style={s.chipWrap}>
                  {cityChoices.map((id) => (
                    <Chip key={id} label={cityName(id)} active={city === id} onPress={() => setCity(city === id ? null : id)} />
                  ))}
                </View>
              </View>
            )}
            {kindChoices.length > 1 && (
              <View style={s.group}>
                <Text style={s.legend}>{t('Kind of place', 'Thể loại', '種類')}</Text>
                <View style={s.chipWrap}>
                  {kindChoices.map((k) => (
                    <Chip
                      key={k}
                      label={categoryLabel(k, t)}
                      icon={CATEGORIES[k]?.icon}
                      iconColor={CATEGORIES[k]?.color}
                      active={kind === k}
                      onPress={() => setKind(kind === k ? null : k)}
                    />
                  ))}
                </View>
              </View>
            )}
            {suggestions.length === 0 && cityChoices.length <= 1 && kindChoices.length <= 1 && (
              <Text style={s.legend}>{t('Type a place or a city.', 'Gõ tên địa điểm hoặc thành phố.', '場所か都市を入力。')}</Text>
            )}
          </Card>
        )}
        {!visits.loaded ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
        ) : visits.data.length === 0 ? (
          <Empty text={t(
            'No visits yet. Check in at a place to start the list.',
            'Chưa có lần ghé nào. Check-in ở một địa điểm để bắt đầu.',
            'まだ訪問がありません。場所でチェックインすると、ここに並びます。',
          )} />
        ) : (
          <>
            {(filtered || query) && sections.length === 0 && (
              <Empty text={t(
                'No visits match both choices.',
                'Không có lần ghé nào khớp cả hai lựa chọn.',
                '両方の条件に合う訪問はありません。',
              )} />
            )}
            {sections.map((sec) => (
              <View key={sec.key} style={s.month}>
                <Text style={s.eyebrow} testID="visit-month">{monthTitle(lang, sec.year, sec.month)}</Text>
                <Card>
                  {sec.data.map((v, i) => {
                    const opens = !!v.place_slug;
                    return (
                      <PressableScale
                        key={v.id}
                        style={[s.row, i > 0 && s.rowDivider]}
                        onPress={opens ? () => { noteSearch(); navigation.navigate('PlaceDetail', { slug: v.place_slug }); } : undefined}
                        // A button only when it goes somewhere — the same
                        // condition as the chevron, so what VoiceOver hears
                        // and what the eye sees agree.
                        accessibilityRole={opens ? 'button' : undefined}
                        testID="visit-row"
                      >
                        <View style={s.thumb} testID="visit-thumb">
                          {v.place?.cover ? (
                            <Image source={{ uri: v.place.cover }} style={s.thumbImage} contentFit="cover" transition={150} aria-hidden />
                          ) : (
                            <Ionicons name="location-outline" size={19} color={colors.textTertiary} />
                          )}
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={s.name} numberOfLines={2} testID="visit-name">{nameOf(v)}</Text>
                          <Text style={s.meta} testID="visit-meta">{metaOf(v)}</Text>
                        </View>
                        {opens ? (
                          <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} style={s.rowEnd} />
                        ) : (
                          <PressableScale
                            onPress={() => setMenuFor(v)}
                            scaleTo={0.85}
                            hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
                            containerStyle={s.rowEnd}
                            accessibilityRole="button"
                            accessibilityLabel={t('Options', 'Tuỳ chọn', 'オプション')}
                          >
                            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textTertiary} />
                          </PressableScale>
                        )}
                      </PressableScale>
                    );
                  })}
                </Card>
              </View>
            ))}
          </>
        )}

      </ScrollView>

      <ActionSheet
        visible={menuFor !== null}
        onClose={() => setMenuFor(null)}
        actions={actions}
        header={menuFor ? (
          <View style={{ gap: 2 }}>
            <Text style={s.sheetTitle} numberOfLines={2}>{nameOf(menuFor)}</Text>
            <Text style={s.sheetMeta}>{metaOf(menuFor)}</Text>
          </View>
        ) : null}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // Cancel is words, not a glyph, as iOS draws it beside a search box:
  // the one control here that undoes rather than narrows. 44 tall to
  // match the box, 10 of padding so the word is not against its edge.
  cancel: { height: 44, justifyContent: 'center', paddingHorizontal: 10 },
  cancelText: { color: colors.textSecondary, fontSize: 15.5, fontWeight: font.medium },
  panel: { padding: space.cardPadding, gap: space.headingToContent },
  group: { gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // The reference's group labels: quiet, sentence case, not the
  // uppercase eyebrow the months wear — these name parts of one card,
  // not sections of the page.
  legend: { color: colors.textSecondary, fontSize: 13.5, fontWeight: font.semibold },
  clear: { color: colors.accent, fontSize: 13.5, fontWeight: font.semibold },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  suggestionText: { flex: 1, color: colors.text, fontSize: 15.5 },
  // The Search screen's `chipWrap`: the shared Chip carries its own
  // right margin, so the wrap only owes the rhythm between lines.
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  month: { gap: 8 },
  eyebrow: {
    color: colors.textTertiary, fontSize: 12.5, fontWeight: font.semibold,
    letterSpacing: 1.1, textTransform: 'uppercase', marginTop: 6,
  },
  // Centred: a 56pt picture beside two lines of text wants its middle
  // on theirs, where a 19pt glyph wanted the first line's. 12 of
  // padding puts the 56 in an 80pt row.
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: space.cardPadding, paddingVertical: 12,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft },
  rowEnd: { alignSelf: 'center' },
  thumb: {
    width: THUMB, height: THUMB, borderRadius: 12, overflow: 'hidden',
    backgroundColor: colors.surfaceGlassStrong, alignItems: 'center', justifyContent: 'center',
  },
  thumbImage: { width: THUMB, height: THUMB },
  name: { color: colors.text, fontSize: 15, lineHeight: LINE, fontWeight: font.medium },
  meta: { color: colors.textTertiary, ...type.meta },
  sheetTitle: { color: colors.text, fontSize: 18, fontFamily: display.semibold },
  sheetMeta: { color: colors.textTertiary, fontSize: 14 },
});
