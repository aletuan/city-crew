// @vitest-environment jsdom
//
// Landing on one comment: what must be on the page for it to be there,
// the one scroll once both of its offsets are known, and the beat it is
// lit for. And that a comment which is not in the thread asks nothing.

import React from 'react';
import { Text } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '../../uitest/render';
import type { Branch, Placed } from '../../lib/comments';
import { LIT_MS, useThreadFocus } from './useThreadFocus';

const placed = (id: string, parent: string | null = null): Placed => ({
  id, parent_id: parent, root_id: parent, depth: parent ? 1 : 0, level: parent ? 1 : 0, to: null, under: 0,
  body: id, created_at: 'x', author: 'u', handle: 'h', full_name: null, avatar_url: null, mentions: [], likes: 0, liked: false,
});
// Three roots; the second has four answers.
const THREAD: Branch[] = [
  { root: placed('a'), replies: [] },
  { root: placed('b'), replies: [placed('b1', 'b'), placed('b2', 'b'), placed('b3', 'b'), placed('b4', 'b')] },
  { root: placed('c'), replies: [placed('c1', 'c')] },
];

const scrollTo = vi.fn();
const at = (y: number) => ({ nativeEvent: { layout: { x: 0, y, width: 300, height: 60 } } }) as LayoutChangeEvent;
/** A page that says what the hook answers, with a press for each report
 *  the page would make. */
function Page({ focus, branches = THREAD, y, arm }: {
  focus?: string; branches?: Branch[]; y: { branch: number; row: number };
  /** Handed the page's scroller ref once mounted, to stand a fake in it. */
  arm?: (scroll: { current: unknown }) => void;
}) {
  const f = useThreadFocus(focus, branches);
  const { scroll } = f;
  React.useEffect(() => { arm?.(scroll); }, [arm, scroll]);
  const ids = branches.flatMap((b) => [b.root.id, ...b.replies.map((r) => r.id)]);
  return (
    <>
      <Text testID="reveal">{JSON.stringify(f.reveal)}</Text>
      <Text testID="lit">{ids.filter((id) => f.rowProps(id).lit).join(',')}</Text>
      <Text testID="rows">{ids.filter((id) => f.rowProps(id).onLayout).join(',')}</Text>
      <Text testID="branches">{branches.filter((b) => f.branchAt(b.root.id)).map((b) => b.root.id).join(',')}</Text>
      {branches.map((b) => (
        <Text key={b.root.id} testID={`branch-${b.root.id}`} onPress={() => f.branchAt(b.root.id)?.(at(y.branch))}>b</Text>
      ))}
      {ids.map((id) => (
        <Text key={id} testID={`row-${id}`} onPress={() => f.rowProps(id).onLayout?.(at(y.row))}>r</Text>
      ))}
    </>
  );
}
/** A scroller that only records where it was sent. */
const arm = (scroll: { current: unknown }) => { scroll.current = { scrollTo }; };
const show = (focus?: string, y = { branch: 400, row: 130 }, branches = THREAD) => {
  return render(<Page focus={focus} branches={branches} y={y} arm={arm} />);
};
const said = (id: string) => screen.getByTestId(id).textContent;
const press = (id: string) => fireEvent.click(screen.getByTestId(id));

beforeEach(() => { vi.useFakeTimers(); scrollTo.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('what must be on the page', () => {
  it('is the comment\'s root mounted, and its branch open when it is an answer in it', () => {
    show('b4');
    expect(JSON.parse(said('reveal')!)).toEqual({ shown: 2, open: 'b' });
    cleanup();
    show('c');
    // A root needs nothing opened: it is not behind the fold.
    expect(JSON.parse(said('reveal')!)).toEqual({ shown: 3, open: null });
    cleanup();
    show('a');
    expect(JSON.parse(said('reveal')!)).toEqual({ shown: 1, open: null });
  });

  it('is nothing with no comment to land on, or one the thread does not hold', () => {
    show(undefined);
    expect(JSON.parse(said('reveal')!)).toEqual({ shown: 0, open: null });
    expect([said('rows'), said('branches')]).toEqual(['', '']);
    cleanup();
    show('gone');
    expect(JSON.parse(said('reveal')!)).toEqual({ shown: 0, open: null });
    expect([said('rows'), said('branches')]).toEqual(['', '']);
  });

  it('asks only the comment and its own branch where they are', () => {
    show('b4');
    expect([said('rows'), said('branches')]).toEqual(['b4', 'b']);
  });
});

describe('the landing', () => {
  it('scrolls once both offsets are in — branch then row — to the comment, with air above it', () => {
    show('b4');
    press('branch-b');
    expect(scrollTo).not.toHaveBeenCalled();
    expect(said('lit')).toBe('');
    press('row-b4');
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ y: 400 + 130 - 12, animated: true });
    expect(said('lit')).toBe('b4');
  });

  it('scrolls the same whichever report comes first', () => {
    show('b4');
    press('row-b4');
    expect(scrollTo).not.toHaveBeenCalled();
    press('branch-b');
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ y: 518, animated: true });
  });

  it('never scrolls above the top of the page', () => {
    show('a', { branch: 0, row: 0 });
    press('branch-a'); press('row-a');
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ y: 0, animated: true });
  });

  it('does not drag the reader back when the page is laid out again', () => {
    show('b4');
    press('branch-b'); press('row-b4');
    press('branch-b'); press('row-b4');
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('lights the comment for a beat and no longer', () => {
    show('b4');
    press('branch-b'); press('row-b4');
    act(() => { vi.advanceTimersByTime(LIT_MS - 1); });
    expect(said('lit')).toBe('b4');
    act(() => { vi.advanceTimersByTime(1); });
    expect(said('lit')).toBe('');
  });

  it('lights it even where the page has no scroller to move', () => {
    render(<Page focus="b4" y={{ branch: 1, row: 1 }} />);
    press('branch-b'); press('row-b4');
    expect(said('lit')).toBe('b4');
  });

  it('leaves no timer behind a page closed while the comment is lit', () => {
    const { unmount } = show('b4');
    press('branch-b'); press('row-b4');
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves none to clear on a page closed before it landed', () => {
    const { unmount } = show('b4');
    expect(() => unmount()).not.toThrow();
  });
});
