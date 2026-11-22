// @vitest-environment jsdom
//
// A tile that opens its collection taking its place with it. What is
// pinned: a tile with a picture is measured and opens with where it stood;
// one that cannot be measured, or has no picture, opens as it always did;
// and the view that is measured is the one the tile handed over, found
// again by its slug.

import React from 'react';
import { View } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '../uitest/render';

const state = vi.hoisted(() => ({ rect: { x: 10, y: 20, w: 100, h: 80 } as { x: number; y: number; w: number; h: number } | null, measured: [] as unknown[] }));
vi.mock('./coverMorph', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  measureWindow: (node: unknown) => { state.measured.push(node); return Promise.resolve(node ? state.rect : null); },
}));

import { useCoverOpen } from './useCoverOpen';

function Tiles({ go, shown }: { go: (slug: string, from?: unknown) => void; shown: string[] }) {
  const cover = useCoverOpen(go as never);
  return (
    <>
      {shown.map((slug) => <View key={slug} ref={cover.ref(slug)} testID={`tile-${slug}`} />)}
      <button onClick={() => cover.open('a', 'a.jpg')}>open a</button>
      <button onClick={() => cover.open('b', 'b.jpg')}>open b</button>
      <button onClick={() => cover.open('a', undefined)}>open bare</button>
    </>
  );
}

describe('useCoverOpen', () => {
  beforeEach(() => { state.rect = { x: 10, y: 20, w: 100, h: 80 }; state.measured = []; });

  it('opens with where the tile stood and what it showed', async () => {
    const go = vi.fn();
    render(<Tiles go={go} shown={['a', 'b']} />);
    fireEvent.click(screen.getByText('open b'));
    await waitFor(() => expect(go).toHaveBeenCalledWith('b', { rect: { x: 10, y: 20, w: 100, h: 80 }, uri: 'b.jpg' }));
    expect(state.measured).toEqual([screen.getByTestId('tile-b')]);
  });

  it('opens as it always did when the tile cannot be measured', async () => {
    state.rect = { x: 0, y: 0, w: 0, h: 0 };
    const go = vi.fn();
    render(<Tiles go={go} shown={['a']} />);
    fireEvent.click(screen.getByText('open a'));
    await waitFor(() => expect(go).toHaveBeenCalledWith('a', undefined));
  });

  it('opens as it always did for a tile with no picture, without measuring', () => {
    const go = vi.fn();
    render(<Tiles go={go} shown={['a']} />);
    fireEvent.click(screen.getByText('open bare'));
    expect(go).toHaveBeenCalledWith('a');
    expect(state.measured).toEqual([]);
  });

  it('opens as it always did for a tile that is not on the screen', async () => {
    const go = vi.fn();
    const { rerender } = render(<Tiles go={go} shown={['a']} />);
    rerender(<Tiles go={go} shown={[]} />);
    fireEvent.click(screen.getByText('open a'));
    await waitFor(() => expect(go).toHaveBeenCalledWith('a', undefined));
  });

  it('hands a tile the same ref every time, so the view is not detached and attached each render', () => {
    const seen: unknown[] = [];
    function Probe() {
      const cover = useCoverOpen(() => undefined);
      seen.push(cover.ref('a'));
      return null;
    }
    const { rerender } = render(<Probe />);
    rerender(<Probe />);
    expect(seen[0]).toBe(seen[1]);
  });
});
