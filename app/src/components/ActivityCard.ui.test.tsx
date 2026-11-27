// @vitest-environment jsdom
//
// What a card shows of its collection's thread (C3b): nothing at all
// where there is no thread to open, and the way in, with a figure once
// there is something to count. The rest of the
// card — its head, its photograph, its heart — is pinned where it is
// used, in the person page's test.

import React from 'react';
import { Text } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '../uitest/render';
import type { Preview, PreviewComment } from '../lib/comments';

const state = vi.hoisted(() => ({ lang: 'en' as 'en' | 'vi' }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: state.lang, t: (en: string, vi: string) => (state.lang === 'vi' ? vi : en) }),
}));

import ActivityCard from './ActivityCard';

const said = (id: string, over: Partial<PreviewComment> = {}): PreviewComment => ({
  id, body: `says ${id}`, created_at: '2026-11-18T00:00:00Z', author: `u-${id}`,
  handle: `@H${id}`, full_name: null, avatar_url: null, ...over,
});
const onComments = vi.fn();
const onHeart = vi.fn();
const show = (comments?: Preview, withThread = true) => render(
  <ActivityCard
    who="Lan" did=" created a collection" title="Old Quarter eats" meta="3 places"
    liked={false} likes={2} onOpen={() => {}} onHeart={onHeart}
    comments={comments} onComments={withThread ? onComments : undefined}
  />,
);
const bubble = () => screen.queryByTestId('activity-comments');
const base = { who: 'Lan', did: ' checked in', title: 'Old Quarter eats', meta: 'Cafés · Hanoi', liked: false, likes: 0, onOpen: () => {} };

beforeEach(() => { vi.clearAllMocks(); state.lang = 'en'; });
afterEach(cleanup);

describe('a card with no thread to open', () => {
  it('draws nothing about comments, whatever it was told of them', () => {
    show({ n: 3, latest: [said('a')], off: false }, false);
    expect(bubble()).toBeNull();
    expect(screen.queryByTestId('activity-previews')).toBeNull();
    // And the heart is as it was.
    expect(screen.getByTestId('activity-heart')).toBeTruthy();
  });
});

describe('the way into the thread', () => {
  it('stands after the heart with no figure while nobody has commented', () => {
    show();
    expect(bubble()!.getAttribute('aria-label')).toBe('Comments');
    expect(screen.queryByTestId('activity-comments-count')).toBeNull();
    expect(screen.queryByTestId('activity-previews')).toBeNull();
    const foot = bubble()!.parentElement!;
    expect(foot.contains(screen.getByTestId('activity-heart'))).toBe(true);
    expect(foot.lastElementChild!.contains(bubble())).toBe(true);
  });

  it('counts the comments, one in the singular', () => {
    show({ n: 1, latest: [said('a')], off: false });
    expect(screen.getByTestId('activity-comments-count').textContent).toBe('1');
    expect(bubble()!.getAttribute('aria-label')).toBe('1 comment');
    cleanup();
    state.lang = 'vi';
    show({ n: 12, latest: [said('a'), said('b')], off: false });
    expect(screen.getByTestId('activity-comments-count').textContent).toBe('12');
    expect(bubble()!.getAttribute('aria-label')).toBe('12 bình luận');
  });

  it('opens the thread, and leaves the heart alone', () => {
    show({ n: 1, latest: [said('a')], off: false });
    fireEvent.click(bubble()!);
    expect(onComments).toHaveBeenCalledTimes(1);
    expect(onHeart).not.toHaveBeenCalled();
  });
});

// The two newest stood under the foot for a day and were taken off
// (owner, 18 Nov 2026): the figure is the invitation, the thread a press.
// A thread its owner closed with nothing in it (owner, 19 Nov 2026):
// the bubble stays where it was, dimmed, and opens nothing.
describe('a closed, empty thread', () => {
  it('keeps the bubble, off, with no way in and no count', () => {
    render(
      <ActivityCard
        who="Lan" did=" created a collection" title="Old Quarter eats" meta="3 places"
        liked={false} likes={2} onOpen={() => {}} onHeart={onHeart}
        comments={{ n: 0 }} commentsOff
      />,
    );
    expect(bubble()!.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(bubble()!);
    expect(onComments).not.toHaveBeenCalled();
    expect(screen.queryByTestId('activity-comments-count')).toBeNull();
  });

  it('is off even where a way in was handed over, and on without the word', () => {
    render(
      <ActivityCard
        who="Lan" did=" created a collection" title="Old Quarter eats" meta="3 places"
        liked={false} likes={2} onOpen={() => {}} onHeart={onHeart}
        onComments={onComments} commentsOff
      />,
    );
    fireEvent.click(bubble()!);
    expect(onComments).not.toHaveBeenCalled();
    cleanup();
    show({ n: 0, latest: [], off: false });
    expect(bubble()!.getAttribute('aria-disabled')).not.toBe('true');
  });
});

describe('the newest comments', () => {
  it('are not drawn on the card, whatever came with the count', () => {
    render(
      <ActivityCard
        who="Lan" did=" created a collection" title="Old Quarter eats" meta="3 places"
        liked={false} likes={2} onOpen={() => {}} onHeart={onHeart}
        comments={{ n: 3, latest: [said('a'), said('b')] } as Preview} onComments={onComments}
      />,
    );
    expect(screen.getByTestId('activity-comments-count').textContent).toBe('3');
    expect(screen.queryByText(/says a/)).toBeNull();
    expect(screen.queryByTestId('activity-previews')).toBeNull();
  });
});

describe('what a card draws under its words', () => {
  it('draws it after the description’s place, inside the card’s press, and nothing when there is none', () => {
    const { rerender } = render(
      <ActivityCard
        who="Lan" did=" checked in" title="Cộng" meta="Cafés" liked={false} likes={0} onOpen={() => {}}
        under={<Text testID="under-it">a note to edit</Text>}
      />,
    );
    expect(screen.getByTestId('activity-open').contains(screen.getByTestId('under-it'))).toBe(true);
    expect(screen.queryByTestId('activity-desc')).toBeNull();
    rerender(<ActivityCard who="Lan" did=" checked in" title="Cộng" meta="Cafés" liked={false} likes={0} onOpen={() => {}} />);
    expect(screen.queryByTestId('under-it')).toBeNull();
  });
});

// Somebody's own words first (owner, 28 Nov 2026): under the head, before
// the picture, outside the press into the place; the place a row after.
describe('a card that leads with words', () => {
  it('draws them after the head and before the picture, outside the press', () => {
    render(<ActivityCard {...base} uri="https://img/c.jpg" lead={<Text>Crisp sourdough.</Text>} placeRow goes />);
    const lead = screen.getByTestId('activity-lead');
    const open = screen.getByTestId('activity-open');
    expect(lead.textContent).toBe('Crisp sourdough.');
    expect(open.contains(lead)).toBe(false);
    expect(screen.getByTestId('activity-line').compareDocumentPosition(lead) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(lead.compareDocumentPosition(open.querySelector('img')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('puts the place in a row with its pin and its ›, and keeps what is drawn under it', () => {
    render(<ActivityCard {...base} lead={<Text>w</Text>} placeRow desc="never drawn here" under={<Text testID="u">under</Text>} />);
    const row = screen.getByTestId('activity-place-row');
    expect(row.textContent).toContain(base.title);
    expect(row.textContent).toContain(base.meta);
    expect(within(row).getByTestId('activity-goes')).toBeTruthy();
    expect(screen.getByTestId('u')).toBeTruthy();
    expect(screen.queryByTestId('activity-desc')).toBeNull();
  });

  it('is the card it was without them', () => {
    render(<ActivityCard {...base} />);
    expect(screen.queryByTestId('activity-lead')).toBeNull();
    expect(screen.queryByTestId('activity-place-row')).toBeNull();
  });
});

describe('the ⋯ at the head', () => {
  it('is not drawn unless handed, and says what it was told to', () => {
    show();
    expect(screen.queryByTestId('activity-more')).toBeNull();
    cleanup();
    const onPress = vi.fn();
    render(
      <ActivityCard
        who="Lan" did=" checked in" title="Omu-Ba" meta=""
        liked={false} likes={0} onOpen={() => {}}
        onMore={{ onPress, label: 'More about this check-in' }}
      />,
    );
    const more = screen.getByTestId('activity-more');
    expect(more.getAttribute('aria-label')).toBe('More about this check-in');
    fireEvent.click(more);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('what kind, and where the press goes', () => {
  it('draws neither the kind’s glyph nor the › unless asked — a collection’s card asks for neither', () => {
    show();
    expect(screen.queryByTestId('activity-did-glyph')).toBeNull();
    expect(screen.queryByTestId('activity-goes')).toBeNull();
    cleanup();
    render(
      <ActivityCard
        who="Lan" did=" checked in" didGlyph="location-outline" title="Omu-Ba" meta=""
        liked={false} likes={0} onOpen={() => {}} goes
      />,
    );
    expect(screen.getByTestId('activity-did-glyph').getAttribute('data-icon')).toBe('location-outline');
    expect(screen.getByTestId('activity-goes').getAttribute('data-icon')).toBe('chevron-forward');
    expect(screen.getByText('Omu-Ba')).toBeTruthy();
  });
});
