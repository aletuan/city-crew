// @vitest-environment jsdom
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
    {state.anchors && <><Anchor id="search" /><Anchor id="filter" /><Anchor id="save" /><Anchor id="collections" />{state.duplicate && <Anchor id="search" />}</>}</>;
}
const tree = () => <SignupTourProvider getRoute={getRoute}><Controls /></SignupTourProvider>;
beforeEach(() => { state.uid = 'new'; state.route = 'ExploreHome'; state.offscreen = false; state.y = 60; state.anchors = true; state.x = 40; state.w = 40; state.h = 40; state.duplicate = false; state.focused = true; pressed.mockClear(); });
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
