// @vitest-environment jsdom
//
// One comment, as drawn: who and when on a line and the words under it;
// how far in each level sits and which face it wears; the name a deep
// answer carries; a tag as something to press, by the handle a person
// has today.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, textStyleOf, viewStyleOf } from '../uitest/render';
import type { Placed } from '../lib/comments';
import { colors } from '../theme';

const state = vi.hoisted(() => ({ lang: 'en' as 'en' | 'vi' }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: state.lang, t: (en: string, vi: string) => (state.lang === 'vi' ? vi : en) }),
}));

import CommentRow, { FACE, FACE_REPLY, INDENT } from './CommentRow';

const placed = (over: Partial<Placed> = {}): Placed => ({
  id: 'k1', parent_id: null, root_id: null, depth: 0, level: 0, to: null,
  body: 'Lovely rooftop', created_at: '2026-11-18T00:00:00Z',
  author: 'u1', handle: '@Trang', full_name: 'Trang Le', avatar_url: 'https://faces/trang.jpg', mentions: [],
  ...over,
});

const onPerson = vi.fn();
const onPlace = vi.fn();
const onReply = vi.fn();
const show = (c: Placed, withPlace = false) =>
  render(<CommentRow comment={c} when="2h ago" onPerson={onPerson} onPlace={withPlace ? onPlace : undefined} />);
/** The face's drawn size, off the image inside the row. */
const faceSize = () => viewStyleOf(screen.getByTestId('comment-row').querySelector('img')!).width;
/** The colour a nested Text was itself given: `textStyleOf` climbs to
 *  the body, which set the font size, and would answer the body's ink. */
const inkOf = (el: HTMLElement) => (viewStyleOf(el) as { color?: unknown }).color;

beforeEach(() => { vi.clearAllMocks(); state.lang = 'en'; });
afterEach(cleanup);

describe('a comment', () => {
  it('says who, when and what, and reads to VoiceOver as one line', () => {
    show(placed());
    expect(screen.getByTestId('comment-who').textContent).toBe('trang');
    expect(screen.getByTestId('comment-when').textContent).toBe('2h ago');
    expect(screen.getByTestId('comment-body').textContent).toBe('Lovely rooftop');
    expect(screen.getByTestId('comment-words').getAttribute('aria-label')).toBe('trang, 2h ago, Lovely rooftop');
  });

  it('opens the writer\'s page from the face, by the handle without its @', () => {
    show(placed());
    fireEvent.click(screen.getByTestId('comment-face'));
    expect(onPerson).toHaveBeenCalledWith('trang');
  });

  it('falls back to the name, then to "Someone", and then the face is no door', () => {
    show(placed({ handle: null }));
    expect(screen.getByTestId('comment-who').textContent).toBe('Trang Le');
    expect(screen.queryByTestId('comment-face')).toBeNull();
    cleanup();
    state.lang = 'vi';
    show(placed({ handle: null, full_name: null }));
    expect(screen.getByTestId('comment-who').textContent).toBe('Ai đó');
  });

  it('sits further in at each level, a root with the larger face', () => {
    show(placed());
    expect(viewStyleOf(screen.getByTestId('comment-row')).marginLeft).toBe(0);
    expect(faceSize()).toBe(FACE);
    cleanup();
    show(placed({ level: 1, depth: 1 }));
    expect(viewStyleOf(screen.getByTestId('comment-row')).marginLeft).toBe(INDENT[1]);
    expect(faceSize()).toBe(FACE_REPLY);
    cleanup();
    show(placed({ level: 2, depth: 2 }));
    expect(viewStyleOf(screen.getByTestId('comment-row')).marginLeft).toBe(INDENT[2]);
    // An answer starts under the words of what it answers.
    expect([...INDENT]).toEqual([0, 46, 84]);
  });

  it('names who a deep answer is to, ahead of its words, and nobody otherwise', () => {
    show(placed());
    expect(screen.queryByTestId('comment-to')).toBeNull();
    cleanup();
    show(placed({ level: 2, depth: 3, to: '@Hado', body: 'agreed' }));
    expect(screen.getByTestId('comment-to').textContent).toBe('@hado ');
    expect(screen.getByTestId('comment-body').textContent).toBe('@hado agreed');
  });
});

describe('the way to answer', () => {
  it('is not drawn on a page that gave none', () => {
    show(placed());
    expect(screen.queryByTestId('comment-reply')).toBeNull();
  });

  it('is a control of its own under the words, named for whom it answers', () => {
    render(<CommentRow comment={placed()} when="2h ago" onPerson={onPerson} onReply={onReply} />);
    const reply = screen.getByTestId('comment-reply');
    // A bubble, not a word: its name is what says it.
    expect(reply.querySelector('[data-icon]')!.getAttribute('data-icon')).toBe('chatbubble-outline');
    expect(reply.textContent).toBe('');
    expect(reply.getAttribute('aria-label')).toBe('Reply to trang');
    // Outside the line VoiceOver reads as one, or it could not be reached.
    expect(screen.getByTestId('comment-words').contains(reply)).toBe(false);
    fireEvent.click(reply);
    expect(onReply).toHaveBeenCalledTimes(1);
    expect(onPerson).not.toHaveBeenCalled();
  });

});

describe('the ⋯ at its end', () => {
  it('is not drawn where the page has nothing to offer', () => {
    show(placed());
    expect(screen.queryByTestId('comment-more-menu')).toBeNull();
  });

  it('raises what can be done, as a control of its own named for whose comment it is', () => {
    const onMore = vi.fn();
    render(<CommentRow comment={placed()} when="2h ago" onPerson={onPerson} onMore={onMore} />);
    const more = screen.getByTestId('comment-more-menu');
    expect(more.getAttribute('aria-label')).toBe("More about trang's comment");
    expect(screen.getByTestId('comment-words').contains(more)).toBe(false);
    // After the words, at the row's end.
    expect(screen.getByTestId('comment-row').lastElementChild!.contains(more)).toBe(true);
    fireEvent.click(more);
    expect(onMore).toHaveBeenCalledTimes(1);
    expect(onPerson).not.toHaveBeenCalled();
  });
});

describe('a tag', () => {
  const tagged = placed({
    body: '🍜 @trang at Cafe!',
    mentions: [
      { at: 2, len: 6, person: 'u2', handle: '@Trang.New', place: null },
      { at: 12, len: 4, person: null, handle: null, place: 'p1' },
    ],
  });

  it('is drawn in the accent where it stands, the words around it as they were', () => {
    show(tagged);
    expect(screen.getByTestId('comment-body').textContent).toBe('🍜 @trang at Cafe!');
    const person = screen.getByTestId('comment-tag-person');
    expect(person.textContent).toBe('@trang');
    expect(inkOf(person)).toBe(colors.accent);
    expect(textStyleOf(screen.getByTestId('comment-body'))?.color).toBe(colors.text);
    expect(screen.getByTestId('comment-tag-place').textContent).toBe('Cafe');
  });

  it('opens the person by the handle they have today, not the text tagged', () => {
    show(tagged);
    fireEvent.click(screen.getByTestId('comment-tag-person'));
    expect(onPerson).toHaveBeenCalledWith('trang.new');
  });

  it('is not a door for a person whose handle did not come', () => {
    show(placed({ body: '@gone', mentions: [{ at: 0, len: 5, person: 'u9', handle: null, place: null }] }));
    const tag = screen.getByTestId('comment-tag-person');
    fireEvent.click(tag);
    expect(onPerson).not.toHaveBeenCalled();
    expect(tag.getAttribute('role')).toBeNull();
  });

  it('opens a place only when the page gave it somewhere to go', () => {
    show(tagged);
    fireEvent.click(screen.getByTestId('comment-tag-place'));
    expect(onPlace).not.toHaveBeenCalled();
    cleanup();
    show(tagged, true);
    fireEvent.click(screen.getByTestId('comment-tag-place'));
    expect(onPlace).toHaveBeenCalledWith('p1');
  });
});
