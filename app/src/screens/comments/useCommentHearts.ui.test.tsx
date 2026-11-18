// @vitest-environment jsdom
//
// The hearts on a thread, as the reader's presses leave them: drawn on
// the press and told to the server behind it; lifted again, silently,
// when the server refuses; dropped for the thread's own figures when a
// newer answer arrives; and a question, not a like, for a guest.

import React from 'react';
import { Text } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '../../uitest/render';
import type { Placed } from '../../lib/comments';

const data = vi.hoisted(() => ({
  likeComment: vi.fn(async (_id: string, _on: boolean): Promise<void> => {}),
}));
vi.mock('../../lib/data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  likeComment: data.likeComment,
}));
const fireHaptic = vi.hoisted(() => vi.fn());
vi.mock('../../components/ui', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  fireHaptic,
}));

import { useCommentHearts } from './useCommentHearts';

const placed = (id: string, likes = 0, liked = false): Placed => ({
  id, parent_id: null, root_id: null, depth: 0, level: 0, to: null,
  body: 'Lovely rooftop', created_at: 'x',
  author: 'u1', handle: 'trang', full_name: null, avatar_url: null, mentions: [], likes, liked,
});

const askIn = vi.fn();
function Page({ me, at, rows }: { me: string | null; at: number | null; rows: Placed[] }) {
  const { heartsOf, toggle } = useCommentHearts(me, at, askIn);
  return (
    <>
      {rows.map((c) => {
        const h = heartsOf(c);
        return <Text key={c.id} testID={c.id} onPress={() => toggle(c)}>{`${h.likes}${h.liked ? '♥' : '♡'}`}</Text>;
      })}
    </>
  );
}
const at = (id: string) => screen.getByTestId(id).textContent;
const press = (id: string) => fireEvent.click(screen.getByTestId(id));
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
/** A server that answers when told to. */
const held = () => {
  const calls: { ok: () => void; no: () => void }[] = [];
  data.likeComment.mockImplementation(() => new Promise<void>((ok, no) => calls.push({ ok, no: () => no(new Error('comment:parent')) })));
  return calls;
};

beforeEach(() => {
  askIn.mockReset(); fireHaptic.mockReset();
  data.likeComment.mockReset(); data.likeComment.mockImplementation(async () => {});
});
afterEach(cleanup);

describe('a press', () => {
  it('is drawn before the server has answered, and the server is told', async () => {
    const calls = held();
    render(<Page me="me" at={1} rows={[placed('a', 2), placed('b', 5, true)]} />);
    expect([at('a'), at('b')]).toEqual(['2♡', '5♥']);
    press('a');
    expect([at('a'), at('b')]).toEqual(['3♥', '5♥']);
    expect(data.likeComment.mock.calls).toEqual([['a', true]]);
    expect(fireHaptic.mock.calls).toEqual([['light']]);
    calls[0].ok();
    await settle();
    expect(at('a')).toBe('3♥');
  });

  it('takes a heart back the same way, and a second press undoes the first', async () => {
    render(<Page me="me" at={1} rows={[placed('b', 5, true)]} />);
    press('b');
    expect(at('b')).toBe('4♡');
    press('b');
    expect(at('b')).toBe('5♥');
    expect(data.likeComment.mock.calls).toEqual([['b', false], ['b', true]]);
    await settle();
  });

  it('as nobody raises the sign-in sheet: nothing drawn, nothing sent, no tap', () => {
    render(<Page me={null} at={1} rows={[placed('a', 2)]} />);
    press('a');
    expect(askIn).toHaveBeenCalledTimes(1);
    expect(at('a')).toBe('2♡');
    expect(data.likeComment).not.toHaveBeenCalled();
    expect(fireHaptic).not.toHaveBeenCalled();
  });
});

describe('a refusal', () => {
  it('lifts the press off that comment and leaves the others as pressed', async () => {
    const calls = held();
    render(<Page me="me" at={1} rows={[placed('a', 2), placed('b', 5, true)]} />);
    press('a'); press('b');
    expect([at('a'), at('b')]).toEqual(['3♥', '4♡']);
    calls[0].no();
    await settle();
    expect([at('a'), at('b')]).toEqual(['2♡', '4♡']);
    expect(askIn).not.toHaveBeenCalled();
  });

  it('draws the thread\'s own figures again, not the first press\'s guess', async () => {
    const calls = held();
    render(<Page me="me" at={1} rows={[placed('a', 2)]} />);
    press('a'); press('a');
    expect(at('a')).toBe('2♡');
    // The second is refused twice over: the row is lifted once and the
    // late refusal finds nothing of its own to lift.
    calls[1].no();
    await settle();
    calls[0].no();
    await settle();
    expect(at('a')).toBe('2♡');
  });

  it('that lands after a newer answer changes nothing on it', async () => {
    const calls = held();
    const { rerender } = render(<Page me="me" at={1} rows={[placed('a', 2)]} />);
    press('a');
    rerender(<Page me="me" at={2} rows={[placed('a', 7, true)]} />);
    press('a');
    expect(at('a')).toBe('6♡');
    calls[0].no();
    await settle();
    expect(at('a')).toBe('6♡');
  });
});

describe('a newer answer', () => {
  it('is drawn as it came: it already has the presses', async () => {
    const { rerender } = render(<Page me="me" at={1} rows={[placed('a', 2), placed('b', 0)]} />);
    press('a');
    await settle();
    expect(at('a')).toBe('3♥');
    // Somebody else took theirs back meanwhile: 2, and the reader's among them.
    rerender(<Page me="me" at={2} rows={[placed('a', 2, true), placed('b', 0)]} />);
    expect(at('a')).toBe('2♥');
    // A press on it starts from it, and forgets what was laid over the last.
    press('b');
    expect([at('a'), at('b')]).toEqual(['2♥', '1♥']);
    await settle();
  });
});
