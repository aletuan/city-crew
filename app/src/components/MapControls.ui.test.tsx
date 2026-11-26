// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';
import MapControls from './MapControls';

describe('MapControls', () => {
  it('is one crosshair, and runs it', () => {
    const onLocate = vi.fn();
    render(<MapControls onLocate={onLocate} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'My location' }));
    expect(onLocate).toHaveBeenCalledOnce();
  });

  it('is nothing when nothing answers it', () => {
    render(<MapControls />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  // Pinching zooms, and the owner chose the crosshair over the fit (27 Nov 2026).
  it('has neither zoom nor fit buttons', () => {
    render(<MapControls onLocate={() => {}} />);
    for (const name of ['Zoom in', 'Zoom out', 'Show every place']) expect(screen.queryByRole('button', { name })).toBeNull();
  });
});
