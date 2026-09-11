// The sync against the phone's own schedule, with the OS stood in for.
//
// What matters here is what reaches `expo-notifications`: which reminders
// are pulled, which are planted and with what, that another app's
// notifications are never touched, and that the sync — which runs on its
// own, with nobody tapping — never raises a permission sheet.

import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { syncTripReminders } from './reminders';

// Noon on the 15th, local.
const NOW = new Date(2026, 8, 15, 12, 0, 0);
const text = (w: { title: string }) => ({ title: `Tomorrow: ${w.title}`, body: 'Sleep well.' });
const held = (tripId: string, day = '2026-09-20', title = 'Pho night') =>
  ({ identifier: `trip-reminder-${tripId}`, content: { data: { tripId, day, title } } });

beforeEach(() => {
  vi.clearAllMocks();
  os.scheduled = [];
  os.granted = true;
});

describe('syncTripReminders', () => {
  it('plants a missing reminder with its trip in the data, for the evening before', async () => {
    await syncTripReminders([{ tripId: 'a', day: '2026-09-20', title: 'Pho night' }], text, NOW);
    expect(os.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const [arg] = os.scheduleNotificationAsync.mock.calls[0] as [{
      identifier: string; content: { title: string; data: unknown }; trigger: { date: Date };
    }];
    expect(arg.identifier).toBe('trip-reminder-a');
    expect(arg.content.title).toBe('Tomorrow: Pho night');
    expect(arg.content.data).toEqual({ tripId: 'a', day: '2026-09-20', title: 'Pho night' });
    expect(arg.trigger.date).toEqual(new Date(2026, 8, 19, 20, 0, 0));
  });

  it('pulls a reminder for a trip no longer wanted, and leaves other apps alone', async () => {
    os.scheduled = [held('a'), held('gone'), { identifier: 'someone-else', content: {} }];
    await syncTripReminders([{ tripId: 'a', day: '2026-09-20', title: 'Pho night' }], text, NOW);
    expect(os.cancelScheduledNotificationAsync.mock.calls).toEqual([['trip-reminder-gone']]);
    expect(os.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('replants one planted before its day and title were recorded', async () => {
    os.scheduled = [{ identifier: 'trip-reminder-a', content: {} }];
    await syncTripReminders([{ tripId: 'a', day: '2026-09-20', title: 'Pho night' }], text, NOW);
    expect(os.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('never asks for permission; without it, still pulls and plants nothing', async () => {
    os.granted = false;
    os.scheduled = [held('gone')];
    await syncTripReminders([{ tripId: 'a', day: '2026-09-20', title: 'Pho night' }], text, NOW);
    expect(os.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(os.cancelScheduledNotificationAsync).toHaveBeenCalledWith('trip-reminder-gone');
    expect(os.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('swallows a failing OS rather than throwing into the app', async () => {
    os.scheduleNotificationAsync.mockRejectedValueOnce(new Error('denied'));
    await expect(
      syncTripReminders([{ tripId: 'a', day: '2026-09-20', title: 'Pho night' }], text, NOW),
    ).resolves.toBeUndefined();
  });
});
