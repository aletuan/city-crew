import { describe, expect, it } from 'vitest';
import {
  planReminderSync, REMINDER_HOUR, REMINDER_PREFIX, reminderFireDate, reminderIdFor,
  reminderText, tripIdOfReminder, tripsToRemind, type ReminderHeld, type ReminderWant,
} from './remind';

// The suite runs on Hanoi time (see vitest.config), so local-time maths
// here is deterministic.
describe('reminderFireDate', () => {
  const now = new Date(2026, 7, 23, 12, 0); // Aug 23, noon

  it('the evening before, at eight', () => {
    const fire = reminderFireDate('2026-08-25', now)!;
    expect(fire.getFullYear()).toBe(2026);
    expect(fire.getMonth()).toBe(7);
    expect(fire.getDate()).toBe(24);
    expect(fire.getHours()).toBe(REMINDER_HOUR);
    expect(fire.getMinutes()).toBe(0);
  });

  it('crosses a month boundary by calendar, not by arithmetic on strings', () => {
    const fire = reminderFireDate('2026-09-01', now)!;
    expect(fire.getMonth()).toBe(7);
    expect(fire.getDate()).toBe(31);
  });

  it('a moment already passed is no reminder at all', () => {
    // Trip tomorrow, but it is already past eight tonight.
    const late = new Date(2026, 7, 23, 21, 0);
    expect(reminderFireDate('2026-08-24', late)).toBeNull();
    // A trip today reminds yesterday, which has gone entirely.
    expect(reminderFireDate('2026-08-23', now)).toBeNull();
  });

  it('exactly eight is not strictly future', () => {
    const atEight = new Date(2026, 7, 24, REMINDER_HOUR, 0, 0, 0);
    expect(reminderFireDate('2026-08-25', atEight)).toBeNull();
  });

  it('a day that does not parse is silence, not a crash', () => {
    expect(reminderFireDate('someday', now)).toBeNull();
    expect(reminderFireDate('2026-8-5', now)).toBeNull();
    expect(reminderFireDate('', now)).toBeNull();
  });
});

describe('reminder identifiers', () => {
  it('round-trips a trip id, and refuses anything that is not ours', () => {
    expect(reminderIdFor('t1')).toBe(`${REMINDER_PREFIX}t1`);
    expect(tripIdOfReminder(reminderIdFor('t1'))).toBe('t1');
    expect(tripIdOfReminder('some-other-app-thing')).toBeNull();
    expect(tripIdOfReminder(REMINDER_PREFIX)).toBeNull();
  });
});

describe('tripsToRemind', () => {
  const trip = (id: string, owner_id: string) => ({ id, owner_id, day: '2026-09-20', title: `Trip ${id}` });
  const invite = (trip_id: string, invitee_id: string, status: string) => ({ trip_id, invitee_id, status });

  it('reminds the planner and whoever accepted, and nobody who has not said yes', () => {
    const trips = [trip('own', 'me'), trip('yes', 'host'), trip('asked', 'host'), trip('no', 'host')];
    const invites = [
      invite('yes', 'me', 'accepted'), invite('asked', 'me', 'pending'), invite('no', 'me', 'declined'),
      // Somebody else's yes on a trip the reader was only asked onto.
      invite('asked', 'other', 'accepted'),
    ];
    expect(tripsToRemind(trips, invites, 'me')).toEqual([
      { tripId: 'own', day: '2026-09-20', title: 'Trip own' },
      { tripId: 'yes', day: '2026-09-20', title: 'Trip yes' },
    ]);
  });

  it('reminds nobody signed out', () => {
    expect(tripsToRemind([trip('own', 'me')], [], null)).toEqual([]);
  });
});

describe('planReminderSync', () => {
  // Noon on the 15th, local: a trip on the 20th reminds on the 19th.
  const now = new Date(2026, 8, 15, 12, 0, 0);
  const want = (tripId: string, day = '2026-09-20', title = 'Pho night'): ReminderWant => ({ tripId, day, title });
  const held = (tripId: string, day: string | null = '2026-09-20', title: string | null = 'Pho night'): ReminderHeld =>
    ({ tripId, day, title });

  it('plants what is missing and leaves what is already right', () => {
    expect(planReminderSync([want('a'), want('b')], [held('a')], now)).toEqual({
      schedule: [want('b')], cancel: [],
    });
  });

  it('replants when the day or the title moved, or was never recorded', () => {
    const plan = planReminderSync(
      [want('a', '2026-09-21'), want('b', '2026-09-20', 'Renamed'), want('c')],
      [held('a'), held('b'), held('c', null, null)],
      now,
    );
    expect(plan.schedule.map((w) => w.tripId)).toEqual(['a', 'b', 'c']);
    expect(plan.cancel).toEqual([]);
  });

  it('pulls a reminder for a trip no longer wanted — deleted, left, withdrawn', () => {
    expect(planReminderSync([want('a')], [held('a'), held('gone')], now)).toEqual({
      schedule: [], cancel: ['gone'],
    });
  });

  it('neither plants nor keeps one whose evening has already passed', () => {
    // A trip today reminded yesterday evening — gone. A trip tomorrow
    // reminds tonight at 20:00, which at noon is still ahead.
    const plan = planReminderSync(
      [want('past', '2026-09-15'), want('tonight', '2026-09-16')],
      [held('past', '2026-09-15')],
      now,
    );
    expect(plan.schedule.map((w) => w.tripId)).toEqual(['tonight']);
    expect(plan.cancel).toEqual(['past']);
  });

  it('pulls everything when the reader is going on nothing — signed out', () => {
    expect(planReminderSync([], [held('a'), held('b')], now)).toEqual({ schedule: [], cancel: ['a', 'b'] });
  });
});

describe('reminderText', () => {
  it('names the trip in each language', () => {
    const en = (a: string) => a;
    const vi = (_a: string, b: string) => b;
    expect(reminderText('Pho night', en)).toEqual({
      title: 'Tomorrow: Pho night', body: 'Your plan starts in the morning. Sleep well.',
    });
    expect(reminderText('Pho night', vi).title).toBe('Ngày mai: Pho night');
  });
});
