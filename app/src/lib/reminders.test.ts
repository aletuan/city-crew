// The sync against the phone's own schedule, with the OS stood in for.
//
// What matters here is what reaches `expo-notifications`: which reminders
// are pulled, which are planted and with what, that another app's
// notifications are never touched, and that the sync — which runs on its
// own, with nobody tapping — never raises a permission sheet.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const os = vi.hoisted(() => ({
  scheduled: [] as { identifier: string; content: { data?: Record<string, unknown> } }[],
  granted: true,
  scheduleNotificationAsync: vi.fn(async (..._a: unknown[]) => 'id'),
  cancelScheduledNotificationAsync: vi.fn(async (_id: string) => {}),
  requestPermissionsAsync: vi.fn(async () => ({ granted: true })),
}));

vi.mock('expo-notifications', () => ({
  setNotificationHandler: vi.fn(),
  getAllScheduledNotificationsAsync: vi.fn(async () => os.scheduled),
  getPermissionsAsync: vi.fn(async () => ({ granted: os.granted, canAskAgain: true })),
  requestPermissionsAsync: os.requestPermissionsAsync,
  scheduleNotificationAsync: os.scheduleNotificationAsync,
  cancelScheduledNotificationAsync: os.cancelScheduledNotificationAsync,
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

import { cancelTripReminder, scheduleTripReminder, syncTripReminders } from './reminders';

// Noon on the 15th, local.
const NOW = new Date(2026, 8, 15, 12, 0, 0);
const text = (en: string) => en;
const held = (tripId: string, day = '2026-09-20', title = 'Pho night', startMin: number | null = 18 * 60) =>
  ({ identifier: `trip-reminder-${tripId}`, content: { data: { tripId, kind: 'eve', day, title, startMin } } });
const heldToday = (tripId: string, day = '2026-09-20', title = 'Pho night', startMin: number | null = 18 * 60) =>
  ({ identifier: `trip-today-${tripId}`, content: { data: { tripId, kind: 'today', day, title, startMin } } });
const WANT = { tripId: 'a', day: '2026-09-20', title: 'Pho night', startMin: 18 * 60 };

beforeEach(() => {
  vi.clearAllMocks();
  os.scheduled = [];
  os.granted = true;
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
});
afterEach(() => { vi.useRealTimers(); });

describe('syncTripReminders', () => {
  it('plants both missing notes with their trip in the data: the evening before, and the day two hours ahead', async () => {
    await syncTripReminders([WANT], text, NOW);
    expect(os.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    type Arg = { identifier: string; content: { title: string; body: string; data: unknown }; trigger: { date: Date } };
    const [[eve], [today]] = os.scheduleNotificationAsync.mock.calls as [[Arg], [Arg]];
    expect(eve.identifier).toBe('trip-reminder-a');
    expect(eve.content.title).toBe('Tomorrow: Pho night');
    expect(eve.content.body).toBe('First stop at 18:00. Sleep well.');
    expect(eve.content.data).toEqual({ tripId: 'a', kind: 'eve', day: '2026-09-20', title: 'Pho night', startMin: 18 * 60 });
    expect(eve.trigger.date).toEqual(new Date(2026, 8, 19, 20, 0, 0));
    expect(today.identifier).toBe('trip-today-a');
    expect(today.content.title).toBe('Today: Pho night');
    expect(today.content.data).toEqual({ tripId: 'a', kind: 'today', day: '2026-09-20', title: 'Pho night', startMin: 18 * 60 });
    expect(today.trigger.date).toEqual(new Date(2026, 8, 20, 16, 0, 0));
  });

  it('plants only the half the phone lacks', async () => {
    os.scheduled = [held('a')];
    await syncTripReminders([WANT], text, NOW);
    expect(os.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect((os.scheduleNotificationAsync.mock.calls[0][0] as { identifier: string }).identifier).toBe('trip-today-a');
  });

  it('pulls both notes for a trip no longer wanted, and leaves other apps alone', async () => {
    os.scheduled = [held('a'), heldToday('a'), held('gone'), heldToday('gone'), { identifier: 'someone-else', content: {} }];
    await syncTripReminders([WANT], text, NOW);
    expect(os.cancelScheduledNotificationAsync.mock.calls).toEqual([['trip-reminder-gone'], ['trip-today-gone']]);
    expect(os.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('replants one planted before its day, title and start were recorded', async () => {
    os.scheduled = [{ identifier: 'trip-reminder-a', content: {} }, heldToday('a')];
    await syncTripReminders([WANT], text, NOW);
    expect(os.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect((os.scheduleNotificationAsync.mock.calls[0][0] as { identifier: string }).identifier).toBe('trip-reminder-a');
  });

  it('never asks for permission; without it, still pulls and plants nothing', async () => {
    os.granted = false;
    os.scheduled = [held('gone')];
    await syncTripReminders([WANT], text, NOW);
    expect(os.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(os.cancelScheduledNotificationAsync).toHaveBeenCalledWith('trip-reminder-gone');
    expect(os.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('swallows a failing OS rather than throwing into the app', async () => {
    os.scheduleNotificationAsync.mockRejectedValueOnce(new Error('denied'));
    await expect(syncTripReminders([WANT], text, NOW)).resolves.toBeUndefined();
  });
});

describe('scheduleTripReminder', () => {
  it('asks once, then plants both notes with the first stop\'s hour', async () => {
    await scheduleTripReminder({ id: 'a', day: '2026-09-20', title: 'Pho night', startMin: 18 * 60 }, text);
    expect(os.requestPermissionsAsync).not.toHaveBeenCalled(); // already granted
    expect(os.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    const ids = os.scheduleNotificationAsync.mock.calls.map((c) => (c[0] as { identifier: string }).identifier);
    expect(ids).toEqual(['trip-reminder-a', 'trip-today-a']);
  });

  it('plants only the evening note for a trip whose stops carry no time', async () => {
    await scheduleTripReminder({ id: 'a', day: '2026-09-20', title: 'Pho night', startMin: null }, text);
    const ids = os.scheduleNotificationAsync.mock.calls.map((c) => (c[0] as { identifier: string }).identifier);
    expect(ids).toEqual(['trip-reminder-a']);
  });

  it('does not ask for permission when nothing is due', async () => {
    os.granted = false;
    await scheduleTripReminder({ id: 'a', day: '2026-01-01', title: 'Gone', startMin: 18 * 60 }, text);
    expect(os.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(os.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('cancelTripReminder', () => {
  it('pulls both notes', async () => {
    await cancelTripReminder('a');
    expect(os.cancelScheduledNotificationAsync.mock.calls).toEqual([['trip-reminder-a'], ['trip-today-a']]);
  });
});
