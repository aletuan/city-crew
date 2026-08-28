// The one time this app explains itself.
//
// Everything else here teaches in place: an empty collections list says
// what a collection is for, the first trip row points at Ideas, the save
// sheet explains signing in at the moment somebody reaches to save. That
// is the right way round — deliver the value, don't describe it — and it
// is why there is no tour, no carousel, and nothing to skip.
//
// But two of the five tabs never introduce themselves. A reader who
// lands on Explore, browses, and leaves has no way to learn that the app
// plans an evening for them or that a plan can carry friends; the only
// page that says so is Profile, which is the tab nobody opens first. So:
// one sheet, once, three lines, and a button that goes where they were
// going anyway. It asks for nothing — no account, no permission — because
// the sheets that ask already exist and arrive when the asking is earned.
//
// It wears the house sheet: the room dims in place and only the panel
// rises, the same entrance AuthSheet and the switchers use.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { colors, display, font, gradAI, radius, space } from '../theme';
import { PressableScale } from './ui';

/** Written once, on the way out. */
const WELCOME_KEY = 'citycrew.welcomeSeen';

export default function WelcomeSheet() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  // Hidden until storage says otherwise, which is the whole no-flash
  // guarantee: a returning reader never sees a frame of this.
  const [show, setShow] = useState(false);
  const rise = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(WELCOME_KEY)
      .then((v) => { if (live && v === null) setShow(true); })
      // A read that failed is not a first launch. If storage is broken
      // the write would fail too, so showing here would mean showing on
      // every launch forever — and missing the welcome once is cheaper
      // than a greeting that cannot be dismissed.
      .catch(() => {});
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!show) { rise.setValue(1); return; }
    Animated.spring(rise, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 3 }).start();
  }, [show, rise]);

  const dismiss = () => {
    setShow(false);
    AsyncStorage.setItem(WELCOME_KEY, '1').catch(() => {});
  };

  return (
    <Modal visible={show} transparent animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
      {/* The dimmed area dismisses, and it is the only secondary action
          this sheet needs — there is nothing here to decline. */}
      <Pressable style={s.backdrop} onPress={dismiss} accessibilityLabel={t('Close', 'Đóng', '閉じる')} />
      <Animated.View
        style={[
          s.sheet,
          {
            paddingBottom: insets.bottom + 22,
            transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, 400] }) }],
          },
        ]}
      >
        <View style={s.grabber} />
        <View style={s.badge}>
          <Ionicons name="compass" size={28} color={colors.accent} />
        </View>
        <Text style={s.title}>
          {t('Welcome to cityCrew', 'Chào bạn đến với cityCrew', 'cityCrew へようこそ')}
        </Text>

        {/* Each row wears the glyph of the tab it is about, so the sheet
            also teaches the bar underneath it. */}
        <View style={s.rows}>
          <Row
            icon="compass-outline"
            title={t('Explore and save', 'Khám phá và lưu lại', '探して、保存する')}
            body={t(
              'Find the good places in your city and keep the ones you like.',
              'Tìm chỗ hay trong thành phố và giữ lại nơi bạn thích.',
              '街のいい場所を見つけて、気に入ったところを残せます。',
            )}
          />
          <Row
            icon="bulb-outline"
            title={t('Plan with AI', 'Lên kế hoạch cùng AI', 'AIと計画する')}
            body={t(
              'Say what kind of day you want and get a route that works.',
              'Nói bạn muốn một ngày thế nào, nhận ngay lịch trình hợp lý.',
              'どんな一日にしたいか伝えるだけで、無理のないルートに。',
            )}
          />
          <Row
            icon="people-outline"
            title={t('Bring the crew', 'Rủ cả hội', '仲間を誘う')}
            body={t(
              'Share the plan, invite friends, decide together.',
              'Chia sẻ kế hoạch, mời bạn bè, cùng chốt.',
              'プランを共有して友達を招待、みんなで決められます。',
            )}
            last
          />
        </View>

        {/* The width belongs on the Pressable itself: the sheet centres
            its children, so an un-stretched one shrink-wraps the label
            and the "100%" inside resolves against that. */}
        <PressableScale
          onPress={dismiss}
          accessibilityRole="button"
          containerStyle={{ alignSelf: 'stretch' }}
        >
          <LinearGradient {...gradAI} style={s.primary}>
            <Text style={s.primaryText}>
              {t('Start exploring', 'Bắt đầu khám phá', '探索をはじめる')}
            </Text>
          </LinearGradient>
        </PressableScale>
      </Animated.View>
    </Modal>
  );
}

function Row({ icon, title, body, last }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  last?: boolean;
}) {
  return (
    <View style={[s.row, !last && s.rowDivider]}>
      <View style={s.mark}>
        <Ionicons name={icon} size={20} color={colors.accent} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={s.rowTitle}>{title}</Text>
        <Text style={s.rowBody}>{body}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,5,8,0.62)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    alignItems: 'center', gap: 12,
    paddingHorizontal: space.page, paddingTop: 10,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  grabber: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: colors.textTertiary, marginBottom: 14,
  },
  badge: {
    width: 66, height: 66, borderRadius: 33,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    borderWidth: 1, borderColor: colors.accentLine,
  },
  title: { color: colors.text, fontSize: 22, fontFamily: display.bold, marginTop: 4 },

  rows: {
    alignSelf: 'stretch', marginTop: 2, marginBottom: 4,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1, borderColor: colors.borderGlassSoft, borderRadius: radius.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: space.cardPadding, paddingVertical: 14,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderGlassSoft },
  mark: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    borderWidth: 1, borderColor: colors.accentLine,
  },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: font.semibold },
  rowBody: { color: colors.textTertiary, fontSize: 13.5, lineHeight: 18 },

  // A rounded rectangle, not a pill: at full width a pill's end caps grow
  // with its height and it reads as a lozenge rather than a block to press.
  primary: { borderRadius: 18, paddingVertical: 17, alignItems: 'center', width: '100%' },
  primaryText: { color: colors.accentInk, fontSize: 17, fontWeight: font.semibold },
});
