// @vitest-environment jsdom
//
// What can be done about one comment (C4b): nothing as nobody and nothing
// about a comment that is gone; your own is yours to delete, after being
// asked once and told what will be left; somebody else's is reported
// through the app's one report flow, as a comment. A delete tells the
// rest of the app; a failed one says so and tells nobody.

import React from 'react';
import { Text } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '../../uitest/render';
import type { Placed } from '../../lib/comments';
import { changes } from '../../lib/commentsChanged';

type Button = { text: string; style?: string; onPress?: () => void };
const alert = vi.hoisted(() => vi.fn<(title: string, body?: string, buttons?: Button[]) => void>());
vi.mock('react-native', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  Alert: { alert },
}));
const data = vi.hoisted(() => ({
  deleteComment: vi.fn(async (_id: string): Promise<void> => {}),
  submitReport: vi.fn(async (_input: Record<string, unknown>): Promise<void> => {}),
}));
vi.mock('../../lib/data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  deleteComment: data.deleteComment,
  submitReport: data.submitReport,
}));
const state = vi.hoisted(() => ({ me: 'me' as string | null }));
vi.mock('../../lib/auth', () => ({ useSession: () => ({ session: state.me ? { user: { id: state.me } } : null }) }));
vi.mock('../../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string | null, vi: string | null) => en ?? vi ?? '' }),
}));

import { useCommentMenu } from './useCommentMenu';

const placed = (over: Partial<Placed> = {}): Placed => ({
  id: 'k1', parent_id: null, root_id: null, depth: 0, level: 0, to: null,
  body: 'Lovely rooftop', created_at: 'x', gone: false,
  author: 'them', handle: '@Trang', full_name: null, avatar_url: 'https://faces/trang.jpg', mentions: [],
  ...over,
});

/** A page with one comment's ⋯ on it, or the word "none" where the hook offers no menu. */
function Probe({ c }: { c: Placed }) {
  const { menuOf, node } = useCommentMenu(state.me);
  const open = menuOf(c);
  return (
    <>
      {open ? <Text onPress={open} testID="more">more</Text> : <Text testID="none">none</Text>}
      {node}
    </>
  );
}
const show = (c: Placed) => render(<Probe c={c} />);
/** Press a row of the sheet and let it close: the row acts once the sheet has gone. */
const choose = async (key: string) => {
  fireEvent.click(screen.getByTestId(`sheet-action-${key}`));
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
};
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  data.deleteComment.mockImplementation(async () => {});
  state.me = 'me';
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('who is offered a menu', () => {
  it('nobody signed out, and nobody about a comment that is gone', () => {
    state.me = null;
    show(placed());
    expect(screen.getByTestId('none')).toBeTruthy();
    cleanup();
    state.me = 'me';
    show(placed({ gone: true, body: null, author: null, handle: null }));
    expect(screen.getByTestId('none')).toBeTruthy();
  });

  it('says whose comment it is about, and what it said', () => {
    show(placed());
    expect(screen.queryByText('Lovely rooftop')).toBeNull();
    fireEvent.click(screen.getByTestId('more'));
    expect(screen.getByText('trang')).toBeTruthy();
    expect(screen.getByText('Lovely rooftop')).toBeTruthy();
  });
});

describe('your own comment', () => {
  const mine = placed({ author: 'me', handle: '@andy' });

  it('is yours to delete and not to report', () => {
    show(mine);
    fireEvent.click(screen.getByTestId('more'));
    expect(screen.getByTestId('sheet-action-delete').textContent).toContain('Delete comment');
    expect(screen.queryByTestId('sheet-action-report')).toBeNull();
  });

  it('asks once, saying what stays, and deletes nothing on Cancel', async () => {
    show(mine);
    fireEvent.click(screen.getByTestId('more'));
    await choose('delete');
    expect(alert).toHaveBeenCalledTimes(1);
    const [title, body, buttons] = alert.mock.calls[0];
    expect(title).toBe('Delete this comment?');
    expect(body).toContain('their replies stay');
    expect(buttons!.map((b) => [b.text, b.style])).toEqual([['Cancel', 'cancel'], ['Delete', 'destructive']]);
    expect(buttons![0].onPress).toBeUndefined();
    expect(data.deleteComment).not.toHaveBeenCalled();
  });

  it('deletes it on Delete and tells the rest of the app', async () => {
    show(mine);
    const before = changes();
    fireEvent.click(screen.getByTestId('more'));
    await choose('delete');
    act(() => { alert.mock.calls[0][2]![1].onPress!(); });
    await settle();
    expect(data.deleteComment).toHaveBeenCalledExactlyOnceWith('k1');
    expect(changes()).toBe(before + 1);
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it('says so when it could not, and tells nobody', async () => {
    data.deleteComment.mockRejectedValueOnce(new Error('timeout'));
    show(mine);
    const before = changes();
    fireEvent.click(screen.getByTestId('more'));
    await choose('delete');
    act(() => { alert.mock.calls[0][2]![1].onPress!(); });
    await settle();
    expect(alert).toHaveBeenCalledTimes(2);
    expect(alert.mock.calls[1][0]).toBe('Could not delete');
    expect(changes()).toBe(before);
  });
});

describe('somebody else\'s comment', () => {
  it('is to report and not to delete', () => {
    show(placed());
    fireEvent.click(screen.getByTestId('more'));
    expect(screen.getByTestId('sheet-action-report').textContent).toContain('Report comment');
    expect(screen.queryByTestId('sheet-action-delete')).toBeNull();
  });

  it('goes to the desk as a comment, under the reason chosen, through the app\'s own report flow', async () => {
    show(placed());
    fireEvent.click(screen.getByTestId('more'));
    await choose('report');
    // The reasons, as for a list or a profile.
    expect(screen.getByText('What is wrong with this?')).toBeTruthy();
    await choose('offensive');
    expect(data.submitReport).toHaveBeenCalledExactlyOnceWith({ reporter: 'me', kind: 'comment', targetId: 'k1', reason: 'offensive' });
    expect(alert.mock.calls.at(-1)![0]).toBe('Thanks for telling us');
    expect(data.deleteComment).not.toHaveBeenCalled();
  });

  it('names a writer with no handle by their name, or as "Someone"', () => {
    show(placed({ handle: null, full_name: 'Lan Pham', avatar_url: null }));
    fireEvent.click(screen.getByTestId('more'));
    expect(screen.getByText('Lan Pham')).toBeTruthy();
    cleanup();
    show(placed({ handle: null, full_name: null, author: null }));
    fireEvent.click(screen.getByTestId('more'));
    expect(screen.getByText('Someone')).toBeTruthy();
  });
});
