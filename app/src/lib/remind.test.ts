import { describe, expect, it } from 'vitest';
import { REMINDER_HOUR, reminderFireDate } from './remind';

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
