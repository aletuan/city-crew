// @vitest-environment jsdom
//
// Search's index of every city — see the header of `searchIndex.tsx`.

import React, { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '../uitest/render';
import { forgetSearchIndex, useSearchIndex } from './searchIndex';
import type { Place } from './data';

const data = vi.hoisted(() => ({ fetch: vi.fn(async (_me: string | null): Promise<Place[]> => []) }));
vi.mock('./data', () => ({ fetchSearchIndex: data.fetch }));

const place = (slug: string) => ({ slug, city_id: 'hcmc' }) as Place;
const seen = { places: undefined as Place[] | null | undefined };
function Probe({ reader }: { reader: string | null | undefined }) {
  const places = useSearchIndex(reader);
  useEffect(() => { seen.places = places; });
  return null;
}
const settle = () => act(async () => {});

beforeEach(() => {
  forgetSearchIndex();
  data.fetch.mockReset();
  data.fetch.mockImplementation(async () => [place('a')]);
  seen.places = undefined;
});

describe('useSearchIndex', () => {
  it('asks for nobody’s index when nobody is signed in', async () => {
    render(<Probe reader={null} />);
    await settle();
    expect(seen.places).toEqual([place('a')]);
    expect(data.fetch).toHaveBeenCalledWith(null);
  });

  it('asks nothing while it is not known who is reading', async () => {
    render(<Probe reader={undefined} />);
    await settle();
    expect(data.fetch).not.toHaveBeenCalled();
    expect(seen.places).toBeNull();
  });

  // Their own suggestions are in it.
  it('asks for the reader’s own index', async () => {
    render(<Probe reader="u1" />);
    await settle();
    expect(data.fetch).toHaveBeenCalledWith('u1');
  });

  it('asks once a run, however many screens want it', async () => {
    render(<Probe reader="u1" />).unmount();
    await settle();
    render(<Probe reader="u1" />);
    await settle();
    expect(data.fetch).toHaveBeenCalledTimes(1);
    expect(seen.places).toEqual([place('a')]);
  });

  it('asks again for somebody else, and shows nothing of the first meanwhile', async () => {
    const view = render(<Probe reader="u1" />);
    await settle();
    let answer: (p: Place[]) => void = () => {};
    data.fetch.mockImplementation(() => new Promise((r) => { answer = r; }));
    view.rerender(<Probe reader="u2" />);
    await settle();
    expect(seen.places).toBeNull();
    await act(async () => { answer([place('b')]); });
    expect(seen.places).toEqual([place('b')]);
  });

  // The next search asks again rather than living with it.
  it('forgets a failed read', async () => {
    data.fetch.mockImplementationOnce(async () => { throw new Error('offline'); });
    render(<Probe reader={null} />).unmount();
    await settle();
    render(<Probe reader={null} />);
    await settle();
    expect(data.fetch).toHaveBeenCalledTimes(2);
    expect(seen.places).toEqual([place('a')]);
  });

  it('says nothing after the screen has gone', async () => {
    let answer: (p: Place[]) => void = () => {};
    data.fetch.mockImplementation(() => new Promise((r) => { answer = r; }));
    render(<Probe reader={null} />).unmount();
    await act(async () => { answer([place('late')]); });
    expect(seen.places).toBeNull();
  });
});
