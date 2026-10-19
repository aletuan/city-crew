// @vitest-environment jsdom
import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { act, render } from '../uitest/render';

const state = vi.hoisted(() => ({ scheme: 'light', focused: true }));
const setStyle = vi.hoisted(() => vi.fn());
const listeners = new Map<string, () => void>();
vi.mock('expo-status-bar', () => ({ setStatusBarStyle: setStyle }));
vi.mock('../lib/theme', () => ({ useScheme: () => state }));
const navigation = {
  isFocused: () => state.focused,
  addListener: (event: string, fn: () => void) => {
    listeners.set(event, fn);
    return () => { listeners.delete(event); };
  },
};
vi.mock('@react-navigation/native', () => ({ useNavigation: () => navigation }));
import { AppStatusBar, useOwnedStatusBar } from './ui/surfaces';
let apply: () => void;
function Photo({ photo = true }: { photo?: boolean }) {
  const update = useOwnedStatusBar(() => photo ? 'light' : null);
  React.useEffect(() => { apply = update; }, [update]);
  return null;
}
beforeEach(() => { state.scheme = 'light'; state.focused = true; setStyle.mockClear(); });

it('keeps white ink when the app default mounts after an already focused photo', () => {
  const view = render(<><Photo /><AppStatusBar /></>);
  expect(setStyle).toHaveBeenLastCalledWith('light', true);
  state.scheme = 'dark';
  view.rerender(<><Photo /><AppStatusBar /></>);
  state.scheme = 'light';
  view.rerender(<><Photo /><AppStatusBar /></>);
  expect(setStyle).toHaveBeenLastCalledWith('light', true);
  view.rerender(<><Photo photo={false} /><AppStatusBar /></>);
  act(() => apply());
  expect(setStyle).toHaveBeenLastCalledWith('dark', true);
});

it('uses the theme without an owner and releases an unmounted photo', () => {
  const view = render(<><AppStatusBar /><Photo /></>);
  expect(setStyle).toHaveBeenLastCalledWith('light', true);
  view.rerender(<AppStatusBar />);
  expect(setStyle).toHaveBeenLastCalledWith('dark', true);
  state.scheme = 'dark';
  view.rerender(<AppStatusBar />);
  expect(setStyle).toHaveBeenLastCalledWith('light', true);
});

it('ignores scroll on a blurred screen, then restores its ink on focus', () => {
  state.focused = false;
  render(<><AppStatusBar /><Photo /></>);
  expect(setStyle).toHaveBeenLastCalledWith('dark', true);
  act(() => listeners.get('focus')!());
  expect(setStyle).toHaveBeenLastCalledWith('light', true);
  act(() => listeners.get('blur')!());
  expect(setStyle).toHaveBeenLastCalledWith('dark', true);
  setStyle.mockClear();
  act(() => apply());
  expect(setStyle).not.toHaveBeenCalled();
});

it('does not let a late blur or cleanup overwrite the next focused photo', () => {
  const first = render(<Photo photo={false} />);
  const lateBlur = listeners.get('blur')!;
  const oldApply = apply;
  const second = render(<Photo />);
  expect(setStyle).toHaveBeenLastCalledWith('light', true);
  setStyle.mockClear();
  act(() => { lateBlur(); oldApply(); });
  first.unmount();
  expect(setStyle).not.toHaveBeenCalled();
  second.unmount();
  expect(setStyle).toHaveBeenLastCalledWith('dark', true);
});
