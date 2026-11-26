// @vitest-environment jsdom
//
// The camera follows a selection it did not make: not when the pin is in
// view, not before the map has said where it is, and at the glide's length
// otherwise. Where it goes to is `lib/mapPan.test.ts`.
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '../uitest/render';
import { useKeepInView } from './mapKeepInView';

const region = { latitude: 10, longitude: 106, latitudeDelta: 0.08, longitudeDelta: 0.04 };
const pad = { top: 20, right: 40, bottom: 200, left: 40 };
const layout = { nativeEvent: { layout: { width: 400, height: 800 } } };
const pins = new Map([
  ['in', { lat: 10, lng: 106 }],
  ['out', { lat: 10, lng: 106.03 }],   // 300 points right of the middle
]);

function mount(selected: string | null, still = false, told = { region: true, box: true }) {
  const animateCamera = vi.fn();
  const setSpan = vi.fn();
  const onLayout = vi.fn();
  const view = renderHook(({ s }) => useKeepInView({ current: { animateCamera } }, s, pins, pad, still, setSpan, onLayout),
    { initialProps: { s: selected } });
  if (told.box) view.result.current.onLayout(layout as never);
  if (told.region) view.result.current.onRegionChangeComplete(region);
  return { animateCamera, setSpan, onLayout, view };
}

describe('useKeepInView', () => {
  it('passes the map\'s layout and its span on to those who keep them', () => {
    const { setSpan, onLayout } = mount(null);
    expect(onLayout).toHaveBeenCalledWith(layout);
    expect(setSpan).toHaveBeenCalledWith({ latitudeDelta: 0.08, longitudeDelta: 0.04 });
  });

  it('glides to a selection that is out of view, keeping the zoom', () => {
    const { animateCamera, view } = mount(null);
    view.rerender({ s: 'out' });
    expect(animateCamera).toHaveBeenCalledOnce();
    const [cam, opts] = animateCamera.mock.calls[0];
    expect(cam.center.longitude).toBeGreaterThan(106);
    expect(cam.zoom).toBeUndefined();
    expect(opts).toEqual({ duration: 300 });
  });

  it('jumps, for a reader who asked for no motion', () => {
    const { animateCamera, view } = mount(null, true);
    view.rerender({ s: 'out' });
    expect(animateCamera.mock.calls[0][1]).toEqual({ duration: 0 });
  });

  it('leaves a selection in view alone', () => {
    const { animateCamera, view } = mount(null);
    view.rerender({ s: 'in' });
    expect(animateCamera).not.toHaveBeenCalled();
  });

  it('does nothing for no selection, an unknown pin, or before the map has reported', () => {
    const a = mount(null);
    a.view.rerender({ s: null });
    a.view.rerender({ s: 'ghost' });
    expect(a.animateCamera).not.toHaveBeenCalled();
    const b = mount(null, false, { region: false, box: true });
    b.view.rerender({ s: 'out' });
    expect(b.animateCamera).not.toHaveBeenCalled();
    const c = mount(null, false, { region: true, box: false });
    c.view.rerender({ s: 'out' });
    expect(c.animateCamera).not.toHaveBeenCalled();
  });
});
