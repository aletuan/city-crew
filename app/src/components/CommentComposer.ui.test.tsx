// @vitest-environment jsdom
//
// The field a comment is written in: when its button is lit, what a send
// hands over and what the field does with the answer — emptied on a yes,
// the words and the server's reason kept on a no — the count that
// appears near the ceiling in the server's own characters, the line that
// says whom the words answer, and the press it becomes for a guest.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, viewStyleOf } from '../uitest/render';
import { colors } from '../theme';

const state = vi.hoisted(() => ({ lang: 'en' as 'en' | 'vi' }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: state.lang, t: (en: string, vi: string) => (state.lang === 'vi' ? vi : en) }),
}));

import CommentComposer, { COUNT_FROM } from './CommentComposer';

const onSend = vi.fn(async (_body: string): Promise<void> => {});
const onCancelReply = vi.fn();
const onGuest = vi.fn();
const show = (over: Partial<React.ComponentProps<typeof CommentComposer>> = {}) => render(
  <CommentComposer avatarUrl="https://faces/me.jpg" replyTo={null} onCancelReply={onCancelReply} onSend={onSend} {...over} />,
);
const field = () => screen.getByTestId('composer-field') as HTMLTextAreaElement;
const type = (words: string) => fireEvent.change(field(), { target: { value: words } });
const button = () => screen.getByTestId('composer-send');
const lit = () => button().getAttribute('aria-disabled') !== 'true';
const press = () => act(async () => { fireEvent.click(button()); await Promise.resolve(); await Promise.resolve(); });
const inkOf = (el: HTMLElement) => (viewStyleOf(el) as { color?: unknown }).color;

beforeEach(() => { vi.clearAllMocks(); onSend.mockImplementation(async () => {}); state.lang = 'en'; });
afterEach(cleanup);

describe('the field', () => {
  it('wears the reader\'s face, invites a comment, and starts with nothing to send', () => {
    show();
    expect(screen.getByTestId('composer').querySelector('img')!.getAttribute('src')).toBe('https://faces/me.jpg');
    expect(field().getAttribute('placeholder')).toBe('Write a comment…');
    expect(field().getAttribute('aria-label')).toBe('Your comment');
    expect(lit()).toBe(false);
    fireEvent.click(button());
    expect(onSend).not.toHaveBeenCalled();
  });

  it('lights the button for words and not for spaces alone, and has no ceiling of its own', () => {
    show();
    type('   ');
    expect(lit()).toBe(false);
    type('hello');
    expect(lit()).toBe(true);
    expect(field().getAttribute('maxlength')).toBeNull();
  });

  it('sits above the phone\'s own margin', () => {
    show({ bottomInset: 34 });
    expect(viewStyleOf(screen.getByTestId('composer')).paddingBottom).toBe(42);
    cleanup();
    show();
    expect(viewStyleOf(screen.getByTestId('composer')).paddingBottom).toBe(8);
  });
});

describe('sending', () => {
  it('hands over the words as typed and empties the field when they are taken', async () => {
    show();
    type('Lovely rooftop');
    await press();
    expect(onSend).toHaveBeenCalledExactlyOnceWith('Lovely rooftop');
    expect(field().value).toBe('');
    expect(lit()).toBe(false);
    expect(screen.queryByTestId('composer-error')).toBeNull();
  });

  it('cannot be pressed twice while the first is out', async () => {
    let land: () => void = () => {};
    onSend.mockImplementation(() => new Promise<void>((res) => { land = res; }));
    show();
    type('once');
    fireEvent.click(button());
    await act(async () => { await Promise.resolve(); });
    expect(lit()).toBe(false);
    fireEvent.click(button());
    expect(onSend).toHaveBeenCalledTimes(1);
    await act(async () => { land(); await Promise.resolve(); });
    expect(field().value).toBe('');
  });

  it('says why when the server refuses, keeps the words, and can be tried again', async () => {
    show();
    onSend.mockRejectedValueOnce(new Error('comment:banned'));
    type('a word the desk keeps out');
    await press();
    expect(screen.getByTestId('composer-error').textContent).toBe('This comment has a word that is not allowed here.');
    expect(field().value).toBe('a word the desk keeps out');
    expect(lit()).toBe(true);
    await press();
    expect(screen.queryByTestId('composer-error')).toBeNull();
    expect(field().value).toBe('');
  });

  it('says to try again for a failure that is not a refusal, in the reader\'s language', async () => {
    state.lang = 'vi';
    show();
    onSend.mockRejectedValueOnce(new Error('Failed to fetch'));
    type('xin chào');
    await press();
    expect(screen.getByTestId('composer-error').textContent).toBe('Không đăng được bình luận. Kiểm tra kết nối rồi thử lại.');
  });
});

describe('the count', () => {
  it('is not drawn until the last fifty characters, then counts as the server does', () => {
    show();
    expect(COUNT_FROM).toBe(50);
    type('a'.repeat(450));
    expect(screen.queryByTestId('composer-count')).toBeNull();
    type('a'.repeat(451));
    expect(screen.getByTestId('composer-count').textContent).toBe('451/500');
    // Characters, not UTF-16 units, and after trimming.
    type(` ${'🍜'.repeat(500)} `);
    expect(screen.getByTestId('composer-count').textContent).toBe('500/500');
    expect(lit()).toBe(true);
    expect(inkOf(screen.getByTestId('composer-count'))).toBe(colors.textTertiary);
  });

  it('turns to the warning ink past the ceiling, and the button goes out', () => {
    show();
    type('a'.repeat(501));
    expect(screen.getByTestId('composer-count').textContent).toBe('501/500');
    expect(inkOf(screen.getByTestId('composer-count'))).toBe(colors.bad);
    expect(lit()).toBe(false);
  });
});

describe('answering somebody', () => {
  it('says nothing of it for a comment that answers nobody', () => {
    show();
    expect(screen.queryByTestId('composer-replying')).toBeNull();
  });

  it('says whom above the field, names the field for them, and takes it back on the ✕', () => {
    show({ replyTo: { who: 'trang' } });
    expect(screen.getByTestId('composer-replying').textContent).toBe('Replying to trang');
    expect(field().getAttribute('aria-label')).toBe('Your reply to trang');
    fireEvent.click(screen.getByTestId('composer-cancel-reply'));
    expect(onCancelReply).toHaveBeenCalledTimes(1);
  });

  it('says it in Vietnamese', () => {
    state.lang = 'vi';
    show({ replyTo: { who: 'trang' } });
    expect(screen.getByTestId('composer-replying').textContent).toBe('Đang trả lời trang');
  });
});

describe('for nobody signed in', () => {
  it('is a press with the field\'s words and no field, and does what the page says', () => {
    show({ onGuest, replyTo: { who: 'trang' } });
    expect(screen.queryByTestId('composer-field')).toBeNull();
    expect(screen.queryByTestId('composer-send')).toBeNull();
    expect(screen.queryByTestId('composer-replying')).toBeNull();
    const bar = screen.getByTestId('composer-guest');
    expect(bar.textContent).toBe('Write a comment…');
    fireEvent.click(bar);
    expect(onGuest).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
  });
});
