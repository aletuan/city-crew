// @vitest-environment jsdom
//
// The invite sheet, rendered.
//
// Three things here are decisions rather than layout, and all three are
// invisible to a typecheck: that an already-invited friend opens ticked
// rather than missing, that an ANSWERED invitation cannot be untapped, and
// that the button says what pressing it will actually do. The last one
// matters most — "Send 1 invite" on a press that would withdraw one is the
// screen lying about a statement that reaches other people.

import React from 'react';
import * as Haptics from 'expo-haptics';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import InviteSheet from './InviteSheet';
import type { InviteRow } from '../lib/invites';

const inv = (over: Partial<InviteRow> = {}): InviteRow => ({
  trip_id: 't1', invitee_id: 'lan', inviter_id: 'me',
  status: 'pending', created_at: '2026-08-26T10:00:00Z', ...over,
});

const people = {
  lan: { id: 'lan', handle: 'lanphuong', full_name: 'Lan Phương', avatar_url: '' },
  minh: { id: 'minh', handle: 'minhdi', full_name: 'Minh Đỗ', avatar_url: '' },
  ha: { id: 'ha', handle: 'hamy', full_name: 'Hà My', avatar_url: '' },
};
const friendIds = ['lan', 'minh', 'ha'];
const onSend = vi.fn();

const show = (props: Partial<React.ComponentProps<typeof InviteSheet>> = {}) => render(
  <InviteSheet
    open
    company="friends"
    friendIds={friendIds}
    people={people}
    mutual={{ lan: 4, minh: 2, ha: 6 }}
    invites={[]}
    sending={false}
    onClose={() => {}}
    onSend={onSend}
    {...props}
  />,
);

beforeEach(() => onSend.mockClear());

describe('the list', () => {
  it('names each friend with their handle and shared saves', () => {
    show();
    expect(screen.getByText('Lan Phương')).toBeTruthy();
    expect(screen.getByText('@lanphuong · 4 mutual saves')).toBeTruthy();
    expect(screen.getByText('@hamy · 6 mutual saves')).toBeTruthy();
  });

  it('says one save in the singular', () => {
    show({ mutual: { lan: 1 } });
    expect(screen.getByText('@lanphuong · 1 mutual save')).toBeTruthy();
  });

  // A friend with nothing in common is still a friend, and a bare "· 0"
  // reads as a score they lost.
  it('leaves the number off entirely when there is nothing shared', () => {
    show({ mutual: {} });
    expect(screen.getByText('@lanphuong')).toBeTruthy();
  });

  it('points at the Crew screen rather than dead-ending an empty list', () => {
    show({ friendIds: [] });
    expect(screen.getByText(/Nobody in your crew yet/)).toBeTruthy();
  });
});

describe('what the button promises', () => {
  it('counts what would be sent, not what is ticked', () => {
    // 'lan' is already invited, so opening pre-ticks her — and pressing
    // Send with only her ticked would send nothing.
    show({ invites: [inv({ invitee_id: 'lan' })] });
    expect(screen.getByText('Send invites')).toBeTruthy();

    fireEvent.click(screen.getByText('Minh Đỗ'));
    expect(screen.getByText('Send 1 invite')).toBeTruthy();
  });

  it('pluralises', () => {
    show();
    fireEvent.click(screen.getByText('Lan Phương'));
    fireEvent.click(screen.getByText('Minh Đỗ'));
    expect(screen.getByText('Send 2 invites')).toBeTruthy();
  });

  // Unticking an unanswered invitation is a withdrawal, and calling that
  // "send" would be the screen describing the wrong statement.
  it('says take back when the press would only withdraw', () => {
    show({ invites: [inv({ invitee_id: 'lan' })] });
    fireEvent.click(screen.getByText('Lan Phương'));
    expect(screen.getByText('Take back 1')).toBeTruthy();
  });

  // A press that does both leads with the sending, which is the half that
  // reaches other people. The withdrawal still happens — the caller gets
  // both lists — and the label under-describing it is a deliberate trade
  // rather than an oversight: "Send 1 and take back 1" is a button nobody
  // reads, and the sheet's own ticks already show the second half.
  it('hands both lists to the caller in one press', () => {
    show({ invites: [inv({ invitee_id: 'lan' })] });
    fireEvent.click(screen.getByText('Lan Phương'));
    fireEvent.click(screen.getByText('Hà My'));
    fireEvent.click(screen.getByText('Send 1 invite'));
    expect(onSend).toHaveBeenCalledWith(['ha'], ['lan']);
  });

  it('does nothing when nothing moved, and says it is not ready', () => {
    show();
    fireEvent.click(screen.getByText('Send invites'));
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Send invites' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('will not fire twice while a send is in flight, and says so', () => {
    show({ sending: true });
    expect(screen.getByText('Sending…')).toBeTruthy();
    fireEvent.click(screen.getByText('Sending…'));
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sending…' }).getAttribute('aria-disabled')).toBe('true');
  });
});

describe('an answered invitation', () => {
  it('wears the answer instead of a checkbox', () => {
    show({ invites: [inv({ invitee_id: 'lan', status: 'accepted' })] });
    expect(screen.getByText('Answered')).toBeTruthy();
  });

  // Withdrawing only reaches unanswered rows, so a tick that sprang back
  // would be the screen offering a statement the server refuses.
  it('cannot be untapped', () => {
    show({ invites: [inv({ invitee_id: 'lan', status: 'accepted' })] });
    fireEvent.click(screen.getByText('Lan Phương'));
    expect(screen.getByText('Send invites')).toBeTruthy();
    expect(onSend).not.toHaveBeenCalled();
  });
});

describe('the note under the list', () => {
  it('says who keeps the plan', () => {
    show();
    expect(screen.getByText(/Times and stops stay yours to edit/)).toBeTruthy();
  });

  it('says the evening is full instead, at the cap', () => {
    show({ invites: Array.from({ length: 20 }, (_, i) => inv({ invitee_id: `p${i}` })) });
    expect(screen.getByText(/twenty is the most one evening can hold/)).toBeTruthy();
  });
});

describe('the sentence under the title', () => {
  it('follows who the day was planned for', () => {
    const { unmount } = show({ company: 'couple' });
    expect(screen.getByText('A couple’s evening — pick who joins.')).toBeTruthy();
    unmount();
    show({ company: 'family' });
    expect(screen.getByText('A family day — pick who joins.')).toBeTruthy();
  });
});

// ── the seat rule ──
//
// A couple's evening holds one guest. One tick fills the seat and the rest
// of the list stands down, with the note saying why; unticking wakes it.
// A seat held by somebody who has already answered greys the list for
// good, and the note says that instead. The arithmetic is `seatsFull`
// and `togglePick`, held at 100% in `lib/invites`; what is pinned here is
// that the sheet reads them — a benched row that still took the tap would
// be a checkbox ignoring a press, which is the exact thing the greying
// exists to avoid.

describe('a couple’s evening', () => {
  it('benches the rest of the list once one guest is ticked, and says why', () => {
    show({ company: 'couple' });
    fireEvent.click(screen.getByText('Lan Phương'));
    expect(screen.getByText('Send 1 invite')).toBeTruthy();
    expect(screen.getByText(/seats one guest — untick to choose someone else/)).toBeTruthy();

    // The tap on a benched row lands on nothing: still one invite, and
    // no click under the thumb either — a benched row is told apart from
    // a live one by the haptic it withholds, which is the one thing about
    // "standing down" this runner can hear. (`togglePick` would refuse
    // the pick regardless; the greying and the silence are the sheet's.)
    const felt = vi.mocked(Haptics.selectionAsync);
    felt.mockClear();
    fireEvent.click(screen.getByText('Minh Đỗ'));
    expect(screen.getByText('Send 1 invite')).toBeTruthy();
    expect(felt).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Send 1 invite'));
    expect(onSend).toHaveBeenCalledWith(['lan'], []);
    // A live row still clicks.
    fireEvent.click(screen.getByText('Lan Phương'));
    expect(felt).toHaveBeenCalledTimes(1);
  });

  it('wakes the list back up when the tick comes off', () => {
    show({ company: 'couple' });
    fireEvent.click(screen.getByText('Lan Phương'));
    fireEvent.click(screen.getByText('Lan Phương'));
    expect(screen.getByText(/Times and stops stay yours to edit/)).toBeTruthy();

    fireEvent.click(screen.getByText('Minh Đỗ'));
    expect(screen.getByText('Send 1 invite')).toBeTruthy();
    fireEvent.click(screen.getByText('Send 1 invite'));
    expect(onSend).toHaveBeenCalledWith(['minh'], []);
  });

  it('is complete once the guest has answered, and the list stays down', () => {
    show({ company: 'couple', invites: [inv({ invitee_id: 'lan', status: 'accepted' })] });
    expect(screen.getByText(/A couple’s evening is complete — your guest has answered/)).toBeTruthy();
    expect(screen.getByText('Answered')).toBeTruthy();

    // Nobody else can be ticked in, and the answered seat cannot be
    // untapped: nothing moves, so the button has nothing to promise.
    fireEvent.click(screen.getByText('Minh Đỗ'));
    fireEvent.click(screen.getByText('Lan Phương'));
    expect(screen.getByText('Send invites')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send invites' }).getAttribute('aria-disabled')).toBe('true');
  });

  // The same words for the same seat, whoever holds it: a guest who said
  // no has not taken the seat, so the list stays awake.
  it('keeps the seat open after a refusal', () => {
    show({ company: 'couple', invites: [inv({ invitee_id: 'lan', status: 'declined' })] });
    expect(screen.getByText(/Times and stops stay yours to edit/)).toBeTruthy();
    fireEvent.click(screen.getByText('Minh Đỗ'));
    expect(screen.getByText('Send 1 invite')).toBeTruthy();
  });
});

describe('a row with less to say', () => {
  it('names a friend by handle when the profile has no name', () => {
    show({ people: { ...people, minh: { ...people.minh, full_name: '' } }, mutual: {} });
    // As the name, and again as the meta line — the handle is all there is.
    expect(screen.getAllByText(/minhdi/)).toHaveLength(2);
  });

  it('calls a friend the crew copy has not loaded Someone, with an empty meta line', () => {
    show({ people: { lan: people.lan }, mutual: {} });
    expect(screen.getAllByText('Someone')).toHaveLength(2);
    // One handle on the sheet — Lan's. Not "@undefined" twice under the
    // two the crew copy has not loaded.
    expect(screen.getAllByText(/@/).map((el) => el.textContent)).toEqual(['@lanphuong']);
  });
});

describe('closed, and opened again', () => {
  it('draws nothing while closed, and reseeds the ticks from the truth on opening', () => {
    const view = render(
      <InviteSheet
        open={false} company="friends" friendIds={friendIds} people={people} mutual={{}}
        invites={[inv({ invitee_id: 'lan' })]} sending={false} onClose={() => {}} onSend={onSend}
      />,
    );
    expect(screen.queryByText('Who’s coming?')).toBeNull();

    view.rerender(
      <InviteSheet
        open company="friends" friendIds={friendIds} people={people} mutual={{}}
        invites={[inv({ invitee_id: 'lan' })]} sending={false} onClose={() => {}} onSend={onSend}
      />,
    );
    expect(screen.getByText('Who’s coming?')).toBeTruthy();
    // Lan opens ticked — what is already sent — so a bare press sends nothing.
    expect(screen.getByText('Send invites')).toBeTruthy();
    fireEvent.click(screen.getByText('Lan Phương'));
    expect(screen.getByText('Take back 1')).toBeTruthy();
  });

  it('leaves through Not now and through the page behind it', () => {
    const onClose = vi.fn();
    show({ onClose });
    fireEvent.click(screen.getByText('Not now'));
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onSend).not.toHaveBeenCalled();
  });
});
