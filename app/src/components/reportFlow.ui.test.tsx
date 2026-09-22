// @vitest-environment jsdom
//
// Reporting, as the hook any screen can raise.
//
// Three screens use it and all three of their tests stub it to a spy, so
// the sheet, the four reasons, the write and the two dialogs had never
// run under a test. The rules — which things may be reported at all —
// are `lib/report` and are held at 100% there.
//
// Driven through a small harness: a component that renders `node` once
// and exposes `report` and `canReport` as buttons and text, which is
// exactly how a screen uses it.

import React from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '../uitest/render';

const submitReport = vi.hoisted(() => vi.fn(async () => {}));
const auth = vi.hoisted(() => ({ session: { user: { id: 'me' } } as { user: { id: string } } | null }));
vi.mock('../lib/auth', () => ({ useAuth: () => ({ session: auth.session }) }));
vi.mock('../lib/data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  submitReport,
}));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import { useReport, type ReportTarget } from './reportFlow';

const LIST: ReportTarget = { kind: 'collection', id: 'c1', ownerId: 'linh', name: 'Hanoi by night', avatarUrl: 'https://x/l.jpg' };
const MINE: ReportTarget = { kind: 'collection', id: 'c2', ownerId: 'me', name: 'My list' };

function Harness({ target }: { target: ReportTarget }) {
  const { report, canReport, node } = useReport();
  return (
    <>
      {node}
      <Pressable accessibilityRole="button" onPress={() => report(target)}><Text>open</Text></Pressable>
      <Text>{canReport(target) ? 'reportable' : 'not reportable'}</Text>
    </>
  );
}

const open = () => fireEvent.click(screen.getByRole('button', { name: 'open' }));
/**
 * Whether the sheet is up, read from its rows.
 *
 * react-native-web's Modal keeps its children mounted through the fade
 * out and waits for `animationend` to let them go — an event jsdom never
 * fires — so the header's constant words outlive the close. The rows do
 * not: they come from `target`, and `target` is what closing clears.
 */
const reasonsOffered = () => screen.queryAllByRole('button', { name: /Spam or advertising|Something else/ }).length;
const alerted = () => vi.mocked(Alert.alert).mock.calls.map(([title]) => title);

beforeEach(() => {
  submitReport.mockClear();
  submitReport.mockImplementation(async () => {});
  auth.session = { user: { id: 'me' } };
  vi.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

describe('the reason sheet', () => {
  it('is closed until something is reported, then names the thing and asks what is wrong', async () => {
    render(<Harness target={LIST} />);
    expect(screen.queryByText('What is wrong with this?')).toBeNull();

    open();

    expect(await screen.findByText('Hanoi by night')).toBeTruthy();
    expect(screen.getByText('What is wrong with this?')).toBeTruthy();
  });

  it('offers the four reasons, in the desk’s order, each with a sentence under it', async () => {
    render(<Harness target={LIST} />);
    open();
    await screen.findByText('What is wrong with this?');

    for (const title of ['Spam or advertising', 'Offensive or hateful', 'Pretending to be someone', 'Something else']) {
      expect(screen.getByRole('button', { name: title })).toBeTruthy();
    }
    expect(screen.getByText('Using a name, a face, or a business that is not theirs.')).toBeTruthy();
    expect(screen.getByText('Anything the desk should look at that the others do not cover.')).toBeTruthy();
  });

  // The choice IS the confirmation: no second dialog between a person
  // and reporting abuse.
  it('files on the tap, closes, and thanks the reader once the desk has it', async () => {
    render(<Harness target={LIST} />);
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Spam or advertising' }));

    await waitFor(() => expect(submitReport).toHaveBeenCalledWith({
      reporter: 'me', kind: 'collection', targetId: 'c1', reason: 'spam',
    }));
    await waitFor(() => expect(alerted()).toEqual(['Thanks for telling us']));
    // And the sheet is gone — the tap was the whole of it.
    expect(reasonsOffered()).toBe(0);
  });

  it('carries the reason that was tapped, not the first one', async () => {
    render(<Harness target={{ ...LIST, kind: 'profile', id: 'p9' }} />);
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Pretending to be someone' }));

    await waitFor(() => expect(submitReport).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'profile', targetId: 'p9', reason: 'impersonation' }),
    ));
  });

  // Neutral on purpose: the ways this fails are the day's cap and a
  // policy refusal, neither worth spelling out mid-report.
  it('says a report could not be sent, and no more than that', async () => {
    submitReport.mockRejectedValueOnce(new Error('daily_limit'));
    render(<Harness target={LIST} />);
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Something else' }));

    await waitFor(() => expect(alerted()).toEqual(['Could not send this report']));
    expect(vi.mocked(Alert.alert).mock.calls[0][1]).toBe('Please try again later.');
  });

  it('can be dismissed without filing anything', async () => {
    render(<Harness target={LIST} />);
    open();
    await screen.findByText('What is wrong with this?');
    fireEvent.click(screen.getByLabelText('Close'));

    expect(reasonsOffered()).toBe(0);
    expect(submitReport).not.toHaveBeenCalled();
  });
});

describe('who may report what', () => {
  it('lets a reader report somebody else’s list, and not their own', () => {
    const { unmount } = render(<Harness target={LIST} />);
    expect(screen.getByText('reportable')).toBeTruthy();
    unmount();

    render(<Harness target={MINE} />);
    expect(screen.getByText('not reportable')).toBeTruthy();
  });

  it('files nothing for a reader who is not signed in', async () => {
    auth.session = null;
    render(<Harness target={LIST} />);
    expect(screen.getByText('not reportable')).toBeTruthy();
    // The sheet can still be raised by a caller that did not ask first;
    // the write is what refuses.
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Spam or advertising' }));

    expect(reasonsOffered()).toBe(0);
    // The row's action fires 220ms after the sheet closes (see
    // `ActionSheet`); waited out so a write that did happen would show.
    await new Promise((r) => setTimeout(r, 300));
    expect(submitReport).not.toHaveBeenCalled();
    expect(alerted()).toEqual([]);
  });
});
