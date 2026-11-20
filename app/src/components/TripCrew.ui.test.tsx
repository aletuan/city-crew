// @vitest-environment jsdom
//
// Who is coming, and — on your own trip — what each of them said.
//
// `TripDetailScreen`'s test stands this row in with a stub, so the row
// itself had never been rendered by a test: not the count, not the two
// silences an invitee's count can be in, not the named list with a
// status beside each name — now a mark on each face. The sorting and the counting are `lib/invites`
// and are held at 100% there; this is what the row makes of them.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';
import type { InviteRow } from '../lib/invites';
import type { FriendProfile } from '../lib/data';

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import TripCrew from './TripCrew';

const invite = (invitee_id: string, status: InviteRow['status'], created_at = '2026-09-01'): InviteRow => ({
  trip_id: 't1', invitee_id, inviter_id: 'me', status, created_at,
});
const person = (id: string, full_name: string, handle = id, avatar_url: string | null = null): FriendProfile =>
  ({ id, full_name, handle, avatar_url } as unknown as FriendProfile);

const PEOPLE = {
  linh: person('linh', 'Linh', 'linh', 'https://x/linh.jpg'),
  minh: person('minh', 'Minh'),
  hoa: person('hoa', '', 'hoa_'),
};

type Props = React.ComponentProps<typeof TripCrew>;
const mine = (over: Partial<Props> = {}) => render(
  <TripCrew
    mine invites={[]} people={PEOPLE} myAvatar="https://x/me.jpg" hostAvatar={null}
    headCount={undefined} canInvite onInvite={() => {}} {...over}
  />,
);
const theirs = (over: Partial<Props> = {}) => render(
  <TripCrew
    mine={false} invites={[]} people={{}} myAvatar={null} hostAvatar="https://x/host.jpg"
    headCount={2} canInvite={false} onInvite={() => {}} {...over}
  />,
);

const faces = (root: HTMLElement) => root.querySelectorAll('img, [data-icon="person-outline"]').length;

describe('your own trip', () => {
  it('starts with just you, and the offer to change that', () => {
    const onInvite = vi.fn();
    const { container } = mine({ onInvite });
    expect(screen.getByText('Just you, for now')).toBeTruthy();
    // One face — yours — and no marks: nobody has been asked yet.
    expect(faces(container)).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Invite' }));
    expect(onInvite).toHaveBeenCalled();
  });

  it('counts the planner plus everyone who said yes, and nobody who has not', () => {
    mine({ invites: [invite('linh', 'accepted'), invite('minh', 'pending'), invite('hoa', 'declined')] });
    // 1 + 1: a maybe is not a yes, and a no is not either.
    expect(screen.getByText('2 going')).toBeTruthy();
  });

  // Only the owner is told what is still owed, and only when something is.
  it('tells the owner what is still owed, in one line', () => {
    mine({ invites: [invite('minh', 'pending'), invite('hoa', 'declined'), invite('linh', 'accepted')] });
    expect(screen.getByText('1 yet to answer · 1 can’t make it')).toBeTruthy();
  });

  it('names a refusal alone when nobody is still to answer', () => {
    mine({ invites: [invite('hoa', 'declined')] });
    expect(screen.getByText('1 can’t make it')).toBeTruthy();
  });

  it('still shows a face for a yes the crew copy has no picture for', () => {
    // A blank face, not a missing one: the person said yes.
    const { container } = mine({ invites: [invite('ghost', 'accepted')], people: {} });
    expect(screen.getByText('2 going')).toBeTruthy();
    const row = screen.getByText('2 going').parentElement!.parentElement!;
    expect(row.querySelectorAll('img, [data-icon="person-outline"]').length).toBe(2);
    expect(container).toBeTruthy();
  });

  it('says nothing about what is owed when everyone has answered yes', () => {
    mine({ invites: [invite('linh', 'accepted')] });
    expect(screen.queryByText(/yet to answer|can’t make it/)).toBeNull();
  });

  // A refusal is a fact the planner has to act on — a table for four is
  // wrong when one of them cannot come — so a declined invitation stays on
  // the row, with its own mark, and is never mistaken for a waiting one.
  it('marks each face with what its owner said, accepted first', () => {
    const { container } = mine({ invites: [invite('hoa', 'declined', '2026-09-01'), invite('minh', 'pending', '2026-09-02'), invite('linh', 'accepted', '2026-09-03')] });
    const marks = (name: string) => container.querySelectorAll(`[data-icon="${name}"]`).length;
    expect([marks('checkmark'), marks('time'), marks('close')]).toEqual([1, 1, 1]);
    // Order is the crew's — yes, waiting, no — and the words are the ones
    // the Maestro flows read by id.
    const said = [0, 1, 2].map((n) => screen.getByTestId(`crew-said-${n}`).getAttribute('aria-label'));
    expect(said).toEqual(['Coming', 'Asked', 'Can’t make it']);
    // The planner's own face carries no mark.
    expect(screen.queryByTestId('crew-said--1')).toBeNull();
  });

  it('names each guest’s face for a screen reader, since the row draws no names', () => {
    mine({ invites: [invite('hoa', 'declined', '2026-09-01'), invite('minh', 'pending', '2026-09-02'), invite('linh', 'accepted', '2026-09-03')] });
    // No name on the profile: the handle, so the face still says who.
    expect(['Linh', 'Minh', '@hoa_'].map((n) => screen.getByLabelText(n))).toHaveLength(3);
  });

  it('calls a person the crew copy has not heard of Someone', () => {
    mine({ invites: [invite('ghost', 'pending')], people: {} });
    expect(screen.getByLabelText('Someone')).toBeTruthy();
    expect(screen.getByTestId('crew-said-0').getAttribute('aria-label')).toBe('Asked');
  });

  it('opens the invite sheet from the faces as well as from the button', () => {
    const onInvite = vi.fn();
    mine({ onInvite, invites: [invite('linh', 'accepted')] });
    fireEvent.click(screen.getByTestId('trip-faces'));
    expect(onInvite).toHaveBeenCalledTimes(1);
  });

  it('shows the planner and three guests, then counts the rest', () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((id) => invite(id, 'accepted'));
    const people = Object.fromEntries(many.map((i) => [i.invitee_id, person(i.invitee_id, i.invitee_id, i.invitee_id, `https://x/${i.invitee_id}.jpg`)]));
    mine({ invites: many, people });
    const row = screen.getByText('6 going').parentElement!.parentElement!;
    expect(row.querySelectorAll('img').length).toBe(4);
    expect(screen.getByText('+2')).toBeTruthy();
  });

  it('draws no count when every guest fits', () => {
    mine({ invites: [invite('linh', 'accepted'), invite('minh', 'pending')] });
    expect(screen.queryByText(/^\+\d/)).toBeNull();
  });

  it('hides the invite button for a solo evening', () => {
    mine({ canInvite: false });
    expect(screen.queryByRole('button', { name: 'Invite' })).toBeNull();
  });
});

describe('a trip you were asked onto', () => {
  it('shows the planner and you, the two ends of the invitation', () => {
    const { container } = theirs();
    expect(faces(container)).toBe(2);
    // The count the provider batched, plus the planner.
    expect(screen.getByText('3 going')).toBeTruthy();
    // Who else was asked is the owner's business: no list, no button.
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/yet to answer/)).toBeNull();
  });

  it('keeps the two silences apart: no line while the count is on its way', () => {
    theirs({ headCount: undefined });
    expect(screen.queryByText(/going|on this one|Just you/)).toBeNull();
  });

  it('and a numberless sentence once the count has died', () => {
    theirs({ headCount: null });
    expect(screen.getByText('You’re on this one.')).toBeTruthy();
  });

  it('never lists other people’s answers, even if rows were handed over', () => {
    theirs({ invites: [invite('linh', 'declined')], people: PEOPLE });
    // No faces beyond the two ends, no marks, no names.
    expect(screen.queryByTestId('crew-said-0')).toBeNull();
    expect(screen.queryByLabelText('Linh')).toBeNull();
  });
});
