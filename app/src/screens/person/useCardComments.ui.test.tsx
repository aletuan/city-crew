// @vitest-environment jsdom
//
// What each card is handed about its thread: nothing while the switch is
// off, nothing for a collection with no thread or no id, nothing where
// the page gave no way to open one — and otherwise the preview filed
// under its id and a press that opens that collection's thread. One ask
// for all the cards drawn, and none when there is nothing to ask about.

import React from 'react';
import { Text } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '../../uitest/render';
import { appFlags } from '../../lib/flags';
import type { Collection } from '../../lib/types';

const data = vi.hoisted(() => ({
  fetchPreviews: vi.fn(async (_s: { id: string }[]): Promise<Record<string, unknown>> => ({})),
}));
vi.mock('../../lib/data/comments', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  fetchPreviews: data.fetchPreviews,
}));

import { useCardComments } from './useCardComments';

const list = (id: string | null, is_public = true) => ({ id, slug: `s-${id}`, is_public }) as unknown as Collection;
const open = vi.fn();
// Each card's answer, drawn where a test can read it: the count it was
// handed (or null), whether it has a door, and the door itself as the
// press.
function Probe({ drawn, withOpen = true }: { drawn: Collection[]; withOpen?: boolean }) {
  const of = useCardComments(drawn, (c) => c.is_public === true, withOpen ? open : undefined);
  return (
    <>
      {drawn.map((c) => {
        const card = of(c);
        return (
          <Text key={c.slug} onPress={card.onComments} testID={`card-${c.slug}`}>
            {JSON.stringify({ n: card.comments ? card.comments.n : null, door: !!card.onComments })}
          </Text>
        );
      })}
    </>
  );
}
const got = (c: Collection) => JSON.parse(screen.getByTestId(`card-${c.slug}`).textContent!) as { n: number | null; door: boolean };
const NOTHING = { n: null, door: false };
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => { vi.clearAllMocks(); data.fetchPreviews.mockImplementation(async () => ({})); });
afterEach(() => { cleanup(); appFlags.reset(); });

describe('useCardComments', () => {
  it('hands every card nothing while the switch is off, and asks nothing', async () => {
    const a = list('c1');
    render(<Probe drawn={[a]} />);
    await flush();
    expect(got(a)).toEqual(NOTHING);
    expect(data.fetchPreviews.mock.calls.every(([s]) => s.length === 0)).toBe(true);
  });

  it('asks once for the cards that have a thread, and hands each its preview and its press', async () => {
    appFlags.set('comments', true);
    data.fetchPreviews.mockImplementation(async () => ({ c1: { n: 3, latest: [] } }));
    const [a, b, hidden, bare] = [list('c1'), list('c2'), list('c3', false), list(null)];
    render(<Probe drawn={[a, b, hidden, bare]} />);
    await flush();
    expect(data.fetchPreviews).toHaveBeenCalledTimes(1);
    expect(data.fetchPreviews.mock.calls[0][0]).toEqual([{ kind: 'collection', id: 'c1' }, { kind: 'collection', id: 'c2' }]);
    expect(got(a)).toEqual({ n: 3, door: true });
    // No comments yet: the way in, and no figure.
    expect(got(b)).toEqual({ n: null, door: true });
    // Not public, or no id to ask by: nothing about comments at all.
    expect(got(hidden)).toEqual(NOTHING);
    expect(got(bare)).toEqual(NOTHING);
    fireEvent.click(screen.getByTestId('card-s-c2'));
    expect(open).toHaveBeenCalledExactlyOnceWith(b);
  });

  it('asks again when more cards are drawn, and not for the same cards in a new array', async () => {
    appFlags.set('comments', true);
    const [a, b] = [list('c1'), list('c2')];
    const { rerender } = render(<Probe drawn={[a]} />);
    await flush();
    rerender(<Probe drawn={[a]} />);
    await flush();
    expect(data.fetchPreviews).toHaveBeenCalledTimes(1);
    rerender(<Probe drawn={[a, b]} />);
    await flush();
    expect(data.fetchPreviews).toHaveBeenCalledTimes(2);
  });

  it('hands nothing where the page has no way to open a thread', async () => {
    appFlags.set('comments', true);
    const a = list('c1');
    render(<Probe drawn={[a]} withOpen={false} />);
    await flush();
    expect(got(a)).toEqual(NOTHING);
    expect(data.fetchPreviews.mock.calls.every(([s]) => s.length === 0)).toBe(true);
  });
});
