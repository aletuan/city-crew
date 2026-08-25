import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { coverOf, fmtCount, isFlagged, isLive, Place } from '../lib/data';
import { openFragment, openState } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useSave } from '../lib/save';
import { vibeColor, vibeLabel } from '../lib/vibes';
import { colors, font, onPhoto, radius, space, type } from '../theme';
import { Card, PressableScale } from './ui';

export default function PlaceCard({ place, onPress }: { place: Place; onPress: () => void }) {
  const { t } = useI18n();
  const { save, isSaved } = useSave();
  const saved = isSaved(place.slug);
  const cover = coverOf(place);
  const reviews = fmtCount(place.rating_count);
  // The clock is read per render, not memoised, for the reason the Search
  // zero-state gives: a list left open across a closing time should not
  // keep insisting the door is open.
  const where = place.neighborhood_en
    ? t(place.neighborhood_en, place.neighborhood_vi ?? place.neighborhood_en,
      place.neighborhood_ja ?? place.neighborhood_en)
    : null;
  const when = openFragment(openState(place.opening_hours, new Date()), t);
  return (
    <PressableScale onPress={onPress}>
      <Card style={s.card}>
        <View>
          {cover ? (
            <>
              <Image source={{ uri: cover.photo_uri }} style={s.photo} contentFit="cover" transition={200} />
              {cover.attribution_name
                ? <Text style={s.attr} numberOfLines={1}>{cover.attribution_name}</Text>
                : null}
            </>
          ) : (
            <View style={[s.photo, s.photoFallback]}>
              <Text style={{ fontSize: 44 }}>{place.emoji ?? '📍'}</Text>
            </View>
          )}
          {/* The bookmark holds the photo's top-right corner — the same
              disc, in the same corner, that the detail screen hangs its
              own bookmark in, so the card and the screen it opens keep
              one save control between them. It is also the corner every
              catalog app puts it in, which is the better argument: a
              thumb arrives here already knowing what lives there.

              The price pill used to hold this corner, and it did not
              move — it went. A tile price was an inferred number wearing
              a badge, and "roughly how much" is a question about a place
              you are already considering; the detail screen answers it
              two lines under the name, on a ground where its type can
              actually be read. The tile keeps to what browsing needs:
              what, where, open till when, and now *keep this*.

              The old objection to a bookmark up here — a fourth mark
              crowding the photograph, carrying its own scrim to survive
              any sky — went with the price too. Three corners, three
              marks, one dark-glass material shared with the rating pill
              beside it. */}
          <PressableScale
            onPress={() => save(place)}
            scaleTo={0.9}
            haptic="selection"
            accessibilityRole="button"
            accessibilityState={{ selected: saved }}
            accessibilityLabel={saved
              ? t('Saved — change collections', 'Đã lưu — đổi bộ sưu tập', '保存済み — コレクションを変更')
              : t('Save to a collection', 'Lưu vào bộ sưu tập', 'コレクションに保存')}
            hitSlop={8}
            containerStyle={s.saveSlot}
            style={s.saveFab}
          >
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={19}
              color={saved ? onPhoto.accent : onPhoto.text}
            />
          </PressableScale>
          {/* The score belongs to the picture, not to the name under it:
              on the photo it is read at a glance with the place, and the
              body is left to the title and its chips. Bottom-left is the
              last free corner — the bookmark holds the top-right,
              attribution the bottom-right. */}
          {place.rating ? (
            <View style={s.ratingSlot} pointerEvents="none">
              <Text style={s.star}>★</Text>
              <Text style={s.ratingValue}>{place.rating}</Text>
              {reviews ? <Text style={s.ratingCount}>({reviews})</Text> : null}
            </View>
          ) : null}
        </View>
        <View style={s.body}>
          {/* The whole line is the name's now that the bookmark rides the
              photograph — a 40pt disc used to sit beside it, and the
              names this catalog actually holds are long enough that the
              disc's width was the difference between reading one and
              reading "Bún chả Hàng Quạt — quán g…". */}
          <Text style={s.name} numberOfLines={1}>{t(place.name_en, place.name_vi, place.name_ja)}</Text>
          {/* Which part of town, before you have to open it to find out.
              ── the question this answers ──

              This catalog holds three Hadu Sushi and two Artemis Pastry,
              and they are not duplicates: separate businesses with
              separate Google ids, kilometres apart, in different
              districts. Search "Hadu" and three cards came back that were
              identical — same name, same chips, differing only in a
              photograph — and telling them apart meant opening each one
              and coming back.

              `PlaceDetailScreen` has carried the district and the full
              address all along. That is one screen too late: the
              disambiguating happens in the list, and the detail only
              confirms whichever guess you already made.

              ── unconditional, not only-when-ambiguous ──

              Showing it only for names that repeat would need the card to
              know the whole catalog, through a prop or a context read.
              That is more machinery for a card that is *harder* to
              predict: one that sometimes carries a district and sometimes
              does not reads as a bug. It is also useful on every card —
              "what part of town is this in" is a question about a place,
              not about a collision.

              Drawn as the plan and trip screens draw it, so a place named
              in a list and the same place named in an itinerary say the
              same thing the same way. Dropped rather than left blank when
              the catalog has no district for a row: an empty line under a
              name is a gap that looks like a loading state. */}
          {/* The hour rides the district's line — "Ngọc Hà · đến 21:00"
              — because "can I actually go" is the same question at the
              same moment as "what part of town". The grammar is
              `openFragment`'s, shared with the Search zero-state rows,
              so two lists of places can never learn to disagree about
              what an hour says. A place near closing announces itself
              while you scroll, which no amount of opening its page
              earlier could do.

              The pin still belongs to the district alone: with no
              district the row can still carry an hour, and an icon
              pointing at a closing time would label the wrong half of
              the sentence. */}
          {(where || when) && (
            <View style={s.whereRow}>
              {where
                ? <Ionicons name="location-outline" size={13} color={colors.textTertiary} />
                : null}
              <Text style={s.where} numberOfLines={1}>
                {[where, when].filter(Boolean).join(' · ')}
              </Text>
            </View>
          )}
          {/* Only its submitter can see this card at all, so the marker is
              not a warning — it is the answer to "why can nobody else see
              the place I added". Without it the card looks live, they show
              a friend, the friend sees nothing, and the app reads as broken.

              It says what is true of the card rather than what is being
              done about it. "Awaiting review" was a worse label twice
              over: it made a contribution sound like a submission at a
              counter, and it was not even accurate — a place can be
              approved and still not published, and that card said the desk
              had not looked at it when the desk had.

              Turned down keeps its own words. One is *wait*, the other is
              *no*, and a person owed the second should not be left
              expecting the first — which is exactly what would happen if
              this softening reached across to cover it. */}
          {!isLive(place) && (
            <View style={[s.statusRow, isFlagged(place) && s.statusRowBad]}>
              <Ionicons
                name={isFlagged(place) ? 'close-circle-outline' : 'time-outline'}
                size={13}
                color={isFlagged(place) ? colors.bad : colors.textSecondary}
              />
              <Text style={[s.statusText, isFlagged(place) && s.statusTextBad]} numberOfLines={1}>
                {isFlagged(place)
                  ? t('Not accepted', 'Không được duyệt', '不採用')
                  : t('Only you can see this', 'Chỉ mình bạn thấy', 'あなただけに表示中')}
              </Text>
            </View>
          )}
          {place.vibe_tags.length > 0 && (
            <View style={s.vibeRow}>
              {place.vibe_tags.slice(0, 3).map((v) => (
                <View key={v} style={s.vibeChip}>
                  <View style={[s.vibeDot, { backgroundColor: vibeColor(v) }]} />
                  <Text style={s.vibeText} numberOfLines={1}>{vibeLabel(v, t)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Card>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  card: { marginHorizontal: space.page, marginBottom: space.cardGap },
  photo: { width: '100%', aspectRatio: 16 / 10, backgroundColor: colors.surfaceGlass },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  // Google requires the photo's author attribution wherever the photo is
  // shown, so this cannot be dropped — only made to recede. The camera
  // glyph is gone (it read as a control), the type is smaller, and it is
  // capped at half the card so a long name can't cross the frame.
  attr: {
    position: 'absolute', right: 10, bottom: 8, maxWidth: '50%',
    fontSize: 8.5, color: onPhoto.text, opacity: 0.5,
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3,
  },
  // ~10% tighter than the standard card body: this is a feed, not a form.
  body: { paddingHorizontal: space.cardPadding, paddingVertical: 13 },
  // Top-right of the image, mirroring the attribution bottom-right.
  saveSlot: { position: 'absolute', top: 10, right: 10 },
  // The rating pill's exact ground, one hairline and all: two marks on
  // one photograph should be made of one material. The circle is not
  // decoration — it separates this tap from the card's own (press the
  // disc and you save, press anywhere else and the place opens) and it
  // holds the 40pt target that makes that separation reachable.
  saveFab: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(10,11,10,0.58)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: onPhoto.line,
  },
  name: { color: colors.text, ...type.cardTitle },
  // Tight under the name it qualifies — 3pt, not the 8 the status row and
  // the chips take, because those are separate statements and this is the
  // second half of the first one.
  whereRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  // The same tertiary weight the plan and trip screens give a district, so
  // the fact wears one face across the app.
  where: { flex: 1, color: colors.textTertiary, ...type.meta },
  // The rating supplies its own ground, like the bookmark: a photograph
  // can be any brightness, and a score has to be legible over all of them.
  ratingSlot: {
    position: 'absolute', left: 10, bottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 5,
    backgroundColor: 'rgba(10,11,10,0.58)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: onPhoto.line,
  },
  // Three weights: the gold mark, the number, the count in parentheses.
  star: { color: onPhoto.star, fontSize: 13 },
  ratingValue: { color: onPhoto.text, fontSize: 14.5, fontWeight: font.semibold },
  ratingCount: { color: onPhoto.textSecondary, fontSize: 12.5, fontWeight: font.regular },
  // Vibes read as small glass pills, each carrying its own colour in a dot
  // only — the type stays neutral so the row scans without shouting.
  // One line, never wrapping, so every card keeps the same height.
  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', marginTop: 8,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: radius.pill, backgroundColor: colors.surfaceGlass,
  },
  statusRowBad: { backgroundColor: colors.badSoft },
  statusText: { color: colors.textSecondary, fontSize: 12, fontWeight: font.medium },
  statusTextBad: { color: colors.bad },

  vibeRow: { flexDirection: 'row', flexWrap: 'nowrap', gap: 6, marginTop: 8 },
  vibeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1,
    backgroundColor: colors.surfaceGlass, borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderGlassSoft, borderRadius: radius.pill,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  vibeDot: { width: 6, height: 6, borderRadius: 3 },
  vibeText: { color: colors.textSecondary, fontSize: 12, fontWeight: font.medium },
});
