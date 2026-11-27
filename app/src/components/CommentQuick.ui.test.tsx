// @vitest-environment jsdom
//
// The first comment, written where the reader is: when a bubble raises
// the field and when it opens the thread; what the field sends, that it
// tells the app and goes away; that a refusal leaves it up with the
// words; and that the dim behind it puts it away having sent nothing.

import React from 'react';
import { Animated, Keyboard, Platform, Text, View } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '../uitest/render';
import { changes } from '../lib/commentsChanged';
import type { Subject } from '../lib/comments';

const data = vi.hoisted(() => ({
  postComment: vi.fn(async (_s: unknown, _parent: string | null, _body: string, _mentions: unknown[]): Promise<string> => 'k-new'),
  fetchTaggable: vi.fn(async (_s: unknown): Promise<{ people: unknown[]; places: unknown[] }> => ({ people: [], places: [] })),
}));
vi.mock('../lib/data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  postComment: data.postComment,
}));
// The hook is the real one; what it asks the server is the fake's.
vi.mock('../lib/data/comments', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  fetchTaggable: data.fetchTaggable,
}));
const who = vi.hoisted(() => ({ profile: { avatar_url: 'https://faces/me.jpg' } as { avatar_url: string } | null, me: 'me' as string | null }));
vi.mock('../lib/auth', () => ({
  useProfile: () => ({ profile: who.profile }),
  useSession: () => ({ session: who.me ? { user: { id: who.me } } : null }),
}));
// A phone with a home indicator, so the margin the field gives up to the
// keyboard can be told from its own padding.
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));
vi.mock('../lib/i18n', () => ({ useI18n: () => ({ lang: 'en', t: (en: string) => en }) }));
// The catalog: empty unless a test says the list is known.
const cat = vi.hoisted(() => ({ lists: [] as unknown[], places: [] as unknown[] }));
vi.mock('../lib/catalog', () => ({
  useCollections: () => ({ data: cat.lists }),
  usePlaces: () => ({ data: cat.places }),
}));

import CommentQuick, { CommentQuickProvider, quickOrThread, useQuickComment } from './CommentQuick';

const SUBJECT: Subject = { kind: 'collection', id: 'c1' };
const onClose = vi.fn();
const field = () => screen.getByTestId('composer-field') as HTMLTextAreaElement;
const type = (words: string) => fireEvent.change(field(), { target: { value: words } });
const send = () => act(async () => { fireEvent.click(screen.getByTestId('composer-send')); await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  vi.clearAllMocks();
  data.postComment.mockImplementation(async () => 'k-new');
  who.profile = { avatar_url: 'https://faces/me.jpg' };
  who.me = 'me';
  cat.lists = [];
  cat.places = [];
  data.fetchTaggable.mockImplementation(async () => ({ people: [], places: [] }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('quickOrThread', () => {
  const known = { me: 'me', n: 0, loaded: true, loading: false };

  it('writes here for somebody signed in when the thread is known to be empty', () => {
    expect(quickOrThread(known)).toBe('quick');
  });

  it('opens the thread when it has comments, for a guest, and while the count is unknown or being asked again', () => {
    expect(quickOrThread({ ...known, n: 1 })).toBe('thread');
    expect(quickOrThread({ ...known, me: null })).toBe('thread');
    expect(quickOrThread({ ...known, loaded: false })).toBe('thread');
    expect(quickOrThread({ ...known, loading: true })).toBe('thread');
  });

  // Your own list writes here too since 22 Nov 2026: its switch is in
  // the list's ⋯ menu as well. A closed thread still opens its page.
  it('opens the thread on a closed one only', () => {
    expect(quickOrThread({ ...known, off: true })).toBe('thread');
    expect(quickOrThread({ ...known, off: false })).toBe('quick');
  });
});

describe('the field over the page', () => {
  it('is not there with nothing to write about', () => {
    render(<CommentQuick target={null} onClose={onClose} />);
    expect(screen.queryByTestId('comment-quick')).toBeNull();
    expect(screen.queryByTestId('composer-field')).toBeNull();
  });

  it('says what it is about, wears the reader\'s face, and takes the cursor', () => {
    render(<CommentQuick target={{ subject: SUBJECT, about: 'Hội An Coffee' }} onClose={onClose} />);
    expect(screen.getByTestId('composer-about').textContent).toBe('Hội An Coffee');
    expect(screen.getByTestId('comment-quick').querySelector('img')!.getAttribute('src')).toBe('https://faces/me.jpg');
    expect(document.activeElement).toBe(field());
    // Nothing is being answered, so nothing says so.
    expect(screen.queryByTestId('composer-replying')).toBeNull();
  });

  it('draws a blank face for a reader whose profile has not come', () => {
    who.profile = null;
    render(<CommentQuick target={{ subject: SUBJECT }} onClose={onClose} />);
    expect(screen.getByTestId('comment-quick').querySelector('img')).toBeNull();
    expect(screen.getByTestId('composer-field')).toBeTruthy();
  });

  // The list the words are for, lit over the dim (27 Nov 2026).
  describe('the card standing on the field', () => {
    const known = () => {
      cat.lists = [{
        id: 'c1', slug: 'street-food', title_en: 'Street food in Hanoi', title_vi: 'x', title_ja: null, curator_handle: 'trang',
        cover: { photo_uri: 'https://img/cover.jpg' }, collection_places: [{ sort_order: 0, places: { slug: 'a' } }],
      }];
    };

    it('shows the list with its cover and facts, and drops the line that named it', () => {
      known();
      render(<CommentQuick target={{ subject: SUBJECT, about: 'Street food in Hanoi' }} onClose={onClose} />);
      const card = screen.getByTestId('comment-about-card');
      expect(card.textContent).toContain('Street food in Hanoi');
      expect(card.textContent).toContain('1 place · trang');
      expect(card.querySelector('img')?.getAttribute('src')).toBe('https://img/cover.jpg');
      expect(screen.queryByTestId('composer-about')).toBeNull();
      // On the field, in the part that rides the keyboard.
      const riding = screen.getByTestId('comment-quick');
      expect(riding.contains(card)).toBe(true);
      expect(card.compareDocumentPosition(screen.getByTestId('composer')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('lets a press on it through to the dim, which puts the field away', () => {
      known();
      render(<CommentQuick target={{ subject: SUBJECT }} onClose={onClose} />);
      expect(getComputedStyle(screen.getByTestId('comment-about-card').parentElement!).pointerEvents).toBe('none');
    });

    it('keeps the line in the field for a list the catalog does not hold', () => {
      render(<CommentQuick target={{ subject: SUBJECT, about: 'Street food in Hanoi' }} onClose={onClose} />);
      expect(screen.queryByTestId('comment-about-card')).toBeNull();
      expect(screen.getByTestId('composer-about').textContent).toBe('Street food in Hanoi');
    });

    it('stays, with the list it showed, while the field is on its way out', () => {
      known();
      vi.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
      vi.spyOn(Animated, 'timing').mockImplementation((() => ({ start: () => {}, stop: () => {} })) as never);
      const { rerender } = render(<CommentQuick target={{ subject: SUBJECT }} onClose={onClose} />);
      rerender(<CommentQuick target={null} onClose={onClose} />);
      expect(screen.getByTestId('comment-about-card').textContent).toContain('Street food in Hanoi');
    });
  });

  // How far it rides, and on what run, is `keyboard.ui.test.tsx`.
  describe('riding the keyboard', () => {
    it('keeps the home indicator\'s margin under the field, for the keyboard to cover', () => {
      render(<CommentQuick target={{ subject: SUBJECT }} onClose={onClose} />);
      expect(getComputedStyle(screen.getByTestId('composer')).paddingBottom).toBe('42px');
    });

    // The head start each way, as measured for this field — `keyboard.tsx`.
    it('sets off a frame into the keyboard\'s rise, and with it on the way down', () => {
      const os = Platform.OS;
      (Platform as { OS: string }).OS = 'ios';
      const heard: Record<string, ((e: unknown) => void)[]> = {};
      vi.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: (e: unknown) => void) => {
        (heard[event] ??= []).push(cb);
        return { remove: () => {} };
      }) as never);
      const runs: number[] = [];
      vi.spyOn(Animated, 'timing').mockImplementation(((_v: unknown, c: { duration: number }) => {
        runs.push(c.duration);
        return { start: () => {}, stop: () => {} };
      }) as never);
      render(<CommentQuick target={{ subject: SUBJECT }} onClose={onClose} />);
      runs.length = 0;
      act(() => heard.keyboardWillShow.forEach((f) => f({ endCoordinates: { height: 336 } })));
      act(() => heard.keyboardWillHide.forEach((f) => f({ endCoordinates: { height: 0 } })));
      expect(runs).toEqual([333, 350]);
      (Platform as { OS: string }).OS = os;
    });

    it('carries the field\'s own ground on down under it', () => {
      render(<CommentQuick target={{ subject: SUBJECT }} onClose={onClose} />);
      const under = getComputedStyle(screen.getByTestId('comment-quick-under'));
      expect(under.top).toBe('100%');
      expect(under.backgroundColor).toBe(getComputedStyle(screen.getByTestId('composer')).backgroundColor);
    });
  });

  // Put away, it leaves with the keyboard and not ahead of it (27 Nov 2026).
  describe('coming and going', () => {
    type Run = { to: number; ms: number; end?: (r: { finished: boolean }) => void; stopped: boolean };
    const runs: Run[] = [];
    beforeEach(() => {
      runs.length = 0;
      vi.spyOn(Animated, 'timing').mockImplementation(((_v: unknown, c: { toValue: number; duration: number }) => {
        const run: Run = { to: c.toValue, ms: c.duration, stopped: false };
        runs.push(run);
        return { start: (end?: Run['end']) => { run.end = end; }, stop: () => { run.stopped = true; } };
      }) as never);
    });

    it('brings the dim in over 200 ms, with no fade of the whole sheet to take the field with it', () => {
      render(<CommentQuick target={{ subject: SUBJECT }} onClose={onClose} />);
      expect(runs.at(-1)).toMatchObject({ to: 1, ms: 200 });
      act(() => runs.at(-1)!.end!({ finished: true }));
      expect(screen.getByTestId('comment-quick')).toBeTruthy();
    });

    it('sends the keyboard down and keeps the field, with what it was about, until the dim has cleared', () => {
      const dismiss = vi.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
      const { rerender } = render(<CommentQuick target={{ subject: SUBJECT, about: 'Street food in Hanoi' }} onClose={onClose} />);
      expect(dismiss).not.toHaveBeenCalled();
      rerender(<CommentQuick target={null} onClose={onClose} />);
      expect(dismiss).toHaveBeenCalledOnce();
      expect(runs.at(-1)).toMatchObject({ to: 0, ms: 250 });
      expect(screen.getByTestId('comment-quick')).toBeTruthy();
      expect(screen.getByText('Street food in Hanoi')).toBeTruthy();
      act(() => runs.at(-1)!.end!({ finished: true }));
      expect(screen.queryByTestId('comment-quick')).toBeNull();
    });

    it('stays when it is raised again before it has gone', () => {
      vi.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
      const { rerender } = render(<CommentQuick target={{ subject: SUBJECT }} onClose={onClose} />);
      rerender(<CommentQuick target={null} onClose={onClose} />);
      const out = runs.at(-1)!;
      rerender(<CommentQuick target={{ subject: SUBJECT, about: 'Another list' }} onClose={onClose} />);
      expect(out.stopped).toBe(true);
      act(() => out.end!({ finished: false }));
      expect(screen.getByText('Another list')).toBeTruthy();
      expect(runs.at(-1)).toMatchObject({ to: 1 });
    });

    it('does not put a keyboard away that it never raised', () => {
      const dismiss = vi.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
      render(<CommentQuick target={null} onClose={onClose} />);
      expect(dismiss).not.toHaveBeenCalled();
    });
  });

  it('posts a comment that answers nobody, tells the app, and goes away', async () => {
    render(<CommentQuick target={{ subject: SUBJECT }} onClose={onClose} />);
    const before = changes();
    type('First!');
    await send();
    expect(data.postComment).toHaveBeenCalledExactlyOnceWith(SUBJECT, null, 'First!', []);
    expect(changes()).toBe(before + 1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks whom may be tagged once there is something to write about, and sends a tag taken from "@"', async () => {
    data.fetchTaggable.mockImplementation(async () => ({
      people: [{ id: 'u-trang', handle: 'trang', full_name: null, avatar_url: null }], places: [],
    }));
    const { rerender } = render(<CommentQuick target={null} onClose={onClose} />);
    await act(async () => { await Promise.resolve(); });
    expect(data.fetchTaggable).not.toHaveBeenCalled();
    rerender(<CommentQuick target={{ subject: SUBJECT }} onClose={onClose} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(data.fetchTaggable).toHaveBeenCalledExactlyOnceWith(SUBJECT);
    type('@t');
    fireEvent.click(screen.getByTestId('composer-offer-person'));
    await send();
    expect(data.postComment).toHaveBeenCalledExactlyOnceWith(SUBJECT, null, '@trang', [
      { at: 0, len: 6, person: 'u-trang', place: null, handle: null, slug: null },
    ]);
  });

  it('asks nothing of whom may be tagged before the reader is known', async () => {
    who.me = null;
    render(<CommentQuick target={{ subject: SUBJECT }} onClose={onClose} />);
    await act(async () => { await Promise.resolve(); });
    expect(data.fetchTaggable).not.toHaveBeenCalled();
  });

  it('stays up with the words when the server refuses, and tells nobody', async () => {
    data.postComment.mockRejectedValueOnce(new Error('comment:off'));
    render(<CommentQuick target={{ subject: SUBJECT }} onClose={onClose} />);
    const before = changes();
    type('Hello');
    await send();
    expect(screen.getByTestId('composer-error').textContent).toContain('turned comments off');
    expect(field().value).toBe('Hello');
    expect(onClose).not.toHaveBeenCalled();
    expect(changes()).toBe(before);
  });

  it('goes away on a press outside it, having sent nothing', () => {
    render(<CommentQuick target={{ subject: SUBJECT }} onClose={onClose} />);
    type('never mind');
    fireEvent.click(screen.getByTestId('comment-quick-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(data.postComment).not.toHaveBeenCalled();
  });
});

// One field for the app, above the navigator: a bubble anywhere under the
// provider raises it, and nothing a bubble sits in is its parent.
describe('the app\'s one field', () => {
  function Bubble() {
    const quick = useQuickComment();
    return (
      <Text onPress={() => quick?.(SUBJECT, 'Old Quarter eats')} testID="bubble">
        {quick ? 'has a field' : 'no field'}
      </Text>
    );
  }
  const mount = () => render(<CommentQuickProvider><View testID="page"><Bubble /></View></CommentQuickProvider>);

  it('is raised by a press under the provider, and put away when it is done with', async () => {
    mount();
    expect(screen.queryByTestId('comment-quick')).toBeNull();
    fireEvent.click(screen.getByTestId('bubble'));
    expect(screen.getByTestId('composer-about').textContent).toBe('Old Quarter eats');
    type('First!');
    await send();
    expect(screen.queryByTestId('comment-quick')).toBeNull();
    // And again, empty, for the next press.
    fireEvent.click(screen.getByTestId('bubble'));
    expect(field().value).toBe('');
    fireEvent.click(screen.getByTestId('comment-quick-close'));
    expect(screen.queryByTestId('comment-quick')).toBeNull();
  });

  // The send button took two presses on a phone while each bubble
  // rendered the field beside itself, inside its page's scroll view
  // (facebook/react-native#28871). The field is the provider's child,
  // never the page's.
  it('is drawn outside the page that raised it', () => {
    mount();
    fireEvent.click(screen.getByTestId('bubble'));
    expect(screen.getByTestId('page').contains(screen.getByTestId('comment-quick'))).toBe(false);
  });

  it('answers no field where none is mounted', () => {
    render(<Bubble />);
    expect(screen.getByTestId('bubble').textContent).toBe('no field');
  });
});
