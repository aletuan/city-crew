// Where the day should start.
//
// Three answers, in the order people actually have them: near me, a
// district by name, or a point on a map. The sheet's own subtitle is the
// promise it keeps — roughly is fine — so none of them asks for an
// address, and the map is the least prominent of the three rather than
// the centrepiece the mockup makes it.
//
// It shows no places, and cannot: see the note at the top of MiniMap.

import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import MiniMap from './MiniMap';
import { Chip, GradientCta, PressableScale } from './ui';
import { useCity, useMyPosition } from '../lib/city';
import { useI18n } from '../lib/i18n';
import { colors, font, radius, space, type } from '../theme';

export type Start = { district: string | null; at: { lat: number; lng: number } | null };

export default function StartSheet({ visible, districts, value, onClose, onDone }: {
  visible: boolean;
  districts: string[];
  value: Start;
  onClose: () => void;
  onDone: (next: Start) => void;
}) {
  const { t } = useI18n();
  const { city } = useCity();
  const me = useMyPosition();
  const [draft, setDraft] = useState<Start>(value);
  const [where, setWhere] = useState<string>('');

  // Re-seeded on each open rather than held between them: the sheet is a
  // question, and closing it without answering must not change the answer
  // that was already there.
  useEffect(() => { if (visible) setDraft(value); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // The platform's geocoder, not Google's. Named here because the choice
  // is a licence one rather than a taste one — see MiniMap.
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
  const nearMe = !draft.district && !draft.at;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.grabber} />
        <Text style={s.title}>{t('Where should it start?', 'Bắt đầu từ đâu?', 'どこから始めますか？')}</Text>
        <Text style={s.sub}>
          {t(
            'Roughly is fine — we keep everything walkable.',
            'Áng chừng là được — chúng tôi giữ mọi thứ trong tầm đi bộ.',
            'だいたいで大丈夫 — 歩ける範囲でまとめます。',
          )}
        </Text>

        <ScrollView contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
          <PressableScale
            onPress={() => setDraft({ district: null, at: null })}
            style={[s.nearRow, nearMe && s.nearRowOn]}
            accessibilityRole="button"
          >
            <Ionicons name="navigate" size={17} color={nearMe ? colors.accent : colors.textSecondary} />
            <Text style={[s.nearText, nearMe && s.nearTextOn]}>
              {t('Near me', 'Gần tôi', '現在地の近く')}
            </Text>
            {nearMe ? <Ionicons name="checkmark" size={17} color={colors.accent} /> : null}
          </PressableScale>

          {districts.length > 0 && (
            <>
              <Text style={s.label}>{t('Or pick an area', 'Hoặc chọn một khu', 'エリアで選ぶ')}</Text>
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

          {/* Last, and only when there is somewhere to centre it. A map is
              the most precise of the three answers and the least often
              wanted, so it sits below the two that are quicker to give. */}
          {centre && (
            <>
              <Text style={s.label}>{t('Or drop a pin', 'Hoặc thả ghim', 'ピンを置く')}</Text>
              <MiniMap
                lat={centre.lat}
                lng={centre.lng}
                caption={where || undefined}
                onPick={(at) => setDraft({ district: null, at })}
              />
            </>
          )}
        </ScrollView>

        <View style={s.foot}>
          <GradientCta
            icon="checkmark"
            label={t('Use this', 'Dùng chỗ này', 'これにする')}
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
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '86%',
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

  nearRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 13, borderRadius: radius.card,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1, borderColor: 'transparent',
  },
  nearRowOn: { backgroundColor: colors.accentSoft, borderColor: colors.accentLine },
  nearText: { color: colors.text, fontSize: 15.5, fontWeight: font.semibold, flex: 1 },
  nearTextOn: { color: colors.accent },

  label: {
    color: colors.textTertiary, fontSize: 12, fontWeight: font.semibold,
    letterSpacing: 0.7, textTransform: 'uppercase', marginTop: 20, marginBottom: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  foot: { marginTop: 18, alignItems: 'stretch' },
});
