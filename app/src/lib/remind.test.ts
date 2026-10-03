import { describe, expect, it } from 'vitest';
import {
  DAY_OF_EARLIEST_HOUR, DAY_OF_LEAD_MIN, dayOfFireDate, fireDateFor, planReminderSync, REMINDER_HOUR,
  REMINDER_PREFIX, reminderFireDate, reminderIdFor, reminderOf, reminderText, startMinOf, TODAY_PREFIX,
  tripIdOfReminder, tripsToRemind, type ReminderHeld, type ReminderKind, type ReminderWant,
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

describe('dayOfFireDate', () => {
  const now = new Date(2026, 7, 23, 12, 0); // Aug 23, noon

  it('two hours before the first stop, on the day', () => {
    const fire = dayOfFireDate('2026-08-25', 18 * 60, now)!;
    expect([fire.getMonth(), fire.getDate(), fire.getHours(), fire.getMinutes()]).toEqual([7, 25, 16, 0]);
    expect(DAY_OF_LEAD_MIN).toBe(120);
  });

  it('never before seven in the morning', () => {
    // 08:30 start: two hours before is 06:30, which is clamped to 07:00.
    const fire = dayOfFireDate('2026-08-25', 8 * 60 + 30, now)!;
    expect([fire.getHours(), fire.getMinutes()]).toEqual([DAY_OF_EARLIEST_HOUR, 0]);
  });

  it('is no note at all for a start at or before seven, or with no timed stop', () => {
    expect(dayOfFireDate('2026-08-25', 7 * 60, now)).toBeNull();
    expect(dayOfFireDate('2026-08-25', 6 * 60, now)).toBeNull();
    expect(dayOfFireDate('2026-08-25', null, now)).toBeNull();
  });

  it('a trip saved on the day still gets its note while the moment is ahead', () => {
    // Saved at noon for 19:00 tonight: the evening-before note is gone,
    // the day-of fires at 17:00.
    expect(reminderFireDate('2026-08-23', now)).toBeNull();
    const fire = dayOfFireDate('2026-08-23', 19 * 60, now)!;
    expect([fire.getDate(), fire.getHours()]).toEqual([23, 17]);
    // Saved at noon for 13:00: 11:00 has passed, so nothing.
    expect(dayOfFireDate('2026-08-23', 13 * 60, now)).toBeNull();
  });

  it('a day that does not parse is silence, not a crash', () => {
    expect(dayOfFireDate('someday', 18 * 60, now)).toBeNull();
  });

  it('is what fireDateFor hands back for the day-of kind, as the evening one is for eve', () => {
    const w: ReminderWant = { tripId: 'a', day: '2026-08-25', title: 'Pho', startMin: 18 * 60 };
    expect(fireDateFor('today', w, now)).toEqual(dayOfFireDate('2026-08-25', 18 * 60, now));
    expect(fireDateFor('eve', w, now)).toEqual(reminderFireDate('2026-08-25', now));
  });
});

describe('startMinOf', () => {
  it('is the earliest timed stop, whatever the row order, and null without one', () => {
    expect(startMinOf([{ arrive_min: 19 * 60 }, { arrive_min: 18 * 60 }, { arrive_min: null }])).toBe(18 * 60);
    expect(startMinOf([{ arrive_min: null }, {}])).toBeNull();
    expect(startMinOf([])).toBeNull();
  });
});

describe('reminder identifiers', () => {
  it('round-trips a trip id and its kind, and refuses anything that is not ours', () => {
    expect(reminderIdFor('t1')).toBe(`${REMINDER_PREFIX}t1`);
    expect(reminderIdFor('t1', 'today')).toBe(`${TODAY_PREFIX}t1`);
    expect(reminderOf(reminderIdFor('t1', 'eve'))).toEqual({ tripId: 't1', kind: 'eve' });
    expect(reminderOf(reminderIdFor('t1', 'today'))).toEqual({ tripId: 't1', kind: 'today' });
    expect(tripIdOfReminder(reminderIdFor('t1'))).toBe('t1');
    expect(reminderOf('some-other-app-thing')).toBeNull();
    expect(reminderOf(REMINDER_PREFIX)).toBeNull();
    expect(reminderOf(TODAY_PREFIX)).toBeNull();
    expect(tripIdOfReminder('nope')).toBeNull();
  });
});

describe('tripsToRemind', () => {
  // Without `stops`, the row has no `trip_stops` at all — the shape a trip
  // list fetched without its stops hands over.
  const trip = (id: string, owner_id: string, stops?: { arrive_min: number | null }[]) =>
    ({ id, owner_id, day: '2026-09-20', title: `Trip ${id}`, ...(stops ? { trip_stops: stops } : {}) });
  const invite = (trip_id: string, invitee_id: string, status: string) => ({ trip_id, invitee_id, status });

  it('reminds the planner and whoever accepted, and nobody who has not said yes', () => {
    const trips = [
      trip('own', 'me', [{ arrive_min: 18 * 60 }, { arrive_min: 20 * 60 }]),
      trip('yes', 'host'), trip('asked', 'host'), trip('no', 'host'),
    ];
    const invites = [
      invite('yes', 'me', 'accepted'), invite('asked', 'me', 'pending'), invite('no', 'me', 'declined'),
      // Somebody else's yes on a trip the reader was only asked onto.
      invite('asked', 'other', 'accepted'),
    ];
    expect(tripsToRemind(trips, invites, 'me')).toEqual([
      { tripId: 'own', day: '2026-09-20', title: 'Trip own', startMin: 18 * 60 },
      { tripId: 'yes', day: '2026-09-20', title: 'Trip yes', startMin: null },
    ]);
  });

  it('reminds nobody signed out', () => {
    expect(tripsToRemind([trip('own', 'me')], [], null)).toEqual([]);
  });
});

describe('planReminderSync', () => {
  // Noon on the 15th, local: a trip on the 20th reminds on the 19th at
  // 20:00 and on the 20th two hours before its first stop.
  const now = new Date(2026, 8, 15, 12, 0, 0);
  const want = (tripId: string, day = '2026-09-20', title = 'Pho night', startMin: number | null = 18 * 60): ReminderWant =>
    ({ tripId, day, title, startMin });
  const held = (
    tripId: string, kind: ReminderKind = 'eve', day: string | null = '2026-09-20',
    title: string | null = 'Pho night', startMin: number | null = 18 * 60,
  ): ReminderHeld => ({ tripId, kind, day, title, startMin });
  const ids = (plan: { schedule: { kind: ReminderKind; want: ReminderWant }[] }) =>
    plan.schedule.map((p) => `${p.kind}:${p.want.tripId}`);

  it('plants both notes for what is missing and leaves what is already right', () => {
    const plan = planReminderSync([want('a'), want('b')], [held('a', 'eve'), held('a', 'today')], now);
    expect(ids(plan)).toEqual(['eve:b', 'today:b']);
    expect(plan.cancel).toEqual([]);
  });

  it('plants only the missing half when the other is held', () => {
    expect(ids(planReminderSync([want('a')], [held('a', 'eve')], now))).toEqual(['today:a']);
  });

  it('plants no day-of note for a trip without a start', () => {
    expect(ids(planReminderSync([want('a', '2026-09-20', 'Pho night', null)], [], now))).toEqual(['eve:a']);
  });

  it('replants when the day, the title or the start moved, or was never recorded', () => {
    const plan = planReminderSync(
      [want('a', '2026-09-21'), want('b', '2026-09-20', 'Renamed'), want('c'), want('d', '2026-09-20', 'Pho night', 19 * 60)],
      [
        held('a'), held('a', 'today'), held('b'), held('b', 'today'),
        held('c', 'eve', null, null, null), held('c', 'today', null, null, null),
        held('d'), held('d', 'today'),
      ],
      now,
    );
    expect(ids(plan)).toEqual(['eve:a', 'today:a', 'eve:b', 'today:b', 'eve:c', 'today:c', 'eve:d', 'today:d']);
    expect(plan.cancel).toEqual([]);
  });

  it('pulls both notes for a trip no longer wanted — deleted, left, withdrawn', () => {
    const plan = planReminderSync([want('a')], [held('a'), held('a', 'today'), held('gone'), held('gone', 'today')], now);
    expect(plan.schedule).toEqual([]);
    expect(plan.cancel).toEqual([{ tripId: 'gone', kind: 'eve' }, { tripId: 'gone', kind: 'today' }]);
  });

  it('neither plants nor keeps a note whose moment has already passed', () => {
    // A trip today at 18:00: its evening-before note is gone, its day-of
    // (16:00) is still ahead at noon. A trip tomorrow has both ahead.
    const plan = planReminderSync(
      [want('today', '2026-09-15'), want('tomorrow', '2026-09-16')],
      [held('today', 'eve', '2026-09-15')],
      now,
    );
    expect(ids(plan)).toEqual(['today:today', 'eve:tomorrow', 'today:tomorrow']);
    expect(plan.cancel).toEqual([{ tripId: 'today', kind: 'eve' }]);
  });

  it('pulls everything when the reader is going on nothing — signed out', () => {
    expect(planReminderSync([], [held('a'), held('b', 'today')], now)).toEqual({
      schedule: [], cancel: [{ tripId: 'a', kind: 'eve' }, { tripId: 'b', kind: 'today' }],
    });
  });
});

describe('reminderText', () => {
  const en = (a: string) => a;
  const vi = (_a: string, b: string) => b;
  const ja = (_a: string, _b: string, c: string) => c;

  it('the evening before names the trip and its first hour in each language', () => {
    const w = { title: 'Pho night', startMin: 18 * 60 + 30 };
    expect(reminderText('eve', w, en)).toEqual({ title: 'Tomorrow: Pho night', body: 'First stop at 18:30. Sleep well.' });
    expect(reminderText('eve', w, vi)).toEqual({ title: 'Ngày mai: Pho night', body: 'Điểm dừng đầu lúc 18:30. Ngủ ngon nhé.' });
    expect(reminderText('eve', w, ja).title).toBe('明日：Pho night');
  });

  it('the evening before promises no morning to a trip whose stops carry no time', () => {
    expect(reminderText('eve', { title: 'Pho night', startMin: null }, en).body).toBe('Your plan is tomorrow. Sleep well.');
    expect(reminderText('eve', { title: 'Pho night', startMin: null }, vi).body).toBe('Mai là ngày đi rồi. Ngủ ngon nhé.');
  });

  it('the day of says today, the hour, and to leave in time', () => {
    const w = { title: 'Pho night', startMin: 18 * 60 };
    expect(reminderText('today', w, en)).toEqual({
      title: 'Today: Pho night', body: 'First stop at 18:00. Check the route and leave in time.',
    });
    expect(reminderText('today', w, vi).title).toBe('Hôm nay: Pho night');
    expect(reminderText('today', w, ja).title).toBe('今日：Pho night');
  });
});
