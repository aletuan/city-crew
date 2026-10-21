import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSession } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { colors, font, gradAI, radius, space } from '../theme';
import { TAB_BAR_HEIGHT, useTabBarLift } from './ui';

type Target = 'search' | 'filter' | 'save' | 'collections';
type Anchor = { ref: React.RefObject<View | null>; press: () => void; focused: () => boolean };
type Rect = { x: number; y: number; width: number; height: number };
const targets: Target[] = ['search', 'filter', 'save', 'collections'];
const noop = () => {};
const always = () => true;
const same = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
/** Two readings this far apart must agree before a step is drawn. Long
 *  enough to see a native stack push still moving (it lasts about 350ms,
 *  so two readings inside it differ) and for a scroll asked for without
 *  animation to have landed; short enough that the wait is not felt. */
const SETTLE_MS = 100;
type Notice = 'off' | 'ready';
const Context = createContext({ enabled: null as boolean | null, setEnabled: (_on: boolean) => {}, replay: noop, step: -1, start: (_uid: string) => {}, finish: noop, next: noop,
  register: (_id: Target, _anchor: Anchor): (() => void) => noop, notice: null as Notice | null, noticeTop: null as number | null });
export const useSignupTour = () => useContext(Context);

/** Attach to the real control, without inserting a view into its layout. */
export function useTourAnchor(id: Target, press: () => void, focused: () => boolean = always) {
  const { register } = useSignupTour();
  const ref = useRef<View>(null);
  const action = useRef(press);
  action.current = press;
  const active = useRef(focused);
  active.current = focused;
  useEffect(() => register(id, { ref, press: () => action.current(), focused: () => active.current() }), [id, register]);
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
      ? t('Guide turned off. Enable it in Profile → Show guide.', 'Đã tắt hướng dẫn. Bạn có thể bật lại trong Hồ sơ → Hiện hướng dẫn.', 'ガイドをオフにしました。プロフィール → ガイドを表示で再開できます。', '新手引导已关闭。可在“个人主页 → 显示新手引导”中重新开启。')
      : t('Guide enabled. Start whenever you are ready.', 'Đã bật hướng dẫn. Bắt đầu khi bạn sẵn sàng.', 'ガイドをオンにしました。準備ができたら開始できます。', '新手引导已开启，准备好后随时开始。'));
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
          candidate = { anchor, rect: { x, y, width: w, height: h } };
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
  const titles = [t('Find a place', 'Tìm nơi bạn muốn đến', '行きたい場所を探す', '寻找地点'),
    t('Filter and sort', 'Lọc và sắp xếp', '絞り込み・並べ替え', '筛选和排序'),
    t('Save places you love', 'Lưu nơi bạn thích', '好きな場所を保存', '保存喜欢的地点'),
    t('Your collections', 'Bộ sưu tập của bạn', 'あなたのコレクション', '你的合集')];
  const descriptions = [t('Find or add a place you like', 'Tìm hoặc bổ sung địa điểm bạn thích', '好きな場所を探したり追加したりできます', '寻找或添加你喜欢的地点'),
    t('Adjust filters to find places that suit you.', 'Điều chỉnh bộ lọc để tìm địa điểm phù hợp hơn.', 'フィルターで自分に合った場所を探しましょう。', '调整筛选条件，找到适合你的地点。'),
    t('Add a place to a collection to find it again easily.', 'Thêm địa điểm vào bộ sưu tập để dễ tìm lại.', '場所をコレクションに保存して、あとで簡単に見つけましょう。', '把地点加入合集，之后就能轻松找到。'),
    t('Find your saved places here.', 'Những địa điểm bạn đã lưu nằm ở đây.', '保存した場所はこちらにあります。', '你保存的地点都在这里。')];
  const cardWidth = Math.min(width - 32, 340);
  const left = rect ? Math.max(16, Math.min(rect.x + rect.width / 2 - cardWidth / 2, width - cardWidth - 16)) : 16;
  const below = rect ? rect.y + rect.height + 16 : 0;
  const roomBelow = Math.max(0, height - insets.bottom - 12 - below);
  const roomAbove = rect ? Math.max(0, rect.y - 16 - insets.top - 8) : 0;
  const showBelow = roomBelow >= tipHeight || roomBelow >= roomAbove;
  const cardMaxHeight = showBelow ? roomBelow : roomAbove;
  const top = rect ? (showBelow ? below : rect.y - 16 - Math.min(tipHeight, cardMaxHeight)) : 0;
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
          ? t('Guide turned off', 'Đã tắt hướng dẫn', 'ガイドをオフにしました', '新手引导已关闭')
          : t('Guide turned on', 'Đã bật hướng dẫn', 'ガイドをオンにしました', '新手引导已开启')}</Text>
        <Text style={s.noticeBody}>{notice === 'off'
          ? t('Turn it back on in Profile → Show guide.', 'Bật lại trong Hồ sơ → Hiện hướng dẫn.', 'プロフィール → ガイドを表示で再開できます。', '可在“个人主页 → 显示新手引导”中重新开启。')
          : t('Short tips will show you around the app.', 'Chúng tôi sẽ hiển thị gợi ý ngắn để bạn làm quen nhanh với các tính năng.', '短いヒントで主な機能をご案内します。', '简短的提示会带你熟悉应用。')}</Text>
        {notice === 'ready' && <Pressable onPress={replay} accessibilityRole="button" testID="guide-notice-start" style={s.noticeStart}>
          <LinearGradient {...gradAI} style={s.nextFill}><Text style={s.nextText}>{t('Start', 'Bắt đầu', '開始', '开始')}</Text></LinearGradient>
        </Pressable>}
      </View>
      <Pressable onPress={() => setNotice(null)} accessibilityRole="button" accessibilityLabel={t('Close', 'Đóng', '閉じる', '关闭')}
        hitSlop={4} style={s.noticeClose}>
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </Pressable>
    </View>}
    <Modal visible={step >= 0 && !!rect && owner === uid} transparent animationType="none" statusBarTranslucent onRequestClose={dismiss}
      onShow={() => AccessibilityInfo.announceForAccessibility(`${step + 1}/4. ${titles[step]}. ${descriptions[step]}`)}>
      <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
        <Pressable style={[StyleSheet.absoluteFill, s.scrim]} onPress={dismiss} accessibilityRole="button" accessibilityLabel={t('Close guide', 'Đóng hướng dẫn', 'ガイドを閉じる', '关闭新手引导')} />
        {rect && <Pressable testID="signup-tour-target" accessibilityRole="button" accessibilityLabel={titles[step]}
          onPress={() => { const action = current.current?.press; persist(true, step + 1); finish(); if (action) requestAnimationFrame(action); }}
          style={[s.ring, { left: rect.x - 4, top: rect.y - 4, width: rect.width + 8, height: rect.height + 8 }]} />}
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
              {step < 3 && <Pressable onPress={dismiss} accessibilityRole="button" style={s.skip}><Text style={s.skipText}>{t('Skip guide', 'Bỏ qua hướng dẫn', 'ガイドをスキップ', '跳过新手引导')}</Text></Pressable>}
              <Pressable onPress={next} accessibilityRole="button" testID="signup-tour-next" style={s.next}>
                <LinearGradient {...gradAI} style={s.nextFill}><Text style={s.nextText}>{step === 3 ? t('Done', 'Hoàn tất', '完了', '完成') : t('Next', 'Tiếp theo', '次へ', '下一步')}</Text></LinearGradient>
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
  // Light enough that the page still reads as the place being shown; dark
  // enough that the card and the ring are what the eye lands on.
  scrim: { backgroundColor: 'rgba(6,5,8,0.25)' },
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
