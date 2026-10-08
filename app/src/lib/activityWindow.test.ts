import { describe, expect, it } from 'vitest';
import { APPLAUSE_DAYS, windowStart } from './activityWindow';

describe('the feed’s window', () => {
  it('is fourteen days, and opens that far back from now', () => {
    expect(APPLAUSE_DAYS).toBe(14);
    expect(windowStart(new Date('2026-10-08T10:00:00Z'))).toBe('2026-09-24T10:00:00.000Z');
  });
});
