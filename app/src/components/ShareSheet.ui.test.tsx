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
import { fireEvent, render, screen } from '../uitest/render';

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import ShareSheet from './ShareSheet';

const people = {
  lan: { id: 'lan', handle: 'lanphuong', full_name: 'Lan Phương', avatar_url: '' },
  minh: { id: 'minh', handle: 'minhdi', full_name: 'Minh Đỗ', avatar_url: '' },
  ha: { id: 'ha', handle: 'hamy', full_name: 'Hà My', avatar_url: '' },
};
const friendIds = ['lan', 'minh', 'ha'];
const onSave = vi.fn();
const onCrew = vi.fn();

const show = (props: Partial<React.ComponentProps<typeof ShareSheet>> = {}) => render(
  <ShareSheet
    open
    isPublic={false}
    friendIds={friendIds}
    blocked={[]}
    people={people}
    shared={[]}
    sending={false}
    onClose={() => {}}
    onSave={onSave}
    onCrew={onCrew}
    {...props}
  />,
);

const cta = () => screen.getByTestId('share-save');
const ticked = () => [0, 1, 2]
  .map((i) => screen.queryByTestId(`share-friend-${i}`))
  .filter((el): el is HTMLElement => !!el)
  .map((el) => el.getAttribute('aria-checked'));

beforeEach(() => { onSave.mockClear(); onCrew.mockClear(); });

describe('the list', () => {
  it('names each friend with their handle, and asks for a tick', () => {
    show();
    expect(screen.getByText('Share with friends')).toBeTruthy();
    expect(screen.getByText('Lan Phương')).toBeTruthy();
    expect(screen.getByText('@hamy')).toBeTruthy();
    expect(ticked()).toEqual(['false', 'false', 'false']);
    expect(screen.getByText('Only the friends you tick can open this list.')).toBeTruthy();
    expect(screen.getByText('They can open it and plan from it. Only you can change it.')).toBeTruthy();
  });

  it('opens with the friends it is shared with ticked', () => {
    show({ shared: ['minh'] });
    expect(ticked()).toEqual(['false', 'true', 'false']);
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
    expect(ticked()).toEqual(['false', 'true']);
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

describe('a public list', () => {
  it('says sharing makes it private', () => {
    show({ isPublic: true });
    expect(screen.getByText(/Sharing makes this list private: it leaves Explore and search/)).toBeTruthy();
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
    expect(screen.getByText(/Nobody in your crew yet/)).toBeTruthy();
    expect(cta().textContent).toBe('Find friends');
    fireEvent.click(cta());
    expect(onCrew).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('closed, and opened again', () => {
  it('reseeds the ticks from the truth on opening', () => {
    const props = {
      isPublic: false, friendIds, blocked: [], people, sending: false,
      onClose: () => {}, onSave, onCrew,
    };
    const view = render(<ShareSheet open shared={['lan']} {...props} />);
    fireEvent.click(screen.getByText('Lan Phương'));
    expect(ticked()).toEqual(['false', 'false', 'false']);
    view.rerender(<ShareSheet open={false} shared={['lan']} {...props} />);
    view.rerender(<ShareSheet open shared={['ha']} {...props} />);
    expect(ticked()).toEqual(['false', 'false', 'true']);
  });

  it('leaves through Not now and through the page behind it', () => {
    const onClose = vi.fn();
    show({ onClose });
    fireEvent.click(screen.getByText('Not now'));
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
