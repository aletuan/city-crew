import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { coverOf, fmtCount, Place } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { useSave } from '../lib/save';
import { vibeColor, vibeLabel } from '../lib/vibes';
import { colors, font, onPhoto, radius, space, type } from '../theme';
import PricePill from './PricePill';
import { Card, PressableScale } from './ui';

export default function PlaceCard({ place, onPress }: { place: Place; onPress: () => void }) {
  const { t } = useI18n();
  const { save, isSaved } = useSave();
  const saved = isSaved(place.slug);
  const cover = coverOf(place);
  const reviews = fmtCount(place.rating_count);
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
          {/* Price rides the photograph, out of the way of the name. */}
          <View style={s.priceSlot} pointerEvents="none">
            <PricePill place={place} overlay />
          </View>
          {/* The score belongs to the picture, not to the name under it:
              on the photo it is read at a glance with the place, and the
              body is left to the title and its chips. Bottom-left is the
              last free corner — price holds the top-right, attribution the
              bottom-right. */}
          {place.rating ? (
            <View style={s.ratingSlot} pointerEvents="none">
              <Text style={s.star}>★</Text>
              <Text style={s.ratingValue}>{place.rating}</Text>
              {reviews ? <Text style={s.ratingCount}>({reviews})</Text> : null}
            </View>
          ) : null}
        </View>
        <View style={s.body}>
          {/* The bookmark rides the title line rather than the photograph.
              On the image it was a fourth thing competing with the price,
              the attribution and the picture itself, and it had to carry
              its own scrim to stay visible over any sky. Here it is a
              control among controls — the same round glass button the
              collection rows wear — and it lands beside the name it
              belongs to. */}
          <View style={s.titleRow}>
            <Text style={s.name} numberOfLines={1}>{t(place.name_en, place.name_vi, place.name_ja)}</Text>
            <PressableScale
              onPress={() => save(place)}
              scaleTo={0.9}
              haptic="selection"
              accessibilityRole="button"
              accessibilityState={{ selected: saved }}
              accessibilityLabel={saved
                ? t('Saved — change collections', 'Đã lưu — đổi bộ sưu tập', '保存済み — コレクションを変更')
                : t('Save to a collection', 'Lưu vào bộ sưu tập', 'コレクションに保存')}
              hitSlop={6}
              style={s.saveBtn}
            >
              <Ionicons
                name={saved ? 'bookmark' : 'bookmark-outline'}
                size={19}
                color={saved ? colors.accent : colors.textSecondary}
              />
            </PressableScale>
          </View>
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
  priceSlot: { position: 'absolute', top: 10, right: 10 },
  // The name takes the room the button leaves; `flex: 1` on the text is
  // what stops a long one pushing the button off the card.
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { flex: 1, color: colors.text, ...type.cardTitle },
  // The app's glass, now that it sits on a surface rather than on a photo.
  saveBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1, borderColor: colors.borderGlassSoft,
  },
  // The rating supplies its own ground, like the price pill: a photograph
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
