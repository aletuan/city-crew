// @vitest-environment jsdom
//
// The share sheet, rendered.
//
// What is pinned is what the sheet promises, since a promise about who can
// read a list is the one that reaches other people: the friends a list is
// already shared with open ticked, the button counts who will have it,
// unticking everyone offers Keep private and takes everyone off, a public
// list is told that sharing makes it private, and an empty crew is shown
// the way to the Crew screen. The arithmetic is `lib/shares`, held at 100%;
// what is here is that the sheet reads it. The rows and the button are
// `FriendPicker`'s, which `InviteSheet.ui.test.tsx` also exercises.

import React from 'react';
import * as Haptics from 'expo-haptics';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, textStyleOf, viewStyleOf } from '../uitest/render';

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

const goTo = vi.hoisted(() => vi.fn());
vi.mock('../nav', () => ({ goTo }));
// A phone's width, where jsdom has 1024: the strip measures its cells
// from it.
vi.mock('react-native', async (orig) => ({
  ...(await orig<typeof import('react-native')>()),
  useWindowDimensions: () => ({ width: 393, height: 852, scale: 3, fontScale: 1 }),
}));

import ShareSheet from './ShareSheet';

const people = {
  lan: { id: 'lan', handle: 'lanphuong', full_name: 'Lan Phương', avatar_url: '' },
  minh: { id: 'minh', handle: 'minhdi', full_name: 'Minh Đỗ', avatar_url: '' },
  ha: { id: 'ha', handle: 'hamy', full_name: 'Hà My', avatar_url: '' },
};
const friendIds = ['lan', 'minh', 'ha'];
const onSave = vi.fn();

const show = (props: Partial<React.ComponentProps<typeof ShareSheet>> = {}) => render(
  <ShareSheet
    open
    isPublic={false}
    friendIds={friendIds}
    blocked={[]}
    people={people}
    shared={[]}
    history={[]}
    sending={false}
    onClose={() => {}}
    onSave={onSave}
    {...props}
  />,
);

const cta = () => screen.getByTestId('share-save');
const ticked = () => [0, 1, 2]
  .map((i) => screen.queryByTestId(`share-friend-${i}`))
  .filter((el): el is HTMLElement => !!el)
  .map((el) => el.getAttribute('aria-checked'));

beforeEach(() => { onSave.mockClear(); goTo.mockClear(); });

// Inside a form that has not been saved (owner, 22 Nov 2026) the press
// writes nothing, so the button must not say it shares.
describe('later', () => {
  it('says Done, with the count, and still hands the ticks to onSave', () => {
    show({ later: true });
    fireEvent.click(screen.getByTestId('share-friend-0'));
    fireEvent.click(screen.getByTestId('share-friend-1'));
    expect(cta().textContent).toBe('Done · 2');
    fireEvent.click(cta());
    expect(onSave).toHaveBeenCalledWith(expect.any(Array), []);
  });

  it('keeps its other words: Keep private, and Find friends with nobody to pick', () => {
    show({ later: true, shared: ['lan'] });
    fireEvent.click(screen.getByTestId('share-friend-0'));
    expect(cta().textContent).toBe('Keep private');
  });

  // Leaving the form's picker takes the answer back, so the way out is
  // "Cancel"; and nothing becomes private until the form's Save, so a
  // public list is not told it will (owner, 24 Nov 2026).
  it('leaves by Cancel, and does not warn a public list that it will become private', () => {
    const onClose = vi.fn();
    show({ later: true, isPublic: true, onClose });
    expect(screen.queryByText('Not now')).toBeNull();
    expect(screen.queryByText(/will become private/)).toBeNull();
    expect(screen.getByText('Only the friends you choose can see and use this list.')).toBeTruthy();
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps Not now and the warning on the list\'s own page', () => {
    show({ isPublic: true });
    expect(screen.getByText('Not now')).toBeTruthy();
    expect(screen.queryByText('Cancel')).toBeNull();
    expect(screen.getByText(/will become private/)).toBeTruthy();
  });
});

describe('the list', () => {
  it('names each friend under their face, says the handle to VoiceOver, and asks for a tick', () => {
    show();
    expect(screen.getByText('Share with friends')).toBeTruthy();
    expect(screen.getByText('Lan Phương')).toBeTruthy();
    // The handle is said, not drawn (owner, 19 Nov 2026: faces in a strip).
    expect(screen.queryByText('@hamy')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Hà My, @hamy' })).toBeTruthy();
    expect(ticked()).toEqual(['false', 'false', 'false']);
    expect(screen.getByText('Only the friends you choose can see and use this list.')).toBeTruthy();
    // No second line under the friends (owner, 19 Nov 2026).
    expect(screen.queryByText(/plan from it/)).toBeNull();
    expect(document.querySelector('[data-icon="eye-outline"]')).toBeNull();
    // The button keeps its distance from the last friend.
    expect(viewStyleOf(screen.getByTestId('picker-gap')).height).toBe(22);
  });

  it('opens with the friends it is shared with ticked, at the head of the strip', () => {
    show({ shared: ['minh'] });
    expect(ticked()).toEqual(['true', 'false', 'false']);
  });

  it('leaves out a friend the reader has blocked', () => {
    show({ blocked: ['minh'] });
    expect(screen.queryByText('Minh Đỗ')).toBeNull();
    expect(screen.getByText('Hà My')).toBeTruthy();
  });

  // A shared friend the crew copy has not loaded is still drawn, ticked,
  // so pressing Share cannot unshare them without anyone touching them.
  it('keeps a friend the list is shared with whom the crew does not know yet', () => {
    show({ friendIds: ['lan'], shared: ['ha'] });
    expect(screen.getByText('Hà My')).toBeTruthy();
    expect(ticked()).toEqual(['true', 'false']);
    fireEvent.click(screen.getByText('Lan Phương'));
    fireEvent.click(cta());
    expect(onSave).toHaveBeenCalledWith(['lan'], []);
  });

  it('clicks under the thumb on a tick', () => {
    show();
    const felt = vi.mocked(Haptics.selectionAsync);
    felt.mockClear();
    fireEvent.click(screen.getByText('Lan Phương'));
    expect(felt).toHaveBeenCalledTimes(1);
  });
});

describe('what the button promises', () => {
  it('asks for a choice before anyone is ticked, and does nothing', () => {
    show();
    expect(cta().textContent).toBe('Choose friends');
    expect(cta().getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(cta());
    expect(onSave).not.toHaveBeenCalled();
  });

  it('counts who will have it, in the singular and the plural', () => {
    show({ shared: ['lan'] });
    fireEvent.click(screen.getByText('Hà My'));
    expect(cta().textContent).toBe('Share with 2 people');
    fireEvent.click(screen.getByText('Lan Phương'));
    expect(cta().textContent).toBe('Share with 1 person');
    fireEvent.click(cta());
    expect(onSave).toHaveBeenCalledWith(['ha'], ['lan']);
  });

  it('is dimmed for the same ticks it opened with', () => {
    show({ shared: ['lan'] });
    expect(cta().textContent).toBe('Share with 1 person');
    expect(cta().getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(cta());
    expect(onSave).not.toHaveBeenCalled();
  });

  it('says Keep private once everyone is unticked, and takes everyone off', () => {
    show({ shared: ['lan', 'ha'] });
    fireEvent.click(screen.getByText('Lan Phương'));
    fireEvent.click(screen.getByText('Hà My'));
    expect(cta().textContent).toBe('Keep private');
    expect(screen.getByTestId('share-save').querySelector('[data-icon="lock-closed-outline"]')).toBeTruthy();
    fireEvent.click(cta());
    expect(onSave).toHaveBeenCalledWith([], ['lan', 'ha']);
  });

  it('will not fire twice while a save is in flight, and says so', () => {
    show({ shared: ['lan'], sending: true });
    expect(cta().textContent).toBe('Saving…');
    fireEvent.click(screen.getByText('Hà My'));
    fireEvent.click(cta());
    expect(onSave).not.toHaveBeenCalled();
  });
});

// Faces across, not rows down (owner, 19 Nov 2026).
describe('the strip', () => {
  const cell = (i: number) => screen.getByTestId(`share-friend-${i}`);
  const names = () => [0, 1, 2].map((i) => cell(i).textContent);

  it('is one strip to scroll sideways, out to the sheet\'s edges, four and a half faces to a screen', () => {
    show();
    const strip = screen.getByTestId('picker-strip');
    expect(viewStyleOf(strip)).toMatchObject({ marginHorizontal: -22 });
    expect(strip.contains(cell(0)) && strip.contains(cell(2))).toBe(true);
    // (393 − 22) / 4.5, whole: the fifth is cut by the screen's edge.
    expect(viewStyleOf(cell(0).firstElementChild!).width).toBe(82);
    expect(4 * 82 + 22 < 393 && 5 * 82 + 22 > 393).toBe(true);
  });

  it('draws a face at 60 with the name under it, on two lines at most', () => {
    show();
    const name = screen.getByText('Lan Phương');
    expect(cell(0).contains(name)).toBe(true);
    expect(textStyleOf(name)).toMatchObject({ fontSize: 13, textAlign: 'center', minHeight: 34 });
    expect(cell(0).querySelector('[data-icon="checkmark"]')).toBeNull();
    expect(cell(0).querySelector('[data-testid="picker-on"]')).toBeNull();
  });

  it('ticks a face on its corner, on a wash, and takes both off again', () => {
    show();
    const halo = () => cell(1).firstElementChild!.firstElementChild!;
    const bare = halo().className;
    fireEvent.click(cell(1));
    expect(ticked()).toEqual(['false', 'true', 'false']);
    const on = cell(1).querySelector('[data-testid="picker-on"]')!;
    expect(on.querySelector('[data-icon="checkmark"]')).toBeTruthy();
    expect(halo().contains(on)).toBe(true);
    expect(halo().className).not.toBe(bare);
    fireEvent.click(cell(1));
    expect(cell(1).querySelector('[data-testid="picker-on"]')).toBeNull();
    expect(halo().className).toBe(bare);
  });

  it('puts who has the list first, then who the owner shares with most', () => {
    const share = (user_id: string, collection_id: string) => ({ user_id, collection_id, created_at: '2026-11-10' });
    show({ shared: ['ha'], history: [share('ha', 'c0'), share('minh', 'c1'), share('minh', 'c2')] });
    expect(names()).toEqual(['Hà My', 'Minh Đỗ', 'Lan Phương']);
    expect(ticked()).toEqual(['true', 'false', 'false']);
  });

  it('says a friend with no name by their handle, once, and nobody as Someone', () => {
    show({ friendIds: ['lan', 'x'], people: { lan: { id: 'lan', handle: 'lanphuong', full_name: '', avatar_url: '' } } });
    expect(screen.getByRole('checkbox', { name: 'lanphuong' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Someone' })).toBeTruthy();
  });
});

describe('a public list', () => {
  it('says sharing makes it private', () => {
    show({ isPublic: true });
    expect(screen.queryByText('Only the friends you choose can see and use this list.')).toBeNull();
    expect(screen.getByText('This list will become private: only the friends you choose can see and use it.')).toBeTruthy();
  });

  // The same ticks still change who can see it: it goes private.
  it('may be shared with the friends already named, which makes it private', () => {
    show({ isPublic: true, shared: ['lan'] });
    expect(cta().getAttribute('aria-disabled')).not.toBe('true');
    fireEvent.click(cta());
    expect(onSave).toHaveBeenCalledWith([], []);
  });

  // "Keep private" would be untrue of a list that is not private.
  it('offers nothing with nobody ticked', () => {
    show({ isPublic: true, shared: ['lan'] });
    fireEvent.click(screen.getByText('Lan Phương'));
    expect(cta().textContent).toBe('Choose friends');
    expect(cta().getAttribute('aria-disabled')).toBe('true');
  });
});

describe('an empty crew', () => {
  it('says so, and the button goes to the Crew screen', () => {
    show({ friendIds: [] });
    expect(screen.getByText(/You have no friends here yet/)).toBeTruthy();
    // Nothing about who will see it: there is nobody to choose
    // (owner, 20 Nov 2026).
    expect(screen.queryByText(/friends you choose/)).toBeNull();
    expect(cta().textContent).toBe('Find friends');
    const onClose = vi.fn();
    cleanup();
    show({ friendIds: [], onClose });
    fireEvent.click(cta());
    // Closed first, then across the tabs, Profile's home kept beneath.
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(goTo).toHaveBeenCalledExactlyOnceWith('Profile', { screen: 'Crew', initial: false });
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('closed, and opened again', () => {
  it('reseeds the ticks from the truth on opening', () => {
    const props = {
      isPublic: false, friendIds, blocked: [], people, sending: false, history: [],
      onClose: () => {}, onSave,
    };
    const view = render(<ShareSheet open shared={['lan']} {...props} />);
    fireEvent.click(screen.getByText('Lan Phương'));
    expect(ticked()).toEqual(['false', 'false', 'false']);
    view.rerender(<ShareSheet open={false} shared={['lan']} {...props} />);
    view.rerender(<ShareSheet open shared={['ha']} {...props} />);
    // Who has the list stands first in the strip.
    expect(ticked()).toEqual(['true', 'false', 'false']);
  });

  it('leaves through Not now and through the page behind it', () => {
    const onClose = vi.fn();
    show({ onClose });
    fireEvent.click(screen.getByText('Not now'));
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
