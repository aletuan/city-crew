import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { colors, font, gradAI, radius } from '../theme';

type Target = 'search' | 'filter' | 'save' | 'collections';
type Anchor = { ref: React.RefObject<View | null>; press: () => void; focused: () => boolean };
type Rect = { x: number; y: number; width: number; height: number };
const targets: Target[] = ['search', 'filter', 'save', 'collections'];
const noop = () => {};
const always = () => true;
const Context = createContext({ step: -1, start: (_uid: string) => {}, finish: noop, next: noop,
  register: (_id: Target, _anchor: Anchor): (() => void) => noop });
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

/** Only the successful sign-up welcome screen can start this. Nothing is
 * inferred from a session appearing, so sign-in and app restarts never replay it. */
export function SignupTourProvider({ children, getRoute }: { children: React.ReactNode; getRoute: () => string | undefined }) {
  const { session } = useAuth();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [step, setStep] = useState(-1);
  const [owner, setOwner] = useState<string | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [tipHeight, setTipHeight] = useState(190);
  const anchors = useRef(new Map<Target, Set<Anchor>>());
  const current = useRef<Anchor | null>(null);
  const started = useRef(new Set<string>());
  const finish = useCallback(() => { setStep(-1); setRect(null); }, []);
  const next = useCallback(() => { setRect(null); setStep(s => s >= 3 ? -1 : s + 1); }, []);
  const start = useCallback((uid: string) => {
    if (started.current.has(uid)) return;
    started.current.add(uid); setOwner(uid); setStep(0);
  }, []);
  const register = useCallback((id: Target, anchor: Anchor) => {
    const entries = anchors.current.get(id) ?? new Set<Anchor>();
    entries.add(anchor); anchors.current.set(id, entries);
    return () => { entries.delete(anchor); };
  }, []);
  const uid = session?.user.id;
  useEffect(() => { if (owner && uid !== owner) finish(); }, [owner, uid, finish]);
  useEffect(() => {
    if (step < 0) return;
    let alive = true;
    // Re-measure while visible: scrolling, rotation, font size and the floating
    // tab bar can move the actual target. Never leave a ring at an old position.
    const measure = () => {
      const route = getRoute();
      const expected = step === 2 ? 'PlaceDetail' : 'ExploreHome';
      if (route !== expected) { setRect(null); return; }
      const entries = [...(anchors.current.get(targets[step]) ?? [])].filter(a => a.ref.current && a.focused());
      let remaining = entries.length;
      let candidate: { anchor: Anchor; rect: Rect } | null = null;
      if (!remaining) { setRect(null); return; }
      entries.forEach(anchor => anchor.ref.current!.measureInWindow((x, y, w, h) => {
        if (!alive) return;
        if (w > 0 && h > 0 && x >= 0 && y >= insets.top && x + w <= width && y + h <= height - insets.bottom) {
          candidate = { anchor, rect: { x, y, width: w, height: h } };
        }
        remaining -= 1;
        if (remaining) return;
        current.current = candidate?.anchor ?? null;
        const measured = candidate?.rect ?? null;
        setRect(old => old && measured && old.x === measured.x && old.y === measured.y
          && old.width === measured.width && old.height === measured.height ? old : measured);
      }));
    };
    measure(); const timer = setInterval(measure, 250);
    return () => { alive = false; clearInterval(timer); };
  }, [step, width, height, insets.top, insets.bottom, getRoute]);
  const value = useMemo(() => ({ step, start, finish, next, register }), [step, start, finish, next, register]);
  const titles = [t('Find a place', 'Tìm nơi bạn muốn đến', '行きたい場所を探す'),
    t('Filter and sort', 'Lọc và sắp xếp', '絞り込み・並べ替え'),
    t('Save places you love', 'Lưu nơi bạn thích', '好きな場所を保存'),
    t('Your collections', 'Bộ sưu tập của bạn', 'あなたのコレクション')];
  const descriptions = [t('Find or add a place you like', 'Tìm hoặc bổ sung địa điểm bạn thích', '好きな場所を探したり追加したりできます'),
    t('Adjust filters to find places that suit you.', 'Điều chỉnh bộ lọc để tìm địa điểm phù hợp hơn.', 'フィルターで自分に合った場所を探しましょう。'),
    t('Add a place to a collection to find it again easily.', 'Thêm địa điểm vào bộ sưu tập để dễ tìm lại.', '場所をコレクションに保存して、あとで簡単に見つけましょう。'),
    t('Find your saved places here.', 'Những địa điểm bạn đã lưu nằm ở đây.', '保存した場所はこちらにあります。')];
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
    <Modal visible={step >= 0 && !!rect && owner === uid} transparent animationType="none" statusBarTranslucent onRequestClose={finish}
      onShow={() => AccessibilityInfo.announceForAccessibility(`${step + 1}/4. ${titles[step]}. ${descriptions[step]}`)}>
      <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
        <Pressable style={StyleSheet.absoluteFill} onPress={finish} accessibilityLabel={t('Close guide', 'Đóng hướng dẫn', 'ガイドを閉じる')} />
        {rect && <Pressable testID="signup-tour-target" accessibilityRole="button" accessibilityLabel={titles[step]}
          onPress={() => { const action = current.current?.press; finish(); if (action) requestAnimationFrame(action); }}
          style={[s.ring, { left: rect.x - 4, top: rect.y - 4, width: rect.width + 8, height: rect.height + 8 }]} />}
        <View testID="signup-tour" style={[s.card, { left, top, width: cardWidth, maxHeight: cardMaxHeight }]}
          onLayout={e => setTipHeight(e.nativeEvent.layout.height)}>
          <ScrollView bounces={false}>
            <View style={s.heading}>
              <Text style={s.count}>{step + 1}/4</Text>
              <Pressable onPress={finish} accessibilityRole="button" accessibilityLabel={t('Close guide', 'Đóng hướng dẫn', 'ガイドを閉じる')} style={s.close}><Text style={s.closeText}>×</Text></Pressable>
            </View>
            <Text style={s.title} accessibilityRole="header">{titles[step]}</Text>
            <Text style={s.body}>{descriptions[step]}</Text>
            <View style={s.actions}>
              {step < 3 && <Pressable onPress={finish} accessibilityRole="button" style={s.skip}><Text style={s.skipText}>{t('Skip guide', 'Bỏ qua hướng dẫn', 'ガイドをスキップ')}</Text></Pressable>}
              <Pressable onPress={next} accessibilityRole="button" testID="signup-tour-next" style={s.next}>
                <LinearGradient {...gradAI} style={s.nextFill}><Text style={s.nextText}>{step === 3 ? t('Done', 'Hoàn tất', '完了') : t('Next', 'Tiếp theo', '次へ')}</Text></LinearGradient>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  </Context.Provider>;
}
const s = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 2, borderColor: colors.accent, borderRadius: radius.pill },
  card: { position: 'absolute', backgroundColor: colors.surfaceCard, borderColor: colors.borderGlassSoft, borderWidth: 1, borderRadius: radius.card, padding: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { color: colors.accent, fontSize: 13, fontWeight: font.semibold },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.textSecondary, fontSize: 26 },
  title: { color: colors.text, fontSize: 18, fontWeight: font.semibold, marginBottom: 8 },
  body: { color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  skip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4, marginRight: 'auto' },
  skipText: { color: colors.textSecondary, fontSize: 13 },
  next: { borderRadius: radius.pill, overflow: 'hidden' },
  nextFill: { minHeight: 44, paddingHorizontal: 18, justifyContent: 'center' },
  nextText: { color: colors.accentInk, fontSize: 14, fontWeight: font.semibold },
});
