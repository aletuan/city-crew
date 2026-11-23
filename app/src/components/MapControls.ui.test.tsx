// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '../uitest/render';
import MapControls from './MapControls';

const camera = { getCamera: vi.fn(), animateCamera: vi.fn() };
beforeEach(() => {
  camera.getCamera.mockReset().mockResolvedValue({ zoom: 14 });
  camera.animateCamera.mockReset();
});
const press = async (name: string) => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name })); });
};

describe('MapControls', () => {
  it('zooms one step in and one step out from where the camera is, gliding', async () => {
    render(<MapControls map={{ current: camera }} still={false} onFit={() => {}} />);
    await press('Zoom in');
    expect(camera.animateCamera).toHaveBeenLastCalledWith({ zoom: 15 }, { duration: 300 });
    await press('Zoom out');
    expect(camera.animateCamera).toHaveBeenLastCalledWith({ zoom: 13 }, { duration: 300 });
  });

  it('goes there at once for a reader who asked for less motion', async () => {
    render(<MapControls map={{ current: camera }} still onFit={() => {}} />);
    await press('Zoom in');
    expect(camera.animateCamera).toHaveBeenLastCalledWith({ zoom: 15 }, { duration: 0 });
  });

  it('does nothing while the map cannot say its zoom', async () => {
    camera.getCamera.mockResolvedValue({});
    const { rerender } = render(<MapControls map={{ current: camera }} still={false} onFit={() => {}} />);
    await press('Zoom in');
    rerender(<MapControls map={{ current: null }} still={false} onFit={() => {}} />);
    await press('Zoom out');
    expect(camera.animateCamera).not.toHaveBeenCalled();
  });

  it('asks for every place again', async () => {
    const onFit = vi.fn();
    render(<MapControls map={{ current: camera }} still={false} onFit={onFit} />);
    await press('Show every place');
    expect(onFit).toHaveBeenCalledOnce();
  });
});
