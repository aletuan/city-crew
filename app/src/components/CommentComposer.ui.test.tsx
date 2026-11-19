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

const onSend = vi.fn(async (_body: string, _mentions: unknown[]): Promise<void> => {});
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
  it('hands over the words, without the space around them, and empties the field when they are taken', async () => {
    show();
    type('  Lovely rooftop \n');
    await press();
    expect(onSend).toHaveBeenCalledExactlyOnceWith('Lovely rooftop', []);
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

// Which rows "@" offers and where a tag lands are `lib/commentTags`'s,
// pinned there. Here: that the field asks it on each keystroke and on a
// moved caret, draws what it answers, writes the tag in, and sends the
// tags with the words.
describe('tagging', () => {
  const taggable = {
    people: [
      { id: 'u-trang', handle: 'trang', full_name: 'Trang Lê', avatar_url: 'https://faces/trang.jpg' },
      { id: 'u-dang', handle: 'dang', full_name: null, avatar_url: null },
    ],
    places: [
      { id: 'p-cong', slug: 'cong-ca-phe', name_en: 'Cong Cafe', name_vi: 'Cộng Cà Phê' },
      { id: 'p-tan', slug: 'tan-hien', name_en: 'Tan Hien', name_vi: 'Tán Hiên' },
    ],
  };
  const rows = () => [...screen.queryAllByTestId(/^composer-offer-(person|place)$/)];
  const said = () => rows().map((r) => r.textContent);
  const take = (i: number) => fireEvent.click(rows()[i]);

  it('offers nothing until an "@" is typed, then people and the list\'s places', () => {
    show({ taggable });
    expect(screen.queryByTestId('composer-offers')).toBeNull();
    type('hi ');
    expect(screen.queryByTestId('composer-offers')).toBeNull();
    type('hi @');
    expect(said()).toEqual(['trangTrang Lê', 'dang', 'Cong CafePlace', 'Tan HienPlace']);
    expect(rows().map((r) => r.getAttribute('data-testid'))).toEqual([
      'composer-offer-person', 'composer-offer-person', 'composer-offer-place', 'composer-offer-place',
    ]);
    // The rows stand over the field.
    expect(screen.getByTestId('composer-offers').compareDocumentPosition(field()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('draws a person by their face and a place by the pin, and says what a press does', () => {
    show({ taggable });
    type('@');
    expect(rows()[0].querySelector('img')!.getAttribute('src')).toBe('https://faces/trang.jpg');
    expect(rows()[2].querySelector('[data-icon]')!.getAttribute('data-icon')).toBe('location-outline');
    expect(rows()[0].getAttribute('aria-label')).toBe('Tag @trang');
    expect(rows()[2].getAttribute('aria-label')).toBe('Tag @Cong Cafe');
  });

  it('names places in the reader\'s language', () => {
    state.lang = 'vi';
    show({ taggable });
    type('@c');
    expect(said()).toEqual(['Cộng Cà PhêĐịa điểm']);
  });

  it('narrows as letters are typed, and offers nothing for letters nobody answers', () => {
    show({ taggable });
    type('@t');
    expect(said()).toEqual(['trangTrang Lê', 'Tan HienPlace']);
    type('@tr');
    expect(said()).toEqual(['trangTrang Lê']);
    type('@trx');
    expect(screen.queryByTestId('composer-offers')).toBeNull();
  });

  it('treats "@" as a letter where nothing may be tagged', () => {
    show();
    type('@');
    expect(screen.queryByTestId('composer-offers')).toBeNull();
  });

  it('writes the tag in for what was being typed, puts the offers away, and sends it with the words', async () => {
    show({ taggable });
    type('  thanks @tr');
    take(0);
    expect(field().value).toBe('  thanks @trang ');
    expect(screen.queryByTestId('composer-offers')).toBeNull();
    type('  thanks @trang see you at @c');
    take(0);
    expect(field().value).toBe('  thanks @trang see you at @Cong Cafe ');
    await press();
    // Trimmed, and the tags counted from where the trimmed words begin.
    expect(onSend).toHaveBeenCalledExactlyOnceWith('thanks @trang see you at @Cong Cafe', [
      { at: 7, len: 6, person: 'u-trang', place: null, handle: null, slug: null },
      { at: 25, len: 10, person: null, place: 'p-cong', handle: null, slug: null },
    ]);
  });

  it('counts an emoji before the "@" as one character, though the field counts it as two', async () => {
    show({ taggable });
    type('😀 @d');
    expect(said()).toEqual(['dang']);
    take(0);
    await press();
    expect(onSend).toHaveBeenCalledExactlyOnceWith('😀 @dang', [
      { at: 2, len: 5, person: 'u-dang', place: null, handle: null, slug: null },
    ]);
  });

  it('sends plain words for a tag whose letters were edited afterwards', async () => {
    show({ taggable });
    type('@tr');
    take(0);
    type('@trXng and more');
    await press();
    expect(onSend).toHaveBeenCalledExactlyOnceWith('@trXng and more', []);
  });

  it('moves a tag along with words typed before it', async () => {
    show({ taggable });
    type('@tr');
    take(0);
    type('hi @trang ');
    await press();
    expect(onSend).toHaveBeenCalledExactlyOnceWith('hi @trang', [
      { at: 3, len: 6, person: 'u-trang', place: null, handle: null, slug: null },
    ]);
  });

  it('starts the next comment with no tags left over from the last', async () => {
    show({ taggable });
    type('@tr');
    take(0);
    await press();
    onSend.mockClear();
    type('@trang again');
    await press();
    expect(onSend).toHaveBeenCalledExactlyOnceWith('@trang again', []);
  });

  it('keeps the tags, with the words, when the server refuses', async () => {
    onSend.mockRejectedValueOnce(new Error('comment:cap'));
    show({ taggable });
    type('@tr');
    take(0);
    await press();
    onSend.mockClear();
    await press();
    expect(onSend).toHaveBeenCalledExactlyOnceWith('@trang', [
      { at: 0, len: 6, person: 'u-trang', place: null, handle: null, slug: null },
    ]);
  });

  it('follows the caret: an "@" behind it offers, and moving off it puts the offers away', () => {
    show({ taggable });
    type('@tr and more');
    expect(screen.queryByTestId('composer-offers')).toBeNull();
    const el = field();
    el.setSelectionRange(3, 3);
    fireEvent.select(el);
    expect(said()).toEqual(['trangTrang Lê']);
    el.setSelectionRange(0, 0);
    fireEvent.select(el);
    expect(screen.queryByTestId('composer-offers')).toBeNull();
  });

  it('reads the caret the field reports in units as characters', () => {
    show({ taggable });
    type('😀 @d and more');
    const el = field();
    // After the d: five units in, four characters.
    el.setSelectionRange(5, 5);
    fireEvent.select(el);
    expect(said()).toEqual(['dang']);
  });
});

describe('a thread its owner has closed', () => {
  it('has the words that say so where the field would be, and no field, button or invitation', () => {
    show({ closed: 'The owner turned off comments.', onGuest });
    expect(screen.getByTestId('composer-closed').textContent).toBe('The owner turned off comments.');
    expect(screen.queryByTestId('composer-field')).toBeNull();
    expect(screen.queryByTestId('composer-send')).toBeNull();
    expect(screen.queryByTestId('composer-guest')).toBeNull();
  });
});
