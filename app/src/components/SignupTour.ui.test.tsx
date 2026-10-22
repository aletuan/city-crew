// @vitest-environment jsdom
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AccessibilityInfo, Animated, type View } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '../uitest/render';
import { SignupTourProvider, useSignupTour, useTourAnchor } from './SignupTour';
const state = vi.hoisted(() => ({ uid: 'new', route: 'ExploreHome', offscreen: false, y: 60, anchors: true, x: 40, w: 40, h: 40, duplicate: false, focused: true, bottom: 0, readings: [] as number[] }));
// A home indicator to measure against: the setup's insets are all zero.
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: state.bottom, left: 0, right: 0 }),
}));
vi.mock('../lib/auth', () => {
  const m = { useAuth: () => ({ session: state.uid ? { user: { id: state.uid } } : null }) };
  const all = () => (m as { useAuth: () => object }).useAuth();
  return { ...m, useSession: all, useProfile: all, useAuthActions: all, useAuthEvent: () => {} };
});
vi.mock('../lib/i18n', () => ({ useI18n: () => ({ t: (_en: string, vi: string) => vi }) }));
vi.mock('react-native', async orig => ({ ...(await orig<Record<string, unknown>>()), useWindowDimensions: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }) }));
const pressed = vi.fn();
const getRoute = () => state.route;
function Anchor({ id }: { id: 'search' | 'filter' | 'save' | 'collections' }) {
  // The collections tab rings as the tab bar asks: in from its box above
  // and below, out by nothing at the sides.
  const ref = useTourAnchor(id, pressed, id === 'search' ? () => state.focused : undefined,
    id === 'collections' ? { x: 0, y: -4 } : undefined);
  useEffect(() => {
    ref.current = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(state.x, state.offscreen ? -50 : state.readings.shift() ?? state.y, state.w, state.h) } as unknown as View;
  }, [ref]);
  return null;
}
function Controls() {
  const tour = useSignupTour();
  return <><button onClick={() => tour.start(state.uid)}>Start</button>
    <button onClick={() => tour.setEnabled(true)}>Enable</button><button onClick={() => tour.setEnabled(false)}>Disable</button>
    <button onClick={tour.replay}>Replay</button><span data-testid="enabled">{String(tour.enabled)}</span><span data-testid="notice-top">{String(tour.noticeTop)}</span>
    {state.anchors && <><Anchor id="search" /><Anchor id="filter" /><Anchor id="save" /><Anchor id="collections" />{state.duplicate && <Anchor id="search" />}</>}</>;
}
const onReplay = vi.fn();
const tree = () => <SignupTourProvider onReplay={onReplay} getRoute={getRoute}><Controls /></SignupTourProvider>;
beforeEach(async () => { for (const id of ['new', 'recreated', 'guest']) await AsyncStorage.removeItem(`highlight.v1:${id}`); onReplay.mockClear(); state.uid = 'new'; state.route = 'ExploreHome'; state.offscreen = false; state.y = 60; state.anchors = true; state.x = 40; state.w = 40; state.h = 40; state.duplicate = false; state.focused = true; state.bottom = 0; state.readings = []; pressed.mockClear(); });
const start = async () => { fireEvent.click(screen.getByText('Start')); await screen.findByText('1/4'); };
it('does not start on sign-in; runs four steps and finishes without a skip on the last step', async () => {
  render(tree()); expect(screen.queryByTestId('signup-tour')).toBeNull();
  await start();
  expect(screen.getByText('Tìm hoặc bổ sung địa điểm bạn thích')).toBeTruthy();
  fireEvent.click(screen.getByText('Tiếp theo'));
  await screen.findByText('2/4');
  state.route = 'PlaceDetail';
  fireEvent.click(screen.getByText('Tiếp theo'));
  await screen.findByText('3/4');
  // Step 4's target is the collections tab in the floating bar, there on
  // the place's page too: Next must not need a way back to Explore.
  fireEvent.click(screen.getByText('Tiếp theo'));
  await screen.findByText('4/4');
  expect(screen.queryByText('Bỏ qua hướng dẫn')).toBeNull();
  fireEvent.click(screen.getByText('Hoàn tất'));
  await waitFor(() => expect(screen.queryByTestId('signup-tour')).toBeNull());
  fireEvent.click(screen.getByText('Start'));
  expect(screen.queryByTestId('signup-tour')).toBeNull();
  expect(pressed).not.toHaveBeenCalled();
  await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem('highlight.v1:new'))!)).toMatchObject({ enabled: true, progress: 4 }));
});
// The floating bar sits partly inside the home indicator's inset, so its
// tab must count as on screen there; a bar ducked below the edge must not.
it('rings the collections tab inside the bottom inset, but not once it has slid away', async () => {
  state.bottom = 34;
  render(tree()); await start();
  fireEvent.click(screen.getByText('Tiếp theo')); await screen.findByText('2/4');
  state.route = 'PlaceDetail';
  fireEvent.click(screen.getByText('Tiếp theo')); await screen.findByText('3/4');
  state.y = 844 - 16 - 40; // foot at 828, inside the 810 the inset leaves
  fireEvent.click(screen.getByText('Tiếp theo'));
  await screen.findByText('4/4');
  state.y = 850; // ducked: below the screen's edge
  await waitFor(() => expect(screen.queryByTestId('signup-tour')).toBeNull());
});
// The compact card (owner, 19 Oct 2026): the count on the title's line,
// no × row, and a light scrim so the ring and the card lead.
it('keeps the count beside the title, with no close button of its own, over a light scrim', async () => {
  render(tree()); await start();
  expect(screen.getByText('1/4').parentElement).toBe(screen.getByText('Tìm nơi bạn muốn đến').parentElement);
  expect(screen.queryByText('×')).toBeNull();
  expect(screen.getAllByLabelText('Đóng hướng dẫn')).toHaveLength(1);
  expect(screen.getByTestId('signup-tour-scrim').getAttribute('fill')).toBe('rgba(6,5,8,0.25)');
});
// The spotlight (owner, 22 Oct 2026): the scrim is the screen with the
// ring's shape cut out of it, so the control the step is about is the one
// thing left bright. The hole has the ring's round ends: a circle round
// the 48pt search ring, a capsule round the tab's 40×32.
it('cuts the ring’s shape out of the scrim, and follows it from step to step', async () => {
  render(tree()); await start();
  const scrim = () => screen.getByTestId('signup-tour-scrim');
  expect(scrim().getAttribute('fill-rule')).toBe('evenodd');
  expect(scrim().getAttribute('d')).toBe(
    'M0 0H390V844H0Z'
    + 'M60 56H60A24 24 0 0 1 84 80V80A24 24 0 0 1 60 104H60A24 24 0 0 1 36 80V80A24 24 0 0 1 60 56Z',
  );
  fireEvent.click(screen.getByText('Tiếp theo')); await screen.findByText('2/4');
  state.route = 'PlaceDetail';
  fireEvent.click(screen.getByText('Tiếp theo')); await screen.findByText('3/4');
  fireEvent.click(screen.getByText('Tiếp theo')); await screen.findByText('4/4');
  expect(scrim().getAttribute('d')).toBe(
    'M0 0H390V844H0Z'
    + 'M56 64H64A16 16 0 0 1 80 80V80A16 16 0 0 1 64 96H56A16 16 0 0 1 40 80V80A16 16 0 0 1 56 64Z',
  );
  // A tap in the hole is the ring's, not the scrim's.
  fireEvent.click(screen.getByTestId('signup-tour-target'));
  await waitFor(() => expect(pressed).toHaveBeenCalledOnce());
});
// The pulse (owner, 22 Oct 2026): a second ring grows out of the first
// and fades, three times, and stops inside the five seconds after which
// WCAG 2.2.2 asks that motion can be paused.
it('pulses the ring three times and stops inside five seconds', async () => {
  const loop = vi.spyOn(Animated, 'loop');
  const timing = vi.spyOn(Animated, 'timing');
  const delay = vi.spyOn(Animated, 'delay');
  render(tree()); await start();
  const pulse = screen.getByTestId('signup-tour-pulse');
  const ring = screen.getByTestId('signup-tour-target');
  // The ring's own place and size, under it.
  for (const k of ['left', 'top', 'width', 'height'] as const) expect(pulse.style[k]).toBe(ring.style[k]);
  expect(pulse.compareDocumentPosition(ring) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await waitFor(() => expect(loop).toHaveBeenCalled());
  const iterations = loop.mock.calls.at(-1)![1]!.iterations!;
  const out = (timing.mock.calls.at(-1)![1] as { duration: number }).duration;
  const rest = delay.mock.calls.at(-1)![0];
  expect(iterations).toBe(3);
  expect(iterations * (out + rest)).toBeLessThanOrEqual(5000);
  loop.mockRestore(); timing.mockRestore(); delay.mockRestore();
});
// Reduce Motion: no pulse. The cut-out and the ring already say where.
it('draws no pulse for a reader who asked for less motion', async () => {
  const reduce = vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  const loop = vi.spyOn(Animated, 'loop');
  render(tree()); await start();
  await waitFor(() => expect(screen.queryByTestId('signup-tour-pulse')).toBeNull());
  expect(screen.getByTestId('signup-tour-scrim')).toBeTruthy();
  expect(loop.mock.calls.filter(([, cfg]) => cfg?.iterations === 3)).toHaveLength(0);
  reduce.mockRestore(); loop.mockRestore();
});
it('skips the entire guide and does not reopen for the same account', async () => {
  render(tree()); await start();
  fireEvent.click(screen.getByText('Bỏ qua hướng dẫn'));
  fireEvent.click(screen.getByText('Start'));
  await waitFor(() => expect(screen.queryByTestId('signup-tour')).toBeNull());
});
it('activates the actual target only on an explicit target press', async () => {
  render(tree()); await start(); fireEvent.click(screen.getByTestId('signup-tour-target'));
  await waitFor(() => expect(pressed).toHaveBeenCalledOnce());
  await waitFor(() => expect(screen.queryByTestId('signup-tour')).toBeNull());
});
it('hides on unrelated routes, offscreen targets, and account changes', async () => {
  const view = render(tree()); await start();
  state.route = 'Search';
  await waitFor(() => expect(screen.queryByTestId('signup-tour')).toBeNull());
  state.route = 'ExploreHome'; state.offscreen = true;
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)); });
  expect(screen.queryByTestId('signup-tour')).toBeNull();
  state.offscreen = false;
  await screen.findByTestId('signup-tour');
  state.uid = ''; view.rerender(tree());
  await waitFor(() => expect(screen.queryByTestId('signup-tour')).toBeNull());
});

it('puts a long tooltip above a low target and closes through its dismiss control', async () => {
  state.y = 700;
  render(tree()); await start();
  const card = screen.getByTestId('signup-tour');
  type Fiber = { return: Fiber | null; memoizedProps: Record<string, unknown> };
  const key = Object.keys(card).find(k => k.startsWith('__reactFiber'))!;
  let f = (card as unknown as Record<string, Fiber>)[key];
  while (f && !(f.memoizedProps.testID === 'signup-tour' && typeof f.memoizedProps.onLayout === 'function')) f = f.return!;
  act(() => (f.memoizedProps.onLayout as (e: unknown) => void)({ nativeEvent: { layout: { height: 300 } } }));
  expect(parseFloat(card.style.top)).toBeLessThan(700);
  fireEvent.click(screen.getAllByLabelText('Đóng hướng dẫn').at(-1)!);
  await waitFor(() => expect(screen.queryByTestId('signup-tour')).toBeNull());
});
it('waits for a target instead of pointing at a missing control', async () => {
  state.anchors = false;
  const view = render(tree()); fireEvent.click(screen.getByText('Start'));
  expect(screen.queryByTestId('signup-tour')).toBeNull();
  state.anchors = true; view.rerender(tree());
  await screen.findByText('1/4');
});
it('is inert outside its provider', () => {
  function Outside() { useTourAnchor('search', pressed); const tour = useSignupTour(); return <button onClick={() => { tour.start('new'); tour.next(); tour.finish(); }}>Outside</button>; }
  render(<Outside />); fireEvent.click(screen.getByText('Outside'));
  expect(screen.queryByTestId('signup-tour')).toBeNull();
});

// A target still moving when its step begins: Explore scrolls the filter
// button up as step 2 opens, and the first reading catches it lower down.
// The card waits for two readings that agree, so it is first drawn where
// the button comes to rest, never where it was.
it('waits for a target to hold still before drawing the step', async () => {
  state.readings = [500, 300];
  render(tree()); fireEvent.click(screen.getByText('Start'));
  await screen.findByText('1/4');
  expect(screen.getByTestId('signup-tour-target').style.top).toBe('56px');
  expect(state.readings).toEqual([]);
});

it('tracks a moving or resizing control and handles both filter copies without stale geometry', async () => {
  state.duplicate = true;
  render(tree()); await start();
  const target = () => screen.getByTestId('signup-tour-target');
  state.x = 70; await waitFor(() => expect(target().style.left).toBe('66px'));
  state.y = 90; await waitFor(() => expect(target().style.top).toBe('86px'));
  state.w = 50; await waitFor(() => expect(target().style.width).toBe('58px'));
  state.h = 55; await waitFor(() => expect(target().style.height).toBe('63px'));
});

it('ignores controls retained in an unfocused native stack', async () => {
  state.focused = false;
  render(tree()); fireEvent.click(screen.getByText('Start'));
  expect(screen.queryByTestId('signup-tour')).toBeNull();
  state.focused = true;
  await screen.findByText('1/4');
});

const saved = async (uid = 'new') => JSON.parse((await AsyncStorage.getItem(`highlight.v1:${uid}`))!);
it('persists skipping across remounts, enables without navigating, and explicitly replays', async () => {
  const view = render(tree()); await start();
  fireEvent.click(screen.getByText('Bỏ qua hướng dẫn'));
  expect(screen.getByTestId('guide-notice').textContent).toContain('Hồ sơ → Hiện hướng dẫn');
  await waitFor(async () => expect((await saved()).enabled).toBe(false));
  view.unmount(); render(tree());
  await waitFor(() => expect(screen.getByTestId('enabled').textContent).toBe('false'));
  expect(screen.queryByTestId('signup-tour')).toBeNull();
  fireEvent.click(screen.getByText('Enable'));
  expect(onReplay).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Bắt đầu'));
  await screen.findByText('1/4'); expect(onReplay).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByText('Disable'));
  expect(screen.queryByTestId('signup-tour')).toBeNull();
  await waitFor(async () => expect((await saved()).enabled).toBe(false));
});
it('keeps enabled after acting on a real control and allows replay', async () => {
  render(tree()); await start();
  fireEvent.click(screen.getByTestId('signup-tour-target'));
  await waitFor(async () => expect(await saved()).toMatchObject({ enabled: true, progress: 1 }));
  fireEvent.click(screen.getByText('Replay')); await screen.findByText('1/4');
});
it('starts onboarding afresh for a recreated account, even on the same device', async () => {
  const view = render(tree()); await start();
  fireEvent.click(screen.getByText('Bỏ qua hướng dẫn'));
  await waitFor(async () => expect((await saved()).enabled).toBe(false));
  state.uid = ''; view.rerender(tree());
  state.uid = 'recreated'; view.rerender(tree());
  await waitFor(() => expect(screen.getByTestId('enabled').textContent).toBe('false'));
  await start();
  await waitFor(async () => expect(await saved('recreated')).toMatchObject({ enabled: true, progress: 0 }));
  expect((await saved()).enabled).toBe(false);
});
it('reads completed progress without automatically starting again', async () => {
  await AsyncStorage.setItem('highlight.v1:new', JSON.stringify({ enabled: true, progress: 4 }));
  render(tree());
  await waitFor(() => expect(screen.getByTestId('enabled').textContent).toBe('true'));
  expect(screen.queryByTestId('signup-tour')).toBeNull();
  fireEvent.click(screen.getByText('Replay')); await screen.findByText('1/4');
});
it('handles malformed or unavailable storage without starting guidance', async () => {
  await AsyncStorage.setItem('highlight.v1:new', '{broken');
  const view = render(tree());
  await waitFor(() => expect(screen.getByTestId('enabled').textContent).toBe('false'));
  view.unmount();
  vi.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('offline'));
  render(tree());
  await waitFor(() => expect(screen.getByTestId('enabled').textContent).toBe('false'));
});
it('ignores late storage reads after an explicit change or switching accounts', async () => {
  let resolve!: (value: string | null) => void;
  vi.spyOn(AsyncStorage, 'getItem').mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const view = render(tree());
  fireEvent.click(screen.getByText('Enable'));
  await act(async () => resolve(JSON.stringify({ enabled: false })));
  expect(screen.getByTestId('enabled').textContent).toBe('true');
  view.unmount();
  vi.spyOn(AsyncStorage, 'getItem').mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const other = render(tree());
  state.uid = 'recreated'; other.rerender(tree());
  await act(async () => resolve(JSON.stringify({ enabled: true })));
  await waitFor(() => expect(screen.getByTestId('enabled').textContent).toBe('false'));
});
it('keeps controls usable if saving fails and dismisses the invitation without starting', async () => {
  vi.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('storage full'));
  render(tree());
  fireEvent.click(screen.getByText('Enable'));
  await act(async () => {});
  expect(screen.getByTestId('enabled').textContent).toBe('true');
  fireEvent.click(screen.getByLabelText('Đóng'));
  expect(screen.queryByTestId('guide-notice')).toBeNull();
  expect(onReplay).not.toHaveBeenCalled();
});
// The invitation as a toast over the page (owner, 19 Oct 2026): the
// guide's mark, a title and a line, Start, and a ×, set on the floating
// bar's height: a 16pt lift under a 34pt inset, the 64pt bar, 12pt of air.
it('shows the invitation as a titled toast with Start and a close mark, on the tab bar', async () => {
  state.bottom = 34;
  render(tree());
  fireEvent.click(screen.getByText('Enable'));
  const toast = screen.getByTestId('guide-notice');
  expect(toast.textContent).toContain('Đã bật hướng dẫn');
  expect(toast.textContent).toContain('Chúng tôi sẽ hiển thị gợi ý ngắn');
  expect(toast.style.bottom).toBe('92px');
  expect(screen.getByTestId('guide-notice-start').textContent).toBe('Bắt đầu');
  expect(screen.queryByText('Đóng')).toBeNull();
  fireEvent.click(screen.getByLabelText('Đóng'));
  expect(screen.queryByTestId('guide-notice')).toBeNull();
});
// Profile reads the toast's top to lift the switch above it, so the top is
// the toast's own measured edge, and it goes when the toast does.
it('reports where the invitation sits, and forgets it once closed', async () => {
  render(tree());
  fireEvent.click(screen.getByText('Enable'));
  const toast = screen.getByTestId('guide-notice');
  toast.getBoundingClientRect = () => ({ top: 668, left: 22, width: 346, height: 92, right: 368, bottom: 760, x: 22, y: 668, toJSON: () => ({}) });
  type Fiber = { return: Fiber | null; memoizedProps: Record<string, unknown> };
  const key = Object.keys(toast).find(k => k.startsWith('__reactFiber'))!;
  let f = (toast as unknown as Record<string, Fiber>)[key];
  while (f && !(f.memoizedProps.testID === 'guide-notice' && typeof f.memoizedProps.onLayout === 'function')) f = f.return!;
  act(() => (f.memoizedProps.onLayout as (e: unknown) => void)({ nativeEvent: { layout: { height: 92 } } }));
  await waitFor(() => expect(screen.getByTestId('notice-top').textContent).toBe('668'));
  fireEvent.click(screen.getByLabelText('Đóng'));
  await waitFor(() => expect(screen.getByTestId('notice-top').textContent).toBe('null'));
});
it('says how to turn the guide back on, with no Start, once skipped', async () => {
  render(tree()); await start();
  fireEvent.click(screen.getByText('Bỏ qua hướng dẫn'));
  expect(screen.getByTestId('guide-notice').textContent).toContain('Đã tắt hướng dẫn');
  expect(screen.queryByTestId('guide-notice-start')).toBeNull();
});
it('expires the skip reminder without reopening the guide', async () => {
  vi.useFakeTimers();
  try {
    render(tree());
    await act(async () => {});
    fireEvent.click(screen.getByText('Start'));
    // The step is drawn once its target has held still for SETTLE_MS.
    await act(async () => { vi.advanceTimersByTime(100); });
    fireEvent.click(screen.getByText('Bỏ qua hướng dẫn'));
    expect(screen.getByTestId('guide-notice')).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(10000); });
    expect(screen.queryByTestId('guide-notice')).toBeNull();
    expect(screen.queryByTestId('signup-tour')).toBeNull();
  } finally { vi.useRealTimers(); }
});

// A control whose box is not its shape says where its ring goes: the tab
// bar's cell asks for the pill inside it. Every other control is ringed a
// little clear of its box, and the card keeps the same distance from
// either ring.
it('draws the ring where the control asks, and keeps the card as clear of it', async () => {
  render(tree()); await start();
  const target = () => screen.getByTestId('signup-tour-target');
  const card = () => screen.getByTestId('signup-tour');
  // Search: 4 clear of its 40×40 box at (40, 60), the card 12 below that.
  expect([target().style.left, target().style.top, target().style.width, target().style.height]).toEqual(['36px', '56px', '48px', '48px']);
  expect(card().style.top).toBe('116px');
  fireEvent.click(screen.getByText('Tiếp theo')); await screen.findByText('2/4');
  state.route = 'PlaceDetail';
  fireEvent.click(screen.getByText('Tiếp theo')); await screen.findByText('3/4');
  fireEvent.click(screen.getByText('Tiếp theo')); await screen.findByText('4/4');
  // Collections: the box's width, 4 in from its top and foot.
  expect([target().style.left, target().style.top, target().style.width, target().style.height]).toEqual(['40px', '64px', '40px', '32px']);
  expect(card().style.top).toBe('108px');
});
