import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSession } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { colors, font, gradAI, radius, space } from '../theme';
import { TAB_BAR_HEIGHT, useReducedMotion, useTabBarLift } from './ui';

type Target = 'search' | 'filter' | 'save' | 'collections';
/** How far the ring stands out from the control it marks, each side;
 *  negative draws it inside. */
type Outset = { x: number; y: number };
type Anchor = { ref: React.RefObject<View | null>; press: () => void; focused: () => boolean; outset: Outset };
type Rect = { x: number; y: number; width: number; height: number };
const targets: Target[] = ['search', 'filter', 'save', 'collections'];
const noop = () => {};
const always = () => true;
/** A little clear of the control on every side, so the ring outlines it
 *  rather than sitting on its edge. */
const AROUND: Outset = { x: 4, y: 4 };
const same = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
/** Two readings this far apart must agree before a step is drawn. Long
 *  enough to see a native stack push still moving (it lasts about 350ms,
 *  so two readings inside it differ) and for a scroll asked for without
 *  animation to have landed; short enough that the wait is not felt. */
const SETTLE_MS = 100;
type Notice = 'off' | 'ready';

/** Light enough that the page still reads as the place being shown; dark
 *  enough that the card and the ring are what the eye lands on. */
const SCRIM = 'rgba(6,5,8,0.25)';
/**
 * The page dimmed everywhere but under the ring (owner, 22 Oct 2026).
 *
 * The scrim used to lie over the control it pointed at as well, so the
 * one thing the step was about was dimmed with the rest, and only the
 * ring said which it was. Cut out, the control is the one bright thing on
 * the page, as Material's feature discovery and the web's tour libraries
 * do it. One path, the screen with the ring's shape taken out of it
 * (`evenodd`): the hole has the ring's round ends, where four rectangles
 * round it would have left its corners lit.
 *
 * The ring is a pill (`radius.pill`), which React Native draws with the
 * radius cut to half its shorter side, so the hole's is that too: a
 * circle round the search button, a capsule round the tab.
 */
function spotlight(width: number, height: number, r: Rect) {
  const k = Math.min(r.width, r.height) / 2;
  const { x, y, width: w, height: h } = r;
  return `M0 0H${width}V${height}H0Z`
    + `M${x + k} ${y}H${x + w - k}A${k} ${k} 0 0 1 ${x + w} ${y + k}V${y + h - k}`
    + `A${k} ${k} 0 0 1 ${x + w - k} ${y + h}H${x + k}A${k} ${k} 0 0 1 ${x} ${y + h - k}`
    + `V${y + k}A${k} ${k} 0 0 1 ${x + k} ${y}Z`;
}

/**
 * The pulse: a second ring that grows out of the first and fades, three
 * times when a step appears, then stops (owner, 22 Oct 2026).
 *
 * Three, and stopping, because motion that carries on is motion a reader
 * has to look away from: WCAG 2.2.2 asks that anything moving for more
 * than five seconds can be paused, and three of these come to 4.8. A
 * pulse is 1.2 seconds out and 0.4 at rest, slow enough to read as a
 * breath rather than an alarm. It grows by a quarter, which on the tab's
 * 75×56 pill is about 9pt either side and 7 above and below. These are
 * the starting figures, to be judged on a phone. With Reduce Motion on
 * there is no pulse at all: the cut-out and the ring already say where.
 */
const PULSES = 3;
const PULSE_MS = 1200;
const PULSE_REST_MS = 400;
const PULSE_GROWTH = 1.25;
const Context = createContext({ enabled: null as boolean | null, setEnabled: (_on: boolean) => {}, replay: noop, step: -1, start: (_uid: string) => {}, finish: noop, next: noop,
  register: (_id: Target, _anchor: Anchor): (() => void) => noop, notice: null as Notice | null, noticeTop: null as number | null });
export const useSignupTour = () => useContext(Context);

/** Attach to the real control, without inserting a view into its layout.
 *  `outset` is for a control whose box is not its shape: the tab bar's
 *  cell, whose mark is the pill inside it. */
export function useTourAnchor(id: Target, press: () => void, focused: () => boolean = always, outset: Outset = AROUND) {
  const { register } = useSignupTour();
  const ref = useRef<View>(null);
  const action = useRef(press);
  action.current = press;
  const active = useRef(focused);
  active.current = focused;
  const { x: ox, y: oy } = outset;
  useEffect(() => register(id, { ref, press: () => action.current(), focused: () => active.current(), outset: { x: ox, y: oy } }), [id, register, ox, oy]);
  return ref;
}

/** Automatic entry belongs to the successful signup welcome screen; replay
 * belongs to Profile. A session appearing never starts either entry point. */
export function SignupTourProvider({ children, getRoute, onReplay = noop }: { children: React.ReactNode; getRoute: () => string | undefined; onReplay?: () => void }) {
  const { session } = useSession();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [step, setStep] = useState(-1);
  const [owner, setOwner] = useState<string | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const shown = useRef(rect);
  shown.current = rect;
  const [tipHeight, setTipHeight] = useState(190);
  const anchors = useRef(new Map<Target, Set<Anchor>>());
  const current = useRef<Anchor | null>(null);
  const uid = session?.user.id ?? 'guest';
  const key = `highlight.v1:${uid}`;
  const [record, setRecord] = useState<{ key: string; enabled: boolean; progress: number } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  // Where the notice's top edge sits on screen, for Profile to keep the
  // switch that raised it in view above it (`SettingsCard`).
  const [noticeTop, setNoticeTop] = useState<number | null>(null);
  const noticeRef = useRef<View>(null);
  const lift = useTabBarLift();
  const still = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;
  // Restarted each time a step's ring appears: a new step, or the same
  // step coming back after its target was away.
  const showing = rect ? step : -1;
  useEffect(() => {
    pulse.setValue(0);
    if (still || showing < 0) return;
    const run = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: PULSE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.delay(PULSE_REST_MS),
    ]), { iterations: PULSES });
    run.start();
    return () => run.stop();
  }, [showing, still, pulse]);
  const revision = useRef(0);
  const writes = useRef(Promise.resolve());
  const started = useRef(new Set<string>());
  const finish = useCallback(() => { setStep(-1); setRect(null); }, []);
  const persist = useCallback((enabled: boolean, progress: number) => {
    revision.current += 1;
    const value = { key, enabled, progress };
    setRecord(value);
    // Serialize writes: rapid off/on must survive a restart in the same order.
    writes.current = writes.current.then(() => AsyncStorage.setItem(key, JSON.stringify(value))).catch(() => {});
  }, [key]);
  useEffect(() => {
    let live = true;
    const version = ++revision.current;
    finish(); setNotice(null); setRecord(null);
    void AsyncStorage.getItem(key).then(raw => {
      if (!live || version !== revision.current) return;
      let saved;
      try { saved = JSON.parse(raw ?? 'null'); } catch { saved = null; }
      // Missing records belong to existing readers too. Only an explicit
      // signup or replay can opt in; never infer onboarding from a login.
      setRecord({ key, enabled: saved?.enabled === true, progress: Number.isInteger(saved?.progress) ? saved.progress : 0 });
    }, () => { if (live && version === revision.current) setRecord({ key, enabled: false, progress: 0 }); });
    return () => { live = false; };
  }, [key, finish]);
  const enabled = record?.key === key ? record.enabled : null;
  const setEnabled = useCallback((on: boolean) => {
    finish(); persist(on, 0); setNotice(on ? 'ready' : null);
  }, [finish, persist]);
  const dismiss = useCallback(() => {
    finish(); persist(false, 0); setNotice('off');
  }, [finish, persist]);
  const next = useCallback(() => {
    persist(true, step + 1); setRect(null); setStep(step >= 3 ? -1 : step + 1);
  }, [persist, step]);
  const start = useCallback((account: string) => {
    if (started.current.has(account) || account !== uid) return;
    started.current.add(account);
    persist(true, 0); setNotice(null); setOwner(account); setStep(0);
  }, [uid, persist]);
  const replay = useCallback(() => {
    persist(true, 0); setNotice(null); setOwner(uid); setStep(0); onReplay();
  }, [uid, persist, onReplay]);
  useEffect(() => {
    if (!notice) { setNoticeTop(null); return; }
    AccessibilityInfo.announceForAccessibility(notice === 'off'
      ? t('Guide turned off. Enable it in Profile → Show guide.', 'Đã tắt hướng dẫn. Bạn có thể bật lại trong Hồ sơ → Hiện hướng dẫn.', 'ガイドをオフにしました。プロフィール → ガイドを表示で再開できます。', '新手引导已关闭。可在“个人主页 → 显示新手引导”中重新开启。', '新手引導已關閉。可在「個人檔案 → 顯示新手引導」中重新開啟。')
      : t('Guide enabled. Start whenever you are ready.', 'Đã bật hướng dẫn. Bắt đầu khi bạn sẵn sàng.', 'ガイドをオンにしました。準備ができたら開始できます。', '新手引导已开启，准备好后随时开始。', '新手引導已開啟，準備好後隨時開始。'));
    // The actionable invitation stays until dismissed, including for VoiceOver.
    if (notice === 'ready') return;
    const timer = setTimeout(() => setNotice(null), 10000);
    return () => clearTimeout(timer);
  }, [notice, t]);
  const register = useCallback((id: Target, anchor: Anchor) => {
    const entries = anchors.current.get(id) ?? new Set<Anchor>();
    entries.add(anchor); anchors.current.set(id, entries);
    return () => { entries.delete(anchor); };
  }, []);
  useEffect(() => { if (owner && uid !== owner) finish(); }, [owner, uid, finish]);
  useEffect(() => {
    if (step < 0) return;
    let alive = true;
    // A step appears only once its target holds still: two readings
    // SETTLE_MS apart that agree. Step 2's filter button is still on its
    // way up when the step begins (Explore scrolls it into place in the
    // same commit), and step 3's save button slides in with the place's
    // page; the first reading caught the old place, the card was drawn
    // there and jumped 250ms later (owner, 19 Oct 2026). Once shown, a
    // move is followed at once: that is the reader scrolling.
    let settling: Rect | null = null;
    let settle: ReturnType<typeof setTimeout> | undefined;
    // Re-measure while visible: scrolling, rotation, font size and the floating
    // tab bar can move the actual target. Never leave a ring at an old position.
    const measure = () => {
      // Search and filter live on Explore, save on a place's page. The
      // collections tab lives in the floating bar, which is on every screen
      // the guide passes through, so step 4 follows step 3 on the place's
      // page; asking for Explore there showed nothing (owner, 19 Oct 2026).
      const route = getRoute();
      const expected = step === 2 ? 'PlaceDetail' : step === 3 ? route : 'ExploreHome';
      if (route !== expected) { settling = null; setRect(null); return; }
      const entries = [...(anchors.current.get(targets[step]) ?? [])].filter(a => a.ref.current && a.focused());
      let remaining = entries.length;
      let candidate: { anchor: Anchor; rect: Rect } | null = null;
      if (!remaining) { settling = null; setRect(null); return; }
      entries.forEach(anchor => anchor.ref.current!.measureInWindow((x, y, w, h) => {
        if (!alive) return;
        // The bottom bound is the screen's edge, not the home indicator's
        // inset: the floating bar sits partly inside that inset by design
        // (`useTabBarLift`), and on a Pro Max its foot is at 916 of 932,
        // past the 898 the inset left. A bar that has ducked away slides
        // below the edge and still fails this.
        if (w > 0 && h > 0 && x >= 0 && y >= insets.top && x + w <= width && y + h <= height) {
          // Where the ring goes: the control's box, stood out by the
          // anchor's outset. The box is what must be on screen; the ring
          // is what the card keeps clear of.
          const { x: ox, y: oy } = anchor.outset;
          candidate = { anchor, rect: { x: x - ox, y: y - oy, width: w + ox * 2, height: h + oy * 2 } };
        }
        remaining -= 1;
        if (remaining) return;
        current.current = candidate?.anchor ?? null;
        const measured = candidate?.rect ?? null;
        const held = !!measured && !!settling && same(settling, measured);
        settling = measured;
        if (!measured) { setRect(null); return; }
        if (shown.current || held) {
          setRect(old => old && same(old, measured) ? old : measured);
          return;
        }
        clearTimeout(settle);
        settle = setTimeout(measure, SETTLE_MS);
      }));
    };
    measure(); const timer = setInterval(measure, 250);
    return () => { alive = false; clearInterval(timer); clearTimeout(settle); };
  }, [step, width, height, insets.top, insets.bottom, getRoute]);
  const value = useMemo(() => ({ step, start, finish, next, register, enabled, setEnabled, replay, notice, noticeTop }),
    [step, start, finish, next, register, enabled, setEnabled, replay, notice, noticeTop]);
  const titles = [t('Find a place', 'Tìm nơi bạn muốn đến', '行きたい場所を探す', '寻找地点', '尋找地點'),
    t('Filter and sort', 'Lọc và sắp xếp', '絞り込み・並べ替え', '筛选和排序', '篩選和排序'),
    t('Save places you love', 'Lưu nơi bạn thích', '好きな場所を保存', '保存喜欢的地点', '儲存喜歡的地點'),
    t('Your collections', 'Bộ sưu tập của bạn', 'あなたのコレクション', '你的合集', '你的合集')];
  const descriptions = [t('Find or add a place you like', 'Tìm hoặc bổ sung địa điểm bạn thích', '好きな場所を探したり追加したりできます', '寻找或添加你喜欢的地点', '尋找或新增你喜歡的地點'),
    t('Adjust filters to find places that suit you.', 'Điều chỉnh bộ lọc để tìm địa điểm phù hợp hơn.', 'フィルターで自分に合った場所を探しましょう。', '调整筛选条件，找到适合你的地点。', '調整篩選條件，找到適合你的地點。'),
    t('Add a place to a collection to find it again easily.', 'Thêm địa điểm vào bộ sưu tập để dễ tìm lại.', '場所をコレクションに保存して、あとで簡単に見つけましょう。', '把地点加入合集，之后就能轻松找到。', '把地點加入合集，之後就能輕鬆找到。'),
    t('Find your saved places here.', 'Những địa điểm bạn đã lưu nằm ở đây.', '保存した場所はこちらにあります。', '你保存的地点都在这里。', '你儲存的地點都在這裡。')];
  const cardWidth = Math.min(width - 32, 340);
  const left = rect ? Math.max(16, Math.min(rect.x + rect.width / 2 - cardWidth / 2, width - cardWidth - 16)) : 16;
  // The card stands 12 clear of the ring, above or below it.
  const below = rect ? rect.y + rect.height + 12 : 0;
  const roomBelow = Math.max(0, height - insets.bottom - 12 - below);
  const roomAbove = rect ? Math.max(0, rect.y - 12 - insets.top - 8) : 0;
  const showBelow = roomBelow >= tipHeight || roomBelow >= roomAbove;
  const cardMaxHeight = showBelow ? roomBelow : roomAbove;
  const top = rect ? (showBelow ? below : rect.y - 12 - Math.min(tipHeight, cardMaxHeight)) : 0;
  return <Context.Provider value={value}>
    {children}
    {/* A toast over the page, not a card in it (owner, 19 Oct 2026, from
        the reference board): the guide's mark, a title and a line, the
        guide card's own Start pill, and a × to close. It used to be a line
        of text on the list cards' own fill with two text buttons, Start
        pushed left and Close floating mid-card, set 84pt up a phone with a
        home indicator: over the very switch that raised it. Now it sits
        on the floating bar's real height and Profile scrolls the switch
        above it. Its colours are the theme's: the sheets' ground, the
        accent's tint behind the mark, the guide card's gradient. */}
    {notice && <View ref={noticeRef} testID="guide-notice" accessibilityLiveRegion="polite"
      style={[s.notice, { bottom: lift + TAB_BAR_HEIGHT + 12 }]}
      onLayout={() => noticeRef.current?.measureInWindow((_x, y) => setNoticeTop(y))}>
      <View style={s.noticeMark}><Ionicons name="bulb-outline" size={20} color={colors.accent} /></View>
      <View style={s.noticeText}>
        <Text style={s.noticeTitle}>{notice === 'off'
          ? t('Guide turned off', 'Đã tắt hướng dẫn', 'ガイドをオフにしました', '新手引导已关闭', '新手引導已關閉')
          : t('Guide turned on', 'Đã bật hướng dẫn', 'ガイドをオンにしました', '新手引导已开启', '新手引導已開啟')}</Text>
        <Text style={s.noticeBody}>{notice === 'off'
          ? t('Turn it back on in Profile → Show guide.', 'Bật lại trong Hồ sơ → Hiện hướng dẫn.', 'プロフィール → ガイドを表示で再開できます。', '可在“个人主页 → 显示新手引导”中重新开启。', '可在「個人檔案 → 顯示新手引導」中重新開啟。')
          : t('Short tips will show you around the app.', 'Chúng tôi sẽ hiển thị gợi ý ngắn để bạn làm quen nhanh với các tính năng.', '短いヒントで主な機能をご案内します。', '简短的提示会带你熟悉应用。', '簡短的提示會帶你熟悉 App。')}</Text>
        {notice === 'ready' && <Pressable onPress={replay} accessibilityRole="button" testID="guide-notice-start" style={s.noticeStart}>
          <LinearGradient {...gradAI} style={s.nextFill}><Text style={s.nextText}>{t('Start', 'Bắt đầu', '開始', '开始', '開始')}</Text></LinearGradient>
        </Pressable>}
      </View>
      <Pressable onPress={() => setNotice(null)} accessibilityRole="button" accessibilityLabel={t('Close', 'Đóng', '閉じる', '关闭', '關閉')}
        hitSlop={4} style={s.noticeClose}>
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </Pressable>
    </View>}
    <Modal visible={step >= 0 && !!rect && owner === uid} transparent animationType="none" statusBarTranslucent onRequestClose={dismiss}
      onShow={() => AccessibilityInfo.announceForAccessibility(`${step + 1}/4. ${titles[step]}. ${descriptions[step]}`)}>
      <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityRole="button" accessibilityLabel={t('Close guide', 'Đóng hướng dẫn', 'ガイドを閉じる', '关闭新手引导', '關閉新手引導')} />
        {rect && <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path d={spotlight(width, height, rect)} fill={SCRIM} fillRule="evenodd" testID="signup-tour-scrim" />
        </Svg>}
        {rect && !still && <Animated.View testID="signup-tour-pulse" pointerEvents="none"
          style={[s.ring, { left: rect.x, top: rect.y, width: rect.width, height: rect.height },
            { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, PULSE_GROWTH] }) }] }]} />}
        {rect && <Pressable testID="signup-tour-target" accessibilityRole="button" accessibilityLabel={titles[step]}
          onPress={() => { const action = current.current?.press; persist(true, step + 1); finish(); if (action) requestAnimationFrame(action); }}
          style={[s.ring, { left: rect.x, top: rect.y, width: rect.width, height: rect.height }]} />}
        <View testID="signup-tour" style={[s.card, { left, top, width: cardWidth, maxHeight: cardMaxHeight }]}
          onLayout={e => setTipHeight(e.nativeEvent.layout.height)}>
          <ScrollView bounces={false}>
            {/* The count on the title's line, and no × (owner, 19 Oct 2026):
                the × had a 44pt row to itself, a quarter of a 185pt card,
                for a third way to close beside Skip and a tap outside. */}
            <View style={s.heading}>
              <Text style={s.count}>{step + 1}/4</Text>
              <Text style={s.title} accessibilityRole="header">{titles[step]}</Text>
            </View>
            <Text style={s.body}>{descriptions[step]}</Text>
            <View style={s.actions}>
              {step < 3 && <Pressable onPress={dismiss} accessibilityRole="button" style={s.skip}><Text style={s.skipText}>{t('Skip guide', 'Bỏ qua hướng dẫn', 'ガイドをスキップ', '跳过新手引导', '跳過新手引導')}</Text></Pressable>}
              <Pressable onPress={next} accessibilityRole="button" testID="signup-tour-next" style={s.next}>
                <LinearGradient {...gradAI} style={s.nextFill}><Text style={s.nextText}>{step === 3 ? t('Done', 'Hoàn tất', '完了', '完成', '完成') : t('Next', 'Tiếp theo', '次へ', '下一步', '下一步')}</Text></LinearGradient>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  </Context.Provider>;
}
const s = StyleSheet.create({
  // The page's own margins, so the toast lines up with the cards under it.
  notice: {
    position: 'absolute', zIndex: 100, left: space.page, right: space.page,
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, paddingLeft: 14, paddingRight: 4,
    backgroundColor: colors.bgElevated, borderColor: colors.borderGlassSoft, borderWidth: 1, borderRadius: radius.card,
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  noticeMark: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  noticeText: { flex: 1, gap: 2, paddingTop: 1 },
  noticeTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: font.semibold },
  noticeBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  noticeStart: { alignSelf: 'flex-start', marginTop: 10, borderRadius: radius.pill, overflow: 'hidden' },
  // 40pt, and 4 of slop each side, for the 44pt a finger needs.
  noticeClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginTop: -8 },
  ring: { position: 'absolute', borderWidth: 2, borderColor: colors.accent, borderRadius: radius.pill },
  card: { position: 'absolute', backgroundColor: colors.surfaceCard, borderColor: colors.borderGlassSoft, borderWidth: 1, borderRadius: radius.card, padding: 16 },
  heading: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 6 },
  count: { color: colors.accent, fontSize: 13, fontWeight: font.semibold },
  title: { flexShrink: 1, color: colors.text, fontSize: 18, fontWeight: font.semibold },
  body: { color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  skip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4, marginRight: 'auto' },
  skipText: { color: colors.textSecondary, fontSize: 13 },
  next: { borderRadius: radius.pill, overflow: 'hidden' },
  nextFill: { minHeight: 44, paddingHorizontal: 18, justifyContent: 'center' },
  nextText: { color: colors.accentInk, fontSize: 14, fontWeight: font.semibold },
});
