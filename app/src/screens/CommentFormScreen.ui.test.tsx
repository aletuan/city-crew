// @vitest-environment jsdom
//
// Writing a comment (C4): what the form sends and under what, when its
// button is lit, the count it draws (the server's, in characters), what
// it quotes of the comment answered, what it says for each refusal —
// keeping the words — and that a post tells the rest of the app and
// goes back. `bodyProblem`, `bodyLength` and `refusalOf` run for real;
// the one RPC wrapper and the providers are stood in.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, viewStyleOf } from '../uitest/render';
import { REFUSALS, type Subject } from '../lib/comments';
import { changes } from '../lib/commentsChanged';
import type { Nav, RootRoute } from '../nav';
import { colors } from '../theme';

const data = vi.hoisted(() => ({
  postComment: vi.fn(async (_s: unknown, _parent: string | null, _body: string): Promise<string> => 'k-new'),
}));
vi.mock('../lib/data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  postComment: data.postComment,
}));
const state = vi.hoisted(() => ({ lang: 'en' as 'en' | 'vi' }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({
    lang: state.lang, setLang: () => {},
    t: (en: string | null, vi: string | null) => (state.lang === 'vi' ? vi ?? en ?? '' : en ?? vi ?? ''),
  }),
}));

import CommentFormScreen, { refusalWords } from './CommentFormScreen';

const SUBJECT: Subject = { kind: 'collection', id: 'c1' };
type Params = RootRoute<'CommentForm'>['params'];
const show = (params: Params = { subject: SUBJECT }) => {
  const navigation = { goBack: vi.fn(), navigate: vi.fn() };
  render(<CommentFormScreen navigation={navigation as unknown as Nav} route={{ params } as RootRoute<'CommentForm'>} />);
  return navigation;
};
const field = () => screen.getByTestId('comment-field') as HTMLTextAreaElement;
const type = (words: string) => fireEvent.change(field(), { target: { value: words } });
const postButton = () => screen.getByTestId('comment-post');
const lit = () => postButton().getAttribute('aria-disabled') !== 'true';
const press = () => act(async () => { fireEvent.click(postButton()); await Promise.resolve(); await Promise.resolve(); });
const count = () => screen.getByTestId('comment-count');
const en = ((e: string) => e) as unknown as Parameters<typeof refusalWords>[1];

beforeEach(() => {
  vi.clearAllMocks();
  data.postComment.mockImplementation(async () => 'k-new');
  state.lang = 'en';
});
afterEach(cleanup);

describe('a new comment', () => {
  it('says "Comment", quotes nothing, and starts with nothing to send', () => {
    show();
    expect(screen.getByText('Comment')).toBeTruthy();
    expect(screen.queryByTestId('comment-form-quote')).toBeNull();
    expect(count().textContent).toBe('0/500');
    expect(lit()).toBe(false);
    fireEvent.click(postButton());
    expect(data.postComment).not.toHaveBeenCalled();
  });

  it('goes back from its back button, having sent and told nothing', () => {
    const nav = show();
    const before = changes();
    type('half a thought');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(nav.goBack).toHaveBeenCalledTimes(1);
    expect(data.postComment).not.toHaveBeenCalled();
    expect(changes()).toBe(before);
  });

  it('lights the button for words and not for spaces alone', () => {
    show();
    type('   ');
    expect(lit()).toBe(false);
    type('  Lovely rooftop ');
    expect(lit()).toBe(true);
    // What the server will count: trimmed.
    expect(count().textContent).toBe('14/500');
  });

  it('posts under the subject, answering nobody, tells the app, and goes back', async () => {
    const nav = show();
    const before = changes();
    type('Lovely rooftop');
    await press();
    expect(data.postComment).toHaveBeenCalledExactlyOnceWith(SUBJECT, null, 'Lovely rooftop');
    expect(changes()).toBe(before + 1);
    expect(nav.goBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('auth-error')).toBeNull();
  });
});

describe('the count', () => {
  it('is in characters, as the server counts, and has no ceiling of the field\'s own', () => {
    show();
    type('🍜'.repeat(500));
    expect(count().textContent).toBe('500/500');
    expect(lit()).toBe(true);
    expect(field().getAttribute('maxlength')).toBeNull();
  });

  it('turns to the warning ink past the ceiling, and the button goes out', () => {
    show();
    type('a'.repeat(500));
    expect((viewStyleOf(count()) as { color?: unknown }).color).toBe(colors.textTertiary);
    type('a'.repeat(501));
    expect(count().textContent).toBe('501/500');
    expect((viewStyleOf(count()) as { color?: unknown }).color).toBe(colors.bad);
    expect(lit()).toBe(false);
  });
});

describe('an answer', () => {
  const replyTo = { id: 'k1', who: 'trang', body: 'Lovely rooftop, go at sunset' };

  it('says "Reply" and quotes who is answered and what they said, above the field', () => {
    show({ subject: SUBJECT, replyTo });
    expect(screen.getByText('Reply')).toBeTruthy();
    const quote = screen.getByTestId('comment-form-quote');
    expect(quote.textContent).toBe('trangLovely rooftop, go at sunset');
    expect(quote.compareDocumentPosition(field()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('posts under the comment it answers', async () => {
    show({ subject: SUBJECT, replyTo });
    type('Agreed');
    await press();
    expect(data.postComment).toHaveBeenCalledExactlyOnceWith(SUBJECT, 'k1', 'Agreed');
  });
});

describe('when the server says no', () => {
  it('says why, keeps the words, tells nobody, stays, and can be tried again', async () => {
    const nav = show();
    const before = changes();
    data.postComment.mockRejectedValueOnce(new Error('comment:banned'));
    type('a word the desk keeps out');
    await press();
    expect(screen.getByTestId('auth-error').textContent).toBe('This comment has a word that is not allowed here.');
    expect(field().value).toBe('a word the desk keeps out');
    expect(changes()).toBe(before);
    expect(nav.goBack).not.toHaveBeenCalled();
    // The button is lit again, and a second press that works clears the message.
    expect(lit()).toBe(true);
    await press();
    expect(nav.goBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('auth-error')).toBeNull();
  });

  it('says to try again for a failure that is not a refusal', async () => {
    show();
    data.postComment.mockRejectedValueOnce(new Error('Failed to fetch'));
    type('hello');
    await press();
    expect(screen.getByTestId('auth-error').textContent).toBe('Could not post your comment. Check your connection and try again.');
  });

  it('speaks the reader\'s language', async () => {
    state.lang = 'vi';
    show();
    data.postComment.mockRejectedValueOnce(new Error('comment:cap'));
    type('xin chào');
    await press();
    expect(screen.getByTestId('auth-error').textContent).toBe('Bạn đã đạt giới hạn bình luận hôm nay. Hãy thử lại vào ngày mai.');
  });
});

describe('refusalWords', () => {
  it('has a sentence of its own for each refusal a post can meet', () => {
    const own = ['signed_out', 'subject', 'off', 'empty', 'long', 'banned', 'cap', 'parent'] as const;
    const said = own.map((w) => refusalWords(w, en));
    expect(new Set(said).size).toBe(own.length);
    expect(refusalWords('long', en)).toBe('Comments can be up to 500 characters.');
    expect(refusalWords('off', en)).toContain('turned comments off');
  });

  it('says the general thing for the two that are not a post\'s, and for no refusal at all', () => {
    const general = refusalWords(null, en);
    expect(general).toContain('Check your connection');
    expect(refusalWords('mention', en)).toBe(general);
    expect(refusalWords('not_yours', en)).toBe(general);
    // Every word the server can raise is answered by one or the other.
    for (const w of REFUSALS) expect(refusalWords(w, en)).toBeTruthy();
  });
});
