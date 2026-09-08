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
// the navigators so it covers them.
//
// ── when it rises ──
//
// Two waits, and they used to be one that waited for nothing.
//
// The first is for the launch to settle: Explore says so the moment its
// content has committed (`lib/launch`), and the sheet holds until then
// plus a short grace for that commit to paint. It waited on
// `InteractionManager.runAfterInteractions` before, which sounds like the
// same thing and is not — see the note in `lib/launch` for why that call
// fired a few milliseconds after the storage read, inside the burst.
//
// The second is one frame between mounting and moving. The sheet used to
// mount and start its spring in the same commit, so the logo's decode,
// the gradient's native view and three glyphs' layout all landed on the
// spring's first frames. Now it mounts parked below the screen, and the
// motion starts on the next frame with the views already there.
//
// A launch that never reports — a reader who lands on another tab, a
// test rendering the sheet alone — still gets its welcome, after a
// fallback long enough that the burst is over either way.
//
// ── how it rises ──
//
// The order a system sheet keeps. The room dims first; the panel starts
// up a beat later, on the spring iOS uses for its own sheets — damped to
// settle without a bounce — so the eye has moved to where the panel is
// about to be before it is there. Then the contents arrive in reading
// order, logo to button, each a few frames behind the last: the sheet
// is read top to bottom and the motion walks the reader down it.
//
// With Reduce Motion on, none of that slides. The room dims and the
// panel fades in place, contents already in position, and it leaves the
// same way. What the setting asks for is a screen that does not move
// under the reader, and a fade is the one entrance that keeps that.

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, BackHandler, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { colors, display, font, gradAI, space } from '../theme';
import { PressableScale, useReducedMotion } from './ui';
import { SwitchRow } from './authUi';
import { goTo } from '../nav';
import { launchSettled } from '../lib/launch';
import welcomeLogo from '../../assets/welcome-logo.png';

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
/** The room dims over this; the panel starts up part-way through it. */
const DIM_MS = 220;
const PANEL_DELAY_MS = 120;
/** iOS's own sheet spring, near enough: heavy damping, no overshoot. */
const PANEL_SPRING = { damping: 28, stiffness: 220, mass: 1 };
/** The contents, one after another, once the panel is most of the way. */
const REVEAL_DELAY_MS = 260;
const REVEAL_STEP_MS = 60;
const REVEAL_MS = 280;
const REVEAL_LIFT = 10;
/** Reduce Motion: the whole entrance is one fade of this length. */
const FADE_MS = 240;
/** Logo, title, three rows, the button block. */
const PARTS = 6;
/** After Explore's content commits, the beat it gets to paint first. */
const SETTLE_GRACE_MS = 350;
/** The longest the sheet waits for a launch that never reports. */
const SETTLE_FALLBACK_MS = 2500;

export default function WelcomeSheet() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  // Hidden until storage says otherwise, which is the whole no-flash
  // guarantee: a returning reader never sees a frame of this.
  const [wanted, setWanted] = useState(false);
  // And then until the launch has settled, or the fallback has run out.
  const settled = useSyncExternalStore(launchSettled.subscribe, launchSettled.get);
  const [show, setShow] = useState(false);
  const reduced = useReducedMotion();
  // 1 is parked below the screen (or, under Reduce Motion, invisible);
  // 0 is arrived. `dim` is the room, 0 clear to 1 dimmed. `reveal` is one
  // value per part of the contents, 0 hidden to 1 in place.
  const rise = useRef(new Animated.Value(1)).current;
  const dim = useRef(new Animated.Value(0)).current;
  const reveal = useRef(Array.from({ length: PARTS }, () => new Animated.Value(0))).current;

  useEffect(() => {
    let live = true;
    // TEMPORARY: the second read is the always-show switch; drop it and
    // this goes back to `getItem(WELCOME_KEY).then(v => v === null)`.
    Promise.all([AsyncStorage.getItem(WELCOME_KEY), AsyncStorage.getItem(WELCOME_ALWAYS_KEY)])
      .then(([seen, always]) => {
        if (live && (always === '1' || seen === null)) setWanted(true);
      })
      // A read that failed is not a first launch. If storage is broken
      // the write would fail too, so showing here would mean showing on
      // every launch forever — and missing the welcome once is cheaper
      // than a greeting that cannot be dismissed.
      .catch(() => {});
    return () => { live = false; };
  }, []);

  // The wait proper. Settled: a short grace, so the content commit that
  // just landed gets its paint before the sheet's mount asks for one.
  // Not settled: the fallback, counted from the moment storage answered.
  useEffect(() => {
    if (!wanted || show) return undefined;
    const t = setTimeout(() => setShow(true), settled ? SETTLE_GRACE_MS : SETTLE_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [wanted, settled, show]);

  // Mount parked, move next frame. Every value is put to its start here,
  // so the commit that mounts the sheet draws it below the screen with
  // the room clear; the motion starts once that commit is in.
  useEffect(() => {
    if (!show) return undefined;
    rise.setValue(1);
    dim.setValue(0);
    reveal.forEach((v) => v.setValue(reduced ? 1 : 0));
    const timing = (v: Animated.Value, toValue: number, duration: number) =>
      Animated.timing(v, { toValue, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    const id = requestAnimationFrame(() => {
      if (reduced) {
        Animated.parallel([timing(dim, 1, FADE_MS), timing(rise, 0, FADE_MS)]).start();
        return;
      }
      Animated.parallel([
        timing(dim, 1, DIM_MS),
        Animated.sequence([
          Animated.delay(PANEL_DELAY_MS),
          Animated.spring(rise, { toValue: 0, ...PANEL_SPRING, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(PANEL_DELAY_MS + REVEAL_DELAY_MS),
          Animated.stagger(REVEAL_STEP_MS, reveal.map((v) => timing(v, 1, REVEAL_MS))),
        ]),
      ]).start();
    });
    return () => cancelAnimationFrame(id);
  }, [show, reduced, rise, dim, reveal]);

  const dismiss = useCallback(() => {
    // Wanted no longer — before anything else. The wait above re-arms
    // whenever `show` drops while `wanted` holds, and it did: the sheet
    // left on the tap and came straight back a grace later, because the
    // one flag that should have ended the launch's welcome was still up.
    setWanted(false);
    // Out under its own power: without a Modal there is no platform
    // dismissal to borrow, and unmounting on the tap would make the sheet
    // vanish rather than leave. Room and panel go together.
    Animated.parallel([
      Animated.timing(rise, { toValue: 1, duration: EXIT_MS, useNativeDriver: true }),
      Animated.timing(dim, { toValue: 0, duration: EXIT_MS, useNativeDriver: true }),
    ]).start(() => setShow(false));
    AsyncStorage.setItem(WELCOME_KEY, '1').catch(() => {});
  }, [rise, dim]);

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
          this sheet needs — there is nothing here to decline. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: dim }]}>
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
            // Under Reduce Motion the panel does not travel; `rise` is
            // its opacity instead, and it fades in where it will stand.
            transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, reduced ? 0 : RISE] }) }],
            opacity: reduced ? rise.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) : 1,
          },
        ]}
      >
        <View style={s.grabber} />
        {/* The app's own mark, not a glyph standing in for one. It comes
            with a cut-out background so it reads on either ground — the
            artwork was drawn on white, and a white tile behind a logo is
            the first thing dark mode shows you. */}
        <Animated.View style={part(reveal[0])}>
          <Image source={welcomeLogo} style={s.logo} contentFit="contain" />
        </Animated.View>
        <Animated.Text style={[s.title, part(reveal[1])]}>
          {t('Welcome to City Crew', 'Chào bạn đến với City Crew', 'City Crew へようこそ')}
        </Animated.Text>

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
            reveal={reveal[2]}
            icon="compass-outline"
            title={t('Discover & save', 'Khám phá & lưu lại', '見つけて、保存する')}
            body={t(
              'Find places worth visiting, and save the ones you love.',
              'Tìm những nơi đáng ghé và lưu lại địa điểm bạn yêu thích.',
              '訪れる価値のある場所を見つけて、お気に入りを保存できます。',
            )}
          />
          <Row
            reveal={reveal[3]}
            icon="bulb-outline"
            title={t('Plan with ease', 'Lên kế hoạch dễ dàng', 'かんたんに計画する')}
            body={t(
              'Say what kind of day you want, and City Crew suggests an itinerary to match.',
              'Chỉ cần nói bạn muốn một ngày thế nào, City Crew sẽ gợi ý lịch trình phù hợp.',
              'どんな一日にしたいか伝えるだけで、City Crew がぴったりの旅程を提案します。',
            )}
          />
          <Row
            reveal={reveal[4]}
            icon="people-outline"
            title={t('Share with friends', 'Chia sẻ cùng bạn bè', '友達と共有する')}
            body={t(
              'Share your plan, invite friends, and decide together.',
              'Chia sẻ kế hoạch, mời bạn bè và cùng nhau lựa chọn.',
              'プランを共有して友達を招待し、みんなで決められます。',
            )}
          />
        </View>

        <Animated.View style={[{ alignSelf: 'stretch' }, part(reveal[5])]}>
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
      </Animated.View>
    </View>
  );
}

/** One part of the contents: hidden a little below its place, then in it. */
function part(v: Animated.Value) {
  return {
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [REVEAL_LIFT, 0] }) }],
  };
}

function Row({ reveal, icon, title, body }: {
  reveal: Animated.Value;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <Animated.View style={[s.row, part(reveal)]}>
      <View style={s.mark}>
        <Ionicons name={icon} size={20} color={colors.accent} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={s.rowTitle}>{title}</Text>
        <Text style={s.rowBody}>{body}</Text>
      </View>
    </Animated.View>
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
  // No disc behind it: the mark carries its own colour and a tinted
  // circle would only fight it.
  //
  // Sized down twice, from 96 to 72 to 60, and the reason it kept
  // reading big is that the file is trimmed to its own artwork — the
  // box is very nearly all ink, where the badge it replaced was mostly
  // padding around a small glyph. So the air it needs has to be put
  // back deliberately: `marginVertical` here, on top of the grabber's
  // margin above and the title's below, which is what stops the mark
  // from sitting wedged between them.
  logo: { width: 60, height: 60, marginVertical: 8 },
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
