import { describe, expect, it } from 'vitest';
import { OFF_KEY, offFrom, permissionOf, remindState } from './remindState';

describe('offFrom', () => {
  it('is off only for a written "1": anything else is the default, on', () => {
    expect(offFrom('1')).toBe(true);
    expect(offFrom(null)).toBe(false);
    expect(offFrom('0')).toBe(false);
    expect(offFrom('true')).toBe(false);
    expect(OFF_KEY).toBe('reminders:off');
  });
});

describe('permissionOf', () => {
  it('is granted, not asked, or refused — and refused is only when asking again would show nothing', () => {
    expect(permissionOf({ granted: true, canAskAgain: false })).toBe('granted');
    expect(permissionOf({ granted: true, canAskAgain: true })).toBe('granted');
    expect(permissionOf({ granted: false, canAskAgain: true })).toBe('undetermined');
    expect(permissionOf({ granted: false, canAskAgain: false })).toBe('denied');
  });
});

describe('remindState', () => {
  it('is nothing until both facts are known', () => {
    expect(remindState(null, null)).toBeNull();
    expect(remindState('granted', null)).toBeNull();
    expect(remindState(null, false)).toBeNull();
  });

  it('is blocked when refused, whatever the switch says, and ask when never asked', () => {
    expect(remindState('denied', false)).toBe('blocked');
    expect(remindState('denied', true)).toBe('blocked');
    expect(remindState('undetermined', false)).toBe('ask');
    expect(remindState('undetermined', true)).toBe('ask');
  });

  it('follows the reader’s switch once allowed', () => {
    expect(remindState('granted', false)).toBe('on');
    expect(remindState('granted', true)).toBe('off');
  });
});
