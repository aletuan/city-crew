// @vitest-environment jsdom
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { View } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '../uitest/render';
import { SignupTourProvider, useSignupTour, useTourAnchor } from './SignupTour';
const state = vi.hoisted(() => ({ uid: 'new', route: 'ExploreHome', offscreen: false, y: 60, anchors: true, x: 40, w: 40, h: 40, duplicate: false, focused: true }));
vi.mock('../lib/auth', () => ({ useAuth: () => ({ session: state.uid ? { user: { id: state.uid } } : null }) }));
vi.mock('../lib/i18n', () => ({ useI18n: () => ({ t: (_en: string, vi: string) => vi }) }));
vi.mock('react-native', async orig => ({ ...(await orig<Record<string, unknown>>()), useWindowDimensions: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }) }));
const pressed = vi.fn();
const getRoute = () => state.route;
function Anchor({ id }: { id: 'search' | 'filter' | 'save' | 'collections' }) {
  const ref = useTourAnchor(id, pressed, id === 'search' ? () => state.focused : undefined);
  useEffect(() => {
    ref.current = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(state.x, state.offscreen ? -50 : state.y, state.w, state.h) } as unknown as View;
  }, [ref]);
  return null;
}
function Controls() {
  const tour = useSignupTour();
  return <><button onClick={() => tour.start(state.uid)}>Start</button>
    <button onClick={() => tour.setEnabled(true)}>Enable</button><button onClick={() => tour.setEnabled(false)}>Disable</button>
    <button onClick={tour.replay}>Replay</button><span data-testid="enabled">{String(tour.enabled)}</span>
    {state.anchors && <><Anchor id="search" /><Anchor id="filter" /><Anchor id="save" /><Anchor id="collections" />{state.duplicate && <Anchor id="search" />}</>}</>;
}
const onReplay = vi.fn();
const tree = () => <SignupTourProvider onReplay={onReplay} getRoute={getRoute}><Controls /></SignupTourProvider>;
beforeEach(async () => { for (const id of ['new', 'recreated', 'guest']) await AsyncStorage.removeItem(`highlight.v1:${id}`); onReplay.mockClear(); state.uid = 'new'; state.route = 'ExploreHome'; state.offscreen = false; state.y = 60; state.anchors = true; state.x = 40; state.w = 40; state.h = 40; state.duplicate = false; state.focused = true; pressed.mockClear(); });
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
  state.route = 'ExploreHome';
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
  fireEvent.click(screen.getByText('Đóng'));
  expect(screen.queryByTestId('guide-notice')).toBeNull();
  expect(onReplay).not.toHaveBeenCalled();
});
it('expires the skip reminder without reopening the guide', async () => {
  vi.useFakeTimers();
  try {
    render(tree());
    await act(async () => {});
    fireEvent.click(screen.getByText('Start'));
    fireEvent.click(screen.getByText('Bỏ qua hướng dẫn'));
    expect(screen.getByTestId('guide-notice')).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(10000); });
    expect(screen.queryByTestId('guide-notice')).toBeNull();
    expect(screen.queryByTestId('signup-tour')).toBeNull();
  } finally { vi.useRealTimers(); }
});
