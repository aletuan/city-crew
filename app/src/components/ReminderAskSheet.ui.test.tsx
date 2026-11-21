// @vitest-environment jsdom
//
// The sheet that explains trip reminders before the phone is asked
// (21 Nov 2026): up when a save offers it, "Not now" asks the phone
// nothing, and "Turn on" asks it once — after the sheet has gone.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '../uitest/render';

const setOn = vi.hoisted(() => vi.fn(async (_on: boolean) => {}));
const modal = vi.hoisted(() => ({ onDismiss: null as null | (() => void) }));
vi.mock('../lib/i18n', () => ({ useI18n: () => ({ t: (en: string) => en }) }));
vi.mock('../lib/reminderPref', () => ({ useReminderPref: () => ({ setOn }) }));
vi.mock('react-native', async (orig) => {
  const rn = await orig<typeof import('react-native')>();
  const R = await import('react');
  return {
    ...rn,
    // The web Modal never says it has dismissed; hand the callback over so
    // the test can be the platform.
    Modal: (p: { visible: boolean; onDismiss?: () => void; children: React.ReactNode }) => {
      modal.onDismiss = p.onDismiss ?? null;
      return p.visible ? R.createElement(R.Fragment, null, p.children) : null;
    },
  };
});

import ReminderAskSheet from './ReminderAskSheet';
import { offerReminderAsk, resetReminderAsk } from '../lib/reminderAsk';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  act(() => resetReminderAsk());
  modal.onDismiss = null;
});

describe('ReminderAskSheet', () => {
  it('is not there until a save offers it', () => {
    render(<ReminderAskSheet />);
    expect(screen.queryByTestId('reminder-ask-on')).toBeNull();
    act(() => offerReminderAsk());
    expect(screen.getByText('Get a nudge before your trip')).toBeTruthy();
  });

  it('"Not now" closes it and asks the phone nothing', () => {
    vi.useFakeTimers();
    render(<ReminderAskSheet />);
    act(() => offerReminderAsk());
    fireEvent.click(screen.getByTestId('reminder-ask-later'));
    expect(screen.queryByTestId('reminder-ask-on')).toBeNull();
    act(() => { vi.advanceTimersByTime(1000); modal.onDismiss?.(); });
    expect(setOn).not.toHaveBeenCalled();
  });

  it('the backdrop is "Not now" too', () => {
    render(<ReminderAskSheet />);
    act(() => offerReminderAsk());
    fireEvent.click(screen.getByLabelText('Not now'));
    expect(screen.queryByTestId('reminder-ask-on')).toBeNull();
    expect(setOn).not.toHaveBeenCalled();
  });

  it('"Turn on" closes first, and asks the phone only when the Modal has gone', () => {
    vi.useFakeTimers();
    render(<ReminderAskSheet />);
    act(() => offerReminderAsk());
    fireEvent.click(screen.getByTestId('reminder-ask-on'));
    expect(screen.queryByTestId('reminder-ask-on')).toBeNull();
    expect(setOn).not.toHaveBeenCalled();
    act(() => { modal.onDismiss?.(); });
    expect(setOn).toHaveBeenCalledTimes(1);
    expect(setOn).toHaveBeenCalledWith(true);
    // The timer behind it finds the job spent: once, not twice.
    act(() => { vi.advanceTimersByTime(1000); });
    expect(setOn).toHaveBeenCalledTimes(1);
  });

  it('asks anyway after a beat where the platform never says the Modal has gone', () => {
    vi.useFakeTimers();
    render(<ReminderAskSheet />);
    act(() => offerReminderAsk());
    fireEvent.click(screen.getByTestId('reminder-ask-on'));
    act(() => { vi.advanceTimersByTime(100); });
    expect(setOn).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(400); });
    expect(setOn).toHaveBeenCalledTimes(1);
  });

  it('a dismissal nobody agreed to asks nothing', () => {
    render(<ReminderAskSheet />);
    act(() => offerReminderAsk());
    act(() => { modal.onDismiss?.(); });
    expect(setOn).not.toHaveBeenCalled();
  });
});
