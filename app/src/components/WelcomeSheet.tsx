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
// going anyway. It demands nothing — no account, no permission — because
// the sheets that ask already exist and arrive when the asking is earned.
//
// The one exception is the line under the button, and it is an offer
// rather than a gate: somebody who already has an account is the reader
// least served by "start exploring", and this sheet reaches them at the
// worst possible moment — a reinstall, or the update that first shipped
// it, where every existing account sees the greeting once. Three taps
// through Profile was the only way back to their own trips.
//
// ── why this one is not a Modal ──
//
// Every other sheet in the app is, and should be. This one arrives during
// launch, and `Modal` on iOS is a native presentation — a view controller
// and a window of its own — raised at the exact moment the JS thread is
// busiest: fonts, the stored theme, the city bootstrap, Explore's fetches
// and the decode of a full-bleed photograph. Presented into that, its
// entrance stuttered. It is a plain absolute overlay now, rendered after
// the navigators so it covers them, and it waits for
// `InteractionManager` before it animates: the startup burst finishes,
// then the sheet rises on an idle thread. Nothing about how it looks
// changed; it just stopped competing for the frame it needed.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, InteractionManager, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { colors, display, font, gradAI, space } from '../theme';
import { PressableScale } from './ui';
import { SwitchRow } from './authUi';
import { goTo } from '../nav';

/** Written once, on the way out. */
const WELCOME_KEY = 'citycrew.welcomeSeen';

/** TEMPORARY — the "Always show welcome" switch in Profile → Settings.
 *  While it is set, this sheet ignores the seen-flag and greets on every
 *  launch, which is the only way to look at it twice without wiping the
 *  app: an EAS update ships a production bundle, so the `__DEV__` back
 *  doors this codebase uses elsewhere are dead on a real phone.
 *
 *  It is meant to be removed once the welcome stops being worked on.
 *  Three places, all marked TEMPORARY: this constant, the `always` half
 *  of the read below, and the row in ProfileScreen's SettingsCard. */
export const WELCOME_ALWAYS_KEY = 'citycrew.welcomeAlways';

/** How far the panel travels, and how fast it leaves. */
const RISE = 400;
const EXIT_MS = 180;

export default function WelcomeSheet() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  // Hidden until storage says otherwise, which is the whole no-flash
  // guarantee: a returning reader never sees a frame of this.
  const [show, setShow] = useState(false);
  const rise = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let live = true;
    // TEMPORARY: the second read is the always-show switch; drop it and
    // this goes back to `getItem(WELCOME_KEY).then(v => v === null)`.
    Promise.all([AsyncStorage.getItem(WELCOME_KEY), AsyncStorage.getItem(WELCOME_ALWAYS_KEY)])
      .then(([seen, always]) => {
        if (!live || !(always === '1' || seen === null)) return;
        // After the launch burst, not during it. The storage read lands in
        // milliseconds; the work it would have animated against does not.
        InteractionManager.runAfterInteractions(() => { if (live) setShow(true); });
      })
      // A read that failed is not a first launch. If storage is broken
      // the write would fail too, so showing here would mean showing on
      // every launch forever — and missing the welcome once is cheaper
      // than a greeting that cannot be dismissed.
      .catch(() => {});
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!show) return;
    rise.setValue(1);
    Animated.spring(rise, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 3 }).start();
  }, [show, rise]);

  const dismiss = useCallback(() => {
    // Out under its own power: without a Modal there is no platform
    // dismissal to borrow, and unmounting on the tap would make the sheet
    // vanish rather than leave.
    Animated.timing(rise, { toValue: 1, duration: EXIT_MS, useNativeDriver: true })
      .start(() => setShow(false));
    AsyncStorage.setItem(WELCOME_KEY, '1').catch(() => {});
  }, [rise]);

  // The other thing a Modal was doing for free. Android only: it is the
  // one platform with a back button to answer, and the other two warn
  // when it is subscribed to at all.
  useEffect(() => {
    if (!show || Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { dismiss(); return true; });
    return () => sub.remove();
  }, [show, dismiss]);

  if (!show) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* The dimmed area dismisses, and it is the only secondary action
          this sheet needs — there is nothing here to decline. It fades
          from the same value the panel rides, so the room dims in step
          with the panel arriving. */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { opacity: rise.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
        ]}
      >
        <Pressable
          style={[StyleSheet.absoluteFill, s.backdrop]}
          onPress={dismiss}
          accessibilityLabel={t('Close', 'Đóng', '閉じる')}
        />
      </Animated.View>
      <Animated.View
        style={[
          s.sheet,
          {
            paddingBottom: insets.bottom + 22,
            transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, RISE] }) }],
          },
        ]}
      >
        <View style={s.grabber} />
        <View style={s.badge}>
          <Ionicons name="compass" size={28} color={colors.accent} />
        </View>
        <Text style={s.title}>
          {t('Welcome to City Crew', 'Chào bạn đến với City Crew', 'City Crew へようこそ')}
        </Text>

        {/* Three lines standing on the sheet itself. They wore a bordered
            card until the owner put this beside the screens it was
            modelled on: a panel inside a panel is a box in a box, and the
            welcomes worth copying set their rows straight on the ground
            with the glyphs in one left rail. The icon tiles are the only
            enclosure left, and they earn it — they are what the eye
            follows down the list.

            Each glyph is the one its tab wears, so the sheet teaches the
            bar underneath it. */}
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

        {/* The way back for a reader who is not new. It leaves the same
            way the button does — the flag is written either way, so the
            greeting does not wait for them on the other side of signing
            in — and lands on Profile's sign-in screen, the route the
            save sheet already takes from outside the navigators. */}
        <View style={s.switch}>
          <SwitchRow
            prompt={t('Already have an account?', 'Đã có tài khoản?', 'すでにアカウントをお持ちですか？')}
            action={t('Sign in', 'Đăng nhập', 'サインイン')}
            onPress={() => { dismiss(); goTo('Profile', { screen: 'SignIn', initial: false }); }}
          />
        </View>
      </Animated.View>
    </View>
  );
}

function Row({ icon, title, body }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <View style={s.row}>
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
  backdrop: { backgroundColor: 'rgba(6,5,8,0.62)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    paddingHorizontal: space.page, paddingTop: 10,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
  },
  grabber: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: colors.textTertiary, marginBottom: 16,
  },
  badge: {
    width: 66, height: 66, borderRadius: 33,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    borderWidth: 1, borderColor: colors.accentLine,
  },
  // The screen's own title scale: this sheet is the first page of the
  // app, and it was speaking a card's voice.
  title: {
    color: colors.text, fontSize: 26, lineHeight: 32, fontFamily: display.bold,
    textAlign: 'center', marginTop: 14,
  },

  // No ground of its own — see the note at the call site. The air between
  // the rows is what separates them now, so it has to be worth reading as
  // a separation: hairlines at this spacing would only put the box back.
  rows: { alignSelf: 'stretch', gap: 22, marginTop: 22, marginBottom: 26 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  mark: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    borderWidth: 1, borderColor: colors.accentLine,
  },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: font.semibold },
  rowBody: { color: colors.textTertiary, fontSize: 13.5, lineHeight: 18 },

  // Its own top margin rather than the row's: SwitchRow is shared with
  // the auth screens, where it sits in a column that spaces itself.
  switch: { marginTop: 14 },

  // A rounded rectangle, not a pill: at full width a pill's end caps grow
  // with its height and it reads as a lozenge rather than a block to press.
  primary: { borderRadius: 18, paddingVertical: 17, alignItems: 'center', width: '100%' },
  primaryText: { color: colors.accentInk, fontSize: 17, fontWeight: font.semibold },
});
