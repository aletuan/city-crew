import { describe, expect, it } from 'vitest';
import { DAILY_CAPS, DAILY_LIMIT, isDailyLimit, refusedByPolicy, RLS_REFUSED } from './quota';

describe('refusedByPolicy', () => {
  it('knows the SQLSTATE PostgREST reports a refused row with', () => {
    expect(refusedByPolicy({ code: RLS_REFUSED, message: 'new row violates row-level security policy for table "collections"' })).toBe(true);
  });

  // Storage reports its policies with the sentence and no code.
  it('knows the sentence when there is no code', () => {
    expect(refusedByPolicy({ message: 'new row violates row-level security policy' })).toBe(true);
    expect(refusedByPolicy({ code: null, message: 'New Row Violates Row-Level Security Policy' })).toBe(true);
  });

  it('leaves every other failure alone', () => {
    expect(refusedByPolicy({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe(false);
    expect(refusedByPolicy({ message: 'Network request failed' })).toBe(false);
    expect(refusedByPolicy({ code: '23505' })).toBe(false);
    expect(refusedByPolicy(null)).toBe(false);
    expect(refusedByPolicy(undefined)).toBe(false);
  });
});

describe('isDailyLimit', () => {
  it('recognises the name a writer throws, and nothing else', () => {
    expect(isDailyLimit(new Error(DAILY_LIMIT))).toBe(true);
    expect(isDailyLimit(new Error('duplicate key'))).toBe(false);
    expect(isDailyLimit(DAILY_LIMIT)).toBe(false);
  });
});

describe('DAILY_CAPS', () => {
  // A copy of the migration's numbers. If this fails, one side moved.
  it('says what the policies enforce', () => {
    expect(DAILY_CAPS).toEqual({ collections: 20, placesIntoLists: 300 });
  });
});
